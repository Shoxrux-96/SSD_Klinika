import { Pool, types } from 'pg';
import 'dotenv/config';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL env var is required. See server/.env.example');
}

// BIGINT (OID 20) ni JS number sifatida qaytar (default pg uni string qaytaradi).
types.setTypeParser(20, (v) => (v === null ? null : Number(v)));

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
