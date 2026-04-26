import { requireAuth } from "../../../lib/auth";
import { getDb } from "../../../lib/db";

export default async function handler(req, res) {
  const payload = await requireAuth(req, res);
  if (!payload) return;
  const db = getDb();
  const result = await db.execute({ sql: "SELECT id,full_name,email,role FROM users WHERE id=?", args: [payload.id] });
  if (!result.rows[0]) return res.status(404).json({ error: "Utilisateur introuvable" });
  res.json(result.rows[0]);
}
