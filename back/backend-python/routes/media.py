from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from PIL import Image
import os
import boto3
from botocore.exceptions import ClientError
from datetime import datetime
import io
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()

# Configure S3
s3 = boto3.client(
    's3',
    aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
    aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
    region_name=os.getenv('AWS_REGION')
)
BUCKET_NAME = os.getenv('AWS_BUCKET_NAME')

# Platform-specific dimensions
PLATFORM_DIMENSIONS = {
    'instagram': {
        'image': {
            'square': (1080, 1080),
            'portrait': (1080, 1350),
            'landscape': (1080, 566)
        },
        'video': {
            'portrait': (1080, 1350),
            'landscape': (1080, 608)
        }
    },
    'facebook': {
        'image': (1200, 630),
        'video': (1280, 720)
    },
    'linkedin': {
        'image': (1200, 627),
        'video': (1280, 720)
    },
    'twitter': {
        'image': (1600, 900),
        'video': (1280, 720)
    }
}

def resize_image(image, platform, media_type):
    if platform not in PLATFORM_DIMENSIONS:
        return image
    
    dimensions = PLATFORM_DIMENSIONS[platform]
    
    if media_type == 'image':
        if platform == 'instagram':
            # For Instagram, we'll use square format by default
            target_size = dimensions['image']['square']
        else:
            target_size = dimensions['image']
    else:  # video thumbnail
        if platform == 'instagram':
            target_size = dimensions['video']['portrait']
        else:
            target_size = dimensions['video']
    
    # Calculate the ratio
    ratio = min(target_size[0] / image.size[0], target_size[1] / image.size[1])
    new_size = (int(image.size[0] * ratio), int(image.size[1] * ratio))
    
    # Resize the image
    resized_image = image.resize(new_size, Image.Resampling.LANCZOS)
    
    # Create a new image with the target size and paste the resized image
    final_image = Image.new('RGB', target_size, (255, 255, 255))
    paste_position = ((target_size[0] - new_size[0]) // 2, 
                     (target_size[1] - new_size[1]) // 2)
    final_image.paste(resized_image, paste_position)
    
    return final_image

@router.post("/upload")
async def upload_media(file: UploadFile = File(...), platform: str = None):
    try:
        # Read file content
        content = await file.read()
        
        # Get file extension
        ext = os.path.splitext(file.filename)[1].lower()
        
        # Generate unique filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{timestamp}{ext}"
        
        # Process image if it's an image file
        if ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp']:
            try:
                img = Image.open(io.BytesIO(content))
                
                # Resize image according to platform requirements
                if platform and platform in PLATFORM_DIMENSIONS:
                    img = resize_image(img, platform, 'image')
                
                # Convert to bytes for uploading
                img_byte_arr = io.BytesIO()
                img.save(img_byte_arr, format=img.format, quality=95)
                content = img_byte_arr.getvalue()
            except Exception as e:
                print(f"Image processing error: {str(e)}")
                # Continue with original content if image processing fails

        # Upload to S3
        try:
            s3.put_object(
                Bucket=BUCKET_NAME,
                Key=f"media/{filename}",
                Body=content,
                ContentType=file.content_type
            )
            
            # Generate S3 URL
            file_url = f"https://{BUCKET_NAME}.s3.{os.getenv('AWS_REGION')}.amazonaws.com/media/{filename}"
            
            return JSONResponse({
                "success": True,
                "url": file_url,
                "filename": filename,
                "type": "image" if ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp'] else 
                       "video" if ext in ['.mp4', '.mov', '.avi', '.wmv', '.flv', '.mkv'] else
                       "audio" if ext in ['.mp3', '.wav', '.ogg', '.m4a'] else
                       "document",
                "dimensions": {
                    "width": img.size[0] if 'img' in locals() else None,
                    "height": img.size[1] if 'img' in locals() else None
                }
            })
            
        except ClientError as e:
            print(f"S3 upload error: {str(e)}")
            raise HTTPException(status_code=500, detail="Failed to upload to S3")
            
    except Exception as e:
        print(f"Error processing upload: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
