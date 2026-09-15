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

  if (req.method === "GET") {
    const asset = await db.execute({
      sql: `SELECT a.*, s.name as site_name, d.name as department_name
            FROM assets a
            LEFT JOIN sites s ON a.site_id = s.id
            LEFT JOIN departments d ON a.department_id = d.id
            WHERE a.id = ?`,
      args: [id]
    });
    if (!asset.rows[0]) return res.status(404).json({ error: "Equipement introuvable" });

    const maintenances = await db.execute({
      sql: `SELECT m.*, u.full_name as tech_name
            FROM maintenances m
            LEFT JOIN users u ON m.performed_by_user_id = u.id
            WHERE m.asset_id = ?
            ORDER BY m.created_at DESC`,
      args: [id]
    });
    const interventions = await db.execute({
      sql: `SELECT i.*
            FROM interventions i
            WHERE i.asset_id = ?
            ORDER BY i.date DESC, i.created_at DESC`,
      args: [id]
    });
    const alerts = await db.execute({
      sql: `SELECT * FROM alerts WHERE asset_id = ? ORDER BY created_at DESC`,
      args: [id]
    });
    return res.json({
      ...asset.rows[0],
      maintenances: maintenances.rows,
      interventions: interventions.rows,
      alerts: alerts.rows
    });
  }

if (req.method === "PUT") {
  const body = req.body;

  // Colonnes autorisées — exclure les champs joints (site_name, department_name, etc.)
  const ALLOWED = [
    "asset_tag","name","type","status","brand","model","serial_number",
    "operating_system","ram","storage","site_id","department_id",
    "assigned_user_name","assigned_user_title","deployment_date",
    "purchase_date","purchase_price","supplier","warranty_end_date",
    "planned_end_of_life","maintenance_interval_days","notes"
  ];

  const clean = {};
  for (const key of ALLOWED) {
    if (key in body) {
      const v = body[key];
      clean[key] = (v === undefined || v === "") ? null : v;
    }
  }

  // Convertir les numériques
  if (clean.site_id)                   clean.site_id = clean.site_id ? Number(clean.site_id) : null;
  if (clean.department_id)             clean.department_id = clean.department_id ? Number(clean.department_id) : null;
  if (clean.purchase_price)            clean.purchase_price = clean.purchase_price ? Number(clean.purchase_price) : null;
  if (clean.maintenance_interval_days) clean.maintenance_interval_days = clean.maintenance_interval_days ? Number(clean.maintenance_interval_days) : 180;

  const sets = Object.keys(clean).map(k => `${k}=?`).join(", ");
  const vals = [...Object.values(clean), id];

  try {
    await db.execute({
      sql: `UPDATE assets SET ${sets}, updated_at = datetime('now') WHERE id = ?`,
      args: vals
    });
    const updated = await db.execute({
      sql: `SELECT a.*, s.name as site_name, d.name as department_name
            FROM assets a
            LEFT JOIN sites s ON a.site_id = s.id
            LEFT JOIN departments d ON a.department_id = d.id
            WHERE a.id = ?`,
      args: [id]
    });
    return res.json(updated.rows[0]);
  } catch (err) {
    console.error("PUT /api/assets/[id]:", err);
    return res.status(500).json({ error: err.message });
  }
}

  if (req.method === "DELETE") {
    if (user.role !== "admin") return res.status(403).json({ error: "Accès refusé" });
    await db.execute({ sql: "DELETE FROM assets WHERE id = ?", args: [id] });
    return res.json({ success: true });
  }

  res.status(405).end();
}
