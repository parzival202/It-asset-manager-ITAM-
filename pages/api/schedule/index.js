import { getDb } from "../../../lib/db";
import { requireAuth } from "../../../lib/auth";
import { PLANNING_2025, weekToDate, entryEndDate } from "../../../lib/planningData";

// GET — retourne le planning avec statut de chaque entrée
export default async function handler(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;
  if (req.method !== "GET") return res.status(405).end();

  const db   = getDb();
  const year = Number(req.query.year) || new Date().getFullYear();

  const departments = await db.execute("SELECT id, name FROM departments");
  const departmentIds = Object.fromEntries(departments.rows.map(dept => [dept.name, dept.id]));
  for (const entry of PLANNING_2025) {
    const departmentId = departmentIds[entry.dept_name];
    if (!departmentId) continue;
    const refKey = `schedule_${year}_${entry.month}_${entry.week_start}_${departmentId}`;
    await db.execute({
      sql: `UPDATE maintenances SET scheduled_date = ?, end_date = ?
            WHERE source = 'schedule' AND ref_key = ?`,
      args: [
        weekToDate(year, entry.month, entry.week_start),
        entryEndDate(year, entry.month, entry.week_start, entry.duration),
        refKey
      ]
    });
  }

  // Toutes les maintenances issues du planning pour cette année
  const tickets = await db.execute({
    sql: `SELECT m.*, d.name as dept_name, d.id as dept_id,
                 COALESCE(m.performed_by_name, u.full_name) as tech_name
          FROM maintenances m
          LEFT JOIN departments d ON m.department_id = d.id
          LEFT JOIN users u ON m.performed_by_user_id = u.id
          WHERE m.source = 'schedule'
            AND strftime('%Y', m.scheduled_date) = ?
          ORDER BY m.scheduled_date ASC`,
    args: [String(year)]
  });

  return res.json(tickets.rows);
}
