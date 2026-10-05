import { ensureProductModel } from '../modules/commerce/product-model';
import { seedLanguages } from './migrate-languages';
import { runInProject } from './project-context';

/** Idempotent: what every project starts with, the English default language and the system product model. */
export async function seedProject(projectId: string): Promise<void> {
  await runInProject(projectId, async () => {
    await seedLanguages();
    await ensureProductModel();
  });
}
