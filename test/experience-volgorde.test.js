/* DE PERSOONLIJKE VOLGORDE -- kern/experience/volgorde.js.

   Besluit van de eigenaar (11 oktober 2026): neigingen mogen de volgorde in een
   projectie beinvloeden, en verder niets. Wat hier wordt vastgehouden zijn de
   vijf regels uit de kop van die module:

   1. alleen `gezegd` en `gekozen`; `afgeleid` verschuift nooit iets,
   2. een stabiele tweedeling en geen score -- twee neigingen op een object
      maken het niet "belangrijker",
   3. er verdwijnt niets,
   4. elke verschuiving draagt haar reden in woorden,
   5. een tab-adres (/apps/app.html#tab=...) raakt niet elk object op de schil.

   En tegen een echte server: wie een neiging ZEGT, krijgt dezelfde objecten
   terug met een uitleg erbij, en de hash van de projectie blijft die van de
   domeinvolgorde -- de volgorde is presentatie. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { persoonlijk, ADRES } = require('../server/kern/experience/volgorde');
const { zonderCommentaar } = require('../scripts/lib/bron');

const obj = (id, deepLink) => ({ ref: { id }, title: id, deepLink });
const RIJ = [obj('a', '/apps/geld.html#x'), obj('b', '/apps/vluchten.html'), obj('c', '/apps/agenda.html'),
  obj('d', '/apps/vluchten.html?van=1')];
const hulp = {
  wijstVan: (o) => ({ 'reizen:vliegen': ['vluchten'], agenda: ['agenda'] })[o] || [],
  adresVan: (s) => ({ vluchten: '/apps/vluchten.html', agenda: '/apps/agenda.html' })[s] || null,
  labelVan: (o) => ({ 'reizen:vliegen': 'verder weg', agenda: 'je agenda' })[o] || null
};
const n = (onderwerp, grond) => ({ onderwerp, grond, telt: true });

test('1. alleen gezegd en gekozen tellen; afgeleid verschuift niets', () => {
  const afgeleid = persoonlijk(RIJ, [n('reizen:vliegen', 'afgeleid')], hulp);
  assert.deepEqual(afgeleid.objects.map(o => o.ref.id), ['a', 'b', 'c', 'd'],
    'een vermoeden van RTG veranderde wat een lid als eerste ziet');
  assert.equal(afgeleid.persoonlijk, false);
  const gezegd = persoonlijk(RIJ, [n('reizen:vliegen', 'gezegd')], hulp);
  assert.deepEqual(gezegd.objects.map(o => o.ref.id), ['b', 'd', 'a', 'c']);
  /* Een neiging die niet meer telt (vervallen of geweigerd), telt ook hier niet. */
  const vervallen = persoonlijk(RIJ, [{ onderwerp: 'reizen:vliegen', grond: 'gezegd', telt: false }], hulp);
  assert.equal(vervallen.persoonlijk, false);
});

test('2. een stabiele tweedeling: geen score, geen optelling', () => {
  /* Twee neigingen raken samen drie objecten; de volgorde ONDER die drie blijft
     die van de domeinen, wie er ook meer neigingen heeft. */
  const r = persoonlijk(RIJ, [n('agenda', 'gekozen'), n('reizen:vliegen', 'gezegd')], hulp);
  assert.deepEqual(r.objects.map(o => o.ref.id), ['b', 'c', 'd', 'a']);
  const code = zonderCommentaar(fs.readFileSync(path.join(__dirname, '..', 'server', 'kern', 'experience',
    'volgorde.js'), 'utf8'));
  assert.doesNotMatch(code, /\.sort\(|score|gewicht|weging/i, 'de volgorde wordt op een getal bepaald');
});

test('3. er verdwijnt niets, en 4. elke verschuiving zegt waarom', () => {
  const r = persoonlijk(RIJ, [n('reizen:vliegen', 'gezegd'), n('agenda', 'gekozen')], hulp);
  assert.equal(r.objects.length, RIJ.length);
  assert.deepEqual(r.objects.map(o => o.ref.id).slice().sort(), RIJ.map(o => o.ref.id).slice().sort());
  for (const o of r.objects.filter(x => ['b', 'c', 'd'].includes(x.ref.id)))
    assert.match(o.reden || '', /zelf zei|vaker koos/, o.ref.id + ' kwam naar voren zonder reden');
  assert.equal(r.objects.find(o => o.ref.id === 'a').reden, undefined, 'een object dat niet verschoof kreeg een reden');
  assert.match(r.objects.find(o => o.ref.id === 'b').reden, /zelf zei dat verder weg/);
  assert.match(r.objects.find(o => o.ref.id === 'c').reden, /vaker koos/);
  assert.match(r.uitleg, /niets weggelaten/);
});

test('5. een tab of os-app staat niet in de adreskaart', () => {
  const idx = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'shared', 'sprongindex.json'), 'utf8'));
  const zonderUrl = idx.items.filter(i => ['tab', 'os'].includes(i.soort));
  assert.ok(zonderUrl.length, 'de sprongindex heeft geen tabs meer; dan toetst dit niets');
  for (const i of zonderUrl) if (ADRES.has(i.sleutel))
    assert.notEqual(ADRES.get(i.sleutel), i.url, 'het adres van een tab raakt elk object op de app-schil');
  for (const [, url] of ADRES) assert.doesNotMatch(url, /^\/apps\/app\.html/, 'de app-schil staat in de adreskaart');
});

test('6. tegen een echte server: dezelfde objecten, een uitleg erbij, en de hash blijft', async () => {
  const wegwerp = require('../scripts/lib/wegwerpserver');
  const srv = await wegwerp.start({ naam: 'experience-volgorde', gereed: 'ready', env: { NODE_ENV: 'test' } });
  const post = async (pad, lijf, tok) => {
    const r = await fetch(srv.basis + pad, { method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
      body: JSON.stringify(lijf || {}) });
    return { status: r.status, data: await r.json().catch(() => null) };
  };
  try {
    const u = String(Date.now()).slice(-8);
    const reg = await post('/api/auth/register', { name: 'Volgorde ' + u, email: 'volgorde' + u + '@voorbeeld.nl',
      phone: '06' + u, password: 'geheim12345', geboortedatum: '1985-05-05', tier: 'rtg' });
    assert.equal(reg.status, 200);
    const tok = reg.data.token;
    const voor = await post('/api/experience/projection', { world: 'living' }, tok);
    assert.equal(voor.status, 200, JSON.stringify(voor.data).slice(0, 200));
    assert.equal(voor.data.ordering.personal, false);
    assert.match(voor.data.ordering.explanation, /geen gezegde of gekozen voorkeur/);

    const zeg = await post('/api/neiging/antwoord', { vraag: 'tijd', onderwerpen: ['reizen', 'mensen', 'geven'] }, tok);
    assert.equal(zeg.status, 200, JSON.stringify(zeg.data).slice(0, 200));
    assert.ok(zeg.data.opgeslagen >= 1, 'de neiging werd niet bewaard; dan meet de rest niets');

    const na = await post('/api/experience/projection', { world: 'living' }, tok);
    assert.equal(na.status, 200);
    const ids = (p) => p.objects.map(o => o.ref.id).sort();
    assert.deepEqual(ids(na.data), ids(voor.data), 'een neiging liet een object verdwijnen of ontstaan');
    assert.equal(na.data.snapshotHash, voor.data.snapshotHash,
      'de hash bewoog door een voorkeur; dan is de volgorde geen presentatie meer maar een andere werkelijkheid');
    assert.equal(typeof na.data.ordering.explanation, 'string');
    assert.ok(na.data.ordering.explanation.length > 20, 'de volgorde draagt geen uitleg');
    for (const o of na.data.objects) if (o.reden) assert.match(o.reden, /zelf zei|vaker koos/);
  } finally { srv.klaar(); }
});
