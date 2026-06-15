import { getDb, initDb } from "../../lib/db";
import { requireAuth } from "../../lib/auth";

export default async function handler(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;
  await initDb(); // Créer tables seulement, pas de seed
  const db = getDb();
  const [sites, depts, users] = await Promise.all([
    db.execute("SELECT * FROM sites ORDER BY name"),
    db.execute("SELECT * FROM departments ORDER BY name"),
    db.execute("SELECT id, full_name, email, role FROM users WHERE is_active=1 ORDER BY full_name"),
  ]);
  res.json({ sites: sites.rows, departments: depts.rows, users: users.rows });
}
