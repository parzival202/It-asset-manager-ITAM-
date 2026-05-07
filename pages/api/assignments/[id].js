import { getDb } from "../../../lib/db";
import { requireAuth } from "../../../lib/auth";

function n(v) { return (v === undefined || v === "" || v === null) ? null : v; }

export default async function handler(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;
  const db = getDb();
  const { id } = req.query;

  // PUT — modifier une affectation (active ou historique)
  if (req.method === "PUT") {
    const { user_name, user_title, site_id, department_id, started_at, ended_at, reason, asset_name_at_time } = req.body;
    try {
      await db.execute({
        sql: `UPDATE assignments SET
              user_name = ?, user_title = ?, site_id = ?, department_id = ?,
              started_at = ?, ended_at = ?, reason = ?, asset_name_at_time = ?
              WHERE id = ?`,
        args: [
          n(user_name), n(user_title),
          n(site_id) ? Number(site_id) : null,
          n(department_id) ? Number(department_id) : null,
          n(started_at), n(ended_at), n(reason), n(asset_name_at_time),
          Number(id)
        ]
      });

      // Si c'est l'affectation active (pas de ended_at), mettre à jour l'asset aussi
      const asgn = await db.execute({ sql: `SELECT * FROM assignments WHERE id = ?`, args: [Number(id)] });
      if (asgn.rows[0] && !asgn.rows[0].ended_at) {
        await db.execute({
          sql: `UPDATE assets SET assigned_user_name = ?, assigned_user_title = ?,
                site_id = COALESCE(?, site_id), department_id = COALESCE(?, department_id),
                updated_at = datetime('now') WHERE id = ?`,
          args: [
            n(user_name), n(user_title),
            n(site_id) ? Number(site_id) : null,
            n(department_id) ? Number(department_id) : null,
            asgn.rows[0].asset_id
          ]
        });
      }

      const updated = await db.execute({
        sql: `SELECT a.*, s.name as site_name, d.name as department_name
              FROM assignments a
              LEFT JOIN sites s ON a.site_id = s.id
              LEFT JOIN departments d ON a.department_id = d.id
              WHERE a.id = ?`,
        args: [Number(id)]
      });
      return res.json(updated.rows[0]);
    } catch (err) {
      console.error("PUT /api/assignments/[id]:", err);
      return res.status(500).json({ error: err.message });
    }
  }

  // DELETE — supprimer une affectation de l'historique
  if (req.method === "DELETE") {
    if (user.role !== "admin") return res.status(403).json({ error: "Réservé aux administrateurs" });
    await db.execute({ sql: `DELETE FROM assignments WHERE id = ?`, args: [Number(id)] });
    return res.json({ success: true });
  }

  res.status(405).end();
}
