// lib/planningData.js
// Calendrier de maintenances préventives 2025
// Basé sur le document fourni — semaines S1-S4 par mois
// Chaque entrée : service, mois de début, durée en semaines

export const PLANNING_2025 = [
  { service: "Sce Ccial",   month: 1,  week: 1, duration: 2 },
  { service: "Sce Cde",     month: 2,  week: 3, duration: 2 },
  { service: "Compta",      month: 3,  week: 2, duration: 2 },
  { service: "Creation",    month: 4,  week: 1, duration: 2 },
  { service: "DAF",         month: 4,  week: 3, duration: 2 },
  { service: "DG",          month: 5,  week: 1, duration: 2 },
  { service: "Direction",   month: 5,  week: 2, duration: 2 },
  { service: "PDG",         month: 5,  week: 3, duration: 2 },
  { service: "DMP",         month: 6,  week: 1, duration: 2 },
  { service: "DPF",         month: 6,  week: 3, duration: 2 },
  { service: "Export",      month: 7,  week: 1, duration: 2 },
  { service: "Facturation", month: 7,  week: 3, duration: 2 },
  { service: "Informatic",  month: 8,  week: 1, duration: 2 },
  { service: "Labo",        month: 8,  week: 3, duration: 2 },
  { service: "Market",      month: 9,  week: 1, duration: 2 },
  { service: "R. Hum.",     month: 9,  week: 3, duration: 2 },
  { service: "Production",  month: 10, week: 1, duration: 2 },
  { service: "Qualite",     month: 10, week: 3, duration: 2 },
  { service: "SRAV",        month: 11, week: 1, duration: 2 },
  { service: "Transit",     month: 11, week: 3, duration: 2 },
  { service: "Autres sce",  month: 12, week: 3, duration: 2 },
];

export const MONTHS = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];
export const MONTH_NAMES = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

// Retourne le mois courant (1-12)
export function getCurrentMonth() { return new Date().getMonth() + 1; }
export function getCurrentWeek() {
  const now = new Date();
  const day = now.getDate();
  return Math.ceil(day / 7);
}

// Retourne les services dont la maintenance tombe ce mois-ci ou le mois prochain
export function getUpcomingServices(monthsAhead = 2) {
  const current = getCurrentMonth();
  return PLANNING_2025.filter(p => p.month >= current && p.month <= current + monthsAhead);
}

// Retourne le service en cours ce mois/semaine
export function getCurrentServices() {
  const m = getCurrentMonth();
  const w = getCurrentWeek();
  return PLANNING_2025.filter(p => {
    const startWeekAbs = (p.month - 1) * 4 + p.week;
    const endWeekAbs   = startWeekAbs + p.duration - 1;
    const nowWeekAbs   = (m - 1) * 4 + w;
    return nowWeekAbs >= startWeekAbs && nowWeekAbs <= endWeekAbs;
  });
}
