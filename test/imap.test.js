/* IMAP: een externe mailclient die meeleest met een RTG-postvak.

   DEZE TOETS PRAAT HET PROTOCOL, ZONDER SOCKET. server/imap.js neemt regels aan
   en geeft regels terug; server/imap-server.js doet de verbinding. Die
   splitsing is precies waarom dit hier te beproeven valt met twee arrays: een
   toets met een echte verbinding erbij toetst het netwerk, niet het protocol.

   Vijf beweringen:

   1. HET RTG-WACHTWOORD WERKT HIER NIET. Alleen een apparaatsleutel, en die
      opent precies EEN postvak. Een mailclient bewaart zijn inlog jaren op
      schijf; het wachtwoord opent veel meer dan post.
   2. Intrekken werkt METEEN -- geen cache, geen tweede lijst.
   3. De vertaling klopt beide kanten op: INBOX is de map 'in', \\Flagged is de
      favoriet, en een STORE wijzigt de waarheid IN RTMAIL en niet in een
      IMAP-schaduwadministratie.
   4. De nummering is oudste-eerst en stabiel; RTMAIL levert nieuwste-eerst, en
      dat is precies het detail waar zo'n adapter op stukgaat.
   5. Wat er niet in zit (APPEND) wordt DUIDELIJK geweigerd. Een client die
      denkt dat zijn concept is opgeslagen terwijl dat niet zo is, verliest
      werk.
   Draai: node --experimental-sqlite --test test/imap.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

/* Een postvak in het klein: precies de twee lagen die de adapter aanroept.
   Geen server, geen database -- de adapter mag niet meer nodig hebben dan dit,
   en als dat ooit verandert, valt deze toets om en dat is de bedoeling. */
function maakVak(berichten) {
  const rijen = berichten.slice();
  return {
    lijst: (adres, o) => rijen.filter(m => (m.map || 'in') === (o.map || 'in'))
      .sort((a, b) => String(b.at).localeCompare(String(a.at))),   // nieuwste eerst, zoals RTMAIL
    ster: (adres, id, aan) => { const m = rijen.find(x => x.id === id); if (m) m.favoriet = !!aan; return { ok: true }; },
    verplaats: (adres, id, map) => { const m = rijen.find(x => x.id === id); if (m) m.map = map; return { ok: true }; },
    zoek: (adres, vraag) => ({ ok: true, berichten: rijen.filter(m =>
      (m.onderwerp + ' ' + m.tekst).toLowerCase().includes(String(vraag).toLowerCase())) }),
    _rijen: rijen
  };
}
const maakRtmail = (vak) => ({ lees: (adres, id) => { const m = vak._rijen.find(x => x.id === id); if (m) m.gelezen = true; return m; } });

function praat(gesprek) {
  const uit = [];
  const s = gesprek.sessie(t => uit.push(t));
  return { uit, async zeg(regel) { const n = uit.length; await s.regel(regel); return uit.slice(n).join('').split('\r\n').filter(Boolean); }, s };
}

const BERICHTEN = [
  { id: 'm1', van: 'rtg@rtmail', naar: 'lid@rtgpass.rtg', onderwerp: 'Welkom', tekst: 'de eerste',
    at: '2026-08-01T10:00:00.000Z', gelezen: true, vertrouwd: true, map: 'in', labels: [] },
  { id: 'm2', van: 'klant@buiten.test', naar: 'lid@rtgpass.rtg', onderwerp: 'Offerte', tekst: 'de tweede',
    at: '2026-08-02T10:00:00.000Z', gelezen: false, vertrouwd: false, map: 'in', labels: ['Werk'] },
  { id: 'm3', van: 'oud@rtmail', naar: 'lid@rtgpass.rtg', onderwerp: 'Opgeborgen', tekst: 'in het archief',
    at: '2026-07-01T10:00:00.000Z', gelezen: true, vertrouwd: true, map: 'archief', labels: [] }
];

function opzet() {
  const db = { data: {} };
  const sleutels = require('../server/kern/mailsleutel')({ db, save: () => {}, crypto });
  const gemaakt = sleutels.maak('lid@rtgpass.rtg', 'Laptop');
  const vak = maakVak(BERICHTEN.map(m => ({ ...m })));
  const gesprek = require('../server/imap')({ vak, rtmail: maakRtmail(vak), sleutels });
  return { sleutels, gemaakt, vak, gesprek };
}

test('een apparaatsleutel opent het postvak, een wachtwoord niet', async () => {
  const { gemaakt, gesprek } = opzet();
  assert.ok(gemaakt.sleutel, 'er is een sleutel gemaakt');
  assert.match(gemaakt.let, /niet meer te zien/);

  const c = praat(gesprek);
  const fout = await c.zeg('a1 LOGIN lid geheim123');
  assert.match(fout[0], /^a1 NO/, 'een gewoon wachtwoord werkt niet: ' + fout[0]);
  const goed = await c.zeg('a2 LOGIN lid ' + gemaakt.sleutel);
  assert.match(goed[0], /^a2 OK ingelogd op lid@rtgpass\.rtg/);
});

test('de sleutel is nergens terug te lezen, ook niet in de lijst', () => {
  const { sleutels, gemaakt } = opzet();
  const lijst = sleutels.lijst('lid@rtgpass.rtg');
  assert.equal(lijst.length, 1);
  assert.equal(lijst[0].naam, 'Laptop');
  assert.ok(!JSON.stringify(lijst).includes(gemaakt.sleutel), 'wij bewaren alleen een hash');
});

test('intrekken werkt meteen: er is geen cache en geen tweede lijst', async () => {
  const { sleutels, gemaakt, gesprek } = opzet();
  const c = praat(gesprek);
  assert.match((await c.zeg('b1 LOGIN lid ' + gemaakt.sleutel))[0], /^b1 OK/);
  const weg = sleutels.trekIn('lid@rtgpass.rtg', gemaakt.id);
  assert.equal(weg.ok, true);
  const c2 = praat(gesprek);
  assert.match((await c2.zeg('b2 LOGIN lid ' + gemaakt.sleutel))[0], /^b2 NO/, 'dezelfde sleutel opent niets meer');
});

test('de mappen vertalen, en INBOX is de map "in"', async () => {
  const { gemaakt, gesprek } = opzet();
  const c = praat(gesprek);
  await c.zeg('c1 LOGIN lid ' + gemaakt.sleutel);
  const lijst = await c.zeg('c2 LIST "" *');
  assert.ok(lijst.some(r => /"INBOX"/.test(r)));
  assert.ok(lijst.some(r => /"Archive"/.test(r)) && lijst.some(r => /"Trash"/.test(r)) && lijst.some(r => /"Sent"/.test(r)));

  const sel = await c.zeg('c3 SELECT INBOX');
  assert.ok(sel.some(r => /^\* 2 EXISTS/.test(r)), 'twee berichten in de inbox: ' + sel.join(' | '));
  const arch = await c.zeg('c4 SELECT Archive');
  assert.ok(arch.some(r => /^\* 1 EXISTS/.test(r)), 'een in het archief');
  const raar = await c.zeg('c5 SELECT Kelder');
  assert.match(raar[0], /^c5 NO/);
});

test('de nummering is oudste-eerst, ook al levert RTMAIL nieuwste-eerst', async () => {
  const { gemaakt, gesprek } = opzet();
  const c = praat(gesprek);
  await c.zeg('d1 LOGIN lid ' + gemaakt.sleutel);
  await c.zeg('d2 SELECT INBOX');
  const een = (await c.zeg('d3 FETCH 1 RFC822')).join('\n');
  assert.match(een, /Subject: Welkom/, 'bericht 1 is het OUDSTE: ' + een.slice(0, 120));
  const twee = (await c.zeg('d4 FETCH 2 RFC822')).join('\n');
  assert.match(twee, /Subject: Offerte/);
  /* Het hele bericht komt er als RFC 5322 uit, met de koppen die een client
     verwacht -- en met de RTG-vertrouwensband als eigen kop erbij. */
  assert.match(twee, /From: klant@buiten\.test/);
  assert.match(twee, /X-RTG-Vertrouwd: nee/);
  assert.match(een, /X-RTG-Vertrouwd: ja/);
});

test('vlaggen vertalen, en een STORE wijzigt de waarheid IN het postvak', async () => {
  const { gemaakt, gesprek, vak } = opzet();
  const c = praat(gesprek);
  await c.zeg('e1 LOGIN lid ' + gemaakt.sleutel);
  await c.zeg('e2 SELECT INBOX');
  const voor = (await c.zeg('e3 FETCH 2 FLAGS')).join(' ');
  assert.ok(!/\\Seen/.test(voor), 'de offerte is nog ongelezen');
  assert.ok(/Werk/.test(voor), 'het etiket komt mee als sleutelwoord');

  await c.zeg('e4 STORE 2 +FLAGS (\\Flagged)');
  assert.equal(vak._rijen.find(m => m.id === 'm2').favoriet, true,
    'de ster staat in het POSTVAK, niet in een IMAP-schaduwlijst');
  await c.zeg('e5 STORE 2 +FLAGS (\\Seen)');
  assert.equal(vak._rijen.find(m => m.id === 'm2').gelezen, true);
  const na = (await c.zeg('e6 FETCH 2 FLAGS')).join(' ');
  assert.match(na, /\\Seen/);
  assert.match(na, /\\Flagged/);
});

test('\\Deleted verplaatst naar de prullenbak in plaats van te wissen', async () => {
  const { gemaakt, gesprek, vak } = opzet();
  const c = praat(gesprek);
  await c.zeg('f1 LOGIN lid ' + gemaakt.sleutel);
  await c.zeg('f2 SELECT INBOX');
  await c.zeg('f3 STORE 1 +FLAGS (\\Deleted)');
  assert.equal(vak._rijen.find(m => m.id === 'm1').map, 'prullenbak',
    'weggooien is ook via IMAP een MAP en geen vernietiging');
});

test('SEARCH geeft de nummers van deze map terug', async () => {
  const { gemaakt, gesprek } = opzet();
  const c = praat(gesprek);
  await c.zeg('g1 LOGIN lid ' + gemaakt.sleutel);
  await c.zeg('g2 SELECT INBOX');
  const r = await c.zeg('g3 SEARCH TEXT "offerte"');
  assert.match(r[0], /^\* SEARCH 2$/, 'de offerte is nummer 2: ' + r.join(' | '));
  const leeg = await c.zeg('g4 SEARCH TEXT "bestaatniet"');
  assert.match(leeg[0], /^\* SEARCH$/);
});

test('APPEND wordt duidelijk geweigerd in plaats van stil te mislukken', async () => {
  const { gemaakt, gesprek } = opzet();
  const c = praat(gesprek);
  await c.zeg('h1 LOGIN lid ' + gemaakt.sleutel);
  await c.zeg('h2 SELECT INBOX');
  const r = await c.zeg('h3 APPEND INBOX {10}');
  assert.match(r[0], /^h3 NO APPEND kan hier niet/);
  assert.match(r[0], /RTG Mail zelf/, 'met waar het dan wel kan');
});

test('zonder inloggen komt er niets uit', async () => {
  const { gesprek } = opzet();
  const c = praat(gesprek);
  assert.match((await c.zeg('i1 SELECT INBOX'))[0], /^i1 NO log eerst in/);
  assert.match((await c.zeg('i2 FETCH 1 RFC822'))[0], /^i2 NO log eerst in/);
  // CAPABILITY en LOGOUT mogen wel: die verraden niets
  assert.ok((await c.zeg('i3 CAPABILITY')).some(r => /IMAP4rev1/.test(r)));
});
