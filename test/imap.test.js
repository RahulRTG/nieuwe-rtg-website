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
   5. APPEND doet wat het belooft en niets meer: met de conceptenlaag erbij
      schrijft het een CONCEPT (nooit ontvangen post -- zie imap-schrijf.js),
      en zonder die laag wordt het DUIDELIJK geweigerd. Een client die
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

test('ZONDER de conceptenlaag wordt APPEND duidelijk geweigerd, en niet stil', async () => {
  /* Deze opstelling geeft de adapter alleen een LEESVAK mee. Dan bestaat de map
     Drafts niet en kan APPEND niets, en dat hoort hij te ZEGGEN -- een client
     die denkt dat zijn concept is opgeslagen terwijl dat niet zo is, verliest
     werk. Met de conceptenlaag erbij kan het wel; dat staat verderop. */
  const { gemaakt, gesprek } = opzet();
  const c = praat(gesprek);
  await c.zeg('h1 LOGIN lid ' + gemaakt.sleutel);
  await c.zeg('h2 SELECT INBOX');
  const r = await c.zeg('h3 APPEND INBOX {10}');
  assert.match(r[0], /^h3 NO APPEND kan hier niet/);
  assert.match(r[0], /RTG Mail zelf/, 'met waar het dan wel kan');
  // en Drafts staat dan ook niet in de mappenlijst; beloven wat je niet hebt is erger
  const lijst = await c.zeg('h4 LIST "" *');
  assert.ok(!lijst.some(r2 => /Drafts/.test(r2)), 'geen Drafts zonder conceptenlaag');
});

test('zonder inloggen komt er niets uit', async () => {
  const { gesprek } = opzet();
  const c = praat(gesprek);
  assert.match((await c.zeg('i1 SELECT INBOX'))[0], /^i1 NO log eerst in/);
  assert.match((await c.zeg('i2 FETCH 1 RFC822'))[0], /^i2 NO log eerst in/);
  // CAPABILITY en LOGOUT mogen wel: die verraden niets
  assert.ok((await c.zeg('i3 CAPABILITY')).some(r => /IMAP4rev1/.test(r)));
});

/* ---------------------------------------------------------------------------
   DE SCHRIJFKANT: Drafts, APPEND en IDLE (TAKEN.md 5.13)

   De opzet hieronder geeft de adapter WEL een conceptenlaag mee -- de echte
   kern/rtmail-schrijf.js, niet een namaak, want juist het gedrag dat hier
   telt (dat `van` uit de INLOG komt en niet uit de brief) zit in die module.
   --------------------------------------------------------------------------- */
function opzetMetPen() {
  const db = { data: {} };
  const sleutels = require('../server/kern/mailsleutel')({ db, save: () => {}, crypto });
  const gemaakt = sleutels.maak('lid@rtgpass.rtg', 'Laptop');
  const vak = maakVak(BERICHTEN.map(m => ({ ...m })));
  // de echte conceptenlaag; rtmail levert alleen de adresnormalisatie die zij vraagt
  const schrijf = require('../server/kern/rtmail-schrijf')({
    db, save: () => {}, crypto,
    rtmail: { normAdres: (a) => String(a || '').trim().toLowerCase(), lees: maakRtmail(vak).lees },
    vak, notify: () => {}, sseToCustomer: () => {}
  });
  const gesprek = require('../server/imap')({ vak, rtmail: maakRtmail(vak), sleutels, schrijf });
  return { sleutels, gemaakt, vak, schrijf, gesprek };
}
const BRIEF = ['From: iemand@elders.test', 'To: klant@buiten.test', 'Subject: Mijn concept',
  '', 'Dit is de tekst.'].join('\r\n');

test('11. Drafts staat in de mappenlijst en is te openen', async () => {
  const { gemaakt, gesprek } = opzetMetPen();
  const c = praat(gesprek);
  await c.zeg('j1 LOGIN lid ' + gemaakt.sleutel);
  const lijst = await c.zeg('j2 LIST "" *');
  assert.ok(lijst.some(r => /"Drafts"/.test(r)), 'Drafts staat erbij');
  assert.ok(lijst.some(r => /\\Drafts.*"Drafts"/.test(r)), 'en is als conceptmap gemerkt, zodat een client hem herkent');
  const sel = await c.zeg('j3 SELECT Drafts');
  assert.ok(sel.some(r => /^\* 0 EXISTS$/.test(r)), 'nog geen concepten');
  assert.ok(sel.some(r => /^j3 OK \[READ-WRITE\]/.test(r)));
});

test('12. APPEND legt een CONCEPT af, en de afzender komt uit de inlog en niet uit de brief', async () => {
  const { gemaakt, gesprek, schrijf } = opzetMetPen();
  const c = praat(gesprek);
  await c.zeg('k1 LOGIN lid ' + gemaakt.sleutel);
  const plus = await c.zeg('k2 APPEND "Drafts" {' + Buffer.byteLength(BRIEF + '\r\n') + '}');
  assert.match(plus[0], /^\+ /, 'de server vraagt om de brief');

  // de brief komt regel voor regel binnen, precies zoals over een socket
  let laatste = [];
  for (const regel of BRIEF.split('\r\n')) laatste = await c.zeg(regel);
  assert.ok(laatste.some(r => /^k2 OK .*APPEND klaar/.test(r)), 'APPEND is klaar: ' + JSON.stringify(laatste));

  const concepten = schrijf.concepten('lid@rtgpass.rtg');
  assert.equal(concepten.length, 1, 'er staat precies EEN concept');
  assert.equal(concepten[0].onderwerp, 'Mijn concept', 'het onderwerp uit de kop');
  assert.equal(concepten[0].naar, 'klant@buiten.test', 'en de ontvanger');
  assert.match(concepten[0].tekst, /Dit is de tekst/, 'en het lijf');

  /* DE KERN VAN DEZE TOETS. De brief zegt `From: iemand@elders.test`. Dat mag
     nergens landen: een client die zijn afzender kan kiezen, kan post
     VERZINNEN in het postvak van de eigenaar -- met een From van je bank. De
     conceptenlaag zet `van` op het adres waarop is ingelogd en kijkt niet naar
     de kop, en dat hoort zichtbaar vast te liggen. */
  assert.ok(!JSON.stringify(concepten).includes('iemand@elders.test'),
    'de From-kop van de client is nergens overgenomen');
});

test('13. APPEND kan ALLEEN in Drafts -- een client maakt geen ontvangen post', async () => {
  const { gemaakt, gesprek, schrijf } = opzetMetPen();
  const c = praat(gesprek);
  await c.zeg('l1 LOGIN lid ' + gemaakt.sleutel);
  for (const map of ['INBOX', 'Archive', 'Sent', 'Trash']) {
    const r = await c.zeg('l2 APPEND "' + map + '" {10}');
    assert.match(r[0], /^l2 NO APPEND kan hier alleen in Drafts/, map + ' wordt geweigerd');
    assert.match(r[0], /verzinnen/, 'met de reden erbij: ' + r[0]);
  }
  assert.equal(schrijf.concepten('lid@rtgpass.rtg').length, 0, 'en er is niets weggeschreven');
  // een onbegrepen APPEND is een nette weigering en geen open literal
  assert.match((await c.zeg('l3 APPEND Drafts zonder-omvang'))[0], /^l3 NO onbegrepen APPEND/);
});

test('14. tijdens een APPEND is een regel BRIEF en geen commando', async () => {
  /* Als de inhoud van een bericht als commando zou worden gelezen, kan een
     brief de sessie besturen -- LOGOUT halverwege een concept, of erger. */
  const { gemaakt, gesprek, schrijf } = opzetMetPen();
  const c = praat(gesprek);
  await c.zeg('m1 LOGIN lid ' + gemaakt.sleutel);
  const brief = ['From: x@y.test', 'To: a@b.test', 'Subject: Truc', '', 'm9 LOGOUT'].join('\r\n');
  await c.zeg('m2 APPEND Drafts {' + Buffer.byteLength(brief + '\r\n') + '}');
  let laatste = [];
  for (const regel of brief.split('\r\n')) laatste = await c.zeg(regel);
  assert.ok(laatste.some(r => /^m2 OK/.test(r)), 'de APPEND is netjes afgerond');
  assert.ok(!laatste.some(r => /BYE/.test(r)), 'en er is geen LOGOUT uitgevoerd');
  assert.match(schrijf.concepten('lid@rtgpass.rtg')[0].tekst, /m9 LOGOUT/,
    'die regel staat gewoon in de tekst van het concept');
});

test('15. een concept is te lezen en weg te gooien vanuit de client', async () => {
  const { gemaakt, gesprek, schrijf } = opzetMetPen();
  const c = praat(gesprek);
  await c.zeg('n1 LOGIN lid ' + gemaakt.sleutel);
  schrijf.bewaar('lid@rtgpass.rtg', { naar: 'a@b.test', onderwerp: 'Eerste', tekst: 'een' });
  schrijf.bewaar('lid@rtgpass.rtg', { naar: 'c@d.test', onderwerp: 'Tweede', tekst: 'twee' });
  const sel = await c.zeg('n2 SELECT Drafts');
  assert.ok(sel.some(r => /^\* 2 EXISTS$/.test(r)), 'twee concepten');

  const f = await c.zeg('n3 FETCH 1 RFC822');
  assert.ok(f.some(r => /Subject: Eerste/.test(r)), 'oudste eerst, zoals in elke andere map');
  assert.ok(f.some(r => /From: lid@rtgpass\.rtg/.test(r)), 'en op naam van de eigenaar');
  assert.ok(f.some(r => /FLAGS \(.*\\Draft/.test(r)), 'met de \\Draft-vlag, zodat de client weet wat het is');

  // zoeken werkt binnen de conceptmap zelf, en zegt niet stil "geen treffers"
  assert.match((await c.zeg('n4 SEARCH TEXT "twee"'))[0], /^\* SEARCH 2$/);

  const weg = await c.zeg('n5 STORE 1 +FLAGS (\\Deleted)');
  assert.match(weg[0], /^n5 OK concept weggegooid/);
  assert.equal(schrijf.concepten('lid@rtgpass.rtg').length, 1, 'er staat er nog een');
  // en een vlag die op een concept niets betekent, doet ook niets -- zonder te liegen
  assert.match((await c.zeg('n6 STORE 1 +FLAGS (\\Flagged)'))[0], /^n6 OK op een concept doet die vlag niets/);
});

test('16. IDLE meldt nieuwe post, en DONE sluit hem af', async () => {
  const { gemaakt, gesprek, vak } = opzetMetPen();
  const c = praat(gesprek);
  await c.zeg('p1 LOGIN lid ' + gemaakt.sleutel);
  await c.zeg('p2 SELECT INBOX');
  assert.match((await c.zeg('p3 IDLE'))[0], /^\+ idling/, 'de server gaat wachten');
  assert.equal(c.s.idlet, true, 'en de sessie weet dat hij idle staat');

  // zolang een IDLE loopt is er niets anders te doen dan DONE
  assert.match((await c.zeg('p4 FETCH 1 RFC822'))[0], /sluit eerst de IDLE af met DONE/);

  /* Er komt post binnen. De lus tikt elke IDLE_MS, dus we wachten iets langer
     dan een tik -- en dat is de enige plek in deze toets waar tijd meespeelt. */
  vak._rijen.push({ id: 'm9', van: 'nieuw@buiten.test', naar: 'lid@rtgpass.rtg', onderwerp: 'Vers',
    tekst: 'net binnen', at: '2026-08-03T10:00:00.000Z', gelezen: false, vertrouwd: false, map: 'in', labels: [] });
  const voor = c.uit.length;
  await new Promise(r => setTimeout(r, gesprek.IDLE_MS + 800));
  const geduwd = c.uit.slice(voor).join('');
  assert.match(geduwd, /\* 3 EXISTS/, 'de client wordt bijgepraat zonder erom te vragen: ' + JSON.stringify(geduwd));
  assert.match(geduwd, /\* 1 RECENT/, 'met hoeveel er bij kwamen');

  const klaar = await c.zeg('DONE');
  assert.match(klaar[0], /^p3 OK IDLE klaar/, 'het antwoord draagt het merk van de IDLE, niet van DONE');
  assert.equal(c.s.idlet, false, 'en de lus staat stil');
  // en daarna doet de sessie weer gewoon mee
  assert.ok((await c.zeg('p5 FETCH 1 RFC822')).some(r => /^p5 OK FETCH klaar/.test(r)));
});

test('17. een kale DONE zonder IDLE is een nette klacht, en CAPABILITY belooft IDLE', async () => {
  const { gemaakt, gesprek } = opzetMetPen();
  const c = praat(gesprek);
  assert.ok((await c.zeg('q1 CAPABILITY')).some(r => /IDLE/.test(r)),
    'IDLE staat in CAPABILITY -- en dat mag alleen omdat hij ook echt werkt');
  await c.zeg('q2 LOGIN lid ' + gemaakt.sleutel);
  assert.match((await c.zeg('DONE'))[0], /er liep geen IDLE/);
  // IDLE zonder open map is geen half antwoord maar een weigering met reden
  assert.match((await c.zeg('q3 IDLE'))[0], /^q3 NO kies eerst een map met SELECT/);
  /* LOGOUT ruimt een lopende IDLE op, en dat is de enige uitzondering op
     "tijdens IDLE alleen DONE": een client die afscheid neemt, laat je niet
     wachten op een DONE die nooit komt. Deze regel wees een echte fout aan --
     de opruiming in de LOGOUT-tak was onbereikbaar zolang de IDLE-wacht er
     onvoorwaardelijk voor stond, en dan beloofde die tak iets wat hij nooit
     deed. */
  await c.zeg('q4 SELECT INBOX');
  await c.zeg('q5 IDLE');
  assert.equal(c.s.idlet, true);
  await c.zeg('q6 LOGOUT');
  assert.equal(c.s.idlet, false, 'LOGOUT stopt de lus');
});

test('18. na DONE staat de lus ECHT stil, en niet alleen de vlag', async () => {
  /* DEZE TOETS BESTAAT OMDAT TOETS 16 HEM MISTE. Daar werd na DONE alleen
     `idlet` nagekeken -- de boekhouding. Een mutatie die de timer laat DRAAIEN
     en alleen de vlag wist, kwam daar ongestraft door: dan blijft er per
     afgesloten IDLE een lus achter die elke paar seconden een postvak inleest
     en naar de client schrijft. Onzichtbaar, tot een proces begint te knijpen.

     Het verschil is alleen te zien door te WACHTEN tot de lus weer getikt zou
     hebben en dan te eisen dat er NIETS komt. Daarom draait deze sessie op een
     korte tussentijd (`idleMs`, dat alleen daarvoor bestaat): dezelfde bewering,
     een fractie van de tijd. */
  const db = { data: {} };
  const sleutels = require('../server/kern/mailsleutel')({ db, save: () => {}, crypto });
  const gemaakt = sleutels.maak('lid@rtgpass.rtg', 'Laptop');
  const vak = maakVak(BERICHTEN.map(m => ({ ...m })));
  const gesprek = require('../server/imap')({ vak, rtmail: maakRtmail(vak), sleutels, idleMs: 60 });
  assert.equal(gesprek.IDLE_MS, 60, 'de korte tussentijd is echt overgenomen');

  const c = praat(gesprek);
  await c.zeg('r1 LOGIN lid ' + gemaakt.sleutel);
  await c.zeg('r2 SELECT INBOX');
  await c.zeg('r3 IDLE');

  // eerst de POSITIEVE kant: er komt post en de lus meldt het
  vak._rijen.push({ id: 'x1', van: 'a@b.test', naar: 'lid@rtgpass.rtg', onderwerp: 'Een',
    tekst: 'x', at: '2026-08-04T10:00:00.000Z', gelezen: false, vertrouwd: false, map: 'in', labels: [] });
  await new Promise(r => setTimeout(r, 250));
  assert.match(c.uit.join(''), /EXISTS/, 'de lus tikt en meldt');

  await c.zeg('DONE');
  assert.equal(c.s.idlet, false, 'de vlag staat uit');

  /* EN NU DE KERN: nog een bericht, en er mag NIETS meer komen. Bleef de timer
     draaien, dan staat hier alsnog een EXISTS. */
  const voor = c.uit.length;
  vak._rijen.push({ id: 'x2', van: 'c@d.test', naar: 'lid@rtgpass.rtg', onderwerp: 'Twee',
    tekst: 'y', at: '2026-08-05T10:00:00.000Z', gelezen: false, vertrouwd: false, map: 'in', labels: [] });
  await new Promise(r => setTimeout(r, 400));
  assert.equal(c.uit.slice(voor).join(''), '', 'na DONE komt er niets meer over de lijn');
});
