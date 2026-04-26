import { getDb } from "../../../lib/db";
import { requireAuth } from "../../../lib/auth";
import bcrypt from "bcryptjs";

export default async function handler(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;
  if (user.role !== "admin") return res.status(403).json({ error: "Accès réservé aux administrateurs" });
  const db = getDb();
  const { id } = req.query;

  if (req.method === "PUT") {
    const { full_name, email, role, is_active, password } = req.body;
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      await db.execute({ sql: "UPDATE users SET full_name=?, email=?, role=?, is_active=?, password_hash=? WHERE id=?", args: [full_name, email, role, is_active ?? 1, hash, id] });
    } else {
      await db.execute({ sql: "UPDATE users SET full_name=?, email=?, role=?, is_active=? WHERE id=?", args: [full_name, email, role, is_active ?? 1, id] });
    }
    const updated = await db.execute({ sql: "SELECT id, full_name, email, role, is_active, created_at FROM users WHERE id=?", args: [id] });
    return res.json(updated.rows[0]);
  }

  if (req.method === "DELETE") {
    if (String(id) === String(user.id)) return res.status(400).json({ error: "Impossible de supprimer votre propre compte" });
    await db.execute({ sql: "UPDATE users SET is_active = 0 WHERE id = ?", args: [id] });
    return res.json({ success: true });
  }

  res.status(405).end();
}
