/* Boot-datalaag (initRealtime): schrijft alle db.data-standaarden en de demo-seed.
   Draait EENMALIG na load() en bij een failover-promotie. De inhoud is opgesplitst
   in opeenvolgende blokken (deel1..deel10); index roept ze in vaste volgorde aan,
   zodat de db.data-vorm precies gelijk blijft aan de oude, ene functie. */
module.exports = function initRealtime(ctx) {
  /* Welke zaken stonden er VOOR het zaaien? Alles wat er hierna bij komt, is
     door de seed neergezet. Dat is de enige plek waar dat nog met zekerheid te
     zien is, en het scheelt een met de hand bijgehouden lijst van codes -- die
     liep al vijftien zaken achter (zie de opruiming onderaan). */
  const voorZaaien = new Set((ctx.db.data.suppliers || []).map(s => s.code));

  /* Eerst het genre-register: alle bedrijfssoorten met hun sector en caps, van
     een plek. Dit stond verspreid over tien delen hier en zes kernmodules, elk
     met een eigen `if (!supplierTypes.x)`-regel -- dezelfde waarheid op zestien
     plekken (LAT-regel 4). Het register vult ook de sector aan op databases die
     die nog niet kenden. Moet VOOR de zaai-delen, want die zetten zaken neer
     die naar een genre wijzen. */
  require('../../seed/genres').zetRegister(ctx.db);

  require('./deel1-basis')(ctx);
  require('./deel2-kern')(ctx);
  require('./deel3-sectoren')(ctx);
  require('./deel4-genres')(ctx);
  require('./deel5-nieuwe')(ctx);
  require('./deel6-diensten')(ctx);
  require('./deel7-salon')(ctx);
  require('./deel8-bouw')(ctx);
  require('./deel9-vakken')(ctx);
  require('./deel10-genres')(ctx);
  /* Nog een keer de Salon-profielen: deel8 en deel9 zetten hun zaken pas na
     deel7 neer, en zonder bio en foto is een zaak voor leden onzichtbaar. */
  if (typeof ctx.salonProfielen === 'function') ctx.salonProfielen();

  merkGeseed(ctx, voorZaaien);
  ruimDemozakenOp(ctx);
};

/* Zet het merkteken op alles wat deze zaaironde heeft neergezet. Het teken gaat
   mee de database in, want bij een volgende start staan die zaken er al en is
   aan niets meer te zien waar ze vandaan kwamen.

   Twee bronnen, want die dekken elkaar niet:

   1. Alles wat er tijdens deze ronde bij is gekomen. Dat vangt de zaken uit
      deel1 tot en met deel4, die met een los blok per zaak worden neergezet.
   2. De basis-seed uit server/seed/leveranciers.js. Die staat al in db.data
      VOORDAT dit draait -- load() zet hem er neer -- en valt dus buiten de
      momentopname hierboven. Zonder deze tweede bron bleven de negen oudste
      demozaken (het hotel, het restaurant, de bar, de taxi, de jet) in een
      productiecatalogus staan. De codes komen uit de seed-module zelf en niet
      uit een overgeschreven lijstje, zodat er niets uit elkaar kan lopen.

   De deel-modules die met het ensure-patroon werken zetten het teken zelf ook
   op zaken die er al stonden; dat is nodig voor databases die zijn aangemaakt
   voordat dit teken bestond. */
function merkGeseed(ctx, voorZaaien) {
  const zaken = ctx.db.data.suppliers || [];
  for (const s of zaken) if (!voorZaaien.has(s.code)) s.geseed = true;

  let basis = [];
  try { basis = require('../../seed/leveranciers').suppliers || []; }
  catch (e) { console.warn('[start] basis-seed niet leesbaar voor het merkteken:', e.message); }
  const basisCodes = new Set(basis.map(s => s.code));
  for (const s of zaken) if (basisCodes.has(s.code)) s.geseed = true;
}

/* Schoonmaak: buiten Magnaat Test horen geseede testzaken niet in de catalogus,
   ook niet als de database ooit als demo begon. Echte partners (via de aanvraag
   met een Business Pass) blijven onaangeroerd.

   DIT STOND IN deel7-salon.js, EN DAAR ZAG HET DE HELFT NIET. deel8, deel9 en
   deel10 zetten hun zaken pas na deel7 neer, dus die overleefden de opruiming
   die hen juist moest weghalen: zeventien demozaken bleven in een
   productiecatalogus staan (CASTELL, TALLER, SOMBRA, IVORA en verder), terwijl
   de zes oudste -- hotel, restaurant, bar, appartement, taxi, jet -- er wel uit
   gingen. Dat is precies waarom een verse niet-demo-installatie een tandarts en
   een wasserij had maar geen hotel.

   De tweede fout zat in de lijst zelf. Die was met de hand bijgehouden en
   beloofde in het commentaar "dekt alle geseede partners", maar vijftien
   geseede zaken stonden er niet op (ZENITH, CLARA, BODE, MERIDIAAN, PORTELL,
   SEGUR en verder) -- die bleven dus hoe dan ook staan. Twee plekken die
   dezelfde waarheid vasthielden, en ze waren uit elkaar gelopen (LAT-regel 4),
   met een belofte in tekst die niet meer waar was (regel 6). De lijst is
   daarom weg: er wordt nu opgeruimd op het merkteken dat het zaaien zelf zet.

   Het personeel gaat mee. Bleef dat staan, dan hield de identiteitskluis namen
   en pincodes vast van bedrijven die niet meer bestaan -- in de aangetroffen
   database achtendertig zulke zaken, 181 personeelsrijen bij 38 catalogusposten. */
function ruimDemozakenOp(ctx) {
  const { db, save, accounts, DEMO } = ctx;
  if (DEMO) return;

  const weg = (db.data.suppliers || []).filter(s => s.geseed);
  const codes = new Set(weg.map(s => s.code));
  db.data.suppliers = (db.data.suppliers || []).filter(s => !codes.has(s.code));

  /* Het personeel van die zaken uit de kluis. Deactiveren en niet verwijderen:
     de Postgres-spiegel kent geen staff-delete, dus een DELETE zou bij de
     volgende start gewoon weer binnengetrokken worden. Zie accounts/staff.js. */
  let personen = 0;
  if (accounts && typeof accounts.deactivateStaffVanZaak === 'function')
    for (const code of codes) personen += accounts.deactivateStaffVanZaak(code);

  /* Ook alle oudere top-level testdata opruimen. Een verse echte database is
     sinds server/seed/index.js al leeg, maar een bestaande datamap kan ooit in
     de vroegere demostand zijn begonnen. Alleen exacte seed-identiteiten gaan
     weg; echte rijen die er later bij kwamen blijven staan. */
  const leden = require('../../seed/leden');
  const partners = require('../../seed/partners');
  const lab = require('../../seed/livinglab').livingLab;
  const muziek = require('../../seed/media').muziekUitgaven;
  let overige = 0;
  function zonder(lijst, isTest) {
    const bron = Array.isArray(lijst) ? lijst : [];
    const uit = bron.filter(x => !isTest(x));
    overige += bron.length - uit.length;
    return uit;
  }
  const testPosts = new Set(leden.posts.map(p => String(p.id) + '|' + p.author));
  db.data.posts = zonder(db.data.posts, p => testPosts.has(String(p.id) + '|' + p.author));
  const testFacturen = new Set(leden.invoices.map(x => x.id));
  db.data.invoices = zonder(db.data.invoices, x => testFacturen.has(x.id));
  const testContacten = new Set(leden.contacts.map(x => x.higher + '|' + x.rtg));
  db.data.contacts = zonder(db.data.contacts, x => testContacten.has(x.higher + '|' + x.rtg));
  const testPartners = new Set(partners.partners.map(x => x.code + '|' + x.name));
  db.data.partners = zonder(db.data.partners, x => testPartners.has(x.code + '|' + x.name));
  const testReizen = new Set(partners.partnerTrips.map(x => x.id));
  db.data.partnerTrips = zonder(db.data.partnerTrips, x => testReizen.has(x.id));

  if (JSON.stringify(db.data.trip || {}) === JSON.stringify(leden.trip)) {
    db.data.trip = { dest: '', dates: '', days: 0, items: [] }; overige++;
  }
  if (JSON.stringify(db.data.creatorCredit || {}) === JSON.stringify(leden.creatorCredit)) {
    db.data.creatorCredit = {}; overige++;
  }
  if (JSON.stringify(db.data.creatorLikes || {}) === JSON.stringify(leden.creatorLikes)) {
    db.data.creatorLikes = {}; overige++;
  }

  const labIds = Object.fromEntries(['labs', 'studies', 'themas', 'apparatuur', 'audit'].map(k =>
    [k, new Set((lab[k] || []).map(x => x.id))]));
  if (db.data.livingLab) for (const k of Object.keys(labIds))
    db.data.livingLab[k] = zonder(db.data.livingLab[k], x => labIds[k].has(x.id));
  if (db.data.muziekUitgaven) {
    const trackIds = new Set((muziek.lijst || []).map(x => x.id));
    db.data.muziekUitgaven.lijst = zonder(db.data.muziekUitgaven.lijst, x => trackIds.has(x.id));
  }

  if (weg.length || personen || overige) {
    save();
    console.log('[start] Magnaat-testdata opgeruimd (echte omgeving): ' + weg.length +
      ' zaken, ' + personen + ' personeelsaccounts, ' + overige + ' overige rijen/sets.');
  }
}
