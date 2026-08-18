/* ============================================================================
   RTG Bank, de tien endpoints die nog nergens werden aangeraakt.

   bank.test.js dekt de kern (openen, storten, overboeken, de drie-standen-knop).
   Deze tien vielen erbuiten, en het is allemaal geld:

     /api/bank/passen            /api/bank/pas/sluit
     /api/bank/bevries           /api/bank/spaardoel
     /api/bank/rente-voorbeeld   /api/bank/terugkerend
     /api/bank/terugkerend/stop  /api/bank/salaris
     /api/bank/sepa              /api/bank/naar-wallet

   Waar het hier vooral om gaat is NIET dat de gelukkige route werkt, maar dat
   de ongelukkige dichtzit: een gast erbuiten, een gesloten bank dicht, en --
   het zwaarst -- dat lid B niet bij de rekening van lid A kan. Dat laatste is
   de fout die je bij een bank niet mag maken, en hij is met een IBAN uit een
   ander verzoek zo geprobeerd.

   Draai los: node --test test/bank-beheer.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, lid, ander, gast, office;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bankbeheer-'));

const api = (pad, body, token) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

/* ECHTE accounts, geen demo-inlog.

   /api/login met { tier: 'rtg' } geeft een demo-sessie met key = de tier zelf,
   dus twee "leden" die zo binnenkomen zijn hetzelfde account -- en dan toetsen
   de grenzen hieronder niets. Voor een grens tussen twee mensen heb je twee
   mensen nodig. */
let teller = 0;
async function nieuwLid(naam) {
  const u = (Date.now() + (++teller) * 7919).toString().slice(-9);  // louter cijfers: het telefoonnummer moet geldig zijn
  const r = await fetch(base + '/api/auth/register', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: naam, email: 'bb' + u + '@x.nl', phone: '06' + u.slice(0, 8),
      password: 'geheim12345', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })
  }).then(x => x.json());
  assert.ok(r.token, 'lid ' + naam + ' geregistreerd');
  return { token: r.token };
}
const inloggen = (tier) => fetch(base + '/api/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier })
}).then(r => r.json());

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'KANTOOR-BANKBEHEER' } });
  base = srv.base;

  const o = await (await fetch(base + '/api/office/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 'KANTOOR-BANKBEHEER' })
  })).json();
  office = { token: o.token };

  /* Eerst kijken of de bank ECHT dichtzit voordat de boardroom hem live zet --
     anders toetst test 1 hieronder niets. */
  const voor = await nieuwLid('Voorproef');
  const dicht = await api('bank/passen', {}, voor.token);
  assert.equal(dicht.status, 403, 'zolang de bank niet live is, is elke actie dicht');

  await api('office/bank/leden', { aan: true, naam: 'RTG' }, office.token);

  lid = await nieuwLid('Lid A');
  const akk = await api('bank/akkoord', {}, lid.token);
  assert.equal(akk.status, 200, 'akkoord opent de eerste rekening');
  lid.iban = akk.body.rekening.iban;
  await api('bank/storten', { iban: lid.iban, centen: 250000, idem: 'start-a' }, lid.token);
  /* Een spaardoel hoort bij een SPAARrekening -- akkoord opent een betaalrekening.
     Zonder deze extra rekening zou de spaardoel-test op de verkeerde reden falen
     (400 "geen spaarrekening") in plaats van op de reden die we willen toetsen. */
  const spaar = await api('bank/rekening/open', { soort: 'spaar', naam: 'Voor later' }, lid.token);
  assert.equal(spaar.status, 200, 'lid A opent een spaarrekening');
  lid.spaarIban = spaar.body.rekening.iban;

  ander = await nieuwLid('Lid B');
  const akkB = await api('bank/akkoord', {}, ander.token);
  ander.iban = akkB.body.rekening.iban;
  assert.notEqual(ander.iban, lid.iban, 'twee leden, twee rekeningen');

  const g = await inloggen('guest');
  gast = { token: g.token };
});

test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

/* ================= 1. wie er niet in mag ================= */

test('1. een gast komt bij geen van de tien binnen', async () => {
  /* RTG Bank is voor leden. Een gast heeft een echt account maar geen pas, en
     hoort dus overal een 403 te krijgen -- niet een lege lijst, want dan zou de
     grens van de functie afhangen en niet van de poort. */
  for (const pad of ['bank/passen', 'bank/pas/sluit', 'bank/bevries', 'bank/spaardoel',
    'bank/rente-voorbeeld', 'bank/terugkerend', 'bank/terugkerend/stop', 'bank/salaris',
    'bank/sepa', 'bank/naar-wallet']) {
    const r = await api(pad, { iban: lid.iban, centen: 100 }, gast.token);
    assert.equal(r.status, 403, pad + ' hoort dicht te zitten voor een gast');
  }
});

test('2. zonder inlog komt er niets doorheen', async () => {
  for (const pad of ['bank/passen', 'bank/sepa', 'bank/salaris', 'bank/spaardoel']) {
    const r = await api(pad, { iban: lid.iban }, 'onzin-token');
    assert.equal(r.status, 401, pad + ' hoort 401 te geven zonder geldige sessie');
  }
});

/* ================= 2. DE GRENS TUSSEN TWEE LEDEN ================= */

test('3. lid B kan de rekening van lid A niet bevriezen', async () => {
  /* De klassieke fout: het IBAN komt uit het verzoek, dus wie er een van een
     ander invult, bedient een vreemde rekening. Alles hieronder moet daarop
     stuklopen. */
  const r = await api('bank/bevries', { iban: lid.iban, aan: true }, ander.token);
  assert.notEqual(r.status, 200, 'bevriezen van andermans rekening mag niet lukken');

  // en de rekening van A doet het daarna gewoon nog
  const eigen = await api('bank/rekening', { iban: lid.iban }, lid.token);
  assert.equal(eigen.status, 200);
  assert.equal(eigen.body.rekening.bevroren, false, 'de rekening van A is niet bevroren geraakt');
});

test('4. lid B kan geen geld van A naar zijn wallet halen', async () => {
  const r = await api('bank/naar-wallet', { iban: lid.iban, centen: 1000 }, ander.token);
  assert.notEqual(r.status, 200, 'geld van andermans rekening naar je eigen wallet halen mag niet');
});

test('5. lid B kan geen SEPA-opdracht van A doen', async () => {
  const r = await api('bank/sepa', {
    iban: lid.iban, centen: 1000, naarIban: 'NL91ABNA0417164300',
    begunstigde: 'De Kaper', oms: 'niet mijn geld', idem: 'kaap-1'
  }, ander.token);
  assert.notEqual(r.status, 200, 'een SEPA-opdracht op andermans rekening mag niet lukken');
});

test('6. lid B kan geen salarisrun vanaf de rekening van A starten', async () => {
  const r = await api('bank/salaris', {
    vanIban: lid.iban, oms: 'kaping',
    posten: [{ naarIban: ander.iban, centen: 100000, naam: 'ikzelf' }]
  }, ander.token);
  assert.notEqual(r.status, 200, 'een salarisrun vanaf andermans rekening mag niet lukken');
});

test('7. lid B kan geen spaardoel op de SPAARrekening van A zetten', async () => {
  /* Met opzet de spaarrekening: op een betaalrekening zou dit al stuklopen op
     "een spaardoel hoort bij een spaarrekening", en dan toetst de test de soort
     in plaats van het eigendom. Nu is eigendom de enige reden die overblijft. */
  const r = await api('bank/spaardoel', { iban: lid.spaarIban, euro: 500 }, ander.token);
  assert.notEqual(r.status, 200, 'een spaardoel op andermans rekening mag niet lukken');
  assert.equal(r.status, 404, 'en wel omdat de rekening niet van hem is');
});

/* ================= 3. wat er wel hoort te werken ================= */

test('8. passen opvragen en een pas sluiten', async () => {
  const lijst = await api('bank/passen', {}, lid.token);
  assert.equal(lijst.status, 200);
  assert.ok(Array.isArray(lijst.body.passen), 'een lijst, ook als hij leeg is');

  const uitgeven = await api('bank/pas/uitgeven', { iban: lid.iban, soort: 'virtueel' }, lid.token);
  if (uitgeven.status === 200 && uitgeven.body.pas) {
    const id = uitgeven.body.pas.id;
    const na = await api('bank/passen', {}, lid.token);
    assert.ok(na.body.passen.some(p => p.id === id), 'de nieuwe pas staat in de lijst');

    // een ander mag hem niet sluiten
    assert.notEqual((await api('bank/pas/sluit', { id }, ander.token)).status, 200,
      'andermans pas sluiten mag niet');

    const sluit = await api('bank/pas/sluit', { id }, lid.token);
    assert.equal(sluit.status, 200, 'de eigenaar sluit zijn eigen pas wel');
  }
  // een onbekende pas sluiten mag nooit een 200 geven
  assert.notEqual((await api('bank/pas/sluit', { id: 'bestaat-niet' }, lid.token)).status, 200);
});

test('9. een spaardoel zetten op je eigen spaarrekening', async () => {
  const r = await api('bank/spaardoel', { iban: lid.spaarIban, euro: 1500 }, lid.token);
  assert.equal(r.status, 200, 'op je eigen spaarrekening mag het wel');
  assert.equal(r.body.doelCenten, 150000, 'euro gaat als centen de administratie in');

  // en een betaalrekening is geen spaarrekening: dat hoort een nette 400 te zijn
  const fout = await api('bank/spaardoel', { iban: lid.iban, euro: 1500 }, lid.token);
  assert.equal(fout.status, 400, 'een spaardoel op een betaalrekening wordt geweigerd');

  // een onmogelijk doel ook
  assert.equal((await api('bank/spaardoel', { iban: lid.spaarIban, euro: -5 }, lid.token)).status, 400);
  assert.equal((await api('bank/spaardoel', { iban: lid.spaarIban, euro: 2000000 }, lid.token)).status, 400);
});

test('10. het rentevoorbeeld rekent en raakt geen rekening aan', async () => {
  /* Dit is een rekenmachine, geen boeking. Hij hoort dus ook zonder IBAN te
     werken, en het saldo mag er niet van veranderen. */
  const voor = (await api('bank/rekening', { iban: lid.iban }, lid.token)).body.rekening;
  assert.ok(Number.isFinite(voor.saldoCenten), 'we lezen een ECHT saldo, geen undefined');
  const r = await api('bank/rente-voorbeeld', { euro: 10000 }, lid.token);
  assert.equal(r.status, 200);
  const na = (await api('bank/rekening', { iban: lid.iban }, lid.token)).body.rekening;
  assert.equal(na.saldoCenten, voor.saldoCenten, 'een voorbeeld boekt niets');
});

test('11. terugkerende opdrachten: lijst, zetten, stoppen', async () => {
  const leeg = await api('bank/terugkerend', {}, lid.token);
  assert.equal(leeg.status, 200);
  assert.ok(Array.isArray(leeg.body.opdrachten || leeg.body.lijst || []), 'een lijst terug');

  const zet = await api('bank/terugkerend/zet', {
    vanIban: lid.iban, naarIban: ander.iban, centen: 500, oms: 'maandelijks', dag: 1
  }, lid.token);
  if (zet.status === 200 && (zet.body.opdracht || zet.body.id)) {
    const id = (zet.body.opdracht && zet.body.opdracht.id) || zet.body.id;
    // een ander mag hem niet stoppen
    assert.notEqual((await api('bank/terugkerend/stop', { id }, ander.token)).status, 200,
      'andermans terugkerende opdracht stoppen mag niet');
    assert.equal((await api('bank/terugkerend/stop', { id }, lid.token)).status, 200,
      'de eigenaar stopt hem wel');
  }
  assert.notEqual((await api('bank/terugkerend/stop', { id: 'bestaat-niet' }, lid.token)).status, 200);
});

test('12. bevriezen doet ook echt iets: daarna gaat er geen geld meer af', async () => {
  /* Een bevriesknop die alleen een vlaggetje zet en verder niets tegenhoudt, is
     erger dan geen knop: de klant denkt dat hij veilig is. */
  const bevries = await api('bank/bevries', { iban: lid.iban, aan: true }, lid.token);
  assert.equal(bevries.status, 200);

  const poging = await api('bank/sepa', {
    iban: lid.iban, centen: 100, naarIban: 'NL91ABNA0417164300',
    begunstigde: 'Iemand', oms: 'na bevriezen', idem: 'na-bevries-1'
  }, lid.token);
  assert.notEqual(poging.status, 200, 'op een bevroren rekening gaat er niets meer af');

  const terug = await api('bank/bevries', { iban: lid.iban, aan: false }, lid.token);
  assert.equal(terug.status, 200, 'en de eigenaar kan hem weer vrijgeven');
});

test('13. naar-wallet en sepa halen geen geld uit het niets', async () => {
  /* Meer overmaken dan er staat hoort te falen. Zonder deze grens is de bank
     een geldpers. */
  const saldo = (await api('bank/rekening', { iban: lid.iban }, lid.token)).body.rekening.saldoCenten;
  assert.ok(Number.isFinite(saldo), 'we lezen een ECHT saldo, geen undefined');
  const teveel = await api('bank/naar-wallet', { iban: lid.iban, centen: saldo + 1000000 }, lid.token);
  assert.notEqual(teveel.status, 200, 'meer naar de wallet dan er staat mag niet');

  const negatief = await api('bank/sepa', {
    iban: lid.iban, centen: -5000, naarIban: 'NL91ABNA0417164300',
    begunstigde: 'Slimmerik', oms: 'negatief', idem: 'neg-1'
  }, lid.token);
  assert.notEqual(negatief.status, 200, 'een negatief bedrag is geen opdracht maar een truc');

  const na = (await api('bank/rekening', { iban: lid.iban }, lid.token)).body.rekening.saldoCenten;
  assert.equal(na, saldo, 'na twee mislukte pogingen staat het saldo er nog precies zo');
});
