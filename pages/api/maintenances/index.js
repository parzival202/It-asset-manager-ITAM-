import { getDb } from "../../../lib/db";
import { requireAuth } from "../../../lib/auth";

function n(v) { return (v===undefined||v===""||v===null) ? null : v; }

export default async function handler(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;
  const db = getDb();

  if (req.method === "GET") {
    const { asset_id, status, type } = req.query;
    let sql = `
      SELECT m.*, a.name as asset_name, a.asset_tag,
             u.full_name as tech_name,
             d.name as dept_name
      FROM maintenances m
      LEFT JOIN assets a ON m.asset_id = a.id
      LEFT JOIN users u ON m.performed_by_user_id = u.id
      LEFT JOIN departments d ON m.department_id = d.id
      WHERE 1=1
    `;
    const args = [];
    if (asset_id) { sql += ` AND m.asset_id = ?`;  args.push(Number(asset_id)); }
    if (status)   { sql += ` AND m.status = ?`;    args.push(status); }
    if (type)     { sql += ` AND m.type = ?`;      args.push(type); }
    sql += ` ORDER BY COALESCE(m.scheduled_date, m.created_at) DESC`;
    const result = await db.execute({ sql, args });
    return res.json(result.rows);
  }

  if (req.method === "POST") {
    const {
      asset_id, type, title, description, scheduled_date, end_date,
      performed_by_user_id, performed_by_name, status,
      replacement_part, resolution_notes, cost,
      department_id, source, ref_key
    } = req.body;

    if (!type || !title) return res.status(400).json({ error: "type et title requis" });

    try {
      const r = await db.execute({
        sql: `INSERT INTO maintenances
              (asset_id, performed_by_user_id, performed_by_name, type, status,
               title, description, scheduled_date, end_date, replacement_part,
               resolution_notes, cost, department_id, source, ref_key)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        args: [
          n(asset_id)?Number(asset_id):null,
          n(performed_by_user_id)?Number(performed_by_user_id):null,
          n(performed_by_name), n(type), n(status)||"planned",
          n(title), n(description), n(scheduled_date), n(end_date),
          n(replacement_part), n(resolution_notes),
          n(cost)?Number(cost):null,
          n(department_id)?Number(department_id):null,
          n(source)||"manual", n(ref_key)
        ]
      });
      const created = await db.execute({
        sql: `SELECT m.*, a.name as asset_name, a.asset_tag, d.name as dept_name
              FROM maintenances m
              LEFT JOIN assets a ON m.asset_id = a.id
              LEFT JOIN departments d ON m.department_id = d.id
              WHERE m.id = ?`,
        args: [Number(r.lastInsertRowid)]
      });
      return res.status(201).json(created.rows[0]);
    } catch (err) {
      console.error("POST /api/maintenances:", err);
      if (err.message?.includes("UNIQUE")) return res.status(409).json({ error: "Ce ticket de planning existe déjà." });
      return res.status(500).json({ error: err.message });
    }
  }

  res.status(405).end();
}
