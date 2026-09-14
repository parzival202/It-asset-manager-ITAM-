import { getDb } from "../../../lib/db";
import { requireAuth } from "../../../lib/auth";
import { initDb } from "../../../lib/db";
import { syncInterventionConsumables } from "../../../lib/consumables";

function n(v) { return (v === undefined || v === "" || v === null) ? null : v; }

export default async function handler(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;
  await initDb();
  const db = getDb();

  if (req.method === "GET") {
    const { site_id, department_id, from, to } = req.query;
    let sql = `
      SELECT i.*, s.name as site_name, d.name as department_name, a.name as asset_name, a.asset_tag,
      (SELECT json_group_array(json_object('consumable_id',ic.consumable_id,'quantity',ic.quantity,'color_quantities',ic.color_quantities,'name',c.name)) FROM intervention_consumables ic JOIN consumables c ON c.id=ic.consumable_id WHERE ic.intervention_id=i.id) as consumables_json
      FROM interventions i
      LEFT JOIN sites s ON i.site_id = s.id
      LEFT JOIN departments d ON i.department_id = d.id
      LEFT JOIN assets a ON i.asset_id = a.id
      WHERE 1=1
    `;
    const args = [];
    if (site_id)       { sql += ` AND i.site_id = ?`;       args.push(Number(site_id)); }
    if (department_id) { sql += ` AND i.department_id = ?`; args.push(Number(department_id)); }
    if (from)          { sql += ` AND i.date >= ?`;          args.push(from); }
    if (to)            { sql += ` AND i.date <= ?`;          args.push(to); }
    sql += ` ORDER BY i.date DESC, i.created_at DESC`;
    const result = await db.execute({ sql, args });
    return res.json(result.rows);
  }

  if (req.method === "POST") {
    const { title, description, site_id, department_id, asset_id, performed_by, status, date, duration_min, consumables=[] } = req.body;
    if (!title || !date) return res.status(400).json({ error: "Titre et date requis" });
    try {
      const r = await db.execute({
        sql: `INSERT INTO interventions (title, description, site_id, department_id, asset_id, performed_by, status, date, duration_min)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [n(title), n(description), n(site_id)?Number(site_id):null, n(department_id)?Number(department_id):null,
               n(asset_id)?Number(asset_id):null, n(performed_by), n(status)||"done", n(date), n(duration_min)?Number(duration_min):null]
      });
      await syncInterventionConsumables(db, Number(r.lastInsertRowid), status||"done", consumables);
      const created = await db.execute({
        sql: `SELECT i.*, s.name as site_name, d.name as department_name, a.name as asset_name
              FROM interventions i
              LEFT JOIN sites s ON i.site_id = s.id
              LEFT JOIN departments d ON i.department_id = d.id
              LEFT JOIN assets a ON i.asset_id = a.id
              WHERE i.id = ?`,
        args: [Number(r.lastInsertRowid)]
      });
      return res.status(201).json({...created.rows[0], consumables});
    } catch (err) {
      console.error("POST /api/interventions:", err);
      return res.status(500).json({ error: err.message });
    }
  }

  res.status(405).end();
}
