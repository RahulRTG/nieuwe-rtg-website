'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { maakLiveTwin } = require('../server/ai-live-twin');
function helperContext(overrides = {}) {
  // De productiehelper bewaart de objectidentiteit in verwijzingen; selectie is leeg.
  const context = { deel: 'Dossier', wereld: 'leven', verwijzingen: [{ soort: 'woning', id: 'woning-a' }],
    werkruimte: { id: 'default', modus: 'workspace', module: 'wonen' }, op: 1_800_000_000_000, ...overrides };
  const window = { RTGEdgeRahulzicht: { lees: () => ({ context }) } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/shared/rahul-tab/helpers.js'), 'utf8'),
    { window, document: { title: 'RTG Wonen', addEventListener() {} } });
  return window.RTGRahulTabHelpers.context();
}
function scherm(beginContext = helperContext()) {
  const nodes = new Map(), html = [];
  let actueel = beginContext;
  const page = { querySelector(sel) {
    if (!nodes.has(sel)) {
      let tekst = '', inhoud = ''; const classes = new Set();
      nodes.set(sel, {
        get textContent() { return tekst; }, set textContent(waarde) { tekst = String(waarde); inhoud = ''; },
        get innerHTML() { return inhoud; }, set innerHTML(waarde) { inhoud = String(waarde); tekst = ''; },
        dataset: {}, classList: {
          toggle(naam, aan) { if (aan) classes.add(naam); else classes.delete(naam); },
          remove(naam) { classes.delete(naam); }, contains(naam) { return classes.has(naam); }
        }, insertAdjacentHTML(_positie, bron) { html.push(bron); }
      });
    }
    return nodes.get(sel);
  } };
  const window = { __rahulTabCommand: { page, context: () => actueel }, RTGRahulTabHelpers: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/shared/rahul-tab/workspace.js'), 'utf8'), { window });
  return { api: window.RTGLiveTwin, html: html.join(''), tekst: sel => page.querySelector(sel).textContent,
    wissel(c) { actueel = c; }, page };
}
test('werkelijke initialisatie claimt geen gecontroleerde policy of twee serverbewijzen', () => {
  const s = scherm();
  assert.doesNotMatch(s.html, /VERIFIED PRE-FLIGHT|2 SERVERBRONNEN|2 controles|class="ok"|Veilige context/);
  assert.match(s.html, /GEEN SERVERRESULTAAT/);
  assert.match(s.html, /nog te controleren/);
  assert.equal(s.tekst('[data-flow-context]'), 'Wonen');
});
test('echte antwoordvelden worden getoond; bronvermelding is niet automatisch een geslaagde controle', () => {
  const s = scherm(); s.api.denkt(true);
  s.api.toon({ liveTwin: { status: 'voorbereid', bronnen: [{ label: 'Rol', status: 'ontbreekt' }, { label: 'Route' }], uitvoering: { status: 'niet-uitgevoerd' } } });
  s.api.denkt(false);
  assert.equal(s.tekst('[data-proof-count]'), '2 BRONVERMELDINGEN');
  assert.equal(s.tekst('[data-twin-state]'), 'VOORBEREID');
  assert.match(s.page.querySelector('[data-proof-list]').innerHTML, /ontbreekt/);
  assert.match(s.page.querySelector('[data-proof-list]').innerHTML, /status niet opgegeven/);
  assert.doesNotMatch(s.page.querySelector('[data-proof-list]').innerHTML, /bevestigd/);
  s.api.bevestigd({ ok: true });
  assert.equal(s.tekst('[data-decision-state]'), 'SERVER BEVESTIGD');
});
test('fout, ontbrekend antwoord en nieuwe context wissen eerdere geruststellende status', () => {
  for (const faal of [s => { s.api.denkt(true); s.api.denkt(false); },
    s => s.api.toon({ error: 'mislukt', liveTwin: { status: 'bevestigd' } }),
    s => s.api.toon({}), s => s.api.bevestigd({ ok: false }),
    s => s.api.bevestigd({ ok: 'true' }), s => s.api.bevestigd({ ok: true, error: 'mislukt' }),
    s => s.api.context({ app: 'Ander' })]) {
    const s = scherm(); s.api.bevestigd({ ok: true }); faal(s);
    assert.equal(s.tekst('[data-decision-state]'), 'UITKOMST NIET BEVESTIGD');
    assert.equal(s.tekst('[data-proof-count]'), 'GEEN SERVERRESULTAAT');
    assert.equal(s.tekst('[data-decision-execution]'), 'niet bevestigd');
  }
});

const oudeClaimVelden = ['[data-live-next]', '[data-live-watch]', '[data-twin-reason]',
  '[data-decision-title]', '[data-one-decision]'];
function bevestigdVoorstel(s, context = helperContext()) {
  s.api.toon({ liveTwin: maakLiveTwin({ vraag: 'Bereid de betaling voor', context, wereld: 'member',
    actor: 'actor-a', gedaan: false, goedkeuringen: [{ id: 'voorstel-a' }] }) });
  assert.equal(s.tekst('[data-decision-state]'), 'UW AKKOORD NODIG');
  assert.equal(s.page.querySelector('.rtg-one').classList.contains('attention'), true);
  s.api.bevestigd({ ok: true });
  assert.equal(s.tekst('[data-decision-state]'), 'SERVER BEVESTIGD');
  return new Map(oudeClaimVelden.map(sel => [sel, s.tekst(sel)]));
}
function geenActueelResultaat(s, oudeClaims) {
  assert.equal(s.tekst('[data-twin-state]'), 'GEEN ACTUEEL SERVERRESULTAAT');
  assert.equal(s.tekst('[data-decision-state]'), 'UITKOMST NIET BEVESTIGD');
  assert.equal(s.tekst('[data-proof-count]'), 'GEEN SERVERRESULTAAT');
  assert.equal(s.tekst('[data-decision-execution]'), 'niet bevestigd');
  assert.equal(s.page.querySelector('.rtg-twin').dataset.liveStatus, 'onbevestigd');
  assert.equal(s.page.querySelector('.rtg-one').classList.contains('attention'), false);
  assert.doesNotMatch(s.page.querySelector('[data-proof-list]').innerHTML, /actor-a|voorstel-a/);
  for (const [sel, oud] of oudeClaims) {
    assert.ok(oud, sel + ' droeg een echte eerdere serverclaim');
    assert.notEqual(s.tekst(sel), oud, sel + ' mag de oude claim niet behouden');
  }
}
test('bevestigd voorstel gevolgd door een mislukte nieuwe vraag wist ook gevolgtekst en voorstelknop', () => {
  for (const fout of [s => s.api.toon({ error: 'Serverantwoord ontbreekt' }), () => {}]) {
    const s = scherm(), oudeClaims = bevestigdVoorstel(s);
    s.api.denkt(true);
    fout(s); // Geen toon() bij netwerkuitval: de caller sluit dan alleen denkt af.
    s.api.denkt(false);
    geenActueelResultaat(s, oudeClaims);
    assert.equal(s.page.querySelector('.rtg-twin').classList.contains('werkt'), false);
  }
});
test('een laat antwoord voor object A wordt na objectwissel B geweigerd, het antwoord voor B wel getoond', () => {
  const a = helperContext(), b = helperContext({ verwijzingen: [{ soort: 'woning', id: 'woning-b' }] });
  assert.equal(a.selectie, ''); assert.equal(b.selectie, '');
  assert.equal(a.app, b.app); assert.equal(a.deel, b.deel);
  const s = scherm(a), oudeClaims = bevestigdVoorstel(s, a);
  s.api.context(helperContext({ op: a.op + 1 }));
  assert.equal(s.tekst('[data-decision-state]'), 'SERVER BEVESTIGD', 'een nieuw leesmoment verandert het object niet');
  s.wissel(helperContext({ op: a.op + 1 }));
  assert.equal(s.api.pastBij(a), true);
  s.wissel(b); // De caller is al op B; de laatst gerenderde context is nog A.
  assert.equal(s.api.pastBij(a), false);
  assert.equal(s.api.pastBij(b), true);
  const antwoord = c => ({ liveTwin: maakLiveTwin({ vraag: 'Wat vraagt aandacht?', context: c, wereld: 'member' }) });
  assert.equal(s.api.toon(antwoord(a), a), false);
  geenActueelResultaat(s, oudeClaims);
  assert.notEqual(s.tekst('[data-intent-context]'), a.deel, 'de oude context is ook gewist');
  s.api.context(b);
  geenActueelResultaat(s, oudeClaims);
  assert.equal(s.api.toon(antwoord(b), b), true);
  s.api.denkt(false);
  assert.equal(s.tekst('[data-twin-state]'), 'VOORBEREID');
});
test('een andere actieve werkruimtemodule neemt het eerdere resultaat niet over', () => {
  const a = helperContext(), b = helperContext({ werkruimte: { ...a.werkruimte, module: 'travel' } });
  assert.equal(a.app, b.app); assert.equal(a.deel, b.deel); assert.equal(a.selectie, b.selectie);
  const s = scherm(a), oudeClaims = bevestigdVoorstel(s, a);
  s.api.context(b);
  geenActueelResultaat(s, oudeClaims);
});
test('clear bij actorwissel wist alle resultaatclaims en oude zichtbare context', () => {
  const a = helperContext(), s = scherm(a), oudeClaims = bevestigdVoorstel(s, a);
  const contextVelden = ['[data-intent-context]', '[data-intent-goal]', '[data-flow-context]'];
  const oudeContext = contextVelden.map(sel => [sel, s.tekst(sel)]);
  assert.equal(typeof s.api.clear, 'function');
  s.api.clear();
  geenActueelResultaat(s, oudeClaims);
  for (const [sel, oud] of oudeContext) assert.notEqual(s.tekst(sel), oud, sel + ' mag geen context van de vorige actor tonen');
  s.api.denkt(false);
  geenActueelResultaat(s, oudeClaims);
  s.api.context(helperContext());
  assert.equal(s.tekst('[data-intent-context]'), 'Dossier');
  assert.equal(s.tekst('[data-flow-context]'), 'Wonen');
  assert.equal(s.tekst('[data-decision-state]'), 'UITKOMST NIET BEVESTIGD', 'dezelfde schermcontext herstelt geen bewijs van de vorige actor');
});
test('een numerieke bronsoort rendert veilig via de bestaande toon zonder broncontext', () => {
  const s = scherm();
  assert.doesNotThrow(() => s.api.toon({ liveTwin: { status: 'voorbereid',
    bronnen: [{ soort: 7, label: '<bron>', detail: '<melding>' }] } }));
  s.api.denkt(false);
  const html = s.page.querySelector('[data-proof-list]').innerHTML;
  assert.match(html, /<i>7<\/i>/);
  assert.match(html, /&lt;bron&gt;/); assert.match(html, /&lt;melding&gt;/);
  assert.equal(s.tekst('[data-twin-state]'), 'VOORBEREID');
});
test('een mislukte DOM-render blijft geen actueel resultaat wanneer denkt eindigt', () => {
  const s = scherm(), oudeClaims = bevestigdVoorstel(s);
  s.api.denkt(true);
  const lijst = s.page.querySelector('[data-proof-list]');
  const descriptor = Object.getOwnPropertyDescriptor(lijst, 'innerHTML');
  Object.defineProperty(lijst, 'innerHTML', { configurable: true, set() { throw new Error('renderfout'); } });
  assert.throws(() => s.api.toon({ liveTwin: { status: 'uitgevoerd-en-gelogd',
    uitvoering: { status: 'bevestigd' }, bronnen: [{ soort: 'serverregel' }] } }), /renderfout/);
  Object.defineProperty(lijst, 'innerHTML', descriptor);
  s.api.denkt(false);
  geenActueelResultaat(s, oudeClaims);
});
