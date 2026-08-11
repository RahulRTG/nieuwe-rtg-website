/* RTG Geldgraaf, fase 1 van GELD.md: de cockpit staat voor een vers lid, de
   patroonherkenning vindt terugkerende posten en meldt een prijsstijging als
   'post-duurder', een minimumbuffer-regel geeft een uitzondering met een
   controlespoor, en de gegronde Rahul rekent zonder AI-sleutel met de ECHTE
   vrije ruimte -- geen demozin die doet alsof.

   Vervoer: alles over het routecontract met fetch en een Authorization-kop
   (een token reist nooit in een URL), behalve de patroonherkenning: de
   betaal-API neemt geen datum aan (pay stempelt zelf `at`), dus betalingen
   die 30 dagen uit elkaar liggen bestaan alleen door de kern rechtstreeks
   in-process te bespelen, zoals test/geldwereld.test.js dat ook doet. Dat is
   eerlijker dan dit deel overslaan: de motor wordt echt gemeten.

   Elke toets is tegen een tijdelijk kapotgemaakte kern gezien zakken
   (LAT.md regel 2); de geziene mutatie staat per toets in het commentaar.

   Draai los: node --experimental-sqlite --test test/geldgraaf.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');

let srv, base;

const api = (pad, body, token) => fetch(base + pad, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

/* Een piepklein geldig PNG'je: RTG Pay vraagt een rtg-lid eenmalig een
   paspoortfoto voordat de wallet opengaat. De toetsen lopen die poort gewoon
   af in plaats van hem te omzeilen -- een geldtoets die de identiteitscontrole
   overslaat, toetst een systeem dat niet bestaat (zie test/portemonnee.test.js). */
const MINI_PNG = 'data:image/png;base64,' +
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

let teller = 0;
async function versLid() {
  const t = Date.now() + '-' + (teller++);
  const r = await api('/api/auth/register', {
    name: 'Graaf Toets', email: 'geldgraaf-' + t + '@toets.example',
    password: 'geheim123', geboortedatum: '1985-05-05', tier: 'rtg'
  });
  assert.ok(r.body.token, 'registreren hoort een token te geven, kreeg: ' + JSON.stringify(r.body).slice(0, 160));
  const kyc = await api('/api/verify/upload', { image: MINI_PNG }, r.body.token);
  assert.equal(kyc.status, 200, 'het paspoort hoort aangenomen te worden: ' + JSON.stringify(kyc.body).slice(0, 160));
  return r.body.token;
}

/* De AI-sleutels leeg: de Rahul-toets onderaan bewijst het REKENENDE
   terugvalpad, en met een sleutel uit de omgeving zou hij stil een
   modelantwoord toetsen in plaats van de som. */
test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '', GEMINI_API_KEY: '', GOOGLE_API_KEY: '' } });
  base = srv.base;
});
test.after(() => stop(srv));

/* 2a. Een vers lid krijgt een staande cockpit in exact de contractvorm.
   Bronnen mogen stil melden (dat is eerlijkheid, geen fout), maar de cockpit
   zelf staat, rekent in hele centen en heeft niets aan zijn hoofd.

   MUTATIE GEZIEN ZAKKEN: in server/routes/geld.js de `ok: true` uit het
   cockpit-antwoord gehaald; zakte op "de cockpit hoort ok te dragen".
   Teruggedraaid, daarna groen. */
test('een vers lid krijgt een staande cockpit: contractvorm, hele centen, lege uitzonderingen; zonder token 401', async () => {
  /* Eerst de deur: zonder Authorization-kop geen cockpit. Dit hoort bij het
     contract, want de UI stuurt het token uitsluitend in die kop. */
  const kaal = await fetch(base + '/api/geld/cockpit', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
  });
  assert.equal(kaal.status, 401, 'zonder token hoort de cockpit dicht te zijn');

  const tok = await versLid();
  const r = await api('/api/geld/cockpit', {}, tok);
  assert.equal(r.status, 200, 'de cockpit hoort te staan: ' + JSON.stringify(r.body).slice(0, 160));
  const c = r.body;
  assert.equal(c.ok, true, 'de cockpit hoort ok te dragen');
  assert.deepEqual(Object.keys(c).sort(),
    ['bronnen', 'cijfers', 'ok', 'stil', 'tijdlijn', 'uitzonderingen', 'verwachting', 'vooruitblik'],
    'exact de contractvorm; de UI bouwt hier blind op');
  assert.deepEqual(Object.keys(c.cijfers).sort(),
    ['bufferMaanden', 'eindeMaandCenten', 'lasten14dCenten', 'vrijCenten']);
  for (const veld of ['vrijCenten', 'lasten14dCenten', 'eindeMaandCenten'])
    assert.ok(Number.isInteger(c.cijfers[veld]), veld + ' hoort rauw in hele centen (kreeg ' + c.cijfers[veld] + ')');
  assert.ok(c.cijfers.bufferMaanden === null || Number.isFinite(c.cijfers.bufferMaanden),
    'bufferMaanden is een getal of eerlijk null, nooit iets ertussenin');
  assert.deepEqual(c.uitzonderingen, [], 'een vers lid heeft niets aan zijn hoofd; rust is een uitkomst');
  assert.ok(typeof c.verwachting === 'string' && c.verwachting.length > 0, 'de verwachting is een zin in gewone taal');
  assert.deepEqual(Object.keys(c.vooruitblik).sort(), ['d30', 'd7', 'd90']);
  for (const h of ['d7', 'd30', 'd90'])
    assert.ok(Number.isInteger(c.vooruitblik[h]), 'vooruitblik ' + h + ' hoort rauw in hele centen');
  assert.ok(Array.isArray(c.tijdlijn), 'de tijdlijn is een lijst');
  assert.ok(c.bronnen.includes('wallet') && c.bronnen.includes('beleid'), 'de bronnenlijst noemt de gelddomeinen');
  for (const s of c.stil)
    assert.ok(c.bronnen.includes(s), 'een stille bron hoort een BEKENDE bron te zijn, niet: ' + s);
});

/* ---- patroonherkenning, in-process ----

   De kern precies zoals de server hem aan elkaar zet (echte geldbeleid-laag,
   echte graaf), alleen de bronnen als stubs zodat de wallet-boekingen een
   datum in het verleden kunnen dragen. De boekingvorm is die van
   pay.boekingenVan: { id, van, naar, centen, soort, oms, ref, at }. */
const REK = 'lid:TOETS-LID';
function maakGraaf(boekingen) {
  const kern = {
    codenaamVan: () => 'TOETS-LID',
    pay: { rekLid: () => REK, saldoVan: () => 50000, boekingenVan: () => boekingen },
    wbwMijn: () => ({ groepen: [] }),
    mecenaat: () => ({ giften: [] }),
    labfonds: { mijnBijdragen: () => [] },
    accRollen: () => ({ rollen: [] }),
    payroll: { strokenVan: () => [] }
  };
  const { geldbeleid } = require('../server/kern/geldbeleid')({ db: { data: {} }, save: () => {} });
  return require('../server/kern/geldgraaf')({ kern, geldbeleid }).geldgraaf;
}
// een uitgaande wallet-betaling, n dagen geleden; de omschrijving is fictief (huisregel: geen echte merken)
const betaling = (centen, dagenGeleden, i) => ({
  id: 'PB-toets-' + i, van: REK, naar: 'extern:incasso', centen,
  soort: 'boeking', oms: 'Sportclub Arcadia', ref: null,
  at: Date.now() - dagenGeleden * 864e5
});

/* 2b-i. Drie betalingen met dezelfde omschrijving, ~30 dagen uit elkaar, de
   jongste 8 procent hoger: een maandelijks patroon, en de stijging staat als
   'post-duurder' op het command center. De vooruitblik rekent met het NIEUWE
   bedrag -- dat is de belofte uit de uitleg van de uitzondering zelf.

   MUTATIE GEZIEN ZAKKEN: in server/kern/geldgraaf/patronen.js `duurder:`
   vast op `false` gezet; zakte op "de prijsstijging hoort als uitzondering
   op het command center" (geen post-duurder gevonden). Teruggedraaid,
   daarna groen. */
test('patroonherkenning: drie maandelijkse betalingen met een hogere jongste geven een post-duurder', () => {
  const g = maakGraaf([betaling(2500, 60, 1), betaling(2500, 30, 2), betaling(2700, 0, 3)]);
  const c = g.cockpit('sleutel');
  const u = c.uitzonderingen.find(x => x.soort === 'post-duurder');
  assert.ok(u, 'de prijsstijging hoort als uitzondering op het command center, kreeg: ' + JSON.stringify(c.uitzonderingen));
  assert.equal(u.centen, 200, 'het verschil, rauw in centen (jongste min vorige)');
  assert.equal(u.niveau, 'kijken', 'de graaf wijst, hij handelt niet');
  assert.ok(u.gegevens.length >= 2 && u.gegevens.every(t => /^wallet: /.test(t)),
    'het controlespoor noemt zijn bron: ' + JSON.stringify(u.gegevens));
  /* De vooruitblik rekent vanaf nu met 2700, niet met 2500: op dertig dagen
     valt precies een beurt van de post. Het saldo van de stub is 50000. */
  assert.equal(c.vooruitblik.d30, 50000 - 2700, 'de vooruitblik rekent met het nieuwe bedrag');
});

/* 2b-iii. DE ANDERE KANT OP, en die ontbrak. De twee toetsen hierboven meten
   alleen dat een stijging WORDT gezien; ze zeggen niets over vals alarm. De
   keuring zette daarom `duurder: true` vast in patronen.js en zag alle negen
   toetsen groen blijven -- een vaste post die gelijk blijft of goedkoper wordt
   zou als 'post-duurder' op het command center komen zonder dat iets klaagde.
   Een commitbericht van mij beweerde dat dit was nagemeten; dat klopte, maar
   een meting zonder toets is weg zodra hij gedaan is (LAT.md regel 2).

   Hetzelfde geldt voor het RITME. Het hele herkenningsfilter op `if (false)`
   zetten (elke tussenpoos en elk bedrag telt als maandelijks) overleefde de
   suite ook. Beide gaten zitten hieronder.

   MUTATIES GEZIEN ZAKKEN: (a) `duurder: laatste.centen > vorige.centen` op
   `true` -- zakte op "een gelijk gebleven post is niet duurder geworden";
   (b) de hele voorwaarde in de lus op `if (false)` -- zakte op "een wekelijks
   ritme is geen maandelijkse vaste post". Allebei teruggedraaid, daarna
   groen. */
/* 2b-iv. DE GRENS VAN TWINTIG, echt gemeten. Hier stond eerst
   `c.tijdlijn.length <= 20` op een VERS lid, en dat lid heeft een lege
   tijdlijn: die bewering was altijd waar, ook met de slice eruit. Een toets
   die niet kan zakken belooft een grens die de opstelling niet meet (LAT.md
   regel 9). Nu met vijfentwintig echte boekingen erin.

   MUTATIE GEZIEN ZAKKEN: `.slice(0, 20)` uit server/kern/geldgraaf/index.js
   gehaald; zakte op "de tijdlijn houdt op bij twintig" (25 != 20).
   Teruggedraaid, daarna groen. */
test('de tijdlijn is echt begrensd op twintig, gemeten met vijfentwintig boekingen', () => {
  const veel = [];
  for (let i = 1; i <= 25; i++) veel.push(betaling(100 + i, i, i));
  const c = maakGraaf(veel).cockpit('sleutel');
  assert.equal(c.tijdlijn.length, 20, 'de tijdlijn houdt op bij twintig');
  /* en het zijn de NIEUWSTE twintig, niet zomaar twintig: de oudste boeking
     (25 dagen terug) hoort er niet meer bij te staan */
  assert.equal(c.tijdlijn.some(r => r.centen === 125), false,
    'de oudste boeking hoort buiten de twintig te vallen');
});

test('geen vals alarm: een gelijk gebleven of goedkopere vaste post is geen post-duurder', () => {
  const gelijk = maakGraaf([betaling(2500, 60, 1), betaling(2500, 30, 2), betaling(2500, 0, 3)]);
  assert.equal(gelijk.cockpit('sleutel').uitzonderingen.filter(x => x.soort === 'post-duurder').length, 0,
    'een gelijk gebleven post is niet duurder geworden');

  const omlaag = maakGraaf([betaling(3000, 60, 1), betaling(3000, 30, 2), betaling(2000, 0, 3)]);
  const u = omlaag.cockpit('sleutel').uitzonderingen.filter(x => x.soort === 'post-duurder');
  assert.equal(u.length, 0, 'een goedkoper geworden post is zeker geen post-duurder');
  /* wel nog steeds een herkend patroon: de vooruitblik hoort met het NIEUWE,
     lagere bedrag te rekenen -- anders spaart iemand voor lucht */
  assert.equal(omlaag.cockpit('sleutel').vooruitblik.d30, 50000 - 2000,
    'de vooruitblik volgt ook een daling');
});

test('het ritme beslist: een wekelijkse reeks en een factor-vijf-verschil zijn geen vaste post', () => {
  const wekelijks = maakGraaf([betaling(2000, 14, 1), betaling(2000, 7, 2), betaling(2000, 0, 3)]);
  assert.equal(wekelijks.cockpit('sleutel').vooruitblik.d30, 50000,
    'een wekelijks ritme is geen maandelijkse vaste post');

  /* Zelfde omschrijving, maar bedragen die veel te ver uit elkaar liggen: dat
     is geen vaste last maar toeval in de omschrijving. De grofheidscontrole
     (factor vier) hoort ze te scheiden. */
  const scheef = maakGraaf([betaling(1000, 30, 1), betaling(5100, 0, 2)]);
  assert.equal(scheef.cockpit('sleutel').vooruitblik.d30, 50000,
    'een factor vijf uit elkaar is geen reeks maar toeval in de omschrijving');

  /* En de tegenproef, zodat deze toets niet slaagt omdat er uberhaupt niets
     wordt herkend: factor drie hoort er WEL doorheen te komen. */
  const netaan = maakGraaf([betaling(10000, 30, 1), betaling(30000, 0, 2)]);
  assert.equal(netaan.cockpit('sleutel').vooruitblik.d30, 50000 - 30000,
    'binnen de grofheidscontrole blijft het gewoon een vaste post');
});

/* 2b-ii. Het bindende routecontract van fase 1: is het DERDE bedrag 20
   procent hoger, dan hoort er een 'post-duurder' te staan. Dit is precies
   het geval waarvoor de uitzondering bestaat (een vaste post die fors
   duurder wordt), dus deze toets is met opzet niet afgezwakt naar wat de
   huidige motor aankan.

   TOEN DEZE TOETS WERD GESCHREVEN ZAKTE HIJ, tegen de echte kern en zonder
   mutatie: er stond een tienprocentsmaat per stap in patronen.js, en die
   verwierp de hele reeks zodra de stijging boven de tien procent kwam --
   waardoor juist de forse prijsstijging onzichtbaar bleef. Dat 2b-i (8
   procent) wel slaagde, bewees dat het aan de maat lag en niet aan de
   meetopstelling. De maat is daarop vervangen door een grofheidscontrole op
   een factor vier, en sindsdien slaagt deze toets. Hij blijft staan als
   bewaker van die reparatie. */
test('routecontract: is het derde bedrag 20 procent hoger, dan staat er een post-duurder', () => {
  const g = maakGraaf([betaling(2500, 60, 1), betaling(2500, 30, 2), betaling(3000, 0, 3)]);
  const c = g.cockpit('sleutel');
  const u = c.uitzonderingen.find(x => x.soort === 'post-duurder');
  assert.ok(u, 'een stijging van 20 procent hoort juist gemeld te worden, kreeg: ' + JSON.stringify(c.uitzonderingen));
  assert.equal(u.centen, 500, 'het verschil, rauw in centen');
});

/* 2c. Een minimumbuffer-regel op niveau kijken: zakt de vrije ruimte onder
   de drempel, dan staat er een uitzondering met een controlespoor waarin de
   twee getallen staan waarmee is gerekend (beleid en graaf, rauw in centen).

   MUTATIE GEZIEN ZAKKEN: in server/kern/geldbeleid/evalueer.js de
   vergelijking `vrij < regel.drempelCenten` op `false` gezet; zakte op
   "precies een minimumbuffer-uitzondering" (0 != 1). Teruggedraaid, daarna
   groen. */
test('een minimumbuffer-regel (kijken) onder de drempel geeft een minimumbuffer-uitzondering met gegevens', async () => {
  const tok = await versLid();
  const laad = await api('/api/pay/oplaad', { centen: 100000, idem: 'gg-2c' }, tok);
  assert.equal(laad.status, 200, 'opladen hoort te lukken: ' + JSON.stringify(laad.body).slice(0, 160));
  const zet = await api('/api/geld/beleid/zet', { soort: 'minimumbuffer', drempelCenten: 250000, niveau: 'kijken' }, tok);
  assert.equal(zet.status, 200, 'de regel hoort gezet te worden: ' + JSON.stringify(zet.body).slice(0, 160));

  const c = (await api('/api/geld/cockpit', {}, tok)).body;
  /* Het uitgangspunt eerst als eigen bewering: 1000 euro geladen en niets
     geoormerkt, dus 100000 centen vrij. Zonder dit anker zou de rest van de
     toets twee kanten van dezelfde onbekende vergelijken (LAT.md regel 9). */
  assert.equal(c.cijfers.vrijCenten, 100000);
  const u = c.uitzonderingen.filter(x => x.soort === 'minimumbuffer');
  assert.equal(u.length, 1, 'precies een minimumbuffer-uitzondering, kreeg: ' + JSON.stringify(c.uitzonderingen));
  assert.equal(u[0].niveau, 'kijken');
  assert.equal(u[0].centen, 150000, 'het tekort tot de drempel, rauw in centen');
  assert.ok(u[0].gegevens.includes('beleid: minimumbuffer 250000 centen'),
    'het controlespoor noemt de regel: ' + JSON.stringify(u[0].gegevens));
  assert.ok(u[0].gegevens.includes('graaf: vrij besteedbaar 100000 centen'),
    'en het gemeten getal: ' + JSON.stringify(u[0].gegevens));
});

/* 2d. De gegronde Rahul zonder AI-sleutel: het terugvalpad REKENT met het
   graafbeeld en noemt de echte vrije ruimte in euro's. Een geldassistent
   die zonder sleutel een vaste demozin opzegt, is erger dan geen.

   MUTATIE GEZIEN ZAKKEN: in server/routes/geldrahul.js het rekenpad zijn
   invoer afgenomen (`const vrij = 0` in plaats van het graafcijfer); zakte
   op "het antwoord noemt de echte vrije ruimte" (er stond een euro-bedrag
   van nul in de tekst). Teruggedraaid, daarna groen. */
test('rahul zonder AI-sleutel rekent met de echte vrijCenten en noemt het euro-bedrag in de tekst', async () => {
  const tok = await versLid();
  const laad = await api('/api/pay/oplaad', { centen: 50000, idem: 'gg-2d' }, tok);
  assert.equal(laad.status, 200, 'opladen hoort te lukken: ' + JSON.stringify(laad.body).slice(0, 160));
  const c = (await api('/api/geld/cockpit', {}, tok)).body;
  assert.equal(c.cijfers.vrijCenten, 50000, 'het anker: 500 euro geladen en niets geoormerkt');

  const r = await api('/api/geld/rahul', { vraag: 'Kan ik deze maand nog 1000 euro uitgeven?' }, tok);
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  assert.equal(r.body.demo, true, 'zonder sleutel hoort het rekenpad te antwoorden, niet een model');

  /* De euro-omzetting hier nagerekend langs een EIGEN weg (centen uit de
     cockpit, zelf geformatteerd): het antwoord moet het bedrag noemen
     waarmee de graaf echt rekent, niet een bedrag uit dezelfde formatter
     dubbel geleend. */
  const vrij = c.cijfers.vrijCenten;
  const euro = '€ ' + Math.floor(vrij / 100) + ',' + String(vrij % 100).padStart(2, '0');
  assert.ok(r.body.antwoord.includes(euro),
    'het antwoord noemt de echte vrije ruimte (' + euro + '): ' + r.body.antwoord);
  assert.ok(r.body.gegevens.includes('graaf: vrij besteedbaar ' + vrij + ' centen'),
    'het controlespoor draagt hetzelfde getal in rauwe centen: ' + JSON.stringify(r.body.gegevens));
  /* De huisregel bewaakt zich ook in het terugvalpad: een uitgave van 1000
     euro past niet in 500, dus het antwoord raadt af en belooft niets. */
  assert.match(r.body.antwoord, /raad ik af/i, 'boven de vrije ruimte hoort het antwoord af te raden');
});
