/* ============================================================================
   DE TWEEDE FACTOR VOOR LEDEN.

   DE BEWERING DIE ERTOE DOET staat in toets 6: TOTP is GEEN passkey. Bij een
   passkey heeft dit huis de private helft nooit gezien; bij TOTP delen wij het
   geheim, en een code is dus door te vertellen aan wie erom vraagt -- precies
   waar phishing op drijft. De vertrouwensstand komt daarom op `tweefactor` uit
   en niet op `bezit`. Dat is minder vleiend dan een groen vinkje en het is wat
   er waar is.

   En toets 3: aanzetten is TWEE stappen. Zou het geheim meteen gelden, dan
   sluit een verkeerd gescande QR het lid buiten -- en dat merkt hij pas bij de
   volgende inlog, als het te laat is.

   Draai los: node --test test/tweefactor.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { maakTweefactor } = require('../server/kern/identiteit/tweefactor');
const { totpCode } = require('../server/kern/totp');

/* Elke aanroep een ANDER geheim: totpOk onthoudt gebruikte codes negentig
   seconden, dus toetsen die hetzelfde geheim delen zouden elkaar in de weg
   zitten. Dat is geen gebrek maar de herhaalbescherming. */
function opzet() {
  let md = {};
  const accounts = { getMemberState: () => md, saveMemberState: (id, o) => { md = o; } };
  return { tf: maakTweefactor({ accounts }), u: { id: 1 }, dossier: () => md };
}
const nu = (geheim, stap = 0) => totpCode(geheim, Date.now() + stap * 30000, 30);

test('1. zonder tweede factor zegt de stand dat, en waarom dat iets betekent', () => {
  const { tf, u } = opzet();
  const s = tf.standVan(u);
  assert.equal(s.aan, false);
  assert.match(s.uitleg, /enige dat tussen een ander en uw account staat/);
});

test('2. het geheim gaat naar het LEDENDOSSIER en niet naar db.data', () => {
  const bron = fs.readFileSync(path.join(__dirname, '..', 'server', 'kern', 'identiteit', 'tweefactor.js'), 'utf8');
  const code = bron.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const verboden of ['db.data', 'eigencollectie', 'save(']) {
    assert.equal(code.includes(verboden), false,
      'een TOTP-geheim is een inloggeheim en hoort niet in de operationele opslag: "' + verboden + '"');
  }
  assert.match(code, /getMemberState|saveMemberState/);
});

/* ---------------------------------------------------------------------------
   3. AANZETTEN IS TWEE STAPPEN.
   ------------------------------------------------------------------------- */
test('3. na begin() staat de factor nog NIET aan', () => {
  const { tf, u } = opzet();
  const b = tf.begin(u, 'RTG', 'lid');
  assert.ok(b.geheim && b.uri);
  assert.equal(tf.standVan(u).aan, false,
    'meteen aanzetten sluit een lid buiten dat de QR verkeerd scant, en dat merkt hij pas bij de volgende inlog');
  assert.equal(tf.standVan(u).inWachtkamer, true);
});

test('3b. een foute code zet hem niet aan', () => {
  const { tf, u } = opzet();
  tf.begin(u, 'RTG', 'lid');
  assert.equal(tf.bevestig(u, '000000').status, 403);
  assert.equal(tf.standVan(u).aan, false);
});

test('3c. een code uit de eigen app zet hem wel aan, met een set herstelcodes', () => {
  const { tf, u } = opzet();
  const b = tf.begin(u, 'RTG', 'lid');
  const r = tf.bevestig(u, nu(b.geheim));
  assert.equal(r.ok, true);
  assert.equal(r.herstelcodes.length, tf.CODES);
  assert.match(r.let, /nooit meer getoond/, 'wie denkt ze later terug te vinden, bewaart ze niet');
  assert.equal(tf.standVan(u).aan, true);
});

/* ---------------------------------------------------------------------------
   4. DE HERSTELCODES: gehasht, eenmalig, en telbaar.
   ------------------------------------------------------------------------- */
test('4. de codes liggen gehasht en niet leesbaar', () => {
  const { tf, u, dossier } = opzet();
  const b = tf.begin(u, 'RTG', 'lid');
  const r = tf.bevestig(u, nu(b.geheim));
  const rauw = JSON.stringify(dossier());
  for (const c of r.herstelcodes) {
    assert.equal(rauw.includes(c), false,
      'als wij ze konden tonen, konden wij ze ook lezen -- en dan is het geen herstelcode maar een tweede wachtwoord dat wij bewaren');
  }
});

test('4b. een herstelcode werkt eenmaal', () => {
  const { tf, u } = opzet();
  const b = tf.begin(u, 'RTG', 'lid');
  const r = tf.bevestig(u, nu(b.geheim));
  assert.equal(tf.toets(u, r.herstelcodes[0]).ok, true);
  assert.equal(tf.toets(u, r.herstelcodes[0]).ok, false);
  assert.equal(tf.standVan(u).herstelcodesOver, tf.CODES - 1, 'en het aantal loopt zichtbaar terug');
});

test('4c. bij weinig codes komt er een waarschuwing die zegt wat er gebeurt', () => {
  const { tf, u } = opzet();
  const b = tf.begin(u, 'RTG', 'lid');
  const r = tf.bevestig(u, nu(b.geheim));
  for (let i = 0; i < tf.CODES; i++) tf.toets(u, r.herstelcodes[i]);
  const s = tf.standVan(u);
  assert.equal(s.herstelcodesOver, 0);
  assert.match(s.let, /komt u er niet meer in/, 'de waarschuwing hoort het gevolg te noemen, niet alleen het aantal');
});

test('4d. een nieuwe set maakt de oude ongeldig', () => {
  const { tf, u } = opzet();
  const b = tf.begin(u, 'RTG', 'lid');
  const oud = tf.bevestig(u, nu(b.geheim)).herstelcodes;
  tf.nieuweCodes(u);
  assert.equal(tf.toets(u, oud[0]).ok, false);
});

/* ---------------------------------------------------------------------------
   5. UITZETTEN VRAAGT EEN GELDIGE CODE.
   ------------------------------------------------------------------------- */
test('5. zonder code blijft de factor staan', () => {
  const { tf, u } = opzet();
  const b = tf.begin(u, 'RTG', 'lid');
  tf.bevestig(u, nu(b.geheim));
  assert.equal(tf.uit(u, '000000').status, 403,
    'wie een open sessie kaapt heeft het wachtwoord vaak al; als dat genoeg was, is deze factor een drempel van een tik hoog');
  assert.equal(tf.standVan(u).aan, true);
});

test('5b. met een herstelcode kan het wel, en de codes gaan mee weg', () => {
  const { tf, u, dossier } = opzet();
  const b = tf.begin(u, 'RTG', 'lid');
  const r = tf.bevestig(u, nu(b.geheim));
  const uit = tf.uit(u, r.herstelcodes[0]);
  assert.equal(uit.ok, true);
  assert.match(uit.gevolg, /enige dat tussen een ander/);
  assert.equal(dossier().tweefactor, undefined, 'het geheim hoort weg te zijn en niet uitgevinkt');
});

/* ---------------------------------------------------------------------------
   6. DE KERN: TOTP IS GEEN PASSKEY.
   ------------------------------------------------------------------------- */
test('6. wachtwoord + TOTP komt op "twee factoren" en niet op "bezit"', () => {
  const { standVan, STANDEN } = require('../server/kern/identiteit/vertrouwen');
  const g = (x) => ({ graad: x, aanwezig: true });
  const t = standVan({ authenticator: g('gemeten') }, 'wachtwoord+totp');
  assert.equal(t.stand, 'tweefactor');
  assert.ok(STANDEN.tweefactor.rang < STANDEN.bezit.rang,
    'wij delen dat geheim; een code is door te vertellen aan wie erom vraagt');
  assert.match(t.uitleg, /phishing/i);
});

test('6b. inloggen met een HERSTELCODE is geen twee factoren', () => {
  const { standVan } = require('../server/kern/identiteit/vertrouwen');
  const g = (x) => ({ graad: x, aanwezig: true });
  assert.equal(standVan({ authenticator: g('gemeten') }, 'wachtwoord+herstelcode').stand, 'kennis',
    'een herstelcode staat op papier en kan al maanden ergens liggen; dat is geen lopende tweede factor');
});

/* ---------------------------------------------------------------------------
   7. DE INLOG blijft ongemoeid voor wie geen tweede factor heeft.
   ------------------------------------------------------------------------- */
test('7. toets() zegt "niet van toepassing" als de factor uit staat', () => {
  const { tf, u } = opzet();
  const r = tf.toets(u, 'wat dan ook');
  assert.equal(r.ok, true);
  assert.equal(r.nvt, true, 'een account zonder tweede factor hoort hier niets van te merken');
});

test('7b. de poort staat VOOR het uitgeven van het token', () => {
  const bron = fs.readFileSync(path.join(__dirname, '..', 'server', 'routes', 'auth', 'inlog.js'), 'utf8');
  const poort = bron.indexOf('tweefactor.inlogPoort(user)');
  const token = bron.indexOf('const token = accounts.issueToken(user.id);', poort);
  assert.ok(poort > 0, 'de inlogroute hoort de poort te raadplegen');
  assert.ok(token > poort,
    'eronder zou het token al bestaan en was "tweede factor nodig" een mededeling in plaats van een drempel');
});

test('7c. de poort geeft niets terug als er geen factor aan staat', () => {
  const { tf, u } = opzet();
  assert.equal(tf.inlogPoort(u), null, 'dan loopt de inlog door zoals hij altijd liep');
});

test('7d. en hij levert een BEWIJS en nooit een sessietoken', () => {
  const gevraagd = [];
  let md = {};
  const accounts = {
    getMemberState: () => md, saveMemberState: (id, o) => { md = o; },
    issueActionToken: (id, doel, ttl) => { gevraagd.push({ doel, ttl }); return 'bewijs-x'; },
    issueToken: () => { throw new Error('de poort hoort geen sessie te maken'); }
  };
  const tf2 = maakTweefactor({ accounts });
  const u2 = { id: 9 };
  const b = tf2.begin(u2, 'RTG', 'lid');
  tf2.bevestig(u2, nu(b.geheim));
  const p = tf2.inlogPoort(u2);
  assert.equal(p.bewijs, 'bewijs-x');
  assert.equal(gevraagd[0].doel, 'inlog2');
  assert.ok(gevraagd[0].ttl <= 10 * 60 * 1000, 'een bewijs dat lang leeft is een half sessietoken');
  assert.equal(p.token, undefined);
});

test('9. de herstelcodes zijn niet scheef: de trekking verwerpt in plaats van rest te delen', () => {
  /* WAT HIER FOUT WAS. De code deelde de rest van een willekeurige byte door de
     lengte van het alfabet (30). Een byte loopt tot 255, en 256 is geen veelvoud
     van 30: de eerste zestien letters kwamen er negen keer uit en de laatste
     veertien acht keer -- ruim twaalf procent scheef. CodeQL noemt dat
     js/biased-cryptographic-random, en het raakt precies de LAATSTE uitweg van
     een lid dat zijn toestel kwijt is.

     WAAROM DEZE TOETS NIET TELT MAAR STUURT. Een statistische toets over
     honderdduizenden trekkingen is traag en heeft een marge; deze voedt de
     generator in plaats daarvan met bytes uit de scheve staart. Alles vanaf 240
     hoort te worden VERWORPEN, dus mag geen enkele letter uit die greep komen.
     Met de oude regel gaf elke byte 250 dezelfde letter (250 % 30 = 10), en
     bestond de hele code uit tien keer dat ene teken. De bewering hieronder telt
     daarom het aantal VERSCHILLENDE tekens en noemt geen letter bij naam: de
     eerste versie hiervan zocht naar 'N' terwijl het 'M' moest zijn, en stond
     daardoor groen op precies de code die hij hoorde af te keuren.

     EN WAAROM HET SLOT PAS NA `begin` GAAT. De eerste keer dat deze module om
     bytes vraagt is voor het TOTP-geheim in `begin`. Wie het slot ervoor zet,
     voert die staartbytes aan het geheim en laat de codegenerator gewoon zijn
     gang gaan -- de toets staat dan groen bij zowel de oude als de nieuwe regel,
     en meet niets. Zo stond hij hier eerst, en dat bleek pas toen de mutatie
     hieronder hem NIET liet zakken.

     DE MUTATIE: zet in kern/identiteit/tweefactor-codes.js de lus terug op
     `ALFABET[bytes[i] % ALFABET.length]` zonder drempel -- dan is de uitkomst
     'NNNNNNNNNN' en zakt deze toets. */
  const crypto = require('crypto');
  const { tf, u } = opzet();
  const b = tf.begin(u, 'RTG', 'lid');
  const code6 = nu(b.geheim);

  const echt = crypto.randomBytes;
  let grepen = 0;
  crypto.randomBytes = (n) => {
    grepen += 1;
    /* Eerste greep binnen `bevestig`: alleen de scheve staart (>= 240). Daarna
       gewone bytes, zodat de generator zijn code alsnog af kan maken. */
    return grepen === 1 ? Buffer.alloc(n, 250)
      : Buffer.from(Array.from({ length: n }, (_, i) => (i * 7 + 3) % 240));
  };
  let codes;
  try { codes = tf.bevestig(u, code6).herstelcodes; }
  finally { crypto.randomBytes = echt; }

  assert.ok(codes && codes.length, 'geen herstelcodes teruggekregen');
  assert.equal(codes[0].length, 10, 'de lengte van een herstelcode hoort niet te veranderen');
  assert.ok(new Set(codes[0]).size > 1,
    'elke byte uit de staart gaf hetzelfde teken: de generator deelt de rest in plaats van te verwerpen (' +
    codes[0] + ')');
  assert.ok(grepen >= 2, 'een greep die alleen uit de staart bestaat hoort een tweede greep te vragen');
});
