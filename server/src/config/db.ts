import mongoose from 'mongoose';
import { env } from './env';

export async function connectDB(): Promise<void> {
  try {
    mongoose.set('strictQuery', true); // reject unknown query fields -> reduces injection/mass-assignment surface

    await mongoose.connect(env.mongoUri, {
      autoIndex: env.nodeEnv !== 'production', // avoid rebuilding indexes on every prod boot
    });

    console.log('[db] MongoDB connected');

    mongoose.connection.on('error', (err) => {
      console.error('[db] MongoDB connection error:', err);
    });
  } catch (err) {
    console.error('[db] Failed to connect to MongoDB:', err);
    process.exit(1);
  }
}
