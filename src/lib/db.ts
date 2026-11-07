import { neon } from "@neondatabase/serverless";
import { ownerEmail } from "./auth";

let _sql: ReturnType<typeof neon> | null = null;

export function sql() {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    _sql = neon(url);
  }
  return _sql;
}

let schemaReady: Promise<void> | null = null;

/** Creates tables on first use. Safe to call on every request. */
export function ensureSchema() {
  if (!schemaReady) {
    const db = sql();
    schemaReady = (async () => {
      await db`CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        role TEXT NOT NULL CHECK (role IN ('user','assistant')),
        content TEXT NOT NULL DEFAULT '',
        image_url TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      await db`CREATE TABLE IF NOT EXISTS meals (
        id SERIAL PRIMARY KEY,
        eaten_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        description TEXT NOT NULL,
        location_type TEXT NOT NULL DEFAULT 'home' CHECK (location_type IN ('home','outside')),
        place TEXT,
        amount_spent NUMERIC(10,2),
        currency TEXT,
        photo_url TEXT,
        items JSONB NOT NULL DEFAULT '[]',
        calories NUMERIC,
        protein_g NUMERIC,
        carbs_g NUMERIC,
        fat_g NUMERIC,
        fiber_g NUMERIC,
        sugar_g NUMERIC,
        micros JSONB NOT NULL DEFAULT '{}',
        message_id INTEGER REFERENCES messages(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      await db`CREATE TABLE IF NOT EXISTS symptoms (
        id SERIAL PRIMARY KEY,
        occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        kind TEXT NOT NULL,
        severity INTEGER CHECK (severity BETWEEN 1 AND 5),
        notes TEXT,
        message_id INTEGER REFERENCES messages(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`;
      await db`CREATE INDEX IF NOT EXISTS meals_eaten_at_idx ON meals (eaten_at)`;
      await db`CREATE INDEX IF NOT EXISTS symptoms_occurred_at_idx ON symptoms (occurred_at)`;
      // Cards shown under an assistant reply (meals/symptoms it logged).
      await db`ALTER TABLE messages ADD COLUMN IF NOT EXISTS meta JSONB`;
      // Per-user data: every row belongs to one signed-in email.
      // Rows from before multi-user sign-in belong to the owner.
      for (const table of ["messages", "meals", "symptoms"]) {
        await db.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS user_email TEXT`);
        await db.query(`UPDATE ${table} SET user_email = $1 WHERE user_email IS NULL`, [ownerEmail()]);
        await db.query(`ALTER TABLE ${table} ALTER COLUMN user_email SET NOT NULL`);
      }
      await db`CREATE INDEX IF NOT EXISTS messages_user_idx ON messages (user_email, created_at)`;
      await db`CREATE INDEX IF NOT EXISTS meals_user_eaten_at_idx ON meals (user_email, eaten_at)`;
      await db`CREATE INDEX IF NOT EXISTS symptoms_user_occurred_at_idx ON symptoms (user_email, occurred_at)`;
    })().catch((e) => {
      schemaReady = null;
      throw e;
    });
  }
  return schemaReady;
}

export type Message = {
  id: number;
  role: "user" | "assistant";
  content: string;
  image_url: string | null;
  meta: MessageMeta | null;
  created_at: string;
};

export type MealCard = {
  id: number;
  description: string;
  location_type: string;
  place: string | null;
  amount_spent: number | null;
  currency: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  deleted?: boolean;
};

export type SymptomCard = { id: number; kind: string; severity: number | null };

export type MessageMeta = { meals?: MealCard[]; symptoms?: SymptomCard[] };
