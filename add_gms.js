const { getDb, initDb } = require('./lib/db');

async function addGMS() {
  try {
    await initDb();
    const db = getDb();
    
    // Récupérer le site "Commercial"
    const sitesResult = await db.execute("SELECT id FROM sites WHERE name = 'Commercial'");
    if (sitesResult.rows.length === 0) {
      console.log('❌ Site Commercial non trouvé');
      return;
    }
    
    const siteId = sitesResult.rows[0].id;
    
    // Vérifier si GMS existe déjà
    const existing = await db.execute({ sql: "SELECT id FROM departments WHERE name = 'GMS'", args: [] });
    if (existing.rows.length > 0) {
      console.log('✓ GMS est déjà présent dans la base');
      return;
    }
    
    // Insérer GMS
    await db.execute({ sql: "INSERT INTO departments (site_id, name) VALUES (?,?)", args: [siteId, 'GMS'] });
    console.log('✓ GMS ajouté avec succès au site Commercial');
  } catch (err) {
    console.error('❌ Erreur:', err.message);
  }
}

addGMS();
