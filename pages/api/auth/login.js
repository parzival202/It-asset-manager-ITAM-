import { getDb, initDb, seedDb } from "../../../lib/db";
import { signToken } from "../../../lib/auth";
import bcrypt from "bcryptjs";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  await initDb();
  await seedDb();
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Champs manquants" });
  const db = getDb();
  const result = await db.execute({ sql: "SELECT * FROM users WHERE email = ? AND is_active = 1", args: [email] });
  const user = result.rows[0];
  if (!user) return res.status(401).json({ error: "Identifiants incorrects" });
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: "Identifiants incorrects" });
  const token = signToken({ id: user.id, email: user.email, role: user.role, name: user.full_name });
  res.json({ token, user: { id: user.id, email: user.email, role: user.role, name: user.full_name } });
}
