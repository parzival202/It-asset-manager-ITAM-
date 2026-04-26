import { getDb, initDb, seedDb } from "../../../lib/db";
import { requireAuth } from "../../../lib/auth";

export default async function handler(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;
  await initDb(); await seedDb();
  const db = getDb();

  if (req.method === "GET") {
    const { search, type, status, site_id } = req.query;
    let sql = `SELECT a.*, s.name as site_name, d.name as department_name
               FROM assets a
               LEFT JOIN sites s ON a.site_id = s.id
               LEFT JOIN departments d ON a.department_id = d.id
               WHERE 1=1`;
    const args = [];
    if (search) { sql += ` AND (a.name LIKE ? OR a.asset_tag LIKE ? OR a.serial_number LIKE ? OR a.assigned_user_name LIKE ?)`; const q = `%${search}%`; args.push(q,q,q,q); }
    if (type)   { sql += ` AND a.type = ?`; args.push(type); }
    if (status) { sql += ` AND a.status = ?`; args.push(status); }
    if (site_id){ sql += ` AND a.site_id = ?`; args.push(site_id); }
    sql += ` ORDER BY a.created_at DESC`;
    const result = await db.execute({ sql, args });
    return res.json(result.rows);
  }

  if (req.method === "POST") {
    const { asset_tag,name,type,status,brand,model,serial_number,operating_system,ram,storage,
            site_id,department_id,assigned_user_name,assigned_user_title,deployment_date,
            purchase_date,purchase_price,supplier,warranty_end_date,planned_end_of_life,
            maintenance_interval_days,notes } = req.body;
    if (!asset_tag || !name || !type) return res.status(400).json({ error: "asset_tag, name et type sont requis" });
    const r = await db.execute({ sql: `INSERT INTO assets (asset_tag,name,type,status,brand,model,serial_number,operating_system,ram,storage,site_id,department_id,assigned_user_name,assigned_user_title,deployment_date,purchase_date,purchase_price,supplier,warranty_end_date,planned_end_of_life,maintenance_interval_days,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [asset_tag,name,type,status||"in_service",brand,model,serial_number,operating_system,ram,storage,site_id,department_id,assigned_user_name,assigned_user_title,deployment_date,purchase_date,purchase_price,supplier,warranty_end_date,planned_end_of_life,maintenance_interval_days||180,notes] });
    const created = await db.execute({ sql: "SELECT * FROM assets WHERE id=?", args: [Number(r.lastInsertRowid)] });
    return res.status(201).json(created.rows[0]);
  }

  res.status(405).end();
}
