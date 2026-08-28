/* Foundation OS, deel "voorraad": goederen, uitgiftepunten en batches.

   VOEDSEL, KLEDING, SCHOOLSPULLEN EN APPARATEN ZIJN GEEN GETAL MAAR EEN BATCH.
   Dat onderscheid is de hele module. Tweehonderd broden is geen voorraad: het
   zijn tweehonderd broden die op donderdag over de datum zijn, van een
   bepaalde gever kwamen, in een bepaald pand liggen en voor een bepaald project
   bedoeld zijn. Wie er een saldo van maakt, verliest alle vier die feiten -- en
   precies daarop loopt uitgifte in de praktijk vast.

   DRIE GRENDELS:

   1. OVER DE DATUM GAAT NIET DE DEUR UIT. Bij eten en drinken weigert het
      systeem de uitgifte van een verlopen batch. Niet met een waarschuwing:
      een waarschuwing klik je weg op de drukke donderdag waarop je te weinig
      hebt, en dat is precies de donderdag waarop het misgaat. Afschrijven kan
      wel, en dat is een andere handeling met een andere naam.

   2. ER GAAT NOOIT MEER UIT DAN ERIN ZIT. Het restant wordt uit de batch zelf
      gerekend (ontvangen min uitgegeven min afgeschreven), niet uit een apart
      saldoveld dat kan afwijken (LAT.md regel 4).

   3. UITGIFTE REGISTREERT EEN BESTEMMING, GEEN PERSOON. Een uitgifte wijst naar
      een project of naar een hulpvraag-CODENAAM. Wie het kreeg staat in de
      casus, met toestemming en een bewaartermijn, of nergens. Een
      ontvangerslijst in het magazijn is de makkelijkste manier om buiten alle
      afspraken om een lijst van arme mensen aan te leggen.

   DE WAARDE IS EEN SCHATTING EN HEET OOK ZO. Voor het jaarverslag telt de
   waarde van goederen mee; hij heet `waardeGeschat` en doet zich nergens voor
   als ontvangen geld. */

const SOORTEN = ['voedsel', 'kleding', 'schoolspullen', 'speelgoed', 'apparaten',
  'meubels', 'hygiene', 'babyspullen', 'overig'];
// Waar houdbaarheid geen wens is maar een grens.
const BEDERFELIJK = ['voedsel', 'hygiene', 'babyspullen'];

module.exports = (ctx) => {
  const { nu, rid, schoon, naarCenten, euro, S, audit, wie, poort, save } = ctx;

  const V = () => { if (!Array.isArray(S().voorraad)) S().voorraad = []; return S().voorraad; };
  const vind = id => V().find(b => b.id === String(id || '')) || null;
  const uit = b => (b.uitgiftes || []).reduce((s, u) => s + u.aantal, 0);
  const af = b => (b.afschrijvingen || []).reduce((s, a) => s + a.aantal, 0);
  const rest = b => Math.max(0, b.aantal - uit(b) - af(b));
  const overDatum = b => !!b.houdbaarTot && Date.parse(b.houdbaarTot) < Date.now();

  const beeld = b => ({ id: b.id, stad: b.stad, soort: b.soort, wat: b.wat, batch: b.batch,
    aantal: b.aantal, eenheid: b.eenheid, uitgegeven: uit(b), afgeschreven: af(b), restant: rest(b),
    houdbaarTot: b.houdbaarTot || null, overDatum: overDatum(b), locatie: b.locatie,
    gever: b.gever, projectId: b.projectId || null, waardeGeschat: euro(b.waardeCenten),
    uitgiftes: (b.uitgiftes || []).slice(-30).reverse(), at: b.at });

  function lijst(req, stadId) {
    const w = wie(req);
    const g = poort(w, stadId, 'stad.lezen');
    if (!g.ok) return g;
    const rijen = V().filter(b => b.stad === g.stad.id);
    /* Bijna over de datum is een eigen lijst en geen sortering: dit is het
       enige getal in deze module waar iemand vandaag iets mee moet doen. */
    const week = Date.now() + 7 * 86400000;
    return { ok: true, soorten: SOORTEN, bederfelijk: BEDERFELIJK,
      batches: rijen.map(beeld),
      aandacht: {
        overDatum: rijen.filter(b => overDatum(b) && rest(b) > 0).map(beeld),
        bijnaOver: rijen.filter(b => !overDatum(b) && b.houdbaarTot &&
          Date.parse(b.houdbaarTot) < week && rest(b) > 0).map(beeld)
      },
      totalen: {
        batches: rijen.length,
        opVoorraad: rijen.reduce((s, b) => s + rest(b), 0),
        uitgegeven: rijen.reduce((s, b) => s + uit(b), 0),
        afgeschreven: rijen.reduce((s, b) => s + af(b), 0),
        waardeGeschat: euro(rijen.reduce((s, b) => s + (b.waardeCenten || 0), 0))
      } };
  }

  // Een binnenkomende partij goederen.
  function binnen(req, b) {
    b = b || {};
    const w = wie(req);
    const g = poort(w, b.stad, 'geld.beheren', 'warehouse_management');
    if (!g.ok) return g;
    const soort = String(b.soort || '');
    if (!SOORTEN.includes(soort)) return { status: 400, error: 'Kies een soort (' + SOORTEN.join(', ') + ').' };
    const wat = schoon(b.wat, 120);
    if (wat.length < 2) return { status: 400, error: 'Wat komt er binnen?' };
    const aantal = Math.round(Number(b.aantal));
    if (!Number.isFinite(aantal) || aantal <= 0) return { status: 400, error: 'Hoeveel komt er binnen?' };
    const houdbaar = schoon(b.houdbaarTot, 10);
    if (houdbaar && Number.isNaN(Date.parse(houdbaar))) return { status: 400, error: 'Gebruik een datum als 2026-09-01.' };
    /* Bederfelijke waar zonder houdbaarheidsdatum kan niet: dan is de grendel
       bij uitgifte een lege huls, en die ontdek je pas als er iemand ziek van
       wordt. */
    if (BEDERFELIJK.includes(soort) && !houdbaar) {
      return { status: 400, error: 'Bij ' + soort + ' hoort een houdbaarheidsdatum. Zonder die datum kan het systeem niet tegenhouden dat het te laat de deur uit gaat.' };
    }
    const waarde = naarCenten(b.waarde === undefined ? 0 : b.waarde);
    if (waarde === null) return { status: 400, error: 'Wat is de geschatte waarde? Nul mag ook.' };
    let projectId = schoon(b.projectId, 20) || null;
    if (projectId) {
      const p = S().projecten.find(x => x.id === projectId);
      if (!p || p.stad !== g.stad.id) return { status: 400, error: 'Dat project hoort niet bij deze stad.' };
    }
    if (V().length >= 200000) return { status: 400, error: 'Het voorraadregister zit vol.' };
    const rij = { id: rid(), stad: g.stad.id, soort, wat, batch: schoon(b.batch, 40) || null,
      aantal: Math.min(aantal, 10000000), eenheid: schoon(b.eenheid, 20) || 'stuks',
      houdbaarTot: houdbaar || null, locatie: schoon(b.locatie, 80) || 'onbekend',
      gever: schoon(b.gever, 120) || 'onbekend', projectId, waardeCenten: waarde,
      uitgiftes: [], afschrijvingen: [], door: w.key, at: nu() };
    V().push(rij);
    audit(w.key, 'voorraad.binnen', wat, aantal + ' ' + rij.eenheid + ' in ' + g.stad.naam);
    save();
    return { ok: true, batch: beeld(rij) };
  }

  /* Uitgifte en afschrijven staan in ./voorraad-uitgifte.js: dat is de kant
     waar de drie grendels zitten (de datum, het restant en de bestemming), en
     dit bestand liep over de 10 KB van keuringsregel 13. */
  const uitgeven = require('./voorraad-uitgifte')(ctx, { vind, beeld, rest, overDatum, BEDERFELIJK });

  return { lijst, binnen, uitgifte: uitgeven.uitgifte, afschrijven: uitgeven.afschrijven,
    vind, beeld, rest, SOORTEN, BEDERFELIJK };
};
module.exports.SOORTEN = SOORTEN;
module.exports.BEDERFELIJK = BEDERFELIJK;
