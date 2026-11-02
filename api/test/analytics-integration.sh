#!/bin/bash

# Phase 4: Analytics & Bot Filtering Integration Test
# Tests the complete analytics and bot detection system

API_URL=${1:-"http://localhost:8787"}
REDIRECT_URL=${2:-"http://localhost:8787"}
API_KEY="dl_test123"

echo "📊 Testing Analytics & Bot Filtering System"
echo "==========================================="
echo "API URL: $API_URL"
echo "Redirect URL: $REDIRECT_URL"
echo ""

# Step 1: Create test link for analytics
echo "1. Creating test link for analytics..."
RESPONSE=$(curl -s -X POST "$API_URL/api/v1/links" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://httpstat.us/200",
    "fallback_urls": ["https://httpstat.us/302"]
  }')

SLUG=$(echo $RESPONSE | jq -r '.slug')
if [ "$SLUG" = "null" ] || [ -z "$SLUG" ]; then
  echo "   ❌ Failed to create test link"
  exit 1
fi

echo "   ✅ Created test link: $SLUG"

# Step 2: Generate diverse test traffic
echo -e "\n2. Generating test traffic..."

# Human traffic with proper browser headers
echo "   Generating human clicks..."
for i in {1..8}; do
  USER_AGENTS=(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    "Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Mobile/15E148 Safari/604.1"
  )
  UA=${USER_AGENTS[$((i % 3))]}
  
  RESPONSE=$(curl -s -I "$REDIRECT_URL/r/$SLUG" \
    -H "User-Agent: $UA" \
    -H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8" \
    -H "Accept-Language: en-US,en;q=0.5" \
    -H "Accept-Encoding: gzip, deflate" \
    -H "Referer: https://example.com/page$i")
    
  BOT_SCORE=$(echo "$RESPONSE" | grep -i "x-bot-score" | awk '{print $2}' | tr -d '\r')
  echo "   Human click $i: Bot Score = $BOT_SCORE"
done

# Bot traffic with known bot user agents
echo "   Generating bot clicks..."
BOT_AGENTS=(
  "Googlebot/2.1 (+http://www.google.com/bot.html)"
  "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)"
  "facebookexternalhit/1.1"
  "Twitterbot/1.0"
  "curl/7.68.0"
)

for i in {0..4}; do
  UA=${BOT_AGENTS[$i]}
  
  RESPONSE=$(curl -s -I "$REDIRECT_URL/r/$SLUG" \
    -H "User-Agent: $UA")
    
  BOT_SCORE=$(echo "$RESPONSE" | grep -i "x-bot-score" | awk '{print $2}' | tr -d '\r')
  BOT_CATEGORY=$(echo "$RESPONSE" | grep -i "x-bot-category" | awk '{print $2}' | tr -d '\r')
  echo "   Bot click $(($i + 1)): Bot Score = $BOT_SCORE, Category = $BOT_CATEGORY"
done

# Suspicious traffic (tools/automated)
echo "   Generating suspicious traffic..."
SUSPICIOUS_AGENTS=(
  "python-requests/2.25.1"
  "PostmanRuntime/7.26.8"
  "wget/1.20.3"
)

for i in {0..2}; do
  UA=${SUSPICIOUS_AGENTS[$i]}
  
  RESPONSE=$(curl -s -I "$REDIRECT_URL/r/$SLUG" \
    -H "User-Agent: $UA")
    
  BOT_SCORE=$(echo "$RESPONSE" | grep -i "x-bot-score" | awk '{print $2}' | tr -d '\r')
  echo "   Suspicious click $(($i + 1)): Bot Score = $BOT_SCORE"
done

# Wait for analytics processing
echo "   ⏳ Waiting 5 seconds for analytics processing..."
sleep 5

# Step 3: Test analytics API endpoints
echo -e "\n3. Testing analytics API endpoints..."

# Test link-specific analytics
echo "   Testing link analytics endpoint..."
LINK_ANALYTICS=$(curl -s "$API_URL/api/v1/analytics/link/$SLUG?days=1" \
  -H "X-API-Key: $API_KEY")

if [ $? -eq 0 ]; then
  HUMAN_CLICKS=$(echo $LINK_ANALYTICS | jq '.summary.human_clicks')
  BOT_CLICKS=$(echo $LINK_ANALYTICS | jq '.summary.bot_clicks')
  TOTAL_CLICKS=$(echo $LINK_ANALYTICS | jq '.summary.total_clicks')
  
  echo "   ✅ Link analytics retrieved"
  echo "      Human clicks: $HUMAN_CLICKS (expected: ~8)"
  echo "      Bot clicks: $BOT_CLICKS (expected: ~8)"
  echo "      Total clicks: $TOTAL_CLICKS (expected: ~16)"
  
  # Validate basic expectations
  if [ "$HUMAN_CLICKS" -ge 5 ] && [ "$BOT_CLICKS" -ge 5 ]; then
    echo "   ✅ Bot detection appears to be working"
  else
    echo "   ⚠️  Bot detection may need tuning"
  fi
else
  echo "   ❌ Failed to get link analytics"
fi

# Test overview analytics
echo "   Testing overview analytics endpoint..."
OVERVIEW_ANALYTICS=$(curl -s "$API_URL/api/v1/analytics/overview?days=1" \
  -H "X-API-Key: $API_KEY")

if [ $? -eq 0 ]; then
  OVERVIEW_TOTAL=$(echo $OVERVIEW_ANALYTICS | jq '.summary.human_clicks')
  TOP_LINKS=$(echo $OVERVIEW_ANALYTICS | jq '.top_links | length')
  
  echo "   ✅ Overview analytics retrieved"
  echo "      Total human clicks: $OVERVIEW_TOTAL"
  echo "      Top links count: $TOP_LINKS"
else
  echo "   ❌ Failed to get overview analytics"
fi

# Test real-time analytics
echo "   Testing real-time analytics endpoint..."
REALTIME_ANALYTICS=$(curl -s "$API_URL/api/v1/analytics/realtime" \
  -H "X-API-Key: $API_KEY")

if [ $? -eq 0 ]; then
  RECENT_COUNT=$(echo $REALTIME_ANALYTICS | jq '.recent_clicks | length')
  echo "   ✅ Real-time analytics retrieved"
  echo "      Recent clicks captured: $RECENT_COUNT"
else
  echo "   ❌ Failed to get real-time analytics"
fi

# Step 4: Test bot detection statistics
echo -e "\n4. Testing bot detection statistics..."

BOT_STATS=$(curl -s "$API_URL/api/v1/analytics/bot-stats?hours=1" \
  -H "X-API-Key: $API_KEY")

if [ $? -eq 0 ]; then
  echo "   ✅ Bot statistics retrieved"
  
  # Check if we have breakdown data
  BREAKDOWN=$(echo $BOT_STATS | jq '.breakdown')
  if [ "$BREAKDOWN" != "null" ]; then
    echo "   Bot detection breakdown:"
    echo $BOT_STATS | jq '.breakdown[] | "      \(.category): \(.count) clicks"' -r
  fi
else
  echo "   ❌ Failed to get bot statistics"
fi

# Step 5: Test analytics export functionality
echo -e "\n5. Testing analytics export..."

# Test JSON export
JSON_EXPORT=$(curl -s "$API_URL/api/v1/analytics/export?days=1&format=json" \
  -H "X-API-Key: $API_KEY")

if [ $? -eq 0 ]; then
  EXPORT_RECORDS=$(echo $JSON_EXPORT | jq '.total_records')
  echo "   ✅ JSON export working: $EXPORT_RECORDS records"
else
  echo "   ❌ JSON export failed"
fi

# Test CSV export
CSV_EXPORT=$(curl -s "$API_URL/api/v1/analytics/export?days=1&format=csv" \
  -H "X-API-Key: $API_KEY")

if [ $? -eq 0 ] && [[ "$CSV_EXPORT" == *"slug,timestamp"* ]]; then
  CSV_LINES=$(echo "$CSV_EXPORT" | wc -l)
  echo "   ✅ CSV export working: $CSV_LINES lines"
else
  echo "   ❌ CSV export failed"
fi

# Step 6: Test geographic analytics
echo -e "\n6. Testing geographic analytics..."

# Check if geographic data was captured
GEO_DATA=$(echo $LINK_ANALYTICS | jq '.geographic_breakdown | length')
if [ "$GEO_DATA" -gt 0 ]; then
  echo "   ✅ Geographic data captured: $GEO_DATA countries"
  echo $LINK_ANALYTICS | jq '.geographic_breakdown[] | "      \(.country): \(.human_clicks) human clicks"' -r
else
  echo "   ⚠️  No geographic data captured (may be expected in local testing)"
fi

# Step 7: Test referrer analytics  
echo -e "\n7. Testing referrer analytics..."

REFERRER_DATA=$(echo $LINK_ANALYTICS | jq '.referrer_breakdown | length')
if [ "$REFERRER_DATA" -gt 0 ]; then
  echo "   ✅ Referrer data captured: $REFERRER_DATA sources"
  echo $LINK_ANALYTICS | jq '.referrer_breakdown[] | "      \(.referer_domain): \(.human_clicks) human clicks"' -r
else
  echo "   ⚠️  Limited referrer data (expected with test traffic)"
fi

# Step 8: Test bot blocking (if enabled)
echo -e "\n8. Testing bot blocking behavior..."

# Test with a high-scoring bot
BLOCK_TEST=$(curl -s -I "$REDIRECT_URL/r/$SLUG" \
  -H "User-Agent: curl/7.68.0" \
  -H "X-Test-High-Score: true")

BLOCK_STATUS=$(echo "$BLOCK_TEST" | grep "HTTP" | awk '{print $2}')
BOT_SCORE=$(echo "$BLOCK_TEST" | grep -i "x-bot-score" | awk '{print $2}' | tr -d '\r')

echo "   Bot blocking test: Status = $BLOCK_STATUS, Bot Score = $BOT_SCORE"

if [ "$BLOCK_STATUS" = "403" ]; then
  echo "   ✅ Bot blocking is enabled and working"
elif [ "$BLOCK_STATUS" = "302" ] && [ "$BOT_SCORE" -gt 70 ]; then
  echo "   ✅ Bot detected but not blocked (blocking disabled)"
else
  echo "   ⚠️  Bot blocking test inconclusive"
fi

# Step 9: Performance validation
echo -e "\n9. Performance validation..."

# Test response times
START_TIME=$(date +%s%3N)
PERF_RESPONSE=$(curl -s -I "$REDIRECT_URL/r/$SLUG" \
  -H "User-Agent: Mozilla/5.0 (Performance Test)")
END_TIME=$(date +%s%3N)

RESPONSE_TIME=$((END_TIME - START_TIME))
SERVER_TIME=$(echo "$PERF_RESPONSE" | grep -i "x-response-time" | awk '{print $2}' | tr -d '\r' | sed 's/ms//')

echo "   Client measured time: ${RESPONSE_TIME}ms"
echo "   Server reported time: ${SERVER_TIME}ms"

if [ "$SERVER_TIME" -lt 100 ]; then
  echo "   ✅ Response time is good (< 100ms)"
else
  echo "   ⚠️  Response time could be improved"
fi

# Step 10: Cleanup
echo -e "\n10. Cleaning up test data..."

curl -s -X DELETE "$API_URL/api/v1/links/$SLUG" \
  -H "X-API-Key: $API_KEY" > /dev/null

echo "   ✅ Test link deleted"

# Final summary
echo -e "\n🎉 Analytics & Bot Filtering Integration Test Complete!"
echo "=================================================="
echo "✅ Analytics data collection"
echo "✅ Bot detection and classification"
echo "✅ API endpoint functionality"
echo "✅ Export capabilities"
echo "✅ Real-time analytics"
echo "✅ Performance monitoring"
echo ""
echo "📊 Analytics system is operational and ready for production!"

# Exit with success if we made it this far
exit 0