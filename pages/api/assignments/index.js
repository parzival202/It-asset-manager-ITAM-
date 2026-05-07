import { getDb } from "../../../lib/db";
import { requireAuth } from "../../../lib/auth";

function n(v) { return (v === undefined || v === "" || v === null) ? null : v; }

export default async function handler(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;
  const db = getDb();

  if (req.method === "GET") {
    const { asset_id } = req.query;
    let sql = `
      SELECT a.*, s.name as site_name, d.name as department_name
      FROM assignments a
      LEFT JOIN sites s ON a.site_id = s.id
      LEFT JOIN departments d ON a.department_id = d.id
      WHERE 1=1
    `;
    const args = [];
    if (asset_id) { sql += ` AND a.asset_id = ?`; args.push(Number(asset_id)); }
    sql += ` ORDER BY a.started_at DESC`;
    const result = await db.execute({ sql, args });
    return res.json(result.rows);
  }

  if (req.method === "POST") {
    const { asset_id, user_name, user_title, site_id, department_id, started_at, reason, asset_name_at_time } = req.body;
    if (!asset_id || !user_name || !started_at)
      return res.status(400).json({ error: "asset_id, user_name et started_at sont requis" });

    try {
      // Récupérer l'affectation active pour la clôturer proprement
      const current = await db.execute({
        sql: `SELECT id FROM assignments WHERE asset_id = ? AND ended_at IS NULL`,
        args: [Number(asset_id)]
      });
      if (current.rows.length > 0) {
        await db.execute({
          sql: `UPDATE assignments SET ended_at = ? WHERE id = ?`,
          args: [started_at, current.rows[0].id]
        });
      }

      // Créer la nouvelle affectation
      const r = await db.execute({
        sql: `INSERT INTO assignments (asset_id, user_name, user_title, site_id, department_id, started_at, reason, assigned_by, asset_name_at_time)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          Number(asset_id), n(user_name), n(user_title),
          n(site_id) ? Number(site_id) : null,
          n(department_id) ? Number(department_id) : null,
          n(started_at), n(reason), user.name, n(asset_name_at_time)
        ]
      });

      // Mettre à jour l'asset : nom utilisateur, titre, site ET service
      await db.execute({
        sql: `UPDATE assets SET
              assigned_user_name = ?,
              assigned_user_title = ?,
              site_id = COALESCE(?, site_id),
              department_id = COALESCE(?, department_id),
              updated_at = datetime('now')
              WHERE id = ?`,
        args: [
          n(user_name), n(user_title),
          n(site_id) ? Number(site_id) : null,
          n(department_id) ? Number(department_id) : null,
          Number(asset_id)
        ]
      });

      const created = await db.execute({
        sql: `SELECT a.*, s.name as site_name, d.name as department_name
              FROM assignments a
              LEFT JOIN sites s ON a.site_id = s.id
              LEFT JOIN departments d ON a.department_id = d.id
              WHERE a.id = ?`,
        args: [Number(r.lastInsertRowid)]
      });
      return res.status(201).json(created.rows[0]);
    } catch (err) {
      console.error("POST /api/assignments:", err);
      return res.status(500).json({ error: err.message });
    }
  }

  res.status(405).end();
}
