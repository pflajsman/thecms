/**
 * Move data from before projects into the Default project, then create every project's default content
 * language and assign existing entries to it. Also runs at backend startup; safe to run repeatedly.
 * Run with: pnpm --filter @thecms/backend migrate:languages
 */
import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { migrateProjects } from '../utils/migrate-projects';

async function main(): Promise<void> {
  dotenv.config();
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('MONGODB_URI environment variable is not defined');

  await mongoose.connect(mongoUri);
  const { createdDefault, backfilled, memberships } = await migrateProjects();
  console.log(`Projects: default created: ${createdDefault}, documents: ${backfilled}, memberships: ${memberships}`);
  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}
