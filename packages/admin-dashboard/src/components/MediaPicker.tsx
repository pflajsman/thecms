import { useState } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import {
  Box,
  Button,
  Typography,
  IconButton,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  CircularProgress,
} from '@mui/material';
import {
  Collections,
  CloudUpload,
  Close,
  ArrowUpward,
  ArrowDownward,
  InsertDriveFile,
  BrokenImage,
} from '@mui/icons-material';
import { mediaService } from '../services/media';
import { MediaUpload } from '../pages/Media/MediaUpload';
import { MediaPickerDialog } from './MediaPickerDialog';
import type { MediaFile } from '../types';

interface MediaPickerProps {
  value: string | string[];
  onChange: (value: string | string[]) => void;
  multiple?: boolean;
  allowedMimeTypes?: string[];
}

function MediaThumbnail({ media, size = 48 }: { media: MediaFile | null; size?: number }) {
  if (!media) {
    return <BrokenImage sx={{ fontSize: size, color: 'grey.400' }} />;
  }
  if (media.mimeType.startsWith('image/')) {
    return (
      <img
        src={media.thumbnailUrl || media.blobUrl}
        alt={media.altText || media.originalName}
        style={{ width: size, height: size, objectFit: 'cover', borderRadius: 4 }}
      />
    );
  }
  return <InsertDriveFile sx={{ fontSize: size, color: 'grey.400' }} />;
}

export function MediaPicker({ value, onChange, multiple = false, allowedMimeTypes }: MediaPickerProps) {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  // Normalize value
  const ids: string[] = multiple
    ? (Array.isArray(value) ? value : value ? [value] : [])
    : (Array.isArray(value) ? (value.length > 0 ? [value[0]] : []) : value ? [value] : []);

  // Fetch media details for single mode
  const singleQuery = useQuery({
    queryKey: ['media', ids[0]],
    queryFn: () => mediaService.getById(ids[0]),
    enabled: !multiple && ids.length === 1,
    retry: false,
  });

  // Fetch media details for multiple mode
  const multiQueries = useQueries({
    queries: multiple
      ? ids.map((id) => ({
          queryKey: ['media', id],
          queryFn: () => mediaService.getById(id),
          retry: false as const,
        }))
      : [],
  });

  const getMediaMap = (): Map<string, MediaFile | null> => {
    const map = new Map<string, MediaFile | null>();
    if (!multiple && ids.length === 1) {
      map.set(ids[0], singleQuery.data?.data ?? null);
    } else if (multiple) {
      ids.forEach((id, i) => {
        map.set(id, multiQueries[i]?.data?.data ?? null);
      });
    }
    return map;
  };

  const mediaMap = getMediaMap();

  const handleGallerySelect = (media: MediaFile | MediaFile[]) => {
    if (multiple) {
      const newMedia = Array.isArray(media) ? media : [media];
      const newIds = [...ids, ...newMedia.map((m) => m.id)];
      onChange(newIds);
    } else {
      const single = Array.isArray(media) ? media[0] : media;
      onChange(single.id);
    }
  };

  const handleUploaded = (media: MediaFile) => {
    if (multiple) {
      onChange([...ids, media.id]);
    } else {
      onChange(media.id);
    }
    setUploadOpen(false);
  };

  const handleRemove = (id: string) => {
    if (multiple) {
      onChange(ids.filter((i) => i !== id));
    } else {
      onChange('');
    }
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= ids.length) return;
    const updated = [...ids];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    onChange(updated);
  };

  const isLoading = !multiple
    ? singleQuery.isLoading && ids.length > 0
    : multiQueries.some((q) => q.isLoading);

  return (
    <Box>
      {/* Selected media preview */}
      {ids.length === 0 && (
        <Paper
          variant="outlined"
          sx={{
            p: 3,
            textAlign: 'center',
            border: '2px dashed',
            borderColor: 'grey.300',
            mb: 2,
          }}
        >
          <Typography color="text.secondary">
            No media selected
          </Typography>
        </Paper>
      )}

      {isLoading && ids.length > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={24} />
        </Box>
      )}

      {/* Single mode preview */}
      {!multiple && ids.length === 1 && !isLoading && (
        <Paper variant="outlined" sx={{ p: 1.5, mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
          <MediaThumbnail media={mediaMap.get(ids[0]) ?? null} />
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="body2" noWrap>
              {mediaMap.get(ids[0])?.originalName ?? 'Media not found'}
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => handleRemove(ids[0])}>
            <Close fontSize="small" />
          </IconButton>
        </Paper>
      )}

      {/* Multiple mode preview */}
      {multiple && ids.length > 0 && !isLoading && (
        <Box sx={{ mb: 2 }}>
          {ids.map((id, index) => (
            <Paper
              key={id}
              variant="outlined"
              sx={{
                p: 1,
                mb: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
              }}
            >
              <MediaThumbnail media={mediaMap.get(id) ?? null} size={40} />
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography variant="body2" noWrap>
                  {mediaMap.get(id)?.originalName ?? 'Media not found'}
                </Typography>
              </Box>
              <IconButton
                size="small"
                onClick={() => handleMove(index, 'up')}
                disabled={index === 0}
              >
                <ArrowUpward fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                onClick={() => handleMove(index, 'down')}
                disabled={index === ids.length - 1}
              >
                <ArrowDownward fontSize="small" />
              </IconButton>
              <IconButton size="small" onClick={() => handleRemove(id)}>
                <Close fontSize="small" />
              </IconButton>
            </Paper>
          ))}
        </Box>
      )}

      {/* Action buttons */}
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button
          variant="outlined"
          size="small"
          startIcon={<Collections />}
          onClick={() => setGalleryOpen(true)}
        >
          Choose from gallery
        </Button>
        <Button
          variant="outlined"
          size="small"
          startIcon={<CloudUpload />}
          onClick={() => setUploadOpen(true)}
        >
          Upload new
        </Button>
      </Box>

      {/* Gallery dialog */}
      <MediaPickerDialog
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        onSelect={handleGallerySelect}
        multiple={multiple}
        allowedMimeTypes={allowedMimeTypes}
        excludeIds={ids}
      />

      {/* Upload dialog */}
      <Dialog open={uploadOpen} onClose={() => setUploadOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Upload Media</DialogTitle>
        <DialogContent>
          <MediaUpload onUploaded={handleUploaded} />
        </DialogContent>
      </Dialog>
    </Box>
  );
}
