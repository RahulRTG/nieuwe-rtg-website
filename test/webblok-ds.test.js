/* Echte renderer; dit bewijst geen visuele DS-dekking. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { schoon, site, fixture, alle, vind, blokVoorbeelden } = require('./lib/webblok-fixture');

test('alle bezoekerblokken houden tekst, basisbeelden en inerte knoppen zonder vaste inline-opmaak', () => {
  const f = fixture();
  f.zet({ site: site(), zaak: { naam: 'Proefzaak' } });
  // zaakdata wordt servermatig opgelost voordat deze renderer wordt aangeroepen.
  const invoer = blokVoorbeelden();
  for (const raw of invoer) {
    const b = schoon.schoonBlok(raw), el = f.tekenBlok(b, 'telefoon');
    assert.ok(el.classList.contains('ds-webblok__blok'), b.type);
    assert.ok(!alle(el).some(n => ['A', 'SCRIPT'].includes(n.tagName)), 'geen link/script uit ' + b.type);
    if (b.type !== 'ruimte') assert.ok(el.textContent || vind(el, 'img'), b.type + ' heeft inhoud');
    for (const n of alle(el)) assert.deepEqual(Object.keys(n.style),
      n === el && b.type === 'ruimte' ? ['blockSize'] : [], b.type + ': alleen auteursmaat blijft inline');
    if (b.type === 'beeld') {
      assert.equal(vind(el, 'img').src, b.src, 'basis-src blijft de bron');
      assert.equal(vind(el, 'img').alt, 'Mobiel');
    }
    if (b.type === 'galerij') assert.deepEqual(el.children.map(n => n.src), b.beelden);
  }
  // Ook bij een ongeschoond antwoord blijft de renderer zelf tekst schrijven.
  const gevaar = '<img src=x onerror=alert(1)> & "tekst"';
  const el = f.tekenBlok({ type: 'tekst', tekst: gevaar }, 'desktop');
  assert.equal(el.textContent, gevaar);
  assert.equal(vind(el, 'img'), undefined);
});

test('echte responsive varianten houden volgorde, zichtbaarheid en bestaande DOM binnen dezelfde versie', async () => {
  const s = site({ blokken: [
    { id: 'a', type: 'tekst', tekst: 'A', varianten: { telefoon: { tekst: 'A mobiel' } } },
    { id: 'b', type: 'tekst', tekst: 'B', verberg: ['tablet'] },
    { id: 'c', type: 'tekst', tekst: 'C', verberg: ['telefoon'] }
  ], volgorde: { telefoon: ['b', 'b', 'weg', 'a'], tablet: ['c', 'a'] } });
  const bewaard = JSON.stringify(s), f = fixture();
  f.antwoord(() => Promise.resolve({ site: s })); await f.toonSite(s.adres);
  assert.deepEqual(f.doek().children.map(el => el.textContent), ['A', 'B', 'C']);
  for (const [breed, versie, teksten] of [
    [640, 'telefoon', ['B', 'A mobiel']], [641, 'tablet', ['C', 'A']],
    [1000, 'tablet', ['C', 'A']], [1001, 'desktop', ['A', 'B', 'C']]
  ]) {
    const oud = f.doek().children[0], zelfde = f.doek().dataset.ver === versie;
    f.window.innerWidth = breed; assert.equal(f.versieNu(), versie); f.schilder();
    assert.deepEqual(f.doek().children.map(el => el.textContent), teksten);
    if (zelfde) assert.equal(f.doek().children[0], oud, 'zelfde versie bewaart DOM en invoer');
  }
  assert.equal(JSON.stringify(s), bewaard, 'renderer verandert het opgeslagen ontwerp niet');
});

test('toonSite behoudt geschoonde auteurskleuren en ruimtehoogte in lokale DS-datawaarden', async () => {
  const f = fixture(), s = site({ accent: '#123456', thema: 'licht',
    kleuren: { bg: '#abc', txt: '#abcdef', card: '#FfEeDd', onbekend: 'red' },
    blokken: [-10, 999, 0, 87.5].map((hoogte, i) => ({ id: 'r' + i, type: 'ruimte', hoogte })) });
  f.antwoord(() => Promise.resolve({ site: s })); await f.toonSite(s.adres);
  const doek = f.doek();
  assert.ok(doek.classList.contains('ds-webblok')); assert.equal(doek.dataset.thema, 'licht');
  for (const [naam, waarde] of Object.entries({ accent: '#123456', grond: '#abc', inkt: '#abcdef', kaart: '#FfEeDd',
    'inkt-zacht': 'color-mix(in srgb,#abcdef 66%,transparent)', lijn: 'color-mix(in srgb,#abcdef 16%,transparent)' }))
    assert.equal(doek.style['--ds-webblok-' + naam], waarde, naam);
  assert.ok(Object.keys(doek.style).every(k => k.startsWith('--ds-webblok-')));
  assert.deepEqual(doek.children.map(el => el.style.blockSize), ['8px', '240px', '40px', '87.5px']);
  const zonder = site({ kleuren: { bg: 'url(javascript:x)', txt: '#12345', card: 'red' } });
  f.antwoord(() => Promise.resolve({ site: zonder })); await f.toonSite(zonder.adres);
  assert.equal(f.doek().dataset.thema, 'donker');
  assert.equal(f.doek().style['--ds-webblok-accent'], '#7F1634');
  assert.deepEqual(Object.keys(f.doek().style), ['--ds-webblok-accent'], 'geen oude of ongeldige auteurskleur lekt door');
});

test('het echte formulier bewaart de herhaalsleutel na fout en vernieuwt pas na succes', async () => {
  const f = fixture(), pending = [];
  f.zet({ site: site(), persoon: { codenaam: 'Maker' } });
  f.antwoord(() => new Promise((resolve, reject) => pending.push({ resolve, reject })));
  const b = schoon.schoonBlok({ type: 'formulier', soort: 'offerte', kop: 'Schrijf', knop: 'Stuur',
    varianten: { telefoon: { soort: 'klacht', kop: 'Mobiele kop' } } });
  const el = f.tekenBlok(b, 'telefoon'), form = vind(el, 'form'), veld = vind(el, 'textarea');
  f.hoofd.appendChild(el);
  const submit = () => form.listeners.submit({ preventDefault() {} });
  assert.equal(vind(el, 'h2').textContent, 'Mobiele kop');
  assert.equal(veld.rows, 4); assert.equal(veld.maxLength, 500);
  assert.match(veld.placeholder, /offerte.*Maker/);
  veld.value = ' x '; await submit(); assert.equal(f.verzoeken.length, 0);
  veld.value = ' Graag een offerte '; let klaar = submit();
  assert.equal(f.verzoeken[0].url, '/api/browser/bericht');
  assert.deepEqual({ ...f.verzoeken[0].body }, { adres: 'proefsite', tekst: 'Graag een offerte', soort: 'offerte', idem: 'web-1' });
  pending[0].reject(new Error('Verbinding verbroken')); await klaar;
  assert.equal(veld.value, ' Graag een offerte '); assert.equal(f.meldingen.at(-1), 'Verbinding verbroken');
  klaar = submit(); assert.equal(f.verzoeken[1].body.idem, 'web-1');
  pending[1].resolve({ ok: true, via: 'werklijst', soort: 'offerte', herhaald: true }); await klaar;
  assert.equal(veld.value, ''); assert.match(f.meldingen.at(-1), /werklijst/);
  veld.value = 'Een volgend bericht'; klaar = submit();
  assert.equal(f.verzoeken[2].body.idem, 'web-2');
  pending[2].resolve({ ok: true, via: 'chat', soort: 'offerte' }); await klaar;
  assert.equal(veld.value, ''); assert.match(f.meldingen.at(-1), /gesprek/);
});

async function formulierFixture() {
  const f = fixture(), s = site({ blokken: [
    { id: 'kop', type: 'kop', tekst: 'Kop' },
    { id: 'form', type: 'formulier', kop: 'Desktop', knop: 'Stuur', verberg: ['tablet'],
      varianten: { telefoon: { kop: 'Mobiel', knop: 'Verzend mobiel' } } }
  ], volgorde: { telefoon: ['form', 'kop'] } });
  f.antwoord(() => Promise.resolve({ site: s })); await f.toonSite(s.adres);
  return { f, s, form: vind(f.doek(), 'form'), veld: vind(f.doek(), 'textarea') };
}

for (const verhuizen of [true, false]) test('formulier behoudt DOM, concept, focus en selectie met ' +
  (verhuizen ? 'moveBefore' : 'insertBefore'), async () => {
  const { f, form, veld } = await formulierFixture();
  if (!verhuizen) f.doek().moveBefore = undefined;
  veld.value = 'Mijn bewaarde concept'; veld.focus(); veld.setSelectionRange(2, 8, 'backward');
  for (const [breedte, kop] of [[390, 'Mobiel'], [1280, 'Desktop']]) {
    f.window.innerWidth = breedte; f.schilder();
    assert.equal(vind(f.doek(), 'form'), form); assert.equal(vind(f.doek(), 'textarea'), veld);
    assert.equal(veld.value, 'Mijn bewaarde concept'); assert.equal(f.document.activeElement, veld);
    assert.deepEqual([veld.selectionStart, veld.selectionEnd, veld.selectionDirection], [2, 8, 'backward']);
    assert.equal(form.parentNode.querySelector('h2').textContent, kop);
  }
  f.window.innerWidth = 820; f.schilder();
  assert.equal(form.parentNode.hidden, true); assert.equal(form.isConnected, true);
  f.window.innerWidth = 390; f.schilder();
  assert.equal(form.parentNode.hidden, false); assert.equal(veld.value, 'Mijn bewaarde concept');
});

test('verloren antwoord behoudt sleutel over resize; lopend antwoord wist geen nieuwe invoer', async () => {
  const { f, form, veld } = await formulierFixture(), pending = [];
  f.antwoord(() => new Promise((resolve, reject) => pending.push({ resolve, reject })));
  const submit = () => form.listeners.submit({ preventDefault() {} });
  veld.value = 'Mijn bericht'; let klaar = submit(); const eerste = f.verzoeken.at(-1).body;
  f.window.innerWidth = 390; f.schilder();
  pending[0].reject(new Error('Antwoord verloren')); await klaar;
  assert.equal(veld.value, 'Mijn bericht');
  f.window.innerWidth = 1280; f.schilder(); klaar = submit();
  assert.deepEqual({ ...f.verzoeken.at(-1).body }, { ...eerste });
  veld.value = 'Nieuw concept tijdens wachten'; f.window.innerWidth = 390; f.schilder();
  pending[1].resolve({ ok: true, via: 'werklijst', soort: 'vraag', herhaald: true }); await klaar;
  assert.equal(vind(f.doek(), 'form'), form); assert.equal(veld.value, 'Nieuw concept tijdens wachten');
});

for (const faal of [false, true]) test('sitewisseling neemt geen concept of late ' +
  (faal ? 'fout' : 'succesmelding') + ' over', async () => {
  const { f, s, form, veld } = await formulierFixture(); let resolve, reject;
  const ander = { ...s, adres: 'anderesite', blokken: s.blokken.map(b => ({ ...b })) };
  f.antwoord(url => url.endsWith('/open') ? Promise.resolve({ site: ander }) :
    new Promise((ja, nee) => { resolve = ja; reject = nee; }));
  veld.value = 'Bericht voor de vorige site';
  const klaar = form.listeners.submit({ preventDefault() {} });
  assert.equal(f.verzoeken.at(-1).body.adres, 'proefsite');
  await f.toonSite(ander.adres);
  const nieuw = vind(f.doek(), 'textarea'); assert.notEqual(nieuw, veld); assert.equal(nieuw.value, '');
  nieuw.value = 'Concept voor de nieuwe site'; const meldingen = f.meldingen.length;
  if (faal) reject(new Error('Late fout')); else resolve({ ok: true, via: 'werklijst', soort: 'vraag' });
  await klaar;
  assert.equal(form.isConnected, false); assert.equal(nieuw.value, 'Concept voor de nieuwe site');
  assert.equal(f.meldingen.length, meldingen);
});

test('één lopende verzending blokkeert dubbele submits; volgend bericht bewaart zijn eigen retry-sleutel', async () => {
  const { f, form, veld } = await formulierFixture(), pending = [];
  f.verzoeken.length = 0;
  f.antwoord(() => new Promise((resolve, reject) => pending.push({ resolve, reject })));
  const submit = () => form.listeners.submit({ preventDefault() {} }), knop = vind(form, 'button');
  veld.value = 'Bericht A'; const eerste = submit(); await submit();
  assert.equal(f.verzoeken.length, 1, 'ook een programmatic dubbel submit maakt geen tweede aanvraag');
  assert.equal(knop.disabled, true);
  assert.equal(form.attrs['aria-busy'], 'true');
  const sleutelA = f.verzoeken[0].body.idem;
  veld.value = 'Bericht B'; await submit();
  assert.equal(f.verzoeken.length, 1, 'nieuwe invoer kan niet tegelijk met A verstuurd worden');
  pending[0].resolve({ ok: true, via: 'werklijst', soort: 'vraag' }); await eerste;
  assert.equal(veld.value, 'Bericht B'); assert.equal(knop.disabled, false);
  assert.equal(form.attrs['aria-busy'], 'false');
  const tweede = submit(), payloadB = { ...f.verzoeken[1].body };
  assert.notEqual(payloadB.idem, sleutelA); assert.equal(payloadB.tekst, 'Bericht B');
  await submit(); assert.equal(f.verzoeken.length, 2);
  pending[1].reject(new Error('Antwoord B verloren')); await tweede;
  assert.equal(knop.disabled, false); assert.equal(veld.value, 'Bericht B');
  assert.equal(form.attrs['aria-busy'], 'false');
  const retry = submit();
  assert.deepEqual({ ...f.verzoeken[2].body }, payloadB, 'B behoudt payload en sleutel na fout');
  pending[2].resolve({ ok: true, via: 'werklijst', soort: 'vraag', herhaald: true }); await retry;
  assert.equal(veld.value, ''); assert.equal(knop.disabled, false);
});

for (const [naam, antwoord] of [
  ['ontbrekend', undefined], ['null', null], ['lege body of ongeldige JSON', {}], ['array', []],
  ['negatief', { ok: false, error: 'Geweigerd', via: 'werklijst', soort: 'vraag' }],
  ['geen bevestigingsvlag', { via: 'werklijst', soort: 'vraag' }],
  ['tekstuele bevestiging', { ok: 'true', via: 'werklijst', soort: 'vraag' }],
  ['ontbrekende bestemming', { ok: true, soort: 'vraag' }],
  ['onbekende bestemming', { ok: true, via: 'mail', soort: 'vraag' }],
  ['ontbrekende soort', { ok: true, via: 'werklijst' }],
  ['andere soort', { ok: true, via: 'werklijst', soort: 'offerte' }]
]) test('onbevestigd berichtantwoord (' + naam + ') bewaart concept en sleutel tot geldige ontvangst', async () => {
  const { f, form, veld } = await formulierFixture(), knop = vind(form, 'button');
  f.verzoeken.length = 0;
  f.antwoord(() => Promise.resolve(antwoord));
  const invoer = '  Bewaar mijn vraag  '; veld.value = invoer;
  const submit = () => form.listeners.submit({ preventDefault() {} });
  await submit();
  const eerste = { ...f.verzoeken[0].body };
  assert.equal(veld.value, invoer); assert.equal(knop.disabled, false);
  assert.equal(form.attrs['aria-busy'], 'false');
  assert.match(f.meldingen.at(-1), /ontvangst is niet bevestigd.*tekst is bewaard.*probeer opnieuw/i);
  assert.ok(f.meldingen.every(x => !/^Verstuurd/.test(x)), 'geen vals succesbericht');
  f.antwoord(() => Promise.resolve({ ok: true, via: 'werklijst', soort: 'vraag', herhaald: true }));
  await submit();
  assert.deepEqual({ ...f.verzoeken[1].body }, eerste, 'retry houdt exact dezelfde opdracht');
  assert.equal(veld.value, ''); assert.match(f.meldingen.at(-1), /^Verstuurd/);
  veld.value = 'Een bewust volgend bericht'; await submit();
  assert.notEqual(f.verzoeken[2].body.idem, eerste.idem, 'alleen bevestigde ontvangst geeft een volgende sleutel vrij');
});

for (const faal of [false, true]) test('oud siteantwoord (' + (faal ? 'fout' : 'succes') +
  ') kan een later geladen site en concept niet vervangen', async () => {
  const f = fixture(), pending = new Map();
  const a = site({ titel: 'Site A', blokken: [{ id: 'form', type: 'formulier', kop: 'Formulier A' }] });
  const b = { ...site({ titel: 'Site B', blokken: [{ id: 'form', type: 'formulier', kop: 'Formulier B' }] }), adres: 'site-b' };
  f.antwoord((url, body) => new Promise((resolve, reject) => pending.set(body.adres, { resolve, reject })));
  const oud = f.toonSite(a.adres), nieuw = f.toonSite(b.adres);
  pending.get(b.adres).resolve({ site: b }); await nieuw;
  const doek = f.doek(), veld = vind(doek, 'textarea'); veld.value = 'Concept voor B';
  if (faal) pending.get(a.adres).reject(new Error('Oude site faalde'));
  else pending.get(a.adres).resolve({ site: a });
  await oud;
  assert.equal(f.doek(), doek); assert.equal(f.document.title, 'Site B · RTG Browser');
  assert.equal(veld.value, 'Concept voor B');
  f.window.innerWidth = 390; f.schilder();
  assert.equal(vind(f.doek(), 'textarea'), veld, 'ook de actieve renderercontext blijft B');
  assert.equal(vind(f.doek(), 'h2').textContent, 'Formulier B');
});

for (const viaTab of [false, true]) for (const faal of [false, true]) test(
  (viaTab ? 'nieuwe tab' : 'Start') + ' maakt oud siteantwoord (' + (faal ? 'fout' : 'succes') + ') ongeldig', async () => {
    const f = fixture(); let resolve, reject;
    f.antwoord(url => url.endsWith('/gids') ? Promise.resolve({ lijst: [] }) :
      new Promise((ja, nee) => { resolve = ja; reject = nee; }));
    let oud;
    if (viaTab) { f.ga({ adres: 'site-a' }); f.nieuwTab(); await Promise.resolve(); }
    else { oud = f.toonSite('site-a'); await f.toonStart(); }
    const zoek = f.document.querySelector('#zoekGroot');
    assert.ok(zoek?.isConnected); assert.equal(f.doek(), null);
    if (faal) reject(new Error('Oude site faalde'));
    else resolve({ site: site({ titel: 'Oude site', blokken: [{ type: 'kop', tekst: 'Oude inhoud' }] }) });
    if (oud) await oud; else await Promise.resolve();
    f.window.innerWidth = 390; f.schilder();
    assert.equal(f.document.querySelector('#zoekGroot'), zoek); assert.equal(zoek.isConnected, true);
    assert.equal(f.doek(), null); assert.notEqual(f.document.title, 'Oude site · RTG Browser');
  });
