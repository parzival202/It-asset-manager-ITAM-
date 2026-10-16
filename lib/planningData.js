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

function formatDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function addBusinessDays(date, count) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  let added = 0;
  while (added < count) {
    result.setDate(result.getDate() + 1);
    if (result.getDay() !== 0 && result.getDay() !== 6) added++;
  }
  return result;
}

// Convertit le début de la semaine de planning au prochain jour ouvré.
export function weekToDate(year, month, week) {
  const date = new Date(year, month - 1, (week - 1) * 7 + 1);
  while (date.getDay() === 0 || date.getDay() === 6) date.setDate(date.getDate() + 1);
  return formatDate(date);
}

// Une durée d'une semaine représente cinq jours ouvrés, sans samedi ni dimanche.
export function entryEndDate(year, month, week_start, duration) {
  const start = new Date(`${weekToDate(year, month, week_start)}T00:00:00`);
  return formatDate(addBusinessDays(start, Math.max(0, duration * 5 - 1)));
}
