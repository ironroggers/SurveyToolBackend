import mongoose from 'mongoose';
import { config } from './env.js';

export async function connectToDatabase() {
  const uri = config.mongoUri;
  if (!uri) {
    throw new Error('MONGO_URI not configured');
  }
  mongoose.set('strictQuery', false);
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
  });
}


