function parseColors(value) {
  try { return typeof value === "string" ? JSON.parse(value || "{}") : value || {}; } catch { return {}; }
}

function colorTotal(value) {
  return Object.values(parseColors(value)).reduce((total, quantity) => total + Math.max(0, Number(quantity) || 0), 0);
}

// Synchronise les sorties de stock avec une intervention terminée.
export async function syncInterventionConsumables(db, interventionId, status, items = []) {
  const previous = await db.execute({sql:"SELECT consumable_id, quantity, color_quantities FROM intervention_consumables WHERE intervention_id=?",args:[Number(interventionId)]});
  const intervention = await db.execute({sql:"SELECT asset_id, department_id, date FROM interventions WHERE id=?",args:[Number(interventionId)]});
  const assetId = intervention.rows[0]?.asset_id || null;
  const departmentId = intervention.rows[0]?.department_id || null;
  const interventionDate = intervention.rows[0]?.date || null;
  const wanted = status === "done" ? items.filter(x=>Number(x.consumable_id)>0 && (colorTotal(x.color_quantities)>0 || Number(x.quantity)>0)) : [];
  const changes = new Map();
  const addChange = (consumableId, quantity, colors) => {
    const current = changes.get(consumableId) || { quantity: 0, colors: {} };
    current.quantity += quantity;
    Object.entries(parseColors(colors)).forEach(([color, value]) => { current.colors[color] = (current.colors[color] || 0) + Number(value || 0); });
    changes.set(consumableId, current);
  };
  previous.rows.forEach(x=>addChange(Number(x.consumable_id), Number(x.quantity), x.color_quantities));
  wanted.forEach(x=>addChange(Number(x.consumable_id), -Number(x.quantity || colorTotal(x.color_quantities)), Object.fromEntries(Object.entries(parseColors(x.color_quantities)).map(([color, value])=>[color, -Number(value || 0)]))));
  for (const item of previous.rows) {
    await db.execute({sql:"INSERT INTO consumable_movements (consumable_id,movement_type,quantity,note,asset_id,department_id,intervention_id,color_quantities) VALUES (?,?,?,?,?,?,?,?)",args:[Number(item.consumable_id),"in",Number(item.quantity || colorTotal(item.color_quantities)),"Annulation de l’utilisation précédente",assetId,departmentId,Number(interventionId),item.color_quantities || null]});
  }
  for (const [consumableId, change] of changes) {
    const c = await db.execute({sql:"SELECT stock_qty,name,color_stock,cartridge_type FROM consumables WHERE id=?",args:[consumableId]});
    if (!c.rows[0]) throw new Error("Consommable introuvable");
    const item = c.rows[0];
    const stockColors = parseColors(item.color_stock);
    const isColor = item.cartridge_type === "color" && Object.keys(stockColors).length > 0;
    if (isColor) {
      for (const [color, delta] of Object.entries(change.colors)) {
        if (delta < 0 && Number(stockColors[color] || 0) < -delta) throw new Error(`Stock insuffisant pour ${item.name} (${color})`);
        stockColors[color] = Math.max(0, Number(stockColors[color] || 0) + delta);
      }
      const total = colorTotal(stockColors);
      await db.execute({sql:"UPDATE consumables SET color_stock=?,stock_qty=?,updated_at=datetime('now') WHERE id=?",args:[JSON.stringify(stockColors),total,consumableId]});
    } else if (change.quantity !== 0) {
      if (change.quantity < 0 && Number(item.stock_qty) < -change.quantity) throw new Error(`Stock insuffisant pour ${item.name}`);
      await db.execute({sql:"UPDATE consumables SET stock_qty=stock_qty+?,updated_at=datetime('now') WHERE id=?",args:[change.quantity,consumableId]});
    }
  }
  await db.execute({sql:"DELETE FROM intervention_consumables WHERE intervention_id=?",args:[Number(interventionId)]});
  for (const item of wanted) {
    const quantity = Number(item.quantity || colorTotal(item.color_quantities));
    await db.execute({sql:"INSERT INTO intervention_consumables (intervention_id,consumable_id,quantity,color_quantities) VALUES (?,?,?,?)",args:[Number(interventionId),Number(item.consumable_id),quantity,Object.keys(parseColors(item.color_quantities)).length ? JSON.stringify(parseColors(item.color_quantities)) : null]});
    await db.execute({sql:"INSERT INTO consumable_movements (consumable_id,movement_type,quantity,note,asset_id,department_id,intervention_id,created_at,color_quantities) VALUES (?,?,?,?,?,?,?,?,?)",args:[Number(item.consumable_id),"out",quantity,"Utilisation dans une intervention",assetId,departmentId,Number(interventionId),interventionDate,item.color_quantities && Object.keys(parseColors(item.color_quantities)).length ? JSON.stringify(parseColors(item.color_quantities)) : null]});
  }
}
