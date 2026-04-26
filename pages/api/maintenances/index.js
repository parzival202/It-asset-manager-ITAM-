import { getDb } from "../../../lib/db";
import { requireAuth } from "../../../lib/auth";

export default async function handler(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;
  const db = getDb();

  if (req.method === "GET") {
    const { asset_id, status, type } = req.query;
    let sql = `SELECT m.*, a.name as asset_name, a.asset_tag, u.full_name as tech_name
               FROM maintenances m
               LEFT JOIN assets a ON m.asset_id=a.id
               LEFT JOIN users u ON m.performed_by_user_id=u.id
               WHERE 1=1`;
    const args = [];
    if (asset_id) { sql += ` AND m.asset_id=?`; args.push(asset_id); }
    if (status)   { sql += ` AND m.status=?`; args.push(status); }
    if (type)     { sql += ` AND m.type=?`; args.push(type); }
    sql += ` ORDER BY COALESCE(m.scheduled_date, m.created_at) DESC`;
    const result = await db.execute({ sql, args });
    return res.json(result.rows);
  }

  if (req.method === "POST") {
    const { asset_id,type,title,description,scheduled_date,performed_by_user_id,performed_by_name,status,replacement_part,resolution_notes,cost } = req.body;
    if (!asset_id || !type || !title) return res.status(400).json({ error: "asset_id, type et title requis" });
    const r = await db.execute({ sql: `INSERT INTO maintenances (asset_id,performed_by_user_id,performed_by_name,type,status,title,description,scheduled_date,replacement_part,resolution_notes,cost) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      args: [asset_id,performed_by_user_id||null,performed_by_name||null,type,status||"planned",title,description||null,scheduled_date||null,replacement_part||null,resolution_notes||null,cost||null] });
    const created = await db.execute({ sql: "SELECT * FROM maintenances WHERE id=?", args: [Number(r.lastInsertRowid)] });
    return res.status(201).json(created.rows[0]);
  }

  res.status(405).end();
}
