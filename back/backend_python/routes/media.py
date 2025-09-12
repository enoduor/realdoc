from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import JSONResponse
from PIL import Image
import os
import boto3
from botocore.exceptions import ClientError
from datetime import datetime
import io
import mimetypes

router = APIRouter()

def get_s3_client():
    aws_region = os.getenv('AWS_REGION', 'us-west-2')
    
    print(f"AWS Region: {aws_region}")
    print("Using ECS Task Role for S3 authentication")
    
    # Let boto3 use the Task Role - no explicit credentials needed
    return boto3.client('s3', region_name=aws_region)

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

# Backend enforcement: allowed content-types and max upload sizes
IMAGE_EXTS = {'.jpg', '.jpeg', '.png', '.gif', '.webp'}
VIDEO_EXTS = {'.mp4', '.mov', '.avi', '.wmv', '.flv', '.mkv', '.webm'}
AUDIO_EXTS = {'.mp3', '.wav', '.ogg', '.m4a'}

ALLOWED_TYPES = {
    'image': {
        'image/jpeg', 'image/png', 'image/gif', 'image/webp'
    },
    'video': {
        'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-ms-wmv',
        'video/x-flv', 'video/x-matroska', 'video/webm'
    },
    'audio': {
        'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4'
    }
}

# Reasonable server-side caps (match frontend guidance)
DEFAULT_MAX_SIZE = 100 * 1024 * 1024  # 100MB
MAX_SIZE_BY_PLATFORM = {
    'instagram': 15 * 1024 * 1024,  # 15MB
    'twitter':   5 * 1024 * 1024,   # 5MB
    # fallback to DEFAULT_MAX_SIZE for others
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
    # Normalize platform early
    platform = (platform or "").strip().lower() or None

    try:
        # Read file content
        content = await file.read()
        if not content:
            raise HTTPException(status_code=400, detail="Empty file upload")

        # Derive a safe filename and extension
        raw_name = getattr(file, "filename", None) or "upload"
        if not isinstance(raw_name, str):
            raw_name = "upload"
        ext = os.path.splitext(raw_name)[1].lower()

        # Fallback: try to guess extension from content-type
        base_ct = (getattr(file, "content_type", "") or "").split(";")[0].strip()
        if not ext:
            guessed = mimetypes.guess_extension(base_ct) or ".bin"
            ext = guessed.lower()

        # Resolve a safe content-type early
        content_type = base_ct or mimetypes.guess_type(f"dummy{ext}")[0] or 'application/octet-stream'

        # Detect media kind using extension or content-type
        if ext in IMAGE_EXTS or content_type.startswith('image/'):
            media_kind = 'image'
        elif ext in VIDEO_EXTS or content_type.startswith('video/'):
            media_kind = 'video'
        elif ext in AUDIO_EXTS or content_type.startswith('audio/'):
            media_kind = 'audio'
        else:
            media_kind = 'document'

        # Enforce content-type allowlist per media kind (if known)
        allowed_set = ALLOWED_TYPES.get(media_kind)
        if allowed_set and content_type not in allowed_set:
            raise HTTPException(
                status_code=415,
                detail=f"Unsupported content-type for {media_kind}: '{content_type}'. Allowed: {', '.join(sorted(allowed_set))}"
            )

        # Enforce max file size per platform
        max_size = MAX_SIZE_BY_PLATFORM.get(platform, DEFAULT_MAX_SIZE)
        if len(content) > max_size:
            raise HTTPException(
                status_code=413,
                detail=f"File too large for {platform or 'this platform'} (max {int(max_size / (1024*1024))}MB)"
            )

        # Generate unique filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{timestamp}{ext}"

        # Process image if it's an image file
        if ext in IMAGE_EXTS:
            try:
                img = Image.open(io.BytesIO(content))

                # Resize image according to platform requirements
                if platform and platform in PLATFORM_DIMENSIONS:
                    img = resize_image(img, platform, 'image')

                # Convert to bytes for uploading (ensure a valid format)
                img_byte_arr = io.BytesIO()
                # Fallback format if PIL did not detect one
                fallback_format = 'JPEG' if ext in ['.jpg', '.jpeg'] else 'PNG'
                save_format = (getattr(img, 'format', None) or '').upper() or fallback_format
                img.save(img_byte_arr, format=save_format, quality=95)
                content = img_byte_arr.getvalue()
            except Exception as e:
                print(f"Image processing error: {str(e)}")
                # Continue with original content if image processing fails

        # Upload to S3
        try:
            s3 = get_s3_client()
            bucket_name = os.getenv('AWS_BUCKET_NAME')
            if not bucket_name:
                raise HTTPException(status_code=500, detail='S3 not configured (missing AWS_BUCKET_NAME)')

            print(f"Uploading to bucket: {bucket_name}")
            print(f"Content type: {content_type}")
            print(f"File size: {len(content)} bytes")
            
            # First, try to check if bucket exists
            try:
                s3.head_bucket(Bucket=bucket_name)
            except ClientError as e:
                error_code = str(e.response.get('Error', {}).get('Code'))
                error_message = str(e.response.get('Error', {}).get('Message'))
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
                        'platform': platform if (platform and platform in PLATFORM_DIMENSIONS) else 'unknown',
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
                error_code = str(e.response.get('Error', {}).get('Code'))
                error_message = str(e.response.get('Error', {}).get('Message'))
                print(f"S3 Upload Error - Code: {error_code}, Message: {error_message}")
                raise HTTPException(status_code=500, detail=f"S3 Upload Error: {error_message}")
            
            # Determine media type and dimensions
            media_type = media_kind
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
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error processing upload: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))