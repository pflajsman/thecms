import { ProjectModel } from '../models/project.model';
import { ProjectMemberModel, ProjectRole } from '../models/project-member.model';
import { User } from '../models/user.model';
import { TokensService } from '../modules/tokens/tokens.service';
import { getTestDefaultProject } from '../utils/project-context';

/** The default test project as a real project document, for code that looks the project up. */
export async function testProject(): Promise<string> {
  const id = getTestDefaultProject()!;
  if (!(await ProjectModel.exists({ _id: id }))) await ProjectModel.create({ _id: id, name: 'Test', createdBy: 'test' });
  return String(id);
}

/** A user who is a member of the test project with the role, and a personal access token for it. */
export async function memberWithToken(entraId: string, role: ProjectRole, tokenName = 'Test'): Promise<string> {
  const projectId = await testProject();
  await User.create({ entraId, email: `${entraId}@test.cz` });
  await ProjectMemberModel.create({ projectId, userId: entraId, role });
  return (await TokensService.create(entraId, projectId, { name: tokenName })).token;
}
