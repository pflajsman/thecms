import { useState } from 'react';
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
  Tooltip,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  ContentCopy,
  Refresh,
} from '@mui/icons-material';
import { sitesService } from '../../services/sites';

export function SitesList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['sites'],
    queryFn: () => sitesService.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: sitesService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] });
    },
  });

  const rotateKeyMutation = useMutation({
    mutationFn: sitesService.rotateApiKey,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] });
    },
  });

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete site "${name}"? This cannot be undone.`)) {
      try {
        await deleteMutation.mutateAsync(id);
      } catch (error) {
        console.error('Failed to delete site:', error);
      }
    }
  };

  const handleRotateKey = async (id: string, name: string) => {
    if (
      confirm(
        `Are you sure you want to rotate the API key for "${name}"? The old key will stop working immediately.`
      )
    ) {
      try {
        await rotateKeyMutation.mutateAsync(id);
      } catch (error) {
        console.error('Failed to rotate API key:', error);
      }
    }
  };

  const copyApiKey = (apiKey: string, siteId: string) => {
    navigator.clipboard.writeText(apiKey);
    setCopiedKey(siteId);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const maskApiKey = (apiKey: string) => {
    if (!apiKey) return '';
    return `${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`;
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Typography variant="h4" component="h1">
          Sites & API Keys
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => navigate('/sites/new')}
        >
          Create Site
        </Button>
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        Sites represent consumer applications that can access your content via the Public API. Each
        site gets a unique API key for authentication.
      </Alert>

      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load sites. Please try again.
        </Alert>
      )}

      {data && (
        <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
          <Table sx={{ minWidth: 700 }}>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Domain</TableCell>
                <TableCell>API Key</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Requests</TableCell>
                <TableCell>Last Request</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                      No sites found. Create your first site to get an API key!
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                data.data.map((site) => (
                  <TableRow key={site.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">
                        {site.name}
                      </Typography>
                      {site.description && (
                        <Typography variant="caption" color="text.secondary">
                          {site.description}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {site.domain}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                          {maskApiKey(site.apiKey)}
                        </Typography>
                        <Tooltip title={copiedKey === site.id ? 'Copied!' : 'Copy API Key'}>
                          <IconButton
                            size="small"
                            onClick={() => copyApiKey(site.apiKey, site.id)}
                          >
                            <ContentCopy fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Rotate API Key">
                          <IconButton
                            size="small"
                            onClick={() => handleRotateKey(site.id, site.name)}
                          >
                            <Refresh fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={site.isActive ? 'Active' : 'Inactive'}
                        color={site.isActive ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{site.requestCount.toLocaleString()}</TableCell>
                    <TableCell>
                      {site.lastRequestAt
                        ? new Date(site.lastRequestAt).toLocaleString()
                        : 'Never'}
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => navigate(`/sites/${site.id}/edit`)}>
                        <Edit />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleDelete(site.id, site.name)}
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
