'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { fixture, fix, weiger, tick, gewoon } = require('./lib/plek-fixture');
const punt = { lat: 52.37, lng: 4.9, nauwkeurig: 10 };

test('DS wordt bij de vraag gekozen: canonieke root, niet-modaal, tekst, hooks en Escape-focusherstel', async () => {
  const f = fixture({ ds: false }); f.ds(true);
  const r = f.api.vraag({ waarom: '<img src=x> Uw route & positie' });
  const kaart = f.node('.rtgplek'), ja = f.node('.ja'), nee = f.node('.nee');
  assert.ok(kaart.classList.contains('ds-plek')); assert.equal(kaart.tagName, 'DIV');
  assert.equal(kaart.getAttribute('role'), 'dialog'); assert.equal(kaart.getAttribute('aria-modal'), 'false');
  assert.equal(kaart.getAttribute('aria-label'), 'Locatie gebruiken');
  assert.equal(kaart.querySelector('p').textContent, '<img src=x> Uw route & positie');
  assert.equal(kaart.querySelector('img'), null); assert.equal(nee.hasAttribute('data-contextactie'), true);
  assert.equal(ja.textContent, 'Aanzetten'); assert.equal(nee.textContent, 'Nu niet');
  assert.ok(ja.classList.contains('ds-knop')); assert.ok(nee.classList.contains('ds-knop'));
  assert.equal(f.styles().length, 0); assert.equal(f.links().length, 1);
  assert.equal(f.links()[0].href, '/ds/rtg-ds.css'); assert.equal(f.links()[0].getAttribute('id'), 'rtgDsRuntimeCss');
  assert.equal(f.gets.length, 0); assert.equal(f.writes.length, 0);
  assert.equal(f.document.activeElement, ja);
  assert.equal(ja.fire('keydown', { key: 'Escape' }).defaultPrevented, true);
  assert.equal(await r, null); assert.equal(f.node('.rtgplek'), null);
  assert.equal(f.document.activeElement, f.trigger);
});

test('legacy-host gebruikt dezelfde canonieke DS-root en de vraag zelf wordt opgeruimd', async () => {
  const f = fixture({ ds: false }); const r = f.api.vraag();
  assert.equal(f.styles().length, 0); assert.equal(f.links().length, 1);
  assert.equal(f.links()[0].href, '/ds/rtg-ds.css'); assert.equal(f.links()[0].getAttribute('id'), 'rtgDsRuntimeCss');
  assert.equal(f.node('.rtgplek').classList.contains('ds-plek'), true);
  assert.equal(f.node('.ja').classList.contains('ds-knop'), true);
  assert.equal(f.node('.nee').classList.contains('ds-knop'), true);
  f.node('.nee').click(); assert.equal(await r, null); assert.equal(f.links().length, 1);
  assert.equal(f.gets.length, 0); assert.equal(f.writes.length, 0);
});

test('alleen de expliciete opslagwaarde 1 geeft ongevraagd GPS vrij', () => {
  for (const key of [null, '', '0', 'true', 'yes', '1']) {
    const f = fixture({ key }); assert.equal(f.api.aan(), key === '1', String(key));
  }
});

test('vraag bewaart toestemming pas na Ja en geeft echte positie en GPS-opties door', async () => {
  const f = fixture(); const r = f.api.vraag({ gps: { maximumAge: 321, timeout: 456 } });
  assert.equal(f.key(), null); assert.equal(f.gets.length, 0);
  f.node('.ja').click(); await tick();
  assert.equal(f.key(), '1'); assert.equal(f.gets.length, 1); assert.equal(f.node('.rtgplek'), null);
  assert.equal(f.gets[0].options.maximumAge, 321); assert.equal(f.gets[0].options.timeout, 456);
  fix(f.gets[0]); assert.deepEqual(gewoon(await r), punt); assert.equal(f.key(), '1');
});

test('Nu niet onthoudt weigering; een bewuste zetAan heft die op en kan weer uit', async () => {
  const f = fixture(); const r = f.api.vraag(); f.node('.nee').click(); assert.equal(await r, null);
  assert.equal(await f.api.vraag(), null); assert.equal(f.node('.rtgplek'), null); assert.equal(f.gets.length, 0);
  const aan = f.api.zetAan(true); await tick(); assert.equal(f.gets.length, 1);
  fix(f.gets[0]); assert.equal(await aan, true); assert.equal(f.key(), '1');
  assert.equal(await f.api.zetAan(false), false); assert.equal(f.key(), '0'); assert.equal(f.gets.length, 1);
  const opnieuw = f.api.vraag(); assert.ok(f.node('.rtgplek')); f.node('.nee').click(); assert.equal(await opnieuw, null);
});

test('toestelweigering zet een gewone vraag en expliciete zetAan terug op uit', async () => {
  for (const methode of ['vraag', 'zetAan']) {
    const f = fixture({ key: '1' }); const r = methode === 'vraag' ? f.api.vraag() : f.api.zetAan(true);
    await tick(); weiger(f.gets[0]); assert.equal(await r, methode === 'vraag' ? null : false);
    assert.equal(f.key(), '0');
  }
});

test('zonder geolocation geeft vraag null en volg eenmaal geen-gps', async () => {
  const f = fixture({ gps: false, key: '1' }), redenen = [], punten = [];
  assert.equal(await f.api.vraag(), null);
  const stop = f.api.volg(p => punten.push(p), { geenPlek: r => redenen.push(r) });
  await tick(); stop(); stop();
  assert.deepEqual(redenen, ['geen-gps']); assert.deepEqual(punten, []); assert.deepEqual(f.writes, []);
});

test('volg levert eerste fix en watchfix; geenPlek komt nooit na een positie', async () => {
  const f = fixture(), punten = [], redenen = [];
  const stop = f.api.volg(p => punten.push(gewoon(p)), { geenPlek: r => redenen.push(r), gps: { maximumAge: 17 } });
  f.node('.ja').click(); await tick(); fix(f.gets[0]); await tick();
  assert.deepEqual(punten, [punt]); assert.equal(f.watches.length, 1);
  assert.equal(f.watches[0].options.maximumAge, 17);
  fix(f.watches[0], 53, 5); weiger(f.watches[0]); weiger(f.watches[0]);
  assert.deepEqual(punten[1], { lat: 53, lng: 5, nauwkeurig: 10 }); assert.deepEqual(redenen, []); stop();
});

test('geenPlek komt voor de eerste fix hoogstens eenmaal, ook bij herhaalde watchfout', () => {
  const f = fixture({ key: '1' }), redenen = [];
  const stop = f.api.volg(() => assert.fail('geen fix ontvangen'), { geenPlek: r => redenen.push(r) });
  weiger(f.watches[0]); weiger(f.watches[0]);
  assert.deepEqual(redenen, ['toestel-weigert']); assert.equal(f.key(), '0'); stop();
});

test('Nu niet bij volg meldt eenmaal niet-toegestaan en start geen GPS', async () => {
  const f = fixture(), redenen = [];
  const stop = f.api.volg(() => assert.fail('geen toestemming'), { geenPlek: r => redenen.push(r) });
  f.node('.nee').click(); await tick(); stop();
  assert.deepEqual(redenen, ['niet-toegestaan']); assert.equal(f.gets.length + f.watches.length, 0);
});

test('stop tijdens vraag verwijdert alleen de kaart; oude knoppen kunnen niets meer wijzigen', async () => {
  const f = fixture(), punten = [], redenen = [];
  const stop = f.api.volg(p => punten.push(p), { geenPlek: r => redenen.push(r) });
  const kaart = f.node('.rtgplek'), ja = f.node('.ja'), nee = f.node('.nee');
  stop(); stop(); assert.equal(f.node('.rtgplek'), null);
  ja.fire('click'); nee.fire('click'); kaart.fire('keydown', { key: 'Escape' }); await tick();
  assert.equal(f.key(), null); assert.deepEqual(f.writes, []);
  assert.equal(f.gets.length + f.watches.length, 0); assert.deepEqual(punten, []); assert.deepEqual(redenen, []);
  assert.equal(f.document.activeElement, f.trigger);
  const volgende = f.api.vraag(); assert.ok(f.node('.rtgplek'), 'stop is geen onthouden weigering');
  f.node('.nee').click(); assert.equal(await volgende, null);
});

test('stop direct na Ja voorkomt de uitgestelde GPS-start en opslagwijziging', async () => {
  const f = fixture(); const stop = f.api.volg(() => assert.fail('gestopt'));
  f.node('.ja').click(); stop(); await tick();
  assert.deepEqual(f.writes, []); assert.equal(f.gets.length + f.watches.length, 0);
});

for (const antwoord of ['fix', 'fout']) test('stop tijdens eerste GPS-vraag negeert late ' + antwoord, async () => {
  const f = fixture(), punten = [], redenen = [];
  const stop = f.api.volg(p => punten.push(p), { geenPlek: r => redenen.push(r) });
  f.node('.ja').click(); await tick(); assert.equal(f.gets.length, 1);
  const geschreven = f.writes.slice(); stop();
  if (antwoord === 'fix') fix(f.gets[0]); else weiger(f.gets[0]); await tick();
  assert.deepEqual(punten, []); assert.deepEqual(redenen, []); assert.deepEqual(f.writes, geschreven);
  assert.equal(f.key(), '1'); assert.equal(f.watches.length, 0);
});

test('actieve watch stopt eenmaal, ook met id 0; late success en error zijn inert', async () => {
  const f = fixture({ key: '1' }), punten = [], redenen = [];
  const stop = f.api.volg(p => punten.push(p), { geenPlek: r => redenen.push(r) });
  assert.equal(f.watches[0].id, 0); stop(); stop(); fix(f.watches[0]); weiger(f.watches[0]); await tick();
  assert.deepEqual(f.clears, [0]); assert.deepEqual(punten, []); assert.deepEqual(redenen, []);
  assert.deepEqual(f.writes, []); assert.equal(f.key(), '1'); assert.equal(f.watches.length, 1);
});

test('stop in de eerste callback voorkomt de aansluitende watch', async () => {
  const f = fixture(); let ontvangen = 0;
  const stop = f.api.volg(() => { ontvangen++; stop(); });
  f.node('.ja').click(); await tick(); fix(f.gets[0]); await tick();
  assert.equal(ontvangen, 1); assert.equal(f.watches.length, 0);
});

test('twee toestemmingskaarten zijn onafhankelijk: A stoppen laat B bedienbaar', async () => {
  const f = fixture(), punten = [];
  const stopA = f.api.volg(() => assert.fail('A is gestopt'), { waarom: 'A' });
  const kaartA = f.node('.rtgplek');
  const stopB = f.api.volg(p => punten.push(gewoon(p)), { waarom: 'B' });
  const kaartB = f.nodes('.rtgplek').find(n => n !== kaartA); assert.ok(kaartB);
  stopA(); assert.equal(kaartA.isConnected, false); assert.equal(kaartB.isConnected, true);
  assert.equal(f.document.activeElement, kaartB.querySelector('.ja'), 'A-stop steelt geen focus van B');
  kaartA.querySelector('.ja').fire('click'); kaartB.querySelector('.ja').click(); await tick();
  assert.equal(f.gets.length, 1); fix(f.gets[0]); await tick();
  assert.deepEqual(punten, [punt]); assert.equal(f.watches.length, 1); stopB();
});

test('A stoppen en late A-fout raken B-watch en gedeelde voorkeur niet', () => {
  const f = fixture({ key: '1' }), punten = [];
  const stopA = f.api.volg(() => assert.fail('A is gestopt'));
  const stopB = f.api.volg(p => punten.push(gewoon(p)));
  stopA(); weiger(f.watches[0]); fix(f.watches[0]); fix(f.watches[1]);
  assert.deepEqual(f.clears, [0]); assert.deepEqual(punten, [punt]); assert.equal(f.key(), '1');
  assert.deepEqual(f.writes, []); stopB(); assert.deepEqual(f.clears, [0, 1]);
});

test('DS-presentatie staat in canonical component met bestaande semantische tokens', () => {
  const root = path.join(__dirname, '../public/ds');
  const css = fs.readFileSync(path.join(root, 'componenten/plek.css'), 'utf8');
  const tokens = fs.readFileSync(path.join(root, 'tokens.css'), 'utf8');
  assert.match(css, /@layer\s+rtg\.component/); assert.match(css, /\.ds-plek\b/);
  for (const m of css.matchAll(/var\((--ds-[\w-]+)/g)) assert.ok(tokens.includes(m[1] + ':'), m[1]);
  assert.doesNotMatch(css, /!important|#[0-9a-f]{3,8}\b|rgba?\(|var\(--(?:paneel|muted|gold|txt|line)\b/i);
});
