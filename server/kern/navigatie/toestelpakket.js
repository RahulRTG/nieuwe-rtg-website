/* HET KAARTPAKKET VOOR HET TOESTEL -- wat een lid werkelijk kan ophalen, en
   wat er met opzet niet meegaat.

   Stap 1 was: RTG biedt elk gebied aan en het lid kiest (./gebieden.js,
   ./mijnkaarten.js). Dit is stap 2, de halve stap die er echt is: de GRAAF van
   een gebouwd pakket is op te halen en op het toestel te bewaren. Wat er niet
   is staat hieronder met de reden, want een download die "offline navigatie"
   heet terwijl de helft mist, is de gevaarlijkste vorm van marketing.

   DE LIJST IS GESLOTEN, EN DAT IS DE HELE BEVEILIGING. Een lid vraagt niet om
   een BESTANDSNAAM maar om een van deze acht delen. Wie hier een vrij pad
   toelaat, opent RTG_DATA_DIR -- daar staan ook de sleutels en de database.
   ./pakket.js weert al een onveilige gebiedscode; deze lijst weert de tweede
   helft van dezelfde aanval.

   DE LICENTIE GAAT VOOR DE BYTES. Een pakket op een toestel zetten is
   VERSPREIDEN, en ODbL eist dan naamsvermelding. De poort van ./gebieden.js
   wordt daarom gevraagd VOORDAT er een byte uitgaat, en de vermelding reist mee
   in het manifest -- niet als los veld dat een scherm mag vergeten, maar als
   het antwoord zelf: geen vermelding, geen manifest.

   WAT ER NIET MEEGAAT, EN WAAROM. De `<code>.sqlite` naast de graaf blijft op
   de server. Daar zitten de plaatsnamen (FTS), de wegnamen en de geometrie in,
   en dat is een ZOEKINDEX voor een query-engine die een browser niet heeft.
   Meesturen zou betekenen: een database van tientallen megabytes plus een
   engine erbij, voor iets wat vandaag online prima werkt. Gevolg is wel dat een
   route die het TOESTEL zelf rekent geen straatnamen kent; dat staat in het
   manifest als `nietMeegeleverd` en niet als stilte.

   EN DE SERVER WEET NIET WAT ER OP UW TOESTEL STAAT. Dat is geen tekort maar
   een feit: opslag in een browser is van de browser. Deze laag levert dus wat
   er TE HALEN is; wat er STAAT meet het scherm zelf, en het mag het van de
   browser ook weer kwijtraken. */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { pakketVan, pakketLigt } = require('./pakket');
const gebieden = require('./gebieden');

/* De acht delen van de graaf, in de vorm die ./gebiednet.js werkelijk leest.
   Dezelfde namen als test/navigatie-pakket-fixture.js bouwt -- wie hier iets
   verzint, levert een pakket dat de motor niet kan lezen. */
const DELEN = ['graaf.json', 'coords.f64', 'offsets.u32', 'doelen.u32',
  'kosten.f32', 'lengtes.f32', 'wegen.u32', 'vlaggen.u8'];
const TYPE_VAN = (naam) => naam.endsWith('.json') ? 'application/json' : 'application/octet-stream';

/* HET CONTROLEGETAL IS GEEN LUXE. Een half opgehaald of stuk bestand levert
   geen foutmelding maar een ROUTE: de motor leest onzin uit de typed arrays en
   rekent er een net uitziende weg mee. Een lengte alleen vangt afkappen wel en
   omkiepen niet, dus sha256 -- en hij wordt STROMEND berekend, want een
   landgraaf is geen klein bestand.

   Gecachet op grootte plus mtime, en niet op de naam: een opnieuw gebouwd
   pakket krijgt daarmee vanzelf een nieuw getal. Zonder die cache zou elk
   manifest de hele graaf opnieuw hashen, en dat is een kostenpost die op geen
   enkele nota staat (dezelfde les als de cataloguscache in ./gebieden.js). */
const somCache = new Map();
const stempelVan = (st) => st.size + '|' + st.mtimeMs;
function som(pad, st) {
  const eerder = somCache.get(pad);
  const stempel = stempelVan(st);
  if (eerder && eerder.stempel === stempel) return Promise.resolve(eerder.som);
  return new Promise((klaar, stuk) => {
    const h = crypto.createHash('sha256');
    fs.createReadStream(pad)
      .on('error', stuk)
      .on('data', (d) => h.update(d))
      .on('end', () => {
        /* Zestien bytes van de som. Genoeg om een stuk bestand te vinden, kort
           genoeg om acht ervan in een manifest te zetten zonder dat het
           antwoord vier keer zo groot wordt als de rest. */
        const uit = h.digest('hex').slice(0, 32);
        somCache.set(pad, { stempel, som: uit });
        klaar(uit);
      });
  });
}

const gebiedVanCode = (code) => {
  const c = String(code || '').toLowerCase();
  return gebieden.catalogus().gebieden.find(g => g.code === c) || null;
};

/* DE POORT, IN DEZE VOLGORDE, en die volgorde is de reden dat hij een eigen
   functie is: bestaat het gebied, mag het van de licentie, en LIGT het pakket
   er? Drie verschillende antwoorden met drie verschillende codes -- een 404 op
   een gebied dat wel bestaat maar nog niet gebouwd is, stuurt iemand een
   middag de verkeerde kant op. */
function poort(code) {
  const g = gebiedVanCode(code);
  if (!g) return { status: 404, error: 'Dit gebied staat niet in de catalogus van RTG.' };
  const mag = gebieden.mag(g);
  if (!mag.ok) return { status: 403, error: mag.reden };
  if (!pakketLigt(g.code)) {
    return { status: 409, error: 'De kaart van ' + (g.naam || g.code) + ' is nog niet gebouwd, dus er is ' +
      'niets om op te halen. Uw keuze blijft staan: dat is precies het verzoek waaruit RTG weet wat er ' +
      'gebouwd moet worden.' };
  }
  return { ok: true, gebied: g, naamsvermelding: mag.naamsvermelding, licentie: mag.licentie };
}

/* Het manifest: wat er te halen is, hoe groot, en waaraan het toestel kan zien
   dat het heel is aangekomen. Async, want de controlegetallen komen stromend
   uit de bestanden. */
async function manifest(code) {
  const p = poort(code);
  if (!p.ok) return p;
  const pak = pakketVan(p.gebied.code);
  const delen = [];
  let bytesTotaal = 0;
  for (const naam of DELEN) {
    const pad = path.join(pak.graafMap, naam);
    let st = null;
    try { st = fs.statSync(pad); } catch (e) { st = null; }
    /* EEN HALF PAKKET IS GEEN PAKKET. Ontbreekt een deel, dan weigert het hele
       manifest met de naam erin -- niet zeven delen aanbieden en het toestel
       laten ontdekken dat de graaf niet compleet is. */
    if (!st || !st.isFile() || st.size === 0) {
      return { status: 409, error: 'Het pakket van ' + (p.gebied.naam || p.gebied.code) + ' is niet ' +
        'compleet: ' + naam + ' ontbreekt of is leeg. RTG biedt geen halve kaart aan.' };
    }
    bytesTotaal += st.size;
    delen.push({ naam, bytes: st.size, som: await som(pad, st), soort: TYPE_VAN(naam),
      adres: '/api/nav/gebied/pakket/' + p.gebied.code + '/' + naam });
  }
  let versie = null;
  try { versie = JSON.parse(fs.readFileSync(path.join(pak.graafMap, 'graaf.json'), 'utf8')).versie ?? null; }
  catch (e) { versie = null; }
  return { status: 200, code: p.gebied.code, naam: p.gebied.naam, versie,
    delen, bytesTotaal, licentie: p.licentie, naamsvermelding: p.naamsvermelding,
    /* Wat het toestel hiermee NIET kan, op de plek waar iemand het leest. */
    nietMeegeleverd: [
      { wat: 'plaatsnamen en zoeken', waarom: 'die staan in de SQLite-index naast de graaf; een browser ' +
        'heeft geen query-engine om hem te lezen. Zoeken blijft dus online.' },
      { wat: 'straatnamen bij de aanwijzingen', waarom: 'die komen uit dezelfde index. Een route die het ' +
        'toestel zelf rekent, kent de vorm van de weg wel en zijn naam niet.' }
    ],
    /* De server kan dit niet weten, en zegt dat in plaats van `false` te
       antwoorden: opslag in een browser is van de browser. */
    opToestel: null,
    opToestelWaarom: 'Of dit pakket op dit toestel staat, weet alleen het toestel zelf -- en de browser ' +
      'mag het ook weer weggooien. Het scherm meet het en belooft het niet.' };
}

/* Een deel opvragen om te STREAMEN. Deze functie opent niets en leest niets:
   ze geeft alleen het pad terug dat de route mag versturen, plus de lengte en
   de soort. Zo blijft er één plek waar een gebiedscode en een deelnaam in een
   pad veranderen (./pakket.js plus de gesloten lijst hierboven). */
function deel(code, naam) {
  const n = String(naam || '');
  if (!DELEN.includes(n)) {
    return { status: 404, error: 'Dat is geen deel van een RTG-kaartpakket. Het manifest ' +
      '(/api/nav/gebied/pakket) noemt de delen die er zijn.' };
  }
  const p = poort(code);
  if (!p.ok) return p;
  const pad = path.join(pakketVan(p.gebied.code).graafMap, n);
  let st = null;
  try { st = fs.statSync(pad); } catch (e) { st = null; }
  if (!st || !st.isFile()) return { status: 409, error: 'Dit deel ligt er niet: ' + n };
  return { ok: true, pad, bytes: st.size, soort: TYPE_VAN(n), naamsvermelding: p.naamsvermelding };
}

module.exports = function maakToestelpakket() {
  return { navKaartPakket: manifest, navKaartDeel: deel };
};
module.exports.DELEN = DELEN;
