import { getDb } from "../../../lib/db";
import { requireAuth } from "../../../lib/auth";

// Vérifie toutes les maintenances en cours et génère les alertes manquantes
export default async function handler(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;
  if (req.method !== "POST") return res.status(405).end();

  const db      = getDb();
  const today   = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const results = { updated: [], alerts: [] };

  // 1. Maintenances planifiées dont la date approche
  const upcoming = await db.execute(`
    SELECT m.*, d.name as dept_name
    FROM maintenances m
    LEFT JOIN departments d ON m.department_id = d.id
    WHERE m.status = 'planned'
      AND m.scheduled_date IS NOT NULL
      AND m.scheduled_date >= ?
    ORDER BY m.scheduled_date ASC
  `, [todayStr] /* libsql needs positional args via execute({sql, args}) */);

  // retry avec la bonne syntaxe
  const upcomingFixed = await db.execute({
    sql: `SELECT m.*, d.name as dept_name
          FROM maintenances m
          LEFT JOIN departments d ON m.department_id = d.id
          WHERE m.status = 'planned'
            AND m.scheduled_date IS NOT NULL
            AND m.scheduled_date >= ?
          ORDER BY m.scheduled_date ASC`,
    args: [todayStr]
  });

  for (const maint of upcomingFixed.rows) {
    const startDt     = new Date(maint.scheduled_date);
    const daysToStart = Math.round((startDt - today) / 86400000);
    const label       = maint.dept_name || maint.title;

    const alertsNeeded = [];
    if (daysToStart <= 3)  alertsNeeded.push({ severity:"critical", days: daysToStart });
    else if (daysToStart <= 7)  alertsNeeded.push({ severity:"warning",  days: daysToStart });
    else if (daysToStart <= 14) alertsNeeded.push({ severity:"info",     days: daysToStart });

    for (const a of alertsNeeded) {
      const existing = await db.execute({
        sql: `SELECT id FROM alerts WHERE maintenance_id = ? AND severity = ? AND status = 'active'`,
        args: [maint.id, a.severity]
      });
      if (existing.rows.length > 0) continue;

      await db.execute({
        sql: `INSERT INTO alerts (maintenance_id, asset_id, type, severity, status, title, message, due_date)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          maint.id,
          maint.asset_id || null,
          "upcoming_maintenance",
          a.severity,
          "active",
          `Maintenance ${label} dans ${a.days} jour${a.days > 1 ? "s" : ""}`,
          `La maintenance "${maint.title}" est prévue dans ${a.days} jour${a.days > 1 ? "s" : ""}.`,
          maint.scheduled_date
        ]
      });
      results.alerts.push({ maint: maint.title, severity: a.severity });
    }
  }

  // 2. Maintenances en cours depuis trop longtemps (> 7 jours) ou date de fin dépassée
  const overdue = await db.execute({
    sql: `SELECT m.*, d.name as dept_name
          FROM maintenances m
          LEFT JOIN departments d ON m.department_id = d.id
          WHERE m.status IN ('planned', 'in_progress')
            AND (
              (m.scheduled_date IS NOT NULL AND m.scheduled_date < date(?, '-7 days'))
              OR (m.end_date IS NOT NULL AND m.end_date < ?)
            )`,
    args: [todayStr, todayStr]
  });

  for (const maint of overdue.rows) {
    const label = maint.dept_name || maint.title;

    // Passer en overdue
    await db.execute({
      sql: `UPDATE maintenances SET status = 'overdue', updated_at = datetime('now') WHERE id = ?`,
      args: [maint.id]
    });
    results.updated.push({ id: maint.id, title: maint.title });

    // Alerte critique si pas déjà active
    const existing = await db.execute({
      sql: `SELECT id FROM alerts WHERE maintenance_id = ? AND type = 'overdue_maintenance' AND status = 'active'`,
      args: [maint.id]
    });
    if (existing.rows.length > 0) continue;

    await db.execute({
      sql: `INSERT INTO alerts (maintenance_id, asset_id, type, severity, status, title, message, due_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        maint.id,
        maint.asset_id || null,
        "overdue_maintenance",
        "critical",
        "active",
        `Maintenance en retard — ${label}`,
        `La maintenance "${maint.title}" est en retard ou dure depuis plus de 7 jours sans être terminée.`,
        maint.end_date || maint.scheduled_date
      ]
    });
    results.alerts.push({ maint: maint.title, severity: "critical", type: "overdue" });
  }

  return res.json(results);
}
