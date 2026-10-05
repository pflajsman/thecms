import { Types, type Model } from 'mongoose';
import { ProjectModel } from '../models/project.model';
import { ProjectMemberModel, ProjectRole } from '../models/project-member.model';
import { User, UserRole } from '../models/user.model';
import { AccessTokenModel } from '../models/access-token.model';
import { ContentTypeModel } from '../models/content-type.model';
import { ContentEntryModel } from '../models/content-entry.model';
import { LanguageModel } from '../models/language.model';
import { MediaModel } from '../models/media.model';
import { SiteModel } from '../models/site.model';
import { WebhookModel } from '../models/webhook.model';
import { ContactFormModel } from '../models/contact-form.model';
import { FormSubmissionModel } from '../models/form-submission.model';
import { ProductModel } from '../models/product.model';
import { VariantModel } from '../models/variant.model';
import { ShippingMethodModel, ShippingZoneModel } from '../models/shipping.model';
import { OrderModel } from '../models/order.model';
import { DownloadGrantModel } from '../models/download-grant.model';
import { ShopSettingsModel } from '../models/shop-settings.model';
import { AiSettingsModel } from '../models/ai-settings.model';
import { prepareLanguageIndexes } from './migrate-languages';
import { seedProject } from './seed-project';
import { withoutProject } from './project-context';

/** The project that holds everything created before projects existed. A fixed id, so two instances agree. */
export const DEFAULT_PROJECT_ID = new Types.ObjectId('000000000000000000000001');

export const TENANT_MODELS: Model<any>[] = [
  ContentTypeModel, ContentEntryModel, LanguageModel, MediaModel, SiteModel, WebhookModel, ContactFormModel,
  FormSubmissionModel, ProductModel, VariantModel, ShippingZoneModel, ShippingMethodModel, OrderModel,
  DownloadGrantModel, ShopSettingsModel, AiSettingsModel,
];

/** Global unique indexes from before projects; uniqueness is now per project and checked in the services. */
const OLD_UNIQUE_INDEXES: [Model<any>, string][] = [
  [ContentTypeModel, 'slug_1'],
  [ContactFormModel, 'slug_1'],
  [LanguageModel, 'code_1'],
  [VariantModel, 'sku_1'],
];

const DUPLICATE_KEY = 11000;
const NAMESPACE_NOT_FOUND = 26;
const INDEX_NOT_FOUND = 27;

const OLD_ROLES: Record<UserRole, ProjectRole> = {
  [UserRole.ADMIN]: ProjectRole.OWNER,
  [UserRole.EDITOR]: ProjectRole.EDITOR,
  [UserRole.VIEWER]: ProjectRole.VIEWER,
};

export interface ProjectsMigration {
  createdDefault: boolean;
  backfilled: number;
  memberships: number;
}

async function dropOldUniqueIndexes(): Promise<void> {
  for (const [model, name] of OLD_UNIQUE_INDEXES) {
    try {
      await model.collection.dropIndex(name);
    } catch (error) {
      const code = (error as { code?: number }).code;
      if (code !== NAMESPACE_NOT_FOUND && code !== INDEX_NOT_FOUND) throw error;
    }
  }
}

/**
 * Idempotent, at startup: moves data from before projects into the Default project, gives existing users a
 * membership there from their old global role, and seeds every project. On an install with projects already,
 * only the seeding runs.
 */
export async function migrateProjects(): Promise<ProjectsMigration> {
  await prepareLanguageIndexes();
  await dropOldUniqueIndexes();

  const result = await withoutProject(async (): Promise<ProjectsMigration> => {
    let createdDefault = false;
    let backfilled = 0;
    let memberships = 0;

    const legacy = (
      await Promise.all(TENANT_MODELS.map((m) => m.countDocuments({ projectId: { $exists: false } })))
    ).reduce((a, b) => a + b, 0);
    const legacyTokens = await AccessTokenModel.countDocuments({ projectId: { $exists: false } });

    if (!(await ProjectModel.exists({ _id: DEFAULT_PROJECT_ID })) && ((await ProjectModel.countDocuments()) === 0 || legacy > 0)) {
      // Users from before projects get a membership from their old role. Done before Default exists, and only
      // then: users who sign in later get nothing, and later role changes are never overwritten.
      for (const user of await User.find().lean()) {
        try {
          await ProjectMemberModel.create({ projectId: DEFAULT_PROJECT_ID, userId: user.entraId, role: OLD_ROLES[user.role] ?? ProjectRole.VIEWER });
          memberships += 1;
        } catch (error) {
          if ((error as { code?: number }).code !== DUPLICATE_KEY) throw error;
        }
      }
      try {
        await ProjectModel.create({ _id: DEFAULT_PROJECT_ID, name: 'Default', createdBy: 'system' });
        createdDefault = true;
      } catch (error) {
        if ((error as { code?: number }).code !== DUPLICATE_KEY) throw error;
      }
    }

    if (legacy > 0 || legacyTokens > 0) {
      for (const model of TENANT_MODELS) {
        const updated = await model.updateMany({ projectId: { $exists: false } }, { $set: { projectId: DEFAULT_PROJECT_ID } });
        backfilled += updated.modifiedCount;
      }
      await AccessTokenModel.updateMany({ projectId: { $exists: false } }, { $set: { projectId: DEFAULT_PROJECT_ID } });
    }

    return { createdDefault, backfilled, memberships };
  });

  const projects = await ProjectModel.find().select('_id').lean();
  for (const project of projects) await seedProject(String(project._id));
  return result;
}
