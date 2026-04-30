import { getDb, initDb, seedDb } from "../../../lib/db";
import { requireAuth } from "../../../lib/auth";


// Convertit undefined et chaînes vides en null pour libsql
function n(v) {
  if (v === undefined || v === "" || v === null) return null;
  return v;
}

export default async function handler(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;
  await initDb();
  await seedDb();
  const db = getDb();

  if (req.method === "GET") {
    const { search, type, status, site_id } = req.query;
    let sql = `SELECT a.*, s.name as site_name, d.name as department_name
               FROM assets a
               LEFT JOIN sites s ON a.site_id = s.id
               LEFT JOIN departments d ON a.department_id = d.id
               WHERE 1=1`;
    const args = [];
    if (search) {
      sql += ` AND (a.name LIKE ? OR a.asset_tag LIKE ? OR a.serial_number LIKE ? OR a.assigned_user_name LIKE ?)`;
      const q = `%${search}%`;
      args.push(q, q, q, q);
    }
    if (type)    { sql += ` AND a.type = ?`;    args.push(type); }
    if (status)  { sql += ` AND a.status = ?`;  args.push(status); }
    if (site_id) { sql += ` AND a.site_id = ?`; args.push(site_id); }
    sql += ` ORDER BY a.created_at DESC`;
    const result = await db.execute({ sql, args });
    return res.json(result.rows);
  }

  if (req.method === "POST") {
    const {
      asset_tag, name, type, status,
      brand, model, serial_number, operating_system, ram, storage,
      site_id, department_id, assigned_user_name, assigned_user_title,
      deployment_date, purchase_date, purchase_price, supplier,
      warranty_end_date, planned_end_of_life, maintenance_interval_days, notes
    } = req.body;

    if (!asset_tag || !name || !type)
      return res.status(400).json({ error: "asset_tag, name et type sont requis" });

    try {
      const r = await db.execute({
        sql: `INSERT INTO assets (
          asset_tag, name, type, status, brand, model, serial_number,
          operating_system, ram, storage, site_id, department_id,
          assigned_user_name, assigned_user_title, deployment_date,
          purchase_date, purchase_price, supplier, warranty_end_date,
          planned_end_of_life, maintenance_interval_days, notes
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        args: [
          n(asset_tag), n(name), n(type), n(status) || "in_service",
          n(brand), n(model), n(serial_number), n(operating_system),
          n(ram), n(storage), n(site_id) ? Number(site_id) : null,
          n(department_id) ? Number(department_id) : null,
          n(assigned_user_name), n(assigned_user_title),
          n(deployment_date), n(purchase_date),
          n(purchase_price) ? Number(purchase_price) : null,
          n(supplier), n(warranty_end_date), n(planned_end_of_life),
          n(maintenance_interval_days) ? Number(maintenance_interval_days) : 180,
          n(notes)
        ]
      });
      const created = await db.execute({
        sql: `SELECT a.*, s.name as site_name, d.name as department_name
              FROM assets a
              LEFT JOIN sites s ON a.site_id = s.id
              LEFT JOIN departments d ON a.department_id = d.id
              WHERE a.id = ?`,
        args: [Number(r.lastInsertRowid)]
      });
      return res.status(201).json(created.rows[0]);
    } catch (err) {
      console.error("POST /api/assets error:", err);
      if (err.message?.includes("UNIQUE")) {
        return res.status(409).json({ error: "Ce tag ou numéro de série existe déjà" });
      }
      return res.status(500).json({ error: err.message });
    }
  }

  res.status(405).end();
}
