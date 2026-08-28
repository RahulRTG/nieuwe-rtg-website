/* RTG Klankwerk: van een lus een LIED maken.

   Wat hier getoetst wordt is de belofte "echte liedjes zonder er eerst voor te
   studeren": er komt een VORM uit (intro, couplet, refrein), een ZANGLIJN met
   lettergrepen eronder, en het refrein ligt hoger dan het couplet. En de regel
   die daarbij hoort: RAHUL SCHRIJFT UW WOORDEN NIET. Typt u niets, dan zingt de
   stem open klinkers -- hoorbaar een lege plek, geen verzonnen tekst.
   Draai: node --test test/muziek-lied.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');
const LIED = require('../server/kern/muziek-lied');
const I = require('../server/kern/muziek-instrumenten');

let BASE, child, maker, trackId;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-lied-'));

async function api(pad, body, tok) {
  const headers = { 'Content-Type': 'application/json' };
  if (tok) headers['Authorization'] = 'Bearer ' + tok;
  const r = await fetch(BASE + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const u = String(Date.now()).slice(-8);
  maker = (await api('/api/auth/register', { name: 'Liedschrijver', email: 'li' + u + '@u.test',
    phone: '06' + u, password: 'geheim123', geboortedatum: '1990-03-03', tier: 'rtg' })).body.token;
  assert.ok(maker, 'een lid dat een lied wil maken');
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

/* De lettergrepen zijn een VUISTREGEL en geen woordenboek. Dat mag, want elke
   lettergreep staat in de studio in een eigen veld: wat hier misgaat, verbetert
   de maker met één klik. Wat NIET mag is dat er letters verdwijnen -- dan zingt
   de stem iets anders dan er getypt is. */
test('een zin wordt in lettergrepen geknipt zonder dat er iets verdwijnt', () => {
  assert.deepEqual(LIED.lettergrepen('boven'), ['bo', 'ven']);
  assert.deepEqual(LIED.lettergrepen('zon'), ['zon'], 'één klinkergroep blijft één lettergreep');
  assert.deepEqual(LIED.lettergrepen('haven'), ['ha', 'ven']);
  const zin = 'de zon komt op boven de haven';
  const grepen = LIED.opsplitsen(zin);
  assert.equal(grepen.join(''), zin.replace(/\s/g, ''), 'alle letters komen terug, in dezelfde volgorde');
  assert.ok(grepen.length > zin.split(' ').length, 'meerlettergrepige woorden zijn ook echt gesplitst');
});

test('de vorm past zich aan de lengte aan en maakt nooit een half refrein', () => {
  const kort = LIED.vorm(6);
  const lang = LIED.vorm(26);
  assert.equal(lang.map(s => s.naam).join(' '), 'Intro Couplet Refrein Couplet Refrein Brug Refrein Slot');
  assert.ok(kort.length < lang.length, 'in zes maten past niet hetzelfde als in zesentwintig');
  for (const rij of [kort, lang]) {
    for (const s of rij) assert.ok(s.tot > s.van && s.tot <= 26, 'geen deel valt buiten het stuk');
    for (let i = 1; i < rij.length; i++) {
      assert.equal(rij[i].van, rij[i - 1].tot, 'de delen sluiten op elkaar aan, zonder gat');
    }
  }
});

test('Rahul zet een heel lied neer: vorm, zang, koor en een lege intro', async () => {
  const t = (await api('/api/muziek/maak', { leeg: true, naam: 'Mijn eerste lied' }, maker)).body.track;
  trackId = t.id;
  const r = await api('/api/muziek/rahul', { vraag: 'een warme lounge', lied: true,
    tekst: 'de zon komt op boven de haven', zaad: 4242 }, maker);
  assert.equal(r.status, 200);
  const v = r.body.voorstel;
  assert.equal(r.body.ai, false, 'een lied komt uit de tabellen; de vorm moet over 26 maten kloppen');
  assert.ok(v.secties.length >= 4, 'er is een vorm, geen lus');
  assert.ok(v.secties.some(s => s.naam === 'Refrein'), 'en er zit een refrein in');

  const zang = v.kanalen.find(k => k.instrument === 'zang');
  assert.ok(zang && zang.noten.length, 'er is een zanglijn');
  assert.equal(zang.noten.every(n => typeof n.tekst === 'string' && n.tekst), true,
    'elke zangnoot draagt een lettergreep; een noot zonder woord is een raadsel');
  assert.ok(zang.noten.some(n => n.tekst === 'zon'), 'de getypte zin staat er ook echt onder');

  /* Het enige "hit-trucje" dat we bouwen, en het is eeuwenoud: het refrein ligt
     hoger dan het couplet. Zonder dat verschil blijft een lied vlak. */
  const inDeel = (naam) => {
    const s = v.secties.find(x => x.naam === naam);
    const van = s.van * I.STAPPEN_PER_MAAT, tot = s.tot * I.STAPPEN_PER_MAAT;
    const rij = zang.noten.filter(n => n.stap >= van && n.stap < tot).map(n => n.toon);
    return rij.reduce((a, b) => a + b, 0) / rij.length;
  };
  assert.ok(inDeel('Refrein') > inDeel('Couplet'), 'het refrein ligt hoger dan het couplet');

  const koor = v.kanalen.find(k => k.instrument === 'koor');
  assert.ok(koor && koor.noten.length, 'er zingt een koor mee');
  assert.equal(koor.noten.every(n => n.tekst === 'ooh'), true,
    'het koor zingt open klinkers: een koor dat de tekst meezingt maakt die juist onverstaanbaar');

  // de intro heeft geen trap: een lied dat op volle kracht begint heeft geen opening
  const intro = v.secties.find(s => s.naam === 'Intro');
  const kick = v.kanalen.find(k => k.instrument === 'kick');
  assert.equal((kick.stappen || []).some(p => p < intro.tot * I.STAPPEN_PER_MAAT), false,
    'in de intro staat het slagwerk stil');
});

test('zonder tekst zingt de stem open klinkers, en dat zegt hij er ook bij', async () => {
  const r = await api('/api/muziek/rahul', { vraag: 'club', lied: true, zaad: 9 }, maker);
  const zang = r.body.voorstel.kanalen.find(k => k.instrument === 'zang');
  const open = ['aah', 'ooh', 'oh'];
  assert.equal(zang.noten.every(n => open.includes(n.tekst)), true,
    'Rahul verzint uw woorden niet -- hij laat horen waar ze moeten komen');
  assert.ok(/geen tekst/.test(r.body.voorstel.uitleg), 'en hij zegt erbij dat de woorden nog missen');
});

test('een voorstel zonder lied blijft een lus: geen vorm, geen stem', async () => {
  const r = await api('/api/muziek/rahul', { vraag: 'house', zaad: 3 }, maker);
  const v = r.body.voorstel;
  assert.equal(v.maten <= 4, true, 'een figuur is kort; het is een begin');
  assert.deepEqual(v.secties, [], 'een lus heeft geen coupletten');
  assert.equal(v.kanalen.some(k => k.instrument === 'zang'), false, 'en er zingt niemand');
});

/* De vorm en de lettergrepen moeten de bewaar-poort overleven. Anders maakt
   iemand een lied, sluit de app, en komt terug bij een lus zonder woorden. */
test('vorm en lettergrepen overleven het bewaren', async () => {
  const v = (await api('/api/muziek/rahul', { vraag: 'lounge', lied: true,
    tekst: 'blijf nog even', zaad: 11 }, maker)).body.voorstel;
  const bewaard = (await api('/api/muziek/bewaar', { id: trackId, naam: 'Mijn eerste lied',
    bpm: v.bpm, maten: v.maten, kanalen: v.kanalen, secties: v.secties }, maker)).body.track;
  assert.equal(bewaard.secties.length, v.secties.length, 'de delen staan er nog');
  assert.equal(bewaard.secties[0].naam, v.secties[0].naam);
  const zang = bewaard.kanalen.find(k => k.instrument === 'zang');
  assert.ok(zang.noten.some(n => n.tekst === 'blijf'), 'en de woorden ook');

  // Bij een instrument dat niet zingt is tekst dode last; die hoort er niet te staan.
  const metTekst = await api('/api/muziek/bewaar', { id: trackId, kanalen: [
    { instrument: 'bas', noten: [{ stap: 0, toon: 40, lengte: 4, tekst: 'la' }] }
  ] }, maker);
  assert.equal(metTekst.body.track.kanalen[0].noten[0].tekst, undefined,
    'een bas draagt geen lettergreep: tekst die nooit klinkt is dode last');
});
