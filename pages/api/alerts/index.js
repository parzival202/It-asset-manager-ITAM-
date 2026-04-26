import { getDb } from "../../../lib/db";
import { requireAuth } from "../../../lib/auth";

export default async function handler(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;
  const db = getDb();

  if (req.method === "GET") {
    const result = await db.execute(`
      SELECT al.*, a.name as asset_name, a.asset_tag
      FROM alerts al
      LEFT JOIN assets a ON al.asset_id = a.id
      WHERE al.status = 'active'
      ORDER BY CASE al.severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END, al.created_at DESC
    `);
    return res.json(result.rows);
  }
  res.status(405).end();
}
