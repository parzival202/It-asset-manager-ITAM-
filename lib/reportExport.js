// Exports locaux réutilisables : CSV lisible par Excel et vue d'impression PDF.
const cell = value => `"${String(value ?? "").replaceAll('"','""')}"`;
export function downloadExcel(filename, headers, rows) {
  const content = "\uFEFF" + [headers, ...rows].map(row=>row.map(cell).join(";")).join("\n");
  const link=document.createElement("a"); link.href=URL.createObjectURL(new Blob([content],{type:"text/csv;charset=utf-8"})); link.download=`${filename}.csv`; link.click(); URL.revokeObjectURL(link.href);
}
export function printReport(title, headers, rows, subtitle="") {
  const escape=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
  const win=window.open("","_blank","noopener,noreferrer"); if(!win) return alert("Autorisez les fenêtres contextuelles pour générer le PDF.");
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escape(title)}</title><style>body{font-family:Arial,sans-serif;color:#172033;padding:28px}h1{font-size:22px;margin:0 0 5px}p{color:#526077;margin:0 0 20px}table{width:100%;border-collapse:collapse;font-size:11px}th{background:#edf2f8;text-align:left}th,td{border:1px solid #cbd5e1;padding:7px;vertical-align:top}@media print{body{padding:0}}</style></head><body><h1>${escape(title)}</h1><p>${escape(subtitle||`Édité le ${new Date().toLocaleDateString("fr-FR")}`)}</p><table><thead><tr>${headers.map(h=>`<th>${escape(h)}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(v=>`<td>${escape(v)}</td>`).join("")}</tr>`).join("")}</tbody></table></body></html>`); win.document.close(); win.focus(); setTimeout(()=>win.print(),250);
}
