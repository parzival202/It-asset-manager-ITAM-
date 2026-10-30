const { getDb, initDb } = require('./lib/db');

async function addCommercialDepartments() {
  try {
    await initDb();
    const db = getDb();
    
    const siteResult = await db.execute({
      sql: "SELECT id FROM sites WHERE name = ?",
      args: ['Commercial'],
    });
    if (siteResult.rows.length === 0) {
      console.log('❌ Site Commercial non trouvé');
      return;
    }
    
    const siteId = siteResult.rows[0].id;
    
    for (const departmentName of ['GMS', 'Magasin Produit Fini']) {
      const existing = await db.execute({
        sql: "SELECT id FROM departments WHERE site_id = ? AND name = ?",
        args: [siteId, departmentName],
      });
      if (existing.rows.length > 0) {
        console.log(`✓ ${departmentName} est déjà présent sur le site Commercial`);
        continue;
      }

      await db.execute({
        sql: "INSERT INTO departments (site_id, name) VALUES (?, ?)",
        args: [siteId, departmentName],
      });
      console.log(`✓ ${departmentName} ajouté avec succès au site Commercial`);
    }
  } catch (err) {
    console.error('❌ Erreur:', err.message);
  }
}

addCommercialDepartments();
