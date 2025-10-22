import os
import boto3
from fastapi import HTTPException, Depends, Header, Request
from typing import Optional
import asyncio
from functools import wraps
import time
from collections import defaultdict

# Initialize DynamoDB client
dynamodb = boto3.client('dynamodb', region_name='us-west-2')
TABLE_NAME = 'reelpostly-tenants'

# Production rate limiting with DynamoDB
RATE_LIMIT_WINDOW = 60  # 1 minute
MAX_REQUESTS_PER_WINDOW = 10  # 10 requests per minute per API key
RATE_LIMIT_TABLE = 'reelpostly-rate-limits'

class APIKeyAuth:
    def __init__(self):
        self.table_name = TABLE_NAME
    
    async def validate_api_key(self, api_key: str) -> dict:
        """
        Validate API key against DynamoDB and return user info
        """
        try:
            # Query DynamoDB for the API key
            response = dynamodb.query(
                TableName=self.table_name,
                KeyConditionExpression='apiKeyId = :api_key',
                ExpressionAttributeValues={
                    ':api_key': {'S': api_key}
                }
            )
            
            if not response.get('Items'):
                raise HTTPException(status_code=401, detail="Invalid API key")
            
            item = response['Items'][0]
            
            # Extract user info
            user_info = {
                'api_key_id': item['apiKeyId']['S'],
                'tenant_id': item['tenantId']['S'],
                'credits': int(item.get('credits', {}).get('N', '0')),
                'status': item.get('status', {}).get('S', 'inactive'),
                'plan_id': item.get('planId', {}).get('S', 'starter')
            }
            
            # Check if key is active
            if user_info['status'] != 'active':
                raise HTTPException(status_code=403, detail="API key is inactive")
            
            return user_info
            
        except Exception as e:
            if isinstance(e, HTTPException):
                raise e
            raise HTTPException(status_code=500, detail="Authentication error")
    
    async def deduct_credits(self, api_key_id: str, credits_to_deduct: int) -> int:
        """
        Deduct credits from API key and return remaining credits
        """
        try:
            # Use atomic update to deduct credits
            response = dynamodb.update_item(
                TableName=self.table_name,
                Key={'apiKeyId': {'S': api_key_id}},
                UpdateExpression='ADD credits :deduct',
                ExpressionAttributeValues={
                    ':deduct': {'N': str(-credits_to_deduct)}
                },
                ReturnValues='UPDATED_NEW'
            )
            
            new_credits = int(response['Attributes']['credits']['N'])
            
            if new_credits < 0:
                # Rollback the deduction if insufficient credits
                dynamodb.update_item(
                    TableName=self.table_name,
                    Key={'apiKeyId': {'S': api_key_id}},
                    UpdateExpression='ADD credits :rollback',
                    ExpressionAttributeValues={
                        ':rollback': {'N': str(credits_to_deduct)}
                    }
                )
                raise HTTPException(status_code=402, detail="Insufficient credits")
            
            return new_credits
            
        except Exception as e:
            if isinstance(e, HTTPException):
                raise e
            raise HTTPException(status_code=500, detail="Credit deduction error")

# Global instance
auth = APIKeyAuth()

async def get_api_key_from_header(x_api_key: Optional[str] = Header(None)) -> str:
    """
    Extract API key from X-API-Key header
    """
    if not x_api_key:
        raise HTTPException(status_code=401, detail="API key required")
    return x_api_key

async def get_api_key_from_query(api_key: Optional[str] = None) -> str:
    """
    Extract API key from query parameter
    """
    if not api_key:
        raise HTTPException(status_code=401, detail="API key required")
    return api_key

def require_api_key():
    """
    Dependency that validates API key and returns user info
    """
    async def _validate_key(api_key: str = Depends(get_api_key_from_header)):
        return await auth.validate_api_key(api_key)
    return _validate_key

def require_api_key_query():
    """
    Dependency that validates API key from query parameter
    """
    async def _validate_key(api_key: str = Depends(get_api_key_from_query)):
        return await auth.validate_api_key(api_key)
    return _validate_key

def require_credits(credits_needed: int = 1):
    """
    Dependency that validates API key and deducts credits
    """
    async def _validate_and_deduct(user_info: dict = Depends(require_api_key())):
        # Deduct credits
        remaining_credits = await auth.deduct_credits(
            user_info['api_key_id'], 
            credits_needed
        )
        
        # Add remaining credits to user info
        user_info['remaining_credits'] = remaining_credits
        return user_info
    
    return _validate_and_deduct

async def check_rate_limit(api_key: str) -> bool:
    """
    Production rate limiting using DynamoDB
    Returns True if within limits, False if rate limited
    """
    current_time = int(time.time())
    window_start = current_time - RATE_LIMIT_WINDOW
    
    try:
        # Get current request count for this API key in the time window
        response = dynamodb.query(
            TableName=RATE_LIMIT_TABLE,
            KeyConditionExpression='api_key = :api_key AND request_time > :window_start',
            ExpressionAttributeValues={
                ':api_key': {'S': api_key},
                ':window_start': {'N': str(window_start)}
            },
            Select='COUNT'
        )
        
        current_count = response.get('Count', 0)
        
        # Check if under limit
        if current_count >= MAX_REQUESTS_PER_WINDOW:
            return False
        
        # Add current request to DynamoDB
        dynamodb.put_item(
            TableName=RATE_LIMIT_TABLE,
            Item={
                'api_key': {'S': api_key},
                'request_time': {'N': str(current_time)},
                'ttl': {'N': str(current_time + RATE_LIMIT_WINDOW + 300)}  # TTL for cleanup
            }
        )
        
        return True
        
    except Exception as e:
        # If DynamoDB fails, allow the request (fail open)
        print(f"Rate limit check failed: {e}")
        return True

def require_rate_limit():
    """
    Production dependency that enforces rate limiting with DynamoDB
    """
    async def _check_rate_limit(request: Request, user_info: dict = Depends(require_api_key())):
        api_key = user_info.get('api_key_id', '')
        
        if not await check_rate_limit(api_key):
            raise HTTPException(
                status_code=429, 
                detail=f"Rate limit exceeded. Maximum {MAX_REQUESTS_PER_WINDOW} requests per {RATE_LIMIT_WINDOW} seconds."
            )
        
        return user_info
    
    return _check_rate_limit
