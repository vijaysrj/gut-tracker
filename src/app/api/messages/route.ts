import { NextResponse } from "next/server";
import { ensureSchema, sql, type Message } from "@/lib/db";

export async function GET() {
  await ensureSchema();
  const rows = (await sql()`
    SELECT * FROM (
      SELECT id, role, content, image_url, created_at FROM messages
      ORDER BY created_at DESC LIMIT 200
    ) t ORDER BY created_at ASC
  `) as Message[];
  return NextResponse.json({ messages: rows });
}

export async function POST(req: Request) {
  await ensureSchema();
  const body = await req.json().catch(() => ({}));
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) return NextResponse.json({ error: "empty message" }, { status: 400 });
  if (content.length > 4000) return NextResponse.json({ error: "too long" }, { status: 400 });

  const db = sql();
  const [user] = (await db`
    INSERT INTO messages (role, content) VALUES ('user', ${content})
    RETURNING id, role, content, image_url, created_at
  `) as Message[];

  // Step 1 placeholder. Step 2 replaces this with Claude parsing the message
  // into meals / symptoms and replying with what it logged.
  const replyText =
    "Saved your note. Automatic meal and symptom logging is coming in the next update.";
  const [assistant] = (await db`
    INSERT INTO messages (role, content) VALUES ('assistant', ${replyText})
    RETURNING id, role, content, image_url, created_at
  `) as Message[];

  return NextResponse.json({ messages: [user, assistant] });
}
