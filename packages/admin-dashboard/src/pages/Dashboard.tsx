import { Box, Typography, Paper, Grid, Card, CardActionArea, CardContent } from '@mui/material';
import {
  SchemaOutlined,
  EditNoteOutlined,
  PermMediaOutlined,
  ContactMailOutlined,
  KeyOutlined,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const tiles = [
  {
    title: 'Content Types',
    description: 'Manage content models',
    icon: SchemaOutlined,
    to: '/content-types',
  },
  {
    title: 'Content Entries',
    description: 'Manage your content',
    icon: EditNoteOutlined,
    to: '/entries',
  },
  {
    title: 'Media Library',
    description: 'Manage images & files',
    icon: PermMediaOutlined,
    to: '/media',
  },
  {
    title: 'Contact Forms',
    description: 'Forms & submissions',
    icon: ContactMailOutlined,
    to: '/contact-forms',
  },
  {
    title: 'Sites',
    description: 'API keys & access',
    icon: KeyOutlined,
    to: '/sites',
  },
];

export function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Dashboard
      </Typography>

      <Grid container spacing={3}>
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <Grid key={tile.to} size={{ xs: 12, sm: 6, md: 3 }}>
              <Card>
                <CardActionArea onClick={() => navigate(tile.to)}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Icon sx={{ fontSize: 40 }} />
                      <Box>
                        <Typography variant="h6">{tile.title}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {tile.description}
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      <Paper sx={{ mt: 4, p: 3 }}>
        <Typography variant="h5" gutterBottom>
          Welcome to TheCMS Admin Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          This is a headless CMS built with Node.js, Express, MongoDB, and React. Use the sidebar
          to navigate between different sections.
        </Typography>
        {user && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Current user: {user.name || 'Unknown'}
            {user.email ? ` (${user.email})` : ''}
          </Typography>
        )}
      </Paper>
    </Box>
  );
}
