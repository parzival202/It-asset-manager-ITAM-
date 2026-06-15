import { getDb } from "../../lib/db";
import { requireAuth } from "../../lib/auth";

export default async function handler(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;
  const db = getDb();

  // ── Parc : équipements par site ───────────────────────────────────
  const bysite = await db.execute(`
    SELECT s.name as site_name, COUNT(a.id) as count
    FROM assets a
    LEFT JOIN sites s ON a.site_id = s.id
    GROUP BY s.name ORDER BY count DESC
  `);

  // ── Parc : équipements par type ───────────────────────────────────
  const bytype = await db.execute(`
    SELECT type, COUNT(*) as count FROM assets GROUP BY type ORDER BY count DESC
  `);

  // ── Parc : équipements par statut ─────────────────────────────────
  const bystatus = await db.execute(`
    SELECT status, COUNT(*) as count FROM assets GROUP BY status
  `);

  // ── Maintenances : préventives vs correctives ─────────────────────
  const maintByType = await db.execute(`
    SELECT type, COUNT(*) as count FROM maintenances GROUP BY type
  `);

  // ── Maintenances : par mois sur 6 mois ───────────────────────────
  const maintByMonth = await db.execute(`
    SELECT
      strftime('%Y-%m', COALESCE(completed_at, scheduled_date, created_at)) as month,
      type,
      COUNT(*) as count
    FROM maintenances
    WHERE COALESCE(completed_at, scheduled_date, created_at) >= date('now', '-6 months')
    GROUP BY month, type
    ORDER BY month ASC
  `);

  // ── Maintenances non terminées ────────────────────────────────────
  const maintPending = await db.execute(`
    SELECT m.*, a.name as asset_name, a.asset_tag
    FROM maintenances m
    LEFT JOIN assets a ON m.asset_id = a.id
    WHERE m.status IN ('planned', 'in_progress', 'overdue')
    ORDER BY COALESCE(m.scheduled_date, m.created_at) ASC
  `);

  // ── Maintenances à venir dans 14 jours ───────────────────────────
  const maintUpcoming = await db.execute(`
    SELECT m.*, a.name as asset_name, a.asset_tag
    FROM maintenances m
    LEFT JOIN assets a ON m.asset_id = a.id
    WHERE m.status = 'planned'
      AND m.scheduled_date IS NOT NULL
      AND m.scheduled_date <= date('now', '+14 days')
      AND m.scheduled_date >= date('now')
    ORDER BY m.scheduled_date ASC
  `);

  // ── Interventions : par service ───────────────────────────────────
  const interventByDept = await db.execute(`
    SELECT d.name as dept_name, s.name as site_name, COUNT(i.id) as count
    FROM interventions i
    LEFT JOIN departments d ON i.department_id = d.id
    LEFT JOIN sites s ON i.site_id = s.id
    GROUP BY d.name ORDER BY count DESC LIMIT 10
  `);

  // ── Interventions : par technicien ────────────────────────────────
  const interventByTech = await db.execute(`
    SELECT
      COALESCE(performed_by, 'Non assigné') as tech,
      COUNT(*) as count,
      SUM(COALESCE(duration_min, 0)) as total_min
    FROM interventions
    GROUP BY performed_by ORDER BY count DESC LIMIT 8
  `);

  // ── Interventions ouvertes ────────────────────────────────────────
  const interventPending = await db.execute(`
    SELECT i.*, d.name as dept_name, s.name as site_name
    FROM interventions i
    LEFT JOIN departments d ON i.department_id = d.id
    LEFT JOIN sites s ON i.site_id = s.id
    WHERE i.status IN ('in_progress', 'planned')
    ORDER BY i.date ASC
  `);

  // ── Interventions par mois 6 mois ─────────────────────────────────
  const interventByMonth = await db.execute(`
    SELECT strftime('%Y-%m', date) as month, COUNT(*) as count,
           SUM(COALESCE(duration_min,0)) as total_min
    FROM interventions
    WHERE date >= date('now', '-6 months')
    GROUP BY month ORDER BY month ASC
  `);

  // ── Totaux rapides ────────────────────────────────────────────────
  const totals = await db.execute(`
    SELECT
      (SELECT COUNT(*) FROM assets) as total_assets,
      (SELECT COUNT(*) FROM maintenances WHERE status IN ('planned','in_progress','overdue')) as maint_pending,
      (SELECT COUNT(*) FROM maintenances WHERE status='planned' AND scheduled_date <= date('now','+14 days') AND scheduled_date >= date('now')) as maint_upcoming,
      (SELECT COUNT(*) FROM interventions WHERE status IN ('in_progress','planned')) as interv_pending,
      (SELECT COUNT(*) FROM maintenances WHERE type='preventive' AND status='completed') as prev_done,
      (SELECT COUNT(*) FROM maintenances WHERE type='corrective' AND status='completed') as corr_done
  `);

  res.json({
    parc:        { bysite: bysite.rows, bytype: bytype.rows, bystatus: bystatus.rows },
    maintenances:{ byType: maintByType.rows, byMonth: maintByMonth.rows, pending: maintPending.rows, upcoming: maintUpcoming.rows },
    interventions:{ byDept: interventByDept.rows, byTech: interventByTech.rows, pending: interventPending.rows, byMonth: interventByMonth.rows },
    totals:      totals.rows[0],
  });
}
