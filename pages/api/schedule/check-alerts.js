import { getDb } from "../../../lib/db";
import { requireAuth } from "../../../lib/auth";
import { syncMaintenanceAlerts } from "../../../lib/maintenanceAlerts";

// Vérifie toutes les maintenances en cours et génère les alertes manquantes
export default async function handler(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return;
  if (req.method !== "POST") return res.status(405).end();

  const db = getDb();
  return res.json(await syncMaintenanceAlerts(db));
}
