# Deployment Scripts Reference

## Overview

This document explains the deployment scripts and their usage for the Repostly application.

## Script Redundancy Analysis

### Why `deploy-production.sh` was removed

Now that both `deploy-repostly.sh` and `deploy-single-container.sh` have the production URLs built-in, `deploy-production.sh` was **redundant**.

### Script Comparison

#### `deploy-production.sh` (removed):
- Sets production URLs
- Calls `deploy-repostly.sh all`
- Provides production-specific messaging

#### `deploy-repostly.sh` (now updated):
- ✅ Has production URLs built-in
- ✅ Deploys multi-container setup
- ✅ Provides deployment messaging

### Why `deploy-production.sh` was redundant:

1. **URL Configuration**: `deploy-repostly.sh` now has the same URL configuration
2. **Functionality**: `deploy-production.sh` just calls `deploy-repostly.sh all`
3. **No Added Value**: It doesn't provide any unique functionality

## Final Clean Setup

### Local Docker:
- ✅ `docker-start.sh` - Start local container
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
