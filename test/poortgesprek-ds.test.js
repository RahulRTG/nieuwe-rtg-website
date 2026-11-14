'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs');
const { fixture, tick, start, bron } = require('./lib/poortgesprek-fixture');

test('DS-keuze gebeurt bij openen: native dialoog, namen, focus en geen legacy CSS', async () => {
  const f = fixture({ ds: false }); f.ds(true);
  const { result } = await start(f), kaart = f.node('.rp-kaart'), input = f.node('.rp-in');
  assert.equal(kaart.tagName, 'DIALOG'); assert.equal(kaart.open, true); assert.equal(kaart.modalCalls, 1);
  assert.equal(f.styles().length, 0); assert.ok(kaart.classList.contains('ds-poortgesprek'));
  assert.equal(input.getAttribute('aria-labelledby'), f.node('.rp-vraag').id);
  assert.equal(kaart.getAttribute('aria-labelledby'), f.node('h2').id);
  assert.equal(f.document.activeElement, input); assert.ok(input.classList.contains('ds-invoer'));
  assert.equal(kaart.fire('cancel').defaultPrevented, true);
  assert.equal(await result, false); assert.equal(kaart.open, false);
  assert.equal(f.node('.rp-waas').hidden, true); assert.equal(f.document.activeElement, f.trigger);
});

test('legacy-host gebruikt de canonieke DS-root; Escape/backdrop en latere DS-opening behouden eigenaar', async () => {
  const f = fixture({ ds: false }); let r = await start(f);
  assert.equal(f.node('.rp-kaart').tagName, 'DIV'); assert.equal(f.styles().length, 0);
  assert.equal(f.links().length, 1); assert.equal(f.links()[0].href, '/ds/rtg-ds.css');
  assert.equal(f.links()[0].getAttribute('id'), 'rtgDsRuntimeCss');
  assert.ok(f.node('.rp-waas').classList.contains('ds-poortgesprek-waas--overlay'));
  assert.ok(f.node('.rp-kaart').classList.contains('ds-poortgesprek'));
  assert.ok(f.node('.rp-door').classList.contains('ds-knop'));
  f.key('Escape'); assert.equal(await r.result, false);
  r = await start(f); assert.equal(f.links().length, 1);
  f.node('.rp-waas').click(); assert.equal(await r.result, false);
  f.ds(true); r = await start(f); assert.equal(f.links().length, 1, 'gedeelde DS-root blijft voor andere runtimecomponenten');
  assert.equal(f.node('.rp-kaart').tagName, 'DIALOG');
  f.node('.rp-kaart').fire('click', { clientX: 101, clientY: 101 });
  assert.equal(f.node('.rp-kaart').open, true, 'kaartpadding is geen buitenklik');
  f.node('.rp-kaart').fire('click', { clientX: 1, clientY: 1 }); assert.equal(await r.result, false);
});

for (const antwoord of ['vraag', 'klaar', 'fout']) test('vervangende start negeert laat A-antwoord: ' + antwoord, async () => {
  const f = fixture(); let retries = 0;
  const a = f.api.vang({ soort: 'reservering', ontbreekt: ['telefoon'], error: 'gestopt' }, 428, () => { retries++; }, f.call)
    .then(() => 'hervat', e => e.message); await tick(); const oud = f.requests[0];
  const b = await start(f, 'telefoon', 'B'); assert.equal(await a, 'gestopt');
  const kaart = f.node('.rp-kaart'); await tick();
  assert.equal(kaart.open, true, 'uitgesteld native close-event van A sluit B niet');
  if (antwoord === 'fout') oud.reject(new Error('oude fout'));
  else oud.resolve(antwoord === 'klaar' ? { klaar: true } : { id: 'OUD', veld: 'adres', tekst: 'Oude vraag' });
  await tick(); assert.equal(f.node('.rp-vraag').textContent, 'Vraag B'); assert.equal(retries, 0);
  f.node('.rp-in').value = '0612345678'; f.node('.rp-door').click(); await tick();
  assert.equal(f.requests.at(-1).body.id, 'B');
  f.node('.rp-stop').click(); assert.equal(await b.result, false);
});

test('dubbeltik/Enter/Waarom is single-flight; dezelfde telefooninvoer blijft bij uitleg en fout', async () => {
  const f = fixture(); const { result } = await start(f);
  f.node('.rp-in').value = '12'; f.node('.rp-waarom').click();
  f.node('.rp-in').fire('keydown', { key: 'Enter' }); f.node('.rp-door').click(); await tick();
  assert.equal(f.requests.length, 2); assert.equal(f.requests[1].body.tekst, 'waarom?');
  assert.equal(f.node('.rp-in').readOnly, true); assert.equal(f.node('.rp-kaart').getAttribute('aria-busy'), 'true');
  f.requests[1].resolve({ veld: 'telefoon', tekst: 'Om u te bereiken.' }); await tick();
  assert.equal(f.node('.rp-in').value, '12'); assert.equal(f.node('.rp-vraag').textContent, 'Vraag A');
  assert.equal(f.node('.rp-in').getAttribute('aria-describedby'), f.node('.rp-uitleg').id);
  f.node('.rp-door').click(); f.node('.rp-in').fire('keydown', { key: 'Enter' }); await tick();
  assert.equal(f.requests.length, 3); assert.equal(f.requests[2].body.tekst, '12');
  f.requests[2].resolve({ veld: 'telefoon', tekst: 'Te kort.' }); await tick();
  assert.equal(f.node('.rp-in').value, '12'); assert.equal(f.node('.rp-kaart').getAttribute('aria-busy'), null);
  f.node('.rp-stop').click(); assert.equal(await result, false);
});

for (const fout of [false, true]) test('laat verzendantwoord mag B niet wijzigen of ontgrendelen: ' + fout, async () => {
  const f = fixture(); const a = await start(f); f.node('.rp-in').value = '0612345678';
  const oudeInput = f.node('.rp-in'), oudeDoor = f.node('.rp-door'), oudeWaarom = f.node('.rp-waarom'), oudeStop = f.node('.rp-stop');
  oudeDoor.click(); await tick(); const oud = f.requests.at(-1);
  const b = await start(f, 'telefoon', 'B'); assert.equal(await a.result, false);
  f.node('.rp-in').value = '0687654321'; f.node('.rp-door').click(); await tick(); const aantal = f.requests.length;
  if (fout) oud.reject(new Error('Oude fout')); else oud.resolve({ klaar: true }); await tick();
  oudeInput.fire('keydown', { key: 'Enter' }); oudeDoor.fire('click'); oudeWaarom.fire('click'); oudeStop.fire('click');
  f.node('.rp-in').fire('keydown', { key: 'Enter' }); await tick();
  assert.equal(f.requests.length, aantal); assert.equal(f.node('.rp-kaart').open, true);
  assert.equal(f.node('.rp-vraag').textContent, 'Vraag B'); assert.equal(f.node('.rp-kaart').getAttribute('aria-busy'), 'true');
  f.requests.at(-1).resolve({ klaar: true }); assert.equal(await b.result, true);
});

for (const fout of [false, true]) test('oud adresvoorstel of zoekfallback bereikt nieuw gesprek niet: ' + fout, async () => {
  const f = fixture(); const a = await start(f, 'adres'); f.node('.rp-in').value = '1234 AB 12';
  f.node('.rp-door').click(); await tick(); const oud = f.requests.at(-1);
  assert.equal(oud.url, '/api/adres/zoek'); assert.deepEqual(oud.body, { postcode: '1234AB', huisnummer: '12' });
  const b = await start(f, 'telefoon', 'B'); assert.equal(await a.result, false);
  if (fout) oud.reject(new Error('Oud netwerkprobleem'));
  else oud.resolve({ gevonden: true, straat: 'Markt', postcode: '1234AB', woonplaats: 'Leiden' });
  await tick(); assert.equal(f.node('.rp-vraag').textContent, 'Vraag B');
  f.node('.rp-stop').click(); assert.equal(await b.result, false);
});

test('adres vraagt expliciet akkoord, bindt oude Ja/Nee en verzendt exact het getoonde voorstel', async () => {
  const f = fixture(); const a = await start(f, 'adres'); f.node('.rp-in').value = '1234 AB 12';
  f.node('.rp-door').click(); await tick();
  f.requests.at(-1).resolve({ gevonden: true, straat: 'Markt', postcode: '1234AB', woonplaats: 'Leiden' }); await tick();
  const ja = f.node('.rp-door'), nee = f.node('.rp-stop');
  assert.equal(f.requests.length, 2, 'alleen start en zoeken, niets opgeslagen');
  assert.match(f.node('.rp-vraag').textContent, /^Markt 12, 1234AB Leiden, klopt dat\?$/);
  assert.equal(f.node('.rp-kaart').getAttribute('aria-describedby'), f.node('.rp-vraag').id);
  assert.equal(f.document.activeElement, ja);
  const b = await start(f, 'telefoon', 'B'); assert.equal(await a.result, false);
  ja.fire('click'); nee.fire('click'); await tick(); assert.equal(f.requests.length, 3);
  assert.equal(f.node('.rp-vraag').textContent, 'Vraag B'); f.node('.rp-stop').click(); await b.result;
  const c = await start(f, 'adres', 'C'); f.node('.rp-in').value = '1234 AB 12'; f.node('.rp-door').click(); await tick();
  f.requests.at(-1).resolve({ gevonden: true, straat: 'Markt', postcode: '1234AB', woonplaats: 'Leiden' }); await tick();
  f.node('.rp-door').click(); f.node('.rp-door').fire('click'); await tick();
  assert.deepEqual(f.requests.at(-1).body, { id: 'C', tekst: 'Markt 12, 1234AB Leiden' });
  f.requests.at(-1).resolve({ klaar: true }); assert.equal(await c.result, true);
});

test('stop vóór de transportmicrotaak verzendt niets; synchroon throw blijft bedienbaar', async () => {
  const f = fixture(); const a = f.api.los({}, f.call); f.node('.rp-stop').click(); await tick();
  assert.equal(await a, false); assert.equal(f.requests.length, 0);
  const b = f.api.los({}, () => { throw new Error('Synchrone fout'); }); await tick();
  assert.equal(f.node('.rp-vraag').textContent, 'Synchrone fout'); assert.equal(f.document.activeElement, f.node('.rp-stop'));
  f.node('.rp-stop').click(); assert.equal(await b, false);
});

test('vang hervat exact eenmaal alleen na akkoord; servertekst blijft escaped', async () => {
  const f = fixture(); let retries = 0;
  assert.equal(f.api.vang({}, 403, () => { retries++; }, f.call), null);
  const r = f.api.vang({ soort: 'reservering', ontbreekt: ['telefoon'] }, 428, () => { retries++; return 'bewaard'; }, f.call);
  await tick(); f.requests[0].resolve({ id: 'A', veld: 'telefoon', tekst: '<img src=x onerror=alert(1)> & vraag' }); await tick();
  assert.equal(f.node('img'), null); assert.match(f.node('.rp-kaart').html, /&lt;img/);
  f.node('.rp-in').value = '0612345678'; f.node('.rp-door').click(); await tick();
  f.requests[1].resolve({ klaar: true }); assert.equal(await r, 'bewaard'); assert.equal(retries, 1);
});

test('ontkoppelde dialoog wordt opnieuw gebouwd en behoudt terugfocus', async () => {
  const f = fixture(); const a = await start(f); const oud = f.node('.rp-kaart');
  f.node('.rp-waas').remove(); f.trigger.focus(); const b = await start(f, 'telefoon', 'B');
  assert.equal(await a.result, false); assert.notEqual(f.node('.rp-kaart'), oud);
  assert.equal(f.node('.rp-kaart').isConnected, true); assert.equal(f.styles().length, 0);
  f.node('.rp-kaart').close(); assert.equal(await b.result, false); assert.equal(f.document.activeElement, f.trigger);
});

test('onjuiste of negatieve antwoorden hervatten nooit de oorspronkelijke handeling', async () => {
  for (const fase of ['start', 'zeg']) for (const antwoord of [null, {}, [], { klaar: 'false' },
    { klaar: 1 }, { klaar: true, error: 'Geweigerd' }, { klaar: true, ok: false }, { klaar: true, gestopt: true },
    { tekst: 'Vraag', veld: 'telefoon', gestopt: 'false' }, { tekst: 'Vraag', veld: 42 }]) {
    const f = fixture(); let retries = 0;
    const r = f.api.vang({ soort: 'reservering', ontbreekt: ['telefoon'], error: 'Gestopt' }, 428,
      () => { retries++; }, f.call).catch(e => e.message);
    await tick();
    if (fase === 'zeg') {
      f.requests[0].resolve({ id: 'A', tekst: 'Vraag', veld: 'telefoon' }); await tick();
      f.node('.rp-in').value = '0612345678'; f.node('.rp-door').click(); await tick();
    }
    f.requests.at(-1).resolve(antwoord); await tick();
    assert.equal(retries, 0, fase + JSON.stringify(antwoord)); assert.equal(f.node('.rp-kaart').open, true);
    assert.equal(f.node('.rp-in'), null, 'geen invulveld voor een onbevestigde vervolgstap');
    assert.equal(f.document.activeElement, f.node('.rp-stop'));
    f.node('.rp-stop').click(); assert.equal(await r, 'Gestopt');
  }
});

test('een synchrone verzendfout bereikt alleen zijn eigen gesprek', async () => {
  const f = fixture(); const r = f.api.los({}, (url, body) => {
    if (url.endsWith('/zeg')) throw new Error('Verzenden mislukt'); return f.call(url, body);
  });
  await tick(); f.requests[0].resolve({ id: 'A', tekst: 'Vraag', veld: 'telefoon' }); await tick();
  f.node('.rp-in').value = '0612345678'; f.node('.rp-door').click(); await tick();
  assert.equal(f.node('.rp-vraag').textContent, 'Verzenden mislukt');
  f.node('.rp-stop').click(); assert.equal(await r, false);
});

for (const fase of ['start', 'zeg', 'adres']) test('DOM-verwijdering zonder heropening stopt late ' + fase, async () => {
  for (const deel of ['.rp-waas', '.rp-kaart']) for (const reject of [false, true]) {
    const f = fixture(); let retries = 0;
    const r = f.api.vang({ soort: 'reservering', ontbreekt: ['telefoon'], error: 'Gestopt' }, 428,
      () => { retries++; }, f.call).then(() => 'hervat', e => e.message);
    await tick();
    if (fase !== 'start') {
      f.requests[0].resolve({ id: 'A', tekst: 'Vraag', veld: fase === 'adres' ? 'adres' : 'telefoon' }); await tick();
      f.node('.rp-in').value = fase === 'adres' ? '1234 AB 12' : '0612345678';
      f.node('.rp-door').click(); await tick();
    }
    const req = f.requests.at(-1), kaart = f.node('.rp-kaart'); f.node(deel).remove();
    if (reject) req.reject(new Error('Laat netwerkantwoord'));
    else req.resolve(fase === 'adres' ? { gevonden: true, straat: 'Markt', postcode: '1234AB', woonplaats: 'Leiden' } : { klaar: true });
    assert.equal(await r, 'Gestopt'); assert.equal(retries, 0);
    assert.equal(kaart.open, false); assert.equal(f.document.activeElement, f.trigger);
  }
});

test('DOM-verwijdering vóór de callmicrotaak verzendt of hervat niets', async () => {
  const f = fixture(); let retries = 0;
  const r = f.api.vang({ soort: 'reservering', ontbreekt: ['telefoon'], error: 'Gestopt' }, 428,
    () => { retries++; }, f.call).catch(e => e.message);
  f.node('.rp-waas').remove(); assert.equal(await r, 'Gestopt');
  assert.equal(f.requests.length, 0); assert.equal(retries, 0);
  const b = await start(f); f.node('.rp-in').value = '0612345678'; f.node('.rp-door').click();
  f.node('.rp-kaart').remove(); assert.equal(await b.result, false); assert.equal(f.requests.length, 1);
});

test('broncontract: 10KiB, DS-tokens en aantoonbaar uitgesloten DS-root', () => {
  assert.ok(Buffer.byteLength(bron) <= 10240);
  const css = fs.readFileSync('public/ds/componenten/poortgesprek.css', 'utf8');
  const tokens = fs.readFileSync('public/ds/tokens.css', 'utf8');
  for (const m of css.matchAll(/var\((--ds-[\w-]+)/g)) assert.ok(tokens.includes(m[1] + ':'), m[1]);
  assert.doesNotMatch(css, /!important|#[0-9a-f]{3,8}\b|rgba?\(|(?:^|[;{])\s*(?:left|right|top|bottom|width|height)\s*:/i);
  const a = require('../scripts/ontwerpsysteem').scriptLaadAnalyse(bron, { ds: true });
  assert.equal(a.injecties + a.mogelijkeInjecties, 0); assert.deepEqual(a.onzeker, []);
  assert.ok(a.uitgesloten.includes('/ds/rtg-ds.css'));
  assert.doesNotMatch(bron, /poortgesprek-legacy\.css/);
});
