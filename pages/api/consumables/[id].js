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
    const {reference,name,category,color,compatible_printer,minimum_qty,unit_cost,supplier,notes}=req.body;
    try { await db.execute({sql:"UPDATE consumables SET reference=?,name=?,category=?,color=?,compatible_printer=?,minimum_qty=?,unit_cost=?,supplier=?,notes=?,updated_at=datetime('now') WHERE id=?",args:[reference,name,category||"toner",empty(color),empty(compatible_printer),Math.max(0,Number(minimum_qty)||0),empty(unit_cost) === null ? null : Number(unit_cost),empty(supplier),empty(notes),id]}); const row=await db.execute({sql:"SELECT * FROM consumables WHERE id=?",args:[id]}); return res.json(row.rows[0]); } catch(e){return res.status(400).json({error:e.message});}
  }
  if(req.method==="DELETE") { await db.execute({sql:"DELETE FROM consumables WHERE id=?",args:[id]}); return res.json({success:true}); }
  res.status(405).end();
}
