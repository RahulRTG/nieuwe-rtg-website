'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const lees = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const rooms = [
  { naam: 'project-room', begin: 'var bewijsOpener', form: 'bewijsForm', open: 'openBewijs', dicht: 'sluitBewijs', binnen: 'prBewijsMelding', buiten: 'prMelding' },
  { naam: 'decision-room', begin: 'var intakeIdem', form: 'intake', open: 'openIntake', dicht: 'sluitIntake', binnen: 'drIntakeMelding', buiten: 'drMelding' }
];
function snede(s, van, tot) {
  const begin = s.indexOf(van), eind = s.indexOf(tot, begin);
  assert.ok(begin >= 0 && eind > begin, van + ': echte ownerfunctie moet aanwezig zijn');
  return s.slice(begin, eind);
}
function owner(r) {
  const s = lees('public/apps/' + r.naam + '.js');
  const binnen = { hidden: true, textContent: '' }, buiten = { hidden: true, textContent: '' };
  const timers = new Map(), elements = {};
  let klokId = 0, submit, api;
  for (const naam of ['titel', 'documentId', 'documentTitel', 'projectId', 'bronMailId', 'omkeerbaar']) elements[naam] = { value: '', checked: false, focus() {} };
  const form = { elements, reset() { for (const e of Object.values(elements)) e.value = ''; }, addEventListener(event, fn) { assert.equal(event, 'submit'); submit = fn; } };
  const laag = { open: false, showModal() { this.open = true; }, close() { this.open = false; } };
  const c = {
    laag, d: { activeElement: { isConnected: true, focus() {} }, getElementById(id) { assert.ok([r.binnen, r.buiten].includes(id)); return id === r.binnen ? binnen : buiten; } },
    w: { RTGId: () => 'bewuste-intake', setTimeout(fn) { timers.set(++klokId, fn); return klokId; }, clearTimeout(id) { timers.delete(id); } },
    params: new URLSearchParams(), gekozen: () => ({ id: 'bestaand-project' }), gekozenId: '', huis: 'rtg',
    [r.form]: form, FormData: class { forEach(fn) { fn(elements.titel.value, 'titel'); } },
    api: (...args) => api(...args), vervang() {}, teken() {}, laad: async () => {}, open() {}
  };
  vm.createContext(c);
  vm.runInContext(snede(s, 'function melding(', '  async function persoonlijkToken') + '\n' +
    snede(s, r.begin, "  root.addEventListener('click'") + '\n' +
    snede(s, r.form + ".addEventListener('submit'", "  root.addEventListener('submit'"), c);
  return { c, binnen, buiten, elements, timers, open: () => c[r.open](), dicht: () => c[r.dicht](),
    submit: () => submit({ preventDefault() {}, submitter: { disabled: false } }),
    api(fn) { api = fn; }, tick() { const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn()); } };
}
for (const r of rooms) {
  test(r.naam + ': foutstatus staat binnen de native dialoog, gewone status blijft buiten', () => {
    const html = lees('public/apps/' + r.naam + '.html');
    const dialog = html.match(/<dialog\b[^>]*>[\s\S]*?<\/dialog>/)[0];
    assert.ok(dialog.includes('id="' + r.binnen + '" role="alert" hidden'));
    assert.ok(!dialog.includes('id="' + r.buiten + '"'));
  });
  test(r.naam + ': dialoogfout blijft bestaan na de gewone meldingstimer en dubbel openen', () => {
    const o = owner(r);
    o.c.melding('Bestaande paginamelding'); assert.equal(o.timers.size, 1);
    o.open(); o.elements.titel.value = 'Bewaard concept'; o.c.melding('Opslaan geweigerd');
    assert.equal(o.binnen.textContent, 'Opslaan geweigerd'); assert.equal(o.binnen.hidden, false);
    assert.equal(o.timers.size, 1, 'de fout krijgt geen verdwijnklok');
    o.tick(); assert.equal(o.buiten.hidden, true); assert.equal(o.binnen.hidden, false);
    o.open(); assert.equal(o.binnen.textContent, 'Opslaan geweigerd'); assert.equal(o.elements.titel.value, 'Bewaard concept');
    o.dicht(); assert.equal(o.binnen.hidden, true); assert.equal(o.binnen.textContent, '');
    o.open(); assert.equal(o.binnen.hidden, true);
    o.dicht(); o.c.melding('Gewone terugkoppeling'); assert.equal(o.buiten.hidden, false); o.tick(); assert.equal(o.buiten.hidden, true);
  });
  test(r.naam + ': echte submitcatch meldt binnen, behoudt invoer en wist alleen bij nieuwe poging', async () => {
    const o = owner(r); o.open(); o.elements.titel.value = 'Onopgeslagen voorstel';
    o.api(async () => { throw Error('De bevoegdheid is ingetrokken.'); });
    await o.submit(); assert.equal(o.binnen.hidden, false); assert.equal(o.binnen.textContent, 'De bevoegdheid is ingetrokken.');
    assert.equal(o.elements.titel.value, 'Onopgeslagen voorstel'); o.tick(); assert.equal(o.binnen.hidden, false);
    let weiger;
    o.api(() => new Promise((resolve, reject) => { weiger = reject; }));
    const pending = o.submit(); assert.equal(o.binnen.hidden, true); assert.equal(o.binnen.textContent, '');
    assert.equal(o.elements.titel.value, 'Onopgeslagen voorstel');
    weiger(Error('Nog steeds niet toegestaan.')); await pending;
    assert.equal(o.binnen.textContent, 'Nog steeds niet toegestaan.'); assert.equal(o.binnen.hidden, false);
    assert.equal(o.buiten.hidden, true, 'geen onbereikbare body-toast voor de dialoogfout');
  });
}
