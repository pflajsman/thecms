import { Router, type IRouter, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';

const router: IRouter = Router();

// Get current user profile
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    res.status(200).json({
      success: true,
      data: {
        entraId: req.user?.entraId,
        email: req.user?.email,
        displayName: req.user?.displayName,
        role: req.user?.role
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user profile'
    });
  }
});

export { router as userRoutes };
