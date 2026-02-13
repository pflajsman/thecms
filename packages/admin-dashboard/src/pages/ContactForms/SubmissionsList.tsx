import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  ArrowBack,
  Delete,
  MarkEmailRead,
  Archive,
  Visibility,
} from '@mui/icons-material';
import { contactFormsService } from '../../services/contactForms';
import type { FormSubmission, SubmissionStatus } from '../../types';

const STATUS_COLORS: Record<SubmissionStatus, 'warning' | 'info' | 'default'> = {
  UNREAD: 'warning',
  READ: 'info',
  ARCHIVED: 'default',
};

export function SubmissionsList() {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<SubmissionStatus | 'ALL'>('ALL');
  const [selectedSubmission, setSelectedSubmission] = useState<FormSubmission | null>(null);

  const { data: formData } = useQuery({
    queryKey: ['contactForm', formId],
    queryFn: () => contactFormsService.getById(formId!),
    enabled: !!formId,
  });

  const { data: statsData } = useQuery({
    queryKey: ['submissionStats', formId],
    queryFn: () => contactFormsService.getStats(formId!),
    enabled: !!formId,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['submissions', formId, statusFilter],
    queryFn: () =>
      contactFormsService.listSubmissions(
        formId!,
        1,
        50,
        statusFilter === 'ALL' ? undefined : statusFilter
      ),
    enabled: !!formId,
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ submissionId, status }: { submissionId: string; status: SubmissionStatus }) =>
      contactFormsService.updateSubmissionStatus(formId!, submissionId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submissions', formId] });
      queryClient.invalidateQueries({ queryKey: ['submissionStats', formId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (submissionId: string) =>
      contactFormsService.deleteSubmission(formId!, submissionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['submissions', formId] });
      queryClient.invalidateQueries({ queryKey: ['submissionStats', formId] });
      queryClient.invalidateQueries({ queryKey: ['contactForms'] });
    },
  });

  const handleDelete = async (submissionId: string) => {
    if (confirm('Are you sure you want to delete this submission?')) {
      try {
        await deleteMutation.mutateAsync(submissionId);
        if (selectedSubmission?.id === submissionId) {
          setSelectedSubmission(null);
        }
      } catch (err) {
        console.error('Failed to delete submission:', err);
      }
    }
  };

  const getDataPreview = (submission: FormSubmission): string => {
    const entries = Object.entries(submission.data);
    const preview = entries
      .slice(0, 3)
      .map(([key, value]) => `${key}: ${String(value).substring(0, 40)}`)
      .join(' | ');
    return entries.length > 3 ? `${preview} ...` : preview;
  };

  const stats = statsData?.data;

  return (
    <Box>
      <Button startIcon={<ArrowBack />} onClick={() => navigate('/contact-forms')} sx={{ mb: 2 }}>
        Back to Contact Forms
      </Button>

      <Typography variant="h4" component="h1" gutterBottom>
        Submissions: {formData?.data?.name || '...'}
      </Typography>

      {/* Stats bar */}
      {stats && (
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          <Chip label={`Total: ${stats.total}`} variant="outlined" />
          <Chip label={`Unread: ${stats.unread}`} color="warning" variant="outlined" />
          <Chip label={`Read: ${stats.read}`} color="info" variant="outlined" />
          <Chip label={`Archived: ${stats.archived}`} variant="outlined" />
        </Box>
      )}

      {/* Status filter */}
      <ToggleButtonGroup
        value={statusFilter}
        exclusive
        onChange={(_, value) => value && setStatusFilter(value)}
        size="small"
        sx={{ mb: 3 }}
      >
        <ToggleButton value="ALL">All</ToggleButton>
        <ToggleButton value="UNREAD">Unread</ToggleButton>
        <ToggleButton value="READ">Read</ToggleButton>
        <ToggleButton value="ARCHIVED">Archived</ToggleButton>
      </ToggleButtonGroup>

      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load submissions. Please try again.
        </Alert>
      )}

      {data && (
        <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
          <Table sx={{ minWidth: 700 }}>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Data</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                      No submissions found.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                data.data.map((submission) => (
                  <TableRow
                    key={submission.id}
                    hover
                    sx={{
                      cursor: 'pointer',
                      fontWeight: submission.status === 'UNREAD' ? 700 : 400,
                    }}
                    onClick={() => setSelectedSubmission(submission)}
                  >
                    <TableCell>
                      {new Date(submission.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={submission.status}
                        color={STATUS_COLORS[submission.status]}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap sx={{ maxWidth: 400 }}>
                        {getDataPreview(submission)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                      <IconButton
                        size="small"
                        title="View"
                        onClick={() => setSelectedSubmission(submission)}
                      >
                        <Visibility />
                      </IconButton>
                      {submission.status !== 'READ' && (
                        <IconButton
                          size="small"
                          title="Mark as Read"
                          onClick={() =>
                            updateStatusMutation.mutate({
                              submissionId: submission.id,
                              status: 'READ',
                            })
                          }
                        >
                          <MarkEmailRead />
                        </IconButton>
                      )}
                      {submission.status !== 'ARCHIVED' && (
                        <IconButton
                          size="small"
                          title="Archive"
                          onClick={() =>
                            updateStatusMutation.mutate({
                              submissionId: submission.id,
                              status: 'ARCHIVED',
                            })
                          }
                        >
                          <Archive />
                        </IconButton>
                      )}
                      <IconButton
                        size="small"
                        color="error"
                        title="Delete"
                        onClick={() => handleDelete(submission.id)}
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

      {/* Submission detail dialog */}
      <Dialog
        open={!!selectedSubmission}
        onClose={() => setSelectedSubmission(null)}
        maxWidth="sm"
        fullWidth
      >
        {selectedSubmission && (
          <>
            <DialogTitle>
              Submission Details
              <Chip
                label={selectedSubmission.status}
                color={STATUS_COLORS[selectedSubmission.status]}
                size="small"
                sx={{ ml: 2 }}
              />
            </DialogTitle>
            <DialogContent dividers>
              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                Submitted: {new Date(selectedSubmission.createdAt).toLocaleString()}
              </Typography>
              {selectedSubmission.emailSent && (
                <Chip label="Email sent" color="success" size="small" sx={{ mb: 2 }} />
              )}
              {selectedSubmission.emailError && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  Email error: {selectedSubmission.emailError}
                </Alert>
              )}
              <Table size="small">
                <TableBody>
                  {formData?.data?.fields?.map((field) => (
                    <TableRow key={field.name}>
                      <TableCell sx={{ fontWeight: 600, width: '30%' }}>
                        {field.label}
                      </TableCell>
                      <TableCell>
                        {selectedSubmission.data[field.name] !== undefined
                          ? String(selectedSubmission.data[field.name])
                          : '—'}
                      </TableCell>
                    </TableRow>
                  )) ??
                    Object.entries(selectedSubmission.data).map(([key, value]) => (
                      <TableRow key={key}>
                        <TableCell sx={{ fontWeight: 600, width: '30%' }}>
                          {key}
                        </TableCell>
                        <TableCell>{String(value)}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </DialogContent>
            <DialogActions>
              {selectedSubmission.status === 'UNREAD' && (
                <Button
                  onClick={() => {
                    updateStatusMutation.mutate({
                      submissionId: selectedSubmission.id,
                      status: 'READ',
                    });
                    setSelectedSubmission({ ...selectedSubmission, status: 'READ' });
                  }}
                >
                  Mark as Read
                </Button>
              )}
              {selectedSubmission.status !== 'ARCHIVED' && (
                <Button
                  onClick={() => {
                    updateStatusMutation.mutate({
                      submissionId: selectedSubmission.id,
                      status: 'ARCHIVED',
                    });
                    setSelectedSubmission({ ...selectedSubmission, status: 'ARCHIVED' });
                  }}
                >
                  Archive
                </Button>
              )}
              <Button onClick={() => setSelectedSubmission(null)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}
