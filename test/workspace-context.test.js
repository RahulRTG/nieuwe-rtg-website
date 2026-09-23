/* DE WERKRUIMTECONTEXT IS EEN LEZER VAN HET BLIKVELD (Edge ronde 2, stap 23).

   shared/interface/workspace-context.js had een eigen `current`, een setter, een
   refresh, luisteraars en een eigen ontdubbeling, gevoed uit RTGAdaptief.context():
   een derde contextmodel naast RTGAdaptief en het casco (EDGE.md par. 1,
   vluchtige-context). Nu geeft get() op het moment van vragen vier velden van
   RTGEdgeBlikveld.lees() door, met herkomst, gezag en sinds ongewijzigd.

   DE MUTATIES, elk nagetrokken: overschrijf de herkomst in get() (de
   gelijkheidstoets zakt), zet een cache terug (de toets zonder refresh zakt),
   val terug op RTGAdaptief.context() (de bronscan zakt), en geef bij een
   gooiende clean() de oude kopie terug (de toets 'null met reden' zakt). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const BRON = fs.readFileSync(path.join(__dirname, '..', 'public', 'shared', 'interface', 'workspace-context.js'), 'utf8');

function venster(blikveld) {
  const window = { RTGEdgeBlikveld: blikveld };
  vm.runInNewContext(BRON, { window });
  return window.RTGWorkspaceContext();
}
function veld(waarde, herkomst, gezag, sinds) { return { waarde, herkomst, gezag, sinds }; }
function afdruk(titel) {
  return { versie: 1, op: 1700000000000, gebreken: [], acties: [{ id: 'x' }], velden: {
    identiteit: veld(null, 'geen', 'geen', 5),
    wereld: veld('travel', 'route', 'afgeleid', 7),
    context: veld({ bron: 'reizen.tabs', titel, selectie: false }, 'scherm', 'ui', null),
    object: veld({ soort: 'reis', id: 'r-1' }, 'scherm', 'ui', 3),
    activiteit: Object.assign(veld(null, 'geen', 'geen', 9), { reden: 'het scherm publiceert geen activiteit' }),
    hoofdactie: veld({ label: 'Plan' }, 'scherm', 'ui', 1)
  } };
}

test('get() geeft byte voor byte de vier velden van lees(), met op erbij', () => {
  const b = afdruk('Reizen');
  const ctx = venster({ lees: () => b });
  const uit = ctx.get();
  assert.equal(JSON.stringify(uit), JSON.stringify({ op: b.op, velden: {
    wereld: b.velden.wereld, context: b.velden.context, object: b.velden.object, activiteit: b.velden.activiteit } }));
  assert.ok(!JSON.stringify(uit).includes('autoritatief'), 'de werkruimte verheft niets tot autoritatief');
  assert.deepEqual(Object.keys(ctx), ['get'], 'geen setter, geen refresh, geen luisteraar');
});

test('een tweede get() ziet een wijziging zonder refresh', () => {
  let titel = 'Eerste';
  const ctx = venster({ lees: () => afdruk(titel) });
  assert.equal(ctx.get().velden.context.waarde.titel, 'Eerste');
  titel = 'Tweede';
  assert.equal(ctx.get().velden.context.waarde.titel, 'Tweede');
});

test('ontbrekend, gooiend of onveilig blikveld: velden null, met reden', () => {
  let goed = true;
  const ctx = venster({ lees: () => { if (!goed) throw new Error('stuk'); return afdruk('Goed'); } });
  assert.equal(ctx.get().velden.context.waarde.titel, 'Goed');
  goed = false;
  const gooit = ctx.get();
  assert.equal(gooit.velden, null, 'een gooiend blikveld geeft geen oude kopie');
  assert.match(gooit.reden, /stuk/);

  const zonder = venster(undefined).get();
  assert.equal(zonder.velden, null);
  assert.match(zonder.reden, /niet geladen/);

  const onveilig = venster({ lees: () => { const b = afdruk('x'); b.velden.object.waarde = { token: 'geheim' }; return b; } }).get();
  assert.equal(onveilig.velden, null, 'wat clean() weigert, komt er niet door');
  assert.match(onveilig.reden, /geheimen/);

  let groot = false;
  const w = venster({ lees: () => { const b = afdruk('klein'); if (groot) b.velden.object.waarde = { t: 'x'.repeat(20000) }; return b; } });
  assert.equal(w.get().velden.context.waarde.titel, 'klein');
  groot = true;
  const teGroot = w.get();
  assert.equal(teGroot.velden, null, 'na een goede vraag geeft een geweigerde geen oude kopie');
  assert.match(teGroot.reden, /16 KB/);
});

test('de bron: geen RTGAdaptief, geen setter, geen eigen staat', () => {
  const code = BRON.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(code, /RTGAdaptief/, 'de werkruimte leest het blikveld, niet RTGAdaptief ernaast');
  assert.doesNotMatch(code, /\b(?:set|refresh|subscribe|current|listeners)\b/, 'geen setter, refresh, luisteraar of eigen current');
  assert.match(code, /RTGEdgeBlikveld/);
});
