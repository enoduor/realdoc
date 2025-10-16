"""
Enhanced logging utility - enables better error visibility in CloudWatch
"""
import os
import sys
import traceback
import datetime

IS_PRODUCTION = os.getenv('NODE_ENV') == 'production' or os.getenv('ENVIRONMENT') == 'production'

class Logger:
    @staticmethod
    def log(*args, **kwargs):
        """Log only in development"""
        if not IS_PRODUCTION:
            print(*args, **kwargs, file=sys.stdout)
    
    @staticmethod
    def error(*args, **kwargs):
        """Always log errors (even in production) - Enhanced for CloudWatch"""
        print(f"[ERROR] {datetime.now().isoformat()}", *args, **kwargs, file=sys.stderr)
        # Also print to stdout for CloudWatch visibility
        print(f"[ERROR] {datetime.now().isoformat()}", *args, **kwargs, file=sys.stdout)
    
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
    
    @staticmethod
    def exception(*args, **kwargs):
        """Always log exceptions with full traceback (even in production)"""
        import datetime
        timestamp = datetime.datetime.now().isoformat()
        print(f"[EXCEPTION] {timestamp}", *args, **kwargs, file=sys.stderr)
        print(f"[EXCEPTION] {timestamp}", *args, **kwargs, file=sys.stdout)
        traceback.print_exc(file=sys.stderr)
        traceback.print_exc(file=sys.stdout)

# Create singleton instance
logger = Logger()

