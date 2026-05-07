import { getDb } from "../../../lib/db";
import { requireAuth } from "../../../lib/auth";

function n(v) { return (v === undefined || v === "" || v === null) ? null : v; }

export default async function handler(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;
  const db = getDb();
  const { id } = req.query;

  if (req.method === "PUT") {
    const ALLOWED = [
      "type","status","title","description","scheduled_date","end_date",
      "performed_by_user_id","performed_by_name","replacement_part",
      "resolution_notes","cost","department_id","asset_id","completed_at"
    ];
    const clean = {};
    for (const key of ALLOWED) {
      if (key in req.body) {
        const v = req.body[key];
        clean[key] = (v === undefined || v === "") ? null : v;
      }
    }
    if (clean.performed_by_user_id) clean.performed_by_user_id = Number(clean.performed_by_user_id);
    if (clean.department_id)        clean.department_id = Number(clean.department_id);
    if (clean.asset_id)             clean.asset_id = Number(clean.asset_id);
    if (clean.cost)                 clean.cost = Number(clean.cost);
    if (clean.status === "completed" && !clean.completed_at) {
      clean.completed_at = new Date().toISOString();
    }

    const sets = Object.keys(clean).map(k => `${k}=?`).join(", ");
    const vals = [...Object.values(clean), Number(id)];
    try {
      await db.execute({
        sql: `UPDATE maintenances SET ${sets}, updated_at=datetime('now') WHERE id=?`,
        args: vals
      });
      const updated = await db.execute({
        sql: `SELECT m.*, a.name as asset_name, a.asset_tag, d.name as dept_name
              FROM maintenances m
              LEFT JOIN assets a ON m.asset_id = a.id
              LEFT JOIN departments d ON m.department_id = d.id
              WHERE m.id=?`,
        args: [Number(id)]
      });
      return res.json(updated.rows[0]);
    } catch(err) {
      console.error("PUT /api/maintenances/[id]:", err);
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === "DELETE") {
    await db.execute({ sql: "DELETE FROM maintenances WHERE id=?", args: [Number(id)] });
    return res.json({ success: true });
  }

  res.status(405).end();
}
