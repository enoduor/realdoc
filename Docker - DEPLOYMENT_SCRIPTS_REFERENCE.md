# Deployment Scripts Reference

## Overview

This document explains the deployment scripts and their usage for the Repostly application.


### Local Docker:
- ✅ `docker-start.sh` - Start local container and compiles the entire project locally before starting the container
- ✅ `docker-test.sh` - Test local container
- ✅ `docker-compose.yml` - Local development
- ✅ `Dockerfile` - Single container build

### Production Deployment:
- ✅ `scripts/deploy-repostly.sh` - **Multi-container deployment with production URLs**
- ✅ `scripts/deploy-single-container.sh` - **Single container deployment with production URLs**

### Task Definition Files (Multi-container only):
- ✅ `scripts/ecs/td-repostly-api.json`
- ✅ `scripts/ecs/td-repostly-ai.json`
- ✅ `scripts/ecs/td-repostly-frontend.json`

## Usage

### Local Development:
```bash
./docker-start.sh
./docker-test.sh
```

### Production Deployment:
```bash
# Multi-container (existing approach)
./scripts/deploy-repostly.sh all

# Single container (new approach)
./scripts/deploy-single-container.sh
```

## Benefits of Clean Setup

- **Simplified**: Only essential scripts remain
- **Consistent**: Both deployment scripts have production URLs configured
- **Maintainable**: Less duplication and redundancy
- **Clear**: Easy to understand which script to use for what purpose

**Result: Much cleaner setup with just the two essential deployment scripts, both with production URLs configured.**
