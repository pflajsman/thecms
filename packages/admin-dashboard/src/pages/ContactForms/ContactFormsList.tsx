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
  Chip,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Visibility,
} from '@mui/icons-material';
import { contactFormsService } from '../../services/contactForms';

export function ContactFormsList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['contactForms'],
    queryFn: () => contactFormsService.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: contactFormsService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contactForms'] });
    },
  });

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete form "${name}"? All submissions will be deleted too.`)) {
      try {
        await deleteMutation.mutateAsync(id);
      } catch (error) {
        console.error('Failed to delete form:', error);
      }
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Typography variant="h4" component="h1">
          Contact Forms
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => navigate('/contact-forms/new')}
        >
          Create Form
        </Button>
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        Create contact forms for your websites. Visitors can submit forms via the Public API, and
        you'll receive email notifications for each submission.
      </Alert>

      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load contact forms. Please try again.
        </Alert>
      )}

      {data && (
        <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
          <Table sx={{ minWidth: 700 }}>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Slug</TableCell>
                <TableCell>Recipient</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Submissions</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                      No contact forms found. Create your first form to start collecting submissions!
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                data.data.map((form) => (
                  <TableRow key={form.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">
                        {form.name}
                      </Typography>
                      {form.description && (
                        <Typography variant="caption" color="text.secondary">
                          {form.description}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {form.slug}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{form.recipientEmail}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={form.isActive ? 'Active' : 'Inactive'}
                        color={form.isActive ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{form.submissionCount}</TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={() => navigate(`/contact-forms/${form.id}/submissions`)}
                        title="View Submissions"
                      >
                        <Visibility />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => navigate(`/contact-forms/${form.id}/edit`)}
                      >
                        <Edit />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDelete(form.id, form.name)}
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
