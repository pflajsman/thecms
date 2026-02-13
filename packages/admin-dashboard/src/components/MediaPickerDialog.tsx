import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Box,
  Grid,
  Card,
  CardMedia,
  CardContent,
  Typography,
  Pagination,
  CircularProgress,
  Alert,
  InputAdornment,
} from '@mui/material';
import { Search, CheckCircle, InsertDriveFile } from '@mui/icons-material';
import { mediaService, type ListMediaParams } from '../services/media';
import type { MediaFile } from '../types';

interface MediaPickerDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (media: MediaFile | MediaFile[]) => void;
  multiple?: boolean;
  allowedMimeTypes?: string[];
  excludeIds?: string[];
}

type CategoryFilter = 'all' | 'image' | 'document' | 'video';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function MediaPickerDialog({
  open,
  onClose,
  onSelect,
  multiple = false,
  allowedMimeTypes,
  excludeIds = [],
}: MediaPickerDialogProps) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<MediaFile[]>([]);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSelected([]);
      setSearch('');
      setPage(1);
    }
  }, [open]);

  const params: ListMediaParams = {
    page,
    limit: 12,
    ...(search && { search }),
    ...(category !== 'all' && { category }),
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ['media', 'picker', params],
    queryFn: () => mediaService.list(params),
    enabled: open,
  });

  // Filter by allowed MIME types and exclude already selected IDs
  const filteredMedia = (data?.data ?? []).filter((media) => {
    if (excludeIds.includes(media.id)) return false;
    if (allowedMimeTypes && allowedMimeTypes.length > 0) {
      return allowedMimeTypes.some((mime) => {
        if (mime.endsWith('/*')) {
          return media.mimeType.startsWith(mime.replace('/*', '/'));
        }
        return media.mimeType === mime;
      });
    }
    return true;
  });

  const isSelected = (media: MediaFile) =>
    selected.some((s) => s.id === media.id);

  const handleCardClick = (media: MediaFile) => {
    if (!multiple) {
      onSelect(media);
      onClose();
      return;
    }

    setSelected((prev) =>
      isSelected(media)
        ? prev.filter((s) => s.id !== media.id)
        : [...prev, media]
    );
  };

  const handleConfirm = () => {
    if (multiple && selected.length > 0) {
      onSelect(selected);
      onClose();
    }
  };

  const isImage = (mimeType: string) => mimeType.startsWith('image/');

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Choose Media</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', gap: 2, mb: 3, mt: 1 }}>
          <TextField
            placeholder="Search media..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            size="small"
            sx={{ flexGrow: 1 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
          />
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Category</InputLabel>
            <Select
              value={category}
              label="Category"
              onChange={(e) => {
                setCategory(e.target.value as CategoryFilter);
                setPage(1);
              }}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="image">Images</MenuItem>
              <MenuItem value="document">Documents</MenuItem>
              <MenuItem value="video">Videos</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Failed to load media
          </Alert>
        )}

        {!isLoading && filteredMedia.length === 0 && (
          <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            No media found
          </Typography>
        )}

        <Grid container spacing={2}>
          {filteredMedia.map((media) => (
            <Grid size={{ xs: 6, sm: 4, md: 3 }} key={media.id}>
              <Card
                onClick={() => handleCardClick(media)}
                sx={{
                  cursor: 'pointer',
                  position: 'relative',
                  border: isSelected(media) ? 2 : 1,
                  borderColor: isSelected(media) ? 'primary.main' : 'divider',
                  transition: 'border-color 0.2s',
                  '&:hover': {
                    borderColor: 'primary.light',
                  },
                }}
              >
                {isSelected(media) && (
                  <CheckCircle
                    sx={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      zIndex: 1,
                      color: 'primary.main',
                      backgroundColor: 'white',
                      borderRadius: '50%',
                    }}
                  />
                )}
                <Box sx={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'grey.100' }}>
                  {isImage(media.mimeType) ? (
                    <CardMedia
                      component="img"
                      image={media.thumbnailUrl || media.blobUrl}
                      alt={media.altText || media.originalName}
                      sx={{ height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <InsertDriveFile sx={{ fontSize: 48, color: 'grey.400' }} />
                  )}
                </Box>
                <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
                  <Typography variant="body2" noWrap title={media.originalName}>
                    {media.originalName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatFileSize(media.size)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {data && data.pagination.totalPages > 1 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
            <Pagination
              count={data.pagination.totalPages}
              page={page}
              onChange={(_, p) => setPage(p)}
            />
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        {multiple && (
          <Button
            variant="contained"
            onClick={handleConfirm}
            disabled={selected.length === 0}
          >
            Select ({selected.length})
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
