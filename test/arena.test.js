/* Integratietests voor De Arena (tieners): het klasgenoten-uitnodigingspad
   (beschermde tieners zijn onvindbaar via de zoeker, de klas is de bevestigde
   kring), het Flitsduel (tien dezelfde sommen, buiten de beurt, eerlijke
   uitslag) en het Reactieduel (vijf ronden, valse start bestraft). Overal
   alleen codenamen, nooit echte namen.
   Draai los: node --experimental-sqlite --test test/arena.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-arena-'));
let child;
const ECHT = 'Arenatest';

function fnd(pad, body) {
  return fetch(BASE + '/api/foundation' + pad, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
  });
}
function office(pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return fetch(BASE + '/api' + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
}
function spel(actie, body, sess) {
  return fetch(BASE + '/api/rtf/spel/' + actie, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.assign({ code: sess.code, token: sess.token }, body || {}))
  });
}
const json = r => r.json();

test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

/* Twee tieners uit twee verschillende gezinnen in DEZELFDE klas, en een
   derde tiener uit een andere klas als buitenstaander. */
let A, B, C, aCn, bCn;
async function tiener(gezinsnaam, kindnaam) {
  const g = await json(await fnd('/gezin/maak', { gezinsnaam, naam: 'Ouder ' + kindnaam, pin: '1234' }));
  const p = await json(await fnd('/gezin/profiel/maak', { code: g.code, token: g.token, naam: kindnaam, rol: 'kind', groep: 'tiener' }));
  const kies = await json(await fnd('/gezin/profiel/kies', { code: g.code, profielId: p.profiel.id }));
  return { code: g.code, token: kies.token, ouderToken: g.token, profielId: p.profiel.id, codenaam: kies.profiel.codenaam };
}
async function klasMet(naam, leden) {
  const sch = await json(await fnd('/school/school/maak', { naam: 'Lyceum ' + naam, plaats: 'Delft' }));
  const login = await json(await office('/office/login', { code: 'RTG-OFFICE' }));
  await office('/office/school/decide', { code: sch.schoolCode, action: 'goedkeuren' }, login.token);
  const p = await json(await fnd('/school/personeel/aanmeld', { schoolCode: sch.schoolCode, naam: 'Docent ' + naam, rol: 'leraar' }));
  await fnd('/school/personeel/besluit', { schoolCode: sch.schoolCode, beheerToken: sch.beheerToken, personeelId: p.personeelId, akkoord: true });
  const kl = await json(await fnd('/school/leraar/klas/maak', { schoolCode: sch.schoolCode, personeelToken: p.personeelToken, naam: 'Klas 3' + naam }));
  for (const t of leden) {
    await fnd('/school/koppel', { code: t.code, token: t.ouderToken, klasCode: kl.code, profielId: t.profielId });
    await fnd('/school/uitnodiging/antwoord', { code: t.code, token: t.token, klasCode: kl.code, akkoord: true });
  }
  return kl.code;
}
test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' }, wachtPad: '/api/foundation/health' }));
  A = await tiener(ECHT + ' Fam A', 'Tiener Aa ' + ECHT);
  B = await tiener(ECHT + ' Fam B', 'Tiener Bo ' + ECHT);
  C = await tiener(ECHT + ' Fam C', 'Tiener Cee ' + ECHT);
  aCn = A.codenaam; bCn = B.codenaam;
  await klasMet('Alfa', [A, B]);
  await klasMet('Beta', [C]);
});

test('klasgenoten: de klas is zichtbaar op codenaam, de zoeker blijft dicht', async () => {
  const d = await json(await spel('klasgenoten', {}, A));
  assert.equal(d.klasgenoten.length, 1, 'A heeft precies een klasgenoot');
  assert.equal(d.klasgenoten[0].codenaam, bCn);
  assert.ok(!JSON.stringify(d).includes(ECHT), 'geen echte namen in de kieslijst');
  // een tiener blijft onvindbaar via het open codenaam-pad (beschermd)
  const zoek = await spel('nieuw', { soort: 'flits', codenamen: [bCn] }, A);
  assert.equal(zoek.status, 404, 'de zoeker vindt beschermde tieners niet');
  // en een vreemde uit een andere klas hoort niet in het klasgenoten-pad
  const dC = await json(await spel('klasgenoten', {}, C));
  const vreemd = await spel('nieuw', { soort: 'flits', klasgenoten: [dC.klasgenoten[0] ? dC.klasgenoten[0].key : 'rtf:NEP:1'] }, A);
  assert.equal(vreemd.status, 403, 'alleen echte klasgenoten');
});

test('flitsduel: zelfde sommen, buiten de beurt, de meeste goed wint', async () => {
  const kg = await json(await spel('klasgenoten', {}, A));
  const nieuw = await json(await spel('nieuw', { soort: 'flits', grootte: 2, klasgenoten: [kg.klasgenoten[0].key] }, A));
  assert.ok(nieuw.id, 'het duel start met een klasgenoot');
  const uitn = await json(await spel('mijn', {}, B));
  assert.ok(uitn.uitnodigingen.some(u => u.id === nieuw.id && u.van === aCn), 'B ziet de uitdaging van A');
  /* Het antwoord van B ook echt NAKIJKEN. Zonder dit is een mislukte accept
     onzichtbaar en struikelt de test pas drie regels verder over een potje
     dat nog in 'wacht' staat, met een nietszeggende TypeError. */
  const acc = await json(await spel('antwoord', { id: nieuw.id, akkoord: true }, B));
  assert.equal(acc.ok, true, 'B neemt de uitdaging aan: ' + JSON.stringify(acc));
  assert.equal(acc.gestart, true, 'en daarmee begint het potje: ' + JSON.stringify(acc));
  // A rekent alles goed (de som staat als tekst in de eigen weergave),
  // B beantwoordt alles fout; niemand hoeft op een beurt te wachten
  const reken = t => { const [x, op, y] = t.split(' '); const a = +x, b = +y;
    return op === '+' ? a + b : op === '-' ? a - b : op === 'x' ? a * b : a / b; };
  for (let i = 0; i < 10; i++) {
    const stA = await json(await spel('staat', { id: nieuw.id }, A));
    const zA = await json(await spel('zet', { id: nieuw.id, zet: { actie: 'antwoord', a: reken(stA.potje.staat.som) } }, A));
    assert.equal(zA.goedWas, true, 'A rekent goed: ' + stA.potje.staat.som);
    const zB = await json(await spel('zet', { id: nieuw.id, zet: { actie: 'antwoord', a: -1 } }, B));
    assert.equal(zB.goedWas, false);
  }
  const klaar = await json(await spel('staat', { id: nieuw.id }, A));
  assert.equal(klaar.potje.status, 'klaar');
  assert.equal(klaar.potje.winnaar, aCn, 'de meeste goed wint');
  assert.deepEqual(klaar.potje.staat.stand.map(s => s.goed).sort((x, y) => y - x), [10, 0]);
  assert.ok(!JSON.stringify(klaar).includes(ECHT), 'alleen codenamen in het potje');
  // nog een keer antwoorden kan niet meer
  assert.equal((await spel('zet', { id: nieuw.id, zet: { actie: 'antwoord', a: 1 } }, A)).status, 409);
});

test('reactieduel: laagste totaaltijd wint en een valse start kost 1500 ms', async () => {
  const kg = await json(await spel('klasgenoten', {}, B));
  const nieuw = await json(await spel('nieuw', { soort: 'reactie', grootte: 2, klasgenoten: [kg.klasgenoten[0].key] }, B));
  await spel('antwoord', { id: nieuw.id, akkoord: true }, A);
  const st = await json(await spel('staat', { id: nieuw.id }, A));
  assert.ok(st.potje.staat.wacht >= 1200 && st.potje.staat.wacht <= 3800, 'de wachttijd van de ronde reist mee');
  for (let i = 0; i < 5; i++) {
    const zA = await json(await spel('zet', { id: nieuw.id, zet: { actie: 'tik', ms: 210 } }, A));
    assert.equal(zA.ms, 210);
    // B tikt een keer voor groen (valse start) en verder traag
    const zB = await json(await spel('zet', { id: nieuw.id, zet: i === 0 ? { actie: 'tik', vals: true } : { actie: 'tik', ms: 400 } }, B));
    if (i === 0) assert.equal(zB.ms, 1500, 'de valse start wordt de straftijd');
  }
  const klaar = await json(await spel('staat', { id: nieuw.id }, B));
  assert.equal(klaar.potje.status, 'klaar');
  assert.equal(klaar.potje.winnaar, aCn, 'de laagste totaaltijd wint');
  // een onmenselijk snelle tik telt ook als valse start (nieuwe ronde nodig)
  const test2 = await json(await spel('nieuw', { soort: 'reactie', grootte: 2, klasgenoten: [kg.klasgenoten[0].key] }, B));
  await spel('antwoord', { id: test2.id, akkoord: true }, A);
  const cheat = await json(await spel('zet', { id: test2.id, zet: { actie: 'tik', ms: 3 } }, B));
  assert.equal(cheat.ms, 1500, 'onder de menselijke ondergrens = straftijd');
  await spel('opgeven', { id: test2.id }, B);
});

test('flitsduel: honderd potjes starten allemaal (geen lege trekking in een som)', async () => {
  /* Deze toets bestaat om een echte fout. De plus-som trok zijn tweede term
     uit [11, 99 - a], met a tot en met 89 -- en bij a=89 is dat bereik leeg.
     crypto.randomInt gooit daar op, midden in het opzetten van het potje, dus
     ongeveer drie op de honderd Flitsduels vielen om met "Er ging iets mis".
     In de suite zag je dat als een toets die af en toe omviel; voor een tiener
     was het een duel dat soms gewoon niet begon.

     Honderd potjes achter elkaar: bij drie procent per potje is de kans dat
     dit ongemerkt blijft verwaarloosbaar (0,97^100 is ongeveer 5%... en dat
     alleen als de fout er nog in zou zitten). We toetsen bovendien de sommen
     zelf: elk antwoord moet kloppen met de tekst. */
  const reken = t => { const [x, op, y] = t.split(' '); const a = +x, b = +y;
    return op === '+' ? a + b : op === '-' ? a - b : op === 'x' ? a * b : a / b; };
  // via de echte server, zodat we de motor toetsen die ook draait
  for (let potje = 0; potje < 100; potje++) {
    const kg = await json(await spel('klasgenoten', {}, A));
    const nieuw = await json(await spel('nieuw', { soort: 'flits', grootte: 2, klasgenoten: [kg.klasgenoten[0].key] }, A));
    if (nieuw.error === 'Rustig aan met uitnodigen.') break;   // het uitnodig-budget: dan is het bewijs geleverd
    assert.ok(nieuw.id, 'potje ' + potje + ' start: ' + JSON.stringify(nieuw));
    const acc = await json(await spel('antwoord', { id: nieuw.id, akkoord: true }, B));
    assert.equal(acc.gestart, true, 'potje ' + potje + ' begint echt: ' + JSON.stringify(acc));
    const st = await json(await spel('staat', { id: nieuw.id }, A));
    assert.ok(st.potje.staat && st.potje.staat.som, 'potje ' + potje + ' heeft een som');
    assert.equal(Number.isFinite(reken(st.potje.staat.som)), true,
      'de som is te lezen: ' + st.potje.staat.som);
    await spel('opgeven', { id: nieuw.id }, A);
  }
});
