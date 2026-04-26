import { getDb, initDb, seedDb } from "../../lib/db";
import { requireAuth } from "../../lib/auth";

export default async function handler(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;
  await initDb(); await seedDb();
  const db = getDb();

  const [totalAssets, byType, byStatus, activeAlerts, upcomingMaint, recentMaint] = await Promise.all([
    db.execute("SELECT COUNT(*) as total FROM assets"),
    db.execute("SELECT type, COUNT(*) as count FROM assets GROUP BY type"),
    db.execute("SELECT status, COUNT(*) as count FROM assets GROUP BY status"),
    db.execute("SELECT COUNT(*) as total FROM alerts WHERE status='active'"),
    db.execute(`SELECT m.*, a.name as asset_name, a.asset_tag FROM maintenances m LEFT JOIN assets a ON m.asset_id=a.id WHERE m.status='planned' AND m.scheduled_date IS NOT NULL ORDER BY m.scheduled_date ASC LIMIT 5`),
    db.execute(`SELECT m.*, a.name as asset_name, a.asset_tag FROM maintenances m LEFT JOIN assets a ON m.asset_id=a.id WHERE m.status='completed' ORDER BY m.completed_at DESC LIMIT 5`),
  ]);

  res.json({
    stats: {
      total_assets: Number(totalAssets.rows[0].total),
      active_alerts: Number(activeAlerts.rows[0].total),
      by_type: byType.rows,
      by_status: byStatus.rows,
    },
    upcoming_maintenances: upcomingMaint.rows,
    recent_maintenances: recentMaint.rows,
  });
}
