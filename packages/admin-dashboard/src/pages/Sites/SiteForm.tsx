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
  FormControlLabel,
  Switch,
} from '@mui/material';
import { Save, ArrowBack } from '@mui/icons-material';
import { sitesService } from '../../services/sites';

export function SiteForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditMode = !!id;

  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { data: siteData, isLoading } = useQuery({
    queryKey: ['site', id],
    queryFn: () => sitesService.getById(id!),
    enabled: isEditMode,
  });

  useEffect(() => {
    if (siteData?.data) {
      setName(siteData.data.name);
      setDomain(siteData.data.domain);
      setDescription(siteData.data.description || '');
      setIsActive(siteData.data.isActive);
    }
  }, [siteData]);

  const createMutation = useMutation({
    mutationFn: sitesService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] });
      navigate('/sites');
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Failed to create site');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => sitesService.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] });
      queryClient.invalidateQueries({ queryKey: ['site', id] });
      navigate('/sites');
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Failed to update site');
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const data = {
      name,
      domain,
      description,
      ...(isEditMode && { isActive }),
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
      <Button startIcon={<ArrowBack />} onClick={() => navigate('/sites')} sx={{ mb: 2 }}>
        Back to Sites
      </Button>

      <Paper sx={{ p: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {isEditMode ? 'Edit Site' : 'Create Site'}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {isEditMode && siteData?.data && (
          <Alert severity="info" sx={{ mb: 2 }}>
            API Key: <code>{siteData.data.apiKey}</code>
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit}>
          <TextField
            label="Site Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            fullWidth
            margin="normal"
            helperText="Display name for this site (e.g., 'My Blog')"
          />

          <TextField
            label="Domain"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            required
            fullWidth
            margin="normal"
            helperText="Domain where this site is hosted (e.g., 'myblog.com')"
          />

          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            margin="normal"
            multiline
            rows={2}
            helperText="Optional description of this site"
          />

          {isEditMode && (
            <FormControlLabel
              control={<Switch checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />}
              label="Active"
              sx={{ mt: 2 }}
            />
          )}

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
            <Button onClick={() => navigate('/sites')}>Cancel</Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}
