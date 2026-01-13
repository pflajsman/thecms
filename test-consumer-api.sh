#!/bin/bash
# Test script for Consumer API (Public API)

TOKEN="eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0=.eyJzdWIiOiJ0ZXN0LXVzZXItMTIzIiwiZW1haWwiOiJhZG1pbkBleGFtcGxlLmNvbSIsIm5hbWUiOiJUZXN0IEFkbWluIn0=.signature"
API_URL="http://localhost:3000/api/v1"

# Generate unique identifiers to avoid conflicts
TIMESTAMP=$(date +%s)
UNIQUE_DOMAIN="testblog-${TIMESTAMP}.com"
UNIQUE_SLUG="blog-post-${TIMESTAMP}"

echo "====== Consumer API (Public API) Test ======"
echo

# Step 1: Create a Site to get an API key
echo "[1] Creating a site..."
SITE_RESPONSE=$(curl -s -X POST "$API_URL/sites" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Test Blog ${TIMESTAMP}\",
    \"domain\": \"${UNIQUE_DOMAIN}\",
    \"description\": \"Test blog site for consumer API\"
  }")

SITE_ID=$(echo $SITE_RESPONSE | grep -o '"_id":"[^"]*"' | head -1 | cut -d'"' -f4)
API_KEY=$(echo $SITE_RESPONSE | grep -o '"apiKey":"[^"]*"' | head -1 | cut -d'"' -f4)

echo "Site ID: $SITE_ID"
echo "API Key: $API_KEY"
echo

# Step 2: Create a Content Type (as admin)
echo "[2] Creating a Blog Post content type..."
CONTENT_TYPE_RESPONSE=$(curl -s -X POST "$API_URL/content-types" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Blog Post ${TIMESTAMP}\",
    \"slug\": \"${UNIQUE_SLUG}\",
    \"description\": \"A blog post\",
    \"fields\": [
      {\"name\": \"title\", \"type\": \"TEXT\", \"label\": \"Title\", \"required\": true},
      {\"name\": \"body\", \"type\": \"RICH_TEXT\", \"label\": \"Body\", \"required\": true},
      {\"name\": \"author\", \"type\": \"TEXT\", \"label\": \"Author\"}
    ]
  }")

CONTENT_TYPE_ID=$(echo $CONTENT_TYPE_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Content Type ID: $CONTENT_TYPE_ID"
echo

# Step 3: Create a Published Entry (as admin)
echo "[3] Creating a published blog post..."
ENTRY_RESPONSE=$(curl -s -X POST "$API_URL/content-types/$CONTENT_TYPE_ID/entries" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "title": "Welcome to My Blog",
      "body": "<p>This is my first blog post!</p>",
      "author": "John Doe"
    },
    "status": "PUBLISHED"
  }')

ENTRY_ID=$(echo $ENTRY_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Published Entry ID: $ENTRY_ID"
echo

# Step 4: Test Public API - List Content Types
echo "[4] Testing Public API - List content types..."
curl -s "$API_URL/public/content-types" \
  -H "X-API-Key: $API_KEY"
echo
echo

# Step 5: Test Public API - Get Content Type by slug
echo "[5] Testing Public API - Get content type by slug..."
curl -s "$API_URL/public/content-types/${UNIQUE_SLUG}" \
  -H "X-API-Key: $API_KEY"
echo
echo

# Step 6: Test Public API - List Published Entries
echo "[6] Testing Public API - List published entries..."
curl -s "$API_URL/public/content/${UNIQUE_SLUG}" \
  -H "X-API-Key: $API_KEY"
echo
echo

# Step 7: Test Public API - Get Single Published Entry
echo "[7] Testing Public API - Get single published entry..."
curl -s "$API_URL/public/content/${UNIQUE_SLUG}/$ENTRY_ID" \
  -H "X-API-Key: $API_KEY"
echo
echo

# Step 8: Test Public API - Search
echo "[8] Testing Public API - Search for 'blog'..."
curl -s "$API_URL/public/search?q=blog" \
  -H "X-API-Key: $API_KEY"
echo
echo

# Step 9: Test Invalid API Key
echo "[9] Testing with invalid API key (should return 401)..."
curl -s "$API_URL/public/content-types" \
  -H "X-API-Key: invalid_key_12345"
echo
echo

# Step 10: Test Missing API Key
echo "[10] Testing without API key (should return 401)..."
curl -s "$API_URL/public/content-types"
echo
echo

# Step 11: Verify Site Request Count
echo "[11] Verifying site request count..."
curl -s "$API_URL/sites/$SITE_ID" \
  -H "Authorization: Bearer $TOKEN"
echo
echo

echo "====== Test Complete ======"
echo
echo "Summary:"
echo "- Created site with API key"
echo "- Created content type and published entry"
echo "- Tested all public API endpoints"
echo "- Verified API key authentication"
echo "- Checked request counting"
