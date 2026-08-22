/* ============================================================================
   DE DERTIEN LAATSTE MAILENDPOINTS ZONDER TOETS -- de kantoorkant, de
   IMAP-sleutels en de PDF-notities.

   Ze zijn samen genomen omdat ze samen de rest van de mailronde van vandaag
   vormen: alles wat erbij kwam en waar de dekkingsmeting geen enkele aanroep
   van zag. Drie groepen, drie soorten risico:

   1. DE POSTKAMER (/api/office/mail/*). De wachtrij met zijn dead-letter-
      tellingen, een ronde werk draaien, opnieuw proberen, zelf post de deur uit
      doen, en het ORIGINEEL van een binnengekomen bericht opvragen. Dat laatste
      is de gevoeligste knop van de vijf: daar staat de rauwe mail van iemand
      anders in. Hij hoort achter de kantoorpoort en nergens anders achter.

      (Ik las /uit eerst als de dead-letter -- dat is het niet, dat is post de
      deur UIT. De dead-letter-tellingen zitten in /wachtrij onder `dood`.)
   2. DE IMAP-SLEUTELS (/api/member/rtmail/imap/*). Een sleutel waarmee een
      mailprogramma bij een postvak kan. Wie hem uitgeeft moet ingelogd zijn,
      en intrekken moet ECHT intrekken -- een ingetrokken sleutel die blijft
      werken is erger dan geen sleutel.
   3. DE PDF-NOTITIES (/api/bestanden/pdf/*). Een opmerking op een document
      zetten en teruglezen.

   Draai los: node --test test/mailpost-kantoor.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-mailpost-kantoor-'));
const CODE = 'KANTOOR-MAILPOST';
let srv, base, kantoor, lid, vreemd;

const api = (pad, body, token) => fetch(base + pad, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

/* Een klein maar echt PDF-document. Zelfde vorm als in test/pdf.test.js, en
   bewust hier herhaald in plaats van geimporteerd: een toetsbestand hoort op
   zichzelf te lezen, en dit is vijftien regels. */
function maakPdf(regels) {
  const inhoud = 'BT /F1 12 Tf 72 720 Td\n' +
    regels.map(r => '(' + r.replace(/([()\\])/g, '\\$1') + ') Tj 0 -16 Td').join('\n') + '\nET\n';
  const objs = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
    '4 0 obj\n<< /Length ' + inhoud.length + ' >>\nstream\n' + inhoud + '\nendstream\nendobj\n',
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n'
  ];
  let uit = '%PDF-1.4\n'; const pos = [];
  for (const o of objs) { pos.push(uit.length); uit += o; }
  const x = uit.length;
  uit += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n' +
    pos.map(p => String(p).padStart(10, '0') + ' 00000 n \n').join('') +
    'trailer\n<< /Size ' + (objs.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + x + '\n%%EOF\n';
  return Buffer.from(uit, 'latin1');
}

const KANTOORPADEN = ['/api/office/mail/wachtrij', '/api/office/mail/werk',
  '/api/office/mail/opnieuw', '/api/office/mail/origineel', '/api/office/mail/uit'];

async function nieuwLid(voorvoegsel) {
  const u = (Date.now() + Math.floor(Math.random() * 1000)).toString().slice(-9);
  const r = await api('/api/auth/register', { name: 'Lid ' + voorvoegsel, email: voorvoegsel + u + '@x.nl',
    phone: '06' + u.slice(0, 8), password: 'geheim12345', geboortedatum: '1990-01-01',
    tier: 'business', pasApp: 'business' });
  assert.ok(r.body.token, 'lid ' + voorvoegsel + ' bestaat: ' + JSON.stringify(r.body).slice(0, 200));
  return r.body.token;
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: CODE } });
  base = srv.base;
  kantoor = (await api('/api/office/login', { code: CODE })).body.token;
  assert.ok(kantoor, 'het kantoor is binnen');
  lid = await nieuwLid('mp');
  vreemd = await nieuwLid('mv');
});

test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

/* ================= 1. de postkamer ================= */

test('1. de postkamer is van het kantoor; een lid komt er op geen enkele knop in', async () => {
  const door = [];
  for (const pad of KANTOORPADEN)
    for (const [wie, token] of [['zonder token', undefined], ['met een LEDENtoken', lid]]) {
      const r = await api(pad, {}, token);
      if (r.status !== 401 && r.status !== 403) door.push(pad + ' ' + wie + ' -> ' + r.status);
    }
  assert.deepEqual(door, [], 'de postkamer stond open voor:\n  ' + door.join('\n  '));
});

test('2. met de kantoorsleutel geeft elke knop een antwoord, en geen enkele valt om', async () => {
  const stuk = [];
  for (const pad of KANTOORPADEN) {
    const r = await api(pad, {}, kantoor);
    if (r.status === 401 || r.status === 403) stuk.push(pad + ' zet het kantoor zelf buiten (' + r.status + ')');
    if (r.status >= 500) stuk.push(pad + ' geeft een serverfout: ' + JSON.stringify(r.body).slice(0, 120));
  }
  assert.deepEqual(stuk, [], stuk.join('\n  '));
});

test('3. de wachtrij en de dead-letter tellen echt, en /werk verzet werk', async () => {
  const rij = await api('/api/office/mail/wachtrij', {}, kantoor);
  assert.equal(rij.status, 200, JSON.stringify(rij.body).slice(0, 200));
  /* De vorm van het antwoord ligt vast, want de boardroom tekent er meters op.
     Een lege wachtrij is een geldig antwoord; een ONTBREKENDE wachtrij niet. */
  for (const veld of ['wacht', 'aanDeBeurt', 'wachttijden', 'dood', 'rijen'])
    assert.ok(veld in rij.body, 'de wachtrij draagt het veld ' + veld + ': ' + JSON.stringify(rij.body).slice(0, 200));
  assert.deepEqual(rij.body.wachttijden, [1, 5, 15, 60, 240],
    'en de herkansingsreeks is die uit kern/mailwachtrij.js -- een minuut, vijf, een kwartier, een uur, vier uur');
  for (const veld of ['opgegeven', 'permanent', 'bezorgd'])
    assert.equal(typeof rij.body.dood[veld], 'number', 'de dead-letter telt ' + veld);

  /* Post de deur uit, en dan door de wachtrij heen. Zonder SMTP_URL gaat hij
     naar de outbox, dus dit meet de KETEN en niet het internet. */
  const zonderAdres = await api('/api/office/mail/uit', { onderwerp: 'x', tekst: 'y' }, kantoor);
  assert.equal(zonderAdres.status, 400, 'zonder adres gaat er niets de deur uit');

  const onderwerp = 'Bevestiging ' + Math.random().toString(36).slice(2, 8);
  const uit = await api('/api/office/mail/uit',
    { naar: 'ontvanger@voorbeeld.nl', onderwerp, tekst: 'Uw aanvraag is in behandeling.' }, kantoor);
  assert.equal(uit.status, 200, 'met een adres wel: ' + JSON.stringify(uit.body).slice(0, 200));

  const werk = await api('/api/office/mail/werk', {}, kantoor);
  assert.equal(werk.status, 200, 'een ronde werk draaien lukt: ' + JSON.stringify(werk.body).slice(0, 200));
  assert.ok(werk.body.ronde, 'en die ronde rapporteert wat hij heeft gedaan');
  assert.ok(werk.body.stand, 'met de stand van de wachtrij erachteraan');

  /* Na de ronde staat er niets meer te wachten: de outbox neemt hem aan. Dat is
     precies wat een wachtrij hoort te doen, en het is het verschil tussen
     "aangenomen" en "blijft hangen". */
  const na = await api('/api/office/mail/wachtrij', {}, kantoor);
  assert.equal(na.body.wacht, 0, 'na de ronde wacht er niets meer: ' + JSON.stringify(na.body).slice(0, 200));

  const opnieuw = await api('/api/office/mail/opnieuw', {}, kantoor);
  assert.ok(opnieuw.status < 500, 'opnieuw-proberen valt niet om: ' + opnieuw.status);
});

test('4. het origineel van andermans post staat niet zomaar klaar', async () => {
  /* De scherpste van de vijf. Zonder id hoort hij te weigeren en niet iets
     willekeurigs te geven -- een endpoint dat bij een lege vraag het eerste
     bericht teruggeeft, geeft de post van een vreemde. */
  const leeg = await api('/api/office/mail/origineel', {}, kantoor);
  assert.notEqual(leeg.status, 200, 'zonder id komt er geen bericht: ' + JSON.stringify(leeg.body).slice(0, 160));
  const verzonnen = await api('/api/office/mail/origineel', { id: 'bestaat-niet-' + Date.now() }, kantoor);
  assert.notEqual(verzonnen.status, 200, 'en een verzonnen id levert niets op');
});

/* ================= 2. de IMAP-sleutels ================= */

test('5. een IMAP-sleutel hoort bij een inlog, en intrekken trekt hem echt in', async () => {
  const zonder = await api('/api/member/rtmail/imap/sleutel', { naam: 'telefoon' });
  assert.ok(zonder.status === 401 || zonder.status === 403, 'zonder inlog geen sleutel: ' + zonder.status);

  const gemaakt = await api('/api/member/rtmail/imap/sleutel', { naam: 'telefoon' }, lid);
  assert.equal(gemaakt.status, 200, 'het lid krijgt een sleutel: ' + JSON.stringify(gemaakt.body).slice(0, 200));
  const sleutel = gemaakt.body.sleutel || gemaakt.body.wachtwoord || gemaakt.body.code;
  assert.ok(sleutel, 'en die sleutel staat in het antwoord: ' + JSON.stringify(gemaakt.body).slice(0, 200));

  const lijst = await api('/api/member/rtmail/imap/sleutels', {}, lid);
  assert.equal(lijst.status, 200);
  const sleutels = lijst.body.sleutels || [];
  assert.ok(sleutels.length >= 1, 'hij staat in de lijst');
  /* DE SLEUTEL ZELF MAG DAAR NIET MEER IN STAAN. Een beheerscherm dat een
     bestaand wachtwoord opnieuw toont, lekt het aan iedereen die meekijkt --
     dezelfde regel als bij het SSO-clientgeheim. */
  assert.ok(!JSON.stringify(sleutels).includes(String(sleutel)),
    'de lijst toont de sleutel NIET opnieuw: ' + JSON.stringify(sleutels).slice(0, 200));

  // een ander lid ziet hem niet
  const vanVreemde = await api('/api/member/rtmail/imap/sleutels', {}, vreemd);
  assert.equal(vanVreemde.status, 200);
  assert.equal((vanVreemde.body.sleutels || []).length, 0, 'een ander lid ziet geen sleutels van dit lid');

  const id = sleutels[0].id || sleutels[0].naam;
  const weg = await api('/api/member/rtmail/imap/intrekken', { id, naam: sleutels[0].naam }, lid);
  assert.equal(weg.status, 200, 'intrekken lukt: ' + JSON.stringify(weg.body).slice(0, 160));
  const na = await api('/api/member/rtmail/imap/sleutels', {}, lid);
  assert.equal((na.body.sleutels || []).length, 0, 'en daarna is de lijst leeg');
});

/* ================= 3. de PDF-notities ================= */

test('6. een notitie op een PDF komt erin en is terug te lezen', async () => {
  /* De hele keten, over de lijn: een echt PDF-bestand uploaden, er een notitie
     op zetten, en die terugvragen. Zonder dit stuk toetsen 7 en 8 alleen de
     deur en niet wat erachter gebeurt. */
  const bron = maakPdf(['Contract 2026', 'Artikel 1']);
  const op = await api('/api/bestanden/upload',
    { naam: 'contract.pdf', dataUrl: 'data:application/pdf;base64,' + bron.toString('base64') }, lid);
  assert.equal(op.status, 200, 'het bestand gaat erin: ' + JSON.stringify(op.body).slice(0, 200));
  const id = (op.body.bestand && op.body.bestand.id) || op.body.id;
  assert.ok(id, 'en krijgt een id: ' + JSON.stringify(op.body).slice(0, 200));

  const leeg = await api('/api/bestanden/pdf/notities', { id }, lid);
  assert.equal(leeg.status, 200, JSON.stringify(leeg.body).slice(0, 200));
  assert.equal(leeg.body.aantal, 0, 'een vers document draagt nog geen notitie');

  const gezet = await api('/api/bestanden/pdf/notitie',
    { id, pagina: 1, tekst: 'Let op de opzegtermijn', wie: 'Rahul' }, lid);
  assert.equal(gezet.status, 200, 'de notitie gaat erop: ' + JSON.stringify(gezet.body).slice(0, 200));
  const nieuwId = (gezet.body.bestand && gezet.body.bestand.id) || gezet.body.id;
  assert.ok(nieuwId, 'er komt een nieuw bestand uit: ' + JSON.stringify(gezet.body).slice(0, 200));
  assert.notEqual(nieuwId, id, 'en het origineel blijft staan zoals het was');

  const terug = await api('/api/bestanden/pdf/notities', { id: nieuwId }, lid);
  assert.equal(terug.status, 200, JSON.stringify(terug.body).slice(0, 200));
  assert.equal(terug.body.aantal, 1, 'precies een notitie terug');
  assert.equal(terug.body.notities[0].tekst, 'Let op de opzegtermijn', 'met de tekst die erin ging');
  assert.equal(terug.body.notities[0].wie, 'Rahul', 'en op naam');

  // en een ander lid komt er niet bij
  const vanVreemde = await api('/api/bestanden/pdf/notities', { id: nieuwId }, vreemd);
  assert.notEqual(vanVreemde.status, 200, 'een ander lid leest die notities niet: ' + vanVreemde.status);
});

test('7. de PDF-eindpunten laten een uitgelogde bezoeker niet toe', async () => {
  for (const pad of ['/api/bestanden/pdf/notitie', '/api/bestanden/pdf/notities']) {
    const r = await api(pad, { id: 'x' });
    assert.ok(r.status === 401 || r.status === 403, pad + ' zonder inlog: ' + r.status);
  }
});

test('8. een notitie op een bestand dat niet van jou is, komt er niet', async () => {
  /* Zonder een echt bestand is dit de scherpe kant die overblijft, en het is de
     kant die telt: het id komt uit de body, dus dit is de plek waar iemand het
     id van een ander zou proberen. Het antwoord mag nooit een document zijn. */
  for (const pad of ['/api/bestanden/pdf/notitie', '/api/bestanden/pdf/notities']) {
    const r = await api(pad, { id: 'van-iemand-anders-' + Date.now(), pagina: 1, tekst: 'hallo' }, lid);
    assert.notEqual(r.status, 200, pad + ' geeft geen document op een vreemd id: ' + r.status);
    assert.ok(r.status < 500, pad + ' weigert netjes in plaats van om te vallen: ' + r.status);
  }
});

/* ================= 4. de drie ledenknoppen die nog niemand had aangeraakt ================= */

test('9. een regel weghalen, een bericht aan een klant koppelen, en het vernietigingsbewijs', async () => {
  /* Drie endpoints aan de LEDENkant die de dekkingsmeting als nooit aangeroepen
     aanwees. Ze horen bij elkaar in een ding: alle drie werken ze op het eigen
     postvak, en alle drie moeten ze weigeren zodra er geen inlog is. */
  for (const pad of ['/api/member/rtmail/regel/weg', '/api/member/rtmail/team/koppel',
    '/api/member/rtmail/vernietigingen']) {
    const r = await api(pad, { id: 'x' });
    assert.ok(r.status === 401 || r.status === 403, pad + ' zonder inlog: ' + r.status);
  }

  // een regel maken en hem weer weghalen -- de lus rond, want alleen dan weet
  // je dat "weg" ook echt weg betekent
  const gemaakt = await api('/api/member/rtmail/regel/maak',
    { naam: 'nieuwsbrieven', veld: 'onderwerp', bevat: 'nieuwsbrief', actie: 'opbergen' }, lid);
  assert.equal(gemaakt.status, 200, 'de regel komt erin: ' + JSON.stringify(gemaakt.body).slice(0, 200));
  const regels = await api('/api/member/rtmail/regels', {}, lid);
  const regel = (regels.body.regels || []).find(r => r.naam === 'nieuwsbrieven');
  assert.ok(regel, 'en staat in de lijst: ' + JSON.stringify(regels.body).slice(0, 200));

  const weg = await api('/api/member/rtmail/regel/weg', { id: regel.id }, lid);
  assert.equal(weg.status, 200, 'weghalen lukt: ' + JSON.stringify(weg.body).slice(0, 160));
  const na = await api('/api/member/rtmail/regels', {}, lid);
  assert.ok(!(na.body.regels || []).some(r => r.id === regel.id), 'en daarna staat hij er niet meer');

  // het vernietigingsbewijs: een lijst, ook als er nog niets vernietigd is
  const bewijs = await api('/api/member/rtmail/vernietigingen', {}, lid);
  assert.equal(bewijs.status, 200, 'het bewijs is op te vragen: ' + JSON.stringify(bewijs.body).slice(0, 200));
  assert.ok('bewijs' in bewijs.body, 'en draagt het veld bewijs');

  /* Koppelen vraagt een bestaand teambericht. Dat hebben we hier niet, en dus
     hoort dit endpoint te WEIGEREN met een uitleg -- niet stil iets te koppelen
     aan een bericht dat niet bestaat. Dat is de eigenschap die hier telt. */
  const koppel = await api('/api/member/rtmail/team/koppel',
    { id: 'geen-postvak', bericht: 'bestaat-niet', klantId: 'k1' }, lid);
  assert.notEqual(koppel.status, 200, 'koppelen aan een verzonnen bericht lukt niet: ' + koppel.status);
  assert.ok(koppel.status < 500, 'en het valt niet om: ' + JSON.stringify(koppel.body).slice(0, 160));
});
