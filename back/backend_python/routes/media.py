from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import JSONResponse
from PIL import Image
import os
import boto3
from botocore.exceptions import ClientError
from datetime import datetime
import io

router = APIRouter()

def get_s3_client():
    aws_access_key = os.getenv('AWS_ACCESS_KEY_ID')
    aws_secret_key = os.getenv('AWS_SECRET_ACCESS_KEY')
    aws_region = os.getenv('AWS_REGION')
    
    print(f"AWS Region: {aws_region}")
    print(f"AWS Access Key ID exists: {bool(aws_access_key)}")
    print(f"AWS Secret Key exists: {bool(aws_secret_key)}")
    
    return boto3.client(
        's3',
        aws_access_key_id=aws_access_key,
        aws_secret_access_key=aws_secret_key,
        region_name=aws_region
    )

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
async def upload_media(
    file: UploadFile = File(...),
    platform: str = Form(None)
):
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
                
                # Convert to bytes for uploading (ensure a valid format)
                img_byte_arr = io.BytesIO()
                # Fallback format if PIL did not detect one
                fallback_format = 'JPEG' if ext in ['.jpg', '.jpeg'] else 'PNG'
                save_format = img.format or fallback_format
                img.save(img_byte_arr, format=save_format, quality=95)
                content = img_byte_arr.getvalue()
            except Exception as e:
                print(f"Image processing error: {str(e)}")
                # Continue with original content if image processing fails

        # Upload to S3
        try:
            s3 = get_s3_client()
            bucket_name = os.getenv('AWS_BUCKET_NAME')
            content_type = file.content_type if file.content_type else 'video/mp4'
            
            print(f"Uploading to bucket: {bucket_name}")
            print(f"Content type: {content_type}")
            print(f"File size: {len(content)} bytes")
            
            # First, try to check if bucket exists
            try:
                s3.head_bucket(Bucket=bucket_name)
            except ClientError as e:
                error_code = e.response['Error']['Code']
                error_message = e.response['Error']['Message']
                print(f"S3 Bucket Error - Code: {error_code}, Message: {error_message}")
                if error_code == '404':
                    raise HTTPException(status_code=500, detail=f"Bucket {bucket_name} does not exist")
                elif error_code == '403':
                    raise HTTPException(status_code=500, detail=f"Access denied to bucket {bucket_name}")
                else:
                    raise HTTPException(status_code=500, detail=f"Error accessing bucket: {error_message}")
            
            # Upload the file with metadata
            try:
                s3.put_object(
                    Bucket=bucket_name,
                    Key=f"media/{filename}",
                    Body=content,
                    ContentType=content_type,
                    Metadata={
                        'upload-date': datetime.now().isoformat(),
                        'platform': platform or 'unknown',
                        'user-upload': 'true'
                    }
                )
                
                # Generate a pre-signed URL that expires in 1 hour
                file_url = s3.generate_presigned_url(
                    'get_object',
                    Params={
                        'Bucket': bucket_name,
                        'Key': f"media/{filename}"
                    },
                    ExpiresIn=3600  # URL expires in 1 hour
                )
            except ClientError as e:
                error_code = e.response['Error']['Code']
                error_message = e.response['Error']['Message']
                print(f"S3 Upload Error - Code: {error_code}, Message: {error_message}")
                raise HTTPException(status_code=500, detail=f"S3 Upload Error: {error_message}")
            
            # Determine media type and dimensions
            media_type = "image" if ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp'] else \
                        "video" if ext in ['.mp4', '.mov', '.avi', '.wmv', '.flv', '.mkv'] else \
                        "audio" if ext in ['.mp3', '.wav', '.ogg', '.m4a'] else \
                        "document"
            
            # Get dimensions if it's an image
            dimensions = None
            if media_type == "image" and 'img' in locals():
                dimensions = {
                    "width": img.size[0],
                    "height": img.size[1]
                }
            
            return JSONResponse({
                "success": True,
                "url": file_url,
                "filename": filename,
                "type": media_type,
                "dimensions": dimensions
            })
            
        except ClientError as e:
            print(f"S3 upload error: {str(e)}")
            raise HTTPException(status_code=500, detail="Failed to upload to S3")
            
    except Exception as e:
        print(f"Error processing upload: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
