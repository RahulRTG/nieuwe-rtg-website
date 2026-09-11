/* RUGDEKKING OVER HTTP -- staat RTG achter een mens, of koopt het iets van hem?

   Dit is de vork uit RUGDEKKING.md par. 2.4, en de reden dat hij een toets
   verdient in plaats van een alinea: *een programma dat beide wil zijn, is de
   constructie waar de firewall en de giftgrendel allebei op gebouwd zijn.*
   Zolang die vork alleen in een document staat, is hij een voornemen.

   WAT DEZE SUITE VASTLEGT, en waarom elk stuk nodig is:

   1. EEN BEURS MET EEN TEGENPRESTATIE BESTAAT NIET. Staat er iets tegenover,
      dan is het sponsoring: ander fiscaal regime, een factuur. Dezelfde regel
      als kern/rtfos/herkomst.js grendel 2, hier aan de kant waar het geld
      VERTREKT.
   2. EN EEN COMMERCIEEL PROGRAMMA ZONDER TEGENPRESTATIE IS GEEN KOOP. De
      omgekeerde fout, en even hard: wie niets koopt en toch betaalt, doet aan
      liefdadigheid met een factuur eroverheen.
   3. RUGDEKKING KOOPT GEEN STEM. De lijst tegenprestaties is GESLOTEN, zodat
      "wat vind jij van ons" er niet onder een vriendelijke naam bij komt.
   4. EEN MINDERJARIGE IS GEEN MERK. Grens 1: geen zichtbaarheidsverplichting
      voor wie de achttien nog niet heeft -- en dus geen commercieel programma,
      want dat VRAAGT per definitie een tegenprestatie. Een beurs kan wel.
      De leeftijd komt uit het jeugdbestuur en niet uit een eigen lezing.
   5. DE SCHAKELAAR VAN DE BEURS IS DE JURIDISCHE POSITIE. Hij staat standaard
      DICHT, een programma kan hem niet omzetten, en hij gaat op NAAM om -- de
      gedeelde kantoorcode is geen naam.
   6. EEN DUBBELKLIK VERDUBBELT GEEN BELOFTE. Toets 14, en hij staat er omdat de
      meetronde hem VOND: twee identieke aanroepen lieten twee lopende
      programma's achter. Bij een agenda is dat rommel, bij geld het dubbele
      bedrag.
   7. EN HET OORDEEL KOMT VAN kern/bevoegdheid. Dat zijn toets 11 en 12: de
      schakelaar is de BRON, maar wie mag uitbetalen zegt het bevoegdhedenbord,
      en dat weegt er de rail bij. Toets 12 bewijst de koppeling door de knop
      open te LATEN staan en alleen de sepa-rail uit te zetten -- reken deze
      laag zijn eigen knop na, en die toets zakt. Twee lagen die hetzelfde zelf
      narekenen, zeggen op een dag iets anders.

   Draai los: node --test test/rugdekking.e2e.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, kantoorAlsPersoon, keurLidGoed } = require('./helper');

let BASE, child, sporter, jong, office, sporterCode, jongCode;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rugdek-'));
const jaarGeleden = (n) => {
  const d = new Date(); d.setFullYear(d.getFullYear() - n); return d.toISOString().slice(0, 10);
};
const GEB_JONG = jaarGeleden(16);
const TOT = new Date(Date.now() + 200 * 86400000).toISOString();

const post = (pad, body, tok) => fetch(BASE + pad, { method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
  body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

const codeVan = async (tok) => (await post('/api/state', {}, tok)).body.state.user.codename;
const stel = (lijf) => post('/api/office/rugdekking/stel', lijf, office);

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  sporter = (await post('/api/auth/register', { name: 'Sporter Een', email: 'rug1@x.nl',
    phone: '0612348001', password: 'geheim12345', geboortedatum: '1998-04-04', tier: 'rtg' })).body.token;
  jong = (await post('/api/auth/register', { name: 'Talent Zestien', email: 'rug2@x.nl',
    phone: '0612348002', password: 'geheim12345', geboortedatum: GEB_JONG, tier: 'rtg' })).body.token;
  sporterCode = await codeVan(sporter);
  jongCode = await codeVan(jong);
  await keurLidGoed(BASE, sporter, sporterCode, '1998-04-04');
  await keurLidGoed(BASE, jong, jongCode, GEB_JONG);
  office = await kantoorAlsPersoon(BASE, 'RTG-OFFICE');
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. de lijst noemt de twee soorten en wat NOOIT een tegenprestatie is', async () => {
  const r = await post('/api/rugdekking/lijst', {}, sporter);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
  assert.deepEqual(Object.keys(r.body.soorten).sort(), ['beurs', 'commercieel']);
  assert.equal(r.body.beurs, 'gesloten', 'en de schakelaar staat standaard DICHT');
  const nooit = r.body.nooit.map(x => x.wat).join(' | ');
  assert.match(nooit, /mening/i, 'wie de lijst opent, ziet waar de grens ligt voordat hij hem probeert te halen');
});

test('2. een beurs MET een tegenprestatie bestaat niet: dan is het sponsoring', async () => {
  const r = await stel({ mens: sporterCode, soort: 'beurs', tegenprestaties: ['vermelding'],
    bedragCenten: 500000, tot: TOT });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /sponsoring/);
});

test('3. en een commercieel programma ZONDER tegenprestatie is geen koop', async () => {
  const r = await stel({ mens: sporterCode, soort: 'commercieel', tegenprestaties: [],
    bedragCenten: 500000, tot: TOT });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /geen koop|gift/);
});

test('4. rugdekking koopt geen stem: de lijst tegenprestaties is gesloten', async () => {
  const r = await stel({ mens: sporterCode, soort: 'commercieel', tegenprestaties: ['mening'],
    bedragCenten: 500000, tot: TOT });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /gesloten/);
});

test('5. zonder bedrag of zonder einddatum is het een belofte en geen afspraak', async () => {
  const zonderBedrag = await stel({ mens: sporterCode, soort: 'commercieel',
    tegenprestaties: ['vermelding'], tot: TOT });
  assert.equal(zonderBedrag.status, 400);
  assert.match(zonderBedrag.body.error, /bedrag/);

  const zonderEind = await stel({ mens: sporterCode, soort: 'commercieel',
    tegenprestaties: ['vermelding'], bedragCenten: 500000 });
  assert.equal(zonderEind.status, 400);
  assert.match(zonderEind.body.error, /einddatum/);
});

test('6. een goed commercieel programma gaat erdoor, en het antwoord zegt dat het een KOOP is', async () => {
  const r = await stel({ mens: sporterCode, soort: 'commercieel',
    tegenprestaties: ['vermelding', 'aanwezigheid'], bedragCenten: 500000, tot: TOT });
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 250));
  assert.equal(r.body.programma.factuurNodig, true);
  assert.equal(r.body.programma.wereld, 'commercieel', 'en hij landt in de commerciele wereld');
  assert.match(r.body.let, /KOOP|factureert/);
});

test('7. de sporter ziet zelf wie er achter hem staat en waarvoor', async () => {
  const r = await post('/api/rugdekking/mijn', {}, sporter);
  assert.equal(r.status, 200);
  assert.equal(r.body.programmas.length, 1);
  assert.deepEqual(r.body.programmas[0].tegenprestaties, ['aanwezigheid', 'vermelding']);
  assert.ok(Array.isArray(r.body.nooit) && r.body.nooit.length,
    'en hij leest erbij wat RTG nooit van hem mag vragen');
});

test('8. EEN MINDERJARIGE IS GEEN MERK: commercieel gaat niet, en de reden noemt de beurs', async () => {
  const r = await stel({ mens: jongCode, soort: 'commercieel', tegenprestaties: ['vermelding'],
    bedragCenten: 100000, tot: TOT });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /minderjarig/);
  assert.match(r.body.error, /beurs/, 'een weigering zegt altijd hoe het wel kan');
});

test('9. DE SCHAKELAAR IS DE JURIDISCHE POSITIE: dicht, en een programma zet hem niet om', async () => {
  const r = await stel({ mens: jongCode, soort: 'beurs', tegenprestaties: [],
    bedragCenten: 100000, tot: TOT });
  assert.equal(r.status, 409);
  assert.match(r.body.error, /levering|uitbetaal|niet open/i);
  assert.match(r.body.error, /Commerciele rugdekking kan wel/,
    'ook hier zegt de weigering hoe het wel kan');
});

test('10. en hij gaat op NAAM om: zonder kantoorsessie komt er niemand bij', async () => {
  const kaal = await fetch(BASE + '/api/office/rugdekking/beurs', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stand: 'open' }) });
  assert.ok(kaal.status === 401 || kaal.status === 403);
});

test('11. HET OORDEEL KOMT VAN kern/bevoegdheid, niet van de schakelaar alleen', async () => {
  const om = await post('/api/office/rugdekking/beurs', { stand: 'open' }, office);
  assert.equal(om.status, 200, JSON.stringify(om.body).slice(0, 200));
  assert.match(om.body.let, /positie/, 'het antwoord zegt dat dit een positie is en geen instelling');

  /* MET DE KNOP OPEN KAN HET -- want de sepa-partnerrail draait, en dan is er
     een partij die kan uitbetalen. De knop bepaalt de POSITIE, de rail bepaalt
     of hij vandaag uitvoerbaar is; dat zijn twee vragen en het bord weegt ze
     allebei. */
  const r = await stel({ mens: jongCode, soort: 'beurs', tegenprestaties: [],
    bedragCenten: 100000, tot: TOT });
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 250));
  assert.equal(r.body.programma.wereld, 'rtfoundation');
  assert.equal(r.body.programma.factuurNodig, false, 'een beurs kent geen factuur');
});

test('12. EN DE RAIL WEEGT MEE: zonder sepa kan de beurs niet, ook met de knop open', async () => {
  /* DIT IS DE TOETS DIE BEWIJST DAT DE TWEE LAGEN ECHT GEKOPPELD ZIJN. Zou
     kern/rugdekking zijn eigen schakelaar narekenen, dan stond hier een beurs
     vastgelegd die niemand kan uitbetalen -- en zou deze toets 200 geven
     terwijl de knop nog open staat. De schakelaar verandert in deze toets NIET;
     alleen de rail gaat uit. */
  const uit = await post('/api/office/bank/partnerrail', { rail: 'sepa', aan: false }, office);
  assert.equal(uit.status, 200, JSON.stringify(uit.body).slice(0, 200));

  const r = await stel({ mens: jongCode, soort: 'beurs', tegenprestaties: [],
    bedragCenten: 100000, tot: TOT });
  assert.equal(r.status, 409, JSON.stringify(r.body).slice(0, 250));
  assert.doesNotMatch(r.body.error, /buiten een levering om/,
    'de reden komt van het bevoegdhedenbord (de rail) en niet meer van de knop');
  assert.match(r.body.error, /niet kan nakomen/);

  const beeld = await post('/api/rugdekking/lijst', {}, sporter);
  assert.equal(beeld.body.beurs, 'open', 'en de knop staat nog steeds gewoon open');

  await post('/api/office/bank/partnerrail', { rail: 'sepa', aan: true }, office);
});

test('13. twee soorten tegelijk bij dezelfde mens is de constructie zelf', async () => {
  /* De sporter heeft een lopend COMMERCIEEL programma (toets 6). Een beurs
     ernaast maakt van buiten onzichtbaar welk geld waarvoor was -- dat is par.
     2.4 over twee regels verdeeld. De knop staat hier open en de rail draait,
     dus dit is echt de soortvergelijking en niet het bord. */
  const r = await stel({ mens: sporterCode, soort: 'beurs', tegenprestaties: [],
    bedragCenten: 100000, tot: TOT });
  assert.equal(r.status, 409, JSON.stringify(r.body).slice(0, 250));
  assert.match(r.body.error, /andere soort|onzichtbaar/);
});

test('14. EEN DUBBELKLIK VERDUBBELT NIET WAT RTG HEEFT BELOOFD', async () => {
  /* Dit stond er niet en het ging mis: de meetronde van 11 september 2026 liet
     twee identieke aanroepen TWEE lopende programma's achterlaten (0 -> 1 -> 2).
     Bij een agenda is dat rommel, bij geld is het het dubbele bedrag. */
  const lijf = { mens: sporterCode, soort: 'commercieel', tegenprestaties: ['beeld'],
    bedragCenten: 250000, tot: TOT };
  const een = await stel(lijf);
  assert.equal(een.status, 200, JSON.stringify(een.body).slice(0, 250));
  const twee = await stel(lijf);
  assert.equal(twee.status, 409, JSON.stringify(twee.body).slice(0, 250));
  assert.match(twee.body.error, /verdubbelt/);

  /* EN EEN AFWIJKEND PROGRAMMA IS WEL EEN TWEEDE BESLUIT. Dat is het verschil
     tussen een toestandscontrole en een slot: wie iets anders afspreekt, wordt
     niet tegengehouden. */
  const anders = await stel(Object.assign({}, lijf, { bedragCenten: 250001 }));
  assert.equal(anders.status, 200, JSON.stringify(anders.body).slice(0, 250));
});

test('15. een programma stoppen kan, en het antwoord noemt de toetsvraag van het hele programma', async () => {
  const mijn = await post('/api/office/rugdekking/alle', {}, office);
  const id = mijn.body.programmas.find(p => !p.gestopt).id;
  const r = await post('/api/office/rugdekking/stop', { id, reden: 'seizoen voorbij' }, office);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
  assert.match(r.body.let, /zelf heeft opgebouwd/);

  const weer = await post('/api/office/rugdekking/stop', { id, reden: 'nog een keer' }, office);
  assert.equal(weer.status, 409, 'en een tweede keer stoppen is een toestandscontrole');
});
