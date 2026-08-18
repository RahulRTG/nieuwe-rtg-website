/* ============================================================================
   DE WEG VAN EEN VAKBEWIJS, OVER ECHTE ROUTES.

   WAAROM DIT BESTAAT, EN HET STAAT ZWART OP WIT IN test/persoonseis.test.js:
   daar is een mutatie AFGESLAGEN. De soortcontrole op /api/vakbewijs/zet kon
   worden weggehaald zonder dat er iets zakte, want dat toetsbestand is puur en
   raakt geen enkele route. Die bevinding eindigde met "een routetoets eromheen
   staat op de takenlijst" -- en een belofte in tekst zonder belofte in code is
   precies LAT-regel 6. Dit bestand is die belofte.

   WAT ER WORDT VASTGELEGD

   1. De hele keten, over echte HTTP: iemand komt bij een kinderopvang werken en
      komt er NIET in tot zijn identiteit is vastgesteld en zijn VOG door RTG is
      gezien. Dat is het anti-fraudepad in zijn geheel, en elke stap ertussen
      hoort te weigeren -- niet alleen de eerste.
   2. De soortcontrole die de mutatie liet lopen.
   3. Aftekenen is niet van de werkgever: de zaak ziet ja of nee, en geen
      nummers of datums van een ander.
   4. Intrekken werkt zonder op een einddatum te wachten.

   Draai los: node --experimental-sqlite --test test/vakbewijs-routes.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vakb-'));
let child, BASE, mgr, office, lid, staffId, bedrijf;
const PIN = '4321';

/* Een 1x1 PNG: genoeg om de upload-route te laten doen wat zij doet. Wat er op
   de foto staat is voor deze toets niet de vraag -- dat beoordeelt een mens. */
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function api(pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const r = await fetch(BASE + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));

  // NIDO is de demo-kinderopvang: genre 'kinderopvang', dus werk-eis identiteit + VOG
  const roster = await api('/api/supplier/roster', { code: 'NIDO' });
  bedrijf = roster.body.supplier.name;
  const chef = roster.body.staff.find(x => x.role === 'manager');
  mgr = (await api('/api/supplier/login', { code: 'NIDO', staffId: chef.id, pin: '1234' })).body.token;
  assert.ok(mgr, 'de gezaaide locatiemanager heeft zijn papieren en komt binnen');

  office = (await api('/api/office/login', { code: 'RTG-OFFICE' })).body.token;
  assert.ok(office, 'het kantoor is aangemeld');

  // een echt RTG-lid dat hier komt werken
  lid = (await api('/api/auth/register', { name: 'Sanne Bergman', email: 'sanne@x.nl', phone: '0612345699',
    password: 'geheim123', geboortedatum: '1994-06-06', tier: 'rtg', pasApp: 'rtg' })).body.token;
  assert.ok(lid, 'het lid heeft een eigen RTG-account');

  const inv = await api('/api/supplier/staff/invite', { name: 'Sanne Bergman', role: 'staff', func: 'Pedagogisch medewerker' }, mgr);
  const join = await api('/api/supplier/staff/join', { bedrijf, kassacode: inv.body.invite.kassacode,
    login: 'sanne@x.nl', password: 'geheim123', pin: PIN });
  assert.equal(join.status, 200, 'de uitnodiging is ingewisseld');
  staffId = join.body.staffId;
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

const inloggen = () => api('/api/supplier/login', { code: 'NIDO', staffId, pin: PIN });

test('1. op het rooster staan is niet hetzelfde als naar binnen mogen', async () => {
  const nee = await inloggen();
  assert.equal(nee.status, 403, 'zonder papieren geen sessie bij een kinderopvang');
  assert.ok(Array.isArray(nee.body.persoonseis) && nee.body.persoonseis.length,
    'de weigering zegt WELKE stukken ontbreken, anders gaat iemand gokken');
  assert.ok(/identiteit/i.test(nee.body.error), nee.body.error);
});

test('2. de soortcontrole op /api/vakbewijs/zet -- de mutatie die eerder wegkwam', async () => {
  /* Vrije tekst zou betekenen dat iemand "vogg" indient, een aftekening krijgt
     voor een stuk waar geen enkele eis naar vraagt, en blijft wachten. */
  const gek = await api('/api/vakbewijs/zet', { wat: 'vogg', nummer: 'A-1', tot: '2030-01-01' }, lid);
  assert.equal(gek.status, 400);
  assert.ok(Array.isArray(gek.body.soorten) && gek.body.soorten.includes('vog'),
    'de weigering noemt wat wel kan, anders is hij een doodlopende weg');

  /* `identiteit` bestaat wel als soort, maar komt uit de verificatiekluis en
     niet uit deze la. Zelf indienen hoort dus ook te worden geweigerd -- anders
     schrijft iemand zijn eigen identiteit erin. */
  const zelf = await api('/api/vakbewijs/zet', { wat: 'identiteit', nummer: 'ik-ben-het' }, lid);
  assert.equal(zelf.status, 400, 'een identiteit leg je niet zelf vast');

  const goed = await api('/api/vakbewijs/zet', { wat: 'vog', nummer: 'VOG-2026-77', tot: '2030-01-01' }, lid);
  assert.equal(goed.status, 200);
  assert.equal(goed.body.vakbewijs.gezien, false, 'ingediend is niet gezien');
});

test('3. een ingediend stuk opent nog niets; RTG moet het eerst zien', async () => {
  const nog = await inloggen();
  assert.equal(nog.status, 403, 'zelf een VOG opschrijven is geen VOG hebben');

  // de mens ziet zelf wat er nog moet gebeuren, en niet alleen dat het niet mag
  const mijn = await api('/api/vakbewijs', {}, lid);
  assert.equal(mijn.status, 200);
  assert.equal(mijn.body.vakbewijzen.length, 1);
  assert.equal(mijn.body.vakbewijzen[0].gezien, false);
  /* Zijn EIGEN nummer ziet hij gewoon: zelf-inzage is geen inzage in andermans
     gegevens, en die gaat dus ook niet door het journaal (zie mag() in
     server/inzagelog.js, dat om dezelfde reden zelf-inzage overslaat). */
  assert.equal(mijn.body.vakbewijzen[0].nummer, 'VOG-2026-77');
  const eis = mijn.body.eisen.find(e => e.genre === 'kinderopvang');
  assert.ok(eis, 'de eisen van de zaak waar hij werkt staan erbij');
  assert.deepEqual(eis.werk.map(w => w.id).sort(), ['identiteit', 'vog']);
});

test('4. het kantoor tekent af -- op een naam, en niet de werkgever', async () => {
  const stapel = await api('/api/office/vakbewijzen', {}, office);
  const rij = stapel.body.open.find(v => v.wat === 'vog');
  assert.ok(rij, 'het stuk staat op de stapel van het kantoor');
  assert.ok(rij.wie, 'met de codenaam erbij, zodat een mens weet van wie het is');
  assert.equal(/^lid:\d+$/.test(rij.sleutel), true);

  /* HET NUMMER STAAT ER NIET BIJ, en dat is de hele wijziging: een
     BIG-registratie staat in een openbaar register, dus een nummer naast een
     codenaam voert die codenaam terug naar een echte naam. Het woont nu in de
     kluis en gaat alleen open met een reden. */
  assert.equal(JSON.stringify(stapel.body).includes('VOG-2026-77'), false,
    'het documentnummer hoort niet zomaar op de stapel te staan');

  const zonderNaam = await api('/api/office/vakbewijs/teken', { sleutel: rij.sleutel, wat: 'vog', door: '  ' }, office);
  assert.equal(zonderNaam.status, 400, 'een aftekening zonder naam is geen aftekening');

  /* En de werkgever kan het niet zelf: de manager heeft een supplier-token, en
     dat komt de kantoordeur niet door. Wie zijn eigen personeel kan aftekenen,
     heeft geen aftekening nodig. */
  const doorBaas = await api('/api/office/vakbewijs/teken', { sleutel: rij.sleutel, wat: 'vog', door: 'De baas' }, mgr);
  assert.equal(doorBaas.status, 401);

  const ok = await api('/api/office/vakbewijs/teken', { sleutel: rij.sleutel, wat: 'vog', door: 'M. de Vries' }, office);
  assert.equal(ok.status, 200);
  assert.ok(/geen inspectie/i.test(ok.body.grens), 'de grens gaat mee met het antwoord: ' + ok.body.grens);
});

test('5. de VOG is gezien, en tóch nog geen sessie: de identiteit ontbreekt', async () => {
  const nee = await inloggen();
  assert.equal(nee.status, 403, 'twee eisen betekent twee eisen, niet de eerste die je haalt');
  assert.deepEqual(nee.body.persoonseis.map(m => m.soort), ['identiteit']);
});

test('6. identiteit vastgesteld -- en nu pas gaat de deur open', async () => {
  assert.equal((await api('/api/verify/upload', { image: PNG }, lid)).status, 200);
  const rij = (await api('/api/office/verifications', {}, office)).body.pending.find(u => u.email === 'sanne@x.nl');
  assert.ok(rij, 'de verificatie staat in de wachtrij van het kantoor');
  assert.equal((await api('/api/office/verify', { userId: rij.id, decision: 'approve' }, office)).status, 200);

  const ja = await inloggen();
  assert.equal(ja.status, 200, 'met beide stukken op orde werkt de personeelslogin gewoon');
  assert.ok(ja.body.token);
});

test('7. de zaak ziet ja of nee, en niets van een ander', async () => {
  const r = await api('/api/supplier/persoonseis', {}, mgr);
  assert.equal(r.status, 200);
  const mij = r.body.ploeg.find(p => p.staffId === staffId);
  assert.equal(mij.mag, true);
  assert.equal(mij.reden, null);
  /* Geen nummers, geen datums, geen soorten van een collega. Een werkgever hoeft
     niet te weten WAT iemand heeft om te weten of hij vandaag kan werken. */
  const tekst = JSON.stringify(r.body.ploeg);
  assert.equal(tekst.includes('VOG-2026-77'), false, 'het documentnummer lekt niet naar de werkgever');
  assert.equal(/\d{4}-\d{2}-\d{2}/.test(tekst), false, 'en de geldigheidsdatums ook niet');
  assert.ok(r.body.eisen.werk.length, 'wat het GENRE vraagt mag de zaak wel weten');
});

test('8. intrekken werkt zonder op een einddatum te wachten', async () => {
  const eigenSleutel = (await api('/api/vakbewijs', {}, lid)).body.vakbewijzen[0].sleutel;
  const stapel = await api('/api/office/vakbewijzen', {}, office);
  assert.equal(stapel.body.open.some(v => v.sleutel === eigenSleutel && v.wat === 'vog'), false,
    'een afgetekend stuk staat niet meer op de stapel');

  const mijn = await api('/api/vakbewijs', {}, lid);
  const eigen = mijn.body.vakbewijzen.find(v => v.wat === 'vog');
  const weg = await api('/api/office/vakbewijs/intrek',
    { sleutel: eigen.sleutel, wat: 'vog', door: 'M. de Vries', reden: 'ingetrokken door de gemeente' }, office);
  assert.equal(weg.status, 200);

  const nee = await inloggen();
  assert.equal(nee.status, 403, 'ingetrokken telt meteen, niet pas op de einddatum');
  assert.equal(nee.body.persoonseis[0].reden, 'ingetrokken');
});

test('9. het nummer gaat alleen open met een reden, en dat staat in het journaal', async () => {
  /* Een nieuw stuk om op te vragen; het vorige is in toets 8 ingetrokken. */
  assert.equal((await api('/api/vakbewijs/zet',
    { wat: 'vog', nummer: 'VOG-KLUIS-42', tot: '2031-01-01' }, lid)).status, 200);
  const sleutel = (await api('/api/vakbewijs', {}, lid)).body.vakbewijzen.find(v => v.wat === 'vog').sleutel;

  const zonder = await api('/api/office/vakbewijs/nummer', { sleutel, wat: 'vog' }, office);
  assert.equal(zonder.status, 400, 'zonder reden gaat de kluis niet open');
  const kort = await api('/api/office/vakbewijs/nummer', { sleutel, wat: 'vog', reden: 'ok' }, office);
  assert.equal(kort.status, 400, 'en een reden die niets zegt telt niet als reden');

  const met = await api('/api/office/vakbewijs/nummer',
    { sleutel, wat: 'vog', reden: 'aftekenen van de VOG bij de kinderopvang' }, office);
  assert.equal(met.status, 200);
  assert.equal(met.body.nummer, 'VOG-KLUIS-42');
  assert.ok(/journaal/i.test(met.body.grens), met.body.grens);

  /* En de blik staat er ook echt in -- gelezen door DE BETROKKENE zelf, want
     dat is waar het journaal voor bestaat (AVG art. 15: wie heeft mijn gegevens
     opgevraagd, en waarvoor). */
  const log = await api('/api/privacy/inzage', {}, lid);
  const regels = log.body.inzage || [];
  const mijne = regels.filter(r => /vakbewijs/.test(String(r.bron || '')));
  assert.ok(mijne.length >= 1, 'de inzage staat in het journaal: ' + JSON.stringify(regels));
  assert.ok(/aftekenen van de VOG/.test(String(mijne[0].waarom || '')), 'met de reden erbij');
  assert.equal(JSON.stringify(regels).includes('VOG-KLUIS-42'), false,
    'het journaal bewaart het nummer niet; dat zou een tweede kopie van de kluis zijn');
});

/* ============================================================================
   DE MUTATIES, EN WAT ERVAN ZAKTE (LAT-regel 2)

   A. RAAK, en dit is de mutatie waarvoor dit bestand bestaat. In
      routes/vakbewijs.js de soortcontrole bij /api/vakbewijs/zet uitgezet
      (`if (false)`) -- exact de mutatie die in test/persoonseis.test.js als
      AFGESLAGEN staat genoteerd, omdat dat bestand puur is en geen route raakt.
      -> toets 2 zakte: de onbekende soort 'vogg' werd nu gewoon aangenomen.

   B. RAAK. In routes/vakbewijs.js de ploeglijst van /api/supplier/persoonseis
      uitgebreid met `stukken: vakbewijzenVan(...)`, dus met nummers en datums
      erbij -- de vorm waarin een werkgever leest wat hij niet hoeft te weten.
      -> toets 7 zakte, en als enige: "het documentnummer lekt niet naar de
         werkgever".

   C. RAAK. In routes/vakbewijs.js /api/office/vakbewijs/teken van officeAuth
      naar supplierAuth gezet: de werkgever tekent dan de papieren van zijn
      eigen personeel af.
      -> toets 4 zakte op de bewering dat een supplier-token daar 401 hoort te
         krijgen.

   WAT DEZE DRIE OOK LATEN ZIEN, en het hoort er eerlijk bij: A en C sleepten
   toetsen 5 tot en met 8 mee. Deze toetsen bouwen op elkaar voort -- ze lopen
   één mens door één keten -- dus een mutatie vroeg in die keten laat alles
   erna vallen. De aanwijzing zit dan in de EERSTE die zakt (2 bij A, 4 bij C);
   B raakte er precies één en is daarmee de scherpste van de drie.
   ========================================================================== */
