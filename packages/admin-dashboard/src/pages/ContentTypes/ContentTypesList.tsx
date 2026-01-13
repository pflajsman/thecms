import { useNavigate } from 'react-router-dom';
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
  Alert,
  CircularProgress,
} from '@mui/material';
import { Add, Edit, Delete } from '@mui/icons-material';
import { contentTypesService } from '../../services/contentTypes';

export function ContentTypesList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['contentTypes'],
    queryFn: () => contentTypesService.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: contentTypesService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contentTypes'] });
    },
  });

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete "${name}"?`)) {
      try {
        await deleteMutation.mutateAsync(id);
      } catch (error) {
        console.error('Failed to delete content type:', error);
      }
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Content Types
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<Add />}
          onClick={() => navigate('/content-types/new')}
        >
          Create Content Type
        </Button>
      </Box>

      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load content types. Please try again.
        </Alert>
      )}

      {data && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Slug</TableCell>
                <TableCell>Description</TableCell>
                <TableCell align="center">Fields</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                      No content types found. Create your first one!
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                data.data.map((contentType) => (
                  <TableRow key={contentType.id} hover>
                    <TableCell>{contentType.name}</TableCell>
                    <TableCell>{contentType.slug}</TableCell>
                    <TableCell>{contentType.description || '-'}</TableCell>
                    <TableCell align="center">{contentType.fields.length}</TableCell>
                    <TableCell>{new Date(contentType.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={() => navigate(`/content-types/${contentType.id}/edit`)}
                      >
                        <Edit />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDelete(contentType.id, contentType.name)}
                      >
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
