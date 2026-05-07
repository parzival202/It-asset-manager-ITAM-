import { getDb } from "../../../lib/db";
import { requireAuth } from "../../../lib/auth";
import { PLANNING_2025, weekToDate, entryEndDate } from "../../../lib/planningData";

// Génère les tickets de maintenance planifiée + alertes pour l'année en cours
export default async function handler(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;
  if (req.method !== "POST") return res.status(405).end();

  const db   = getDb();
  const year = new Date().getFullYear();
  const results = { created: [], skipped: [], alerts_created: [] };

  // Charger tous les départements une seule fois
  const depts = await db.execute("SELECT id, name FROM departments");
  const deptMap = {};
  depts.rows.forEach(d => { deptMap[d.name] = d.id; });

  for (const entry of PLANNING_2025) {
    const deptId = deptMap[entry.dept_name];
    if (!deptId) {
      results.skipped.push({ dept: entry.dept_name, reason: "département introuvable" });
      continue;
    }

    const startDate = weekToDate(year, entry.month, entry.week_start);
    const endDate   = entryEndDate(year, entry.month, entry.week_start, entry.duration);
    const title     = `Maintenance préventive — ${entry.dept_name}`;
    const refKey    = `schedule_${year}_${entry.month}_${entry.week_start}_${deptId}`;

    // Vérifier si ce ticket existe déjà (par ref_key)
    const existing = await db.execute({
      sql: `SELECT id FROM maintenances WHERE ref_key = ?`,
      args: [refKey]
    });

    if (existing.rows.length > 0) {
      results.skipped.push({ dept: entry.dept_name, reason: "déjà généré" });
      continue;
    }

    // Créer le ticket de maintenance
    const r = await db.execute({
      sql: `INSERT INTO maintenances
            (asset_id, type, status, title, description, scheduled_date, end_date, department_id, source, ref_key)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        null, // pas lié à un équipement précis — lié au service
        "preventive",
        "planned",
        title,
        `Maintenance préventive annuelle du service ${entry.dept_name}. Période : du ${startDate} au ${endDate}.`,
        startDate,
        endDate,
        deptId,
        "schedule", // source = planning automatique
        refKey
      ]
    });

    const maintId = Number(r.lastInsertRowid);
    results.created.push({ dept: entry.dept_name, start: startDate, end: endDate, id: maintId });

    // Générer les alertes pour ce ticket
    const today    = new Date();
    const startDt  = new Date(startDate);
    const endDt    = new Date(endDate);
    const daysToStart = Math.round((startDt - today) / 86400000);

    const alertsToCreate = [];

    // Alerte info — 14 jours avant
    if (daysToStart > 0 && daysToStart <= 14) {
      alertsToCreate.push({
        severity: daysToStart <= 3 ? "critical" : daysToStart <= 7 ? "warning" : "info",
        title: `Maintenance ${entry.dept_name} dans ${daysToStart} jour${daysToStart > 1 ? "s" : ""}`,
        message: `La maintenance préventive du service ${entry.dept_name} est prévue du ${startDate} au ${endDate}.`,
        due_date: startDate,
      });
    }

    // Alerte si déjà dépassée et pas terminée
    if (today > endDt) {
      alertsToCreate.push({
        severity: "critical",
        title: `Maintenance ${entry.dept_name} — en retard`,
        message: `La maintenance préventive du service ${entry.dept_name} aurait dû être terminée le ${endDate}.`,
        due_date: endDate,
      });
      // Passer le statut à overdue
      await db.execute({
        sql: `UPDATE maintenances SET status = 'overdue' WHERE id = ?`,
        args: [maintId]
      });
    }

    for (const alert of alertsToCreate) {
      // Vérifier si l'alerte existe déjà pour ce ticket
      const existingAlert = await db.execute({
        sql: `SELECT id FROM alerts WHERE maintenance_id = ? AND severity = ?`,
        args: [maintId, alert.severity]
      });
      if (existingAlert.rows.length > 0) continue;

      await db.execute({
        sql: `INSERT INTO alerts (maintenance_id, type, severity, status, title, message, due_date)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [maintId, "scheduled_maintenance", alert.severity, "active", alert.title, alert.message, alert.due_date]
      });
      results.alerts_created.push({ dept: entry.dept_name, severity: alert.severity });
    }
  }

  return res.json(results);
}
