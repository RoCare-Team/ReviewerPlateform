import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

// Cached across hot reloads in dev — without this, every file change opens a
// new connection pool and Mongo starts refusing connections.
let cached = global._mongoose;
if (!cached) cached = global._mongoose = { conn: null, promise: null };

export default async function dbConnect() {
  if (cached.conn) return cached.conn;

  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not set. Add it to .env.local");
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    // Reset so the next request retries instead of awaiting a rejected promise forever.
    cached.promise = null;
    throw err;
  }

  return cached.conn;
}
