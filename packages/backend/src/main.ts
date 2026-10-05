import dotenv from 'dotenv';
import { app } from './app';
import { connectDatabase } from './config/database';
import { storageService } from './config/storage';
import { EmailService } from './services/email.service';
import { migrateProjects } from './utils/migrate-projects';
import { startUnpaidJob } from './modules/commerce/unpaid-job';

// Load environment variables
dotenv.config();

// Initialize email service
EmailService.initialize();

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Connect to database
    await connectDatabase();
    console.log('✅ Database connected successfully');

    // Projects: move data from before projects into "Default", then give every project its default
    // language and the system product model (idempotent).
    const migration = await migrateProjects();
    if (migration.createdDefault || migration.backfilled > 0) {
      console.log(
        `✅ Projects migrated (default created: ${migration.createdDefault}, documents: ${migration.backfilled}, memberships: ${migration.memberships})`
      );
    }

    // Hourly: cancel unpaid bank transfer orders older than the shop's limit.
    if (process.env.NODE_ENV !== 'test') startUnpaidJob();

    // Initialize blob storage
    await storageService.initialize();
    console.log('✅ Blob storage initialized successfully');

    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 API URL: http://localhost:${PORT}`);
      console.log(`💚 Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

startServer();
