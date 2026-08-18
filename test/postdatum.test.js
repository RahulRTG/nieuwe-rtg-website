/* Postdatums: de datums die in uw eigen post staan, als VOORSTEL.

   Wat hier bewezen wordt, en waarom juist dit:

     de lezer       drie vormen herkend, en de twijfelgevallen NIET geraden --
                    "03/04/2026" wordt overgeslagen met de reden erbij, want
                    dat is 3 april of 4 maart en er is geen manier om te weten
                    welke van de twee
     de keten       een echte mail via de buitenpoort wordt een voorstel, en na
                    EEN knop staat hij in de agenda en dus in de Control Tower
     de rem         niets gaat vanzelf: zolang niemand op de knop drukt,
                    verandert er niets aan de tower
     de herkomst    'uit uw post' is geen etiket dat een pagina zelf kan
                    opplakken, en een datum die niet in het bericht staat wordt
                    geweigerd
     de zaak        dezelfde drie routes op het postvak van een RTG-kantoor,
                    en alleen voor de manager

   Draai: node --test test/postdatum.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

const lezer = require('../server/kern/postdatum-lezer');

let BASE, child, lidTok, lidAdres, supTok, supAdres, supCode, personeelTok;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-postdatum-'));

const rauw = (pad, body, tok) => {
  const h = { 'Content-Type': 'application/json' };
  if (tok) h.Authorization = 'Bearer ' + tok;
  return fetch(BASE + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
};
const post = async (pad, body, tok) => (await rauw(pad, body, tok)).json().catch(() => ({}));
const overDagen = n => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

// een echt RFC 5322-bericht door de buitenpoort, precies zoals een vreemde
// mailserver het zou aanleveren
const BERICHT = (naar, onderwerp, tekst) => [
  'From: Reserveringen <balie@buiten.test>',
  'To: ' + naar,
  'Subject: ' + onderwerp,
  'Date: Tue, 05 Aug 2026 09:00:00 +0000',
  'MIME-Version: 1.0',
  'Content-Type: text/plain; charset=utf-8',
  '',
  tekst,
  ''
].join('\r\n');

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const reg = await post('/api/auth/register', { name: 'Post Datum', email: 'pd@x.nl',
    phone: '0612345662', password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  lidTok = reg.token;
  lidAdres = (await post('/api/member/rtmail/adres', {}, lidTok)).adres;
  assert.ok(lidAdres, 'het lid heeft een postadres');

  supCode = 'KIKUNOI';
  const roster = await post('/api/supplier/roster', { code: supCode });
  const man = (roster.staff || []).find(x => x.role === 'manager');
  const vloer = (roster.staff || []).find(x => x.role !== 'manager');
  assert.ok(man && vloer, 'de seed hoort een manager en vloerpersoneel te hebben');
  supTok = (await post('/api/supplier/login', { code: supCode, staffId: man.id, pin: '1234' })).token;
  personeelTok = (await post('/api/supplier/login', { code: supCode, staffId: vloer.id, pin: '5678' })).token;
  assert.ok(supTok && personeelTok, 'beide inloggen werken');
  supAdres = (await post('/api/supplier/rtmail/inbox', {}, supTok)).adres;
  assert.ok(supAdres, 'de zaak heeft een postadres: ' + JSON.stringify(supAdres));
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

/* ============================ de lezer, puur ============================== */
test('de lezer herkent de drie vormen, met de zin en de tijd erbij', () => {
  const r = lezer.lees(
    'Uw tafel staat gereserveerd op 2026-09-14 om 19:30. ' +
    'De levering komt op 20-08-2026. ' +
    'De opening is op August 14, 2026. ' +
    'Wij verwachten u op 3 oktober.',
    { vandaag: '2026-08-08' });
  assert.deepEqual(r.datums.map(d => d.datum),
    ['2026-08-14', '2026-08-20', '2026-09-14', '2026-10-03']);
  const tafel = r.datums.find(d => d.datum === '2026-09-14');
  assert.equal(tafel.tijd, '19:30', 'de tijd komt uit dezelfde zin');
  assert.match(tafel.zin, /Uw tafel staat gereserveerd/, 'de zin gaat mee, zodat een mens kan oordelen');
  assert.equal(r.datums.find(d => d.datum === '2026-08-20').tijd, null,
    'en een zin zonder tijd krijgt er geen aangeplakt');
});

test('een datum die zowel dag-maand als maand-dag kan zijn wordt NIET geraden', () => {
  /* Dit is de belangrijkste regel van de lezer. "03/04/2026" is in Nederland
     3 april en in Amerika 4 maart, en post komt uit allebei die werelden.
     Kiezen betekent in de helft van de gevallen fout kiezen. */
  const r = lezer.lees('De keuring vervalt op 03/04/2027.', { vandaag: '2026-08-08' });
  assert.deepEqual(r.datums, [], 'er wordt niets voorgesteld');
  assert.deepEqual(r.overgeslagen, [{ ruw: '03/04/2027', waarom: 'dag-of-maand' }],
    'maar hij wordt wel GEMELD -- stil weglaten laat het scherm liegen dat dit alles was');

  // en zodra een van de twee getallen boven de twaalf staat, is er geen twijfel
  const wel = lezer.lees('De keuring vervalt op 23/04/2027.', { vandaag: '2026-08-08' });
  assert.deepEqual(wel.datums.map(d => d.datum), ['2027-04-23']);
  assert.deepEqual(wel.overgeslagen, []);
});

test('een dag die niet bestaat, een dag die geweest is en een dag te ver weg vallen af', () => {
  const r = lezer.lees(
    'Ons ordernummer is 31-02-2026. ' +
    'Uw vorige bezoek was op 2026-01-05. ' +
    'De garantie loopt tot 2040-01-01.',
    { vandaag: '2026-08-08' });
  assert.deepEqual(r.datums, []);
  assert.deepEqual(r.overgeslagen.map(o => o.waarom).sort(),
    ['al geweest', 'onmogelijke datum', 'te ver weg']);
});

test('een jaartal dat er niet staat wordt de eerstvolgende keer dat die dag valt', () => {
  // 3 augustus is op 8 augustus al geweest, dus dat wordt volgend jaar;
  // 3 december komt dit jaar nog
  const r = lezer.lees('Zie 3 augustus en 3 december.', { vandaag: '2026-08-08' });
  assert.deepEqual(r.datums.map(d => d.datum), ['2026-12-03', '2027-08-03']);
});

test('dezelfde datum twee keer levert een voorstel op, niet twee', () => {
  const r = lezer.lees('Op 2026-09-14 verwachten wij u. Nogmaals: 14 september 2026.',
    { vandaag: '2026-08-08' });
  assert.deepEqual(r.datums.map(d => d.datum), ['2026-09-14']);
});

test('zonder een geldige "vandaag" leest hij niets, in plaats van iets te verzinnen', () => {
  /* De lezer rekent met vandaag (is dit al geweest? is dit te ver weg?). Krijgt
     hij daar rommel voor, dan is elk antwoord een gok -- en dan hoort hij te
     zwijgen en niet een lijst te leveren die op niets rust (lat, regel 3). */
  for (const rommel of ['', null, 'gisteren', '2026-13-45']) {
    assert.deepEqual(lezer.lees('Zie 2026-09-14.', { vandaag: rommel }).datums, [],
      JSON.stringify(rommel) + ' is geen vandaag');
  }
});

/* ======================= de keten, tegen een server ======================= */
test('een echte mail wordt een voorstel, en na EEN knop een termijn in de tower', async () => {
  const dag = overDagen(20);
  const binnen = await post('/api/mail/binnen', { bericht: BERICHT(lidAdres,
    'Bevestiging afspraak', 'Beste, uw afspraak staat op ' + dag + ' om 19:30. Tot dan.') });
  assert.equal(binnen.ok, true, JSON.stringify(binnen));

  /* EERST: er is NIETS veranderd aan de tower. Dat is de kern van deze laag --
     post die binnenkomt zet uit zichzelf geen termijn. */
  const voor = await post('/api/member/vooruit', {}, lidTok);
  assert.equal(voor.totaal, 0, 'de post heeft de tower niet aangeraakt');

  const v = await post('/api/member/vooruit/post', {}, lidTok);
  const voorstel = (v.voorstellen || []).find(x => x.id === binnen.id);
  assert.ok(voorstel, 'het bericht staat er als voorstel: ' + JSON.stringify(v.voorstellen));
  assert.equal(voorstel.vertrouwd, false, 'post van buiten is onbetrouwd, en dat staat erbij');
  assert.deepEqual(voorstel.datums.map(d => d.datum + ' ' + d.tijd), [dag + ' 19:30']);
  assert.match(voorstel.datums[0].zin, /uw afspraak staat op/i);

  // DE KNOP
  const genomen = await post('/api/member/vooruit/post/neem',
    { id: binnen.id, datum: dag, titel: 'Afspraak balie' }, lidTok);
  assert.equal(genomen.ok, true, JSON.stringify(genomen));
  assert.equal(genomen.item.datum, dag);
  assert.equal(genomen.item.tijd, '19:30');

  /* En NU staat hij in de tower -- via de agenda, want daar hoort een afspraak
     te wonen. Er is geen tweede opslag met dezelfde datum erin. */
  const na = await post('/api/member/vooruit', {}, lidTok);
  assert.equal(na.totaal, 1);
  assert.deepEqual(na.bronnen, ['Agenda']);
  const rij = na.vensters.find(x => x.sleutel === 'maand').items[0];
  assert.equal(rij.datum, dag);
  assert.equal(rij.naam, 'Afspraak balie');

  // de afspraak draagt zijn herkomst, en de zin staat erbij
  const agenda = await post('/api/agenda/mijn-lijst', {}, lidTok);
  const item = agenda.items.find(i => i.id === genomen.item.id);
  assert.equal(item.bron, 'post:' + binnen.id);
  assert.match(item.notitie, /Uit uw post \(balie@buiten\.test\)/);

  // en hij komt niet nog een keer als voorstel terug
  const v2 = await post('/api/member/vooruit/post', {}, lidTok);
  assert.equal((v2.voorstellen || []).some(x => x.id === binnen.id), false);
  assert.ok(v2.besloten >= 1, 'hij telt als afgehandeld');
});

test('een voorstel wegleggen haalt het van het scherm en laat de agenda met rust', async () => {
  const dag = overDagen(25);
  const binnen = await post('/api/mail/binnen', { bericht: BERICHT(lidAdres,
    'Nieuwsbrief', 'Onze zomeractie loopt tot ' + dag + '. Kijk snel.') });
  assert.equal(binnen.ok, true);
  const voor = await post('/api/agenda/mijn-lijst', {}, lidTok);

  assert.ok((await post('/api/member/vooruit/post', {}, lidTok)).voorstellen.some(x => x.id === binnen.id));
  assert.equal((await post('/api/member/vooruit/post/negeer', { id: binnen.id }, lidTok)).ok, true);
  assert.equal((await post('/api/member/vooruit/post', {}, lidTok)).voorstellen.some(x => x.id === binnen.id), false);

  const na = await post('/api/agenda/mijn-lijst', {}, lidTok);
  assert.equal(na.items.length, voor.items.length, 'wegleggen zet niets in de agenda');
  // en het bericht zelf staat er gewoon nog: wegleggen is geen weggooien
  const vak = await post('/api/member/rtmail/inbox', {}, lidTok);
  assert.ok(vak.berichten.some(m => m.id === binnen.id), 'de post blijft staan');
});

test('een datum die niet in het bericht staat, komt er niet in', async () => {
  /* Anders is `bron: post:<id>` een bewering die niet klopt: er staat dan een
     afspraak in de agenda die zegt uit uw post te komen terwijl niemand hem
     daar heeft gezien. */
  const binnen = await post('/api/mail/binnen', { bericht: BERICHT(lidAdres,
    'Levering', 'De levering komt op ' + overDagen(30) + '.') });
  const mis = await rauw('/api/member/vooruit/post/neem',
    { id: binnen.id, datum: overDagen(31) }, lidTok);
  assert.equal(mis.status, 400);
  assert.match((await mis.json()).error, /staat niet in dit bericht/);

  // ook een bericht uit ANDERMANS postvak bestaat hier niet
  const vreemd = await rauw('/api/member/vooruit/post/neem',
    { id: 'bestaatniet', datum: overDagen(30) }, lidTok);
  assert.equal(vreemd.status, 400);
});

test('"uit uw post" is geen etiket dat een pagina zelf kan opplakken', async () => {
  /* Zou het lijf van /api/agenda/toevoegen rechtstreeks doorgaan, dan kon
     iedereen een zelfgetypte afspraak dat etiket geven -- en dan zegt de
     voorstellenlijst dat er over een bericht al besloten is terwijl niemand het
     heeft gezien. */
  const binnen = await post('/api/mail/binnen', { bericht: BERICHT(lidAdres,
    'Inspectie', 'De inspectie is op ' + overDagen(40) + '.') });
  assert.ok((await post('/api/member/vooruit/post', {}, lidTok)).voorstellen.some(x => x.id === binnen.id));

  const zelf = await post('/api/agenda/toevoegen',
    { titel: 'Zelf getypt', datum: overDagen(40), bron: 'post:' + binnen.id }, lidTok);
  assert.equal(zelf.ok, true, 'de afspraak zelf mag gewoon');
  const item = zelf.items.find(i => i.titel === 'Zelf getypt');
  assert.equal(item.bron, null, 'maar zonder herkomst -- die zet de server');

  assert.ok((await post('/api/member/vooruit/post', {}, lidTok)).voorstellen.some(x => x.id === binnen.id),
    'en het voorstel staat er dus nog steeds');
});

/* ============================== de zaak-kant ============================== */
test('een RTG-kantoor krijgt dezelfde voorstellen, uit zijn eigen postvak', async () => {
  const dag = overDagen(15);
  const binnen = await post('/api/mail/binnen', { bericht: BERICHT(supAdres,
    'Keuring afzuiging', 'De jaarlijkse keuring is gepland op ' + dag + ' om 09:00.') });
  assert.equal(binnen.ok, true, JSON.stringify(binnen));

  const voor = await post('/api/supplier/vooruit', {}, supTok);
  const v = await post('/api/supplier/vooruit/post', {}, supTok);
  const voorstel = (v.voorstellen || []).find(x => x.id === binnen.id);
  assert.ok(voorstel, 'het staat er als voorstel');
  assert.deepEqual(voorstel.datums.map(d => d.datum + ' ' + d.tijd), [dag + ' 09:00']);

  const genomen = await post('/api/supplier/vooruit/post/neem',
    { id: binnen.id, datum: dag, titel: 'Keuring afzuiging' }, supTok);
  assert.equal(genomen.ok, true, JSON.stringify(genomen));

  const na = await post('/api/supplier/vooruit', {}, supTok);
  assert.equal(na.totaal, voor.totaal + 1, 'en hij staat in de tower van de zaak');
  assert.ok(na.bronnen.includes('Agenda'));
});

test('alleen de manager van een zaak komt bij deze drie routes', async () => {
  /* Aannemen zet iets in de agenda van de HELE zaak en wegleggen haalt het van
     ieders scherm; en in het postvak van een zaak staat post van klanten. */
  for (const pad of ['/api/supplier/vooruit/post', '/api/supplier/vooruit/post/neem',
    '/api/supplier/vooruit/post/negeer']) {
    const r = await rauw(pad, { id: 'x', datum: overDagen(3) }, personeelTok);
    assert.equal(r.status, 403, pad + ' hoort dicht te zijn voor vloerpersoneel');
  }
  // en zonder inlog al helemaal
  assert.equal((await rauw('/api/supplier/vooruit/post', {})).status, 401);
});

test('een gast heeft geen postvak en komt hier niet binnen', async () => {
  const gast = (await post('/api/login', { tier: 'guest' })).token;
  assert.ok(gast, 'er is een gastsessie');
  for (const pad of ['/api/member/vooruit/post', '/api/member/vooruit/post/neem',
    '/api/member/vooruit/post/negeer']) {
    const r = await rauw(pad, { id: 'x', datum: overDagen(3) }, gast);
    assert.equal(r.status, 403, pad);
  }
  /* Maar zijn EIGEN termijnen mag hij wel zien: de tower is niet premium en ook
     niet voorbehouden aan wie een postvak heeft. */
  assert.equal((await rauw('/api/member/vooruit', {}, gast)).status, 200);
});
