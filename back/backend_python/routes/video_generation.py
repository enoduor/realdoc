from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
from typing import Optional, List
import os
import boto3
from botocore.exceptions import ClientError
from datetime import datetime
import aiohttp
import asyncio
import json
from utils.auth import require_credits, require_api_key
from utils.logger import logger

router = APIRouter()

# ---------- AWS S3 ----------

def get_s3_client():
    aws_region = os.getenv('AWS_REGION', 'us-west-2')
    print(f"AWS Region: {aws_region}")
    print("Using ECS Task Role for S3 authentication")
    return boto3.client('s3', region_name=aws_region)

# ---------- Schemas ----------

class MessageContent(BaseModel):
    type: str
    text: str

class Message(BaseModel):
    role: str
    content: List[MessageContent]

class VideoGenerationRequest(BaseModel):
    prompt: str
    model: str = "sora-2"           # e.g., sora-2, sora-2-pro
    seconds: int = 4                # 4, 8, 12
    size: str = "720x1280"          # 720x1280, 1280x720, 1024x1792, 1792x1024

# ---------- Helpers ----------

def build_multipart_writer(req: VideoGenerationRequest) -> aiohttp.MultipartWriter:
    """
    Build a multipart/form-data body using aiohttp.MultipartWriter.
    Ensures Content-Type has a proper boundary even on older aiohttp versions.
    Only include fields that OpenAI Sora actually accepts.
    """
    writer = aiohttp.MultipartWriter('form-data')

    def add_text(name: str, value) -> None:
        part = writer.append(str(value))
        part.set_content_disposition('form-data', name=name)

    # Supported fields for OpenAI /v1/videos
    add_text('prompt', req.prompt)
    add_text('model', req.model)
    add_text('seconds', req.seconds)
    add_text('size', req.size)

    return writer

def extract_video_url(status_data: dict) -> Optional[str]:
    # Common single-field locations
    for key in ('url', 'video_url', 'download_url', 'file_url', 'output_url'):
        if status_data.get(key):
            return status_data[key]
    # List-style outputs
    outs = status_data.get('outputs')
    if isinstance(outs, list) and outs:
        first = outs[0]
        if isinstance(first, dict) and first.get('url'):
            return first['url']
    return None

# ---------- Routes ----------

@router.get("/credits")
async def get_credits(user_info: dict = Depends(require_api_key())):
    """
    Get remaining credits for the API key
    """
    return {
        "credits": user_info['credits'],
        "status": user_info['status'],
        "plan": user_info['plan_id']
    }

@router.post("/generate-video")
async def generate_video(
    request: VideoGenerationRequest
):
    """
    Create a Sora video via OpenAI /v1/videos, then stream progress by polling
    /v1/videos/{id}. On completion, download, upload to S3, and stream a final
    success payload with the presigned URL.
    """
    # Get OpenAI API key
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        raise HTTPException(status_code=500, detail='OPENAI_API_KEY not configured')
    
    # Log user info for debugging
    logger.info(f"Generating video for user: {user_info['tenant_id']}, remaining credits: {user_info['remaining_credits']}")

    bucket_name = os.getenv('AWS_BUCKET_NAME')
    if not bucket_name:
        raise HTTPException(status_code=500, detail='AWS_BUCKET_NAME not configured')

    headers = {"Authorization": f"Bearer {api_key}"}  # Let aiohttp set Content-Type

    async def stream():
        try:
            yield f"data: {json.dumps({'status': 'queued', 'message': 'Creating video task…'})}\n\n"

            create_url = "https://api.openai.com/v1/videos"
            writer = build_multipart_writer(request)

            timeout = aiohttp.ClientTimeout(total=600)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                # Create task
                async with session.post(create_url, headers=headers, data=writer) as resp:
                    if resp.status != 200:
                        error_text = await resp.text()
                        yield f"data: {json.dumps({'status': 'error', 'message': f'API Error: {error_text}'})}\n\n"
                        return
                    created = await resp.json()

                video_id = created.get('id')
                if not video_id:
                    yield f"data: {json.dumps({'status': 'error', 'message': 'Invalid create response (missing id)'})}\n\n"
                    return

                yield f"data: {json.dumps({'status': 'queued', 'video_id': video_id})}\n\n"

                # Poll status
                status_url = f"https://api.openai.com/v1/videos/{video_id}"
                last_progress = -1
                while True:
                    async with session.get(status_url, headers=headers) as sresp:
                        if sresp.status != 200:
                            error_text = await sresp.text()
                            yield f"data: {json.dumps({'status': 'error', 'message': f'Status API Error: {error_text}'})}\n\n"
                            return
                        status_data = await sresp.json()

                    status = status_data.get('status', 'unknown')
                    progress = int(status_data.get('progress', 0) or 0)

                    if progress != last_progress:
                        yield f"data: {json.dumps({'status': status, 'progress': progress})}\n\n"
                        last_progress = progress

                    if status in ('completed', 'failed', 'canceled', 'error'):
                        break

                    await asyncio.sleep(3)

                if status != 'completed':
                    yield f"data: {json.dumps({'status': status, 'message': 'Video task did not complete successfully'})}\n\n"
                    return

                # Grab video URL
                video_url = extract_video_url(status_data)
                if not video_url:
                    yield f"data: {json.dumps({'status': 'error', 'message': 'No download URL found in completion response', 'debug': status_data})}\n\n"
                    return

                # Download the video
                yield f"data: {json.dumps({'status': 'downloading', 'message': 'Downloading generated video…'})}\n\n"
                async with session.get(video_url) as vresp:
                    if vresp.status != 200:
                        error_text = await vresp.text()
                        yield f"data: {json.dumps({'status': 'error', 'message': f'Video download failed: {error_text}'})}\n\n"
                        return
                    blob = await vresp.read()

                if len(blob) < 1000:
                    yield f"data: {json.dumps({'status': 'error', 'message': 'Downloaded video too small / invalid'})}\n\n"
                    return

                # Upload to S3
                yield f"data: {json.dumps({'status': 'uploading', 'message': 'Uploading to storage…'})}\n\n"
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                filename = f"sora_generated_{timestamp}.mp4"

                s3 = get_s3_client()
                s3.put_object(
                    Bucket=bucket_name,
                    Key=f"media/original/{filename}",
                    Body=blob,
                    ContentType='video/mp4',
                    Metadata={
                        'upload-date': datetime.now().isoformat(),
                        'source': 'sora-2-generation'
                    }
                )

                file_url = s3.generate_presigned_url(
                    'get_object',
                    Params={'Bucket': bucket_name, 'Key': f"media/original/{filename}"},
                    ExpiresIn=3600
                )

                yield f"data: {json.dumps({'status': 'success', 'message': 'Video ready!', 'url': file_url, 'filename': filename, 'type': 'video'})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'status': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")

@router.post("/generate-video-simple")
async def generate_video_simple(
    request: VideoGenerationRequest
):
    """
    Creates a video and returns the video_id immediately.
    Frontend should poll /check-video-status/{video_id}.
    """
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        raise HTTPException(status_code=500, detail='OPENAI_API_KEY not configured')

    try:
        api_url = "https://api.openai.com/v1/videos"
        headers = {"Authorization": f"Bearer {api_key}"}  # Do NOT set Content-Type manually

        writer = build_multipart_writer(request)
        timeout = aiohttp.ClientTimeout(total=600)

        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(api_url, headers=headers, data=writer) as response:
                if response.status != 200:
                    error_text = await response.text()

                    # Parse richer error JSON if present
                    try:
                        err = json.loads(error_text)
                        if isinstance(err, dict) and err.get('code') == 'insufficient_user_quota':
                            raise HTTPException(
                                status_code=402,
                                detail='Insufficient API credits. Please add credits to your OpenAI account to generate videos.'
                            )
                    except json.JSONDecodeError:
                        pass

                    raise HTTPException(status_code=500, detail=f'API Error: {error_text}')

                data = await response.json()
                if 'id' in data:
                    return JSONResponse({
                        "success": True,
                        "video_id": data['id'],
                        "status": data.get('status', 'queued'),
                        "progress": data.get('progress', 0),
                        "model": data.get('model', request.model)
                    })
                else:
                    raise HTTPException(
                        status_code=500,
                        detail=f'Invalid API response structure. Keys: {list(data.keys())}'
                    )
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Sora-2 ERROR] {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/check-video-status/{video_id}")
async def check_video_status(video_id: str):
    """
    Poll the status of a Sora video generation task.
    Returns progress and video URL when completed; uploads to S3 on completion.
    """
    # Use sys.stdout.flush() to ensure logs are sent to CloudWatch immediately
    import sys
    print(f"[Sora-2 Status Check] Starting status check for video_id: {video_id}", flush=True)
    
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        print("[Sora-2 Status Check ERROR] OPENAI_API_KEY not configured", flush=True)
        raise HTTPException(status_code=500, detail='OPENAI_API_KEY not configured')

    bucket_name = os.getenv('AWS_BUCKET_NAME')
    if not bucket_name:
        print("[Sora-2 Status Check ERROR] AWS_BUCKET_NAME not configured", flush=True)
        raise HTTPException(status_code=500, detail='AWS_BUCKET_NAME not configured')
    
    print(f"[Sora-2 Status Check] Environment variables configured - API key: {'Set' if api_key else 'Not set'}, Bucket: {bucket_name}", flush=True)

    try:
        api_url = f"https://api.openai.com/v1/videos/{video_id}"
        headers = {"Authorization": f"Bearer {api_key}"}

        async with aiohttp.ClientSession() as session:
            async with session.get(api_url, headers=headers) as response:
                if response.status != 200:
                    error_text = await response.text()
                    raise HTTPException(status_code=500, detail=f'API Error: {error_text}')

                response_data = await response.json()
                
                # Log full response to see actual structure
                print(f"[Sora-2 Status] Full API Response: {json.dumps(response_data, indent=2)}")
                
                # OpenAI API returns FLAT structure (status/progress at root level)
                # Comet API returns NESTED structure (response_data.data.data)
                # Support both for compatibility
                
                if 'data' in response_data and isinstance(response_data['data'], dict):
                    # Comet nested structure
                    outer_data = response_data.get('data', {})
                    inner_data = outer_data.get('data', {})
                    video_data = inner_data if inner_data else outer_data
                else:
                    # OpenAI flat structure
                    video_data = response_data
                
                # 1) Normalize status
                provider_status = str(video_data.get('status', '')).lower()

                status_map = {
                    'not_start': 'queued',
                    'queued': 'queued',
                    'waiting': 'queued',
                    'in_progress': 'processing',
                    'running': 'processing',
                    'processing': 'processing',
                    'generating': 'processing',
                    'completed': 'completed',
                    'succeeded': 'completed',
                    'success': 'completed',
                    'failure': 'failed',
                    'failed': 'failed',
                    'error': 'failed',
                    'canceled': 'canceled',
                    'cancelled': 'canceled',
                }
                app_status = status_map.get(provider_status, 'unknown')

                # 2) Normalize progress
                raw_progress = video_data.get('progress', 0)
                if isinstance(raw_progress, str) and raw_progress.endswith('%'):
                    try:
                        progress = int(float(raw_progress.strip('%')))
                    except ValueError:
                        progress = 0
                elif isinstance(raw_progress, float) and raw_progress <= 1.0:
                    progress = int(round(raw_progress * 100))
                else:
                    progress = int(raw_progress or 0)
                progress = max(0, min(progress, 100))

                fail_reason = video_data.get('fail_reason', '') or (video_data.get('error') or {}).get('message', '')
                print(f"[Sora-2 Status] Video {video_id}: {app_status} (provider: {provider_status}) - Progress: {progress}%")

                # Handle failures
                if provider_status in ('failure', 'failed', 'error'):
                    return JSONResponse({
                        "success": False,
                        "status": "failed",
                        "progress": 100,
                        "error": fail_reason or 'Video generation failed',
                        "video_id": video_id,
                        "providerStatus": provider_status
                    })

                # If completed, download and upload to S3
                if app_status == 'completed':
                    print(f"[Sora-2 Complete] Full video_data: {json.dumps(video_data, ensure_ascii=False)}")
                    video_url = None

                    # Download video content directly (OpenAI pattern)
                    content_url = f"https://api.openai.com/v1/videos/{video_id}/content"
                    print(f"[Sora-2] Downloading video content from: {content_url}")
                    
                    video_content = None
                    
                    async with session.get(content_url, headers=headers) as video_response:
                        print(f"[Sora-2] Download response status: {video_response.status}")
                        print(f"[Sora-2] Content-Type: {video_response.headers.get('Content-Type')}")
                        
                        if video_response.status == 200:
                            video_content = await video_response.read()
                            print(f"[Sora-2] Downloaded {len(video_content)} bytes")
                        else:
                            error_text = await video_response.text()
                            print(f"[Sora-2] Download failed: {error_text}")
                    
                    # If we found valid video content, upload to S3
                    if video_content and len(video_content) >= 1000:
                        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                        filename = f"sora_generated_{timestamp}.mp4"

                        s3 = get_s3_client()
                        s3.put_object(
                            Bucket=bucket_name,
                            Key=f"media/original/{filename}",
                            Body=video_content,
                            ContentType='video/mp4',
                            Metadata={
                                'upload-date': datetime.now().isoformat(),
                                'source': 'sora-2-generation',
                                'video-id': video_id
                            }
                        )

                        file_url = s3.generate_presigned_url(
                            'get_object',
                            Params={'Bucket': bucket_name, 'Key': f"media/original/{filename}"},
                            ExpiresIn=3600
                        )

                        return JSONResponse({
                            "success": True,
                            "status": "completed",
                            "progress": 100,
                            "url": file_url,
                            "filename": filename,
                            "type": "video",
                            "providerStatus": provider_status
                        })
                    else:
                        return JSONResponse({
                            "success": True,
                            "status": "completed",
                            "progress": 100,
                            "error": "Video completed but download URL not found in response",
                            "debug_data": inner_data,
                            "providerStatus": provider_status
                        })

                # still processing
                return JSONResponse({
                    "success": True,
                    "status": app_status,
                    "progress": progress,
                    "video_id": video_id,
                    "providerStatus": provider_status
                })

    except HTTPException:
        raise
    except Exception as e:
        from utils.logger import logger
        logger.exception(f"[Sora-2 Status Check ERROR] {str(e)}")
        raise HTTPException(status_code=500, detail=f"Status check failed: {str(e)}")