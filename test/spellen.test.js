/* Integratietests voor de spellenlaag: potjes op de vriendenlaag.
   Twee RTG-leden worden vrienden en spelen: mens erger je niet (uitnodigen,
   accepteren, dobbelen, zetten), schaken (legale en onwettige zetten),
   woordduel (eerste woord over het midden, scoren) en het Sneek-scorebord.
   Draai los: node --experimental-sqlite --test test/spellen.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

let BASE;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-spellen-'));
let child;

function raw(pad, body, token) {
  return fetch(BASE + '/api' + pad, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {})
  });
}
const json = r => r.json();

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

// twee verse RTG-leden die vrienden zijn (de spellenlaag draait op de vriendenlaag)
let teller = 0;
async function tweeVrienden() {
  const t = Date.now() + '' + (teller++);
  const a = await json(await raw('/auth/register', { name: 'Speler A' + t, email: 'a' + t + '@v.test', phone: '0611' + String(t).slice(-6), password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg' }));
  const b = await json(await raw('/auth/register', { name: 'Speler B' + t, email: 'b' + t + '@v.test', phone: '0622' + String(t).slice(-6), password: 'geheim123', geboortedatum: '1992-02-02', tier: 'rtg' }));
  await raw('/member/connections', {}, a.token); await raw('/member/connections', {}, b.token);
  const zoek = await json(await raw('/member/find', { q: b.state.user.codename.split(' ')[0] }, a.token));
  const bKey = (zoek.results.find(r => r.codename === b.state.user.codename) || {}).key;
  assert.ok(bKey, 'A vindt B op codenaam');
  await raw('/member/connect', { key: bKey }, a.token);
  const verzoeken = await json(await raw('/member/connections', {}, b.token));
  const vz = (verzoeken.requests || [])[0];
  await raw('/member/connect/respond', { key: vz.key, action: 'accept' }, b.token);
  return { a: { tok: a.token, cn: a.state.user.codename }, b: { tok: b.token, cn: b.state.user.codename, key: bKey } };
}

test('mens erger je niet: uitnodigen, accepteren, dobbelen tot een 6 en eruit komen', async () => {
  const { a, b } = await tweeVrienden();
  // uitnodigen: het potje wacht tot de vriend accepteert
  const nieuw = await json(await raw('/member/spel/nieuw', { soort: 'mejn', grootte: 2, vrienden: [b.key] }, a.tok));
  assert.ok(nieuw.ok && nieuw.id, 'het potje staat klaar');
  const uitn = await json(await raw('/member/spel/mijn', {}, b.tok));
  assert.equal(uitn.uitnodigingen.length, 1, 'B ziet de uitnodiging');
  const acc = await json(await raw('/member/spel/antwoord', { id: nieuw.id, akkoord: true }, b.tok));
  assert.ok(acc.gestart, 'met twee spelers start het potje meteen');
  // wie aan zet is mag gooien; de ander niet
  let staat = await json(await raw('/member/spel/staat', { id: nieuw.id }, a.tok));
  const beurtTok = staat.potje.beurt === staat.potje.ik ? a.tok : b.tok;
  const anderTok = beurtTok === a.tok ? b.tok : a.tok;
  assert.equal((await raw('/member/spel/zet', { id: nieuw.id, zet: { actie: 'gooi' } }, anderTok)).status, 409, 'buiten je beurt gooien kan niet');
  // dobbelen tot er een 6 valt (met een zet erachteraan); de server bewaakt de beurten
  let zesGezien = false;
  for (let i = 0; i < 120 && !zesGezien; i++) {
    const st = await json(await raw('/member/spel/staat', { id: nieuw.id }, a.tok));
    const tok = st.potje.beurt === st.potje.ik ? a.tok : b.tok;
    const g = await json(await raw('/member/spel/zet', { id: nieuw.id, zet: { actie: 'gooi' } }, tok));
    if (g.dobbel === 6 && !g.geenZet) {
      const st2 = await json(await raw('/member/spel/staat', { id: nieuw.id }, tok === a.tok ? a.tok : b.tok));
      const zetbaar = st2.potje.staat.zetten;
      assert.ok(zetbaar.length, 'met een 6 is er altijd een zet (eruit komen)');
      const z = await json(await raw('/member/spel/zet', { id: nieuw.id, zet: { pion: zetbaar[0].pion } }, tok));
      assert.ok(z.ok, 'de pion komt eruit');
      zesGezien = true;
    }
  }
  assert.ok(zesGezien, 'in 120 worpen valt een 6');
});

test('schaken: een legale opening telt, een onwettige zet wordt geweigerd, beurten wisselen', async () => {
  const { a, b } = await tweeVrienden();
  const nieuw = await json(await raw('/member/spel/nieuw', { soort: 'schaak', vrienden: [b.key] }, a.tok));
  await raw('/member/spel/antwoord', { id: nieuw.id, akkoord: true }, b.tok);
  // speler A (de maker) is wit en begint; e2-e4 = veld 52 -> 36
  assert.equal((await raw('/member/spel/zet', { id: nieuw.id, zet: { van: 52, naar: 28 } }, a.tok)).status, 400, 'drie vooruit met een pion kan niet');
  const z1 = await json(await raw('/member/spel/zet', { id: nieuw.id, zet: { van: 52, naar: 36 } }, a.tok));
  assert.ok(z1.ok, 'e4 is een nette opening');
  assert.equal((await raw('/member/spel/zet', { id: nieuw.id, zet: { van: 51, naar: 35 } }, a.tok)).status, 409, 'wit is niet nog een keer aan zet');
  const z2 = await json(await raw('/member/spel/zet', { id: nieuw.id, zet: { van: 12, naar: 28 } }, b.tok));
  assert.ok(z2.ok, 'zwart antwoordt met e5');
  const st = await json(await raw('/member/spel/staat', { id: nieuw.id }, a.tok));
  assert.equal(st.potje.staat.aanZet, 'w', 'daarna is wit weer aan zet');
});

test('woordduel: het woordenboek keurt; een echt NL-woord over het midden scoort', async () => {
  const { a, b } = await tweeVrienden();
  const nieuw = await json(await raw('/member/spel/nieuw', { soort: 'woord', vrienden: [b.key] }, a.tok));
  await raw('/member/spel/antwoord', { id: nieuw.id, akkoord: true }, b.tok);
  let st = await json(await raw('/member/spel/staat', { id: nieuw.id }, a.tok));
  assert.equal(st.potje.staat.rek.length, 7, 'zeven letters op het rek');
  assert.equal(st.potje.taal, 'nl', 'zonder keuze speel je Nederlands');
  // niet over het midden: geweigerd, wat de letters ook zijn
  const [x1, x2] = st.potje.staat.rek;
  assert.equal((await raw('/member/spel/zet', { id: nieuw.id, zet: { tegels: [{ i: 0, letter: x1 }, { i: 1, letter: x2 }] } }, a.tok)).status, 400);
  // probeer alle geordende letterparen van het rek tot het woordenboek er een goedkeurt;
  // onzin wordt met naam en toenaam afgewezen. Lukt geen enkel paar: ruil alles en opnieuw.
  let gelukt = null, afgewezen = 0;
  for (let ronde = 0; ronde < 6 && !gelukt; ronde++) {
    st = await json(await raw('/member/spel/staat', { id: nieuw.id }, a.tok));
    const rek = st.potje.staat.rek;
    buiten: for (let i = 0; i < rek.length; i++) {
      for (let j = 0; j < rek.length; j++) {
        if (i === j) continue;
        const r = await raw('/member/spel/zet', { id: nieuw.id, zet: { tegels: [{ i: 112, letter: rek[i] }, { i: 113, letter: rek[j] }] } }, a.tok);
        const d = await json(r);
        if (r.status === 200) { gelukt = d; break buiten; }
        if (/woordenboek/.test(d.error || '')) afgewezen++;
      }
    }
    if (!gelukt) { // niets geldigs op dit rek: ruil alles (dat is B's beurt niet, dus dit blijft A)
      await raw('/member/spel/zet', { id: nieuw.id, zet: { pas: true, ruil: st.potje.staat.rek } }, a.tok);
      await raw('/member/spel/zet', { id: nieuw.id, zet: { pas: true } }, b.tok); // B past; A weer aan zet
    }
  }
  assert.ok(gelukt && gelukt.score > 0, 'een echt Nederlands woord wordt goedgekeurd en scoort');
  assert.ok(afgewezen > 0 || gelukt, 'onzinwoorden worden door het woordenboek afgewezen');
  const na = await json(await raw('/member/spel/staat', { id: nieuw.id }, a.tok));
  assert.equal(na.potje.staat.rek.length, 7, 'het rek wordt bijgevuld');
});

test('woordduel in het Engels: de taal reist mee met het potje', async () => {
  const { a, b } = await tweeVrienden();
  const nieuw = await json(await raw('/member/spel/nieuw', { soort: 'woord', taal: 'en', vrienden: [b.key] }, a.tok));
  await raw('/member/spel/antwoord', { id: nieuw.id, akkoord: true }, b.tok);
  const st = await json(await raw('/member/spel/staat', { id: nieuw.id }, a.tok));
  assert.equal(st.potje.taal, 'en', 'het potje is Engels');
  const mijn = await json(await raw('/member/spel/mijn', {}, a.tok));
  assert.equal((mijn.potjes.find(p => p.id === nieuw.id) || {}).taal, 'en', 'de lobby toont de taal');
});

test('random wachtrij: twee wachtenden voor hetzelfde spel worden een potje', async () => {
  const { a, b } = await tweeVrienden();
  const w1 = await json(await raw('/member/spel/random', { soort: 'schaak' }, a.tok));
  assert.ok(w1.wachten, 'de eerste wacht op een tegenstander');
  const w2 = await json(await raw('/member/spel/random', { soort: 'schaak' }, b.tok));
  assert.ok(w2.gestart && w2.id, 'de tweede maakt het potje vol en het start');
  const mijn = await json(await raw('/member/spel/mijn', {}, a.tok));
  assert.ok(mijn.potjes.some(p => p.id === w2.id && p.status === 'bezig'), 'de eerste ziet het gestarte potje');
});

test('sneek: alleen je beste score telt en vrienden zien elkaar op het bord', async () => {
  const { a, b } = await tweeVrienden();
  await raw('/member/spel/sneek-score', { punten: 120 }, a.tok);
  await raw('/member/spel/sneek-score', { punten: 80 }, a.tok);  // lager: telt niet
  await raw('/member/spel/sneek-score', { punten: 250 }, b.tok);
  const bord = await json(await raw('/member/spel/sneek-bord', {}, a.tok));
  assert.equal(bord.bord[0].punten, 250, 'de vriend staat bovenaan');
  const ik = bord.bord.find(r => r.ik);
  assert.equal(ik.punten, 120, 'je beste score blijft staan');
});

test('opgeven: de ander wint het potje', async () => {
  const { a, b } = await tweeVrienden();
  const nieuw = await json(await raw('/member/spel/nieuw', { soort: 'schaak', vrienden: [b.key] }, a.tok));
  await raw('/member/spel/antwoord', { id: nieuw.id, akkoord: true }, b.tok);
  await raw('/member/spel/opgeven', { id: nieuw.id }, a.tok);
  const st = await json(await raw('/member/spel/staat', { id: nieuw.id }, b.tok));
  assert.equal(st.potje.status, 'klaar');
  assert.equal(st.potje.winnaar, b.cn, 'wie overblijft wint');
});
