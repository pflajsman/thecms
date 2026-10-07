import { Response, NextFunction, RequestHandler } from 'express';
import { isValidObjectId } from 'mongoose';
import { AppError } from './error.middleware';
import { AuthRequest } from './auth.middleware';
import { ProjectModel } from '../models/project.model';
import { ProjectMemberModel, ProjectRole, hasRole } from '../models/project-member.model';
import { UserRole } from '../models/user.model';
import { getTestDefaultProject, runInProject } from '../utils/project-context';

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
    const projectId = req.header(PROJECT_HEADER);
    const testProject = getTestDefaultProject();
    if (!projectId && testProject) {
      // Tests written before projects: run in the default test project with the user's old global role
      // (no user at all, as with a bare auth mock, means no restriction, as before projects).
      const role = !req.user || req.user.isSuperadmin ? ProjectRole.OWNER : legacyRole(req.user.role);
      req.project = { id: String(testProject), role };
      return runInProject(testProject, () => next());
    }
    if (!req.user) throw new AppError('Authentication required', 401);
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

const legacyRole = (role: UserRole) =>
  role === UserRole.ADMIN ? ProjectRole.ADMIN : role === UserRole.EDITOR ? ProjectRole.EDITOR : ProjectRole.VIEWER;

/** Refuses callers whose role in the current project is below minimum. */
export const requireProjectRole = (minimum: ProjectRole) => (req: ProjectRequest, _res: Response, next: NextFunction) => {
  if (!req.project) return next(new AppError('Choose a project', 400, { reason: 'PROJECT_REQUIRED' }));
  if (!hasRole(req.project.role, minimum)) return next(new AppError('Insufficient permissions', 403));
  next();
};

const READS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Router-wide: reads are open to every member, anything else needs minimum. */
export const writesNeed = (minimum: ProjectRole) => (req: ProjectRequest, res: Response, next: NextFunction) =>
  READS.has(req.method) ? next() : requireProjectRole(minimum)(req, res, next);

/**
 * Wraps a middleware that calls next from stream events, such as multer: a large body arrives over several socket
 * events, which run outside the project context, so the rest of the request is put back inside the project.
 */
export const inProject =
  (middleware: RequestHandler) =>
  (req: ProjectRequest, res: Response, next: NextFunction): void =>
    middleware(req, res, (err?: unknown) => {
      if (!req.project) return next(err);
      runInProject(req.project.id, () => next(err));
    });
