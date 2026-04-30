import { getDb } from "../../../lib/db";
import { requireAuth } from "../../../lib/auth";

function n(v) {
  if (v === undefined || v === "" || v === null) return null;
  return v;
}

export default async function handler(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;
  const db = getDb();
  const { id } = req.query;

  if (req.method === "PUT") {
    const { ended_at, reason } = req.body;
    try {
      await db.execute({
        sql: `UPDATE assignments
              SET ended_at = ?, reason = COALESCE(?, reason)
              WHERE id = ?`,
        args: [
          n(ended_at) || new Date().toISOString().split("T")[0],
          n(reason),
          Number(id)
        ]
      });
      const updated = await db.execute({
        sql: `SELECT a.*, s.name as site_name, d.name as department_name
              FROM assignments a
              LEFT JOIN sites s ON a.site_id = s.id
              LEFT JOIN departments d ON a.department_id = d.id
              WHERE a.id = ?`,
        args: [Number(id)]
      });
      return res.json(updated.rows[0]);
    } catch (err) {
      console.error("PUT /api/assignments/[id] error:", err);
      return res.status(500).json({ error: err.message });
    }
  }

  res.status(405).end();
}
