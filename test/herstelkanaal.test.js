/* ============================================================================
   HET TELEFOONNUMMER IS EEN HERSTELKANAAL.

   DE BEVINDING DIE HIERONDER ZIT. /api/auth/reset stuurt een sms naar
   phoneOf(u). Wie dat nummer omzet, verlegt de weg waarlangs een wachtwoord
   wordt hersteld -- dat is de EERSTE stap van een accountovername, en het
   wachtwoord is pas de tweede. Toch eiste alleen die tweede stap een
   bevestiging: /api/auth/password vraagt het huidige wachtwoord, het nummer
   vervangen vroeg niets.

   routes/auth/herstel.js redeneert in zijn eigen commentaar dat een aanvaller
   "eerst het telefoonnummer zou moeten weghalen, en daarvoor moet hij al binnen
   zijn". Die redenering klopt; de aanname eronder niet. setPhone kon een nummer
   niet LEEGMAKEN, maar wel VERVANGEN -- en dat komt op hetzelfde neer.

   HET ONDERSCHEID DAT DEZE TOETSEN BEWAKEN is niet "zetten" maar "vervangen".
   Een eerste nummer invullen is geen kaping (er was geen kanaal), en daar een
   wachtwoord voor vragen is wrijving zonder winst. Toets 1 en 2 leggen precies
   die grens vast.

   Draai los: node --test test/herstelkanaal.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

/* De grendel zit in accounts.setPhone en NIET op een route, en dat is de kern
   van de reparatie: op een route dek je de aanroepers die je kent, in de kern
   ook die van volgend jaar. Toets 4 bewaakt dat de grendel daar blijft. */
test('4. de grendel zit in de kern en niet op een route', () => {
  const bron = fs.readFileSync(path.join(__dirname, '..', 'server', 'accounts', 'users.js'), 'utf8');
  assert.match(bron, /function setPhone\(id, phone, opties\)/,
    'setPhone hoort een optie te kennen; zonder die vorm kan geen enkele aanroeper bewijzen dat hij de mens opnieuw controleerde');
  assert.match(bron, /vervangenMag === true/,
    'de vlag hoort strikt op true te toetsen: een waarheidsachtige waarde (1, "ja") mag geen herstelkanaal verleggen');
  assert.match(bron, /herstelkanaal/,
    'de weigering hoort een naam te dragen, zodat een aanroeper hem kan herkennen en melden');
});

test('4b. de twee bestaande aanroepers geven de vlag NIET mee', () => {
  for (const rel of [['server', 'kern', 'gegevensgesprek.js'], ['server', 'kern', 'onboarding', 'inrichten.js']]) {
    const bron = fs.readFileSync(path.join(__dirname, '..', ...rel), 'utf8');
    const m = bron.match(/accounts\.setPhone\([^)]*\)/g) || [];
    assert.ok(m.length, rel.join('/') + ' roept setPhone niet meer aan; deze toets loopt achter');
    for (const aanroep of m) {
      assert.equal(/vervangenMag/.test(aanroep), false,
        rel.join('/') + ' geeft vervangenMag mee, maar controleert daar geen wachtwoord: ' + aanroep);
    }
  }
});

test('4c. en ze melden de weigering in plaats van hem te slikken', () => {
  const gesprek = fs.readFileSync(path.join(__dirname, '..', 'server', 'kern', 'gegevensgesprek.js'), 'utf8');
  assert.match(gesprek, /error === 'herstelkanaal'/,
    'een stille weigering laat een mens denken dat zijn nummer is bijgewerkt terwijl het oude nog geldt');
  const inricht = fs.readFileSync(path.join(__dirname, '..', 'server', 'kern', 'onboarding', 'inrichten.js'), 'utf8');
  assert.match(inricht, /error === 'herstelkanaal'/);
  assert.match(inricht, /geweigerd/);
});

/* DE ROUTE ZELF, en dan als GEDRAG en niet als brontekst.

   De eerste versie van deze twee toetsen las de bron en zocht naar de juiste
   woorden. De mutatieproef liet zien waarom dat te zwak is: zet je de code die
   het gevolg meldt achter `if (false)`, dan staat de tekst er nog steeds en
   blijft de toets groen. Een brontoets kan niet zien of een pad wordt gelopen.

   Vandaar dezelfde nagemaakte app als in test/mijnsessies.test.js: de handlers
   worden echt aangeroepen, met een accounts-laag die alleen kan wat hier nodig
   is. */
function bouwRoute({ wachtwoordKlopt, gezet }) {
  const routes = {};
  const app = { post: (pad, auth, fn) => { routes[pad] = fn; } };
  const accounts = {
    verifyPassword: async (aangeboden) => wachtwoordKlopt(aangeboden),
    setPhone: (id, nummer, opties) => {
      if (!(opties && opties.vervangenMag === true)) return { error: 'herstelkanaal', reden: 'vraagt eerst uw wachtwoord' };
      gezet.push(nummer); return { id, nummer };
    }
  };
  require('../server/routes/member/herstelkanaal')({ app, auth: null, accounts });
  return routes['/api/mijn/herstelkanaal/telefoon'];
}
const antwoord = () => {
  const r = { code: 200, data: null };
  r.status = (c) => { r.code = c; return r; };
  r.json = (d) => { if (r.data === null) r.data = d; return r; };   // eerste antwoord telt
  return r;
};
const sessie = { tier: 'rtg', key: 'user-1', account: { id: 1, password_hash: 'x' } };

test('5. zonder het juiste wachtwoord verandert er niets', async () => {
  const gezet = [];
  const route = bouwRoute({ wachtwoordKlopt: () => false, gezet });
  const res = antwoord();
  await route({ session: sessie, body: { huidig: 'fout', telefoon: '0698765432' } }, res);
  assert.equal(res.code, 403);
  assert.deepEqual(gezet, [], 'er mag geen nummer zijn weggeschreven');
});

test('5b. met het juiste wachtwoord wel, en het GEVOLG staat in het antwoord', async () => {
  const gezet = [];
  const route = bouwRoute({ wachtwoordKlopt: () => true, gezet });
  const res = antwoord();
  await route({ session: sessie, body: { huidig: 'goed', telefoon: '0698765432' } }, res);
  assert.equal(res.data.ok, true);
  assert.deepEqual(gezet, ['0698765432']);
  assert.ok(res.data.gevolg,
    'wie deze melding leest en de wijziging niet herkent, hoort meteen te weten dat er iets mis is');
  assert.match(res.data.gevolg, /herstelcode gaat vanaf nu/i);
});

test('5c. eerst controleren, dan pas wijzigen', async () => {
  const volgorde = [];
  const routes = {};
  const app = { post: (pad, auth, fn) => { routes[pad] = fn; } };
  const accounts = {
    verifyPassword: async () => { volgorde.push('controle'); return true; },
    setPhone: () => { volgorde.push('wijziging'); return { ok: true }; }
  };
  require('../server/routes/member/herstelkanaal')({ app, auth: null, accounts });
  await routes['/api/mijn/herstelkanaal/telefoon']({ session: sessie, body: { huidig: 'g', telefoon: '0612345678' } }, antwoord());
  assert.deepEqual(volgorde, ['controle', 'wijziging'],
    'andersom is de wijziging al gebeurd als de controle zakt');
});

test('5d. een te kort nummer wordt geweigerd voordat er iets verandert', async () => {
  const gezet = [];
  const route = bouwRoute({ wachtwoordKlopt: () => true, gezet });
  const res = antwoord();
  await route({ session: sessie, body: { huidig: 'goed', telefoon: '061' } }, res);
  assert.equal(res.code, 400);
  assert.deepEqual(gezet, []);
});

/* En de route staat op de zware lijst van het bezitsbewijs -- niet omdat dat het
   gat dicht (een bezitsbewijs vraagt om het toestel, niet om de mens), maar
   omdat een gestolen token er anders wel bij zou kunnen met een wachtwoord dat
   uit dezelfde inbraak komt. */
test('6. de twee nummer-routes staan op de zware lijst', () => {
  const { PADEN } = require('../server/kern/identiteit/bezitspaden');
  const paden = PADEN.map(p => p.pad);
  assert.ok(paden.some(p => '/api/gegevens/zeg'.startsWith(p)));
  assert.ok(paden.some(p => '/api/onboarding/inricht'.startsWith(p)));
});

/* ===========================================================================
   HET E-MAILADRES. Zwaarder dan het nummer, want dit adres is de INLOGNAAM
   (findByLogin zoekt op email_hash) EN het herstelkanaal tegelijk. Wie het
   vervangt, neemt de voordeur en de achterdeur in een keer over.

   De dragende bewering staat in toets 8: het adres wisselt pas als iemand bij
   het NIEUWE adres kan. Dat is niet alleen beveiliging maar ook bescherming
   tegen een typefout -- ging het meteen in, dan is een verkeerd getypte letter
   een account waar niemand meer in kan.
   ========================================================================= */
function bouwMail({ wachtwoordKlopt, verstuurd, gezet, dossier, tokenOk, geverifieerd = [] }) {
  const routes = {};
  const app = { post: (pad, a, fn) => { routes[pad] = fn || a; } };
  const bewijsHash = token => require('crypto').createHash('sha256')
    .update(String(token || '')).digest('hex');
  const accounts = {
    verifyPassword: async (a) => wachtwoordKlopt(a),
    emailOf: () => 'oud@example.com',
    getMemberState: () => dossier.waarde,
    saveMemberState: (id, o) => { dossier.waarde = o; },
    issueActionToken: () => 'tok-abc',
    verifyActionToken: (t, doel) => ((typeof tokenOk === 'function' ? tokenOk(t, doel) : tokenOk) && doel === 'mailwissel' ? { id: 1 } : null),
    hashActiebewijs: bewijsHash,
    kloptActiebewijs: (hash, token) => hash === bewijsHash(token),
    trekInActie: () => true,
    setEmailVerified: id => { geverifieerd.push(id); return { id }; },
    setEmail: (id, adres, opties) => {
      if (!(opties && opties.vervangenMag === true)) return { error: 'herstelkanaal' };
      gezet.push(adres); return { id, adres };
    }
  };
  const mail = { send: (aan, onderwerp, tekst) => verstuurd.push({ aan, onderwerp, tekst }) };
  require('../server/routes/member/herstelkanaal')({ app, auth: null, accounts, mail,
    appUrl: () => 'https://rtg.test' });
  return routes;
}
const dossierNu = () => ({ waarde: {} });

test('8. het adres wisselt NIET bij de aanvraag -- pas na bevestiging', async () => {
  const verstuurd = [], gezet = [], geverifieerd = [], dossier = dossierNu();
  const r = bouwMail({ wachtwoordKlopt: () => true, verstuurd, gezet, dossier, tokenOk: true, geverifieerd });
  const res = antwoord();
  await r['/api/mijn/herstelkanaal/email']({ session: sessie, body: { huidig: 'goed', email: 'nieuw@example.com' } }, res);
  assert.equal(res.data.ok, true);
  assert.deepEqual(gezet, [], 'na de aanvraag mag er nog niets gewijzigd zijn; een typefout zou het account anders onbereikbaar maken');
  assert.equal(dossier.waarde.mailwissel.naar, 'nieuw@example.com');

  const res2 = antwoord();
  await r['/api/mijn/herstelkanaal/email/bevestig']({ body: { token: 'tok-abc' } }, res2);
  assert.deepEqual(gezet, ['nieuw@example.com']);
  assert.deepEqual(geverifieerd, [1], 'de mailboxbevestiging maakt precies dit nieuwe adres geverifieerd');
  assert.equal(dossier.waarde.mailwissel, undefined, 'de openstaande wissel hoort daarna weg te zijn');
});

test('8a. een oudere link kan een latere wijzigingsaanvraag niet bevestigen', async () => {
  const verstuurd = [], gezet = [], dossier = dossierNu();
  const r = bouwMail({ wachtwoordKlopt: () => true, verstuurd, gezet, dossier,
    tokenOk: () => true });
  await r['/api/mijn/herstelkanaal/email']({ session: sessie,
    body: { huidig: 'goed', email: 'eerste@example.com' } }, antwoord());
  dossier.waarde.mailwissel = {
    naar: 'later@example.com', tot: Date.now() + 60000,
    bewijs: require('crypto').createHash('sha256').update('tok-later').digest('hex')
  };
  const res = antwoord();
  await r['/api/mijn/herstelkanaal/email/bevestig']({ body: { token: 'tok-abc' } }, res);
  assert.equal(res.code, 400);
  assert.deepEqual(gezet, [], 'een link voor een eerdere mailbox bewijst geen toegang tot de latere mailbox');
  assert.equal(dossier.waarde.mailwissel.naar, 'later@example.com');
});

test('8b. het OUDE adres krijgt bericht, zonder goedkeurlink', async () => {
  const verstuurd = [], gezet = [], dossier = dossierNu();
  const r = bouwMail({ wachtwoordKlopt: () => true, verstuurd, gezet, dossier, tokenOk: true });
  await r['/api/mijn/herstelkanaal/email']({ session: sessie, body: { huidig: 'goed', email: 'nieuw@example.com' } }, antwoord());
  const naarOud = verstuurd.find(m => m.aan === 'oud@example.com');
  const naarNieuw = verstuurd.find(m => m.aan === 'nieuw@example.com');
  assert.ok(naarNieuw && /https:\/\/rtg\.test/.test(naarNieuw.tekst), 'het nieuwe adres krijgt de bevestigingslink');
  assert.ok(naarOud, 'wie dit niet zelf deed, hoort het te horen op het adres dat hij nog heeft');
  assert.equal(/https:\/\/rtg\.test/.test(naarOud.tekst), false,
    'in dat bericht hoort GEEN link te staan: een aanvaller die de mailbox al leest, zou er anders zelf op klikken');
});

test('8c. zonder het juiste wachtwoord gebeurt er niets', async () => {
  const verstuurd = [], gezet = [], dossier = dossierNu();
  const r = bouwMail({ wachtwoordKlopt: () => false, verstuurd, gezet, dossier, tokenOk: true });
  const res = antwoord();
  await r['/api/mijn/herstelkanaal/email']({ session: sessie, body: { huidig: 'fout', email: 'nieuw@example.com' } }, res);
  assert.equal(res.code, 403);
  assert.deepEqual(verstuurd, [], 'er mag ook geen bericht de deur uit; anders is dit een manier om iemand te bestoken');
  assert.deepEqual(dossier.waarde, {});
});

test('8d. een ongeldige of verlopen bevestiging wisselt niets', async () => {
  const verstuurd = [], gezet = [], dossier = dossierNu();
  const r = bouwMail({ wachtwoordKlopt: () => true, verstuurd, gezet, dossier, tokenOk: false });
  const res = antwoord();
  await r['/api/mijn/herstelkanaal/email/bevestig']({ body: { token: 'tok-abc' } }, res);
  assert.equal(res.code, 400);
  assert.deepEqual(gezet, []);
});

test('8e. de aanvraag verraadt niet of een adres al bestaat', () => {
  const bron = fs.readFileSync(path.join(__dirname, '..', 'server', 'routes', 'member', 'herstelkanaal.js'), 'utf8');
  const i = bron.indexOf("app.post('/api/mijn/herstelkanaal/email'");
  const j = bron.indexOf("app.post('/api/mijn/herstelkanaal/email/bevestig'");
  const aanvraag = bron.slice(i, j);
  assert.equal(/inGebruik/.test(aanvraag), false,
    'bij de AANVRAAG toetsen of het adres vrij is, maakt dit een manier om te ontdekken welke adressen een RTG-account hebben');
  assert.match(bron.slice(j), /inGebruik/, 'bij de BEVESTIGING hoort die toets wel te staan');
});

test('8f. het nieuwe adres komt binnen als onbevestigd', () => {
  const bron = fs.readFileSync(path.join(__dirname, '..', 'server', 'accounts', 'users.js'), 'utf8');
  const i = bron.indexOf('function setEmail(');
  const blok = bron.slice(i, i + 1800);
  assert.match(blok, /email_verified = 0/,
    'een adres dat als bevestigd binnenkomt, is een bevestiging die niemand heeft gegeven');
  assert.match(blok, /vervangenMag === true/);
});
