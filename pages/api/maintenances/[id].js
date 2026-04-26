import { getDb } from "../../../lib/db";
import { requireAuth } from "../../../lib/auth";

export default async function handler(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;
  const db = getDb();
  const { id } = req.query;

  if (req.method === "PUT") {
    const fields = req.body;
    if (fields.status === "completed" && !fields.completed_at) fields.completed_at = new Date().toISOString();
    const sets = Object.keys(fields).map(k => `${k}=?`).join(",");
    const vals = [...Object.values(fields), id];
    await db.execute({ sql: `UPDATE maintenances SET ${sets}, updated_at=datetime('now') WHERE id=?`, args: vals });
    const updated = await db.execute({ sql: "SELECT * FROM maintenances WHERE id=?", args: [id] });
    return res.json(updated.rows[0]);
  }

  if (req.method === "DELETE") {
    await db.execute({ sql: "DELETE FROM maintenances WHERE id=?", args: [id] });
    return res.json({ success: true });
  }

  res.status(405).end();
}
