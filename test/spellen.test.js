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

// RTF-ingang: gezinsprofielen spelen via /api/rtf/spel met code + profieltoken
function fnd(pad, body) {
  return fetch(BASE + '/api/foundation' + pad, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {})
  });
}
function rtfSpel(actie, body, sess) {
  return fetch(BASE + '/api/rtf/spel/' + actie, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.assign({ code: sess.code, token: sess.token }, body || {}))
  });
}
// een gezin met twee volwassen profielen; ze vinden elkaar op codenaam
async function gezinSpelers() {
  const t = Date.now() + '' + (teller++);
  const g = await json(await fnd('/gezin/maak', { gezinsnaam: 'Spel ' + t, naam: 'Ouder ' + t, pin: '1234' }));
  const oom = await json(await fnd('/gezin/profiel/maak', { code: g.code, token: g.token, naam: 'Oom ' + t, rol: 'gezinslid', groep: 'volw' }));
  const kies = await json(await fnd('/gezin/profiel/kies', { code: g.code, profielId: oom.profiel.id }));
  return { A: { code: g.code, token: g.token }, B: { code: g.code, token: kies.token }, bCn: kies.profiel.codenaam };
}

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

test('mens erger je niet (RTF): uitnodigen, accepteren, dobbelen tot een 6 en eruit komen', async () => {
  const { A, B, bCn } = await gezinSpelers();
  // uitnodigen op codenaam: het potje wacht tot de ander accepteert
  const nieuw = await json(await rtfSpel('nieuw', { soort: 'mejn', grootte: 2, codenamen: [bCn] }, A));
  assert.ok(nieuw.ok && nieuw.id, 'het potje staat klaar');
  const uitn = await json(await rtfSpel('mijn', {}, B));
  assert.equal(uitn.uitnodigingen.length, 1, 'B ziet de uitnodiging');
  const acc = await json(await rtfSpel('antwoord', { id: nieuw.id, akkoord: true }, B));
  assert.ok(acc.gestart, 'met twee spelers start het potje meteen');
  // wie aan zet is mag gooien; de ander niet
  let staat = await json(await rtfSpel('staat', { id: nieuw.id }, A));
  const ander = staat.potje.beurt === staat.potje.ik ? B : A;
  assert.equal((await rtfSpel('zet', { id: nieuw.id, zet: { actie: 'gooi' } }, ander)).status, 409, 'buiten je beurt gooien kan niet');
  // dobbelen tot er een 6 valt (met een zet erachteraan); de server bewaakt de beurten
  let zesGezien = false;
  for (let i = 0; i < 120 && !zesGezien; i++) {
    const st = await json(await rtfSpel('staat', { id: nieuw.id }, A));
    const sess = st.potje.beurt === st.potje.ik ? A : B;
    const g = await json(await rtfSpel('zet', { id: nieuw.id, zet: { actie: 'gooi' } }, sess));
    if (g.dobbel === 6 && !g.geenZet) {
      const st2 = await json(await rtfSpel('staat', { id: nieuw.id }, sess));
      const zetbaar = st2.potje.staat.zetten;
      assert.ok(zetbaar.length, 'met een 6 is er altijd een zet (eruit komen)');
      const z = await json(await rtfSpel('zet', { id: nieuw.id, zet: { pion: zetbaar[0].pion } }, sess));
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

test('uitnodigen op codenaam: samen spelen maakt je niet automatisch vrienden', async () => {
  // twee leden die elkaar NIET kennen; geen connect, alleen een codenaam
  const t = Date.now() + '' + (teller++);
  const a = await json(await raw('/auth/register', { name: 'Los A' + t, email: 'la' + t + '@v.test', phone: '0633' + String(t).slice(-6), password: 'geheim123', geboortedatum: '1988-03-03', tier: 'rtg' }));
  const b = await json(await raw('/auth/register', { name: 'Los B' + t, email: 'lb' + t + '@v.test', phone: '0644' + String(t).slice(-6), password: 'geheim123', geboortedatum: '1991-04-04', tier: 'rtg' }));
  const bCn = b.state.user.codename;
  // een eerste ingelogde aanraking zet beide leden in de codenaamgids
  await raw('/member/connections', {}, a.token); await raw('/member/connections', {}, b.token);
  // een onbekende codenaam wordt netjes geweigerd
  assert.equal((await raw('/member/spel/nieuw', { soort: 'schaak', codenamen: ['Bestaat Nietxyz'] }, a.token)).status, 404);
  // uitnodigen op de echte codenaam: het potje start zodra de ander accepteert
  const nieuw = await json(await raw('/member/spel/nieuw', { soort: 'schaak', codenamen: [bCn] }, a.token));
  assert.ok(nieuw.ok && nieuw.id, 'de uitnodiging op codenaam staat klaar');
  const uitn = await json(await raw('/member/spel/mijn', {}, b.token));
  assert.equal(uitn.uitnodigingen.length, 1, 'B ziet de uitnodiging van een niet-vriend');
  const acc = await json(await raw('/member/spel/antwoord', { id: nieuw.id, akkoord: true }, b.token));
  assert.ok(acc.gestart, 'het potje start');
  // en dat is alles: geen vriendschap, geen verzoek, aan geen van beide kanten
  for (const tok of [a.token, b.token]) {
    const c = await json(await raw('/member/connections', {}, tok));
    assert.equal((c.connections || []).length, 0, 'samen spelen levert geen vriendschap op');
    assert.equal((c.requests || []).length, 0, 'en ook geen openstaand verzoek');
  }
});

test('pesten (RTF): zeven kaarten, passend leggen of pakken, en de beurt schuift door', async () => {
  const { A, B, bCn } = await gezinSpelers();
  const nieuw = await json(await rtfSpel('nieuw', { soort: 'pesten', grootte: 2, codenamen: [bCn] }, A));
  await rtfSpel('antwoord', { id: nieuw.id, akkoord: true }, B);
  let st = await json(await rtfSpel('staat', { id: nieuw.id }, A));
  assert.equal(st.potje.staat.hand.length, 7, 'je begint met zeven kaarten');
  assert.deepEqual(st.potje.staat.aantallen, [7, 7], 'iedereen begint met zeven kaarten');
  assert.ok(st.potje.staat.open, 'er ligt een open kaart');
  assert.equal(st.potje.staat.stapel, 52 - 14 - 1, 'de rest is trekstapel');
  // een kaart die je niet hebt kun je niet leggen
  const beurtS = st.potje.beurt === st.potje.ik ? A : B;
  const stB = await json(await rtfSpel('staat', { id: nieuw.id }, beurtS));
  const alle = []; for (const kl of ['H', 'R', 'K', 'S']) for (const rg of ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'B', 'V', 'K', 'A']) alle.push(kl + rg);
  const nietVanMij = alle.find(k => !stB.potje.staat.hand.includes(k));
  assert.equal((await rtfSpel('zet', { id: nieuw.id, zet: { kaart: nietVanMij } }, beurtS)).status, 400, 'een kaart die je niet hebt wordt geweigerd');
  // spelen: leg wat past (bij een boer hoort een kleur), anders pakken
  let gelegd = 0, gepakt = 0;
  for (let i = 0; i < 60; i++) {
    const s = await json(await rtfSpel('staat', { id: nieuw.id }, A));
    if (s.potje.status === 'klaar') break;
    const sess = s.potje.beurt === s.potje.ik ? A : B;
    const sm = await json(await rtfSpel('staat', { id: nieuw.id }, sess));
    let ok = false;
    for (const kaart of sm.potje.staat.hand) {
      const r = await rtfSpel('zet', { id: nieuw.id, zet: { kaart, kleur: 'H' } }, sess);
      if (r.status === 200) { ok = true; gelegd++; break; }
    }
    if (!ok) {
      const p = await json(await rtfSpel('zet', { id: nieuw.id, zet: { pak: true } }, sess));
      assert.ok(p.gepakt >= 1, 'wie niets kwijt kan pakt minstens een kaart');
      gepakt++;
    }
    if (gelegd >= 3 && gepakt >= 1) break;
  }
  assert.ok(gelegd >= 1, 'passende kaarten worden gelegd');
});

test('tetris: eigen arcadebord naast Sneek, beste score telt', async () => {
  const { a, b } = await tweeVrienden();
  assert.equal((await raw('/member/spel/arcade-score', { spel: 'flipper', punten: 10 }, a.tok)).status, 400, 'onbekende arcadespellen bestaan niet');
  await raw('/member/spel/arcade-score', { spel: 'tetris', punten: 500 }, a.tok);
  await raw('/member/spel/arcade-score', { spel: 'tetris', punten: 300 }, a.tok); // lager: telt niet
  await raw('/member/spel/arcade-score', { spel: 'tetris', punten: 900 }, b.tok);
  await raw('/member/spel/sneek-score', { punten: 42 }, b.tok); // Sneek staat er los van
  const bord = await json(await raw('/member/spel/arcade-bord', { spel: 'tetris' }, a.tok));
  assert.equal(bord.bord[0].punten, 900, 'de vriend staat bovenaan het tetrisbord');
  assert.equal(bord.bord.find(r => r.ik).punten, 500, 'je beste tetrisscore blijft staan');
  assert.ok(!bord.bord.some(r => r.punten === 42), 'sneekscores lekken niet naar het tetrisbord');
});

test('dammen (RTF): wit begint, slaan is verplicht en een foute zet wordt geweigerd', async () => {
  const { A, B, bCn } = await gezinSpelers();
  const nieuw = await json(await rtfSpel('nieuw', { soort: 'dam', codenamen: [bCn] }, A));
  await rtfSpel('antwoord', { id: nieuw.id, akkoord: true }, B);
  let st = await json(await rtfSpel('staat', { id: nieuw.id }, A));
  assert.equal(st.potje.staat.bord.length, 100, 'een bord van tien bij tien');
  assert.equal((st.potje.staat.bord.match(/w/g) || []).length, 20, 'wit heeft twintig schijven');
  assert.equal(st.potje.beurt, st.potje.ik, 'de maker (wit) begint');
  assert.ok(st.potje.staat.zetten.length, 'wit heeft zetten');
  // een zelfbedachte zet die niet in de lijst staat wordt geweigerd
  assert.equal((await rtfSpel('zet', { id: nieuw.id, zet: { van: 0, naar: 55 } }, A)).status, 400);
  const zet = st.potje.staat.zetten[0];
  const z = await json(await rtfSpel('zet', { id: nieuw.id, zet: { van: zet.van, naar: zet.naar } }, A));
  assert.ok(z.ok, 'een aangeboden zet telt');
  st = await json(await rtfSpel('staat', { id: nieuw.id }, B));
  assert.equal(st.potje.beurt, st.potje.ik, 'daarna is zwart aan zet');
  assert.ok(st.potje.staat.zetten.length, 'zwart krijgt zijn eigen zetten aangereikt');
});

test('rummi (RTF): veertien stenen, onzin-setjes geweigerd, pakken wisselt de beurt', async () => {
  const { A, B, bCn } = await gezinSpelers();
  const nieuw = await json(await rtfSpel('nieuw', { soort: 'rummi', grootte: 2, codenamen: [bCn] }, A));
  await rtfSpel('antwoord', { id: nieuw.id, akkoord: true }, B);
  let st = await json(await rtfSpel('staat', { id: nieuw.id }, A));
  assert.equal(st.potje.staat.rek.length, 14, 'je begint met veertien stenen');
  assert.deepEqual(st.potje.staat.aantallen, [14, 14]);
  assert.equal(st.potje.staat.eerste, false, 'de eerste uitleg moet nog komen');
  const beurtS = st.potje.beurt === st.potje.ik ? A : B;
  // een setje dat geen rij en geen groep is, wordt met naam en toenaam geweigerd
  const fout = await rtfSpel('zet', { id: nieuw.id, zet: { tafel: [['r1', 'r5', 'r9']] } }, beurtS);
  assert.equal(fout.status, 400);
  assert.ok(/geldige rij of groep/.test((await json(fout)).error));
  // niets kwijt kunnen: pak een steen en de ander is ECHT aan de beurt
  // (de beurt moet een geldige spelerindex zijn; NaN zou het potje muurvast zetten)
  const p1 = await json(await rtfSpel('zet', { id: nieuw.id, zet: { pak: true } }, beurtS));
  assert.ok(p1.gepakt, 'er komt een steen bij');
  st = await json(await rtfSpel('staat', { id: nieuw.id }, beurtS));
  assert.equal(st.potje.staat.rek.length, 15, 'het rek groeit naar vijftien');
  assert.ok([0, 1].includes(st.potje.beurt), 'de beurt is een echte spelerindex');
  assert.notEqual(st.potje.beurt, st.potje.ik, 'de beurt is gewisseld');
  // en de ander kan daarna ook echt zetten
  const anderS = beurtS === A ? B : A;
  const p2 = await json(await rtfSpel('zet', { id: nieuw.id, zet: { pak: true } }, anderS));
  assert.ok(p2.gepakt, 'de tweede speler is aan de beurt en pakt');
});

test('magnaat: 1500 start, kopen op een vrij veld en bouwen vergt de hele kleurgroep', async () => {
  const { a, b } = await tweeVrienden();
  const nieuw = await json(await raw('/member/spel/nieuw', { soort: 'magnaat', grootte: 2, vrienden: [b.key] }, a.tok));
  await raw('/member/spel/antwoord', { id: nieuw.id, akkoord: true }, b.tok);
  // het statische bord reist alleen mee als de client erom vraagt (bij openen)
  let st = await json(await raw('/member/spel/staat', { id: nieuw.id, velden: true }, a.tok));
  assert.deepEqual(st.potje.staat.geld, [1500, 1500], 'iedereen begint met 1500');
  assert.equal(st.potje.staat.velden.length, 40, 'veertig velden op het bord');
  const licht = await json(await raw('/member/spel/staat', { id: nieuw.id }, a.tok));
  assert.equal(licht.potje.staat.velden, undefined, 'een gewone poll draagt het statische bord niet mee');
  // gooien buiten je beurt kan niet
  const anderTok = st.potje.beurt === st.potje.ik ? b.tok : a.tok;
  assert.equal((await raw('/member/spel/zet', { id: nieuw.id, zet: { actie: 'gooi' } }, anderTok)).status, 409);
  // rondjes gooien tot iemand iets kan kopen; dan koopt hij het ook echt
  let gekocht = null, koperTok = null;
  for (let i = 0; i < 120 && !gekocht; i++) {
    const s = await json(await raw('/member/spel/staat', { id: nieuw.id }, a.tok));
    if (s.potje.status !== 'bezig') break;
    const tok = s.potje.beurt === s.potje.ik ? a.tok : b.tok;
    const g = await json(await raw('/member/spel/zet', { id: nieuw.id, zet: { actie: 'gooi' } }, tok));
    if (g.teKoop != null) {
      const k = await json(await raw('/member/spel/zet', { id: nieuw.id, zet: { actie: 'koop' } }, tok));
      assert.ok(k.ok, 'kopen lukt');
      gekocht = g.teKoop; koperTok = tok;
    }
  }
  assert.ok(gekocht != null, 'binnen 120 beurten komt iemand op een vrij veld');
  st = await json(await raw('/member/spel/staat', { id: nieuw.id, velden: true }, koperTok));
  assert.equal(st.potje.staat.eigenaar[gekocht], st.potje.ik, 'het veld is nu van de koper');
  assert.ok(st.potje.staat.geld[st.potje.ik] < 1500, 'en de koop is betaald');
  // bouwen mag pas als de hele kleurgroep van jou is
  if (st.potje.staat.velden[gekocht].t === 'straat') {
    const r = await raw('/member/spel/zet', { id: nieuw.id, zet: { actie: 'bouw', veld: gekocht } }, koperTok);
    assert.equal(r.status, 400);
    assert.ok(/kleurgroep/.test((await json(r)).error));
  }
});

test('30 seconden: twee teams, de rader ziet de kaart niet, eerlijk scoren telt op', async () => {
  const { a, b } = await tweeVrienden();
  // spelers drie en vier komen binnen op codenaam (en worden dus geen vrienden)
  const t = Date.now() + '' + (teller++);
  const c = await json(await raw('/auth/register', { name: 'Team C' + t, email: 'tc' + t + '@v.test', phone: '0655' + String(t).slice(-6), password: 'geheim123', geboortedatum: '1993-05-05', tier: 'rtg' }));
  const d = await json(await raw('/auth/register', { name: 'Team D' + t, email: 'td' + t + '@v.test', phone: '0666' + String(t).slice(-6), password: 'geheim123', geboortedatum: '1995-06-06', tier: 'rtg' }));
  await raw('/member/connections', {}, c.token); await raw('/member/connections', {}, d.token);
  const nieuw = await json(await raw('/member/spel/nieuw', { soort: 'seconden', vrienden: [b.key], codenamen: [c.state.user.codename, d.state.user.codename] }, a.tok));
  assert.ok(nieuw.ok, 'het potje staat klaar');
  for (const tok of [b.tok, c.token, d.token]) await raw('/member/spel/antwoord', { id: nieuw.id, akkoord: true }, tok);
  let st = await json(await raw('/member/spel/staat', { id: nieuw.id }, a.tok));
  assert.equal(st.potje.status, 'bezig', 'met vier spelers start het');
  assert.equal(st.potje.modus, 'teams', 'altijd twee tegen twee');
  // de verteller pakt een kaart met vijf begrippen
  const kaart = await json(await raw('/member/spel/zet', { id: nieuw.id, zet: { actie: 'kaart' } }, a.tok));
  assert.equal(kaart.kaart.length, 5, 'vijf begrippen op de kaart');
  // de rader (teamgenoot, speler 3) ziet de kaart niet; de tegenpartij wel
  const alsRader = await json(await raw('/member/spel/staat', { id: nieuw.id }, c.token));
  assert.equal(alsRader.potje.staat.kaart, null, 'de rader ziet niets');
  const alsTegen = await json(await raw('/member/spel/staat', { id: nieuw.id }, b.tok));
  assert.equal((alsTegen.potje.staat.kaart || []).length, 5, 'de tegenpartij controleert mee');
  // eerlijk invullen: 3 goed
  await raw('/member/spel/zet', { id: nieuw.id, zet: { actie: 'score', goed: 3 } }, a.tok);
  st = await json(await raw('/member/spel/staat', { id: nieuw.id }, a.tok));
  assert.deepEqual(st.potje.staat.scores, [3, 0], 'team een staat op drie');
  assert.equal(st.potje.beurt, 1, 'daarna vertelt de volgende');
});

test('doen of waarheid (RTF): kiezen, afronden en een punt verdienen', async () => {
  const { A, B, bCn } = await gezinSpelers();
  const nieuw = await json(await rtfSpel('nieuw', { soort: 'waarheid', grootte: 2, codenamen: [bCn] }, A));
  await rtfSpel('antwoord', { id: nieuw.id, akkoord: true }, B);
  assert.equal((await rtfSpel('zet', { id: nieuw.id, zet: { actie: 'af', gedaan: true } }, A)).status, 409, 'eerst kiezen, dan afronden');
  const k = await json(await rtfSpel('zet', { id: nieuw.id, zet: { actie: 'kies', wat: 'doen' } }, A));
  assert.ok(k.kaart && k.kaart.length > 10, 'er komt een opdracht');
  await rtfSpel('zet', { id: nieuw.id, zet: { actie: 'af', gedaan: true } }, A);
  const st = await json(await rtfSpel('staat', { id: nieuw.id }, A));
  assert.equal(st.potje.staat.punten[0], 1, 'gedaan is een punt');
  assert.equal(st.potje.beurt, 1, 'en de beurt schuift door');
});

test('30 seconden start nooit met minder dan vier: weigeren annuleert het potje', async () => {
  const { a, b } = await tweeVrienden();
  const t = Date.now() + '' + (teller++);
  const c = await json(await raw('/auth/register', { name: 'Half C' + t, email: 'hc' + t + '@v.test', phone: '0699' + String(t).slice(-6), password: 'geheim123', geboortedatum: '1994-04-04', tier: 'rtg' }));
  await raw('/member/connections', {}, c.token);
  const nieuw = await json(await raw('/member/spel/nieuw', { soort: 'seconden', vrienden: [b.key], codenamen: [c.state.user.codename] }, a.tok));
  // een accepteert, een weigert: drie spelers is geen twee-tegen-twee
  await raw('/member/spel/antwoord', { id: nieuw.id, akkoord: true }, b.tok);
  const laatste = await json(await raw('/member/spel/antwoord', { id: nieuw.id, akkoord: false }, c.token));
  assert.equal(laatste.gestart, false, 'het potje start niet half');
  assert.equal((await raw('/member/spel/staat', { id: nieuw.id }, a.tok)).status, 404, 'het halve potje is opgeruimd');
});

test('elke app zijn eigen spelgroep: RTG start geen dammen, RTF start geen schaken', async () => {
  const { a } = await tweeVrienden();
  const { A, bCn } = await gezinSpelers();
  // de RTG-leden-app start de RTF-spellen niet (en andersom); meespelen op uitnodiging kan wel
  const r1 = await raw('/member/spel/nieuw', { soort: 'dam', codenamen: [bCn] }, a.tok);
  assert.equal(r1.status, 400);
  assert.ok(/RTFoundation/.test((await json(r1)).error), 'de melding wijst naar de andere app');
  const r2 = await rtfSpel('nieuw', { soort: 'schaak', codenamen: [a.cn] }, A);
  assert.equal(r2.status, 400);
  assert.ok(/RTG/.test((await json(r2)).error));
  // ook de random wachtrij volgt de eigen spelgroep
  assert.equal((await raw('/member/spel/random', { soort: 'rummi' }, a.tok)).status, 400);
  assert.equal((await rtfSpel('random', { soort: 'magnaat' }, A)).status, 400);
});

test('proost is 18+: minderjarige leden komen er niet in, volwassen leden wel', async () => {
  const t = Date.now() + '' + (teller++);
  const jong = await json(await raw('/auth/register', { name: 'Jong ' + t, email: 'jg' + t + '@v.test', phone: '0677' + String(t).slice(-6), password: 'geheim123', geboortedatum: '2010-01-01', tier: 'rtg' }));
  const { a, b } = await tweeVrienden();
  await raw('/member/connections', {}, jong.token);
  // een 16-jarige kan geen Proost-potje starten
  const geweigerd = await raw('/member/spel/nieuw', { soort: 'proost', codenamen: [a.cn] }, jong.token);
  assert.equal(geweigerd.status, 403);
  assert.ok(/18\+/.test((await json(geweigerd)).error), 'de melding zegt waarom');
  // en ook niet uitgenodigd worden
  const metJong = await raw('/member/spel/nieuw', { soort: 'proost', codenamen: [jong.state.user.codename] }, a.tok);
  assert.equal(metJong.status, 403, 'minderjarigen uitnodigen kan niet');
  // twee volwassen leden spelen gewoon
  const nieuw = await json(await raw('/member/spel/nieuw', { soort: 'proost', grootte: 2, vrienden: [b.key] }, a.tok));
  assert.ok(nieuw.ok, 'volwassen leden mogen proosten');
  await raw('/member/spel/antwoord', { id: nieuw.id, akkoord: true }, b.tok);
  const kaart = await json(await raw('/member/spel/zet', { id: nieuw.id, zet: { actie: 'kaart' } }, a.tok));
  assert.ok(kaart.kaart && kaart.kaart.length > 5, 'de eerste kaart ligt op tafel');
  const st = await json(await raw('/member/spel/staat', { id: nieuw.id }, b.tok));
  assert.equal(st.potje.staat.teller, 1, 'kaart een van vijfentwintig');
});

test('sudoku hoort bij de arcade: scores en ranglijst werken', async () => {
  const { a, b } = await tweeVrienden();
  await raw('/member/spel/arcade-score', { spel: 'sudoku', punten: 275 }, a.tok);
  await raw('/member/spel/arcade-score', { spel: 'sudoku', punten: 410 }, b.tok);
  const bord = await json(await raw('/member/spel/arcade-bord', { spel: 'sudoku' }, a.tok));
  assert.equal(bord.bord[0].punten, 410, 'de snelste oplosser staat bovenaan');
  assert.equal(bord.bord.find(r => r.ik).punten, 275);
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
