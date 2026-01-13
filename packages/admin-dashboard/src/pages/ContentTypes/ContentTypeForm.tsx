import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Button,
  Paper,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material';
import { Save, ArrowBack } from '@mui/icons-material';
import { contentTypesService } from '../../services/contentTypes';
import { FieldBuilder } from './FieldBuilder';
import type { Field } from '../../types';

export function ContentTypeForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditMode = !!id;

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState<Field[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Fetch existing content type if editing
  const { data: contentType, isLoading } = useQuery({
    queryKey: ['contentType', id],
    queryFn: () => contentTypesService.getById(id!),
    enabled: isEditMode,
  });

  useEffect(() => {
    if (contentType?.data) {
      setName(contentType.data.name);
      setSlug(contentType.data.slug);
      setDescription(contentType.data.description || '');
      setFields(contentType.data.fields);
    }
  }, [contentType]);

  // Auto-generate slug from name
  useEffect(() => {
    if (!isEditMode && name) {
      const generatedSlug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      setSlug(generatedSlug);
    }
  }, [name, isEditMode]);

  const createMutation = useMutation({
    mutationFn: contentTypesService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contentTypes'] });
      navigate('/content-types');
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Failed to create content type');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => contentTypesService.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contentTypes'] });
      queryClient.invalidateQueries({ queryKey: ['contentType', id] });
      navigate('/content-types');
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Failed to update content type');
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (fields.length === 0) {
      setError('Please add at least one field');
      return;
    }

    const data = {
      name,
      slug,
      description,
      fields,
    };

    if (isEditMode) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Button
        startIcon={<ArrowBack />}
        onClick={() => navigate('/content-types')}
        sx={{ mb: 2 }}
      >
        Back to Content Types
      </Button>

      <Paper sx={{ p: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {isEditMode ? 'Edit Content Type' : 'Create Content Type'}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit}>
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            fullWidth
            margin="normal"
            helperText="Display name for this content type (e.g., 'Blog Post')"
          />

          <TextField
            label="Slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            required
            fullWidth
            margin="normal"
            helperText="URL-friendly identifier (e.g., 'blog-post')"
            disabled={isEditMode}
          />

          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            margin="normal"
            multiline
            rows={2}
            helperText="Optional description of this content type"
          />

          <Divider sx={{ my: 4 }} />

          <Typography variant="h5" component="h2" gutterBottom>
            Fields
          </Typography>

          <FieldBuilder fields={fields} onChange={setFields} />

          <Box sx={{ mt: 4, display: 'flex', gap: 2 }}>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              startIcon={<Save />}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending
                ? 'Saving...'
                : isEditMode
                ? 'Update'
                : 'Create'}
            </Button>
            <Button onClick={() => navigate('/content-types')}>Cancel</Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}
