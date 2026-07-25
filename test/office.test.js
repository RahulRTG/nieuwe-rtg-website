/* RTG Office: het eigen kantoorpakket. Tekstdocumenten en rekenbladen op het
   account (op elk toestel terug), alleen-lezen delen op codenaam (nooit op
   echte naam), en per-lid/per-document begrenzingen. Draai los:
   node --experimental-sqlite --test test/office.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, lidA, lidB, codeB;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-office-'));

function api(pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}
let seq = 0;
async function lid() {
  const u = (Date.now() + (++seq)).toString().slice(-8);
  const reg = await api('/api/auth/register', { name: 'Lid ' + seq, email: 'of' + u + '@x.nl', phone: '06' + u,
    password: 'geheim123', geboortedatum: '1990-05-05', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' });
  const st = await api('/api/state', {}, reg.body.token);
  return { token: reg.body.token, codenaam: st.body.state.user.codename };
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const a = await lid(); const b = await lid();
  lidA = a.token; lidB = b.token; codeB = b.codenaam;
  assert.ok(lidA && lidB && codeB, 'twee leden ingelogd, codenaam van B bekend');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('1. een tekstdocument: maken, bewaren (autosave), en terug op het account', async () => {
  const m = await api('/api/kantoorpakket/maak', { soort: 'tekst', titel: 'Mijn notitie' }, lidA);
  assert.equal(m.status, 200);
  const id = m.body.id;
  const bw = await api('/api/kantoorpakket/bewaar', { id, titel: 'Reisplan', inhoud: { tekst: '<b>Ibiza</b> in juli' } }, lidA);
  assert.equal(bw.status, 200);
  const op = await api('/api/kantoorpakket/open', { id }, lidA);
  assert.equal(op.body.titel, 'Reisplan');
  assert.equal(op.body.inhoud.tekst, '<b>Ibiza</b> in juli');
  assert.equal(op.body.magBewerken, true);
  const mijn = await api('/api/kantoorpakket/mijn', {}, lidA);
  assert.ok(mijn.body.docs.some(d => d.id === id && d.titel === 'Reisplan'), 'het staat in de mappenlijst');
});

test('2. een rekenblad: formules blijven bewaard; de server rekent niet, de app wel', async () => {
  const m = await api('/api/kantoorpakket/maak', { soort: 'blad' }, lidA);
  const id = m.body.id;
  const bw = await api('/api/kantoorpakket/bewaar', { id, inhoud: { cellen: { A1: '2', A2: '3', A3: '=SOM(A1:A2)' }, rijen: 20, kolommen: 8 } }, lidA);
  assert.equal(bw.status, 200);
  const op = await api('/api/kantoorpakket/open', { id }, lidA);
  assert.equal(op.body.inhoud.cellen.A3, '=SOM(A1:A2)', 'de formule blijft bewaard');
  // een vreemde celverwijzing wordt genegeerd (schoonmaak)
  await api('/api/kantoorpakket/bewaar', { id, inhoud: { cellen: { A1: '5', ZZ999: 'x', 'lelijk!': 'y' } } }, lidA);
  const op2 = await api('/api/kantoorpakket/open', { id }, lidA);
  assert.equal(op2.body.inhoud.cellen.A1, '5');
  assert.ok(!('lelijk!' in op2.body.inhoud.cellen), 'ongeldige celref eruit gefilterd');
});

test('3. delen op codenaam (alleen lezen); B ziet mee maar mag niet bewerken', async () => {
  const m = await api('/api/kantoorpakket/maak', { soort: 'tekst', titel: 'Gedeeld stuk' }, lidA);
  const id = m.body.id;
  await api('/api/kantoorpakket/bewaar', { id, inhoud: { tekst: 'lees mij' } }, lidA);
  // onbekende codenaam kan niet
  const fout = await api('/api/kantoorpakket/deel', { id, codenaam: 'BestaatNiet999' }, lidA);
  assert.equal(fout.status, 404);
  const deel = await api('/api/kantoorpakket/deel', { id, codenaam: codeB }, lidA);
  assert.equal(deel.status, 200);
  // B ziet het in "met mij gedeeld" en kan het openen, maar niet bewerken
  const mijnB = await api('/api/kantoorpakket/mijn', {}, lidB);
  assert.ok(mijnB.body.gedeeld.some(d => d.id === id), 'B ziet het gedeelde document');
  const opB = await api('/api/kantoorpakket/open', { id }, lidB);
  assert.equal(opB.body.magBewerken, false, 'alleen lezen');
  assert.equal(opB.body.inhoud.tekst, 'lees mij');
  const schrijfB = await api('/api/kantoorpakket/bewaar', { id, inhoud: { tekst: 'gekaapt' } }, lidB);
  assert.equal(schrijfB.status, 403, 'B mag niet schrijven');
  const wegB = await api('/api/kantoorpakket/weg', { id }, lidB);
  assert.equal(wegB.status, 403, 'en niet verwijderen');
  // A trekt het delen weer in
  await api('/api/kantoorpakket/deel', { id, codenaam: codeB, aan: false }, lidA);
  const opNa = await api('/api/kantoorpakket/open', { id }, lidB);
  assert.equal(opNa.status, 403, 'na intrekken kan B er niet meer bij');
});

test('4. privacy en eigendom: alleen de eigenaar beheert; een gast mag niet in Office', async () => {
  const m = await api('/api/kantoorpakket/maak', { soort: 'tekst' }, lidA);
  const wegAnder = await api('/api/kantoorpakket/weg', { id: m.body.id }, lidB);
  assert.equal(wegAnder.status, 403, 'B mag A\'s document niet verwijderen (geen eigenaar)');
  const gast = (await api('/api/login', { tier: 'guest', pasApp: 'rtg' })).body.token;
  assert.equal((await api('/api/kantoorpakket/mijn', {}, gast)).status, 403, 'de gratis app heeft geen Office');
  const eigen = await api('/api/kantoorpakket/weg', { id: m.body.id }, lidA);
  assert.equal(eigen.status, 200, 'de eigenaar verwijdert wel');
});

test('5. de drive vertelt wat er in een stuk zit, en markeren zet het bovenaan', async () => {
  const t = await api('/api/kantoorpakket/maak', { soort: 'tekst', titel: 'Kort memo' }, lidA);
  await api('/api/kantoorpakket/bewaar', { id: t.body.id, inhoud: { tekst: '<p>een twee drie vier</p>' } }, lidA);
  const b = await api('/api/kantoorpakket/maak', { soort: 'blad', titel: 'Cijfers' }, lidA);
  await api('/api/kantoorpakket/bewaar', { id: b.body.id, inhoud: { cellen: { A1: '1', A2: '2' }, rijen: 5, kolommen: 3 } }, lidA);

  const mijn = await api('/api/kantoorpakket/mijn', {}, lidA);
  const memo = mijn.body.docs.find(d => d.id === t.body.id);
  const cijfers = mijn.body.docs.find(d => d.id === b.body.id);
  assert.equal(memo.omvang, '4 woorden', 'een tekst telt in woorden');
  assert.equal(cijfers.omvang, '2 cellen', 'een blad telt in cellen');
  assert.equal(memo.vanMij, true, 'de drive weet dat dit uw eigen stuk is');
  assert.equal(memo.ster, false);

  const ster = await api('/api/kantoorpakket/ster', { id: t.body.id, aan: true }, lidA);
  assert.equal(ster.status, 200);
  assert.equal((await api('/api/kantoorpakket/mijn', {}, lidA)).body.docs
    .find(d => d.id === t.body.id).ster, true, 'de markering blijft staan');
  assert.equal((await api('/api/kantoorpakket/ster', { id: t.body.id, aan: true }, lidB)).status, 403,
    'een ander markeert niets in uw map');
});

test('6. de sjablonen zijn kantoorwerk, met groep en werkende formules', async () => {
  const mijn = await api('/api/kantoorpakket/mijn', {}, lidA);
  const sj = mijn.body.sjablonen;
  assert.ok(sj.length >= 10, 'er staat een echte sjabloonkast klaar (nu ' + sj.length + ')');
  assert.ok(sj.every(s => s.groep), 'elk sjabloon hoort bij een groep');
  const groepen = [...new Set(sj.map(s => s.groep))];
  for (const g of ['Bestuur', 'Financieel', 'Commercieel', 'Juridisch']) {
    assert.ok(groepen.includes(g), 'de groep ' + g + ' bestaat');
  }
  // een begroting komt met formules en celopmaak uit de kast
  const m = await api('/api/kantoorpakket/maak', { sjabloon: 'begroting' }, lidA);
  assert.equal(m.status, 200);
  const o = await api('/api/kantoorpakket/open', { id: m.body.id }, lidA);
  assert.equal(o.body.soort, 'blad');
  assert.equal(o.body.inhoud.cellen.F2, '=SOM(B2:E2)', 'de formule staat er echt in');
  assert.equal(o.body.inhoud.opmaak.F2, 'geld', 'en de cel weet dat het geld is');
  assert.equal(o.body.inhoud.opmaak.A1, 'kop');
  // een deck komt met indelingen en sprekersnotities
  const p = await api('/api/kantoorpakket/maak', { sjabloon: 'boardpack' }, lidA);
  const po = await api('/api/kantoorpakket/open', { id: p.body.id }, lidA);
  assert.equal(po.body.inhoud.dias[0].indeling, 'titel');
  assert.ok(po.body.inhoud.dias.some(d => d.notitie), 'er staat een sprekersnotitie bij');
});

test('7. vreemde celopmaak en dia-indelingen komen de opslag niet in', async () => {
  const b = await api('/api/kantoorpakket/maak', { soort: 'blad' }, lidA);
  await api('/api/kantoorpakket/bewaar', { id: b.body.id, inhoud: { cellen: { A1: '1' },
    opmaak: { A1: 'geld', A2: 'onzin', 'niet-een-cel': 'kop' }, rijen: 5, kolommen: 3 } }, lidA);
  const o = await api('/api/kantoorpakket/open', { id: b.body.id }, lidA);
  assert.equal(o.body.inhoud.opmaak.A1, 'geld');
  assert.equal(o.body.inhoud.opmaak.A2, undefined, 'een onbekende opmaak wordt geweigerd');
  assert.equal(o.body.inhoud.opmaak['niet-een-cel'], undefined, 'en een niet-cel ook');

  const p = await api('/api/kantoorpakket/maak', { soort: 'presentatie' }, lidA);
  await api('/api/kantoorpakket/bewaar', { id: p.body.id, inhoud: { dias: [
    { indeling: 'cijfer', titel: 'Een', tekst: '1', notitie: 'zeg het cijfer' },
    { indeling: 'hakketak', titel: 'Twee', tekst: '2' }
  ] } }, lidA);
  const po = await api('/api/kantoorpakket/open', { id: p.body.id }, lidA);
  assert.equal(po.body.inhoud.dias[0].indeling, 'cijfer');
  assert.equal(po.body.inhoud.dias[0].notitie, 'zeg het cijfer');
  assert.equal(po.body.inhoud.dias[1].indeling, 'punten', 'een onbekende indeling valt terug op punten');
});

test('8. Rahul leest mee met meer dan drie opdrachten, en weigert wat hij niet kent', async () => {
  const t = await api('/api/kantoorpakket/maak', { soort: 'tekst', titel: 'Notitie' }, lidA);
  await api('/api/kantoorpakket/bewaar', { id: t.body.id,
    inhoud: { tekst: '<p>Jan levert het rapport voor vrijdag. De cijfers moeten nog onderbouwd.</p>' } }, lidA);
  for (const opdracht of ['samenvatten', 'herschrijven', 'inkorten', 'actiepunten', 'kritisch', 'engels']) {
    const r = await api('/api/kantoorpakket/ai', { id: t.body.id, opdracht }, lidA);
    assert.equal(r.status, 200, opdracht + ' bestaat');
    assert.ok(r.body.voorstel && r.body.voorstel.length > 10, opdracht + ' levert een leesbaar voorstel');
  }
  const raar = await api('/api/kantoorpakket/ai', { id: t.body.id, opdracht: 'verzin-maar-wat' }, lidA);
  assert.equal(raar.status, 400, 'een onbekende opdracht wordt geweigerd');
});
