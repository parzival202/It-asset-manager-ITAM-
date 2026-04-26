import { getDb } from "../../../../lib/db";
import { requireAuth } from "../../../../lib/auth";

export default async function handler(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;
  if (req.method !== "PUT") return res.status(405).end();
  const db = getDb();
  await db.execute({ sql: "UPDATE alerts SET status='read' WHERE id=?", args: [req.query.id] });
  res.json({ success: true });
}
