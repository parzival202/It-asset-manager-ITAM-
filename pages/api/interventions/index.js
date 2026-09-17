import { getDb } from "../../../lib/db";
import { requireAuth } from "../../../lib/auth";
import { initDb } from "../../../lib/db";
import { syncInterventionConsumables } from "../../../lib/consumables";

function n(v) { return (v === undefined || v === "" || v === null) ? null : v; }

async function syncMaintenanceFromIntervention(db, intervention) {
  const type = intervention.intervention_type || "dépannage";
  if (type !== "maintenance") {
    if (intervention.maintenance_id) {
      await db.execute({ sql: "DELETE FROM maintenances WHERE id = ? AND source = 'intervention'", args: [Number(intervention.maintenance_id)] });
    }
    return null;
  }

  const payload = {
    asset_id: intervention.asset_id ? Number(intervention.asset_id) : null,
    department_id: intervention.department_id ? Number(intervention.department_id) : null,
    type: "corrective",
    status: intervention.status || "planned",
    title: intervention.title || "Maintenance",
    description: intervention.description || "Maintenance créée depuis une intervention",
    scheduled_date: intervention.date || null,
    end_date: intervention.date || null,
    performed_by_name: intervention.performed_by || null,
    source: "intervention",
    ref_key: `intervention:${intervention.id}`,
    completed_at: intervention.status === "done" ? intervention.date || null : null,
    cost: null,
  };

  if (intervention.maintenance_id) {
    await db.execute({
      sql: `UPDATE maintenances SET asset_id=?, department_id=?, type=?, status=?, title=?, description=?, scheduled_date=?, end_date=?, performed_by_name=?, source=?, ref_key=?, completed_at=?, updated_at=datetime('now') WHERE id=?`,
      args: [
        payload.asset_id,
        payload.department_id,
        payload.type,
        payload.status,
        payload.title,
        payload.description,
        payload.scheduled_date,
        payload.end_date,
        payload.performed_by_name,
        payload.source,
        payload.ref_key,
        payload.completed_at,
        Number(intervention.maintenance_id)
      ]
    });
    return Number(intervention.maintenance_id);
  }

  const result = await db.execute({
    sql: `INSERT INTO maintenances (asset_id, department_id, type, status, title, description, scheduled_date, end_date, performed_by_name, source, ref_key, completed_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      payload.asset_id,
      payload.department_id,
      payload.type,
      payload.status,
      payload.title,
      payload.description,
      payload.scheduled_date,
      payload.end_date,
      payload.performed_by_name,
      payload.source,
      payload.ref_key,
      payload.completed_at
    ]
  });

  return Number(result.lastInsertRowid);
}

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
    const { title, description, site_id, department_id, asset_id, performed_by, status, date, duration_min, intervention_type, asset_status, consumables=[] } = req.body;
    if (!title || !date) return res.status(400).json({ error: "Titre et date requis" });
    try {
      const normalizedType = n(intervention_type) || "dépannage";
      const normalizedAssetStatus = n(asset_status) || null;
      if (asset_id && normalizedAssetStatus) {
        await db.execute({ sql: "UPDATE assets SET status = ?, updated_at = datetime('now') WHERE id = ?", args: [normalizedAssetStatus, Number(asset_id)] });
      }

      const r = await db.execute({
        sql: `INSERT INTO interventions (title, description, site_id, department_id, asset_id, performed_by, intervention_type, asset_status, status, date, duration_min)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [n(title), n(description), n(site_id)?Number(site_id):null, n(department_id)?Number(department_id):null,
               n(asset_id)?Number(asset_id):null, n(performed_by), normalizedType, normalizedAssetStatus, n(status)||"done", n(date), n(duration_min)?Number(duration_min):null]
      });

      const interventionId = Number(r.lastInsertRowid);
      const maintenanceId = await syncMaintenanceFromIntervention(db, {
        id: interventionId,
        intervention_type: normalizedType,
        asset_id: n(asset_id)?Number(asset_id):null,
        department_id: n(department_id)?Number(department_id):null,
        performed_by: n(performed_by),
        status: n(status)||"done",
        title: n(title),
        description: n(description),
        date: n(date),
        maintenance_id: null
      });

      if (maintenanceId) {
        await db.execute({ sql: "UPDATE interventions SET maintenance_id = ? WHERE id = ?", args: [maintenanceId, interventionId] });
      }

      await syncInterventionConsumables(db, interventionId, status||"done", consumables);
      const created = await db.execute({
        sql: `SELECT i.*, s.name as site_name, d.name as department_name, a.name as asset_name
              FROM interventions i
              LEFT JOIN sites s ON i.site_id = s.id
              LEFT JOIN departments d ON i.department_id = d.id
              LEFT JOIN assets a ON i.asset_id = a.id
              WHERE i.id = ?`,
        args: [interventionId]
      });
      return res.status(201).json({...created.rows[0], consumables, maintenance_id: maintenanceId});
    } catch (err) {
      console.error("POST /api/interventions:", err);
      return res.status(500).json({ error: err.message });
    }
  }

  res.status(405).end();
}
