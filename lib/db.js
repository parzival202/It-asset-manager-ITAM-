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
    asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
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
}

export async function seedDb() {
  const db = getDb();
  const existing = await db.execute("SELECT COUNT(*) as c FROM users");
  if (Number(existing.rows[0].c) > 0) return;

  const bcrypt = (await import("bcryptjs")).default;
  const adminHash = await bcrypt.hash("admin123", 10);
  const techHash  = await bcrypt.hash("tech123", 10);

  await db.execute({ sql: "INSERT INTO sites (name) VALUES (?)", args: ["Site cosmetique"] });
  await db.execute({ sql: "INSERT INTO sites (name) VALUES (?)", args: ["Site siege"] });

  const sites = await db.execute("SELECT id, name FROM sites");
  const siteC = sites.rows.find(s => s.name === "Site cosmetique").id;
  const siteH = sites.rows.find(s => s.name === "Site siege").id;

  await db.execute({ sql: "INSERT INTO departments (site_id, name) VALUES (?,?)", args: [siteC, "Service technique"] });
  await db.execute({ sql: "INSERT INTO departments (site_id, name) VALUES (?,?)", args: [siteC, "Service qualite"] });
  await db.execute({ sql: "INSERT INTO departments (site_id, name) VALUES (?,?)", args: [siteH, "Administration"] });

  const depts = await db.execute("SELECT id, name FROM departments");
  const dTech  = depts.rows.find(d => d.name === "Service technique").id;
  const dQual  = depts.rows.find(d => d.name === "Service qualite").id;
  const dAdmin = depts.rows.find(d => d.name === "Administration").id;

  await db.execute({ sql: "INSERT INTO users (full_name,email,password_hash,role) VALUES (?,?,?,?)", args: ["Moussa Bamba","admin@local.test",adminHash,"admin"] });
  await db.execute({ sql: "INSERT INTO users (full_name,email,password_hash,role) VALUES (?,?,?,?)", args: ["Ange Kouassi","ange@local.test",techHash,"technician"] });

  const users = await db.execute("SELECT id,email FROM users");
  const admin = users.rows.find(u => u.email === "admin@local.test").id;
  const tech1 = users.rows.find(u => u.email === "ange@local.test").id;

  const d = (n) => new Date(Date.now() - n*86400000).toISOString().split("T")[0];
  const f = (n) => new Date(Date.now() + n*86400000).toISOString().split("T")[0];

  await db.execute({ sql: `INSERT INTO assets (asset_tag,name,type,status,brand,model,serial_number,operating_system,ram,storage,site_id,department_id,assigned_user_name,assigned_user_title,deployment_date,purchase_date,purchase_price,supplier,warranty_end_date,planned_end_of_life,maintenance_interval_days,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: ["AST-LAP-001","Dell Latitude 5540","laptop","in_service","Dell","Latitude 5540","DL5540-ABX-00231","Windows 11 Pro 23H2","16 Go","512 Go SSD",siteC,dTech,"Kouame Diabate","Responsable qualite",d(770),d(820),850000,"InfoTech CI",f(18),f(620),180,"Ventilateur bruyant. Batterie remplacee sous garantie."] });

  await db.execute({ sql: `INSERT INTO assets (asset_tag,name,type,status,brand,model,serial_number,site_id,department_id,assigned_user_name,assigned_user_title,deployment_date,purchase_date,purchase_price,supplier,warranty_end_date,planned_end_of_life,maintenance_interval_days) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: ["AST-SCR-014","Samsung ViewFinity 27","screen","in_service","Samsung","ViewFinity S61B","SM-VF27-88314",siteC,dQual,"Ines Yao","Controle qualite",d(400),d(460),180000,"Office Equip",f(120),f(800),365] });

  await db.execute({ sql: `INSERT INTO assets (asset_tag,name,type,status,brand,model,serial_number,site_id,department_id,assigned_user_name,assigned_user_title,deployment_date,purchase_date,purchase_price,supplier,warranty_end_date,planned_end_of_life,maintenance_interval_days,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: ["AST-PRI-003","HP LaserJet Pro 400","printer","maintenance","HP","LaserJet Pro 400","HP400-77293",siteH,dAdmin,"Service administratif","Equipe support",d(940),d(960),240000,"Bureau Plus",d(10),f(400),120,"Bourrage papier recurrent sur bac 2."] });

  const assets = await db.execute("SELECT id,asset_tag FROM assets");
  const laptop  = assets.rows.find(a => a.asset_tag === "AST-LAP-001").id;
  const printer = assets.rows.find(a => a.asset_tag === "AST-PRI-003").id;

  await db.execute({ sql: `INSERT INTO maintenances (asset_id,performed_by_user_id,performed_by_name,type,status,title,description,scheduled_date,completed_at,resolution_notes) VALUES (?,?,?,?,?,?,?,?,?,?)`,
    args: [laptop,tech1,"Ange Kouassi","preventive","completed","Maintenance preventive - nettoyage + MAJ OS","Controle systeme, nettoyage, MAJ Windows.",d(18),new Date(Date.now()-18*86400000).toISOString(),"RAS apres intervention."] });

  await db.execute({ sql: `INSERT INTO maintenances (asset_id,performed_by_user_id,performed_by_name,type,status,title,description,scheduled_date,completed_at,replacement_part,resolution_notes) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    args: [laptop,tech1,"Ange Kouassi","corrective","completed","Panne - batterie defaillante","Remplacement batterie.",d(96),new Date(Date.now()-96*86400000).toISOString(),"Batterie","Remplacee sous garantie."] });

  await db.execute({ sql: `INSERT INTO maintenances (asset_id,performed_by_user_id,performed_by_name,type,status,title,description,scheduled_date) VALUES (?,?,?,?,?,?,?,?)`,
    args: [laptop,admin,"Moussa Bamba","preventive","planned","Maintenance preventive - verification disque","SMART, temperature, optimisations.",f(12)] });

  await db.execute({ sql: `INSERT INTO maintenances (asset_id,type,status,title,description,scheduled_date,replacement_part) VALUES (?,?,?,?,?,?,?)`,
    args: [printer,"corrective","in_progress","Panne - bourrage papier recurrent","Diagnostic chemin papier.",d(1),"Kit rouleaux alimentation"] });

  await db.execute({ sql: `INSERT INTO alerts (asset_id,type,severity,status,title,message,due_date) VALUES (?,?,?,?,?,?,?)`,
    args: [laptop,"upcoming_maintenance","warning","active","Maintenance preventive dans 12 jours","La maintenance preventive du Dell Latitude 5540 est prevue dans moins de 14 jours.",f(12)] });
  await db.execute({ sql: `INSERT INTO alerts (asset_id,type,severity,status,title,message,due_date) VALUES (?,?,?,?,?,?,?)`,
    args: [laptop,"warranty_ending","warning","active","Garantie expirant dans 18 jours","La garantie du Dell Latitude 5540 expire dans moins de 30 jours.",f(18)] });
  await db.execute({ sql: `INSERT INTO alerts (asset_id,type,severity,status,title,message,due_date) VALUES (?,?,?,?,?,?,?)`,
    args: [printer,"overdue_maintenance","critical","active","Maintenance corrective ouverte depuis 1 jour","Un incident correctif est ouvert sur HP LaserJet Pro 400 sans resolution.",d(1)] });
}
