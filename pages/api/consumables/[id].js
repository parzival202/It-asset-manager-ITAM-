import { getDb, initDb } from "../../../lib/db";
import { requireAuth } from "../../../lib/auth";
const empty = v => v === undefined || v === null || v === "" ? null : v;

export default async function handler(req,res) {
  const user=await requireAuth(req,res); if(!user)return; await initDb(); const db=getDb(); const id=Number(req.query.id);
  if(req.method==="GET") {
    const [item,movements,uses]=await Promise.all([
      db.execute({sql:"SELECT * FROM consumables WHERE id=?",args:[id]}),
      db.execute({sql:"SELECT * FROM consumable_movements WHERE consumable_id=? ORDER BY created_at DESC,id DESC",args:[id]}),
      db.execute({sql:`SELECT ic.quantity,i.title,i.date,d.name department_name,a.name asset_name FROM intervention_consumables ic JOIN interventions i ON i.id=ic.intervention_id LEFT JOIN departments d ON d.id=i.department_id LEFT JOIN assets a ON a.id=i.asset_id WHERE ic.consumable_id=? ORDER BY i.date DESC`,args:[id]})
    ]); if(!item.rows[0])return res.status(404).json({error:"Consommable introuvable"}); return res.json({...item.rows[0],movements:movements.rows,uses:uses.rows});
  }
  if(req.method==="PUT") {
    const {reference,name,category,cartridge_type,color,color_stock,initial_qty,compatible_printer,minimum_qty,unit_cost,supplier,notes}=req.body;
    const stockByColor = color_stock && typeof color_stock === "object" ? color_stock : {};
    const hasColorStock = category === "toner" && cartridge_type === "color";
    const stockQty = hasColorStock
      ? Object.values(stockByColor).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0)
      : Math.max(0, Number(initial_qty) || 0);
    try { await db.execute({sql:"UPDATE consumables SET reference=?,name=?,category=?,cartridge_type=?,color=?,color_stock=?,stock_qty=?,compatible_printer=?,minimum_qty=?,unit_cost=?,supplier=?,notes=?,updated_at=datetime('now') WHERE id=?",args:[reference,name,category||"toner",cartridge_type||"monochrome",empty(color),hasColorStock ? JSON.stringify(stockByColor) : null,stockQty,empty(compatible_printer),Math.max(0,Number(minimum_qty)||0),empty(unit_cost) === null ? null : Number(unit_cost),empty(supplier),empty(notes),id]}); const row=await db.execute({sql:"SELECT * FROM consumables WHERE id=?",args:[id]}); return res.json(row.rows[0]); } catch(e){return res.status(400).json({error:e.message});}
  }
  if(req.method==="DELETE") {
    try {
      await db.execute("BEGIN");
      await db.execute({sql:"DELETE FROM intervention_consumables WHERE consumable_id=?",args:[id]});
      await db.execute({sql:"DELETE FROM consumable_movements WHERE consumable_id=?",args:[id]});
      await db.execute({sql:"DELETE FROM consumables WHERE id=?",args:[id]});
      await db.execute("COMMIT");
      return res.json({success:true});
    } catch (e) { await db.execute("ROLLBACK"); return res.status(400).json({error:e.message}); }
  }
  res.status(405).end();
}
