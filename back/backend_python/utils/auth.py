import os
import boto3
from fastapi import HTTPException, Depends, Header
from typing import Optional
import asyncio
from functools import wraps

# Initialize DynamoDB client
dynamodb = boto3.client('dynamodb', region_name='us-west-2')
TABLE_NAME = 'reelpostly-tenants'

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
