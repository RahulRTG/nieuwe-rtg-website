/* ============================================================================
   DE LEDENPOORT: LOOPT DE AFSPRAAK NOG? -- en hij houdt met opzet niemand tegen.

   WAT HIER BEWEZEN MOET WORDEN, en het is niet "hij blokkeert". Het omgekeerde:
   deze regels lopen in de SCHADUW, dus de beweringen gaan over tellen zonder
   gevolgen. De gevaarlijke faalvormen zijn daarom andere dan bij een gewone poort:

     1. hij zou iemand tegenhouden        -- dan is het geen schaduw
     2. hij telt een gratis lid mee       -- dan verdunt het deel met mensen over
                                             wie de regel nooit gaat
     3. GEEN_CONTRACT en GEEINDIGD lopen door elkaar -- dan is het getal weg, want
                                             "ik weet het niet" leest als "er is
                                             niets afgesproken"
     4. een lopende afspraak telt NIET mee -- dan is 12 afgelopen contracten een
                                             getal zonder noemer

   Die derde is de hele reden dat dit bestand bestaat. Zie de kop van
   server/kern/commercie/lidpoort.js.

   Draai los: node --test test/lidpoort.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const poort = require('../server/kern/commercie/lidpoort');
const { maakSchaduw } = require('../server/kern/commercie/schaduw');
const { startServer, stop, kantoorAlsPersoon } = require('./helper');

const C = (status, extra) => Object.assign({ id: 'c-' + status, status }, extra || {});

/* Een schaduwlaag op een kale db, zodat de tellers echt bewegen en niet nagedaan
   worden. `save` is een teller: een weging die NIETS bewaart is geen meting. */
function schaduwOpzet() {
  let saves = 0;
  const db = { data: {} };
  const s = maakSchaduw({ db, save: () => { saves += 1; } });
  for (const r of poort.REGELS) s.meld(r.id, 'SCHADUW');
  return { s, saves: () => saves };
}

test('1. de vier standen, en GEEN_CONTRACT is geen GEEINDIGD', () => {
  assert.equal(poort.beoordeel('guest', null).stand, poort.STAND.NIET_BETALEND);
  assert.equal(poort.beoordeel('rtg', C('ACTIEF')).stand, poort.STAND.LOOPT);
  assert.equal(poort.beoordeel('rtg', C('OPZEGGEND')).stand, poort.STAND.LOOPT,
    'opgezegd maar nog niet voorbij is LOPEND -- het lid betaalt nog');
  assert.equal(poort.beoordeel('rtg', C('GEEINDIGD')).stand, poort.STAND.GEEINDIGD);
  assert.equal(poort.beoordeel('rtg', null).stand, poort.STAND.GEEN_CONTRACT);

  /* DE KERN VAN HET ONTWERP: twee verschillende regels, want ze vragen een ander
     besluit. Vallen ze ooit samen, dan krijgt een mens die "afgelopen contract"
     aanzet het buitensluiten van elk bestaand lid er stilzwijgend bij. */
  const a = poort.beoordeel('rtg', C('GEEINDIGD')).regel;
  const b = poort.beoordeel('rtg', null).regel;
  assert.ok(a && b, 'beide dragen een regel');
  assert.notEqual(a, b, 'en het is NIET dezelfde regel');
});

test('2. een onbekende pas valt op de instappas terug, en dat besluit staat elders', () => {
  /* `pasVan` in kern/passen.js beslist wat een onbekende tier betekent. Deze toets
     houdt vast dat lidpoort die vraag niet een tweede keer beantwoordt: een
     onzin-tier hoort als BETALEND te gelden (terugval 'rtg') en dus een oordeel te
     krijgen, niet stil als gratis weg te vallen. */
  const r = poort.beoordeel('onzin-tier-die-niet-bestaat', null);
  assert.equal(r.pas, 'rtg');
  assert.equal(r.stand, poort.STAND.GEEN_CONTRACT);
});

test('3. in de schaduw gaat IEDEREEN door -- ook wie een bezwaar oplevert', () => {
  const { s } = schaduwOpzet();
  for (const geval of [C('GEEINDIGD'), null]) {
    const o = poort.beoordeel('rtg', geval);
    assert.ok(o.bezwaar, 'er is wel degelijk een bezwaar');
    const w = poort.weeg(s, o, 'user-1');
    assert.equal(w.door, true, 'en toch gaat hij door -- anders is het geen schaduw');
    assert.equal(w.gewogen, true);
  }
});

test('4. een gratis lid wordt NIET geteld', () => {
  const { s, saves } = schaduwOpzet();
  const voor = poort.REGELS.map(r => s.stand(r.id).waarnemingen);
  const saveVoor = saves();
  const w = poort.weeg(s, poort.beoordeel('guest', null), 'user-gast');
  assert.equal(w.gewogen, false, 'een gratis lid wordt niet gewogen');
  assert.deepEqual(poort.REGELS.map(r => s.stand(r.id).waarnemingen), voor,
    'en geen enkele teller bewoog -- anders verdunt hij het deel');
  assert.equal(saves(), saveVoor, 'en er is niets bewaard');
});

test('5. een LOPENDE afspraak telt mee als waarneming zonder bezwaar', () => {
  const { s } = schaduwOpzet();
  const id = poort.REGELS.find(r => r.stand === poort.STAND.GEEINDIGD).id;
  poort.weeg(s, poort.beoordeel('rtg', C('ACTIEF')), 'user-2');
  const na = s.stand(id);
  assert.equal(na.waarnemingen, 1, 'hij is geteld');
  assert.equal(na.zouTegenhouden, 0, 'maar zonder bezwaar -- hij is de noemer');
  assert.equal(na.deel, 0, 'en het deel is dus nul en niet onbepaald');
});

test('6. een afgelopen afspraak landt op de geeindigd-regel en nergens anders', () => {
  const { s } = schaduwOpzet();
  const geeindigd = poort.REGELS.find(r => r.stand === poort.STAND.GEEINDIGD).id;
  const ontbreekt = poort.REGELS.find(r => r.stand === poort.STAND.GEEN_CONTRACT).id;
  poort.weeg(s, poort.beoordeel('rtg', C('GEEINDIGD', { eindigtOp: '2026-08-01' })), 'user-3');
  assert.equal(s.stand(geeindigd).zouTegenhouden, 1);
  assert.equal(s.stand(ontbreekt).waarnemingen, 0,
    'de ontbreekt-regel heeft hier niets gezien -- de standen sluiten elkaar uit');
  assert.match(s.stand(geeindigd).voorbeelden[0].reden, /GEEINDIGD/,
    'en het voorbeeld zegt waarom, niet alleen dat');
});

test('7. geen van de twee regels is vrijgesteld, en geen van de twee is rijp', () => {
  const { s } = schaduwOpzet();
  for (const r of poort.REGELS) {
    const st = s.stand(r.id);
    assert.equal(st.modus, 'SCHADUW', r.id + ' staat in de schaduw');
    assert.equal(st.vrijstelling, null,
      r.id + ' is niet vrijgesteld -- hij pakt een lid aantoonbaar zijn pas af');
    assert.equal(st.rijp.ok, false, r.id + ' is op dag 1 niet rijp');
    /* AFDWINGEN MOET WEIGEREN, en dit is de grendel die het hele ontwerp draagt:
       je kunt niet afdwingen wat nooit heeft meegelopen. */
    assert.equal(s.zetModus(r.id, 'AFDWINGEN', 'toets').status, 409);
  }
});

test('8. twee lagen op dezelfde kop gooien elkaar niet weg', () => {
  /* DE FOUT DIE HIER ECHT IS GEMAAKT, op 11 september 2026. `RTG-Niet-Afgedwongen`
     wordt nu door twee lagen gezet (het bezitsbewijs en de contractstand), en de
     eerste poging gebruikte `res.append` -- die in server/web/verrijk.js NIET
     bestond. Dat is een eigen Express-achtige schil en geen Express: `set` zit erin,
     `append` zat er niet. Binnen de `try/catch` van auth() (die er staat omdat een
     storing in de bewijslaag geen overtreding mag worden) verdween die TypeError
     volledig en bleef de kop gewoon leeg -- de regel liep, de meting liep, en het
     antwoord zei er niets over.

     DEZE TOETS DRAAIT OP DE ECHTE SCHIL en niet op een nabouwsel ervan. Een kopie
     van `append` in deze toets zou de eigen kopie meten en groen blijven staan
     terwijl verrijk.js hem kwijt is -- dat is dezelfde fout als de cap `rooms` uit
     CLAUDE.md, waar een toets met verzonnen invoer een dode tak groen hield. */
  const { verrijk } = require('../server/web/verrijk');
  const koppen = {};
  const req = { url: '/api/iets', headers: {}, socket: {}, method: 'POST' };
  const res = { statusCode: 200,
    setHeader: (k, v) => { koppen[k] = v; },
    getHeader: (k) => koppen[k] };
  verrijk(req, res, {});
  assert.equal(typeof res.append, 'function',
    'de schil kent `append` -- zonder die regel verdwijnt de kop stil');

  res.append('RTG-Niet-Afgedwongen', 'bezitsbewijs');
  res.append('RTG-Niet-Afgedwongen', 'lidcontract.ontbreekt');
  assert.deepEqual(res.getHeader('RTG-Niet-Afgedwongen'),
    ['bezitsbewijs', 'lidcontract.ontbreekt'],
    'beide blijven staan; met `set` had de tweede de eerste weggegooid');

  /* En de eerste keer gedraagt hij zich als `set` en niet als een lijst van een:
     een kop die altijd een array wordt, verandert de vorm voor elke bestaande
     aanroeper. */
  res.append('RTG-Eenmalig', 'alleen-deze');
  assert.equal(res.getHeader('RTG-Eenmalig'), 'alleen-deze');
});

/* ---- en dan over de ECHTE server, want bovenstaande kan niet bewijzen dat
        auth() hem aanroept en dat hij daar niemand tegenhoudt ---- */

let srv, base;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-lidpoort-'));

async function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})), kop: r.headers };
}

test.before(async () => { srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } }); base = srv.base; });
test.after(() => stop(srv));

test('9. een betalend lid ZONDER contract komt gewoon binnen, en wordt geteld', async () => {
  const u = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const reg = (await api('/api/auth/register', { name: 'Poort ' + u, email: u + '@x.nl',
    phone: '06' + u.replace(/\D/g, '').padEnd(8, '1').slice(0, 8),
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })).body;
  assert.ok(reg.token, 'het lid bestaat');

  /* Dit lid heeft een betalende pas en geen enkele aanmelding -- precies het geval
     dat vandaag de meerderheid is, en precies waarom `GEEN_CONTRACT` geen bezwaar
     tegen het LID is. Hij hoort door te komen. */
  const r = await api('/api/mijn/abonnement', {}, reg.token);
  assert.equal(r.status, 200, 'hij komt binnen: ' + JSON.stringify(r.body).slice(0, 160));

  /* EN DE REGEL ZEGT DAT HIJ NIET AFDWINGT. Een regel die niets doet en dat niet
     meldt, is over een half jaar een regel waarvan niemand weet of hij aanstaat. */
  const kop = r.kop.get('rtg-niet-afgedwongen') || '';
  assert.match(kop, /lidcontract\.ontbreekt/,
    'de kop noemt de regel die niet afdwong, en staat op: ' + JSON.stringify(kop));

  /* EN HET KANTOOR KAN HET GETAL ZIEN -- anders is er gemeten zonder lezer.

     GEEN `if (status === 200)` EROM. Die stond hier eerst, met het verkeerde pad
     erbij (`/api/office/commercie/schaduw`; het is `/api/office/handhaving`), en
     dan slaat zo'n blok stilzwijgend over en staat de toets groen zonder ooit iets
     te hebben nagekeken. Dat is precies LAT regel 9: een toets die je niet hebt
     zien zakken is geen toets. */
  const office = await kantoorAlsPersoon(base, api);
  const bord = await api('/api/office/handhaving', {}, office);
  assert.equal(bord.status, 200, 'het handhavingsbord antwoordt: ' + JSON.stringify(bord.body).slice(0, 160));
  const regels = (bord.body.regels || []).filter(x => String(x.id).startsWith('lidcontract.'));
  assert.equal(regels.length, 2, 'beide regels staan op het bord');
  const o = regels.find(x => x.id === 'lidcontract.ontbreekt');
  assert.ok(o.waarnemingen >= 1, 'en de ontbreekt-regel heeft dit lid gezien');
  assert.ok(o.zouTegenhouden >= 1, 'en hij zou hem hebben tegengehouden');
  assert.equal(o.modus, 'SCHADUW', 'en hij staat nog in de schaduw');
  assert.equal(o.rijp.ok, false, 'en hij is niet rijp om af te dwingen');
});

test('10. een lid MET een lopende afspraak levert geen bezwaar op', async () => {
  const office = await kantoorAlsPersoon(base, api);
  const u = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const reg = (await api('/api/auth/register', { name: 'Loopt ' + u, email: u + '@x.nl',
    phone: '06' + u.replace(/\D/g, '').padEnd(8, '1').slice(0, 8),
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })).body;
  const aanvraag = (await api('/api/aanmelding/aanvraag',
    { pas: 'rtg', naam: 'Loopt ' + u, contact: u + '@x.nl' }, reg.token)).body;
  const id = aanvraag.aanmelding && aanvraag.aanmelding.id;
  assert.ok(id, 'de aanvraag staat er');
  assert.equal((await api('/api/aanmelding/beslis', { id, besluit: 'geaccepteerd' }, office)).status, 200);

  const voor = await telling(office, 'lidcontract.geeindigd');
  const r = await api('/api/mijn/abonnement', {}, reg.token);
  assert.equal(r.status, 200);
  const kop = r.kop.get('rtg-niet-afgedwongen') || '';
  assert.ok(!/lidcontract/.test(kop),
    'geen enkele lidcontract-regel had een bezwaar, dus de kop noemt er geen: ' + JSON.stringify(kop));

  /* EN DIT IS DE HELFT DIE DE TOETS ECHT MAAKT. Bovenstaande bewering is WAAR als
     de hele laag stuk is: een kop die er niet staat bewijst niets. Dus wordt er
     hier geteld dat dit lid wel degelijk GEWOGEN is -- als waarneming zonder
     bezwaar op de geeindigd-regel, de noemer waar die regel zijn deel aan meet.
     Zonder noemer is "twaalf afgelopen contracten" een getal zonder schaal. */
  const na = await telling(office, 'lidcontract.geeindigd');
  assert.equal(na.waarnemingen, voor.waarnemingen + 1, 'hij is geteld');
  assert.equal(na.zouTegenhouden, voor.zouTegenhouden, 'en zonder bezwaar');
});

/* De stand van een regel van het kantoorbord. Een eigen functie omdat twee toetsen
   hem nodig hebben en een kopie een dag later iets anders vraagt. */
async function telling(office, id) {
  const bord = await api('/api/office/handhaving', {}, office);
  assert.equal(bord.status, 200, 'het handhavingsbord antwoordt');
  const r = (bord.body.regels || []).find(x => x.id === id);
  assert.ok(r, 'de regel ' + id + ' staat op het bord');
  return r;
}
