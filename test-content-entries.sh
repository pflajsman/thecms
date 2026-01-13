#!/bin/bash
# Test script for Content Entries API

TOKEN="eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0=.eyJzdWIiOiJ0ZXN0LXVzZXItMTIzIiwiZW1haWwiOiJhZG1pbkBleGFtcGxlLmNvbSIsIm5hbWUiOiJUZXN0IEFkbWluIn0=.signature"
API_URL="http://localhost:3000/api/v1"

echo "====== Content Entries API Test ======"
echo

# Step 1: Create a Content Type
echo "[1] Creating Blog Post content type..."
CONTENT_TYPE_RESPONSE=$(curl -s -X POST "$API_URL/content-types" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Blog Post",
    "slug": "blog-post",
    "description": "A simple blog post",
    "fields": [
      {"name": "title", "type": "TEXT", "label": "Title", "required": true, "validation": {"minLength": 3}},
      {"name": "body", "type": "RICH_TEXT", "label": "Body", "required": true},
      {"name": "author", "type": "TEXT", "label": "Author", "required": false},
      {"name": "publishDate", "type": "DATE", "label": "Publish Date", "required": false},
      {"name": "featured", "type": "BOOLEAN", "label": "Featured", "required": false}
    ]
  }')

CONTENT_TYPE_ID=$(echo $CONTENT_TYPE_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Content Type ID: $CONTENT_TYPE_ID"
echo

# Step 2: Create a Draft Entry
echo "[2] Creating draft entry..."
ENTRY1_RESPONSE=$(curl -s -X POST "$API_URL/content-types/$CONTENT_TYPE_ID/entries" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "title": "My First Blog Post",
      "body": "<p>This is the content of my first blog post.</p>",
      "author": "John Doe",
      "featured": false
    },
    "status": "DRAFT"
  }')

ENTRY1_ID=$(echo $ENTRY1_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Draft Entry ID: $ENTRY1_ID"
echo "Response: $ENTRY1_RESPONSE"
echo

# Step 3: Create a Published Entry
echo "[3] Creating published entry..."
ENTRY2_RESPONSE=$(curl -s -X POST "$API_URL/content-types/$CONTENT_TYPE_ID/entries" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "title": "Published Article",
      "body": "<p>This article is already published.</p>",
      "author": "Jane Smith",
      "publishDate": "2026-01-12",
      "featured": true
    },
    "status": "PUBLISHED"
  }')

ENTRY2_ID=$(echo $ENTRY2_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Published Entry ID: $ENTRY2_ID"
echo

# Step 4: List all entries
echo "[4] Listing all entries for content type..."
curl -s "$API_URL/content-types/$CONTENT_TYPE_ID/entries" \
  -H "Authorization: Bearer $TOKEN"
echo
echo

# Step 5: Get single entry
echo "[5] Getting single entry..."
curl -s "$API_URL/entries/$ENTRY1_ID" \
  -H "Authorization: Bearer $TOKEN"
echo
echo

# Step 6: Update entry
echo "[6] Updating draft entry..."
curl -s -X PUT "$API_URL/entries/$ENTRY1_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "title": "My Updated Blog Post",
      "body": "<p>This content has been updated.</p>",
      "author": "John Doe Jr."
    }
  }'
echo
echo

# Step 7: Publish entry
echo "[7] Publishing draft entry..."
curl -s -X PUT "$API_URL/entries/$ENTRY1_ID/publish" \
  -H "Authorization: Bearer $TOKEN"
echo
echo

# Step 8: List published entries
echo "[8] Listing only published entries..."
curl -s "$API_URL/content-types/$CONTENT_TYPE_ID/entries?status=PUBLISHED" \
  -H "Authorization: Bearer $TOKEN"
echo
echo

# Step 9: Search entries
echo "[9] Searching for 'blog'..."
curl -s "$API_URL/entries/search?q=blog" \
  -H "Authorization: Bearer $TOKEN"
echo
echo

# Step 10: Unpublish entry
echo "[10] Unpublishing entry..."
curl -s -X PUT "$API_URL/entries/$ENTRY1_ID/unpublish" \
  -H "Authorization: Bearer $TOKEN"
echo
echo

# Step 11: Archive entry
echo "[11] Archiving entry..."
curl -s -X PUT "$API_URL/entries/$ENTRY2_ID/archive" \
  -H "Authorization: Bearer $TOKEN"
echo
echo

# Step 12: Delete entry
echo "[12] Deleting entry..."
curl -s -X DELETE "$API_URL/entries/$ENTRY1_ID" \
  -H "Authorization: Bearer $TOKEN"
echo
echo

echo "====== Test Complete ======"
