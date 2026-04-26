import { getDb } from "../../../lib/db";
import { requireAuth } from "../../../lib/auth";
import bcrypt from "bcryptjs";

export default async function handler(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;
  const db = getDb();

  if (req.method === "GET") {
    const result = await db.execute(
      "SELECT id, full_name, email, role, is_active, created_at FROM users ORDER BY full_name"
    );
    return res.json(result.rows);
  }

  if (req.method === "POST") {
    if (user.role !== "admin") return res.status(403).json({ error: "Accès réservé aux administrateurs" });
    const { full_name, email, password, role } = req.body;
    if (!full_name || !email || !password) return res.status(400).json({ error: "Nom, email et mot de passe requis" });
    const existing = await db.execute({ sql: "SELECT id FROM users WHERE email = ?", args: [email] });
    if (existing.rows.length > 0) return res.status(409).json({ error: "Cet email est déjà utilisé" });
    const hash = await bcrypt.hash(password, 10);
    const r = await db.execute({
      sql: "INSERT INTO users (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)",
      args: [full_name, email, hash, role || "technician"]
    });
    const created = await db.execute({ sql: "SELECT id, full_name, email, role, is_active, created_at FROM users WHERE id = ?", args: [Number(r.lastInsertRowid)] });
    return res.status(201).json(created.rows[0]);
  }

  res.status(405).end();
}
