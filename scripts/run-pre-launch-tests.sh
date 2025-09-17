#!/bin/bash

# Repostly Comprehensive Pre-Launch Test Suite
# This script runs all pre-launch tests including basic functionality, health checks, and comprehensive testing

set -e

echo "🚀 Repostly Comprehensive Pre-Launch Test Suite"
echo "=============================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
INDIVIDUAL_TESTS_PASSED=0
INDIVIDUAL_TESTS_FAILED=0

# Function to run a test suite
run_test_suite() {
    local suite_name="$1"
    local test_command="$2"
    
    echo -e "${BLUE}🧪 Running $suite_name...${NC}"
    echo "----------------------------------------"
    
    if eval "$test_command"; then
        echo -e "${GREEN}✅ $suite_name: PASSED${NC}"
        ((PASSED_TESTS++))
    else
        echo -e "${RED}❌ $suite_name: FAILED${NC}"
        ((FAILED_TESTS++))
    fi
    
    ((TOTAL_TESTS++))
    echo ""
}

# Function to run an individual test
run_individual_test() {
    local test_name="$1"
    local test_command="$2"
    
    echo -n "  Testing $test_name... "
    
    if eval "$test_command" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ PASS${NC}"
        ((INDIVIDUAL_TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}❌ FAIL${NC}"
        ((INDIVIDUAL_TESTS_FAILED++))
        return 1
    fi
}

# Function to check HTTP status
check_http_status() {
    local url="$1"
    local expected_status="$2"
    local service_name="$3"
    
    echo -n "  Testing $service_name... "
    
    local actual_status=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
    
    if [ "$actual_status" = "$expected_status" ]; then
        echo -e "${GREEN}✅ PASS${NC}"
        ((INDIVIDUAL_TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}❌ FAIL (Expected: $expected_status, Got: $actual_status)${NC}"
        ((INDIVIDUAL_TESTS_FAILED++))
        return 1
    fi
}

# Function to check if service is running
check_service() {
    local service_name="$1"
    local url="$2"
    local expected_status="$3"
    
    echo -n "  Checking $service_name... "
    
    local actual_status=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
    
    if [ "$actual_status" = "$expected_status" ]; then
        echo -e "${GREEN}✅ PASS${NC}"
        return 0
    else
        echo -e "${RED}❌ FAIL (Expected: $expected_status, Got: $actual_status)${NC}"
        return 1
    fi
}

# Test 1: Production Health Check
run_test_suite "Production Health Check" "
    echo '  Checking production services...'
    check_http_status 'https://reelpostly.com/ai/ping' '200' 'AI Service' && \
    check_http_status 'https://reelpostly.com/api/health' '200' 'API Service' && \
    check_http_status 'https://reelpostly.com/' '200' 'Frontend'
"

# Test 2: Local Development Health Check
run_test_suite "Local Development Health Check" "
    echo '  Checking local development services...'
    check_http_status 'http://localhost:5000/ping' '200' 'Local AI Service' && \
    check_http_status 'http://localhost:4001/api/health' '200' 'Local API Service' && \
    check_http_status 'http://localhost:3000' '200' 'Local Frontend'
"

# Test 3: Build Process Tests
run_test_suite "Build Process Tests" "
    echo '  Testing build processes...'
    run_individual_test 'Frontend Build' 'cd frontend && npm run build' && \
    run_individual_test 'Backend Dependencies' 'cd back/backend-node && npm install --silent' && \
    run_individual_test 'Python Dependencies' 'cd back/backend_python && pip install -r requirements.txt --quiet'
"

# Test 4: Environment Configuration
run_test_suite "Environment Configuration Tests" "
    echo '  Checking environment configuration...'
    run_individual_test 'Backend Node Env File' '[ -f \"back/backend-node/.env\" ]' && \
    run_individual_test 'Backend Python Env File' '[ -f \"back/backend_python/.env\" ]' && \
    run_individual_test 'Frontend Env File' '[ -f \"frontend/.env\" ]' && \
    echo '  All environment files present'
"

# Test 5: Database Connection
run_test_suite "Database Connection Tests" "
    echo '  Testing database connections...'
    run_individual_test 'MongoDB Connection' 'node -e \"
    const mongoose = require(\"mongoose\");
    mongoose.connect(process.env.MONGODB_URI || \"mongodb://localhost:27017/repostly\")
      .then(() => { console.log(\"Connected\"); process.exit(0); })
      .catch(() => { process.exit(1); });
    \"'
"

# Test 6: Docker Build Test
run_test_suite "Docker Build Tests" "
    echo '  Testing Docker build process...'
    run_individual_test 'Docker Build' 'docker build --no-cache -t repostly-test .'
"

# Test 7: Security Checks
run_test_suite "Security Checks" "
    echo '  Running security checks...'
    # Check for hardcoded secrets
    if grep -r 'password.*=' back/backend-node/ --exclude-dir=node_modules | grep -v 'process.env' | grep -v '//' | grep -v '#'; then
        echo '  ⚠️  Potential hardcoded passwords found'
        return 1
    fi
    
    # Check for exposed API keys
    if grep -r 'sk_live_' . --exclude-dir=node_modules --exclude-dir=.git; then
        echo '  ⚠️  Potential live API keys found'
        return 1
    fi
    
    echo '  No obvious security issues found'
"

# Test 8: Performance Tests
run_test_suite "Performance Tests" "
    echo '  Running performance tests...'
    
    # Test page load times
    local start_time=$(date +%s%N)
    curl -s 'https://reelpostly.com/' > /dev/null
    local end_time=$(date +%s%N)
    local load_time=$(( (end_time - start_time) / 1000000 ))
    
    echo \"  Frontend load time: ${load_time}ms\"
    
    if [ $load_time -lt 3000 ]; then
        echo '  ✅ Load time is acceptable'
    else
        echo '  ⚠️  Load time is slow'
        return 1
    fi
"

# Test 9: Mobile Responsiveness
run_test_suite "Mobile Responsiveness Tests" "
    echo '  Testing mobile responsiveness...'
    
    # Check if responsive meta tag is present
    if curl -s 'https://reelpostly.com/' | grep -q 'viewport'; then
        echo '  ✅ Responsive meta tag found'
    else
        echo '  ❌ Responsive meta tag missing'
        return 1
    fi
"

# Generate Test Report
echo "📊 Comprehensive Test Results Summary"
echo "===================================="
echo -e "Test Suites:"
echo -e "  Total: $TOTAL_TESTS"
echo -e "  Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "  Failed: ${RED}$FAILED_TESTS${NC}"
echo ""
echo -e "Individual Tests:"
echo -e "  Total: $((INDIVIDUAL_TESTS_PASSED + INDIVIDUAL_TESTS_FAILED))"
echo -e "  Passed: ${GREEN}$INDIVIDUAL_TESTS_PASSED${NC}"
echo -e "  Failed: ${RED}$INDIVIDUAL_TESTS_FAILED${NC}"
echo ""

# Calculate success rates
if [ $TOTAL_TESTS -gt 0 ]; then
    SUITE_SUCCESS_RATE=$(( (PASSED_TESTS * 100) / TOTAL_TESTS ))
    echo -e "Test Suite Success Rate: ${SUITE_SUCCESS_RATE}%"
else
    SUITE_SUCCESS_RATE=0
    echo -e "Test Suite Success Rate: 0%"
fi

TOTAL_INDIVIDUAL_TESTS=$((INDIVIDUAL_TESTS_PASSED + INDIVIDUAL_TESTS_FAILED))
if [ $TOTAL_INDIVIDUAL_TESTS -gt 0 ]; then
    INDIVIDUAL_SUCCESS_RATE=$(( (INDIVIDUAL_TESTS_PASSED * 100) / TOTAL_INDIVIDUAL_TESTS ))
    echo -e "Individual Test Success Rate: ${INDIVIDUAL_SUCCESS_RATE}%"
else
    INDIVIDUAL_SUCCESS_RATE=0
    echo -e "Individual Test Success Rate: 0%"
fi

echo ""

# Launch readiness assessment
if [ $FAILED_TESTS -eq 0 ] && [ $INDIVIDUAL_TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL TESTS PASSED!${NC}"
    echo -e "${GREEN}✅ System is ready for launch!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Run manual user testing using the testing guides"
    echo "2. Perform platform-specific testing"
    echo "3. Conduct load testing"
    echo "4. Final security review"
    echo "5. Launch! 🚀"
    exit 0
elif [ $SUITE_SUCCESS_RATE -ge 80 ] && [ $INDIVIDUAL_SUCCESS_RATE -ge 80 ]; then
    echo -e "${YELLOW}⚠️  MOSTLY READY${NC}"
    echo -e "${YELLOW}✅ System is mostly ready for launch${NC}"
    echo ""
    echo "Issues to address:"
    echo "1. Fix the failed tests above"
    echo "2. Run additional testing"
    echo "3. Consider launch with known issues"
    exit 1
else
    echo -e "${RED}❌ NOT READY FOR LAUNCH${NC}"
    echo -e "${RED}❌ System needs significant work before launch${NC}"
    echo ""
    echo "Critical issues to fix:"
    echo "1. Fix all failed tests above"
    echo "2. Run comprehensive testing"
    echo "3. Address performance issues"
    echo "4. Fix security vulnerabilities"
    exit 1
fi
