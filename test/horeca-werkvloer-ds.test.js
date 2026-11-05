'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const read = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const modules = ['bar', 'vloer', 'vloer-aanbod', 'vloer-indelen'];
const tick = () => new Promise(resolve => setImmediate(resolve));

test('Bar en Vloer vervangen presentatie en behouden fonts, deur en alle bestaande owners', () => {
  for (const name of ['bar', 'vloer']) {
    const html = read('public/apps/horeca-' + name + '.html');
    assert.match(html, /<html lang="nl" data-ds>/);
    assert.match(html, /data-rtg-world="work"/);
    assert.match(html, /data-ds-nadruk="gereedschap"/);
    assert.deepEqual([...html.matchAll(/<link[^>]*href="([^"]+\.css)"/g)].map(m => m[1]), ['/fonts/fonts.css', '/ds/rtg-ds.css']);
    assert.doesNotMatch(html, /<style\b|style="/);
    assert.ok(html.indexOf('/ds/shell.js') < html.indexOf('/shared/rtg-world-desktop.js'));
    for (const src of ['id', 'stroom', 'deur', 'schermbeeld', 'metgezel', 'basis', 'bediening', 'randen', 'volscherm', 'cookie', 'sneltoets', 'ios', 'workos-premium'])
      assert.ok(html.includes('/shared/' + src + '.js'), name + ': ' + src);
    assert.match(html, /id="main"/); assert.match(html, /id="melding" role="status"/);
    assert.match(html, /href="\/apps\/horeca.html"/);
    for (const src of ['kern', ...(name === 'bar' ? ['edge', 'bar'] : ['vloer', 'vloer-aanbod', 'vloer-indelen'])])
      assert.ok(html.includes('/apps/horeca/' + src + '.js'), src);
    if (name === 'bar') assert.ok(html.includes('/shared/wachtrij.js'));
  }
});

test('werkvloercomponent gebruikt bestaande tokens, leesbare toestanden en herbruikbare DS-bediening', () => {
  const css = read('public/ds/componenten/horeca-werkvloer.css'), tokens = read('public/ds/tokens.css');
  for (const m of css.matchAll(/var\((--ds-[\w-]+)/g)) assert.ok(tokens.includes(m[1] + ':'), m[1]);
  assert.match(css, /@layer rtg.component/);
  assert.doesNotMatch(css, /!important|#[\da-f]{3,8}\b|(?:padding|margin|border)-(?:left|right)\s*:/i);
  assert.match(css, /\.ds-horeca-barregels li[\s\S]*?font-size: var\(--ds-maat-tekst\)/);
  assert.match(css, /min-block-size: var\(--ds-doel\)/);
  assert.match(css, /\.ds-horeca-werkkaart:is\(\.wacht,\.los,\.over\)/);
  assert.match(css, /flex-wrap: wrap/);
  for (const name of modules) assert.ok(Buffer.byteLength(read('public/apps/horeca/' + name + '.js')) < 10240, name);
});

function fixture(data, allowed = true) {
  const nodes = {}, binds = {}, calls = [], messages = [], scopes = [], queued = [];
  function node(id) {
    return nodes[id] ||= { id, innerHTML: '', textContent: '', hidden: true, value: '',
      addEventListener(type, fn) { this[type] = fn; }, querySelectorAll() { return []; } };
  }
  const c = { document: { getElementById: node }, localStorage: { getItem: () => 'eigen-zaak' }, RTGId: () => 'bar-proef' };
  c.window = c;
  vm.createContext(c); vm.runInContext(read('public/apps/horeca/kern.js'), c);
  const K = c.RTGHoreca;
  K.poort = () => allowed;
  K.api = async (url, body) => { calls.push({ url, body }); return { body: data }; };
  K.meld = s => messages.push(s);
  K.luister = scope => scopes.push(scope);
  K.bind = (root, key, fn) => { binds[root.id + ':' + key] = fn; };
  c.RTGHorecaEdge = { zetHandeling(token, fn) { assert.equal(token, 'eigen-zaak'); this.stand = fn; }, handel: async b => { queued.push(b); return { gewacht: true }; } };
  return { c, nodes, node, binds, calls, messages, scopes, queued, run(name) { vm.runInContext(read('public/apps/horeca/' + name + '.js'), c); } };
}

test('werkelijke Bar-renderer behoudt stoel/allergie, expliciete rijstatus en dezelfde offline handeling', async () => {
  const f = fixture({ open: 2, staat: 1, let: 'Geen gemeten grens.', stapel: [{ aantal: 2, naam: '<Gin>', tafels: ['A'] }], golven: [{ tafel: 'A', rekeningId: 'r1', gang: 1, sinds: 3, staat: 1, regels: [{ aantal: 2, naam: '<Gin>', stoel: 'raam', allergie: '<kinine>', notitie: 'zonder ijs', regelId: 'g1', stand: 'besteld' }] }] });
  f.run('bar'); await tick();
  assert.match(f.node('bStapel').innerHTML, /2x &lt;Gin&gt;/);
  assert.match(f.node('bGolvenLijst').innerHTML, /ds-horeca-werkkaart wacht/);
  assert.match(f.node('bGolvenLijst').innerHTML, /raam[\s\S]*&lt;kinine&gt;[\s\S]*zonder ijs/);
  assert.match(f.node('bGolvenLijst').innerHTML, /data-zet="g1" data-rek="r1" data-naar="gestart">Aanzetten/);
  assert.doesNotMatch(f.node('bGolvenLijst').innerHTML, /<kinine>|<Gin>/);
  f.c.RTGHorecaEdge.stand({ wacht: 1, vast: 1 });
  assert.equal(f.node('bEdgeStrook').hidden, false);
  assert.match(f.node('bEdgeStrook').textContent, /op dit toestel[\s\S]*server wilde ze niet/);
  f.binds['bGolvenLijst:zet']({ getAttribute: k => ({ 'data-rek': 'r1', 'data-zet': 'g1', 'data-naar': 'gestart' })[k] });
  await tick();
  assert.deepEqual(JSON.parse(JSON.stringify(f.queued)), [{ clientId: 'bar-proef', soort: 'stand', rekeningId: 'r1', regelId: 'g1', naar: 'gestart' }]);
  assert.match(f.messages[0], /Geen lijn/);
  f.c.RTGHorecaEdge.stand({ wacht: 0, vast: 0 });
  assert.equal(f.node('bEdgeStrook').hidden, true);
  assert.deepEqual(f.scopes, ['keuken', 'horeca']);
});

test('werkelijke Vloer-renderer behoudt verantwoordelijkheid, halve overdracht en managergrens', async () => {
  const data = { wijken: [{ id: 'w', naam: '<Serre>', taken: 2, nu: 1, vanMij: true, van: { naam: 'Ada' }, tafels: ['A', 'B'], uitgeleend: [{ tafel: 'B', naam: 'Bo' }], uit: 1 }], overdrachten: [{ id: 'o', wijkId: 'w', wijkNaam: '<Serre>', vanNaam: 'Ada', naarNaam: 'Bo', tafels: ['A'], voorMij: true, staat: 2 }], antwoorden: [], leningen: [], ploeg: [], magIndelen: false };
  const f = fixture(data);
  f.run('vloer-aanbod'); f.run('vloer-indelen'); f.run('vloer'); await tick();
  assert.match(f.node('vWijken').innerHTML, /&lt;Serre&gt;/);
  assert.match(f.node('vWijken').innerHTML, /Ada draagt deze wijk/);
  assert.match(f.node('vWijken').innerHTML, /B staat bij Bo/);
  assert.match(f.node('vWijken').innerHTML, /A aangeboden aan Bo/);
  assert.match(f.node('vVoorMij').innerHTML, /Tot u het aanvaardt, draagt Ada het nog/);
  assert.match(f.node('vVoorMij').innerHTML, /class="ds-invoer"[^>]+data-reden="o"/);
  assert.equal(f.node('vIndeel').hidden, true);
  f.c.RTGVloerIndeel.teken({ ...data, magIndelen: true, tafels: ['A'] }, () => {});
  assert.equal(f.node('vIndeel').hidden, false);
  f.node('vNieuw').click();
  const form = f.node('vVorm').innerHTML;
  f.node('vNaam').value = 'Concept';
  f.c.RTGVloerIndeel.teken({ ...data, magIndelen: true }, () => {});
  assert.equal(f.node('vVorm').innerHTML, form);
  assert.equal(f.node('vNaam').value, 'Concept');
  assert.deepEqual(f.scopes, ['horeca', 'keuken']);
});

test('zonder zaaktoegang beginnen de vier domeinowners geen API of queue', async () => {
  const f = fixture({}, false);
  for (const name of modules) f.run(name);
  await tick();
  assert.deepEqual(f.calls, []); assert.deepEqual(f.queued, []); assert.deepEqual(f.scopes, []);
  assert.equal(f.c.RTGHorecaEdge.stand, undefined);
});
