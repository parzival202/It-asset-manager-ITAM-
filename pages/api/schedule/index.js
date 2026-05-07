import { getDb } from "../../../lib/db";
import { requireAuth } from "../../../lib/auth";

// GET — retourne le planning avec statut de chaque entrée
export default async function handler(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;
  if (req.method !== "GET") return res.status(405).end();

  const db   = getDb();
  const year = Number(req.query.year) || new Date().getFullYear();

  // Toutes les maintenances issues du planning pour cette année
  const tickets = await db.execute({
    sql: `SELECT m.*, d.name as dept_name, d.id as dept_id
          FROM maintenances m
          LEFT JOIN departments d ON m.department_id = d.id
          WHERE m.source = 'schedule'
            AND strftime('%Y', m.scheduled_date) = ?
          ORDER BY m.scheduled_date ASC`,
    args: [String(year)]
  });

  return res.json(tickets.rows);
}
