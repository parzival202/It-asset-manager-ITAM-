import { createClient } from "@libsql/client";
import path from "path";
import fs from "fs";

let _client = null;

export function getDb() {
  if (!_client) {
    const dbDir = path.join(process.cwd(), "data");
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
    _client = createClient({ url: `file:${path.join(dbDir, "itam.db")}` });
  }
  return _client;
}

export async function initDb() {
  const db = getDb();
  await db.execute(`CREATE TABLE IF NOT EXISTS sites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS departments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    site_id INTEGER NOT NULL REFERENCES sites(id),
    name TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'technician',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_tag TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'in_service',
    brand TEXT,
    model TEXT,
    serial_number TEXT,
    operating_system TEXT,
    ram TEXT,
    storage TEXT,
    site_id INTEGER REFERENCES sites(id),
    department_id INTEGER REFERENCES departments(id),
    assigned_user_name TEXT,
    assigned_user_title TEXT,
    deployment_date TEXT,
    purchase_date TEXT,
    purchase_price REAL,
    supplier TEXT,
    warranty_end_date TEXT,
    planned_end_of_life TEXT,
    maintenance_interval_days INTEGER DEFAULT 180,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS maintenances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id INTEGER REFERENCES assets(id) ON DELETE CASCADE,
    performed_by_user_id INTEGER REFERENCES users(id),
    performed_by_name TEXT,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'planned',
    title TEXT NOT NULL,
    description TEXT,
    scheduled_date TEXT,
    completed_at TEXT,
    replacement_part TEXT,
    resolution_notes TEXT,
    cost REAL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);

  // Migration: if an existing maintenances table has asset_id marked NOT NULL,
  // recreate the table without the NOT NULL constraint and copy existing data.
  try {
    const info = await db.execute("PRAGMA table_info(maintenances)");
    const assetCol = (info && info.rows) ? info.rows.find(r => r.name === 'asset_id') : null;
    if (assetCol && assetCol.notnull === 1) {
      console.log('🔧 Migrating maintenances table to allow nullable asset_id');
      await db.execute('PRAGMA foreign_keys=OFF');
      await db.execute('BEGIN TRANSACTION');
      await db.execute(`CREATE TABLE IF NOT EXISTS maintenances_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        asset_id INTEGER REFERENCES assets(id) ON DELETE CASCADE,
        performed_by_user_id INTEGER REFERENCES users(id),
        performed_by_name TEXT,
        type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'planned',
        title TEXT NOT NULL,
        description TEXT,
        scheduled_date TEXT,
        completed_at TEXT,
        replacement_part TEXT,
        resolution_notes TEXT,
        cost REAL,
        end_date TEXT,
        department_id INTEGER REFERENCES departments(id),
        source TEXT DEFAULT 'manual',
        ref_key TEXT UNIQUE,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )`);

      const colsRes = await db.execute("PRAGMA table_info(maintenances)");
      const cols = (colsRes.rows||[]).map(r => r.name).join(', ');
      if (cols && cols.length > 0) {
        await db.execute(`INSERT INTO maintenances_new (${cols}) SELECT ${cols} FROM maintenances`);
      }
      await db.execute('DROP TABLE maintenances');
      await db.execute("ALTER TABLE maintenances_new RENAME TO maintenances");
      await db.execute('COMMIT');
      await db.execute('PRAGMA foreign_keys=ON');
    }
  } catch (e) {
    console.error('Maintenance migration skipped or failed:', e);
  }

  await db.execute(`ALTER TABLE maintenances ADD COLUMN end_date TEXT`).catch(()=>{});
  await db.execute(`ALTER TABLE maintenances ADD COLUMN department_id INTEGER REFERENCES departments(id)`).catch(()=>{});
  await db.execute(`ALTER TABLE maintenances ADD COLUMN source TEXT DEFAULT 'manual'`).catch(()=>{});
  await db.execute(`ALTER TABLE maintenances ADD COLUMN ref_key TEXT`).catch(()=>{});
  await db.execute(`ALTER TABLE alerts ADD COLUMN maintenance_id INTEGER REFERENCES maintenances(id) ON DELETE CASCADE`).catch(()=>{});
  await db.execute(`ALTER TABLE maintenances ADD COLUMN end_date TEXT`).catch(()=>{});
  await db.execute(`ALTER TABLE maintenances ADD COLUMN department_id INTEGER REFERENCES departments(id)`).catch(()=>{});
  await db.execute(`ALTER TABLE maintenances ADD COLUMN source TEXT DEFAULT 'manual'`).catch(()=>{});
  await db.execute(`ALTER TABLE maintenances ADD COLUMN ref_key TEXT UNIQUE`).catch(()=>{});
  await db.execute(`ALTER TABLE alerts ADD COLUMN maintenance_id INTEGER REFERENCES maintenances(id) ON DELETE CASCADE`).catch(()=>{});

  await db.execute(`CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id INTEGER REFERENCES assets(id) ON DELETE CASCADE,
    maintenance_id INTEGER REFERENCES maintenances(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'info',
    status TEXT NOT NULL DEFAULT 'active',
    title TEXT NOT NULL,
    message TEXT,
    due_date TEXT,
    created_at TEXT DEFAULT (datetime('now'))
    )`);
  await db.execute(`CREATE TABLE IF NOT EXISTS assignments (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id       INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    user_name      TEXT NOT NULL,
    user_title     TEXT,
    site_id        INTEGER REFERENCES sites(id),
    department_id  INTEGER REFERENCES departments(id),
    started_at     TEXT NOT NULL,
    ended_at       TEXT,
    reason         TEXT,
    assigned_by    TEXT,
    created_at     TEXT DEFAULT (datetime('now'))
  )`);

  await db.execute(`ALTER TABLE assignments ADD COLUMN asset_name_at_time TEXT`).catch(()=>{});
  
  await db.execute(`CREATE TABLE IF NOT EXISTS interventions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  title         TEXT NOT NULL,
  description   TEXT,
  site_id       INTEGER REFERENCES sites(id),
  department_id INTEGER REFERENCES departments(id),
  asset_id      INTEGER REFERENCES assets(id),
  performed_by  TEXT,
  status        TEXT NOT NULL DEFAULT 'done',
  date          TEXT NOT NULL,
  duration_min  INTEGER,
  created_at    TEXT DEFAULT (datetime('now'))
  )`);
}

export async function seedDb() {
  const db = getDb();

  const existingSites = await db.execute("SELECT COUNT(*) as c FROM sites");
  if (Number(existingSites.rows[0].c) > 0) {
      console.log("📋 Base déjà peuplée. Seed ignoré.");
      return;
  }

  const existing = await db.execute("SELECT COUNT(*) as c FROM users");
  if (Number(existing.rows[0].c) > 0) return;

  const bcrypt = (await import("bcryptjs")).default;
  const adminHash = await bcrypt.hash("admin123", 10);
  const techHash  = await bcrypt.hash("tech123", 10);

  // 1. Insertion des Sites
  await db.execute({ sql: "INSERT INTO sites (name) VALUES (?)", args: ["Commercial"] });
  await db.execute({ sql: "INSERT INTO sites (name) VALUES (?)", args: ["Plastique"] });
  await db.execute({ sql: "INSERT INTO sites (name) VALUES (?)", args: ["Cosmétique"] });

  const sitesResult = await db.execute("SELECT id, name FROM sites");
  const siteCo = sitesResult.rows.find(s => s.name === "Commercial").id;
  const siteP = sitesResult.rows.find(s => s.name === "Plastique").id;
  const siteC = sitesResult.rows.find(s => s.name === "Cosmétique").id;

  // 2. Insertion des Départements (Basé sur ton image)
  await db.execute({ sql: "INSERT INTO departments (site_id, name) VALUES (?,?)", args: [siteC, "Achats"] });
  await db.execute({ sql: "INSERT INTO departments (site_id, name) VALUES (?,?)", args: [siteC, "Atelier"] });
  await db.execute({ sql: "INSERT INTO departments (site_id, name) VALUES (?,?)", args: [siteP, "Atelier Plastique"] });
  await db.execute({ sql: "INSERT INTO departments (site_id, name) VALUES (?,?)", args: [siteC, "Bureau d’Étude"] });
  await db.execute({ sql: "INSERT INTO departments (site_id, name) VALUES (?,?)", args: [siteC, "Cap Ouest"] });
  await db.execute({ sql: "INSERT INTO departments (site_id, name) VALUES (?,?)", args: [siteC, "Communication"] });
  await db.execute({ sql: "INSERT INTO departments (site_id, name) VALUES (?,?)", args: [siteC, "Commandes"] });
  await db.execute({ sql: "INSERT INTO departments (site_id, name) VALUES (?,?)", args: [siteC, "Comptabilité"] });
  await db.execute({ sql: "INSERT INTO departments (site_id, name) VALUES (?,?)", args: [siteC, "Création / Design"] });
  await db.execute({ sql: "INSERT INTO departments (site_id, name) VALUES (?,?)", args: [siteC, "Direction Administrative et Financière"] });
  await db.execute({ sql: "INSERT INTO departments (site_id, name) VALUES (?,?)", args: [siteCo, "Direction Commerciale / Industrielle"] });
  await db.execute({ sql: "INSERT INTO departments (site_id, name) VALUES (?,?)", args: [siteC, "Direction Générale"] });
  await db.execute({ sql: "INSERT INTO departments (site_id, name) VALUES (?,?)", args: [siteP, "Direction Plastique"] });
  await db.execute({ sql: "INSERT INTO departments (site_id, name) VALUES (?,?)", args: [siteP, "Études Plastiques"] });
  await db.execute({ sql: "INSERT INTO departments (site_id, name) VALUES (?,?)", args: [siteCo, "Export"] });
  await db.execute({ sql: "INSERT INTO departments (site_id, name) VALUES (?,?)", args: [siteCo, "Facturation"] });
  await db.execute({ sql: "INSERT INTO departments (site_id, name) VALUES (?,?)", args: [siteCo, "Garage / Parc Auto"] });
  await db.execute({ sql: "INSERT INTO departments (site_id, name) VALUES (?,?)", args: [siteC, "Infirmerie"] });
  await db.execute({ sql: "INSERT INTO departments (site_id, name) VALUES (?,?)", args: [siteC, "Informatique & Communication"] });
  await db.execute({ sql: "INSERT INTO departments (site_id, name) VALUES (?,?)", args: [siteC, "Informatique"] });
  await db.execute({ sql: "INSERT INTO departments (site_id, name) VALUES (?,?)", args: [siteC, "Juridique"] });
  await db.execute({ sql: "INSERT INTO departments (site_id, name) VALUES (?,?)", args: [siteC, "Laboratoire"] });
  await db.execute({ sql: "INSERT INTO departments (site_id, name) VALUES (?,?)", args: [siteP, "Magasin Plastique"] });
  await db.execute({ sql: "INSERT INTO departments (site_id, name) VALUES (?,?)", args: [siteCo, "Marketing"] });
  await db.execute({ sql: "INSERT INTO departments (site_id, name) VALUES (?,?)", args: [siteC, "Matières Premières Fabrication"] });
  await db.execute({ sql: "INSERT INTO departments (site_id, name) VALUES (?,?)", args: [siteC, "Paie"] });
  await db.execute({ sql: "INSERT INTO departments (site_id, name) VALUES (?,?)", args: [siteP, "Production Plastique"] });
  await db.execute({ sql: "INSERT INTO departments (site_id, name) VALUES (?,?)", args: [siteC, "Production Générale"] });
  await db.execute({ sql: "INSERT INTO departments (site_id, name) VALUES (?,?)", args: [siteC, "Qualité"] });
  await db.execute({ sql: "INSERT INTO departments (site_id, name) VALUES (?,?)", args: [siteC, "Ravitaillement"] });
  await db.execute({ sql: "INSERT INTO departments (site_id, name) VALUES (?,?)", args: [siteC, "Ressources Humaines"] });
  await db.execute({ sql: "INSERT INTO departments (site_id, name) VALUES (?,?)", args: [siteC, "Secrétariat DAF"] });
  await db.execute({ sql: "INSERT INTO departments (site_id, name) VALUES (?,?)", args: [siteP, "Secrétariat Plastique"] });
  await db.execute({ sql: "INSERT INTO departments (site_id, name) VALUES (?,?)", args: [siteC, "Transit"] });
  await db.execute({ sql: "INSERT INTO departments (site_id, name) VALUES (?,?)", args: [siteC, "Trésorerie"] });
  await db.execute({ sql: "INSERT INTO departments (site_id, name) VALUES (?,?)", args: [siteC, "Service Technique"] });
  await db.execute({ sql: "INSERT INTO departments (site_id, name) VALUES (?,?)", args: [siteP, "Service Technique Plastique"] });
  await db.execute({ sql: "INSERT INTO departments (site_id, name) VALUES (?,?)", args: [siteCo, "Service Commerciale"] });
  await db.execute({ sql: "INSERT INTO departments (site_id, name) VALUES (?,?)", args: [siteC, "Magasin Matière première "] });
  await db.execute({ sql: "INSERT INTO departments (site_id, name) VALUES (?,?)", args: [siteCo, "Magasin Produit Fini"] });
  await db.execute({ sql: "INSERT INTO departments (site_id, name) VALUES (?,?)", args: [siteCo, "Force de vente"] });
  await db.execute({ sql: "INSERT INTO departments (site_id, name) VALUES (?,?)", args: [siteCo, "GMS"] });
  
  const deptsResult = await db.execute("SELECT id, name FROM departments");
  const dInfo  = deptsResult.rows.find(d => d.name === "Informatique").id;
  const dQual  = deptsResult.rows.find(d => d.name === "Qualité").id;
  const dAdmin = deptsResult.rows.find(d => d.name === "Direction Administrative et Financière").id;

  // 3. Insertion des Utilisateurs
  await db.execute({ sql: "INSERT INTO users (full_name,email,password_hash,role) VALUES (?,?,?,?)", args: ["Moussa Bamba","admin@local.test",adminHash,"admin"] });
  await db.execute({ sql: "INSERT INTO users (full_name,email,password_hash,role) VALUES (?,?,?,?)", args: ["Ange Kouassi","ange@local.test",techHash,"technician"] });

  const usersResult = await db.execute("SELECT id,email FROM users");
  const adminId = usersResult.rows.find(u => u.email === "admin@local.test").id;
  const techId = usersResult.rows.find(u => u.email === "ange@local.test").id;

  const d = (n) => new Date(Date.now() - n*86400000).toISOString().split("T")[0];
  const f = (n) => new Date(Date.now() + n*86400000).toISOString().split("T")[0];

  // 4. Insertion des Assets (Équipements)
  await db.execute({ sql: `INSERT INTO assets (asset_tag,name,type,status,brand,model,serial_number,operating_system,ram,storage,site_id,department_id,assigned_user_name,assigned_user_title,deployment_date,purchase_date,purchase_price,supplier,warranty_end_date,planned_end_of_life,maintenance_interval_days,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: ["AST-LAP-001","Dell Latitude 5540","laptop","in_service","Dell","Latitude 5540","DL5540-ABX-00231","Windows 11 Pro 23H2","16 Go","512 Go SSD",siteC,dInfo,"Kouame Diabate","Responsable Informatique",d(770),d(820),850000,"InfoTech CI",f(18),f(620),180,"Ventilateur bruyant. Batterie remplacee sous garantie."] });

  await db.execute({ sql: `INSERT INTO assets (asset_tag,name,type,status,brand,model,serial_number,site_id,department_id,assigned_user_name,assigned_user_title,deployment_date,purchase_date,purchase_price,supplier,warranty_end_date,planned_end_of_life,maintenance_interval_days) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: ["AST-SCR-014","Samsung ViewFinity 27","screen","in_service","Samsung","ViewFinity S61B","SM-VF27-88314",siteC,dQual,"Ines Yao","Controle qualite",d(400),d(460),180000,"Office Equip",f(120),f(800),365] });

  await db.execute({ sql: `INSERT INTO assets (asset_tag,name,type,status,brand,model,serial_number,site_id,department_id,assigned_user_name,assigned_user_title,deployment_date,purchase_date,purchase_price,supplier,warranty_end_date,planned_end_of_life,maintenance_interval_days,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: ["AST-PRI-003","HP LaserJet Pro 400","printer","maintenance","HP","LaserJet Pro 400","HP400-77293",siteC,dAdmin,"Service administratif","Equipe support",d(940),d(960),240000,"Bureau Plus",d(10),f(400),120,"Bourrage papier recurrent sur bac 2."] });

  const assetsResult = await db.execute("SELECT id,asset_tag FROM assets");
  const laptopId  = assetsResult.rows.find(a => a.asset_tag === "AST-LAP-001").id;
  const printerId = assetsResult.rows.find(a => a.asset_tag === "AST-PRI-003").id;

  // 5. Maintenances
  await db.execute({ sql: `INSERT INTO maintenances (asset_id,performed_by_user_id,performed_by_name,type,status,title,description,scheduled_date,completed_at,resolution_notes) VALUES (?,?,?,?,?,?,?,?,?,?)`,
    args: [laptopId,techId,"Ange Kouassi","preventive","completed","Maintenance preventive - nettoyage + MAJ OS","Controle systeme, nettoyage, MAJ Windows.",d(18),new Date(Date.now()-18*86400000).toISOString(),"RAS apres intervention."] });

  await db.execute({ sql: `INSERT INTO maintenances (asset_id,performed_by_user_id,performed_by_name,type,status,title,description,scheduled_date,completed_at,replacement_part,resolution_notes) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    args: [laptopId,techId,"Ange Kouassi","corrective","completed","Panne - batterie defaillante","Remplacement batterie.",d(96),new Date(Date.now()-96*86400000).toISOString(),"Batterie","Remplacee sous garantie."] });

  await db.execute({ sql: `INSERT INTO maintenances (asset_id,performed_by_user_id,performed_by_name,type,status,title,description,scheduled_date) VALUES (?,?,?,?,?,?,?,?)`,
    args: [laptopId,adminId,"Moussa Bamba","preventive","planned","Maintenance preventive - verification disque","SMART, temperature, optimisations.",f(12)] });

  await db.execute({ sql: `INSERT INTO maintenances (asset_id,type,status,title,description,scheduled_date,replacement_part) VALUES (?,?,?,?,?,?,?)`,
    args: [printerId,"corrective","in_progress","Panne - bourrage papier recurrent","Diagnostic chemin papier.",d(1),"Kit rouleaux alimentation"] });
  
  // 6. Alertes
  await db.execute({ sql: `INSERT INTO alerts (asset_id,type,severity,status,title,message,due_date) VALUES (?,?,?,?,?,?,?)`,
    args: [laptopId,"upcoming_maintenance","warning","active","Maintenance preventive dans 12 jours","La maintenance preventive du Dell Latitude 5540 est prevue dans moins de 14 jours.",f(12)] });
  await db.execute({ sql: `INSERT INTO alerts (asset_id,type,severity,status,title,message,due_date) VALUES (?,?,?,?,?,?,?)`,
    args: [laptopId,"warranty_ending","warning","active","Garantie expirant dans 18 jours","La garantie du Dell Latitude 5540 expire dans moins de 30 jours.",f(18)] });
  await db.execute({ sql: `INSERT INTO alerts (asset_id,type,severity,status,title,message,due_date) VALUES (?,?,?,?,?,?,?)`,
    args: [printerId,"overdue_maintenance","critical","active","Maintenance corrective ouverte depuis 1 jour","Un incident correctif est ouvert sur HP LaserJet Pro 400 sans resolution.",d(1)] });
}