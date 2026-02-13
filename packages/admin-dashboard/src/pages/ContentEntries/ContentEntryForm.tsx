import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Button,
  Paper,
  Typography,
  Alert,
  CircularProgress,
  Chip,
  ButtonGroup,
} from '@mui/material';
import { Save, ArrowBack, Publish } from '@mui/icons-material';
import { contentEntriesService } from '../../services/contentEntries';
import { contentTypesService } from '../../services/contentTypes';
import { DynamicFormGenerator } from '../../components/DynamicFormGenerator';

export function ContentEntryForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const isEditMode = !!id;

  const contentTypeIdFromQuery = searchParams.get('contentType');

  const [contentTypeId, setContentTypeId] = useState(contentTypeIdFromQuery || '');
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);

  // Fetch content entry if editing
  const { data: entryData, isLoading: loadingEntry } = useQuery({
    queryKey: ['contentEntry', id],
    queryFn: () => contentEntriesService.getById(id!),
    enabled: isEditMode,
  });

  // Fetch content type
  const { data: contentTypeData, isLoading: loadingContentType } = useQuery({
    queryKey: ['contentType', contentTypeId],
    queryFn: () => contentTypesService.getById(contentTypeId),
    enabled: !!contentTypeId,
  });

  useEffect(() => {
    if (entryData?.data) {
      setFormData(entryData.data.data);
      // contentTypeId may be a populated object or a plain string
      const ctId = entryData.data.contentTypeId;
      setContentTypeId(typeof ctId === 'object' && ctId !== null ? (ctId as any).id || (ctId as any)._id : ctId);
    }
  }, [entryData]);

  const createMutation = useMutation({
    mutationFn: (data: any) => contentEntriesService.create(contentTypeId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contentEntries'] });
      navigate(`/entries?contentType=${contentTypeId}`);
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Failed to create entry');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => contentEntriesService.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contentEntries'] });
      queryClient.invalidateQueries({ queryKey: ['contentEntry', id] });
      navigate(`/entries?contentType=${contentTypeId}`);
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Failed to update entry');
    },
  });

  const handleFieldChange = (name: string, value: any) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (status: 'DRAFT' | 'PUBLISHED' = 'DRAFT') => {
    setError(null);

    const payload = {
      data: formData,
      ...(status && !isEditMode && { status }),
    };

    if (isEditMode) {
      updateMutation.mutate({ data: formData });
    } else {
      createMutation.mutate(payload);
    }
  };

  if (loadingEntry || loadingContentType) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (!contentTypeData?.data) {
    return (
      <Box>
        <Alert severity="error">Content type not found.</Alert>
      </Box>
    );
  }

  const contentType = contentTypeData.data;

  return (
    <Box>
      <Button
        startIcon={<ArrowBack />}
        onClick={() => navigate(`/entries?contentType=${contentTypeId}`)}
        sx={{ mb: 2 }}
      >
        Back to Entries
      </Button>

      <Paper sx={{ p: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              {isEditMode ? 'Edit Entry' : 'Create Entry'}
            </Typography>
            <Chip label={contentType.name} color="primary" size="small" />
          </Box>
          {entryData?.data && (
            <Chip
              label={entryData.data.status}
              color={
                entryData.data.status === 'PUBLISHED'
                  ? 'success'
                  : entryData.data.status === 'DRAFT'
                  ? 'warning'
                  : 'default'
              }
            />
          )}
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <DynamicFormGenerator
          fields={contentType.fields}
          values={formData}
          onChange={handleFieldChange}
        />

        <Box sx={{ mt: 4, display: 'flex', gap: 2 }}>
          {isEditMode ? (
            <>
              <Button
                variant="contained"
                color="primary"
                startIcon={<Save />}
                onClick={() => handleSave()}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button onClick={() => navigate(`/entries?contentType=${contentTypeId}`)}>
                Cancel
              </Button>
            </>
          ) : (
            <>
              <ButtonGroup variant="contained">
                <Button
                  startIcon={<Save />}
                  onClick={() => handleSave('DRAFT')}
                  disabled={createMutation.isPending}
                >
                  Save as Draft
                </Button>
                <Button
                  color="success"
                  startIcon={<Publish />}
                  onClick={() => handleSave('PUBLISHED')}
                  disabled={createMutation.isPending}
                >
                  Publish
                </Button>
              </ButtonGroup>
              <Button onClick={() => navigate(`/entries?contentType=${contentTypeId}`)}>
                Cancel
              </Button>
            </>
          )}
        </Box>
      </Paper>
    </Box>
  );
}
