/* Gedeelde, LEVENDE staat van de accounts-laag. init() (in ./index) opent de
   SQLite-database en laadt de twee sleutels en zet ze hier neer; alle deelmodules
   (kluis, mirror, users, staff) lezen ze via dit object uit, zodat ze na init
   dezelfde handle en sleutels zien. Één proces, één set. */
/* VAULT is de OORSPRONKELIJKE kluissleutel en blijft gepind: de zoek-hashes op
   e-mail en telefoon (HMAC in ./kluis) zijn ermee berekend, en die staan in de
   database als opzoeksleutel. Roteerde die mee, dan zou niemand meer op zijn
   e-mailadres kunnen inloggen.

   RING is de keyring voor de VERSLEUTELING, nieuwste sleutel eerst. Zegelen gebeurt
   altijd met RING[0]; lezen probeert de sleutels op volgorde, zodat blobs van voor
   een rotatie gewoon opengaan. VAULT is altijd de laatste in de ring. Zonder
   rotatie is RING dus [VAULT] en gedraagt alles zich als voorheen. */
module.exports = { db: null, SECRET: null, VAULT: null, RING: null };

/* ============================================================================
   VOORBEREIDE STATEMENTS, EEN KEER PER ZIN.

   Elke deelmodule deed `S.db.prepare('SELECT ...').get(id)` INLINE, bij elke
   aanroep opnieuw. Vijftig van die plekken, en node:sqlite is SYNCHROON: elk
   prepare parst de SQL en bouwt het plan, midden in de event-loop, terwijl de
   hele server wacht.

   Hoe groot dat is, is gemeten en niet geschat. CPU-profiel van het warme pad
   (POST /api/state, 8 gelijktijdige lezers, 1166 req/s, boot erbuiten):

       prepare   3.56s   8.7%   van alle zelf-tijd
       get       2.85s   7.0%

   Dat is bijna een tiende van de rekentijd voor werk dat per zin precies een
   keer hoeft te gebeuren. Het is ook precies het soort kost dat NIET opvalt in
   de latentie van een enkel verzoek -- je ziet het pas als de lus vol staat, en
   dan als vertraging bij verzoeken die zelf niets doen. Zie taak 17.

   DE CACHE HANGT AAN DE HANDLE. Wordt de database opnieuw geopend (init na een
   herstel, een tweede init in een toets), dan zijn de oude statements ongeldig
   en moeten ze weg. Daarom wordt de handle meegewogen: verandert S.db, dan
   begint de cache leeg. Zonder die controle zou een hergeopende database
   statements van de vorige handle gebruiken -- en dat faalt niet netjes. */
let _cacheDb = null;
let _cache = new Map();
module.exports.zin = function zin(sql) {
  if (_cacheDb !== module.exports.db) { _cache = new Map(); _cacheDb = module.exports.db; }
  let s = _cache.get(sql);
  if (!s) { s = module.exports.db.prepare(sql); _cache.set(sql, s); }
  return s;
};
/* Voor toetsen en onderhoud: hoeveel zinnen staan er klaar VOOR DE HUIDIGE
   HANDLE. Statements van een vorige handle tellen niet mee -- ze worden bij de
   eerstvolgende zin() toch weggegooid, en ze meetellen zou een meter opleveren
   die iets anders zegt dan de cache doet. Bewust zonder bijwerking: een meter
   die de staat verandert die hij meet, is geen meter. */
module.exports.zinnen = () => (_cacheDb === module.exports.db ? _cache.size : 0);
