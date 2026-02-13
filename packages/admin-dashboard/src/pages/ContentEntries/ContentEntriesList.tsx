import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  IconButton,
  Chip,
  Alert,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import { Add, Edit, Delete, Publish, Archive, Unpublished } from '@mui/icons-material';
import { contentEntriesService } from '../../services/contentEntries';
import { contentTypesService } from '../../services/contentTypes';

export function ContentEntriesList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const selectedContentTypeId = searchParams.get('contentType') || '';
  const statusFilter = searchParams.get('status') || '';
  const [page, setPage] = useState(1);

  // Fetch all content types for the selector
  const { data: contentTypesData } = useQuery({
    queryKey: ['contentTypes'],
    queryFn: () => contentTypesService.list(1, 100),
  });

  // Fetch entries for selected content type
  const { data: entriesData, isLoading, error } = useQuery({
    queryKey: ['contentEntries', selectedContentTypeId, statusFilter, page],
    queryFn: () =>
      contentEntriesService.listByContentType(selectedContentTypeId, {
        page,
        limit: 20,
        ...(statusFilter && { status: statusFilter as any }),
      }),
    enabled: !!selectedContentTypeId,
  });

  const deleteMutation = useMutation({
    mutationFn: contentEntriesService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contentEntries'] });
    },
  });

  const publishMutation = useMutation({
    mutationFn: contentEntriesService.publish,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contentEntries'] });
    },
  });

  const unpublishMutation = useMutation({
    mutationFn: contentEntriesService.unpublish,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contentEntries'] });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: contentEntriesService.archive,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contentEntries'] });
    },
  });

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this entry?')) {
      try {
        await deleteMutation.mutateAsync(id);
      } catch (error) {
        console.error('Failed to delete entry:', error);
      }
    }
  };

  const handleContentTypeChange = (contentTypeId: string) => {
    setSearchParams({ contentType: contentTypeId });
    setPage(1);
  };

  const handleStatusFilterChange = (status: string) => {
    const params: any = { contentType: selectedContentTypeId };
    if (status) params.status = status;
    setSearchParams(params);
    setPage(1);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PUBLISHED':
        return 'success';
      case 'DRAFT':
        return 'warning';
      case 'ARCHIVED':
        return 'default';
      default:
        return 'default';
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Typography variant="h4" component="h1">
          Content Entries
        </Typography>
        {selectedContentTypeId && (
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => navigate(`/entries/new?contentType=${selectedContentTypeId}`)}
          >
            Create Entry
          </Button>
        )}
      </Box>

      {/* Content Type Selector */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <FormControl sx={{ minWidth: 300 }}>
            <InputLabel>Select Content Type</InputLabel>
            <Select
              value={selectedContentTypeId}
              label="Select Content Type"
              onChange={(e) => handleContentTypeChange(e.target.value)}
            >
              {contentTypesData?.data.map((ct) => (
                <MenuItem key={ct.id} value={ct.id}>
                  {ct.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {selectedContentTypeId && (
            <FormControl sx={{ minWidth: 150 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={(e) => handleStatusFilterChange(e.target.value)}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="DRAFT">Draft</MenuItem>
                <MenuItem value="PUBLISHED">Published</MenuItem>
                <MenuItem value="ARCHIVED">Archived</MenuItem>
              </Select>
            </FormControl>
          )}
        </Box>
      </Paper>

      {!selectedContentTypeId && (
        <Alert severity="info">Please select a content type to view entries.</Alert>
      )}

      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load entries. Please try again.
        </Alert>
      )}

      {entriesData && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Status</TableCell>
                <TableCell>Content</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Updated</TableCell>
                <TableCell>Published</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {entriesData.data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                      No entries found. Create your first one!
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                entriesData.data.map((entry) => (
                  <TableRow key={entry.id} hover>
                    <TableCell>
                      <Chip label={entry.status} color={getStatusColor(entry.status) as any} size="small" />
                    </TableCell>
                    <TableCell>
                      {/* Display first text field value */}
                      {Object.entries(entry.data).slice(0, 2).map(([key, value]) => (
                        <Box key={key}>
                          <Typography variant="body2" fontWeight="bold">
                            {key}:
                          </Typography>
                          <Typography variant="body2" noWrap sx={{ maxWidth: 300 }}>
                            {String(value).substring(0, 100)}
                            {String(value).length > 100 ? '...' : ''}
                          </Typography>
                        </Box>
                      ))}
                    </TableCell>
                    <TableCell>{new Date(entry.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>{new Date(entry.updatedAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {entry.publishedAt ? new Date(entry.publishedAt).toLocaleDateString() : '-'}
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => navigate(`/entries/${entry.id}/edit`)}>
                        <Edit />
                      </IconButton>
                      {entry.status === 'DRAFT' && (
                        <IconButton
                          size="small"
                          color="success"
                          onClick={() => publishMutation.mutate(entry.id)}
                        >
                          <Publish />
                        </IconButton>
                      )}
                      {entry.status === 'PUBLISHED' && (
                        <IconButton
                          size="small"
                          color="warning"
                          onClick={() => unpublishMutation.mutate(entry.id)}
                        >
                          <Unpublished />
                        </IconButton>
                      )}
                      {entry.status !== 'ARCHIVED' && (
                        <IconButton
                          size="small"
                          onClick={() => archiveMutation.mutate(entry.id)}
                        >
                          <Archive />
                        </IconButton>
                      )}
                      <IconButton size="small" color="error" onClick={() => handleDelete(entry.id)}>
                        <Delete />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
