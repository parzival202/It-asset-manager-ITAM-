const { getDb, initDb } = require('./lib/db');

async function addDepartments() {
  try {
    await initDb();
    const db = getDb();

    const departmentsBySite = {
      Commercial: ['GMS', 'Magasin Produit Fini'],
      Plastique: ['Ressources Humaines'],
    };

    for (const [siteName, departmentNames] of Object.entries(departmentsBySite)) {
      const siteResult = await db.execute({
        sql: "SELECT id FROM sites WHERE name = ?",
        args: [siteName],
      });
      if (siteResult.rows.length === 0) {
        console.log(`❌ Site ${siteName} non trouvé`);
        continue;
      }

      const siteId = siteResult.rows[0].id;
      for (const departmentName of departmentNames) {
        const existing = await db.execute({
          sql: "SELECT id FROM departments WHERE site_id = ? AND lower(name) = lower(?)",
          args: [siteId, departmentName],
        });
        if (existing.rows.length > 0) {
          console.log(`✓ ${departmentName} est déjà présent sur le site ${siteName}`);
          continue;
        }

        await db.execute({
          sql: "INSERT INTO departments (site_id, name) VALUES (?, ?)",
          args: [siteId, departmentName],
        });
        console.log(`✓ ${departmentName} ajouté avec succès au site ${siteName}`);
      }
    }
  } catch (err) {
    console.error('❌ Erreur:', err.message);
  }
}

addDepartments();
