"""
Conditional logging utility - turns off debug logs in production
"""
import os
import sys

IS_PRODUCTION = os.getenv('NODE_ENV') == 'production' or os.getenv('ENVIRONMENT') == 'production'

class Logger:
    @staticmethod
    def log(*args, **kwargs):
        """Log only in development"""
        if not IS_PRODUCTION:
            print(*args, **kwargs, file=sys.stdout)
    
    @staticmethod
    def error(*args, **kwargs):
        """Always log errors (even in production)"""
        print(*args, **kwargs, file=sys.stderr)
    
    @staticmethod
    def warn(*args, **kwargs):
        """Log warnings only in development"""
        if not IS_PRODUCTION:
            print(*args, **kwargs, file=sys.stderr)
    
    @staticmethod
    def info(*args, **kwargs):
        """Log info only in development"""
        if not IS_PRODUCTION:
            print(*args, **kwargs, file=sys.stdout)
    
    @staticmethod
    def debug(*args, **kwargs):
        """Log debug only in development"""
        if not IS_PRODUCTION:
            print('[DEBUG]', *args, **kwargs, file=sys.stdout)

# Create singleton instance
logger = Logger()

