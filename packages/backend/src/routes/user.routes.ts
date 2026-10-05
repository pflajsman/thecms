import { Router, type IRouter } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { ProjectsService } from '../modules/projects/projects.service';

const router: IRouter = Router();

// The signed-in user and the projects they can open
router.get('/me', authMiddleware, async (req: AuthRequest, res, next) => {
  try {
    const user = req.user!;
    res.status(200).json({
      success: true,
      data: {
        entraId: user.entraId,
        email: user.email,
        displayName: user.displayName,
        isSuperadmin: user.isSuperadmin,
        projects: await ProjectsService.listForUser(user),
      },
    });
  } catch (error) {
    next(error);
  }
});

export { router as userRoutes };
