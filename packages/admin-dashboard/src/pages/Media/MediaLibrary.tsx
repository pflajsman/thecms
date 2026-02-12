import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Button,
  Paper,
  Typography,
  Alert,
  CircularProgress,
  Grid,
  Card,
  CardMedia,
  CardContent,
  CardActions,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { CloudUpload, Delete, Edit, Image as ImageIcon } from '@mui/icons-material';
import { mediaService } from '../../services/media';
import { MediaUpload } from './MediaUpload';

export function MediaLibrary() {
  const queryClient = useQueryClient();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<any>(null);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page] = useState(1);

  const [editForm, setEditForm] = useState({
    altText: '',
    description: '',
    tags: [] as string[],
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['media', categoryFilter, page],
    queryFn: () =>
      mediaService.list({
        page,
        limit: 20,
        ...(categoryFilter && { category: categoryFilter as 'image' | 'document' | 'video' }),
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: mediaService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      mediaService.updateMetadata(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] });
      setEditDialogOpen(false);
    },
  });

  const handleDelete = async (id: string, filename: string) => {
    if (confirm(`Are you sure you want to delete "${filename}"?`)) {
      try {
        await deleteMutation.mutateAsync(id);
      } catch (error) {
        console.error('Failed to delete media:', error);
      }
    }
  };

  const handleEdit = (media: any) => {
    setSelectedMedia(media);
    setEditForm({
      altText: media.altText || '',
      description: media.description || '',
      tags: media.tags || [],
    });
    setEditDialogOpen(true);
  };

  const handleUpdateSubmit = () => {
    if (selectedMedia) {
      updateMutation.mutate({
        id: selectedMedia.id,
        data: editForm,
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const isImage = (mimeType: string) => mimeType.startsWith('image/');

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Media Library
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<CloudUpload />}
          onClick={() => setUploadDialogOpen(true)}
        >
          Upload Media
        </Button>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel>Category</InputLabel>
          <Select
            value={categoryFilter}
            label="Category"
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="image">Images</MenuItem>
            <MenuItem value="document">Documents</MenuItem>
            <MenuItem value="video">Videos</MenuItem>
          </Select>
        </FormControl>
      </Paper>

      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load media files. Please try again.
        </Alert>
      )}

      {data && (
        <>
          {data.data.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <ImageIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                No media files found
              </Typography>
              <Button
                variant="contained"
                startIcon={<CloudUpload />}
                onClick={() => setUploadDialogOpen(true)}
                sx={{ mt: 2 }}
              >
                Upload Your First File
              </Button>
            </Paper>
          ) : (
            <Grid container spacing={2}>
              {data.data.map((media) => (
                <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={media.id}>
                  <Card>
                    <Box
                      sx={{
                        height: 200,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'grey.100',
                      }}
                    >
                      {isImage(media.mimeType) ? (
                        <CardMedia
                          component="img"
                          image={media.thumbnailUrl || media.blobUrl}
                          alt={media.altText || media.originalName}
                          sx={{ height: 200, objectFit: 'contain' }}
                        />
                      ) : (
                        <ImageIcon sx={{ fontSize: 64, color: 'text.secondary' }} />
                      )}
                    </Box>
                    <CardContent>
                      <Typography variant="body2" noWrap title={media.originalName}>
                        {media.originalName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatFileSize(media.size)}
                      </Typography>
                      {media.width && media.height && (
                        <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                          {media.width}x{media.height}
                        </Typography>
                      )}
                      <Box sx={{ mt: 1 }}>
                        {media.tags?.slice(0, 2).map((tag: string) => (
                          <Chip key={tag} label={tag} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
                        ))}
                        {(media.tags?.length ?? 0) > 2 && (
                          <Chip label={`+${media.tags!.length - 2}`} size="small" />
                        )}
                      </Box>
                    </CardContent>
                    <CardActions>
                      <IconButton size="small" onClick={() => handleEdit(media)}>
                        <Edit />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDelete(media.id, media.originalName)}
                      >
                        <Delete />
                      </IconButton>
                    </CardActions>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </>
      )}

      {/* Upload Dialog */}
      <Dialog
        open={uploadDialogOpen}
        onClose={() => setUploadDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Upload Media</DialogTitle>
        <DialogContent>
          <MediaUpload
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['media'] });
              setUploadDialogOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Media</DialogTitle>
        <DialogContent>
          <TextField
            label="Alt Text"
            value={editForm.altText}
            onChange={(e) => setEditForm({ ...editForm, altText: e.target.value })}
            fullWidth
            margin="normal"
          />
          <TextField
            label="Description"
            value={editForm.description}
            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
            fullWidth
            margin="normal"
            multiline
            rows={3}
          />
          <TextField
            label="Tags (comma-separated)"
            value={editForm.tags.join(', ')}
            onChange={(e) =>
              setEditForm({
                ...editForm,
                tags: e.target.value.split(',').map((t) => t.trim()),
              })
            }
            fullWidth
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleUpdateSubmit}
            variant="contained"
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
