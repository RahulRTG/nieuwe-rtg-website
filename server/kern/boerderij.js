/* De boerderij-laag: een breed, slim genre voor boeren en tuinders. Alsof elke
   boerderij op RTG draait, met een meedenkend systeem dat de boer door het jaar
   loodst.

   Verschillende soorten boerderijen (de boer kiest er een, dat stuurt welke
   modules tellen):
   - akkerbouw   : gewassen op het veld (tarwe, mais, aardappel, ...)
   - tuinbouw    : groente onder glas / in de kas (tomaat, komkommer, sla, ...)
   - fruitteelt  : boomgaard (appel, peer, sinaasappel, amandel, ...)
   - wijngaard   : druiven voor wijn
   - melkvee     : koeien, dagelijkse melk
   - pluimvee    : kippen, dagelijkse eieren
   - varkens     : varkenshouderij
   - schapen     : schapen en geiten
   - gemengd     : gewassen EN dieren
   - bio         : biologisch gemengd bedrijf

   De boer beheert PERCELEN (met een gewas dat zaait -> groeit -> te oogsten is),
   DIEREN (aantal, voer, dagopbrengst) en een TAKENBORD. Het systeem rekent de
   groei uit, seint wat vandaag moet gebeuren (de Vandaag-briefing, seizoensbewust)
   en er is een AI-adviseur die vragen beantwoordt en ook echt DINGEN doet (een
   perceel aanmaken, zaaien, oogsten, dieren bijzetten, een taak plannen). Met een
   Claude-sleutel is de adviseur slim; zonder sleutel valt hij terug op een
   ingebouwde kennisbank + opdrachtherkenning, zodat het altijd werkt.

   maakBoerderij(state) volgt het vaste kern-patroon. */

// De boerderijtypes. kind bepaalt welke modules meetellen (gewas/dier/allebei).
const BTYPES = {
  akkerbouw:  { label: 'Akkerbouw',   labelEn: 'Arable',      icon: '\u{1F33E}', kind: 'gewas', gewassen: ['tarwe', 'mais', 'aardappel', 'suikerbiet', 'gerst'] },
  tuinbouw:   { label: 'Tuinbouw / kas', labelEn: 'Horticulture', icon: '\u{1F345}', kind: 'gewas', gewassen: ['tomaat', 'komkommer', 'paprika', 'sla', 'aardbei'] },
  fruitteelt: { label: 'Fruitteelt',  labelEn: 'Orchard',     icon: '\u{1F34E}', kind: 'gewas', gewassen: ['appel', 'peer', 'sinaasappel', 'citroen', 'amandel'] },
  wijngaard:  { label: 'Wijngaard',   labelEn: 'Vineyard',    icon: '\u{1F347}', kind: 'gewas', gewassen: ['druif'] },
  melkvee:    { label: 'Melkvee',     labelEn: 'Dairy',       icon: '\u{1F404}', kind: 'dier', dieren: ['melkkoe'] },
  pluimvee:   { label: 'Pluimvee',    labelEn: 'Poultry',     icon: '\u{1F414}', kind: 'dier', dieren: ['legkip'] },
  varkens:    { label: 'Varkenshouderij', labelEn: 'Pigs',    icon: '\u{1F416}', kind: 'dier', dieren: ['varken'] },
  schapen:    { label: 'Schapen & geiten', labelEn: 'Sheep & goats', icon: '\u{1F411}', kind: 'dier', dieren: ['schaap', 'geit'] },
  gemengd:    { label: 'Gemengd bedrijf', labelEn: 'Mixed',   icon: '\u{1F69C}', kind: 'gemengd', gewassen: ['tarwe', 'mais', 'aardappel'], dieren: ['melkkoe', 'legkip'] },
  bio:        { label: 'Biologisch gemengd', labelEn: 'Organic', icon: '\u{1F331}', kind: 'gemengd', gewassen: ['sla', 'wortel', 'pompoen'], dieren: ['legkip', 'schaap'] }
};

// Gewaskennis: groeidagen (zaai -> oogst), eenheid en opbrengst per hectare.
// mnd = de maanden waarin je normaal zaait/plant (1-12), voor het seizoensadvies.
const GEWASSEN = {
  tarwe:      { label: 'Tarwe',      groeidagen: 240, eenheid: 'kg', perHa: 8000,  zaaiMnd: [10, 11] },
  gerst:      { label: 'Gerst',      groeidagen: 210, eenheid: 'kg', perHa: 7000,  zaaiMnd: [10, 3] },
  mais:       { label: 'Mais',       groeidagen: 150, eenheid: 'kg', perHa: 11000, zaaiMnd: [4, 5] },
  aardappel:  { label: 'Aardappel',  groeidagen: 110, eenheid: 'kg', perHa: 45000, zaaiMnd: [4, 5] },
  suikerbiet: { label: 'Suikerbiet', groeidagen: 200, eenheid: 'kg', perHa: 75000, zaaiMnd: [3, 4] },
  tomaat:     { label: 'Tomaat',     groeidagen: 90,  eenheid: 'kg', perHa: 60000, zaaiMnd: [2, 3, 4] },
  komkommer:  { label: 'Komkommer',  groeidagen: 60,  eenheid: 'kg', perHa: 55000, zaaiMnd: [2, 3, 4] },
  paprika:    { label: 'Paprika',    groeidagen: 100, eenheid: 'kg', perHa: 40000, zaaiMnd: [2, 3] },
  sla:        { label: 'Sla',        groeidagen: 45,  eenheid: 'krop', perHa: 40000, zaaiMnd: [3, 4, 5, 6, 7, 8] },
  aardbei:    { label: 'Aardbei',    groeidagen: 70,  eenheid: 'kg', perHa: 25000, zaaiMnd: [3, 4] },
  wortel:     { label: 'Wortel',     groeidagen: 80,  eenheid: 'kg', perHa: 60000, zaaiMnd: [3, 4, 5, 6] },
  pompoen:    { label: 'Pompoen',    groeidagen: 110, eenheid: 'stuk', perHa: 20000, zaaiMnd: [5, 6] },
  appel:      { label: 'Appel',      groeidagen: 160, eenheid: 'kg', perHa: 45000, zaaiMnd: [4] },
  peer:       { label: 'Peer',       groeidagen: 170, eenheid: 'kg', perHa: 35000, zaaiMnd: [4] },
  sinaasappel:{ label: 'Sinaasappel', groeidagen: 240, eenheid: 'kg', perHa: 40000, zaaiMnd: [3] },
  citroen:    { label: 'Citroen',    groeidagen: 220, eenheid: 'kg', perHa: 35000, zaaiMnd: [3] },
  amandel:    { label: 'Amandel',    groeidagen: 210, eenheid: 'kg', perHa: 2500,  zaaiMnd: [2, 3] },
  druif:      { label: 'Druif',      groeidagen: 150, eenheid: 'kg', perHa: 12000, zaaiMnd: [3, 4] }
};

// Dierkennis: wat het dagelijks oplevert (eenheid) en hoeveel voer per dier per dag.
const DIEREN = {
  melkkoe: { label: 'Melkkoe', opbrengst: 'melk', eenheid: 'L', perDier: 28, voerKg: 22 },
  legkip:  { label: 'Legkip',  opbrengst: 'eieren', eenheid: 'st', perDier: 0.9, voerKg: 0.13 },
  varken:  { label: 'Varken',  opbrengst: 'vlees', eenheid: 'kg', perDier: 0, voerKg: 2.5 },
  schaap:  { label: 'Schaap',  opbrengst: 'wol/melk', eenheid: 'L', perDier: 1.5, voerKg: 2 },
  geit:    { label: 'Geit',    opbrengst: 'melk', eenheid: 'L', perDier: 3, voerKg: 2 }
};

function maakBoerderij({ db, save, crypto, findSupplier, anthropic, schoon }) {
  const id = (p) => (p || 'x') + crypto.randomBytes(3).toString('hex');
  const nu = () => new Date().toISOString();
  const vandaag = () => new Date().toISOString().slice(0, 10);
  const scho = schoon || ((v, n) => String(v == null ? '' : v).trim().slice(0, n || 120));
  const getal = (v, max) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : 0; };

  function isBoer(s) { return !!s && ((db.data.supplierTypes[s.type] || {}).caps || []).includes('boerderij'); }

  // Zorg dat de boerderij-structuur bestaat.
  function ensure(s) {
    if (!s.boerderij) s.boerderij = { type: null, opgezet: false, percelen: [], dieren: [], taken: [], instel: {} };
    const b = s.boerderij;
    if (!Array.isArray(b.percelen)) b.percelen = [];
    if (!Array.isArray(b.dieren)) b.dieren = [];
    if (!Array.isArray(b.taken)) b.taken = [];
    if (!Array.isArray(b.producten)) b.producten = [];
    if (!b.instel) b.instel = {};
    return b;
  }

  // Oogst en dieropbrengst vullen de winkelvoorraad: zoek een bestaand product op
  // naam of maak er een aan (prijs 0 tot de boer die zet).
  function voegAanVoorraad(b, naam, eenheid, aantal) {
    if (!naam || !(aantal > 0)) return;
    let p = b.producten.find(x => x.naam.toLowerCase() === String(naam).toLowerCase());
    if (!p) { p = { id: id('pr'), naam: String(naam), eenheid: eenheid || 'kg', prijs: 0, voorraad: 0, bron: 'oogst' }; b.producten.push(p); }
    p.voorraad = Math.round((p.voorraad || 0) + aantal);
  }

  function seizoen(d) {
    const m = (d || new Date()).getMonth() + 1;
    if ([12, 1, 2].includes(m)) return 'winter';
    if ([3, 4, 5].includes(m)) return 'lente';
    if ([6, 7, 8].includes(m)) return 'zomer';
    return 'herfst';
  }
  const SEIZOEN_LABEL = { winter: 'winter', lente: 'lente', zomer: 'zomer', herfst: 'herfst' };

  // Hoe ver is een gewas? Geeft fase + voortgang (0-1) + resterende dagen.

  /* De drie lagen (erf, beheer, adviseur) draaien als submodules op een
     gedeelde context, een keer opgebouwd bij het opstarten; elke laag komt
     na het mounten de context in zodat de volgende hem kan gebruiken. */
  const ctx = { db, save, crypto, findSupplier, anthropic, schoon,
    BTYPES, GEWASSEN, DIEREN,
    isBoer, ensure, voegAanVoorraad, seizoen, SEIZOEN_LABEL, id, nu, vandaag, scho, getal };
  const deelErf = require('./boerderij/erf')(ctx);
  Object.assign(ctx, deelErf);
  const deelBeheer = require('./boerderij/beheer')(ctx);
  Object.assign(ctx, deelBeheer);
  const deelAdviseur = require('./boerderij/adviseur')(ctx);
  const { gewasFase, perceelPubliek, dierPubliek, briefing, stats, overzicht } = deelErf;
  const { zetProduct, productVan, markeerInSalon, kiesType, zetPerceel, zaaiPerceel, waterPerceel, oogstPerceel, zetDier, voerDier, opbrengstDier, zetTaak, rondTaak } = deelBeheer;
  const { advies } = deelAdviseur;

  return {
    BTYPES, GEWASSEN, DIEREN,
    isBoer, ensure, overzicht, briefing,
    kiesType, zetPerceel, zaaiPerceel, waterPerceel, oogstPerceel,
    zetDier, voerDier, opbrengstDier, zetTaak, rondTaak,
    zetProduct, productVan, markeerInSalon,
    advies, perceelPubliek, dierPubliek
  };
}

module.exports = { maakBoerderij, BTYPES, GEWASSEN, DIEREN };
