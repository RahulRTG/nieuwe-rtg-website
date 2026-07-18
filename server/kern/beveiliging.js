/* Kern-module "beveiliging": een commandocentrum voor de meest geavanceerde
   beveiligingsteams die met RTG samenwerken. Een handige POS die het zware
   werk overneemt:
   - het ROOSTER: wie staat wanneer op welke post; de AI neemt het over en
     vult de open diensten zelf in (rust tussen diensten, geen dubbeldiensten),
   - het BUDGET: geplande uren x tarief tegen het contractbudget, per post,
     met een waarschuwing zodra het uit de hand loopt,
   - de AANVRAGEN: een klant vraagt inzet aan (object, datum, shift, aantal
     bewakers), het team plant het in een tik in,
   - de POSTEN/objecten die bewaakt worden.

   En een uitgebreide PDA voor de bewaker op straat: eigen diensten, inklokken
   op post met GPS, patrouillerondes met checkpoints, incidenten melden met
   foto, een SOS-noodknop naar RTG-kantoor en de walkie-talkie van het team.

   Elk team zet zijn eigen functies aan en uit (liever te veel dan te weinig).
   maakBeveiliging(state) volgt het vaste kern-patroon. */

// De functies die een beveiligingsteam zelf aan/uit zet. Standaard alles aan.
const BEV_FUNCTIES = [
  { id: 'rooster', naam: 'Rooster & dienstplanning' },
  { id: 'autoplan', naam: 'AI neemt het rooster over' },
  { id: 'budget', naam: 'Budget & urenbewaking' },
  { id: 'aanvragen', naam: 'Inzetaanvragen van klanten' },
  { id: 'posten', naam: 'Posten & objecten' },
  { id: 'patrouille', naam: 'Patrouillerondes met checkpoints' },
  { id: 'incidenten', naam: 'Incidenten & rapportage' },
  { id: 'sos', naam: 'SOS-noodknop naar RTG-kantoor' },
  { id: 'walkie', naam: 'Walkie-talkie' },
  { id: 'toegang', naam: 'Toegangscontrole & bezoekers' },
  { id: 'bodycam', naam: 'Bodycam-momenten vastleggen' },
  { id: 'mandagstaat', naam: 'Mandagstaat (urenstaat per klant)' },
  { id: 'briefing', naam: 'Dagbriefing & standing orders' },
  { id: 'gps', naam: 'Live locatie van actieve diensten' }
];
// Vaste diensten (shifts). Uren tellen mee voor het budget.
const BEV_SHIFTS = [
  { id: 'dag', naam: 'Dag · 07:00-15:00', uren: 8 },
  { id: 'avond', naam: 'Avond · 15:00-23:00', uren: 8 },
  { id: 'nacht', naam: 'Nacht · 23:00-07:00', uren: 8 }
];
const BEV_ERNST = ['laag', 'midden', 'hoog', 'kritiek'];
const AANVR_KLAAR = { gepland: true, afgewezen: true, geannuleerd: true };

function maakBeveiliging({ db, save, crypto, accounts, findSupplier, notify, notifySupplier, sseToSupplier, sseToOffice, logActivity, haversine }) {
  const id = (p) => (p || 'b') + crypto.randomBytes(4).toString('hex');
  const nu = () => new Date().toISOString();
  const vandaag = () => new Date().toISOString().slice(0, 10);
  const schoon = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n || 120);
  const getal = (v, min, max, st) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : st; };
  const shiftVan = (sid) => BEV_SHIFTS.find(x => x.id === sid) || null;

  function isBeveiliging(s) { return s && s.type === 'beveiliging'; }
  function defaults(s) {
    if (!s.beveiliging || typeof s.beveiliging !== 'object') s.beveiliging = {};
    const b = s.beveiliging;
    if (!b.functies || typeof b.functies !== 'object') b.functies = {};
    for (const f of BEV_FUNCTIES) if (!(f.id in b.functies)) b.functies[f.id] = true;
    if (!Array.isArray(b.posten)) b.posten = [];
    if (!b.budget || typeof b.budget !== 'object') b.budget = { periodeUren: 480, tariefUur: 45 };
    return b;
  }
  function functieAan(s, fid) { return defaults(s).functies[fid] !== false; }

  // gedeelde tabellen
  const diensten = () => { if (!Array.isArray(db.data.bevDiensten)) db.data.bevDiensten = []; return db.data.bevDiensten; };
  const aanvragen = () => { if (!Array.isArray(db.data.bevAanvragen)) db.data.bevAanvragen = []; return db.data.bevAanvragen; };
  const incidenten = () => { if (!Array.isArray(db.data.bevIncidenten)) db.data.bevIncidenten = []; return db.data.bevIncidenten; };
  const rondes = () => { if (!Array.isArray(db.data.bevRondes)) db.data.bevRondes = []; return db.data.bevRondes; };

  function guards(s) { try { return accounts.listStaff(s.code).map(accounts.publicStaff); } catch (e) { return []; } }
  function guardNaam(s, gid) { const g = guards(s).find(x => x.id === gid); return g ? g.name : null; }
  function postVan(s, pid) { return defaults(s).posten.find(p => p.id === pid) || null; }

  /* ---- functies ---- */
  function functieLijst(s) {
    const b = defaults(s);
    return BEV_FUNCTIES.map(f => ({ id: f.id, naam: f.naam, aan: b.functies[f.id] !== false }));
  }
  function zetFunctie(s, fid, aan) {
    if (!BEV_FUNCTIES.some(f => f.id === fid)) return { status: 400, error: 'Onbekende functie.' };
    defaults(s).functies[fid] = aan !== false;
    save();
    return { status: 200, ok: true, functies: functieLijst(s) };
  }

  /* ---- posten/objecten ---- */
  function zetPost(s, data) {
    const b = defaults(s);
    const naam = schoon(data.naam, 80);
    if (!naam) return { status: 400, error: 'Geef een postnaam.' };
    let p = data.id ? b.posten.find(x => x.id === data.id) : null;
    if (!p) { p = { id: id('p') }; b.posten.push(p); }
    p.naam = naam;
    p.adres = schoon(data.adres, 120) || p.adres || '';
    p.klant = schoon(data.klant, 80) || p.klant || '';
    p.lat = Number.isFinite(Number(data.lat)) ? Number(data.lat) : (p.lat != null ? p.lat : null);
    p.lng = Number.isFinite(Number(data.lng)) ? Number(data.lng) : (p.lng != null ? p.lng : null);
    p.minMan = getal(data.minMan, 1, 50, p.minMan || 1);
    p.shifts = Array.isArray(data.shifts) ? data.shifts.filter(x => shiftVan(x)) : (p.shifts || BEV_SHIFTS.map(x => x.id));
    p.orders = schoon(data.orders, 400) || p.orders || '';   // standing orders / briefing per post
    p.actief = data.actief !== false;
    save();
    return { status: 200, ok: true, post: p };
  }
  function verwijderPost(s, pid) {
    const b = defaults(s);
    const i = b.posten.findIndex(p => p.id === pid);
    if (i < 0) return { status: 404, error: 'Post niet gevonden.' };
    b.posten.splice(i, 1);
    save();
    return { status: 200, ok: true };
  }

  /* De budget/rooster/aanvraag-laag en de PDA-laag draaien als submodules op
     een gedeelde context (een keer opgebouwd bij het opstarten). Het rooster-
     deel gaat eerst de context in, omdat de PDA-laag (het commandocentrum,
     mijnDiensten) die functies gebruikt. */
  const ctx = { db, save, accounts, findSupplier, notify, notifySupplier, sseToSupplier, sseToOffice, logActivity, haversine,
    BEV_FUNCTIES, BEV_SHIFTS, BEV_ERNST, AANVR_KLAAR,
    id, nu, vandaag, schoon, getal, shiftVan, isBeveiliging, defaults, functieAan,
    diensten, aanvragen, incidenten, rondes, guards, guardNaam, postVan, functieLijst, zetPost };
  const deelRooster = require('./beveiliging/rooster')(ctx);
  Object.assign(ctx, deelRooster);
  const deelPda = require('./beveiliging/pda')(ctx);
  const { budget, zetBudget, dienstPubliek, rooster, zetDienst, schrapDienst, planAuto, aanvraag, aanvraagLijst, beslisAanvraag } = deelRooster;
  const { mijnDiensten, inklok, uitklok, rondeStart, rondeCheckpoint, rondeKlaar, meldIncident, beslisIncident, sos, command } = deelPda;

  return {
    BEVEILIGING_FUNCTIES: BEV_FUNCTIES, BEVEILIGING_SHIFTS: BEV_SHIFTS, BEVEILIGING_ERNST: BEV_ERNST,
    bevIsBeveiliging: isBeveiliging, bevDefaults: defaults, bevFunctieAan: functieAan,
    bevFunctieLijst: functieLijst, bevZetFunctie: zetFunctie,
    bevPosten: (s) => defaults(s).posten, bevZetPost: zetPost, bevVerwijderPost: verwijderPost,
    bevBudget: budget, bevZetBudget: zetBudget,
    bevRooster: rooster, bevZetDienst: zetDienst, bevSchrapDienst: schrapDienst, bevPlanAuto: planAuto,
    bevAanvraag: aanvraag, bevAanvraagLijst: aanvraagLijst, bevBeslisAanvraag: beslisAanvraag,
    bevMijnDiensten: mijnDiensten, bevInklok: inklok, bevUitklok: uitklok,
    bevRondeStart: rondeStart, bevRondeCheckpoint: rondeCheckpoint, bevRondeKlaar: rondeKlaar,
    bevMeldIncident: meldIncident, bevBeslisIncident: beslisIncident, bevSos: sos,
    bevCommand: command
  };
}

module.exports = { BEVEILIGING_FUNCTIES: BEV_FUNCTIES, BEVEILIGING_SHIFTS: BEV_SHIFTS, maakBeveiliging };
