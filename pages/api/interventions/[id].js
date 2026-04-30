import { getDb } from "../../../lib/db";
import { requireAuth } from "../../../lib/auth";

function n(v) { return (v === undefined || v === "" || v === null) ? null : v; }

export default async function handler(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;
  const db = getDb();
  const { id } = req.query;

  if (req.method === "PUT") {
    const { title, description, site_id, department_id, asset_id, performed_by, status, date, duration_min } = req.body;
    try {
      await db.execute({
        sql: `UPDATE interventions SET title=?, description=?, site_id=?, department_id=?, asset_id=?,
              performed_by=?, status=?, date=?, duration_min=? WHERE id=?`,
        args: [n(title), n(description), n(site_id)?Number(site_id):null, n(department_id)?Number(department_id):null,
               n(asset_id)?Number(asset_id):null, n(performed_by), n(status)||"done", n(date), n(duration_min)?Number(duration_min):null, Number(id)]
      });
      const updated = await db.execute({
        sql: `SELECT i.*, s.name as site_name, d.name as department_name, a.name as asset_name
              FROM interventions i
              LEFT JOIN sites s ON i.site_id = s.id
              LEFT JOIN departments d ON i.department_id = d.id
              LEFT JOIN assets a ON i.asset_id = a.id
              WHERE i.id = ?`,
        args: [Number(id)]
      });
      return res.json(updated.rows[0]);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === "DELETE") {
    await db.execute({ sql: "DELETE FROM interventions WHERE id=?", args: [Number(id)] });
    return res.json({ success: true });
  }

  res.status(405).end();
}
