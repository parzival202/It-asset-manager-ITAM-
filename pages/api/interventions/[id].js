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
  const { id } = req.query;

  if (req.method === "PUT") {
    const { title, description, site_id, department_id, asset_id, performed_by, status, date, duration_min, intervention_type, asset_status, consumables=[] } = req.body;
    try {
      const normalizedType = n(intervention_type) || "dépannage";
      const normalizedAssetStatus = n(asset_status) || null;
      if (asset_id && normalizedAssetStatus) {
        await db.execute({ sql: "UPDATE assets SET status = ?, updated_at = datetime('now') WHERE id = ?", args: [normalizedAssetStatus, Number(asset_id)] });
      }

      const current = await db.execute({ sql: "SELECT maintenance_id, intervention_type FROM interventions WHERE id = ?", args: [Number(id)] });
      await db.execute({
        sql: `UPDATE interventions SET title=?, description=?, site_id=?, department_id=?, asset_id=?,
              performed_by=?, intervention_type=?, asset_status=?, status=?, date=?, duration_min=? WHERE id=?`,
        args: [n(title), n(description), n(site_id)?Number(site_id):null, n(department_id)?Number(department_id):null,
               n(asset_id)?Number(asset_id):null, n(performed_by), normalizedType, normalizedAssetStatus, n(status)||"done", n(date), n(duration_min)?Number(duration_min):null, Number(id)]
      });

      const maintenanceId = await syncMaintenanceFromIntervention(db, {
        id: Number(id),
        intervention_type: normalizedType,
        asset_id: n(asset_id)?Number(asset_id):null,
        department_id: n(department_id)?Number(department_id):null,
        performed_by: n(performed_by),
        status: n(status)||"done",
        title: n(title),
        description: n(description),
        date: n(date),
        maintenance_id: current.rows[0]?.maintenance_id || null
      });

      if (maintenanceId) {
        await db.execute({ sql: "UPDATE interventions SET maintenance_id = ? WHERE id = ?", args: [maintenanceId, Number(id)] });
      } else {
        await db.execute({ sql: "UPDATE interventions SET maintenance_id = NULL WHERE id = ?", args: [Number(id)] });
      }

      await syncInterventionConsumables(db, Number(id), status||"done", consumables);
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
    const intervention = await db.execute({sql:"SELECT asset_id,department_id,maintenance_id FROM interventions WHERE id=?",args:[Number(id)]});
    const assetId = intervention.rows[0]?.asset_id || null;
    const departmentId = intervention.rows[0]?.department_id || null;
    const maintenanceId = intervention.rows[0]?.maintenance_id || null;
    const used=await db.execute({sql:"SELECT ic.consumable_id,ic.quantity,ic.color_quantities,c.color_stock,c.cartridge_type FROM intervention_consumables ic JOIN consumables c ON c.id=ic.consumable_id WHERE ic.intervention_id=?",args:[Number(id)]});
    for(const item of used.rows) {
      if (item.cartridge_type === "color" && item.color_stock) {
        let colors={}; try { colors=JSON.parse(item.color_stock||"{}"); } catch (_) {}
        let usedColors={}; try { usedColors=JSON.parse(item.color_quantities||"{}"); } catch (_) {}
        Object.entries(usedColors).forEach(([color,quantity])=>{colors[color]=Number(colors[color]||0)+Number(quantity||0);});
        const total=Object.values(colors).reduce((sum,quantity)=>sum+Number(quantity||0),0);
        await db.execute({sql:"UPDATE consumables SET color_stock=?,stock_qty=?,updated_at=datetime('now') WHERE id=?",args:[JSON.stringify(colors),total,Number(item.consumable_id)]});
      } else {
        await db.execute({sql:"UPDATE consumables SET stock_qty=stock_qty+?,updated_at=datetime('now') WHERE id=?",args:[Number(item.quantity),Number(item.consumable_id)]});
      }
      await db.execute({sql:"INSERT INTO consumable_movements (consumable_id,movement_type,quantity,note,asset_id,department_id,intervention_id,color_quantities) VALUES (?,?,?,?,?,?,?,?)",args:[Number(item.consumable_id),"in",Number(item.quantity),"Restitution après suppression de l’intervention",assetId,departmentId,Number(id),item.color_quantities || null]});
    }
    if (maintenanceId) {
      await db.execute({ sql: "DELETE FROM maintenances WHERE id = ? AND source = 'intervention'", args: [Number(maintenanceId)] });
    }
    await db.execute({ sql: "DELETE FROM interventions WHERE id=?", args: [Number(id)] });
    return res.json({ success: true });
  }

  res.status(405).end();
}
