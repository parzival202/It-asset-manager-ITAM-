import { getDb, initDb } from "../../../lib/db";
import { requireAuth } from "../../../lib/auth";

export default async function handler(req,res){
 const user=await requireAuth(req,res); if(!user)return; await initDb(); const db=getDb(); const {from,to,category,color}=req.query; const where=[],args=[];
 if(from){where.push("i.date>=?");args.push(from)} if(to){where.push("i.date<=?");args.push(to)} if(category){where.push("c.category=?");args.push(category)} if(color){where.push("c.color=?");args.push(color)} const w=where.length?`WHERE ${where.join(" AND ")}`:"";
 const movementWhere=[],movementArgs=[];
 if(from){movementWhere.push("date(m.created_at)>=?");movementArgs.push(from)} if(to){movementWhere.push("date(m.created_at)<=?");movementArgs.push(to)} if(category){movementWhere.push("c.category=?");movementArgs.push(category)} if(color){movementWhere.push("c.color=?");movementArgs.push(color)}
 const mw=movementWhere.length?`WHERE ${movementWhere.join(" AND ")}`:"";
 const [byService,topItems,byType,recent]=await Promise.all([
  db.execute({sql:`SELECT COALESCE(d.name,'Non affecté') name,SUM(ic.quantity) quantity FROM intervention_consumables ic JOIN interventions i ON i.id=ic.intervention_id JOIN consumables c ON c.id=ic.consumable_id LEFT JOIN departments d ON d.id=i.department_id ${w} GROUP BY d.id ORDER BY quantity DESC LIMIT 10`,args}),
  db.execute({sql:`SELECT c.name,c.reference,c.category,c.color,SUM(ic.quantity) quantity FROM intervention_consumables ic JOIN interventions i ON i.id=ic.intervention_id JOIN consumables c ON c.id=ic.consumable_id ${w} GROUP BY c.id ORDER BY quantity DESC LIMIT 10`,args}),
  db.execute({sql:`SELECT c.category name,SUM(ic.quantity) quantity FROM intervention_consumables ic JOIN interventions i ON i.id=ic.intervention_id JOIN consumables c ON c.id=ic.consumable_id ${w} GROUP BY c.category ORDER BY quantity DESC`,args}),
    db.execute({sql:`SELECT m.created_at date,c.name,c.reference,m.quantity,m.movement_type,m.note,COALESCE(i.performed_by,'—') consumer_name,COALESCE(d.name,'Non affecté') department_name,a.name asset_name
        FROM consumable_movements m JOIN consumables c ON c.id=m.consumable_id
      LEFT JOIN interventions i ON i.id=m.intervention_id LEFT JOIN departments d ON d.id=m.department_id LEFT JOIN assets a ON a.id=m.asset_id ${mw}
      UNION ALL
      SELECT i.date,c.name,c.reference,ic.quantity,'out','Utilisation historique',COALESCE(i.performed_by,'—'),COALESCE(d.name,'Non affecté'),a.name
      FROM intervention_consumables ic JOIN interventions i ON i.id=ic.intervention_id JOIN consumables c ON c.id=ic.consumable_id
      LEFT JOIN departments d ON d.id=i.department_id LEFT JOIN assets a ON a.id=i.asset_id
      WHERE NOT EXISTS (SELECT 1 FROM consumable_movements mx WHERE mx.intervention_id=i.id)
      ${where.length ? `AND ${where.join(" AND ")}` : ""}
      ORDER BY date DESC LIMIT 100`,args:[...movementArgs,...args]})
 ]);
 const stock=await db.execute("SELECT *, CASE WHEN stock_qty<=minimum_qty THEN 1 ELSE 0 END low_stock FROM consumables ORDER BY name");
 res.json({byService:byService.rows,topItems:topItems.rows,byType:byType.rows,recent:recent.rows,stock:stock.rows});
}
