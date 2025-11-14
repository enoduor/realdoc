#!/bin/bash

# RealDoc Deployment Wrapper
# Calls the actual deployment script in scripts/

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Pass all arguments to the actual deploy script
exec "$SCRIPT_DIR/scripts/deploy-single-container.sh" "$@"

