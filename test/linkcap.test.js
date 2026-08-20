/* RTG LINK, DE CAPABILITY (server/kern/link/cap.js, kern/link/handelingen.js en
   de eerste handeling in kern/pay/vraagcode.js). Zie LINK.md par. 3.4.

   Wat hier bewezen moet worden:

   1. DE CODE DRAAGT DE INHOUD NIET. Wie de QR fotografeert, houdt niets over --
      geen bedrag, geen omschrijving, geen sleutel. Dat is de keuze waar het hele
      bestand op staat; als hij niet klopt, staat er een leesbaar betaalverzoek
      op een muur.
   2. KIJKEN IS GEEN DAAD, en de code gaat pas op als de handeling gelukt is.
   3. DE POORTEN VAN HET DOMEIN GELDEN. Een tweede deur naar hetzelfde geld
      zonder de poort van de eerste is een omweg om die poort heen -- precies de
      fout die bij de vorige plak van deze laag boven water kwam.
   4. EEN DEFINITIE DIE NIET DEUGT KOMT ER NIET IN, en niet stilletjes.

   Draai los: node --experimental-sqlite --test test/linkcap.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('node:crypto');
const maakHandelingen = require('../server/kern/link/handelingen');
const maakCap = require('../server/kern/link/cap');
const maakVraagcode = require('../server/kern/pay/vraagcode');
const { startServer, stop } = require('./helper');

/* Een capabilitylaag met een ECHTE ondertekenaar (een nagemaakte handtekening
   toetst zijn eigen nabootsing) en een handeling die alleen in deze toets
   bestaat: zo staat het gedrag van de MACHINERIE los van dat van RTG Pay. */
function maak(overschrijf = {}) {
  const dyncode = require('../server/kern/dyncode')({ crypto,
    dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-capsleutel-')) });
  const bonnen = [];
  const gedaan = [];
  const handelingen = maakHandelingen();
  const proef = Object.assign({
    id: 'proef.doen', wat: 'Iets doen', uitgever: ['lid'], aanvaarder: ['lid'],
    ttlMs: 60000, eenmalig: true,
    lees: (invoer) => (invoer.stuk ? { status: 400, error: 'Deze opdracht kan niet.' } : { hoeveel: 3 }),
    beschrijf: (o) => ({ wat: 'Doen', waarom: 'omdat het kan', velden: [{ naam: 'Hoeveel', waarde: String(o.hoeveel) }], gegevens: ['je codenaam'] }),
    doe: async (x) => { gedaan.push(x); return { klaar: true }; }
  }, overschrijf);
  handelingen.registreer(proef);
  const cap = maakCap({ crypto, dyncodeGeef: () => dyncode, codenaamVan: k => 'Lid ' + k,
    bonSchrijf: (b) => bonnen.push(b), handelingen, rate: () => true });
  cap.linkRemResetHulp = require('../server/kern/link/rem').remReset;
  cap.linkRemResetHulp();
  return { cap, dyncode, bonnen, gedaan, handelingen, proef };
}
const A = { soort: 'lid', key: 'A', codenaam: 'Lid A' };
const B = { soort: 'lid', key: 'B', codenaam: 'Lid B' };

/* ---------- 1. het register ---------- */

test('een definitie die niet deugt komt er niet in, en zegt waarom', () => {
  const h = maakHandelingen();
  const goed = { id: 'x.y', wat: 'iets', uitgever: ['lid'], aanvaarder: ['lid'], ttlMs: 60000,
    eenmalig: true, lees: () => ({}), beschrijf: () => ({}), doe: async () => ({}) };
  assert.equal(h.registreer({ ...goed }), 'x.y', 'een goede definitie gaat er gewoon in');
  const gevallen = [
    [{ id: 'geen-punt' }, /domein\.handeling/],
    [{ id: 'x.y' }, /al aangemeld/],
    [{ id: 'a.b', uitgever: ['tovenaar'] }, /onbekende rol/],
    [{ id: 'a.b', ttlMs: 60 * 60 * 1000 }, /ttlMs/],
    [{ id: 'a.b', eenmalig: undefined }, /eenmalig/],
    [{ id: 'a.b', doe: undefined }, /doe/]
  ];
  for (const [kapot, wat] of gevallen)
    assert.throws(() => h.registreer({ ...goed, ...kapot }), wat, JSON.stringify(Object.keys(kapot)));
});

/* ---------- 2. de code zelf ---------- */

test('de code draagt de opdracht niet: een foto van de QR levert niets op', () => {
  const { cap } = maak({ lees: () => ({ centen: 1850, oms: 'diner bij Ritz', aanCodenaam: 'Gouden Panter' }) });
  const r = cap.capMaak(A, { handeling: 'proef.doen' });
  assert.equal(r.status, 200);
  /* De romp van een RTG-code is gewoon base64: wie hem uit elkaar haalt leest
     soort|verwijzing|verval|nonce. Daar hoort niets van de opdracht in te staan. */
  const lijf = Buffer.from(r.token.split('.')[1], 'base64url').toString();
  const velden = lijf.split('|');
  assert.equal(velden[0], 'cap');
  for (const geheim of ['1850', 'diner', 'Ritz', 'Gouden', 'Panter'])
    assert.ok(!lijf.includes(geheim), 'de code lekt "' + geheim + '": ' + lijf);
  /* De sleutel van de uitgever is hier een LOSSE LETTER, en die zoeken met
     includes() is geen toets: de verwijzing is willekeurige base64 en bevat
     vroeg of laat een 'A'. Dan slaagt of zakt deze regel op toeval -- wat hij
     ook deed, tot hij per veld ging kijken. Zelfde val, zelfde oplossing als in
     test/contactpin.test.js. */
  assert.ok(!velden.includes('A'), 'de sleutel van de uitgever staat niet in de code');
  // en twee codes van dezelfde persoon lijken niet op elkaar
  assert.notEqual(cap.capMaak(A, { handeling: 'proef.doen' }).token, r.token);
});

test('de kaart zegt wie, wat, waarom, welke gegevens en hoe lang -- en geen echte naam', () => {
  const { cap } = maak();
  const r = cap.capMaak(A, { handeling: 'proef.doen' });
  const k = cap.capKijk(B, r.token).kaart;
  assert.equal(k.van, 'Lid A', 'de codenaam van de uitgever, uit de gids');
  assert.equal(k.wat, 'Doen');
  assert.equal(k.waarom, 'omdat het kan');
  assert.deepEqual(k.velden, [{ naam: 'Hoeveel', waarde: '3' }]);
  assert.deepEqual(k.gegevens, ['je codenaam']);
  assert.equal(k.eenmalig, true);
  assert.ok(Date.parse(k.tot) > Date.now(), 'hij verloopt, en dat staat erbij');
});

/* ---------- 3. kijken, doen, opgaan ---------- */

test('kijken is geen daad, en twee keer kijken verbrandt de code niet', async () => {
  const { cap, gedaan, bonnen } = maak();
  const r = cap.capMaak(A, { handeling: 'proef.doen' });
  assert.equal(cap.capKijk(B, r.token).status, 200);
  assert.equal(cap.capKijk(B, r.token).status, 200);
  assert.deepEqual(gedaan, [], 'er is niets uitgevoerd');
  assert.deepEqual(bonnen, [], 'en dus ook geen bon');
});

test('de code gaat pas op als de handeling gelukt is', async () => {
  let lukt = false;
  const { cap } = maak({ doe: async () => (lukt ? { klaar: true } : { status: 409, error: 'Even niet.' }) });
  const r = cap.capMaak(A, { handeling: 'proef.doen' });
  const mislukt = await cap.capAanvaard(B, r.token, null);
  assert.equal(mislukt.status, 409, 'de handeling weigerde');
  assert.equal(cap.capKijk(B, r.token).status, 200, 'en de code leeft nog: anders kun je het niet opnieuw proberen');
  lukt = true;
  assert.equal((await cap.capAanvaard(B, r.token, null)).ok, true);
  assert.equal(cap.capKijk(B, r.token).status, 404, 'nu is hij op');
});

test('de handeling ziet alleen wat `neem` doorlaat, nooit de ruwe body', async () => {
  /* Waarom dit een eigen toets is: een mutatie die `neem` oversloeg en de ruwe
     body doorgaf, BEET NIET -- de kassacode draagt toevallig dezelfde veldnamen,
     dus het gedrag bleef gelijk (LAT.md regel 2: afgeslagen is zelf een uitkomst).
     Wat `neem` werkelijk doet is een sluis zijn: wat een aanvaarder meestuurt komt
     niet ongezien bij de handeling terecht. Dat is precies wat hier gemeten wordt. */
  const gezien = [];
  const { cap } = maak({
    neem: (ruw) => ({ hoeveel: Math.round(Number(ruw && ruw.hoeveel)) || 1 }),
    doe: async (x) => { gezien.push(x.invoer); return { klaar: true }; }
  });
  const r = cap.capMaak(A, { handeling: 'proef.doen' });
  await cap.capAanvaard(B, r.token, null, { hoeveel: '7', rommel: 'x', uitgeverKey: 'A' });
  assert.deepEqual(gezien, [{ hoeveel: 7 }], 'alleen het gekeurde veld, en omgezet');
});

test('aanvaarden schrijft twee bonnen: de dader en de eigenaar van de code', async () => {
  const { cap, bonnen } = maak();
  const r = cap.capMaak(A, { handeling: 'proef.doen' });
  await cap.capAanvaard(B, r.token, null);
  assert.equal(bonnen.length, 2);
  assert.deepEqual(bonnen.map(b => [b.wie, b.intentie]),
    [['B', 'proef.doen'], ['A', 'proef.doen.gebruikt']],
    'de uitgever ziet dat zijn code gebruikt is -- zo merk je dat er een van jou rondgaat');
});

test('je eigen code aanvaarden kan niet, en een ander mag hem niet intrekken', async () => {
  const { cap, gedaan } = maak();
  const r = cap.capMaak(A, { handeling: 'proef.doen' });
  const zelf = await cap.capAanvaard({ soort: 'lid', key: 'A' }, r.token, null);
  assert.equal(zelf.status, 400);
  assert.match(zelf.error, /eigen code/i);
  assert.deepEqual(gedaan, []);
  assert.equal(cap.capTrek(B, r.token).status, 403, 'B trekt de code van A niet in');
  assert.equal(cap.capTrek(A, r.token).ok, true);
  assert.equal(cap.capKijk(B, r.token).status, 404, 'na het intrekken wijst hij niets meer aan');
  /* En nog een keer intrekken, op een code die er niet meer is. Dat pad raakte
     GEEN ENKELE toets, en juist daar greep capTrek na een herindeling naar een
     naam die in het andere bestand stond -- gevonden door regel 50 van de
     keuring en niet door deze suite. Vandaar deze twee regels. */
  const weer = cap.capTrek(A, r.token);
  assert.equal(weer.status, 404);
  /* Vergeleken met de ANDERE deur, en niet met nog een intrekking: twee
     uitkomsten van dezelfde functie zijn samen net zo fout als samen goed, en
     dan meet de regel niets (dat zag ik een mutatie bewijzen). Kijken en
     intrekken horen over een code die weg is hetzelfde te zeggen. */
  assert.equal(weer.error, cap.capKijk(A, r.token).error, 'beide deuren, hetzelfde antwoord');
});

test('verlopen, ingetrokken, opgebruikt en vervalst geven allemaal hetzelfde niets', async () => {
  const { cap, dyncode } = maak();
  const vers = cap.capMaak(A, { handeling: 'proef.doen' });
  const onbekend = cap.capKijk(B, dyncode.maak({ soort: 'cap', code: 'bestaatniet' }).token);

  const verlopen = cap.capMaak(A, { handeling: 'proef.doen' });
  for (const x of cap.capOpen.values()) x.vervalt = Date.now() - 1;
  assert.deepEqual(cap.capKijk(B, verlopen.token), onbekend, 'verlopen');

  const getrokken = cap.capMaak(A, { handeling: 'proef.doen' });
  cap.capTrek(A, getrokken.token);
  assert.deepEqual(cap.capKijk(B, getrokken.token), onbekend, 'ingetrokken');

  const op = cap.capMaak(A, { handeling: 'proef.doen' });
  await cap.capAanvaard(B, op.token, null);
  assert.deepEqual(cap.capKijk(B, op.token), onbekend, 'opgebruikt');

  const stuk = vers.token.slice(0, -2) + (vers.token.slice(-2) === 'AA' ? 'BB' : 'AA');
  assert.deepEqual(cap.capKijk(B, stuk), onbekend, 'vervalst');
});

/* ---------- 4. wie mag wat ---------- */

test('de rollen uit het register worden aan beide kanten afgedwongen', async () => {
  const { cap } = maak();
  const zaak = { soort: 'supplier', key: 'RITZ', code: 'RITZ' };
  assert.equal(cap.capMaak(zaak, { handeling: 'proef.doen' }).status, 403, 'een zaak maakt geen ledencode');
  const r = cap.capMaak(A, { handeling: 'proef.doen' });
  assert.equal((await cap.capAanvaard(zaak, r.token, null)).status, 403, 'en aanvaardt hem ook niet');
  assert.equal(cap.capMaak(A, { handeling: 'bestaat.niet' }).status, 404);
  // en de opdracht zelf wordt door het DOMEIN gekeurd, niet door deze laag
  assert.equal(cap.capMaak(A, { handeling: 'proef.doen', stuk: true }).status, 400);
});

/* ---------- 5. de eerste echte handeling: de vraagcode van RTG Pay ---------- */

test('de vraagcode bindt het bedrag en leunt op de grenzen van RTG Pay', () => {
  const def = maakVraagcode({ pay: { MIN_CENTEN: 50, MAX_CENTEN: 100000 },
    payGate: () => ({ ok: true }), schoon: (s, n) => String(s == null ? '' : s).slice(0, n) });
  assert.equal(def.id, 'geld.ontvangen');
  assert.equal(def.eenmalig, true);
  assert.ok(def.ttlMs <= 5 * 60 * 1000, 'nooit langer dan de ondertekenaar aankan');
  assert.equal(def.lees({ centen: 10 }, A).status, 400, 'onder de ondergrens van RTG Pay');
  assert.equal(def.lees({ centen: 999999 }, A).status, 400, 'en boven de bovengrens');
  assert.equal(def.lees({ centen: 1850 }, { soort: 'lid', key: 'A' }).status, 403, 'zonder codenaam kan er niets heen');
  const o = def.lees({ centen: 1850, oms: 'diner' }, A);
  assert.deepEqual(o, { centen: 1850, oms: 'diner', aanCodenaam: 'Lid A' });
  const k = def.beschrijf(o);
  assert.equal(k.velden[0].waarde, '€ 18,50');
  assert.equal(k.waarom, 'diner');
});

test('de vraagcode gaat langs de KYC-poort van RTG Pay, en boekt niet als die dicht is', async () => {
  const geboekt = [];
  const dicht = { ok: false, status: 403, error: 'RTG Pay vraagt eenmalig je paspoort.' };
  const def = maakVraagcode({
    pay: { MIN_CENTEN: 50, MAX_CENTEN: 100000, stuur: async (x) => { geboekt.push(x); return { ok: true, saldo: 0 }; } },
    payGate: () => dicht, schoon: (s, n) => String(s == null ? '' : s).slice(0, n) });
  const r = await def.doe({ opdracht: { centen: 1850, oms: 'diner', aanCodenaam: 'Lid A' },
    aanvaarder: B, sessie: {}, idem: 'cap:x' });
  assert.equal(r.status, 403);
  assert.equal(r.kyc, true, 'de app kan het lid naar de paspoortstap sturen');
  assert.deepEqual(geboekt, [], 'en er is niets geboekt');
});

/* ---------- 6. de deur, op een echte server ---------- */
let BASE, child;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-linkcap-'));

test.before(async () => { ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } })); });
test.after(() => { stop(child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

const json = r => r.json();
function api(pad, body, token) {
  return fetch(BASE + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {}) });
}
/* Een lid met een getoond paspoort. Zonder die stap loopt elke betaling op de
   KYC-poort van RTG Pay, en dan toetst dit bestand die poort in plaats van de
   capability. Dat de poort ook via deze deur geldt, staat als eigen toets
   hieronder -- met een lid dat zijn paspoort juist NIET liet zien. */
const KYC_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
async function nieuwLid(naam, paspoort = true) {
  const reg = await json(await api('/api/auth/register', { name: naam,
    email: naam.replace(/\s/g, '') + Date.now() + '@voorbeeld.test', phone: '0611122233',
    password: 'geheim123', geboortedatum: '1990-05-05', tier: 'rtg' }));
  if (paspoort) await api('/api/verify/upload', { image: KYC_PNG }, reg.token);
  const st = await json(await api('/api/state', {}, reg.token));
  return { token: reg.token, codenaam: st.state.user.codename };
}
const saldo = async (t) => (await json(await api('/api/pay/overzicht', {}, t))).saldo;

test('een vraagcode van twee minuten: scannen, zien wat er gebeurt, en pas dan betalen', async () => {
  const anna = await nieuwLid('Anna Cap');
  const boris = await nieuwLid('Boris Cap');
  await api('/api/pay/oplaad', { centen: 50000, idem: 'cap-op-' + Date.now() }, boris.token);
  const voorA = await saldo(anna.token), voorB = await saldo(boris.token);

  const gemaakt = await json(await api('/api/link/cap/maak',
    { handeling: 'geld.ontvangen', centen: 1850, oms: 'diner' }, anna.token));
  assert.match(gemaakt.token, /^RTG1\./);
  assert.equal(gemaakt.kaart.velden[0].waarde, '€ 18,50');

  // stap 1: scannen langs de gewone linkdeur -- dit doet niets
  const gezien = await json(await api('/api/link/los', { tekst: gemaakt.token }, boris.token));
  assert.equal(gezien.type, 'capability');
  assert.equal(gezien.onderwerp.van, anna.codenaam, 'de codenaam, nooit de echte naam');
  assert.ok(!JSON.stringify(gezien).includes('Anna Cap'), 'de echte naam blijft in de kluis');
  assert.equal(gezien.onderwerp.waarom, 'diner');
  assert.deepEqual(gezien.intenties.map(i => i.id), ['capability.aanvaarden']);
  assert.equal(await saldo(boris.token), voorB, 'kijken kost niets');

  // stap 2: de weg volgen die de intentie noemde
  const betaald = await json(await api(gezien.intenties[0].weg, { capcode: gemaakt.token }, boris.token));
  assert.equal(betaald.ok, true);
  assert.equal(await saldo(boris.token), voorB - 1850, 'de betaler is 18,50 kwijt');
  assert.equal(await saldo(anna.token), voorA + 1850, 'en Anna heeft het');

  // eenmalig: een tweede poging haalt niets meer
  const nog = await api('/api/link/cap/aanvaard', { capcode: gemaakt.token }, boris.token);
  assert.equal(nog.status, 404);
  assert.equal(await saldo(boris.token), voorB - 1850, 'en er is echt niet twee keer geboekt');

  // en beide kanten hebben hun bon
  const bonB = (await json(await api('/api/link/koppelingen', {}, boris.token))).bonnen;
  const bonA = (await json(await api('/api/link/koppelingen', {}, anna.token))).bonnen;
  assert.equal(bonB[0].intentie, 'geld.ontvangen');
  assert.equal(bonA[0].intentie, 'geld.ontvangen.gebruikt');
});

test('de KYC-poort van RTG Pay geldt ook via de capabilitydeur', async () => {
  /* DE FOUT DIE DEZE TOETS TEGENHOUDT is dezelfde die bij de vorige plak van
     deze laag boven water kwam: een tweede deur naar hetzelfde ding, zonder de
     poort die voor de eerste staat. /api/pay/stuur laat een gratis lid pas
     betalen nadat het zijn paspoort heeft getoond; als de capabilitydeur dat
     niet ook doet, is hij een omweg om die poort heen. */
  const geert = await nieuwLid('Geert Cap');                 // mét paspoort: hij vraagt
  const hanna = await nieuwLid('Hanna Cap', false);          // zónder: zij zou betalen
  const gemaakt = await json(await api('/api/link/cap/maak',
    { handeling: 'geld.ontvangen', centen: 1200, oms: 'taxi' }, geert.token));
  const r = await api('/api/link/cap/aanvaard', { capcode: gemaakt.token }, hanna.token);
  assert.equal(r.status, 403);
  const lijf = await json(r);
  assert.equal(lijf.kyc, true, 'en de app weet dat ze naar de paspoortstap moet');
  // de rechtstreekse weg weigert precies hetzelfde, en dat is het punt
  assert.equal((await api('/api/pay/stuur', { aan: geert.codenaam, centen: 1200 }, hanna.token)).status, 403);
  // de code is niet opgegaan aan een poging die nooit doorging
  assert.equal((await json(await api('/api/link/los', { tekst: gemaakt.token }, hanna.token))).type, 'capability');
});

test('de uitgever kan zijn eigen vraagcode intrekken, en niemand anders', async () => {
  const clara = await nieuwLid('Clara Cap');
  const dries = await nieuwLid('Dries Cap');
  const gemaakt = await json(await api('/api/link/cap/maak',
    { handeling: 'geld.ontvangen', centen: 500, oms: 'koffie' }, clara.token));
  assert.equal((await api('/api/link/cap/trek', { capcode: gemaakt.token }, dries.token)).status, 403);
  assert.equal((await json(await api('/api/link/los', { tekst: gemaakt.token }, dries.token))).type, 'capability',
    'hij leeft nog: de mislukte intrekking heeft niets gedaan');
  assert.equal((await json(await api('/api/link/cap/trek', { capcode: gemaakt.token }, clara.token))).ok, true);
  assert.equal((await api('/api/link/los', { tekst: gemaakt.token }, dries.token)).status, 404);
});

test('een capability is niet te maken langs de gewone codedeur', async () => {
  /* /api/code/dyn geeft ondertekende codes uit voor de soorten die een rol MAG
     maken. Stond 'cap' daar ook bij, dan kon elk lid een code maken die de
     capabilitydeur serieus neemt -- het handelingenregister overgeslagen, en
     alle grenzen die daaraan hangen mee. */
  const eva = await nieuwLid('Eva Cap');
  const r = await api('/api/code/dyn', { soort: 'cap', code: 'wat-dan-ook' }, eva.token);
  assert.equal(r.status, 403);
  for (const soort of ['kas', 'pas', 'zegel'])
    assert.equal((await api('/api/code/dyn', { soort, code: 'x' }, eva.token)).status, 200,
      'de soorten die een lid wel mag, werken nog gewoon (' + soort + ')');
});

test('je eigen vraagcode scannen zegt dat het je eigen code is', async () => {
  const finn = await nieuwLid('Finn Cap');
  const gemaakt = await json(await api('/api/link/cap/maak',
    { handeling: 'geld.ontvangen', centen: 750, oms: 'lunch' }, finn.token));
  const r = await api('/api/link/los', { tekst: gemaakt.token }, finn.token);
  assert.equal(r.status, 400);
  assert.match((await json(r)).error, /eigen code/i);
});
