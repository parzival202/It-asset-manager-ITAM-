import { getDb, initDb } from "../../../../lib/db";
import { requireAuth } from "../../../../lib/auth";
export default async function handler(req,res) {
  const user=await requireAuth(req,res); if(!user)return; await initDb(); const db=getDb(); const id=Number(req.query.id);
  if(req.method!=="POST")return res.status(405).end();
  const qty=Math.max(1,Number(req.body.quantity)||0); if(!qty)return res.status(400).json({error:"Quantité invalide"});
  const assetId = req.body.asset_id ? Number(req.body.asset_id) : null;
  const departmentId = req.body.department_id ? Number(req.body.department_id) : null;
  await db.execute("BEGIN"); try { await db.execute({sql:"UPDATE consumables SET stock_qty=stock_qty+?,updated_at=datetime('now') WHERE id=?",args:[qty,id]}); await db.execute({sql:"INSERT INTO consumable_movements (consumable_id,movement_type,quantity,note,asset_id,department_id) VALUES (?,?,?,?,?,?)",args:[id,"in",qty,req.body.note||"Entrée manuelle",assetId,departmentId]}); await db.execute("COMMIT"); const row=await db.execute({sql:"SELECT * FROM consumables WHERE id=?",args:[id]}); return res.json(row.rows[0]); } catch(e){await db.execute("ROLLBACK");return res.status(500).json({error:e.message});}
}
