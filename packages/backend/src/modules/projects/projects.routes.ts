import { Router, type IRouter, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { authMiddleware, type AuthRequest } from '../../middleware/auth.middleware';
import { AppError } from '../../middleware/error.middleware';
import { projectMiddleware, requireProjectRole, type ProjectRequest } from '../../middleware/project.middleware';
import { validate } from '../../middleware/validation.middleware';
import { ProjectRole } from '../../models/project-member.model';
import { ProjectsService } from './projects.service';
import { MembersService, type Actor } from './members.service';
import { InvitationsService } from './invitations.service';

const role = z.nativeEnum(ProjectRole);
const language = z.enum(['en', 'cs']).default('en');
const name = z.string().trim().min(1).max(100);

const createProjectBody = z.object({ name, ownerEmail: z.string().trim().email().max(254), language });
const updateProjectBody = z.object({ name: name.optional(), status: z.enum(['active', 'archived']).optional() });
const inviteBody = z.object({ email: z.string().trim().email().max(254), role, language });
const resendBody = z.object({ language });
const roleBody = z.object({ role });
const renameBody = z.object({ name });

type Handler = (req: ProjectRequest, res: Response) => Promise<void>;
const handle = (fn: Handler) => (req: Request, res: Response, next: NextFunction) => fn(req as ProjectRequest, res).catch(next);

const actor = (req: ProjectRequest): Actor => ({ userId: req.user!.entraId, role: req.project!.role });
const projectId = (req: ProjectRequest) => req.project!.id;

const superadminOnly = (req: Request, _res: Response, next: NextFunction) =>
  (req as AuthRequest).user?.isSuperadmin ? next() : next(new AppError('Insufficient permissions', 403));

/** /projects: every project, for the superadmin. */
export const projectsRouter: IRouter = Router();
projectsRouter.use(authMiddleware, superadminOnly);

projectsRouter.get('/', handle(async (_req, res) => {
  res.json({ success: true, data: await ProjectsService.listAll() });
}));

projectsRouter.post('/', validate(z.object({ body: createProjectBody })), handle(async (req, res) => {
  const input = createProjectBody.parse(req.body);
  const project = await ProjectsService.create({ name: input.name, createdBy: req.user!.entraId });
  const invite = await InvitationsService.create(project.id, { userId: req.user!.entraId, role: ProjectRole.OWNER }, {
    email: input.ownerEmail,
    role: ProjectRole.OWNER,
    language: input.language,
  });
  res.status(201).json({ success: true, data: { project, ...invite } });
}));

projectsRouter.patch('/:id', validate(z.object({ body: updateProjectBody })), handle(async (req, res) => {
  res.json({ success: true, data: await ProjectsService.update(req.params.id, updateProjectBody.parse(req.body)) });
}));

/** /project: the current project (X-Project-Id). */
export const currentProjectRouter: IRouter = Router();
currentProjectRouter.use(authMiddleware, projectMiddleware);

currentProjectRouter.patch('/', requireProjectRole(ProjectRole.OWNER), validate(z.object({ body: renameBody })), handle(async (req, res) => {
  res.json({ success: true, data: await ProjectsService.update(projectId(req), renameBody.parse(req.body)) });
}));

/** /members: people in the current project. Leaving needs no admin role. */
export const membersRouter: IRouter = Router();
membersRouter.use(authMiddleware, projectMiddleware);

membersRouter.get('/', requireProjectRole(ProjectRole.ADMIN), handle(async (req, res) => {
  const [members, invitations] = await Promise.all([MembersService.list(projectId(req)), InvitationsService.list(projectId(req))]);
  res.json({ success: true, data: { members, invitations } });
}));

membersRouter.patch('/:userId', validate(z.object({ body: roleBody })), handle(async (req, res) => {
  await MembersService.changeRole(projectId(req), actor(req), req.params.userId, roleBody.parse(req.body).role);
  res.status(204).end();
}));

membersRouter.delete('/:userId', handle(async (req, res) => {
  await MembersService.remove(projectId(req), actor(req), req.params.userId);
  res.status(204).end();
}));

/** /invitations: open invitations of the current project. */
export const invitationsRouter: IRouter = Router();
invitationsRouter.use(authMiddleware, projectMiddleware, requireProjectRole(ProjectRole.ADMIN));

invitationsRouter.post('/', validate(z.object({ body: inviteBody })), handle(async (req, res) => {
  res.status(201).json({ success: true, data: await InvitationsService.create(projectId(req), actor(req), inviteBody.parse(req.body)) });
}));

invitationsRouter.post('/:id/resend', validate(z.object({ body: resendBody })), handle(async (req, res) => {
  res.json({ success: true, data: await InvitationsService.resend(projectId(req), actor(req), req.params.id, resendBody.parse(req.body).language) });
}));

invitationsRouter.delete('/:id', handle(async (req, res) => {
  await InvitationsService.revoke(projectId(req), actor(req), req.params.id);
  res.status(204).end();
}));

/** /invites/:token: the invite link, for any signed-in user; no project yet. */
export const invitesRouter: IRouter = Router();
invitesRouter.use(authMiddleware);

invitesRouter.get('/:token', handle(async (req, res) => {
  res.json({ success: true, data: await InvitationsService.preview(req.params.token) });
}));

invitesRouter.post('/:token/accept', handle(async (req, res) => {
  res.json({ success: true, data: await InvitationsService.accept(req.params.token, req.user!.entraId) });
}));
