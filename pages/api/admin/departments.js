import { getDb, initDb } from "../../../lib/db";
import { requireAuth } from "../../../lib/auth";

export default async function handler(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;
  if (user.role !== "admin") {
    return res.status(403).json({ error: "Admin only" });
  }

  await initDb();
  const db = getDb();

  if (req.method === "GET") {
    // Lister tous les départements
    const result = await db.execute("SELECT d.*, s.name as site_name FROM departments d JOIN sites s ON d.site_id = s.id ORDER BY s.name, d.name");
    return res.json({ departments: result.rows });
  }

  if (req.method === "POST") {
    const { site_id, name } = req.body;
    
    if (!site_id || !name) {
      return res.status(400).json({ error: "site_id et name requis" });
    }

    try {
      // Vérifier site existe
      const siteCheck = await db.execute("SELECT id FROM sites WHERE id = ?", [site_id]);
      if (siteCheck.rows.length === 0) {
        return res.status(404).json({ error: "Site non trouvé" });
      }

      // Vérifier doublon
      const dupCheck = await db.execute(
        "SELECT id FROM departments WHERE site_id = ? AND name = ?",
        [site_id, name]
      );
      if (dupCheck.rows.length > 0) {
        return res.status(409).json({ error: "Ce département existe déjà sur ce site" });
      }

      // Insérer
      await db.execute(
        { sql: "INSERT INTO departments (site_id, name) VALUES (?,?)", args: [site_id, name] }
      );

      return res.status(201).json({ success: true, message: `${name} ajouté avec succès` });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  res.status(405).json({ error: "Method not allowed" });
}
