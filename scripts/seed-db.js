/**
 * Script de seed indépendant
 * Exécution : node scripts/seed-db.js
 * 
 * ⚠️  Ne modifie la base que si elle est vide.
 * Pour ajouter des données ultérieurement, utiliser l'API d'admin.
 */

const { getDb, initDb, seedDb } = require('../lib/db');

async function runSeed() {
  try {
    console.log('🔄 Initialisation des tables...');
    await initDb();
    
    console.log('📝 Peuplement de la base...');
    await seedDb();
    
    console.log('✅ Seed complète !');
    console.log('\n📋 Données initiales ajoutées :');
    console.log('  • 3 sites (Commercial, Plastique, Cosmétique)');
    console.log('  • 43 départements');
    console.log('  • 2 utilisateurs (admin123, tech123)');
    console.log('  • 3 équipements de test');
    console.log('\n💡 Pour ajouter des données ultérieurement :');
    console.log('   POST /api/admin/departments { site_id: X, name: "Nouveau service" }');
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  }
}

runSeed();
