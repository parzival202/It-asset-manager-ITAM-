// Planning annuel fixe — lié aux noms exacts des départements dans la BDD
// month : 1-12, week_start : 1-4, duration : nombre de semaines
export const PLANNING_2025 = [
  { month:1,  week_start:1, duration:2, dept_name:"Direction Commerciale / Industrielle" },
  { month:2,  week_start:3, duration:2, dept_name:"Trésorerie" },
  { month:3,  week_start:2, duration:2, dept_name:"Comptabilité" },
  { month:4,  week_start:1, duration:2, dept_name:"Création / Design" },
  { month:4,  week_start:3, duration:2, dept_name:"Direction Administrative et Financière" },
  { month:5,  week_start:1, duration:2, dept_name:"Direction Générale" },
  { month:5,  week_start:2, duration:2, dept_name:"Informatique & Communication" },
  { month:5,  week_start:3, duration:2, dept_name:"Paie" },
  { month:6,  week_start:1, duration:2, dept_name:"Marketing" },
  { month:6,  week_start:3, duration:2, dept_name:"Export" },
  { month:7,  week_start:1, duration:2, dept_name:"Facturation" },
  { month:7,  week_start:3, duration:2, dept_name:"Juridique" },
  { month:8,  week_start:1, duration:2, dept_name:"Informatique" },
  { month:8,  week_start:3, duration:2, dept_name:"Laboratoire" },
  { month:9,  week_start:1, duration:2, dept_name:"Marketing" },
  { month:9,  week_start:3, duration:2, dept_name:"Ressources Humaines" },
  { month:10, week_start:1, duration:2, dept_name:"Production Générale" },
  { month:10, week_start:3, duration:2, dept_name:"Qualité" },
  { month:11, week_start:1, duration:2, dept_name:"Ravitaillement" },
  { month:11, week_start:3, duration:2, dept_name:"Transit" },
  { month:12, week_start:3, duration:2, dept_name:"Achats" },
];

export const MONTHS = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];
export const MONTH_NAMES = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

export function getCurrentMonth() { return new Date().getMonth() + 1; }
export function getCurrentWeek() { return Math.ceil(new Date().getDate() / 7); }

// Convertit mois+semaine en date réelle (lundi de cette semaine)
export function weekToDate(year, month, week) {
  const firstDay = new Date(year, month - 1, 1);
  const dayOffset = (week - 1) * 7;
  const d = new Date(firstDay.getTime() + dayOffset * 86400000);
  return d.toISOString().split("T")[0];
}

// Date de fin d'une entrée du planning
export function entryEndDate(year, month, week_start, duration) {
  const start = new Date(year, month - 1, 1);
  const endOffset = (week_start - 1 + duration) * 7 - 1;
  const end = new Date(start.getTime() + endOffset * 86400000);
  return end.toISOString().split("T")[0];
}
