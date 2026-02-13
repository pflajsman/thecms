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
  Divider,
} from '@mui/material';
import { Save, ArrowBack } from '@mui/icons-material';
import { contactFormsService } from '../../services/contactForms';
import { FormFieldBuilder } from './FormFieldBuilder';
import type { FormFieldDefinition } from '../../types';

export function ContactFormForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditMode = !!id;

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [fields, setFields] = useState<FormFieldDefinition[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  const { data: formData, isLoading } = useQuery({
    queryKey: ['contactForm', id],
    queryFn: () => contactFormsService.getById(id!),
    enabled: isEditMode,
  });

  useEffect(() => {
    if (formData?.data) {
      setName(formData.data.name);
      setSlug(formData.data.slug);
      setDescription(formData.data.description || '');
      setRecipientEmail(formData.data.recipientEmail);
      setIsActive(formData.data.isActive);
      setFields(formData.data.fields);
      setSlugManuallyEdited(true);
    }
  }, [formData]);

  const generateSlug = (value: string) => {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const handleNameChange = (value: string) => {
    setName(value);
    if (!slugManuallyEdited) {
      setSlug(generateSlug(value));
    }
  };

  const createMutation = useMutation({
    mutationFn: contactFormsService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contactForms'] });
      navigate('/contact-forms');
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Failed to create contact form');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => contactFormsService.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contactForms'] });
      queryClient.invalidateQueries({ queryKey: ['contactForm', id] });
      navigate('/contact-forms');
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Failed to update contact form');
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (fields.length === 0) {
      setError('At least one field is required');
      return;
    }

    const data = {
      name,
      slug,
      description,
      recipientEmail,
      fields,
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
      <Button startIcon={<ArrowBack />} onClick={() => navigate('/contact-forms')} sx={{ mb: 2 }}>
        Back to Contact Forms
      </Button>

      <Paper sx={{ p: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {isEditMode ? 'Edit Contact Form' : 'Create Contact Form'}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit}>
          <TextField
            label="Form Name"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            required
            fullWidth
            margin="normal"
            helperText="Display name for this form (e.g., 'Contact Us')"
          />

          <TextField
            label="Slug"
            value={slug}
            onChange={(e) => {
              setSlug(generateSlug(e.target.value));
              setSlugManuallyEdited(true);
            }}
            required
            fullWidth
            margin="normal"
            helperText="URL-friendly identifier (e.g., 'contact-us')"
          />

          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            margin="normal"
            multiline
            rows={2}
            helperText="Optional description of this form"
          />

          <TextField
            label="Recipient Email"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            required
            fullWidth
            margin="normal"
            type="email"
            helperText="Email address to receive form submissions"
          />

          {isEditMode && (
            <FormControlLabel
              control={<Switch checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />}
              label="Active"
              sx={{ mt: 2 }}
            />
          )}

          <Divider sx={{ my: 3 }} />

          <Typography variant="h5" gutterBottom>
            Form Fields
          </Typography>

          <FormFieldBuilder fields={fields} onChange={setFields} />

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
            <Button onClick={() => navigate('/contact-forms')}>Cancel</Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}
