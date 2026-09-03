/* ============================================================================
   DE ALARMWEG NAAR BUITEN, EN WAAROM HIJ ER NIET WAS.

   De eigen fout-aggregatie (server/log.js) draait altijd en staat op het
   techniekbord. Die dekt het groeperen en tonen. Wat hij NIET dekt is het geval
   dat ertoe doet: de doos ligt plat en niemand kijkt op het bord. Daarvoor is
   er externe bezorging via een webhook, in server/foutmelder.js, aan te zetten
   met ERR_WEBHOOK_URL.

   DE FOUT DIE HIER ACHTER ZAT was niet dat de code ontbrak -- die was er, en
   goed: SSRF-keuring op het doel, tempering per vingerafdruk, fire-and-forget.
   De fout was dat ALLE documentatie naar een andere variabele wees. De
   productie-keuring drong aan op SENTRY_DSN, PRODUCTION.md noemde hem drie keer,
   docker-compose gaf hem door, en op de go-live-lijst stond zelfs "SENTRY_DSN
   gezet en er komt een testfout binnen". Niets in deze codebase leest SENTRY_DSN:
   het pakket @sentry/node is er nooit gekomen (zero dependencies) en de eigen
   foutmelder heeft zijn plaats ingenomen. Ooit klopte die tekst, toen Sentry nog
   het plan was; niemand keek hem na toen de laag eronder veranderde.

   Gevolg: wie de checklist netjes afliep zette SENTRY_DSN, vinkte "er komt een
   testfout binnen" af, en ging live in de overtuiging dat er alarmering was.

   Wat deze toets vastlegt:
   1. de melder bestaat ALTIJD, ook zonder webhook, en zegt dan dat hij uit staat
      (een ontbrekend alarm hoort zichtbaar te zijn, niet afwezig);
   2. met een webhook komt er echt een POST aan, met stack en context;
   3. de zelfproef stuurt een herkenbaar bericht en WACHT op het antwoord --
      "gezet" is niet hetzelfde als "werkt";
   4. een webhook die weigert of niet bestaat wordt GETELD in plaats van
      weggeslikt, want anders doet een typefout precies hetzelfde als een
      werkend adres: niets zichtbaars;
   5. de tempering laat een fout-storm de ontvanger niet plat gooien.

   Draai los: node --test test/alarmweg.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { maakFoutmelder } = require('../server/foutmelder');

/* Een nep-ontvanger op localhost. `intern: true` want 127.0.0.1 wordt door de
   SSRF-keuring terecht geweigerd; in een toets is dat precies het adres dat we
   nodig hebben. */
function ontvanger(antwoord) {
  const binnen = [];
  const srv = http.createServer((req, res) => {
    let lijf = '';
    req.on('data', d => { lijf += d; });
    req.on('end', () => {
      try { binnen.push(JSON.parse(lijf)); } catch (e) { binnen.push({ onleesbaar: lijf }); }
      res.writeHead(antwoord || 200, { 'content-type': 'application/json' });
      res.end('{}');
    });
  });
  return new Promise(klaar => srv.listen(0, '127.0.0.1', () => {
    klaar({ binnen, url: 'http://127.0.0.1:' + srv.address().port + '/haak', stop: () => srv.close() });
  }));
}
const even = ms => new Promise(r => setTimeout(r, ms));

/* WACHTEN TOT DE TELLER BIJ IS, in plaats van 50 ms gokken.

   De bezorging wordt in een losse belofte geteld: het bericht is al binnen bij
   de ontvanger terwijl `m.stand()` nog nul zegt. Hier stond daarvoor
   `await even(50)`. Dat is dezelfde vorm als de lussen hieronder, alleen zonder
   uitweg: is de machine druk, dan meet de bewering een teller die nog moest
   worden bijgewerkt en zakt hij op iets dat niet stuk is.

   Dit hulpje kijkt gewoon opnieuw tot het getal er staat, met hetzelfde budget
   dat de lussen hier al gebruiken (60 x 50 ms). */
async function totStand(m, veld, waarde, rondes) {
  for (let i = 0; i < (rondes || 60); i++) {
    if (m.stand()[veld] >= waarde) return m.stand();
    await even(50);
  }
  return m.stand();
}

test('1. zonder webhook bestaat de melder wel, en zegt hij dat hij uit staat', async () => {
  const m = maakFoutmelder({ url: '' });
  assert.equal(m.actief, false);
  const s = m.stand();
  assert.equal(s.actief, false, 'de stand meldt het ook, zodat het bord het kan tonen');
  assert.equal(s.geprobeerd, 0);

  // melden mag, en doet niets -- het mag vooral niet gooien
  m.melden(new Error('iets'), { p: '/api/test' });
  assert.equal(m.stand().geprobeerd, 0, 'zonder adres wordt er niets geprobeerd');

  const p = await m.zelfproef('toets');
  assert.equal(p.ok, false);
  assert.match(p.reden, /ERR_WEBHOOK_URL/, 'en de zelfproef zegt WAT eraan ontbreekt: ' + p.reden);
});

test('2. met een webhook komt een echte storing aan, met stack en context', async () => {
  const o = await ontvanger();
  try {
    const m = maakFoutmelder({ url: o.url, intern: true });
    assert.equal(m.actief, true, 'de melder staat aan');
    m.melden(new Error('de kassa viel om'), { p: '/api/order', id: 'abc123' });
    for (let i = 0; i < 60 && !o.binnen.length; i++) await even(50);

    assert.equal(o.binnen.length, 1, 'er is precies een bericht bezorgd');
    const b = o.binnen[0];
    assert.equal(b.soort, 'fout', 'gemerkt als echte storing');
    assert.match(b.fout, /de kassa viel om/);
    assert.ok(b.stack && b.stack.includes('Error'), 'met een stack, anders is de melding niet te herleiden');
    assert.equal(b.context.p, '/api/order');
    assert.equal(b.context.id, 'abc123');
    assert.ok(b.tijd, 'en een tijdstip');

    const s = await totStand(m, 'bezorgd', 1);
    assert.equal(s.bezorgd, 1, 'en de bezorging is geteld: ' + JSON.stringify(s));
    assert.equal(s.mislukt, 0);
  } finally { o.stop(); }
});

/* DE BEWERING DIE HET GO-LIVE-VINKJE VERVANGT. "SENTRY_DSN gezet en er komt een
   testfout binnen" was niet af te vinken zonder met de hand een echte storing
   te maken, dus werd het afgevinkt op vertrouwen. Dit is de knop die het
   bewijst. */
test('3. de zelfproef stuurt een herkenbaar bericht en wacht op het antwoord', async () => {
  const o = await ontvanger();
  try {
    const m = maakFoutmelder({ url: o.url, intern: true });
    const r = await m.zelfproef('Iemand Achternaam');
    assert.equal(r.ok, true, 'de proef slaagt tegen een werkende ontvanger: ' + JSON.stringify(r));
    assert.equal(r.status, 200, 'en geeft de HTTP-status terug, niet alleen "gelukt"');

    assert.equal(o.binnen.length, 1);
    const b = o.binnen[0];
    assert.equal(b.soort, 'zelfproef', 'de ontvanger kan dit van een echte storing onderscheiden');
    assert.match(b.fout, /GEEN storing/, 'en de tekst zegt het er ook bij: ' + b.fout);
    assert.equal(b.context.door, 'Iemand Achternaam', 'met wie hem uitvoerde, voor het spoor');
  } finally { o.stop(); }
});

/* Hier zat de stilte. `req.on('error', () => {})` hoort er te staan -- een
   fout-melder mag de app nooit omgooien -- maar het gevolg was dat een webhook
   met een typefout PRECIES hetzelfde deed als een werkende. */
test('4. een weigerende ontvanger wordt geteld, niet weggeslikt', async () => {
  const o = await ontvanger(500);
  try {
    const m = maakFoutmelder({ url: o.url, intern: true });
    const r = await m.zelfproef('toets');
    assert.equal(r.ok, false, 'een 500 van de ontvanger is geen geslaagde proef');
    assert.match(String(r.reden), /500/, 'en zegt wat er terugkwam: ' + r.reden);
    const s = m.stand();
    assert.equal(s.mislukt, 1, 'de mislukking is geteld');
    assert.match(String(s.laatsteFout), /500/);
    assert.ok(s.laatsteFoutAt, 'met een tijdstip, zodat het bord kan tonen hoe lang dit al zo is');
  } finally { o.stop(); }
});

test('5. een adres dat niet bestaat wordt ook geteld', async () => {
  // poort 1 op localhost: niets luistert daar
  const m = maakFoutmelder({ url: 'http://127.0.0.1:1/haak', intern: true, timeout: 2000 });
  const r = await m.zelfproef('toets');
  assert.equal(r.ok, false);
  const s = m.stand();
  assert.equal(s.mislukt, 1, 'een onbereikbaar adres telt als mislukking: ' + JSON.stringify(s));
  assert.equal(s.bezorgd, 0);
});

test('6. een fout-storm gaat er niet ongetemperd doorheen', async () => {
  const o = await ontvanger();
  try {
    const m = maakFoutmelder({ url: o.url, intern: true });
    // dezelfde fout op hetzelfde pad: dat is een vingerafdruk
    for (let i = 0; i < 25; i++) m.melden(new Error('dezelfde storing'), { p: '/api/order' });
    for (let i = 0; i < 40 && !o.binnen.length; i++) await even(50);
    /* HIER BLIJFT EEN WACHT STAAN, en dat is een besluit. De bewering gaat over
       iets dat NIET gebeurt: van vijfentwintig meldingen mag er maar EEN de
       deur uit. Op een afwezigheid kun je niet wachten -- meteen tellen zou
       alleen zeggen "op dit moment nog een". De 200 ms zijn de ruimte waarin
       nummer twee zich zou moeten melden als de tempering stuk was. Zie
       KLOKWACHT.json; dit is de enige die in dit bestand overblijft. */
    await even(200);
    assert.equal(o.binnen.length, 1, 'vijfentwintig keer dezelfde storing wordt een bericht');

    // een ANDERE storing hoort er wel meteen doorheen te komen
    m.melden(new Error('een tweede, andere storing'), { p: '/api/order' });
    for (let i = 0; i < 40 && o.binnen.length < 2; i++) await even(50);
    assert.equal(o.binnen.length, 2, 'de tempering geldt per vingerafdruk, niet globaal');
  } finally { o.stop(); }
});

/* ============================================================================
   EN WAT DE KEURING ERVAN ZEGT -- want de vorige helft van dit bestand gaat over
   de melder, en dit over de BELOFTE eromheen.

   Sinds 3 september 2026 hangt het alarm van server/kern/command/alarm.js op
   dezelfde melder (TAKEN.md 7.12). Daarmee verandert wat een lege
   ERR_WEBHOOK_URL betekent: het gaat niet langer alleen over uitzonderingen maar
   over ELK alarm -- SLO, journaalketen, canary -- dat dan binnen het huis blijft.
   Die zin hoort in de waarschuwing te staan, want een beheerder die hem leest
   moet weten wat hij precies mist.

   De tweede is de gevaarlijkste en bestond nog niet: een url die er WEL staat
   maar door de SSRF-keuring wordt geweigerd. Dan gooit server/foutmelder.js hem
   bij het opstarten weg, staat er op het techniekbord "externe alarmering" en
   gaat er niets naar buiten. Dat is geen waarschuwing maar een fout: de belofte
   op het scherm klopt niet meer.
   ========================================================================== */
test('7. de productiekeuring zegt WAT je mist zonder webhook, en weigert een url die nooit werkt', () => {
  const { keur } = require('../server/config/productie');
  const doe = (env) => { const f = [], w = []; keur(Object.assign({ NODE_ENV: 'production' }, env), f, w); return { f, w }; };

  const leeg = doe({});
  const wLeeg = leeg.w.filter(x => /ERR_WEBHOOK_URL/.test(x));
  assert.equal(wLeeg.length, 1, 'precies EEN waarschuwing over de lege uitgang, niet twee op twee plekken');
  assert.match(wLeeg[0], /ALARM/, 'en hij zegt dat ook het alarm binnen blijft, niet alleen de uitzonderingen');

  const geweigerd = doe({ ERR_WEBHOOK_URL: 'http://127.0.0.1:9000/hook' });
  const fout = geweigerd.f.filter(x => /ERR_WEBHOOK_URL/.test(x));
  assert.equal(fout.length, 1, 'een geweigerde url is een FOUT en geen waarschuwing: ' + JSON.stringify(geweigerd.f.slice(0, 3)));
  assert.match(fout[0], /NIETS naar buiten/, 'met wat het gevolg is, niet alleen dat hij is afgekeurd');

  const goed = doe({ ERR_WEBHOOK_URL: 'https://hooks.slack.com/services/abc' });
  assert.equal(goed.f.filter(x => /ERR_WEBHOOK_URL/.test(x)).length, 0, 'een geldige url geeft geen fout');
  assert.equal(goed.w.filter(x => /ERR_WEBHOOK_URL/.test(x)).length, 0, 'en ook geen waarschuwing');
});
