/* De MAILINFRASTRUCTUUR: de verzendwachtrij en de buitenpoort.

   Vier beweringen, en ze gaan alle vier over wat er gebeurt als het MISGAAT --
   want dat is waar een mailsysteem zich onderscheidt van een verzendknop:

   1. Een tijdelijke fout leidt tot opnieuw proberen met een OPLOPENDE
      wachttijd; een permanente nooit. Het verschil komt uit de verzendlaag
      (server/smtp-direct.js) en wordt hier omgezet in gedrag.
   2. Wat na de laatste poging niet weg is, verdwijnt niet maar gaat opzij MET
      de laatste foutmelding. Een wachtrij die stilletjes leegloopt is erger
      dan geen wachtrij.
   3. Twee keer hetzelfde bericht levert EEN bezorging op.
   4. De buitenpoort bewaart het originele bericht onveranderd en levert een
      afgeleide af in de onbetrouwde baan -- met de uitslag van de controles
      erbij, ook als die "niet gecontroleerd" is.
   Draai: node --experimental-sqlite --test test/mailpost.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');

let BASE, child, lidTok, lidAdres;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-mailpost-'));

const rauw = (pad, body, tok, kop) => {
  const h = Object.assign({ 'Content-Type': 'application/json' }, kop || {});
  if (tok) h.Authorization = 'Bearer ' + tok;
  return fetch(BASE + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
};
const post = async (pad, body, tok, kop) => (await rauw(pad, body, tok, kop)).body;


test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const reg = await post('/api/auth/register', { name: 'Poort Lid', email: 'poort@x.nl',
    phone: '0612345661', password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  lidTok = reg.token;
  lidAdres = (await post('/api/member/rtmail/adres', {}, lidTok)).adres;
  assert.ok(lidAdres, 'het lid heeft een adres');
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

/* ---- de wachtrij, als eenheid (geen server nodig) ---- */
const maakQ = (verzend) => {
  const db = { data: {} };
  const q = require('../server/kern/mailwachtrij')({ db, save: () => {}, crypto: require('crypto'), verzend });
  /* De klok vooruitzetten. De wachttijden zijn 1 tot 240 minuten; die uitzitten
     kan een toets niet, en een wachtrij met kunstmatig korte tijden zou iets
     ANDERS toetsen dan wat er draait. We zetten daarom de afspraak zelf terug
     in het verleden -- precies wat het verstrijken van de tijd ook doet. */
  q._klokVooruit = () => { for (const r of (db.data.mailQ || {}).rijen || []) r.volgende = new Date(Date.now() - 1000).toISOString(); };
  q._db = db;
  return q;
};

test('een tijdelijke fout leidt tot opnieuw proberen met oplopende wachttijd', async () => {
  let pogingen = 0;
  const q = maakQ(async () => { pogingen++; return { ok: false, soort: 'tijdelijk', waarom: '451 even geen ruimte' }; });
  q.zet({ naar: 'iemand@voorbeeld.test', onderwerp: 'Hoi', tekst: 'de tekst' });
  const r1 = await q.werk();
  assert.equal(r1.geprobeerd, 1);
  assert.equal(r1.opnieuw, 1);
  assert.equal(pogingen, 1);
  // meteen nog een ronde doet NIETS: de volgende poging staat in de toekomst
  const r2 = await q.werk();
  assert.equal(r2.geprobeerd, 0, 'er wordt niet meteen opnieuw gebonsd');
  const s = q.stand();
  assert.equal(s.wacht, 1);
  assert.equal(s.aanDeBeurt, 0);
  assert.equal(s.rijen[0].laatsteFout, '451 even geen ruimte');
  assert.deepEqual(s.wachttijden, [1, 5, 15, 60, 240]);
});

test('een permanente fout wordt NOOIT herhaald en gaat meteen opzij', async () => {
  let pogingen = 0;
  const q = maakQ(async () => { pogingen++; return { ok: false, soort: 'permanent', waarom: '550 bestaat niet' }; });
  q.zet({ naar: 'weg@voorbeeld.test', onderwerp: 'Hoi', tekst: 'x' });
  const r = await q.werk();
  assert.equal(r.permanent, 1);
  assert.equal(r.opnieuw, 0);
  assert.equal(q.stand().wacht, 0, 'niet meer in de wachtrij');
  assert.equal(q.stand().dood.permanent, 1);
  await q.werk();
  assert.equal(pogingen, 1, 'er is geen tweede poging gedaan');
});

test('na de laatste poging gaat het bericht opzij MET de foutmelding', async () => {
  let pogingen = 0;
  const q = maakQ(async () => { pogingen++; return { ok: false, soort: 'tijdelijk', waarom: '421 server weg' }; });
  q.zet({ naar: 'traag@voorbeeld.test', onderwerp: 'Hoi', tekst: 'x' });

  // vijf wachttijden, dus vijf pogingen; daarna is hij op
  const wachttijden = q.stand().wachttijden.length;
  for (let i = 0; i < wachttijden; i++) {
    q._klokVooruit();
    const r = await q.werk();
    assert.equal(r.geprobeerd, 1, 'ronde ' + (i + 1) + ' heeft een poging gedaan');
  }
  assert.equal(pogingen, wachttijden, 'precies vijf pogingen, niet meer');
  const s = q.stand();
  assert.equal(s.wacht, 0, 'de wachtrij is leeg');
  assert.equal(s.dood.opgegeven, 1, 'maar het bericht is niet verdwenen');
  const opzij = s.laatste.find(r => r.soort === 'opgegeven');
  assert.equal(opzij.laatsteFout, '421 server weg', 'met de laatste foutmelding erbij');
  assert.equal(opzij.pogingen, wachttijden);
  assert.equal(opzij.naar, 'traag@voorbeeld.test');

  // en een zesde ronde raakt hem niet meer aan
  q._klokVooruit();
  const na = await q.werk();
  assert.equal(na.geprobeerd, 0);
  assert.equal(pogingen, wachttijden);
});

test('twee keer hetzelfde bericht levert EEN bezorging op', async () => {
  let verstuurd = 0;
  const q = maakQ(async () => { verstuurd++; return { ok: true, soort: 'bezorgd' }; });
  const a = q.zet({ naar: 'klant@voorbeeld.test', onderwerp: 'Bevestiging', tekst: 'uw boeking' });
  const b = q.zet({ naar: 'klant@voorbeeld.test', onderwerp: 'Bevestiging', tekst: 'uw boeking' });
  assert.equal(a.dubbel, false);
  assert.equal(b.dubbel, true, 'de tweede is herkend als dubbel');
  assert.equal(b.id, a.id, 'en wijst naar dezelfde regel');
  const r = await q.werk();
  assert.equal(r.bezorgd, 1);
  assert.equal(verstuurd, 1, 'de klant krijgt EEN bevestiging, geen twee');
});

test('een bezorgd bericht is niet opnieuw te sturen, een permanent alleen met zoveel woorden', async () => {
  const q = maakQ(async () => ({ ok: false, soort: 'permanent', waarom: '550 onbekend' }));
  const z = q.zet({ naar: 'nep@voorbeeld.test', onderwerp: 'x', tekst: 'y' });
  await q.werk();
  const weiger = q.opnieuw(z.id);
  assert.match(weiger.error, /permanent/);
  assert.match(weiger.error, /reputatie/);
  const wel = q.opnieuw(z.id, { ookPermanent: true });
  assert.equal(wel.ok, true, 'met zoveel woorden mag het wel');
  assert.equal(q.stand().wacht, 1);
});

/* ---- de buitenpoort, tegen een echte server ---- */
const BERICHT = (naar) => [
  'From: Jan Klant <jan@buiten.test>',
  'To: ' + naar,
  'Subject: =?UTF-8?B?' + Buffer.from('Vraag over de café-rekening').toString('base64') + '?=',
  'Date: Tue, 05 Aug 2026 09:00:00 +0000',
  'MIME-Version: 1.0',
  'Content-Type: multipart/mixed; boundary="grens1"',
  '',
  '--grens1',
  'Content-Type: text/plain; charset=utf-8',
  'Content-Transfer-Encoding: base64',
  '',
  Buffer.from('Beste,\n\nKlopt de rekening van dinsdag? Zie http://voorbeeld.test/factuur\n').toString('base64'),
  '--grens1',
  'Content-Type: application/pdf',
  'Content-Disposition: attachment; filename="factuur.pdf"',
  '',
  'JVBERi0xLjQK',
  '--grens1--',
  ''
].join('\r\n');

test('de buitenpoort pakt MIME uit, bewaart het origineel en levert onbetrouwd af', async () => {
  const r = await post('/api/mail/binnen', { bericht: BERICHT(lidAdres) });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.ok(r.origineel, 'er is een origineel bewaard');
  assert.equal(r.bijlagen.length, 1);
  assert.equal(r.bijlagen[0].naam, 'factuur.pdf');
  assert.match(r.let, /onveranderd bewaard/);

  const vak = await post('/api/member/rtmail/vak', {}, lidTok);
  const m = vak.berichten.find(x => x.id === r.id);
  assert.ok(m, 'het bericht ligt in het postvak');
  assert.equal(m.onderwerp, 'Vraag over de café-rekening', 'de gecodeerde kop is ontcijferd');
  assert.match(m.tekst, /Klopt de rekening van dinsdag/, 'de base64-tekst is uitgepakt');
  assert.equal(m.vertrouwd, false, 'alles van buiten valt in de onbetrouwde baan');
  assert.equal(m.bron, 'extern');
  assert.deepEqual(m.bijlagen, [], 'er wordt nooit iets bewaard dat te openen valt');
  assert.match(m.tekst, /1 bijlage\(n\): factuur\.pdf/, 'maar de bijlage wordt wel benoemd');
  assert.ok(m.links.aantal >= 1, 'de link is herkend, zodat het scherm hem onklikbaar kan tonen');
});

test('de controles worden gemeld als "niet gecontroleerd" in plaats van als geslaagd', async () => {
  const r = await post('/api/mail/binnen', { bericht: BERICHT(lidAdres) });
  assert.equal(r.controles.dkim, 'geen', 'dit bericht draagt geen handtekening');
  assert.equal(r.controles.spf, 'niet gecontroleerd');
  assert.equal(r.controles.dmarc, 'niet gecontroleerd');
  const vak = await post('/api/member/rtmail/vak', {}, lidTok);
  const m = vak.berichten.find(x => x.id === r.id);
  assert.match(m.tekst, /DKIM geen; SPF niet gecontroleerd/, 'en dat staat ook in het bericht zelf');
});

test('bij tekst en HTML naast elkaar wint de PLATTE tekst', async () => {
  /* multipart/alternative is de gewoonste vorm van zakelijke post. RTMAIL
     rendert platte tekst en voert HTML nooit uit, dus de plattetekst-variant is
     niet alleen mooier maar ook de enige die klopt met wat de lezer ziet. */
  const bericht = [
    'From: Marketing <post@buiten.test>',
    'To: ' + lidAdres,
    'Subject: Nieuwsbrief',
    'MIME-Version: 1.0',
    'Content-Type: multipart/alternative; boundary="ab"',
    '',
    /* De HTML-variant staat hier BEWUST voorop. Staat de platte tekst eerst,
       dan wint hij vanzelf op volgorde en zegt de toets niets over de
       voorkeur -- precies het soort toets dat niet kan zakken. */
    '--ab',
    'Content-Type: text/html; charset=utf-8',
    '',
    '<html><body><b>DIT IS DE HTML-VERSIE</b></body></html>',
    '--ab',
    'Content-Type: text/plain; charset=utf-8',
    '',
    'DIT IS DE PLATTE VERSIE',
    '--ab--',
    ''
  ].join('\r\n');
  const r = await post('/api/mail/binnen', { bericht });
  assert.equal(r.ok, true, JSON.stringify(r));
  const vak = await post('/api/member/rtmail/vak', {}, lidTok);
  const m = vak.berichten.find(x => x.id === r.id);
  assert.match(m.tekst, /DIT IS DE PLATTE VERSIE/);
  assert.ok(!/DIT IS DE HTML-VERSIE/.test(m.tekst), 'de HTML-variant komt er niet in');
  assert.ok(!/<b>|<html>/.test(m.tekst), 'en er staan dus ook geen tags in het postvak');
});

test('de buitenpoort weigert wat geen e-mail is, met de reden', async () => {
  const leeg = await rauw('/api/mail/binnen', { bericht: '' });
  assert.equal(leeg.status, 400);
  assert.match(leeg.body.error, /leeg bericht/);
  const geenKop = await rauw('/api/mail/binnen', { bericht: 'gewoon wat tekst zonder koppen' });
  assert.equal(geenKop.status, 400);
  assert.match(geenKop.body.error, /geen kop-blok|geen e-mail/);
  const zonderFrom = await rauw('/api/mail/binnen', { bericht: 'To: x@y.test\r\nSubject: hoi\r\n\r\nlijf' });
  assert.equal(zonderFrom.status, 400);
  assert.match(zonderFrom.body.error, /zonder From/);
});

test('een bericht aan een onbekende ontvanger wordt geweigerd, niet stil weggegooid', async () => {
  const r = await rauw('/api/mail/binnen', { bericht: 'From: a@b.test\r\nSubject: hoi\r\n\r\nlijf' });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /geen ontvanger/);
  assert.ok(r.body.origineel, 'het origineel is toch bewaard -- de bytes waren er wel');
});
