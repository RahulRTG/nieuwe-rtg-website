/* HET GENRE-REGISTER: alle bedrijfssoorten van het platform, op EEN plek.

   Waarom dit bestaat. Deze 73 genres stonden verspreid over tien initdata-delen
   en zes kernmodules, elk met hun eigen `if (!db.data.supplierTypes.x)`-regel.
   Dat is precies de vorm die LAT-regel 4 verbiedt: dezelfde waarheid op meer
   dan een plek, en die lopen uit elkaar. Dat gebeurde ook -- de opruimlijst van
   de demozaken liep vijftien zaken achter op wat er werkelijk gezaaid werd.

   Drie niveaus, en dat is de hele mechaniek van het platform:

     sector  ->  genre  ->  caps

   - De SECTOR (industry) draagt de gedeelde motor. Een hotel, een appartement,
     een villa en een wintersportresort delen hospitality; een restaurant, een
     bar, een club en een beachclub delen horeca. Zonder dit niveau kan
     sectorlogica nergens wonen: aan een cap gehangen lekt housekeeping naar
     wellness, aan een genre gehangen moet het bij elk zustergenre opnieuw.
   - Het GENRE is wat een zaak IS, en bepaalt hoe de software aanvoelt.
   - De CAPS bepalen wat een zaak KAN, en dus welke schermen zij krijgt. Die
     staan hier als wat het genre standaard meebrengt; wat een individuele zaak
     werkelijk kan komt uit kern/werkvormen.js (capsVan), want dat hangt aan
     haar eigen inhoud -- een kaart, een vloot, een collectie.

   Wie een genre toevoegt, doet dat HIER en nergens anders. test/genreregister
   .test.js zakt zodra een genre buiten dit bestand wordt gedefinieerd, zodat de
   verspreiding niet terugkomt.

   Zie PLATFORM.md voor waar dit register naartoe werkt. */

/* De sectoren, met hun leesbare naam. Een sector zonder genres bestaat niet. */
const SECTOREN = {
  hospitality: 'Verblijf',
  horeca: 'Horeca & nachtleven',
  mobility: 'Vervoer',
  aviation: 'Luchtvaart',
  maritime: 'Maritiem',
  automotive: 'Automotive',
  retail: 'Retail',
  wholesale: 'Groothandel',
  agriculture: 'Agrarisch',
  healthcare: 'Zorg',
  pharmacy: 'Farmacie',
  veterinary: 'Dierenzorg',
  beauty: 'Beauty & wellness',
  childcare: 'Kinderopvang',
  education: 'Onderwijs',
  government: 'Overheid',
  safety: 'Veiligheid & hulpdiensten',
  construction: 'Bouw & vakwerk',
  realestate: 'Vastgoed',
  facility: 'Facility',
  insurance: 'Verzekeren',
  professional: 'Zakelijke dienstverlening',
  technology: 'Technologie',
  media: 'Media',
  events: 'Events & cultuur',
  sports: 'Sport'
};

/* De genres zelf staan in ./genres-lijst.js -- pure data, afgesplitst omdat een
   productbestand niet over de 12 KB hoort (keuringsregel). */
const GENRES = require('./genres-lijst');

/* ---- DE TOEGANGSSTANDEN ----

   Wie mag dit genre aanvragen? Vijf standen, en een genre heeft er precies een.

   Hiervoor was het antwoord een tweede lijst in kern/aanmeldingen/bedrijf.js:
   31 met de hand overgetypte namen, en `GENRES.includes(type) ? type : 'zzp'`
   voor de rest. Die stille omzetting is de reden dat dit veld bestaat. Een
   genre dat niet openstaat hoort "niet beschikbaar" te zeggen -- niet iets
   anders te worden. Een ondernemer die om een juwelier vraagt en een zzp-zaak
   krijgt, merkt dat pas als de verkeerde tools op zijn scherm staan.

   'binnenkort' is geen belofte met een datum, en zo hoort hij ook niet te
   klinken: het genre bestaat in het register (een zaak kan hem dragen, de
   sectorlaag kent hem), alleen de aanvraagweg staat nog niet open. */
const TOEGANG = {
  open: { mag: true,
    uitleg: 'Iedereen kan een zaak in dit genre aanvragen.' },
  /* STOND DICHT TOT DE BEWIJSSTAP ER WAS, EN STAAT NU OPEN. Deze acht genres
     (ziekenhuis, apotheek, kinderopvang, beveiliging en hun buren) mochten niet
     open met een `bewijsNodig`-vlag die niemand handhaafde -- dat is een open
     deur met een bordje ernaast.

     Die stap bestaat nu: de aanvraag komt binnen met `bewijsNodig` op de
     aanmelding (kern/aanmeldingen/bedrijf.js), en kern/aanmeldingen/bewijs.js
     houdt de provisioning tegen tot een MENS het stuk heeft gezien en
     afgetekend. De vlag doet dus werk, en daarom mag de deur open. */
  bewijs: { mag: true, bewijsNodig: true,
    uitleg: 'Aanvragen kan. RTG vraagt bewijs (vergunning, inschrijving of diploma) voordat de zaak live gaat; een medewerker beoordeelt dat stuk.' },
  uitnodiging: { mag: false, opUitnodiging: true,
    uitleg: 'Dit genre gaat alleen op uitnodiging van RTG open.' },
  intern: { mag: false,
    uitleg: 'Dit genre hoort bij de wereld zelf en wordt niet door een partner aangevraagd.' },
  binnenkort: { mag: false,
    uitleg: 'Dit genre staat in het register, maar de aanvraagweg is nog niet open.' }
};

/* De stand van een genre. Een genre zonder status is een fout in het register
   en geen reden om iets toe te staan: onbekend betekent dicht. */
function toegangVan(id) {
  const def = GENRES[id];
  if (!def) return null;
  return TOEGANG[def.status] ? def.status : null;
}

/* MAG DEZE AANVRAAG DIT GENRE? Het enige antwoord op die vraag in dit huis.
   Geeft { ok: true, ... } of { ok: false, reden, uitleg } -- nooit een ander
   genre. Een uitnodiging tilt 'uitnodiging' op en niets anders: 'intern' blijft
   intern, ook met een uitnodiging in de hand. */
function genreToegang(id, opties) {
  const stand = toegangVan(id);
  if (!stand) {
    return { ok: false, reden: 'onbekend', genre: id || null,
      uitleg: 'Dit genre kennen we niet.' };
  }
  const t = TOEGANG[stand];
  const viaUitnodiging = !!(opties && opties.viaUitnodiging);
  if (t.mag || (t.opUitnodiging && viaUitnodiging)) {
    return { ok: true, genre: id, stand, bewijsNodig: !!t.bewijsNodig };
  }
  return { ok: false, reden: stand, genre: id, uitleg: t.uitleg };
}

/* De genres die een gewone aanvrager nu kan kiezen. Vervangt de overgetypte
   lijst; wie een genre openzet doet dat in het register en de keuzelijst
   verandert mee. */
function aanvraagbareGenres(opties) {
  return Object.keys(GENRES).filter(id => genreToegang(id, opties).ok);
}

function genresMetStand(stand) {
  return Object.keys(GENRES).filter(id => GENRES[id].status === stand);
}

/* Een losse kopie van een genre-definitie. Alles gaat mee -- ook een vlag als
   `besloten` -- zodat een nieuw veld hier niet stilletjes wegvalt onderweg. */
function kopie(def) { return Object.assign({}, def, { caps: [...def.caps] }); }

/* Zet het register in een database die het nog niet (helemaal) heeft. Draait bij
   elke start: nieuwe genres komen erbij, en een bestaand genre krijgt alsnog
   zijn sector -- dat laatste is nodig voor databases van voor dit register.
   De caps van een bestaand genre blijven staan; die kunnen door een migratie of
   door de boardroom zijn aangepast en dit register mag dat niet terugdraaien. */
function zetRegister(db) {
  if (!db.data.supplierTypes) db.data.supplierTypes = {};
  const t = db.data.supplierTypes;
  for (const [id, def] of Object.entries(GENRES)) {
    if (!t[id]) { t[id] = kopie(def); continue; }
    if (!t[id].industry) t[id].industry = def.industry;
    if (!t[id].label) t[id].label = def.label;
    if (!t[id].icon) t[id].icon = def.icon;
    /* De toegangsstand wordt net als de sector bijgevuld. Zonder deze regel
       zou hij alleen op verse installaties bestaan, en draait elke bestaande
       database verder op genres zonder stand -- waar genreToegang() dan "dicht"
       van maakt en er dus niets meer aan te vragen valt. */
    if (!t[id].status) t[id].status = def.status;
    /* De oude vlag opruimen waar hij nog staat: hij is opgegaan in de status en
       twee velden over dezelfde vraag lopen uiteen. */
    if (t[id].besloten !== undefined) delete t[id].besloten;
  }
  return t;
}

/* Eén genre neerzetten. Voor kernmodules die hun eigen demozaak zaaien en het
   genre nodig hebben ook als initRealtime nog niet langs is geweest -- in een
   toets met een kale database bijvoorbeeld. De definitie komt uit dit register,
   zodat er geen tweede kopie van label, icon en caps ontstaat. */
function zetGenre(db, id) {
  const def = GENRES[id];
  if (!def) throw new Error('onbekend genre: ' + id);
  if (!db.data.supplierTypes) db.data.supplierTypes = {};
  if (!db.data.supplierTypes[id]) db.data.supplierTypes[id] = kopie(def);
  return db.data.supplierTypes[id];
}

/* Alle genres van een sector, en de sector van een genre. */
function genresVan(industry) { return Object.keys(GENRES).filter(g => GENRES[g].industry === industry); }
function sectorVan(genre) { return (GENRES[genre] || {}).industry || null; }

module.exports = { SECTOREN, GENRES, zetRegister, zetGenre, genresVan, sectorVan,
  TOEGANG, toegangVan, genreToegang, aanvraagbareGenres, genresMetStand };
