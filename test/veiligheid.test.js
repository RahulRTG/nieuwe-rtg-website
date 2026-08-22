/* RTG Veilig: de vier apps op een ruggengraat.

   De belangrijkste toets staat in toets 4 en 5, en die is de reden dat dit zo
   gebouwd is: de dodemansknop moet aflopen ZONDER dat de telefoon nog iets
   doet. Daarom loopt de klok op de server. In de test is dat letterlijk zo:
   we starten een wacht, doen daarna helemaal niets meer namens dat toestel, en
   controleren dat het contact toch een alarm met de laatst bekende plek krijgt.

   Draai los: node --test test/veilig.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

function verseDataDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-veilig-')); }

async function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

let n = 0;
async function registreer(base) {
  const u = Date.now().toString(36) + (n++) + Math.random().toString(36).slice(2, 6);
  const r = await api(base, '/api/auth/register', {
    name: 'Veilig Lid', email: u + '@x.nl',
    phone: '06' + u.replace(/\D/g, '').padEnd(8, '1').slice(0, 8),
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg'
  });
  assert.equal(r.status, 200, 'registreren: ' + JSON.stringify(r.body));
  const con = await api(base, '/api/member/connections', {}, r.body.token);
  return { token: r.body.token, key: con.body.me, codenaam: con.body.codename };
}

// twee leden echt met elkaar verbinden (verzoek + accepteren)
async function verbind(base, a, b) {
  const v = await api(base, '/api/member/connect', { key: b.key }, a.token);
  assert.equal(v.status, 200, 'verbindingsverzoek: ' + JSON.stringify(v.body));
  const r = await api(base, '/api/member/connect/respond', { key: a.key, action: 'accept' }, b.token);
  assert.equal(r.status, 200, 'verzoek accepteren: ' + JSON.stringify(r.body));
}

test('RTG Veilig', { concurrency: false }, async (t) => {
  const dir = verseDataDir();
  const srv = await startServer({ env: { RTG_DATA_DIR: dir, RTG_DEMO: '0' } });
  const B = srv.base;
  t.after(() => stop(srv && srv.child));

  const ik = await registreer(B);
  const maat = await registreer(B);
  const vreemde = await registreer(B);

  await t.test('1. de kring neemt alleen echte connecties aan', async () => {
    // niet verbonden: weigeren. Anders kon je iedereen ongevraagd tot je
    // noodcontact bombarderen, en meekijken met wie dat niet wil.
    const nee = await api(B, '/api/veiligheid/kring/toevoegen', { handle: vreemde.key }, ik.token);
    assert.equal(nee.status, 403, 'onbekende codenaam moet geweigerd worden');

    await verbind(B, ik, maat);
    const ja = await api(B, '/api/veiligheid/kring/toevoegen', { handle: maat.key }, ik.token);
    assert.equal(ja.status, 200, JSON.stringify(ja.body));
    assert.equal(ja.body.kring.contacten.length, 1);
    assert.equal(ja.body.kring.contacten[0].codenaam, maat.codenaam, 'de kring toont een CODENAAM');
    assert.ok(!JSON.stringify(ja.body).includes('@'), 'geen e-mailadres of echte naam in het kringbeeld');
  });

  await t.test('2. zonder kring slaat het alarm niet aan', async () => {
    const r = await api(B, '/api/veiligheid/alarm', {}, vreemde.token);
    assert.equal(r.status, 400, 'een alarm zonder ontvangers is geen alarm');
  });

  await t.test('3. de laatst bekende plek wordt onthouden', async () => {
    const p = await api(B, '/api/veiligheid/plek', { lat: 52.3676, lon: 4.9041, accu: 12 }, ik.token);
    assert.equal(p.status, 200, JSON.stringify(p.body));
    const beeld = await api(B, '/api/veiligheid', {}, ik.token);
    assert.ok(beeld.body.plek, 'de server houdt de laatste positie vast');
    assert.ok(beeld.body.plek.ouderdomMin <= 1);
  });

  await t.test('4. de wacht loopt af ZONDER de telefoon, en waarschuwt de kring', async () => {
    // een wacht van een minuut, zonder genadetijd
    const s = await api(B, '/api/veiligheid/wacht/start',
      { soort: 'thuis', minuten: 1, marge: 0, label: 'Naar huis' }, ik.token);
    assert.equal(s.status, 200, JSON.stringify(s.body));
    assert.equal(s.body.wacht.status, 'loopt');

    /* Vanaf hier doet het toestel van "ik" NIETS meer: geen check-in, geen
       positie, geen enkel verzoek. Precies de situatie van een lege batterij
       of een telefoon in het water. Alleen de klok van de server draait door.

       We pollen met het token van het CONTACT, niet van de vermiste: het
       alarm moet ontstaan zonder dat de vermiste nog iets aanraakt. De sweep
       loopt elke 30 seconden, dus na een minuut deadline duurt het hooguit
       anderhalve minuut voordat het alarm er is. */
    let raak = null;
    for (let i = 0; i < 150; i++) {
      const bij = await api(B, '/api/veiligheid', {}, maat.token);
      raak = (bij.body.voorMij || []).find(a => a.soort === 'thuis');
      if (raak) break;
      await new Promise(r => setTimeout(r, 1000));
    }
    assert.ok(raak, 'het contact hoort een alarm te krijgen zonder dat de telefoon nog iets deed');
    assert.equal(raak.codenaam, ik.codenaam, 'het alarm noemt de codenaam');
    assert.ok(raak.plek, 'en draagt de laatst bekende plek mee');
    assert.equal(raak.plek.lat, 52.3676);
  });

  await t.test('5. inchecken sluit het alarm af', async () => {
    const w = await api(B, '/api/veiligheid/wacht', {}, ik.token);
    const lopend = w.body.lopend[0];
    if (lopend) {
      const c = await api(B, '/api/veiligheid/wacht/checkin', { id: lopend.id }, ik.token);
      assert.equal(c.status, 200, JSON.stringify(c.body));
    }
    const eigen = await api(B, '/api/veiligheid', {}, ik.token);
    assert.ok(eigen.body.alarmen.length >= 1, 'het eigen logboek toont wat er is uitgegaan');
  });

  await t.test('6. het codewoord wordt gehasht bewaard en nooit teruggegeven', async () => {
    const kort = await api(B, '/api/veiligheid/codewoord/zet', { zin: 'kat' }, ik.token);
    assert.equal(kort.status, 400, 'een los woord is te makkelijk per ongeluk');

    const zet = await api(B, '/api/veiligheid/codewoord/zet', { zin: 'Is de kat al gevoerd?' }, ik.token);
    assert.equal(zet.status, 200, JSON.stringify(zet.body));

    const stand = await api(B, '/api/veiligheid/codewoord', {}, ik.token);
    assert.equal(stand.body.stand.ingesteld, true);
    const alles = JSON.stringify(stand.body).toLowerCase();
    assert.ok(!alles.includes('kat'), 'de zin komt nooit meer terug over de lijn');
    assert.ok(!alles.includes('hash') && !alles.includes('zout'), 'en de afdruk ook niet');

    // en niet op schijf, ook niet in leesbare vorm
    const bestand = path.join(dir, 'db.json');
    if (fs.existsSync(bestand)) {
      const ruw = fs.readFileSync(bestand, 'utf8').toLowerCase();
      assert.ok(!ruw.includes('is de kat al gevoerd'), 'de zin staat niet als tekst in de database');
    }
  });

  await t.test('7. oefenen zegt eerlijk ja of nee, en slaat geen alarm', async () => {
    const voor = (await api(B, '/api/veiligheid', {}, ik.token)).body.alarmen.length;
    const mis = await api(B, '/api/veiligheid/codewoord/proef', { tekst: 'hoe laat is het' }, ik.token);
    assert.equal(mis.body.raak, false);
    const raak = await api(B, '/api/veiligheid/codewoord/proef', { tekst: 'is de kat al gevoerd' }, ik.token);
    assert.equal(raak.body.raak, true, 'de eigen zin hoort herkend te worden');
    const na = (await api(B, '/api/veiligheid', {}, ik.token)).body.alarmen.length;
    assert.equal(na, voor, 'oefenen waarschuwt niemand');
  });

  await t.test('8. de zin midden in een gewoon gesprek werkt, en stil', async () => {
    const voor = (await api(B, '/api/veiligheid', {}, maat.token)).body.voorMij.length;
    // een doodgewoon bericht aan Rahul, met de zin er ergens in
    const r = await api(B, '/api/fluister', { q: 'even iets anders, is de kat al gevoerd vanmiddag?' }, ik.token);
    assert.equal(r.status, 200, 'het gesprek gaat gewoon door');
    const tekst = JSON.stringify(r.body).toLowerCase();
    assert.ok(!tekst.includes('alarm') && !tekst.includes('codewoord') && !tekst.includes('kring'),
      'het antwoord verraadt met geen woord dat er iets is gebeurd');

    const na = await api(B, '/api/veiligheid', {}, maat.token);
    assert.equal(na.body.voorMij.length, voor + 1, 'het contact is wel gewaarschuwd');
    assert.equal(na.body.voorMij[0].soort, 'codewoord');
  });

  await t.test('9. de check-route verraadt nooit of het raak was', async () => {
    const mis = await api(B, '/api/veiligheid/codewoord/check', { tekst: 'niets bijzonders hier' }, ik.token);
    const raak = await api(B, '/api/veiligheid/codewoord/check', { tekst: 'is de kat al gevoerd' }, ik.token);
    assert.deepEqual(mis.body, raak.body, 'raak en mis geven exact hetzelfde antwoord');
    assert.equal(mis.status, raak.status);
  });

  await t.test('10. niet storen laat de kring altijd door', async () => {
    const aan = await api(B, '/api/veiligheid/rust/aan', { stand: 'slaap', minuten: 60 }, maat.token);
    assert.equal(aan.status, 200, JSON.stringify(aan.body));
    assert.equal(aan.body.rust.aan, true);

    const voor = (await api(B, '/api/veiligheid', {}, maat.token)).body.voorMij.length;
    const proef = await api(B, '/api/veiligheid/alarm', { proef: true, notitie: 'test' }, ik.token);
    assert.equal(proef.status, 200, JSON.stringify(proef.body));
    const na = await api(B, '/api/veiligheid', {}, maat.token);
    assert.equal(na.body.voorMij.length, voor + 1,
      'een veiligheidsmelding komt door "niet storen" heen; dat is de hele afspraak');

    const uit = await api(B, '/api/veiligheid/rust/uit', {}, maat.token);
    assert.equal(uit.body.rust.aan, false);
  });

  await t.test('11. het contact ziet niets meer zodra hij uit de kring is', async () => {
    const weg = await api(B, '/api/veiligheid/kring/verwijderen', { handle: maat.key }, ik.token);
    assert.equal(weg.status, 200);
    const voor = (await api(B, '/api/veiligheid', {}, maat.token)).body.voorMij.length;
    const proef = await api(B, '/api/veiligheid/alarm', { proef: true }, ik.token);
    // zonder kring is er niemand meer om te waarschuwen
    assert.equal(proef.status, 400, 'zonder kring gaat er niets uit');
    const na = (await api(B, '/api/veiligheid', {}, maat.token)).body.voorMij.length;
    assert.equal(na, voor);
  });

  await t.test('12. het beeld noemt de grens hardop', async () => {
    const beeld = await api(B, '/api/veiligheid', {}, ik.token);
    assert.match(beeld.body.grens, /geen alarmcentrale/i,
      'de app hoort zelf te zeggen wat hij niet is');
  });
});
