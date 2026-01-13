import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Box,
  Button,
  Typography,
  LinearProgress,
  Alert,
  TextField,
  Paper,
} from '@mui/material';
import { CloudUpload } from '@mui/icons-material';
import { mediaService } from '../../services/media';

interface MediaUploadProps {
  onSuccess?: () => void;
}

export function MediaUpload({ onSuccess }: MediaUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [altText, setAltText] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [error, setError] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: (data: { file: File; metadata: any }) =>
      mediaService.upload(data.file, data.metadata),
    onSuccess: () => {
      setFile(null);
      setPreview(null);
      setAltText('');
      setDescription('');
      setTags('');
      setError(null);
      onSuccess?.();
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Failed to upload file');
    },
  });

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate file size (10MB max)
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    setFile(selectedFile);
    setError(null);

    // Generate preview for images
    if (selectedFile.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target?.result as string);
      };
      reader.readAsDataURL(selectedFile);
    } else {
      setPreview(null);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      // Create a fake event to reuse the file select handler
      const fakeEvent = {
        target: { files: [droppedFile] },
      } as React.ChangeEvent<HTMLInputElement>;
      handleFileSelect(fakeEvent);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const handleUpload = async () => {
    if (!file) return;

    const metadata = {
      altText: altText || undefined,
      description: description || undefined,
      tags: tags || undefined,
    };

    uploadMutation.mutate({ file, metadata });
  };

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {!file ? (
        <Paper
          variant="outlined"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          sx={{
            p: 4,
            textAlign: 'center',
            border: '2px dashed',
            borderColor: 'primary.main',
            backgroundColor: 'action.hover',
            cursor: 'pointer',
            '&:hover': {
              backgroundColor: 'action.selected',
            },
          }}
        >
          <input
            type="file"
            id="file-upload"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
            accept="image/*,application/pdf,.doc,.docx,video/*"
          />
          <label htmlFor="file-upload" style={{ cursor: 'pointer' }}>
            <CloudUpload sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Drop file here or click to upload
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Supported: Images, PDFs, Documents, Videos (Max 10MB)
            </Typography>
          </label>
        </Paper>
      ) : (
        <Box>
          {preview && (
            <Box sx={{ mb: 2, textAlign: 'center' }}>
              <img
                src={preview}
                alt="Preview"
                style={{ maxWidth: '100%', maxHeight: 300, objectFit: 'contain' }}
              />
            </Box>
          )}

          <Typography variant="body1" gutterBottom>
            <strong>Selected file:</strong> {file.name}
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Size: {(file.size / 1024 / 1024).toFixed(2)} MB
          </Typography>

          <TextField
            label="Alt Text"
            value={altText}
            onChange={(e) => setAltText(e.target.value)}
            fullWidth
            margin="normal"
            helperText="For accessibility (recommended for images)"
          />

          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            margin="normal"
            multiline
            rows={2}
          />

          <TextField
            label="Tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            fullWidth
            margin="normal"
            placeholder="e.g., product, banner, homepage"
            helperText="Comma-separated tags for organizing"
          />

          {uploadMutation.isPending && (
            <Box sx={{ mt: 2 }}>
              <LinearProgress />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Uploading...
              </Typography>
            </Box>
          )}

          <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleUpload}
              disabled={uploadMutation.isPending}
            >
              Upload
            </Button>
            <Button
              onClick={() => {
                setFile(null);
                setPreview(null);
                setError(null);
              }}
              disabled={uploadMutation.isPending}
            >
              Cancel
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
}
