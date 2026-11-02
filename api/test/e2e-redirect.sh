#!/bin/bash

WORKER_URL=${1:-"http://localhost:8787"}
echo "Testing redirect worker at: $WORKER_URL"

# Test 1: Valid redirect with existing test data
echo -n "Test 1 - Valid redirect (test123): "
RESPONSE=$(curl -s -I "$WORKER_URL/r/test123")
STATUS=$(echo "$RESPONSE" | grep "HTTP" | awk '{print $2}')
if [ "$STATUS" = "302" ]; then
    LOCATION=$(echo "$RESPONSE" | grep -i "location:" | cut -d' ' -f2- | tr -d '\r')
    echo "✅ PASS (redirects to: $LOCATION)"
else
    echo "❌ FAIL (Status: $STATUS)"
fi

# Test 2: Invalid slug (should redirect to 404 page)
echo -n "Test 2 - Invalid slug: "
RESPONSE=$(curl -s -I "$WORKER_URL/r/nonexistent")
STATUS=$(echo "$RESPONSE" | grep "HTTP" | awk '{print $2}')
if [ "$STATUS" = "302" ]; then
    LOCATION=$(echo "$RESPONSE" | grep -i "location:" | cut -d' ' -f2- | tr -d '\r')
    echo "✅ PASS (redirects to 404 page: $LOCATION)"
elif [ "$STATUS" = "404" ]; then
    echo "✅ PASS (direct 404)"
else
    echo "❌ FAIL (Status: $STATUS)"
fi

# Test 3: Invalid route structure
echo -n "Test 3 - Invalid route: "
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$WORKER_URL/invalid")
if [ "$STATUS" = "404" ]; then
    echo "✅ PASS"
else
    echo "❌ FAIL (Status: $STATUS)"
fi

# Test 4: Empty slug
echo -n "Test 4 - Empty slug: "
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$WORKER_URL/r/")
if [ "$STATUS" = "404" ]; then
    echo "✅ PASS"
else
    echo "❌ FAIL (Status: $STATUS)"
fi

# Test 5: Health check still works
echo -n "Test 5 - Health check: "
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$WORKER_URL/health")
if [ "$STATUS" = "200" ]; then
    echo "✅ PASS"
else
    echo "❌ FAIL (Status: $STATUS)"
fi

# Test 6: Response time check
echo -n "Test 6 - Response time: "
TIME=$(curl -s -o /dev/null -w "%{time_total}" "$WORKER_URL/r/test123")
if (( $(echo "$TIME < 1.0" | bc -l) )); then
    echo "✅ PASS (${TIME}s)"
else
    echo "⚠️  SLOW (${TIME}s)"
fi

echo -e "\nAll tests completed!"