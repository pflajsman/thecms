#!/bin/bash
# Test script for Media API

TOKEN="eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0=.eyJzdWIiOiJ0ZXN0LXVzZXItMTIzIiwiZW1haWwiOiJhZG1pbkBleGFtcGxlLmNvbSIsIm5hbWUiOiJUZXN0IEFkbWluIn0=.signature"
API_URL="http://localhost:3000/api/v1"

echo "====== Media API Test ======"
echo

# Create a temporary test image file (1x1 pixel PNG)
TEST_IMAGE="test-image.png"
echo "Creating test image..."
# Base64 encoded 1x1 red PNG pixel
echo -n "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==" | base64 -d > $TEST_IMAGE
echo "Test image created: $TEST_IMAGE"
echo

# Step 1: Upload a media file
echo "[1] Uploading image..."
UPLOAD_RESPONSE=$(curl -s -X POST "$API_URL/media/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@$TEST_IMAGE" \
  -F "altText=Test Image Alt Text" \
  -F "description=This is a test image upload" \
  -F "tags=test,demo,sample")

MEDIA_ID=$(echo $UPLOAD_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Media ID: $MEDIA_ID"
echo "Response: $UPLOAD_RESPONSE"
echo

# Step 2: Upload another image without metadata
echo "[2] Uploading second image (minimal metadata)..."
UPLOAD2_RESPONSE=$(curl -s -X POST "$API_URL/media/upload" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@$TEST_IMAGE")

MEDIA2_ID=$(echo $UPLOAD2_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Media 2 ID: $MEDIA2_ID"
echo

# Step 3: List all media
echo "[3] Listing all media files..."
curl -s "$API_URL/media" \
  -H "Authorization: Bearer $TOKEN"
echo
echo

# Step 4: List media with pagination
echo "[4] Listing media with pagination (page 1, limit 10)..."
curl -s "$API_URL/media?page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN"
echo
echo

# Step 5: Filter media by category
echo "[5] Filtering media by category (image)..."
curl -s "$API_URL/media?category=image" \
  -H "Authorization: Bearer $TOKEN"
echo
echo

# Step 6: Filter media by tags
echo "[6] Filtering media by tags (test)..."
curl -s "$API_URL/media?tags=test" \
  -H "Authorization: Bearer $TOKEN"
echo
echo

# Step 7: Search media
echo "[7] Searching media (search term: 'test')..."
curl -s "$API_URL/media?search=test" \
  -H "Authorization: Bearer $TOKEN"
echo
echo

# Step 8: Get single media file
echo "[8] Getting single media file..."
curl -s "$API_URL/media/$MEDIA_ID" \
  -H "Authorization: Bearer $TOKEN"
echo
echo

# Step 9: Update media metadata
echo "[9] Updating media metadata..."
curl -s -X PATCH "$API_URL/media/$MEDIA_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "altText": "Updated Alt Text",
    "description": "This metadata has been updated",
    "tags": ["updated", "modified", "test"]
  }'
echo
echo

# Step 10: Get updated media
echo "[10] Getting updated media..."
curl -s "$API_URL/media/$MEDIA_ID" \
  -H "Authorization: Bearer $TOKEN"
echo
echo

# Step 11: Delete first media file
echo "[11] Deleting first media file..."
curl -s -X DELETE "$API_URL/media/$MEDIA_ID" \
  -H "Authorization: Bearer $TOKEN"
echo
echo

# Step 12: Verify deletion
echo "[12] Verifying deletion (should return 404)..."
curl -s "$API_URL/media/$MEDIA_ID" \
  -H "Authorization: Bearer $TOKEN"
echo
echo

# Step 13: Delete second media file
echo "[13] Deleting second media file..."
curl -s -X DELETE "$API_URL/media/$MEDIA2_ID" \
  -H "Authorization: Bearer $TOKEN"
echo
echo

# Step 14: List all media (should be empty or reduced)
echo "[14] Listing all media after deletions..."
curl -s "$API_URL/media" \
  -H "Authorization: Bearer $TOKEN"
echo
echo

# Cleanup
echo "Cleaning up test image..."
rm -f $TEST_IMAGE

echo "====== Test Complete ======"
