/**
 * Create the default content language and assign existing entries to it.
 * Also runs at backend startup; safe to run repeatedly.
 * Run with: pnpm --filter @thecms/backend migrate:languages
 */
import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import { migrateLanguages } from '../utils/migrate-languages';

async function main(): Promise<void> {
  dotenv.config();
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('MONGODB_URI environment variable is not defined');

  await mongoose.connect(mongoUri);
  const { createdDefault, migratedEntries } = await migrateLanguages();
  console.log(`Content languages: default created: ${createdDefault}, entries migrated: ${migratedEntries}`);
  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}
