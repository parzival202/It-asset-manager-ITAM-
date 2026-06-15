function daysBetween(date, today) {
  const start = new Date(date);
  return Math.round((start - today) / 86400000);
}

export async function syncMaintenanceAlerts(db) {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const results = { updated: [], alerts: [] };

  const upcoming = await db.execute({
    sql: `SELECT m.*, d.name as dept_name
          FROM maintenances m
          LEFT JOIN departments d ON m.department_id = d.id
          WHERE m.status = 'planned'
            AND m.scheduled_date IS NOT NULL
            AND m.scheduled_date >= ?
          ORDER BY m.scheduled_date ASC`,
    args: [todayStr]
  });

  for (const maint of upcoming.rows) {
    const daysToStart = daysBetween(maint.scheduled_date, today);
    const label = maint.dept_name || maint.title;

    let severity = null;
    if (daysToStart <= 3) severity = "critical";
    else if (daysToStart <= 7) severity = "warning";
    else if (daysToStart <= 14) severity = "info";
    if (!severity) continue;

    const existing = await db.execute({
      sql: `SELECT id FROM alerts
            WHERE maintenance_id = ? AND severity = ? AND status = 'active'`,
      args: [maint.id, severity]
    });
    if (existing.rows.length > 0) continue;

    await db.execute({
      sql: `INSERT INTO alerts (maintenance_id, asset_id, type, severity, status, title, message, due_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        maint.id,
        maint.asset_id || null,
        "upcoming_maintenance",
        severity,
        "active",
        `Maintenance ${label} dans ${daysToStart} jour${daysToStart > 1 ? "s" : ""}`,
        `La maintenance "${maint.title}" est prévue dans ${daysToStart} jour${daysToStart > 1 ? "s" : ""}.`,
        maint.scheduled_date
      ]
    });
    results.alerts.push({ maint: maint.title, severity, type: "upcoming" });
  }

  const overdue = await db.execute({
    sql: `SELECT m.*, d.name as dept_name
          FROM maintenances m
          LEFT JOIN departments d ON m.department_id = d.id
          WHERE m.status IN ('planned', 'in_progress', 'overdue')
            AND (
              (m.end_date IS NOT NULL AND m.end_date < ?)
              OR (m.scheduled_date IS NOT NULL AND m.scheduled_date < date(?, '-7 days'))
            )`,
    args: [todayStr, todayStr]
  });

  for (const maint of overdue.rows) {
    const label = maint.dept_name || maint.title;

    if (maint.status !== "overdue") {
      await db.execute({
        sql: `UPDATE maintenances
              SET status = 'overdue', updated_at = datetime('now')
              WHERE id = ?`,
        args: [maint.id]
      });
      results.updated.push({ id: maint.id, title: maint.title });
    }

    const existing = await db.execute({
      sql: `SELECT id FROM alerts
            WHERE maintenance_id = ? AND type = 'overdue_maintenance' AND status = 'active'`,
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

  return results;
}
