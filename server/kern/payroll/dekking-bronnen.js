/* Payroll OS: HET BRONNENREGISTER -- welk adres levert het regelpakket van
   welk land?

   Afgesplitst van ./dekking.js, dat over de 10 KB ging. De snede loopt langs een
   echte grens: hiernaast staat de vraag of een land loon KAN draaien, hier
   staat waar de tarieven vandaan komen.

   DE BRONNEN STAAN IN DE OPSLAG EN NIET IN DE CODE, en dat is de hele reden dat
   "wereldwijd" hier iets betekent. Een land erbij is een https-adres neerzetten,
   geen uitrol. De dagelijkse ronde (./bijwerken.js) leest ze hier op, haalt ze
   op, laat ze keuren en zet ze klaar als ONGECONTROLEERD -- er gaat nooit
   vanzelf een definitieve loonrun op iets wat geen mens heeft aangemerkt.

   Alleen https. Een loontabel over een onbeveiligde lijn is geen loontabel: wie
   ertussen zit, bepaalt wat honderden mensen krijgen uitbetaald. */
'use strict';

module.exports = ({ db, save, tijd }) => {
  const norm = (l) => String(l || 'NL').toUpperCase();

  /* ---------- bronnen per land ----------
   Een bron is een adres waar een regelpakket vandaan komt. Ze staan in de
   opslag en niet in de code, want een land erbij hoort geen uitrol te zijn.
   De bijwerkronde leest ze hier op (zie ./bijwerken.js). */
function bronbak() {
  if (!db.data.payrollBronnen || typeof db.data.payrollBronnen !== 'object') db.data.payrollBronnen = {};
  return db.data.payrollBronnen;
}
const bronnenVan = (land) => (bronbak()[norm(land)] || []).slice();
const alleBronnen = () => Object.keys(bronbak())
  .flatMap(l => bronbak()[l].map(b => Object.assign({ land: l }, b)));

function zetBron(land, bron, door) {
  const l = norm(land);
  const url = String((bron && bron.url) || '').trim();
  if (!/^https:\/\/[^\s]+$/i.test(url))
    return { status: 400, error: 'Een bron is een https-adres dat een regelpakket als JSON teruggeeft.' };
  if (!door) return { status: 400, error: 'Noteer wie deze bron toevoegt.' };
  const rij = bronbak()[l] = bronbak()[l] || [];
  const bestaand = rij.find(b => b.url === url);
  if (bestaand) return { ok: true, ongewijzigd: true, bron: bestaand };
  const b = { naam: String((bron && bron.naam) || url).slice(0, 80), url, door, at: tijd(),
    laatst: null, laatsteFout: null };
  rij.push(b);
  save();
  return { ok: true, bron: b };
}

function haalBronWeg(land, url) {
  const l = norm(land);
  const rij = bronbak()[l] || [];
  const i = rij.findIndex(b => b.url === url);
  if (i < 0) return { status: 404, error: 'Deze bron kennen we niet.' };
  rij.splice(i, 1);
  save();
  return { ok: true };
}

/* De uitslag van een ronde terugschrijven, zodat op het scherm te zien is
   wanneer een bron voor het laatst iets deed. Een bron die al drie maanden
   zwijgt is zelf een bevinding. */
function noteerBron(land, url, uitslag) {
  const rij = bronbak()[norm(land)] || [];
  const b = rij.find(x => x.url === url);
  if (!b) return;
  b.laatst = tijd();
  b.laatsteFout = (uitslag && uitslag.fout) || null;
  save();
}

  return { bronnenVan, alleBronnen, zetBron, haalBronWeg, noteerBron };
};
