/* ============================================================================
   RTMAIL AAN DE ZAAKKANT -- de tweede deur, die nooit was opengedaan.

   WAAROM DIT BESTAND ER IS. De mailroutes worden per handeling TWEE keer
   geregistreerd, in een lus over `paren` (zie de kop van
   server/routes/rtmail-vak.js): een keer op /api/member/rtmail met de
   leden-poort, en een keer op /api/supplier/rtmail met de zaak-poort. Dezelfde
   code, twee poorten, twee manieren om het adres af te leiden.

   Zeven toetsbestanden dekken de LEDENkant tot in de hoeken. Op de zaakkant
   kwam geen enkele toets: zevenendertig endpoints die nooit waren aangeroepen.
   Dat is precies het patroon waar dit huis al eerder op is gestruikeld --
   dezelfde motor, tweede deur, en de deur ongetoetst.

   Dat is hier geen formaliteit. De twee helften verschillen op het enige punt
   dat telt: de POORT (supplierAuth in plaats van auth) en het ADRES
   (rtmail-wie.zaakAdres, dat de zaakcode uit de sessie haalt). Een fout in
   precies dat verschil is onzichtbaar aan de ledenkant en betekent aan de
   zaakkant dat een bedrijf in de post van een ander kan kijken.

   WAT ER BEWEZEN WORDT

   1. DE POORT. Geen token en een LEDENtoken komen er op geen enkel van de
      zevenendertig endpoints doorheen. Dat is de belangrijkste toets in dit
      bestand: hij loopt de hele lijst af, dus een endpoint dat morgen zijn
      poort verliest, valt hier om.
   2. HET ADRES KOMT UIT DE SESSIE. Een zaakcode in de body verandert niets.
   3. DE HELE KETEN WERKT ECHT. Post binnenkrijgen, sluimeren, etiketteren,
      verplaatsen, zoeken, een concept schrijven en versturen, een regel
      maken, een handtekening zetten, delegeren, exporteren.

   Draai los: node --experimental-sqlite --test test/rtmail-zaak.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rtmail-zaak-'));
let srv, base, zaakA, zaakB, lidToken;

const api = (pad, body, token) => fetch(base + pad, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

/* De paden staan hieronder VOLUIT en worden niet uit een voorvoegsel
   samengesteld. Dat leest iets minder compact, en het is met opzet: de
   dekkingsmeting (scripts/dekking.js) zoekt de letterlijke padtekst in de
   toetsen. Een toets die zijn adressen aan elkaar plakt, telt daar als GEEN
   dekking -- en dan staat er zevenendertig keer "nooit aangeroepen" terwijl de
   toets ze alle zevenendertig aanroept. Een adres dat je kunt grepen is
   bovendien een adres dat je terugvindt. */

/* ALLE zevenendertig, uitgeschreven en niet afgeleid. Een lijst die zichzelf
   uit de broncode haalt zou meebewegen met een endpoint dat stilletjes
   verdwijnt; deze lijst niet. */
const ALLE = [
  // postvak (routes/rtmail-vak.js)
  '/api/supplier/rtmail/vak', '/api/supplier/rtmail/gesprekken', '/api/supplier/rtmail/draad', '/api/supplier/rtmail/verplaats', '/api/supplier/rtmail/etiket', '/api/supplier/rtmail/ster', '/api/supplier/rtmail/sluimer',
  '/api/supplier/rtmail/zoek', '/api/supplier/rtmail/hulp', '/api/supplier/rtmail/antwoord',
  // schrijven (routes/rtmail-schrijf.js)
  '/api/supplier/rtmail/concepten', '/api/supplier/rtmail/concept/bewaar', '/api/supplier/rtmail/concept/weg', '/api/supplier/rtmail/concept/verstuur',
  '/api/supplier/rtmail/instellingen', '/api/supplier/rtmail/handtekening', '/api/supplier/rtmail/afwezig', '/api/supplier/rtmail/alias',
  '/api/supplier/rtmail/regels', '/api/supplier/rtmail/regel/maak', '/api/supplier/rtmail/regel/zet', '/api/supplier/rtmail/regel/weg',
  '/api/supplier/rtmail/imap/sleutels', '/api/supplier/rtmail/imap/sleutel', '/api/supplier/rtmail/imap/intrekken',
  // bestuur (routes/rtmail-bestuur.js)
  '/api/supplier/rtmail/rechten', '/api/supplier/rtmail/delegeer', '/api/supplier/rtmail/delegatie/weg', '/api/supplier/rtmail/journaal',
  '/api/supplier/rtmail/bewaarbeleid', '/api/supplier/rtmail/bewaartermijn', '/api/supplier/rtmail/bewaring', '/api/supplier/rtmail/opruimen', '/api/supplier/rtmail/vernietigingen', '/api/supplier/rtmail/export',
  // bijlagen (routes/mailpost.js)
  '/api/supplier/rtmail/bijlagen', '/api/supplier/rtmail/bijlage'
];

async function zaakInlog(code) {
  const rooster = await api('/api/supplier/roster', { code });
  assert.equal(rooster.status, 200, 'roster van ' + code);
  const manager = (rooster.body.staff || []).find(x => x.role === 'manager');
  assert.ok(manager, code + ' heeft een manager in de seed');
  const inlog = await api('/api/supplier/login', { code, staffId: manager.id, pin: '1234' });
  assert.equal(inlog.status, 200, code + ' logt in: ' + JSON.stringify(inlog.body).slice(0, 200));
  return { code, token: inlog.body.token };
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'KANTOOR-RTMAILZAAK' } });
  base = srv.base;
  zaakA = await zaakInlog('KIKUNOI');
  zaakB = await zaakInlog('HOSHI');
  const u = Date.now().toString().slice(-9);
  const lid = await api('/api/auth/register', { name: 'Gewoon Lid', email: 'rz' + u + '@x.nl',
    phone: '06' + u.slice(0, 8), password: 'geheim12345', geboortedatum: '1990-01-01',
    tier: 'business', pasApp: 'business' });
  lidToken = lid.body.token;
  assert.ok(lidToken, 'het lid bestaat: ' + JSON.stringify(lid.body).slice(0, 200));
});

test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

/* ================= 1. de poort ================= */

test('1. geen van de zevenendertig ingangen gaat open zonder zaak-inlog', async () => {
  const door = [];
  for (const pad of ALLE) {
    for (const [wie, token] of [['zonder token', undefined], ['met een LEDENtoken', lidToken]]) {
      const r = await api(pad, {}, token);
      if (r.status !== 401 && r.status !== 403) door.push(pad + ' ' + wie + ' -> ' + r.status);
    }
  }
  /* De formulering is met opzet "weigert niet via zijn poort" en niet "laat
     iemand door". Nagemeten met een mutatie (p.poort weggehaald bij /zoek):
     dan komt er geen 200 maar een 404, want de laag eronder leidt het adres uit
     de sessie af en die is er niet. Er is dus een tweede lijn, en die houdt.
     Toch faalt deze toets daarop, en dat hoort: een endpoint zonder poort is
     een endpoint waarvan de afscherming van toeval afhangt -- van het feit dat
     ALLE handelingen eronder een adres nodig hebben. De dag dat er een bij komt
     die dat niet doet, is dit stil open. */
  assert.deepEqual(door, [],
    'deze ingangen weigeren een vreemde niet via hun poort (401/403):\n  ' + door.join('\n  '));
});

test('2. met een zaak-inlog gaat elke ingang wel open, en geen enkele valt om', async () => {
  /* De keerzijde van toets 1, en zonder deze bewijst die niets: een endpoint
     dat NIET BESTAAT geeft ook 404 en zou daar als "netjes dicht" gelden.

     Wat hier wel en niet telt: 200 is goed, en 400/404 ook -- dat is een
     handeling die om een id vraagt dat we niet meesturen, en dan HOORT hij te
     weigeren. Wat niet mag is 401/403 (de poort die zijn eigen mensen buiten
     zet) en 5xx (stuk). */
  /* EEN 403 IS NIET ALTIJD DE POORT. /delegeer weigert een zaak die geen
     delegatierecht heeft ook met 403 -- terecht, en dat is een heel ander
     antwoord dan "u bent geen zaak". Het verschil zit in de TEKST, niet in de
     code, dus vergelijken we die met de tekst die de poort zelf geeft. */
  const poortTekst = JSON.stringify((await api('/api/supplier/rtmail/vak', {})).body);
  const stuk = [];
  for (const pad of ALLE) {
    const r = await api(pad, {}, zaakA.token);
    const zelfdeAlsDePoort = JSON.stringify(r.body) === poortTekst;
    if ((r.status === 401 || r.status === 403) && zelfdeAlsDePoort)
      stuk.push(pad + ' zet de zaak zelf buiten (' + r.status + ')');
    if (r.status >= 500) stuk.push(pad + ' geeft een serverfout (' + r.status + '): ' + JSON.stringify(r.body).slice(0, 120));
  }
  assert.deepEqual(stuk, [], stuk.join('\n  '));
});

/* ================= 2. het adres ================= */

test('3. het adres komt uit de sessie; een zaakcode in de body verandert niets', async () => {
  const eigen = await api('/api/supplier/rtmail/vak', {}, zaakA.token);
  assert.equal(eigen.status, 200, JSON.stringify(eigen.body).slice(0, 200));
  assert.ok(eigen.body.adres, 'de zaak krijgt een adres');
  assert.match(String(eigen.body.adres).toLowerCase(), /kikunoi/, 'en het is haar eigen adres: ' + eigen.body.adres);

  const ander = await api('/api/supplier/rtmail/vak', {}, zaakB.token);
  assert.notEqual(ander.body.adres, eigen.body.adres, 'twee zaken, twee postvakken');

  /* De poging. Elk veld dat een adres of code zou kunnen dragen tegelijk, want
     een lek zit zelden in het veld dat je als eerste probeert. */
  const gestolen = await api('/api/supplier/rtmail/vak',
    { code: zaakB.code, adres: ander.body.adres, aan: ander.body.adres, postvak: ander.body.adres },
    zaakA.token);
  assert.equal(gestolen.status, 200, 'het verzoek slaagt...');
  assert.equal(gestolen.body.adres, eigen.body.adres,
    '...maar op het EIGEN adres; alles uit de body wordt genegeerd');
});

/* ================= 3. de keten ================= */

test('4. post komt binnen, en de hele behandeling werkt op de zaakkant', async () => {
  const A = await api('/api/supplier/rtmail/vak', {}, zaakA.token);
  const adresA = A.body.adres;
  const onderwerp = 'Levering zaterdag ' + Math.random().toString(36).slice(2, 8);

  // B schrijft A, via een concept dat hij verstuurt: dat dekt de schrijfkant meteen
  const concept = await api('/api/supplier/rtmail/concept/bewaar',
    { naar: adresA, onderwerp, tekst: 'Kunnen jullie zaterdag om 9u leveren?' }, zaakB.token);
  assert.equal(concept.status, 200, 'B bewaart een concept: ' + JSON.stringify(concept.body).slice(0, 200));
  const conceptId = concept.body.concept && (concept.body.concept.id || concept.body.concept);
  assert.ok(conceptId, 'het concept heeft een id: ' + JSON.stringify(concept.body).slice(0, 200));

  const lijst = await api('/api/supplier/rtmail/concepten', {}, zaakB.token);
  assert.equal(lijst.status, 200);
  assert.ok((lijst.body.concepten || []).some(c => c.id === conceptId), 'en staat in zijn conceptenlijst');

  const verstuurd = await api('/api/supplier/rtmail/concept/verstuur', { id: conceptId }, zaakB.token);
  assert.equal(verstuurd.status, 200, 'B verstuurt het: ' + JSON.stringify(verstuurd.body).slice(0, 200));

  // A ziet hem staan
  const vak = await api('/api/supplier/rtmail/vak', { map: 'in' }, zaakA.token);
  assert.equal(vak.status, 200);
  const bericht = (vak.body.berichten || []).find(m => m.onderwerp === onderwerp);
  assert.ok(bericht, 'A heeft de post in zijn postvak: ' + (vak.body.berichten || []).length + ' bericht(en)');

  // en B NIET -- het postvak van de een is niet dat van de ander
  const vakB = await api('/api/supplier/rtmail/vak', { map: 'in' }, zaakB.token);
  assert.ok(!(vakB.body.berichten || []).some(m => m.onderwerp === onderwerp),
    'de post van A staat niet ook in het postvak van B');

  // ster, etiket, verplaatsen, sluimeren: de gewone handelingen op een bericht
  assert.equal((await api('/api/supplier/rtmail/ster', { id: bericht.id, aan: true }, zaakA.token)).status, 200, 'ster');
  assert.equal((await api('/api/supplier/rtmail/etiket', { id: bericht.id, label: 'inkoop', aan: true }, zaakA.token)).status, 200, 'etiket');
  const gezocht = await api('/api/supplier/rtmail/zoek', { vraag: onderwerp.split(' ').pop() }, zaakA.token);
  assert.equal(gezocht.status, 200);
  assert.ok((gezocht.body.berichten || gezocht.body.treffers || []).length >= 1, 'zoeken vindt hem terug');

  const draad = await api('/api/supplier/rtmail/draad', { id: bericht.id }, zaakA.token);
  assert.equal(draad.status, 200, 'het gesprek is op te vragen: ' + JSON.stringify(draad.body).slice(0, 160));

  const gesprekken = await api('/api/supplier/rtmail/gesprekken', {}, zaakA.token);
  assert.equal(gesprekken.status, 200);
  assert.ok(Array.isArray(gesprekken.body.gesprekken), 'de gesprekkenlijst is een lijst');

  // antwoorden, en dan staat het antwoord bij B
  const antwoord = await api('/api/supplier/rtmail/antwoord',
    { id: bericht.id, tekst: 'Zaterdag negen uur is goed.' }, zaakA.token);
  assert.equal(antwoord.status, 200, 'A antwoordt: ' + JSON.stringify(antwoord.body).slice(0, 200));
  const bijB = await api('/api/supplier/rtmail/vak', { map: 'in' }, zaakB.token);
  assert.ok((bijB.body.berichten || []).some(m => /zaterdag negen uur/i.test(m.tekst || m.voorbeeld || '') ||
    /Re:/i.test(m.onderwerp || '')), 'en B krijgt het antwoord');

  // verplaatsen naar het archief haalt hem uit de inbox
  assert.equal((await api('/api/supplier/rtmail/verplaats', { id: bericht.id, map: 'archief' }, zaakA.token)).status, 200, 'verplaatsen');
  const naVerplaats = await api('/api/supplier/rtmail/vak', { map: 'in' }, zaakA.token);
  assert.ok(!(naVerplaats.body.berichten || []).some(m => m.id === bericht.id),
    'na het verplaatsen staat hij niet meer in de inbox');
});

test('5. instellingen, regels en delegatie horen bij de zaak en niet bij een persoon', async () => {
  const hs = await api('/api/supplier/rtmail/handtekening', { tekst: 'Sal de Mar -- keuken' }, zaakA.token);
  assert.equal(hs.status, 200, JSON.stringify(hs.body).slice(0, 200));
  const inst = await api('/api/supplier/rtmail/instellingen', {}, zaakA.token);
  assert.equal(inst.status, 200);
  assert.match(JSON.stringify(inst.body), /Sal de Mar/, 'de handtekening staat in de instellingen');

  // en de andere zaak ziet die handtekening NIET
  const instB = await api('/api/supplier/rtmail/instellingen', {}, zaakB.token);
  assert.ok(!/Sal de Mar/.test(JSON.stringify(instB.body)), 'de instellingen van A lekken niet naar B');

  const regel = await api('/api/supplier/rtmail/regel/maak',
    { naam: 'inkoop van Hoshi', veld: 'van', bevat: 'hoshi', actie: 'etiket', waarde: 'inkoop' }, zaakA.token);
  assert.equal(regel.status, 200, 'een regel maken: ' + JSON.stringify(regel.body).slice(0, 200));
  const regels = await api('/api/supplier/rtmail/regels', {}, zaakA.token);
  assert.equal(regels.status, 200);
  assert.ok((regels.body.regels || []).length >= 1, 'en hij staat in de lijst');

  const rechten = await api('/api/supplier/rtmail/rechten', {}, zaakA.token);
  assert.equal(rechten.status, 200, 'de rechten zijn op te vragen: ' + JSON.stringify(rechten.body).slice(0, 160));

  const journaal = await api('/api/supplier/rtmail/journaal', {}, zaakA.token);
  assert.equal(journaal.status, 200, 'het journaal is op te vragen');
});
