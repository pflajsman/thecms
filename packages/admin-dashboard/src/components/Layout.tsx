import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Button,
} from '@mui/material';
import {
  Menu as MenuIcon,
  SpaceDashboardOutlined,
  SchemaOutlined,
  EditNoteOutlined,
  PermMediaOutlined,
  ApiOutlined,
  DynamicFormOutlined,
  Logout,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { Logo } from './Logo';

const drawerWidth = 240;

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/', icon: <SpaceDashboardOutlined /> },
  { label: 'Content Types', path: '/content-types', icon: <SchemaOutlined /> },
  { label: 'Content Entries', path: '/entries', icon: <EditNoteOutlined /> },
  { label: 'Media Library', path: '/media', icon: <PermMediaOutlined /> },
  { label: 'Contact Forms', path: '/contact-forms', icon: <DynamicFormOutlined /> },
  { label: 'Sites & API Keys', path: '/sites', icon: <ApiOutlined /> },
];

const drawerStyles = {
  '& .MuiDrawer-paper': {
    boxSizing: 'border-box',
    width: drawerWidth,
    backgroundColor: '#000000',
    color: '#ffffff',
    borderRight: 'none',
  },
};

export function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, login, logout, isAuthenticated, isLoading } = useAuth();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleLogout = () => {
    logout();
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  if (!isAuthenticated) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', bgcolor: 'background.default' }}>
        <Box sx={{ textAlign: 'center' }}>
          <Logo size={64} />
          <Typography variant="h4" gutterBottom sx={{ mt: 2, fontWeight: 700 }}>TheCMS</Typography>
          <Typography variant="body1" sx={{ mb: 3 }} color="text.secondary">Sign in to access the admin dashboard</Typography>
          <Button variant="contained" size="large" onClick={login}>Sign In</Button>
        </Box>
      </Box>
    );
  }

  const drawer = (
    <Box>
      <Toolbar sx={{ gap: 1.5 }}>
        <Logo size={32} light />
        <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 700, color: '#ffffff' }}>
          TheCMS
        </Typography>
      </Toolbar>
      <List sx={{ px: 1 }}>
        {navItems.map((item) => {
          const selected = location.pathname === item.path;
          return (
            <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                selected={selected}
                onClick={() => {
                  navigate(item.path);
                  setMobileOpen(false);
                }}
                sx={{
                  borderRadius: 1,
                  color: selected ? '#000000' : '#ffffff',
                  backgroundColor: selected ? '#ffffff' : 'transparent',
                  '&:hover': {
                    backgroundColor: selected ? '#ffffff' : 'rgba(255,255,255,0.1)',
                  },
                  '&.Mui-selected': {
                    backgroundColor: '#ffffff',
                    '&:hover': {
                      backgroundColor: '#e0e0e0',
                    },
                  },
                }}
              >
                <ListItemIcon sx={{ color: selected ? '#000000' : '#ffffff', minWidth: 40 }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            Admin Dashboard
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" sx={{ display: { xs: 'none', sm: 'block' } }}>
              {user?.name}
            </Typography>
            <IconButton color="inherit" onClick={handleLogout} sx={{ display: { xs: 'flex', sm: 'none' } }}>
              <Logout />
            </IconButton>
            <Button
              color="inherit"
              onClick={handleLogout}
              startIcon={<Logout />}
              sx={{ display: { xs: 'none', sm: 'flex' } }}
            >
              Logout
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
      >
        {/* Mobile drawer */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true,
          }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            ...drawerStyles,
          }}
        >
          {drawer}
        </Drawer>

        {/* Desktop drawer */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            ...drawerStyles,
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          minWidth: 0,
        }}
      >
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}
