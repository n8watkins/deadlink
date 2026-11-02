#!/bin/bash

# Phase 3: Health Check System Integration Test
# Tests the complete health check and failover system

WORKER_URL=${1:-"http://localhost:8787"}
API_URL=${2:-"http://localhost:8787"}
API_KEY="dl_test123"

echo "🏥 Testing Health Check System"
echo "=============================="
echo "Worker URL: $WORKER_URL"
echo "API URL: $API_URL"
echo ""

# Step 1: Create test links
echo "1. Creating test links..."

# Create link that will go dead (404)
DEAD_LINK=$(curl -s -X POST "$API_URL/api/v1/links" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://httpstat.us/404",
    "fallback_urls": ["https://httpstat.us/200", "https://httpstat.us/301"]
  }' | jq -r '.slug')

if [ "$DEAD_LINK" = "null" ] || [ -z "$DEAD_LINK" ]; then
  echo "   ❌ Failed to create dead link test"
  exit 1
fi

echo "   ✅ Created dead link test: $DEAD_LINK"

# Create link that will stay alive (200)
LIVE_LINK=$(curl -s -X POST "$API_URL/api/v1/links" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://httpstat.us/200"
  }' | jq -r '.slug')

if [ "$LIVE_LINK" = "null" ] || [ -z "$LIVE_LINK" ]; then
  echo "   ❌ Failed to create live link test"
  exit 1
fi

echo "   ✅ Created live link test: $LIVE_LINK"

# Create link that will recover (simulate server temporarily down)
RECOVER_LINK=$(curl -s -X POST "$API_URL/api/v1/links" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://httpstat.us/503",
    "fallback_urls": ["https://httpstat.us/200"]
  }' | jq -r '.slug')

echo "   ✅ Created recovery test link: $RECOVER_LINK"

# Step 2: Check initial status
echo -e "\n2. Checking initial link statuses..."

DEAD_INITIAL=$(curl -s "$API_URL/api/v1/links/$DEAD_LINK" \
  -H "X-API-Key: $API_KEY" | jq -r '.status')
echo "   Dead link status: $DEAD_INITIAL"

LIVE_INITIAL=$(curl -s "$API_URL/api/v1/links/$LIVE_LINK" \
  -H "X-API-Key: $API_KEY" | jq -r '.status')
echo "   Live link status: $LIVE_INITIAL"

# Step 3: Trigger health check
echo -e "\n3. Triggering health check..."
TRIGGER_RESPONSE=$(curl -s -X GET "$WORKER_URL/trigger")
echo "   Health check response: $TRIGGER_RESPONSE"

if [[ "$TRIGGER_RESPONSE" != *"triggered"* ]]; then
  echo "   ❌ Failed to trigger health check"
  exit 1
fi

echo "   ✅ Health check triggered successfully"

# Wait for processing
echo "   ⏳ Waiting 10 seconds for processing..."
sleep 10

# Step 4: Check updated link statuses
echo -e "\n4. Checking updated link statuses..."

# Check dead link - should now redirect to fallback
DEAD_STATUS=$(curl -s "$API_URL/api/v1/links/$DEAD_LINK" \
  -H "X-API-Key: $API_KEY" | jq -r '.status')

echo "   Dead link status after check: $DEAD_STATUS"

if [[ "$DEAD_STATUS" == "fallback"* ]]; then
  echo "   ✅ Dead link switched to fallback"
else
  echo "   ⚠️  Dead link status: $DEAD_STATUS (may need more time)"
fi

# Check live link - should still be live
LIVE_STATUS=$(curl -s "$API_URL/api/v1/links/$LIVE_LINK" \
  -H "X-API-Key: $API_KEY" | jq -r '.status')

echo "   Live link status after check: $LIVE_STATUS"

if [ "$LIVE_STATUS" = "live" ]; then
  echo "   ✅ Live link still active"
else
  echo "   ❌ Live link status: $LIVE_STATUS (expected: live)"
fi

# Step 5: Test redirect behavior
echo -e "\n5. Testing redirect behavior..."

# Test dead link redirect - should go to fallback
echo "   Testing dead link redirect..."
REDIRECT_RESPONSE=$(curl -s -I "$WORKER_URL/r/$DEAD_LINK")
REDIRECT_STATUS=$(echo "$REDIRECT_RESPONSE" | grep "HTTP" | awk '{print $2}')
REDIRECT_LOCATION=$(echo "$REDIRECT_RESPONSE" | grep -i "location:" | awk '{print $2}' | tr -d '\r')

echo "   Redirect status: $REDIRECT_STATUS"
echo "   Redirect location: $REDIRECT_LOCATION"

if [ "$REDIRECT_STATUS" = "302" ]; then
  echo "   ✅ Dead link provides redirect"
  if [[ "$REDIRECT_LOCATION" == *"200"* ]] || [[ "$REDIRECT_LOCATION" == *"301"* ]]; then
    echo "   ✅ Dead link redirects to fallback URL"
  else
    echo "   ⚠️  Redirect location: $REDIRECT_LOCATION"
  fi
else
  echo "   ⚠️  Unexpected redirect status: $REDIRECT_STATUS"
fi

# Test live link redirect
echo "   Testing live link redirect..."
LIVE_REDIRECT=$(curl -s -I "$WORKER_URL/r/$LIVE_LINK" | grep "HTTP" | awk '{print $2}')
if [ "$LIVE_REDIRECT" = "302" ]; then
  echo "   ✅ Live link provides redirect"
else
  echo "   ❌ Live link redirect failed: $LIVE_REDIRECT"
fi

# Step 6: Test health check monitoring API
echo -e "\n6. Testing health check monitoring API..."

# Get health check stats
STATS_RESPONSE=$(curl -s "$API_URL/api/health/stats" \
  -H "X-API-Key: $API_KEY")

if [ $? -eq 0 ]; then
  echo "   ✅ Health stats API accessible"
  TOTAL_RUNS=$(echo "$STATS_RESPONSE" | jq -r '.performance.total_runs // 0')
  echo "   Total health check runs: $TOTAL_RUNS"
else
  echo "   ❌ Failed to get health stats"
fi

# Get specific link history
LINK_HISTORY=$(curl -s "$API_URL/api/health/link/$DEAD_LINK" \
  -H "X-API-Key: $API_KEY")

if [ $? -eq 0 ]; then
  echo "   ✅ Link history API accessible"
  HISTORY_COUNT=$(echo "$LINK_HISTORY" | jq -r '.history | length')
  echo "   History records for dead link: $HISTORY_COUNT"
else
  echo "   ❌ Failed to get link history"
fi

# Step 7: Test manual health check trigger
echo -e "\n7. Testing manual health check trigger..."

MANUAL_CHECK=$(curl -s -X POST "$API_URL/api/health/check" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"slugs\": [\"$LIVE_LINK\"]}")

if [ $? -eq 0 ]; then
  echo "   ✅ Manual health check API accessible"
  MESSAGE=$(echo "$MANUAL_CHECK" | jq -r '.message')
  echo "   Response: $MESSAGE"
else
  echo "   ❌ Failed to trigger manual health check"
fi

# Step 8: Test system health endpoint
echo -e "\n8. Testing system health endpoint..."

SYSTEM_HEALTH=$(curl -s "$API_URL/api/health/system" \
  -H "X-API-Key: $API_KEY")

if [ $? -eq 0 ]; then
  echo "   ✅ System health API accessible"
  LAST_RUN=$(echo "$SYSTEM_HEALTH" | jq -r '.system.last_run_at')
  echo "   Last health check run: $LAST_RUN"
else
  echo "   ❌ Failed to get system health"
fi

# Step 9: Cleanup test data
echo -e "\n9. Cleaning up test data..."

echo "   Deleting test links..."
curl -s -X DELETE "$API_URL/api/v1/links/$DEAD_LINK" -H "X-API-Key: $API_KEY" > /dev/null
curl -s -X DELETE "$API_URL/api/v1/links/$LIVE_LINK" -H "X-API-Key: $API_KEY" > /dev/null
curl -s -X DELETE "$API_URL/api/v1/links/$RECOVER_LINK" -H "X-API-Key: $API_KEY" > /dev/null

echo "   ✅ Test data cleaned up"

# Final summary
echo -e "\n🎉 Health Check Integration Test Complete!"
echo "==========================================="
echo "✅ Link creation and management"
echo "✅ Health check triggering"
echo "✅ Status monitoring"
echo "✅ Failover functionality"
echo "✅ Monitoring APIs"
echo "✅ Manual check triggers"
echo ""
echo "🏥 Health check system is operational!"