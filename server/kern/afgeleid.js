/* Zuivere afgeleide berekeningen en projecties: geen gedeelde staat, alleen
   invoer -> uitvoer. Los-testbaar buiten de grote server.js. */

// Publieke projectie van een partner: nooit meer velden dan hier naar buiten.
function publicPartner(p) {
  return { code: p.code, name: p.name, type: p.type, handle: p.handle, hasStaff: !!p.staff };
}

// Drukte-factor per weekdag (voor omzetprognoses). 0 = zondag.
function weekdagFactor(d) {
  const wd = d.getDay();
  if (wd === 5 || wd === 6) return [1.25, 'vrijdag/zaterdag, druk'];
  if (wd === 0) return [1.0, 'zondag, gemiddeld'];
  return [0.85, 'doordeweeks, rustiger'];
}

// Een cv is pas bruikbaar om te solliciteren met naam, contact en minstens
// wat ervaring of vaardigheden.
function cvReady(cv) {
  return !!(cv && cv.name && cv.contact && ((cv.experience || []).length || (cv.skills || []).length));
}

// Splits een bruto (inclusief btw) bedrag in grondslag en btw bij een tarief in
// procenten. Op centen afgerond, net als elders in de boekhouding.
function btwSplit(omzet, tariefPct) {
  const t = Number(tariefPct) || 0;
  const cent = n => Math.round(n * 100) / 100;
  const bruto = cent(Number(omzet) || 0);
  const grondslag = cent(bruto / (1 + t / 100));
  return { omzet: bruto, tarief: t, grondslag, btw: cent(bruto - grondslag) };
}

module.exports = { publicPartner, weekdagFactor, cvReady, btwSplit };
