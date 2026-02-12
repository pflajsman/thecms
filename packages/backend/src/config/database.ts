import mongoose from 'mongoose';

export async function connectDatabase(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error('MONGODB_URI environment variable is not defined');
  }

  try {
    await mongoose.connect(mongoUri);

    // Connection event handlers
    mongoose.connection.on('connected', () => {
      console.log('📦 Mongoose connected to database');
    });

    mongoose.connection.on('error', (err) => {
      console.error('❌ Mongoose connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('📦 Mongoose disconnected from database');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('📦 Mongoose connection closed due to app termination');
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Failed to connect to database:', error);
    throw error;
  }
}

export { mongoose };
