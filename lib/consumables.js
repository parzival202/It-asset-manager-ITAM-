// Synchronise les sorties de stock avec une intervention terminée.
export async function syncInterventionConsumables(db, interventionId, status, items = []) {
  const previous = await db.execute({sql:"SELECT consumable_id, quantity FROM intervention_consumables WHERE intervention_id=?",args:[Number(interventionId)]});
  const wanted = status === "done" ? items.filter(x=>Number(x.consumable_id)>0 && Number(x.quantity)>0) : [];
  const delta = new Map();
  previous.rows.forEach(x=>delta.set(Number(x.consumable_id),(delta.get(Number(x.consumable_id))||0)+Number(x.quantity)));
  wanted.forEach(x=>delta.set(Number(x.consumable_id),(delta.get(Number(x.consumable_id))||0)-Number(x.quantity)));
  for (const [consumableId, change] of delta) {
    if (change > 0) await db.execute({sql:"UPDATE consumables SET stock_qty=stock_qty+?,updated_at=datetime('now') WHERE id=?",args:[change,consumableId]});
    if (change < 0) {
      const c=await db.execute({sql:"SELECT stock_qty,name FROM consumables WHERE id=?",args:[consumableId]});
      if (!c.rows[0] || Number(c.rows[0].stock_qty) < -change) throw new Error(`Stock insuffisant pour ${c.rows[0]?.name||"ce consommable"}`);
      await db.execute({sql:"UPDATE consumables SET stock_qty=stock_qty+?,updated_at=datetime('now') WHERE id=?",args:[change,consumableId]});
    }
  }
  await db.execute({sql:"DELETE FROM intervention_consumables WHERE intervention_id=?",args:[Number(interventionId)]});
  for (const item of wanted) await db.execute({sql:"INSERT INTO intervention_consumables (intervention_id,consumable_id,quantity) VALUES (?,?,?)",args:[Number(interventionId),Number(item.consumable_id),Number(item.quantity)]});
}
