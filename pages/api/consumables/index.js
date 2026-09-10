import { getDb, initDb } from "../../../lib/db";
import { requireAuth } from "../../../lib/auth";

const empty = v => v === undefined || v === null || v === "" ? null : v;

export default async function handler(req, res) {
  const user = await requireAuth(req, res); if (!user) return;
  await initDb(); const db = getDb();
  if (req.method === "GET") {
    const rows = await db.execute(`SELECT c.*, COALESCE(SUM(CASE WHEN m.movement_type='in' THEN m.quantity WHEN m.movement_type='out' THEN -m.quantity ELSE 0 END),0) AS moved_qty
      FROM consumables c LEFT JOIN consumable_movements m ON m.consumable_id=c.id GROUP BY c.id ORDER BY c.name`);
    return res.json(rows.rows);
  }
  if (req.method === "POST") {
    const { reference, name, category, color, compatible_printer, minimum_qty, unit_cost, supplier, notes, initial_qty=0 } = req.body;
    if (!reference?.trim() || !name?.trim()) return res.status(400).json({error:"Référence et nom requis"});
    const qty = Math.max(0, Number(initial_qty)||0);
    try {
      const result = await db.execute({sql:`INSERT INTO consumables (reference,name,category,color,compatible_printer,stock_qty,minimum_qty,unit_cost,supplier,notes) VALUES (?,?,?,?,?,?,?,?,?,?)`, args:[reference.trim(),name.trim(),category||"toner",empty(color),empty(compatible_printer),qty,Math.max(0,Number(minimum_qty)||0),empty(unit_cost) === null ? null : Number(unit_cost),empty(supplier),empty(notes)]});
      if (qty) await db.execute({sql:"INSERT INTO consumable_movements (consumable_id,movement_type,quantity,note) VALUES (?,?,?,?)",args:[Number(result.lastInsertRowid),"in",qty,"Stock initial"]});
      const row = await db.execute({sql:"SELECT * FROM consumables WHERE id=?",args:[Number(result.lastInsertRowid)]});
      return res.status(201).json(row.rows[0]);
    } catch (e) { return res.status(400).json({error:e.message.includes("UNIQUE") ? "Cette référence existe déjà" : e.message}); }
  }
  res.status(405).end();
}
