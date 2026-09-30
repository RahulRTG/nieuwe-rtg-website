'use strict';
// Privé werkvormen van een organisatie; geen toelating tot de publieke Mall.
const SOORTEN = ['product', 'dienst', 'verhuur', 'activiteit', 'hulp'];
const PROFIELEN = ['zelfstandig', 'winkel', 'dienstverlening', 'vestigingen', 'stichting'];
const heeft = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);
const pak = (o, k) => heeft(o, k) ? o[k] : null;
const tekst = (v, n = 300) => typeof v === 'string' ? v.trim().slice(0, n) : '';
const fout = (error, status = 400) => ({ error, status });
function datum(v) {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
}
function prijs(v) { return Number.isSafeInteger(v) && v >= 0 && v <= 1000000000; }
function profiel(b) {
  if (!PROFIELEN.includes(b.profiel)) return fout('Kies hoe u werkt.');
  if (!/^[A-Z]{2}$/.test(b.land || '') || !/^[A-Z]{3}$/.test(b.valuta || ''))
    return fout('Geef een landcode en valutacode.');
  try { new Intl.DateTimeFormat(undefined, { timeZone: b.tijdzone }).format(); }
  catch (_) { return fout('Kies een geldige tijdzone.'); }
  if (!tekst(b.tijdzone, 80)) return fout('Kies uw tijdzone.');
  if (!Intl.supportedValuesOf('currency').includes(b.valuta)) return fout('Kies een ondersteunde valuta.');
  const decimalen = new Intl.NumberFormat(undefined, { style: 'currency', currency: b.valuta }).resolvedOptions().maximumFractionDigits;
  return { profiel: b.profiel, land: b.land, valuta: b.valuta, decimalen, tijdzone: b.tijdzone };
}
function aanbod(b) {
  if (!tekst(b.naam, 80) || !SOORTEN.includes(b.soort)) return fout('Geef een naam en kies wat u aanbiedt.');
  if (!['vast', 'op-aanvraag', 'kosteloos'].includes(b.prijswijze)) return fout('Kies een prijswijze.');
  if (b.prijswijze === 'vast' && !prijs(b.bedragMinor)) return fout('Geef een geldig bedrag.');
  return { naam: tekst(b.naam, 80), soort: b.soort, omschrijving: tekst(b.omschrijving, 500),
    prijswijze: b.prijswijze, bedragMinor: b.prijswijze === 'kosteloos' ? 0 :
      (b.prijswijze === 'vast' ? b.bedragMinor : null), locatie: tekst(b.locatie, 120), actief: true };
}
function project(w, id) {
  const p = pak(w.projecten, id);
  return p && details(w, p) ? p : null;
}
function details(w, p) { return (p && pak(w.kansen, p.praktijkRef) || {}).praktijk || null; }
function beeld(w, b = {}) {
  const offset = Number.isSafeInteger(b.offset) && b.offset >= 0 ? b.offset : 0;
  const alle = Object.values(w.projecten || {}).filter(p => details(w, p)).reverse();
  const perProject = new Map();
  for (const t of Object.values(w.taken || {})) {
    if (!perProject.has(t.projectId)) perProject.set(t.projectId, []);
    perProject.get(t.projectId).push(t);
  }
  return { ok: true, organisatie: { naam: w.naam, code: w.code }, profiel: w.praktijkProfiel || null,
    profielen: PROFIELEN, soorten: SOORTEN, pagina: { offset, grootte: 50, totaal: alle.length },
    aanbod: Object.values(w.praktijkAanbod || {}),
    werk: alle.slice(offset, offset + 50).map(p => ({
      id: p.id, naam: p.naam, klant: (pak(w.klanten, details(w, p).klantId) || {}).naam || 'Relatie verwijderd',
      ...details(w, p), taken: (perProject.get(p.id) || [])
        .map(t => ({ id: t.id, titel: t.titel, kolom: t.kolom, deadline: t.deadline, wie: t.wie, externeAfspraak: t.externeAfspraak || null }))
    })),
    grenzen: 'Intern werkoverzicht. Bedragen zijn afspraken, geen betaalbewijs. Aanbod wordt niet automatisch openbaar.' };
}
module.exports = { SOORTEN, PROFIELEN, pak, tekst, fout, datum, prijs, profiel, aanbod, project, details, beeld };
