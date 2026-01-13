/**
 * Script to sync MongoDB indexes
 * Run with: pnpm tsx src/scripts/sync-indexes.ts
 */
import mongoose from 'mongoose';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import all models to register them
import '../models/user.model';
import '../models/content-type.model';
import '../models/content-entry.model';
import '../models/media.model';
import '../models/site.model';

async function syncIndexes() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI environment variable is not defined');
    }

    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    console.log('\n🔄 Syncing indexes for all models...');

    const models = Object.keys(mongoose.models);

    for (const modelName of models) {
      const model = mongoose.model(modelName);
      console.log(`\n📝 Syncing indexes for ${modelName}...`);

      try {
        // Special handling for ContentEntry text index
        if (modelName === 'ContentEntry') {
          console.log('   Creating text index on data field...');
          try {
            // Use MongoDB's text index on the entire data object
            await model.collection.createIndex(
              { data: 'text' },
              { name: 'data_text_search', weights: { data: 1 } }
            );
            console.log('   ✅ Text index created successfully');
          } catch (error: any) {
            if (error.code === 85 || error.code === 86) {
              console.log('   ℹ️  Text index already exists or index with same name exists');
            } else {
              console.log(`   ⚠️  Text index creation warning: ${error.message}`);
            }
          }
        }

        await model.syncIndexes();
        const indexes = await model.listIndexes();
        console.log(`✅ ${modelName}: ${indexes.length} indexes created`);
        indexes.forEach((index: any) => {
          console.log(`   - ${JSON.stringify(index.key)}`);
        });
      } catch (error: any) {
        console.error(`❌ Failed to sync indexes for ${modelName}:`, error.message);
      }
    }

    console.log('\n✅ All indexes synced successfully!');
    await mongoose.connection.close();
    console.log('👋 Disconnected from MongoDB');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error syncing indexes:', error);
    process.exit(1);
  }
}

syncIndexes();
