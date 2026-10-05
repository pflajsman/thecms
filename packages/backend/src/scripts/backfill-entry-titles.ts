/**
 * Backfill ContentEntry.title for all entries.
 * Run with: pnpm --filter @thecms/backend backfill:titles
 */
import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { ContentTypeModel } from '../models/content-type.model';
import { recomputeTitlesForType } from '../modules/content-entries/entry-titles.service';
import { withoutProject } from '../utils/project-context';

/** Every project at once: entries are found by their content type, which belongs to one project. */
export async function backfillEntryTitles(): Promise<{ types: number; updated: number }> {
  return withoutProject(async () => {
    const types = await ContentTypeModel.find().select('_id fields titleField').lean();
    let updated = 0;
    for (const type of types) {
      updated += await recomputeTitlesForType(type);
    }
    return { types: types.length, updated };
  });
}

async function main(): Promise<void> {
  dotenv.config();
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('MONGODB_URI environment variable is not defined');

  await mongoose.connect(mongoUri);
  const { types, updated } = await backfillEntryTitles();
  console.log(`Backfilled titles: ${updated} entries across ${types} content types`);
  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
  });
}
