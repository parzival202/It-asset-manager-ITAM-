import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET || "itam-super-secret-local-2025";

export function signToken(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: "24h" });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}

export function getTokenFromRequest(req) {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith("Bearer ")) return auth.slice(7);
  return null;
}

export async function requireAuth(req, res) {
  const token = getTokenFromRequest(req);
  if (!token) {
    res.status(401).json({ error: "Non authentifié" });
    return null;
  }
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Session expirée, veuillez vous reconnecter" });
    return null;
  }
  return payload;
}
