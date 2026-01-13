#!/bin/bash
# Simplified Consumer API Test Script

TOKEN="eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0=.eyJzdWIiOiJ0ZXN0LXVzZXItMTIzIiwiZW1haWwiOiJhZG1pbkBleGFtcGxlLmNvbSIsIm5hbWUiOiJUZXN0IEFkbWluIn0=.signature"
API_URL="http://localhost:3000/api/v1"
TIMESTAMP=$(date +%s)

echo "====== Consumer API Test ======"
echo ""

# Step 1: Create Site
echo "[1] Creating site..."
SITE_JSON=$(curl -s -X POST "$API_URL/sites" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"Test Site $TIMESTAMP\", \"domain\": \"test-$TIMESTAMP.com\"}")

SITE_ID=$(echo "$SITE_JSON" | grep -oP '"_id":"\K[^"]+')
API_KEY=$(echo "$SITE_JSON" | grep -oP '"apiKey":"\K[^"]+')

echo "Site ID: $SITE_ID"
echo "API Key: $API_KEY"
echo ""

if [ -z "$API_KEY" ]; then
  echo "❌ Failed to create site or get API key"
  echo "Response: $SITE_JSON"
  exit 1
fi

# Step 2: Create Content Type
echo "[2] Creating content type..."
CT_JSON=$(curl -s -X POST "$API_URL/content-types" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"Post $TIMESTAMP\", \"slug\": \"post-$TIMESTAMP\", \"fields\": [{\"name\": \"title\", \"type\": \"TEXT\", \"label\": \"Title\", \"required\": true}, {\"name\": \"body\", \"type\": \"RICH_TEXT\", \"label\": \"Body\", \"required\": true}]}")

CT_ID=$(echo "$CT_JSON" | grep -oP '"id":"\K[^"]+' | head -1)
CT_SLUG="post-$TIMESTAMP"

echo "Content Type ID: $CT_ID"
echo "Content Type Slug: $CT_SLUG"
echo ""

if [ -z "$CT_ID" ]; then
  echo "❌ Failed to create content type"
  echo "Response: $CT_JSON"
  exit 1
fi

# Step 3: Create Published Entry
echo "[3] Creating published entry..."
ENTRY_JSON=$(curl -s -X POST "$API_URL/content-types/$CT_ID/entries" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"data": {"title": "Hello World", "body": "<p>This is a test post</p>"}, "status": "PUBLISHED"}')

ENTRY_ID=$(echo "$ENTRY_JSON" | grep -oP '"id":"\K[^"]+' | head -1)

echo "Entry ID: $ENTRY_ID"
echo ""

if [ -z "$ENTRY_ID" ]; then
  echo "❌ Failed to create entry"
  echo "Response: $ENTRY_JSON"
  exit 1
fi

# Step 4: Test Public API - List Content Types
echo "[4] Public API - List content types..."
curl -s "$API_URL/public/content-types" \
  -H "X-API-Key: $API_KEY" | head -c 200
echo ""
echo ""

# Step 5: Test Public API - Get Content Type by Slug
echo "[5] Public API - Get content type by slug..."
curl -s "$API_URL/public/content-types/$CT_SLUG" \
  -H "X-API-Key: $API_KEY" | head -c 200
echo ""
echo ""

# Step 6: Test Public API - List Published Entries
echo "[6] Public API - List published entries..."
ENTRIES_JSON=$(curl -s "$API_URL/public/content/$CT_SLUG" \
  -H "X-API-Key: $API_KEY")
echo "$ENTRIES_JSON" | head -c 300
echo ""
echo ""

# Step 7: Test Public API - Get Single Entry
echo "[7] Public API - Get single entry..."
curl -s "$API_URL/public/content/$CT_SLUG/$ENTRY_ID" \
  -H "X-API-Key: $API_KEY" | head -c 200
echo ""
echo ""

# Step 8: Test Public API - Search
echo "[8] Public API - Search..."
curl -s "$API_URL/public/search?q=test" \
  -H "X-API-Key: $API_KEY" | head -c 200
echo ""
echo ""

# Step 9: Test Invalid API Key
echo "[9] Testing invalid API key..."
curl -s "$API_URL/public/content-types" \
  -H "X-API-Key: invalid123"
echo ""
echo ""

# Step 10: Test Missing API Key
echo "[10] Testing missing API key..."
curl -s "$API_URL/public/content-types"
echo ""
echo ""

# Step 11: Verify Request Count
echo "[11] Verifying request count..."
curl -s "$API_URL/sites/$SITE_ID" \
  -H "Authorization: Bearer $TOKEN" | grep -oP '"requestCount":\K[0-9]+'
echo ""

echo "====== Test Complete ======"
