import { getDb } from "../../../lib/db";
import { requireAuth } from "../../../lib/auth";

export default async function handler(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;
  const db = getDb();
  const { id } = req.query;

  if (req.method === "GET") {
    const asset = await db.execute({ sql: `SELECT a.*, s.name as site_name, d.name as department_name FROM assets a LEFT JOIN sites s ON a.site_id=s.id LEFT JOIN departments d ON a.department_id=d.id WHERE a.id=?`, args: [id] });
    if (!asset.rows[0]) return res.status(404).json({ error: "Equipement introuvable" });
    const maintenances = await db.execute({ sql: `SELECT m.*, u.full_name as tech_name FROM maintenances m LEFT JOIN users u ON m.performed_by_user_id=u.id WHERE m.asset_id=? ORDER BY m.created_at DESC`, args: [id] });
    const alerts = await db.execute({ sql: `SELECT * FROM alerts WHERE asset_id=? ORDER BY created_at DESC`, args: [id] });
    return res.json({ ...asset.rows[0], maintenances: maintenances.rows, alerts: alerts.rows });
  }

  if (req.method === "PUT") {
    const fields = req.body;
    const sets = Object.keys(fields).map(k => `${k}=?`).join(",");
    const vals = [...Object.values(fields), id];
    await db.execute({ sql: `UPDATE assets SET ${sets}, updated_at=datetime('now') WHERE id=?`, args: vals });
    const updated = await db.execute({ sql: "SELECT * FROM assets WHERE id=?", args: [id] });
    return res.json(updated.rows[0]);
  }

  if (req.method === "DELETE") {
    if (user.role !== "admin") return res.status(403).json({ error: "Acces refuse" });
    await db.execute({ sql: "DELETE FROM assets WHERE id=?", args: [id] });
    return res.json({ success: true });
  }

  res.status(405).end();
}
