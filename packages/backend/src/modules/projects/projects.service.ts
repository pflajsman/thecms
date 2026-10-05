import { Types } from 'mongoose';
import { AppError } from '../../middleware/error.middleware';
import { ProjectModel, type IProject, type ProjectStatus } from '../../models/project.model';
import { ProjectMemberModel, ProjectRole } from '../../models/project-member.model';

export interface ProjectSummary {
  id: string;
  name: string;
  status: ProjectStatus;
  createdAt: Date;
}

export interface MyProject {
  id: string;
  name: string;
  role: ProjectRole;
}

const toSummary = (p: Pick<IProject, '_id' | 'name' | 'status' | 'createdAt'>): ProjectSummary => ({
  id: String(p._id),
  name: p.name,
  status: p.status,
  createdAt: p.createdAt,
});

const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name);

export const ProjectsService = {
  /** Every project with its member count, for the superadmin. Sorted here: Cosmos DB needs an index for every sort. */
  async listAll(): Promise<(ProjectSummary & { memberCount: number })[]> {
    const [projects, members] = await Promise.all([
      ProjectModel.find().lean(),
      ProjectMemberModel.find({}, { projectId: 1 }).lean(),
    ]);
    const counts = new Map<string, number>();
    for (const m of members) counts.set(String(m.projectId), (counts.get(String(m.projectId)) ?? 0) + 1);
    return projects.map((p) => ({ ...toSummary(p), memberCount: counts.get(String(p._id)) ?? 0 })).sort(byName);
  },

  /** The active projects the user can open, with their role; a superadmin gets every active project as Owner. */
  async listForUser(user: { entraId: string; isSuperadmin: boolean }): Promise<MyProject[]> {
    if (user.isSuperadmin) {
      const projects = await ProjectModel.find({ status: 'active' }).lean();
      return projects.map((p) => ({ id: String(p._id), name: p.name, role: ProjectRole.OWNER })).sort(byName);
    }
    const memberships = await ProjectMemberModel.find({ userId: user.entraId }).lean();
    if (memberships.length === 0) return [];
    const projects = await ProjectModel.find({ _id: { $in: memberships.map((m) => m.projectId) }, status: 'active' }).lean();
    const roles = new Map(memberships.map((m) => [String(m.projectId), m.role]));
    return projects.map((p) => ({ id: String(p._id), name: p.name, role: roles.get(String(p._id))! })).sort(byName);
  },

  async get(id: string): Promise<IProject> {
    const project = Types.ObjectId.isValid(id) ? await ProjectModel.findById(id) : null;
    if (!project) throw new AppError('Project not found', 404);
    return project;
  },

  async create(input: { name: string; createdBy: string }): Promise<ProjectSummary> {
    const project = await ProjectModel.create({ name: input.name, createdBy: input.createdBy });
    return toSummary(project);
  },

  async update(id: string, input: { name?: string; status?: ProjectStatus }): Promise<ProjectSummary> {
    const project = await ProjectsService.get(id);
    if (input.name !== undefined) project.name = input.name;
    if (input.status !== undefined) project.status = input.status;
    await project.save();
    return toSummary(project);
  },
};
