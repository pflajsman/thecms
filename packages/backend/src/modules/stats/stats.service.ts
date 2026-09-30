import { ContentEntryModel, ContentStatus } from '../../models/content-entry.model';
import { ContentTypeModel } from '../../models/content-type.model';
import { MediaModel } from '../../models/media.model';
import { SiteModel } from '../../models/site.model';
import { FormSubmissionModel, SubmissionStatus } from '../../models/form-submission.model';

export interface DashboardStats {
  entries: { total: number; draft: number; published: number; archived: number; byType: Record<string, number> };
  contentTypes: number;
  media: number;
  sites: number;
  submissions: { unread: number };
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const [byStatus, byTypeRows, itemIds, contentTypes, media, sites, unread] = await Promise.all([
    // Status counts count language versions.
    ContentEntryModel.aggregate<{ _id: ContentStatus; count: number }>([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    // Totals count items: one per itemId, however many language versions it has.
    ContentEntryModel.aggregate<{ _id: unknown; count: number }>([
      { $group: { _id: { type: '$contentTypeId', item: '$itemId' } } },
      { $group: { _id: '$_id.type', count: { $sum: 1 } } },
    ]),
    ContentEntryModel.distinct('itemId'),
    ContentTypeModel.countDocuments(),
    MediaModel.countDocuments(),
    SiteModel.countDocuments(),
    FormSubmissionModel.countDocuments({ status: SubmissionStatus.UNREAD }),
  ]);

  const count = (status: ContentStatus) => byStatus.find((s) => s._id === status)?.count ?? 0;
  const draft = count(ContentStatus.DRAFT);
  const published = count(ContentStatus.PUBLISHED);
  const archived = count(ContentStatus.ARCHIVED);

  return {
    entries: {
      total: itemIds.length,
      draft,
      published,
      archived,
      byType: Object.fromEntries(byTypeRows.map((r) => [String(r._id), r.count])),
    },
    contentTypes,
    media,
    sites,
    submissions: { unread },
  };
}
