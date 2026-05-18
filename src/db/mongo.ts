import mongoose from "mongoose";

import { HttpError } from "../errors/http-error";

let connectionPromise: Promise<typeof mongoose> | null = null;

export async function ensureMongoConnected(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  const uri = process.env.MONGODB_URI ?? process.env.MONGO_URI;
  if (!uri?.trim()) {
    throw new HttpError(500, "MongoDB connection is required for tracked Apigee config operations");
  }

  if (!connectionPromise) {
    connectionPromise = mongoose.connect(uri.trim(), {
      dbName: process.env.MONGODB_DB_NAME || undefined,
    });
  }

  try {
    return await connectionPromise;
  } catch (error) {
    connectionPromise = null;
    throw error;
  }
}
