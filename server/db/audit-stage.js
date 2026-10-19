'use strict';
const vorm = require('./audit-vorm');
/* EEN TOEVOEGING IN DE BUNDEL KOPIEERT HET JOURNAAL NIET.

   Het voorlopige beeld van een append werd gebouwd door de HELE projectie
   door de lijstproxy te lezen ([...rijen]): elke rij een proxy-get, elke
   gesloten pagina van 128 rijen opnieuw ontpakt (inflateRawSync + JSON.parse)
   zodra hij buiten de cache van vier pagina's viel. Bij een handelingLog van
   een paar duizend regels is dat tientallen pagina's per toevoeging, en elke
   kritieke schrijfhandeling doet er minstens een. Gemeten in De Beproeving van
   18 oktober 2026: 12,6 s van de 410 s wandklok zat in deze functie, 7,4 s
   daarvan in het ontpakken van pagina's -- synchroon, op de lus, midden in
   het verzoek.

   Het beeld na de toevoeging is dezelfde projectie als voor, plus een rij in
   de staart. Precies dat is wat projectie.volgende() al doet voor leesBinnen():
   de gesloten pagina's worden gedeeld, alleen de staart krijgt de nieuwe rij,
   en de retentie (spec.max) loopt via hetzelfde minimum. De kop (voor
   op.maak) wordt vanaf de nieuwste kant gezocht in plaats van na een volledige
   kopie en omkering: dezelfde rij, zonder de rest te lezen. De rij zelf komt
   als JSON-tekst in de staart, zoals een gecommitte rij -- pasToe() bewaart
   hem via vorm.kopie() toch al als JSON-kopie.

   Wat hetzelfde blijft: view() binnen de bundel toont de nieuwe rij op dezelfde
   plek, een tweede append in dezelfde bundel ziet de eerste als kop, een
   rewrite werkt op een echte kopie, en na de commit wist naCommit() het
   voorlopige beeld. Wanneer er geen snapshot naast het basisbeeld staat (een
   append na een rewrite in dezelfde bundel, of een rij die niet als JSON kan),
   loopt de oude volledige kopie zoals voorheen.

   WAAROM DE BUNDEL HIER WOONT EN NIET IN audit-sqlite.js: de rijopslag kent
   alleen gecommitte rijen (open, leesBinnen, pasToe). Het voorlopige beeld
   binnen een doos -- auditOps, auditViews, auditBeelden, de snelle toevoeging
   en de volledige kopie als terugval -- is een eigen begrip dat pas na de
   commit (naCommit) met de opslag samenkomt. stage() staat daarom hier, naast
   zijn snelle pad. */
module.exports = ({ cache, projectie, view, publiceerResultaat }) => {
  function nrOpIndex(beeld, i) {
    for (const deel of beeld.delen) if (i < deel.einde) return deel.pagina.nummers[deel.begin + (i - deel.vanaf)];
    return null;
  }
  function stageAppend(doos, op, basis) {
    const gecacht = cache.get(op.naam);
    const beeld = doos.auditViews.has(op.naam) ? doos.auditBeelden.get(op.naam)
      : (gecacht && gecacht.waarde === basis ? gecacht.beeld : null);
    if (!beeld) return null;
    const spec = vorm.eis(op.naam), rijenBasis = vorm.rijen(op.naam, basis), n = rijenBasis.length;
    let top = null;
    if (spec.omgekeerd) { for (let i = 0; i < n; i++) { const r = rijenBasis[i]; if (!op.kopTest || op.kopTest(r)) { top = r; break; } } }
    else { for (let i = n - 1; i >= 0; i--) { const r = rijenBasis[i]; if (!op.kopTest || op.kopTest(r)) { top = r; break; } } }
    const totaalBasis = vorm.totaal(op.naam, basis);
    const resultaat = op.maak(top || null, totaalBasis);
    if (resultaat && typeof resultaat.then === 'function') throw new Error('Auditbewerker moet synchroon zijn.');
    let tekst;
    try { tekst = JSON.stringify(resultaat); } catch (e) { tekst = undefined; }
    if (typeof tekst !== 'string') return null;
    const laatste = beeld.staart ? beeld.staart.nummers.at(-1)
      : (beeld.paginas.length ? beeld.paginas.at(-1).nummers.at(-1) : 0);
    const nr = laatste + 1;
    const teVeel = beeld.lengte + 1 - spec.max;
    const minimum = teVeel > 0 ? (teVeel > beeld.lengte ? nr : nrOpIndex(beeld, teVeel))
      : (beeld.lengte ? nrOpIndex(beeld, 0) : nr);
    const beeldNieuw = projectie.volgende(beeld, [{ nr, tekst }], minimum);
    const waarde = vorm.pak(op.naam, projectie.lijst(beeldNieuw, spec.omgekeerd), totaalBasis + 1, vorm.extra(op.naam, basis));
    return { waarde, resultaat, beeld: beeldNieuw };
  }
  function stage(doos, op) {
    if (!doos.auditOps) { doos.auditOps = []; doos.auditViews = new Map(); doos.auditBeelden = new Map(); }
    if (!doos.auditBeelden) doos.auditBeelden = new Map();
    const basis = doos.auditViews.get(op.naam) || view(op.naam);
    const licht = op.type === 'append' ? stageAppend(doos, op, basis) : null;
    if (licht) {
      publiceerResultaat(op.resultaat, licht.resultaat);
      doos.auditOps.push(op); doos.auditViews.set(op.naam, vorm.alleenLezen(licht.waarde));
      doos.auditBeelden.set(op.naam, licht.beeld);
      return op.resultaat;
    }
    const waarde = op.type === 'append'
      ? vorm.pak(op.naam, [...vorm.rijen(op.naam, basis)], vorm.totaal(op.naam, basis), vorm.extra(op.naam, basis))
      : vorm.kopie(basis);
    let resultaat;
    if (op.type === 'append') {
      const lijst = vorm.rijen(op.naam, waarde), spec = vorm.eis(op.naam);
      const volgorde = spec.omgekeerd ? lijst : [...lijst].reverse();
      const top = volgorde.find(r => !op.kopTest || op.kopTest(r));
      resultaat = op.maak(top || null, vorm.totaal(op.naam, waarde));
      if (spec.omgekeerd) { lijst.unshift(resultaat); lijst.splice(spec.max); }
      else { lijst.push(resultaat); if (lijst.length > spec.max) lijst.splice(0, lijst.length - spec.max); waarde.commandJournaalTotaal = vorm.totaal(op.naam, basis) + 1; }
    } else resultaat = op.werk(waarde);
    if (resultaat && typeof resultaat.then === 'function') throw new Error('Auditbewerker moet synchroon zijn.');
    publiceerResultaat(op.resultaat, resultaat);
    doos.auditOps.push(op); doos.auditViews.set(op.naam, vorm.alleenLezen(waarde));
    // een volledige kopie heeft geen snapshot naast zich: een volgende append in deze bundel kopieert ook
    doos.auditBeelden.delete(op.naam);
    return op.resultaat;
  }
  return stage;
};
