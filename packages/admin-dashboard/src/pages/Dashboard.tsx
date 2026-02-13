import { Box, Typography, Paper, Grid, Card, CardContent } from '@mui/material';
import { SchemaOutlined, EditNoteOutlined, PermMediaOutlined, KeyOutlined } from '@mui/icons-material';

export function Dashboard() {
  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Dashboard
      </Typography>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <SchemaOutlined sx={{ fontSize: 40 }} />
                <Box>
                  <Typography variant="h6">Content Types</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Manage content models
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <EditNoteOutlined sx={{ fontSize: 40 }} />
                <Box>
                  <Typography variant="h6">Content Entries</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Manage your content
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <PermMediaOutlined sx={{ fontSize: 40 }} />
                <Box>
                  <Typography variant="h6">Media Library</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Manage images & files
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <KeyOutlined sx={{ fontSize: 40 }} />
                <Box>
                  <Typography variant="h6">Sites</Typography>
                  <Typography variant="body2" color="text.secondary">
                    API keys & access
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Paper sx={{ mt: 4, p: 3 }}>
        <Typography variant="h5" gutterBottom>
          Welcome to TheCMS Admin Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          This is a headless CMS built with Node.js, Express, MongoDB, and React. Use the sidebar
          to navigate between different sections.
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Current user: Admin User (admin@example.com)
        </Typography>
      </Paper>
    </Box>
  );
}
