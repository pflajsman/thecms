import { Response, NextFunction } from 'express';
import { isValidObjectId } from 'mongoose';
import { AppError } from './error.middleware';
import { AuthRequest } from './auth.middleware';
import { ProjectModel } from '../models/project.model';
import { ProjectMemberModel, ProjectRole, hasRole } from '../models/project-member.model';
import { runInProject } from '../utils/project-context';

export const PROJECT_HEADER = 'x-project-id';

export interface ProjectRequest extends AuthRequest {
  project?: { id: string; role: ProjectRole };
}

/**
 * After authMiddleware: resolves the project from X-Project-Id and the caller's role in it, then runs the rest
 * of the request inside that project so every tenant query is scoped. A superadmin acts as Owner everywhere.
 */
export const projectMiddleware = async (req: ProjectRequest, _res: Response, next: NextFunction) => {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const projectId = req.header(PROJECT_HEADER);
    if (!projectId) throw new AppError('Choose a project', 400, { reason: 'PROJECT_REQUIRED' });
    if (!isValidObjectId(projectId)) throw new AppError('You have no access to this project', 403, { reason: 'NO_PROJECT_ACCESS' });

    const [project, member] = await Promise.all([
      ProjectModel.findById(projectId).lean(),
      req.user.isSuperadmin ? null : ProjectMemberModel.findOne({ projectId, userId: req.user.entraId }).lean(),
    ]);
    const role = req.user.isSuperadmin ? ProjectRole.OWNER : member?.role;
    if (!project || !role || (project.status !== 'active' && !req.user.isSuperadmin)) {
      throw new AppError('You have no access to this project', 403, { reason: 'NO_PROJECT_ACCESS' });
    }

    req.project = { id: String(project._id), role };
    runInProject(project._id, () => next());
  } catch (error) {
    next(error);
  }
};

/** Refuses callers whose role in the current project is below minimum. */
export const requireProjectRole = (minimum: ProjectRole) => (req: ProjectRequest, _res: Response, next: NextFunction) => {
  if (!req.project) return next(new AppError('Choose a project', 400, { reason: 'PROJECT_REQUIRED' }));
  if (!hasRole(req.project.role, minimum)) return next(new AppError('Insufficient permissions', 403));
  next();
};
