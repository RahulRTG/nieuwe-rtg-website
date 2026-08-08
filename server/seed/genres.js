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

module.exports = { SECTOREN, GENRES, zetRegister, zetGenre, genresVan, sectorVan };
