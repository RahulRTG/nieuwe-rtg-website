/* Gedeelde grond voor de Magnaat Partnerstudio.

   Een digitale tweeling hoort bij een reeds goedgekeurde RTG-leverancier.
   De leveranciercode komt altijd uit supplierAuth; geen enkele mutatie neemt
   een tenantcode van de browser aan. De tweeling is uitsluitend spelstaat. */
'use strict';

const klok = require('../lib/klok');
const VERSIE = 2;
const SOORTEN = {
  locatie: { veld: 'locaties', limiet: 30 },
  afdeling: { veld: 'afdelingen', limiet: 50 },
  rol: { veld: 'rollen', limiet: 100 },
  aanbod: { veld: 'aanbod', limiet: 250 },
  werkproces: { veld: 'werkprocessen', limiet: 120 }
};

module.exports = ({ db, save, crypto, findSupplier }) => {
  const nu = () => klok.datum().toISOString();
  const tekst = (v, max = 180) => String(v == null ? '' : v)
    .replace(/[<>\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  const regels = (v, max = 12) => (Array.isArray(v) ? v : String(v || '').split(/\r?\n/))
    .map(x => tekst(x, 180)).filter(Boolean).slice(0, max);
  const id = voor => voor + '-' + crypto.randomBytes(6).toString('hex');
  const kopie = v => JSON.parse(JSON.stringify(v));

  function staat() {
    if (!db.data.magnaatPartnerstudio || typeof db.data.magnaatPartnerstudio !== 'object')
      db.data.magnaatPartnerstudio = { versie: VERSIE, bedrijven: {}, relaties: [], trainingen: {} };
    const s = db.data.magnaatPartnerstudio;
    s.versie = VERSIE;
    if (!s.bedrijven || typeof s.bedrijven !== 'object') s.bedrijven = {};
    if (!Array.isArray(s.relaties)) s.relaties = [];
    if (!s.trainingen || typeof s.trainingen !== 'object') s.trainingen = {};
    for (const t of Object.values(s.bedrijven)) {
      if (!t || !t.beoordeling) continue;
      const b = t.beoordeling;
      if (!b.indieningId) b.indieningId = 'legacy-' + String(t.code || '').toLowerCase() + '-' + String(b.hash || 'zonder-hash');
      if (!Object.hasOwn(b, 'voorcontrole')) b.voorcontrole = null;
      if (!Object.hasOwn(b, 'publicatie')) b.publicatie = null;
      if (!b.status) b.status = t.gepubliceerd ? 'legacy-gepubliceerd' : 'wacht-op-voorcontrole';
      if (t.gepubliceerd && t.gepubliceerd.meta && !t.gepubliceerd.meta.releaseModel)
        t.gepubliceerd.meta.releaseModel = 'legacy-een-oog';
    }
    return s;
  }
  function leverancier(code) {
    const c = tekst(code, 40).toUpperCase();
    return (findSupplier && findSupplier(c)) || (db.data.suppliers || []).find(x => String(x.code).toUpperCase() === c) || null;
  }
  function tweeling(supplier) {
    if (!supplier || !supplier.code) return null;
    const s = staat(), code = String(supplier.code).toUpperCase();
    if (!s.bedrijven[code]) {
      const at = nu();
      s.bedrijven[code] = {
        id: 'twin-' + code.toLowerCase(), code, naam: tekst(supplier.name, 100),
        type: tekst(supplier.type, 50), stad: tekst(supplier.city, 80), versie: 1,
        fase: 'concept', profiel: { sector: tekst(supplier.type, 50), omschrijving: '', trainingsdoel: '', bedrijfsmodel: 'dienstverlening' },
        toestemming: { merkInSpel: false, synthetischeDossiers: false, geheimenUitgesloten: false },
        locaties: [], afdelingen: [], rollen: [], aanbod: [], werkprocessen: [],
        laatsteProef: null, beoordeling: null, gepubliceerd: null,
        gemaaktAt: at, bijgewerktAt: at, audit: []
      };
      save();
    }
    const t = s.bedrijven[code];
    t.naam = tekst(supplier.name, 100);
    t.type = tekst(supplier.type, 50);
    t.stad = tekst(supplier.city, 80);
    return t;
  }
  function actorNaam(actor) { return tekst(actor && (actor.name || actor.naam) || actor, 100) || 'Beheer'; }
  function magWijzigen(t, verwachteVersie) {
    if (!t) return { status: 404, error: 'Digitale tweeling niet gevonden.' };
    if (t.fase === 'wacht-op-rtg') return { status: 423, error: 'Deze versie ligt bij RTG ter beoordeling. Trek de aanvraag eerst terug om hem te wijzigen.' };
    if (verwachteVersie != null && Number(verwachteVersie) !== t.versie)
      return { status: 409, error: 'Iemand anders heeft deze tweeling intussen bijgewerkt. Ververs de Partnerstudio.' };
    return null;
  }
  function wijzig(t, actor, actie, detail) {
    t.versie += 1;
    if (t.fase === 'goedgekeurd' || t.fase === 'aanpassen' || t.fase === 'ingetrokken') t.fase = 'concept';
    t.bijgewerktAt = nu();
    t.audit.unshift({ id: id('audit'), at: t.bijgewerktAt, door: actorNaam(actor), actie, detail: tekst(detail, 260) });
    t.audit = t.audit.slice(0, 120);
    save();
  }
  function gereedheid(t) {
    const checks = [
      ['partner', 'Officiële RTG-partner', 15, true],
      ['profiel', 'Bedrijfsverhaal en trainingsdoel', 15, t.profiel.omschrijving.length >= 40 && t.profiel.trainingsdoel.length >= 20],
      ['rechten', 'Merk- en trainingsrechten bevestigd', 10, Object.values(t.toestemming).every(Boolean)],
      ['locaties', 'Minimaal één trainingslocatie', 10, t.locaties.length > 0],
      ['afdelingen', 'Minimaal één afdeling', 10, t.afdelingen.length > 0],
      ['rollen', 'Minimaal één oefenrol', 10, t.rollen.length > 0],
      ['aanbod', 'Minimaal één product of dienst', 10, t.aanbod.length > 0],
      ['werkproces', 'Werkproces met minstens drie stappen', 15, t.werkprocessen.some(x => x.stappen.length >= 3)],
      ['proef', 'Veilige proef met minstens 75%', 5, !!(t.laatsteProef && t.laatsteProef.score >= 75)]
    ].map(x => ({ id: x[0], naam: x[1], punten: x[2], klaar: !!x[3] }));
    return { score: checks.reduce((n, x) => n + (x.klaar ? x.punten : 0), 0), checks,
      blokkades: checks.filter(x => !x.klaar).map(x => x.naam), klaar: checks.every(x => x.klaar) };
  }
  function momentopname(t) {
    return {
      id: t.id, code: t.code, naam: t.naam, type: t.type, stad: t.stad,
      profiel: kopie(t.profiel), locaties: kopie(t.locaties), afdelingen: kopie(t.afdelingen),
      rollen: kopie(t.rollen), aanbod: kopie(t.aanbod), werkprocessen: kopie(t.werkprocessen),
      spelregels: { echtGeld: false, productieschrijfacties: false, persoonsgegevens: 'uitsluitend synthetisch', juridischBindend: false }
    };
  }
  function relatiesVoor(code) {
    const c = String(code || '').toUpperCase();
    return staat().relaties.filter(x => x.bron === c || x.doel === c).map(x => {
      const tegenpartij = x.bron === c ? x.doel : x.bron;
      return Object.assign({}, x, { tegenpartij, tegenpartijNaam: (leverancier(tegenpartij) || {}).name || tegenpartij });
    });
  }
  function eigenBeeld(t) {
    return {
      tweeling: kopie(Object.assign({}, t, { audit: t.audit.slice(0, 40) })),
      gereedheid: gereedheid(t), relaties: relatiesVoor(t.code),
      grenzen: ['Geen echt geld', 'Geen productieacties', 'Geen echte klantdossiers', 'Menselijke RTG-goedkeuring voor publicatie'],
      limieten: Object.fromEntries(Object.entries(SOORTEN).map(([k, v]) => [k, v.limiet]))
    };
  }

  return { VERSIE, SOORTEN, staat, leverancier, tweeling, tekst, regels, id, kopie, nu,
    actorNaam, magWijzigen, wijzig, gereedheid, momentopname, relatiesVoor, eigenBeeld, save };
};
