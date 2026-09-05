/* ============================================================================
   MIJN RTG blok 1 -- de toetsen, en vooral DE NEGATIEVE PROEF.

   De vraag die hier beantwoord moet worden staat in MIJNRTG.md par. 2:

     Kan de applicatie een toestelnaam, locatie, authenticator of context tonen
     die niet uit een gemeten sessiebron komt?

   Het gewenste antwoord is structureel NEE, en "structureel" is het woord dat
   telt: niet "wij hebben er geen gebouwd" maar "de laag weigert het". Vandaar
   dat toets 3 en 4 niet naar schermen kijken maar naar de poort zelf.

   Draai los: node --test test/sessiecontext.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const ctx = require('../server/kern/identiteit/sessiecontext');
const { maakSessieregister } = require('../server/kern/identiteit/sessieregister');

const nu = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const hk = (methode, op = nu) => ({ bron: 'toets', methode, vastgesteldOp: iso(op), regelversie: 'v1' });
const register = () => maakSessieregister({ db: { data: {} }, save() {} });

/* ---------------------------------------------------------------------------
   1. DE GRAAD KOMT UIT DE METHODE, en is niet te zetten.
   ------------------------------------------------------------------------- */
test('1. een claim kan zijn eigen graad niet kiezen', () => {
  const { context } = ctx.bouw({
    authenticator: { type: 'wachtwoord', graad: 'bewezen', assurance: 'kennis', herkomst: hk('gemeten') }
  });
  assert.ok(context.authenticator, 'de claim zelf hoort er gewoon te zijn');
  assert.equal(context.authenticator.graad, undefined,
    'een meegestuurde graad hoort niet te overleven; anders zet de aanroeper zijn eigen bewijs');
  assert.equal(ctx.stand(context, nu).authenticator.graad, 'gemeten',
    'een wachtwoord is gemeten, nooit bewezen -- er is geen sleutelbezit aangetoond');
});

test('1b. alleen een handtekening haalt "bewezen"', () => {
  for (const [methode, verwacht] of [['cryptografisch', 'bewezen'], ['gemeten', 'gemeten'],
    ['afgeleid', 'vermoed'], ['opgegeven', 'vermoed']]) {
    const { context } = ctx.bouw({ toestel: { toestelId: 't1', herkomst: hk(methode) } });
    assert.equal(ctx.stand(context, nu).toestel.graad, verwacht, methode + ' hoort ' + verwacht + ' te geven');
  }
});

/* ---------------------------------------------------------------------------
   2. VERVALLEN BEWIJS IS GEEN BEWIJS (BESTUUR.md).
   ------------------------------------------------------------------------- */
/* DE VERVALREGEL, en waarom hij hier met een STAND-IN wordt getoetst.

   Sinds `vertrouwen` en `risico` uit de veldenlijst zijn gehaald (allebei omdat
   niemand ze ooit schreef), draagt geen enkel veld nog een `verval`. De regel
   "vervallen bewijs is geen bewijs" (BESTUUR.md) raakt dus vandaag niets meer.

   Hem daarom maar weghalen zou fout zijn: hij geldt op het moment dat er ooit
   een claim bijkomt die over de HUIDIGE toestand van de wereld gaat, en een
   regel die je dan opnieuw moet bedenken, wordt dan vergeten. Vandaar `graadMet`
   -- dezelfde rekenweg, met de velddefinitie als argument, zodat de regel
   toetsbaar blijft zonder dat er een veld voor in de lijst hoeft te staan dat
   niemand vult.

   DIT IS DUS EEN ZWAKKERE TOETS DAN HIJ WAS, en dat hoort er hard bij te staan:
   hij bewaakt de rekenregel, niet dat er ergens een veld is dat hem gebruikt. */
const UUR = 3600 * 1000;
const STANDIN = { soort: 'claim', persoonsgegeven: false, verval: 1 * UUR };

test('2. een verlopen meting zakt naar vermoed en zegt dat erbij', () => {
  const claim = { herkomst: hk('gemeten', nu - 2 * UUR) };
  const s = ctx.graadMet(claim, STANDIN, nu);
  assert.equal(s.graad, 'vermoed');
  assert.equal(s.vervallen, true);
  assert.match(s.reden, /vervallen bewijs is geen bewijs/);
});

test('2b. maar zakt niet naar onbekend -- wij hebben het wel degelijk gemeten', () => {
  const s = ctx.graadMet({ herkomst: hk('gemeten', nu - 40 * 24 * UUR) }, STANDIN, nu);
  assert.equal(s.graad, 'vermoed',
    '"nooit vastgesteld" en "ooit vastgesteld, nu verlopen" zijn twee verschillende dingen');
});

test('2c. binnen de termijn blijft de graad staan', () => {
  assert.equal(ctx.graadMet({ herkomst: hk('gemeten', nu - 10 * 60 * 1000) }, STANDIN, nu).graad, 'gemeten');
});

test('2d. een veld ZONDER verval vervalt nooit', () => {
  const oud = { herkomst: hk('cryptografisch', nu - 400 * 24 * UUR) };
  assert.equal(ctx.graadMet(oud, { verval: null }, nu).graad, 'bewezen',
    'een sleutel die ooit heeft ondertekend, heeft dat gedaan; dat verjaart niet vanzelf');
});

test('2e. vandaag draagt geen enkel veld een verval, en dat is bekend', () => {
  const metVerval = Object.entries(ctx.VELDEN).filter(function (p) { return p[1].verval; });
  assert.equal(metVerval.length, 0,
    'komt hier ooit een veld bij met een verval, dan hoort de toets hierboven OOK op dat echte veld te draaien');
});

/* ---------------------------------------------------------------------------
   3. DE NEGATIEVE PROEF -- de kern van blok 1.
   ------------------------------------------------------------------------- */
test('3. een claim zonder herkomst komt er niet in', () => {
  const { context, geweigerd } = ctx.bouw({ toestel: { toestelId: 'iphone-van-rahul' } });
  assert.equal(context.toestel, undefined, 'zonder herkomst geen claim, en dus niets om te tonen');
  assert.match(geweigerd[0].reden, /herkomst/);
});

test('3b. een sessie zonder vastgestelde context toont "onbekend", nooit een gat', () => {
  const s = ctx.stand({}, nu);
  for (const veld of Object.keys(ctx.VELDEN)) {
    assert.equal(s[veld].graad, 'onbekend');
    assert.equal(s[veld].aanwezig, false);
    assert.ok(s[veld].reden, veld + ' hoort te zeggen waarom hij onbekend is; een leeg veld is een uitnodiging om iets te verzinnen');
  }
});

test('3c. de velden zijn een GESLOTEN lijst: een verzonnen veld wordt geweigerd', () => {
  const { context, geweigerd } = ctx.bouw({ locatieNaam: { waarde: 'Amsterdam', herkomst: hk('gemeten') } });
  assert.deepEqual(context, {});
  assert.match(geweigerd[0].reden, /gesloten/);
});

/* ---------------------------------------------------------------------------
   4. WAT ER MET OPZET NIET IN KAN, met de reden erbij.
   ------------------------------------------------------------------------- */
test('4. de verboden velden worden geweigerd, elk met een reden', () => {
  for (const naam of Object.keys(ctx.VERBODEN)) {
    const { context, geweigerd } = ctx.bouw({ [naam]: { waarde: 'x', herkomst: hk('gemeten') } });
    assert.deepEqual(context, {}, naam + ' hoort nooit in een sessie te belanden');
    assert.equal(geweigerd[0].verboden, true);
    assert.ok(geweigerd[0].reden.length > 30, naam + ' hoort een echte reden te dragen, geen "mag niet"');
  }
});

test('4b. een toestelnaam is presentatie en geen securitywaarheid', () => {
  assert.ok(ctx.VERBODEN.toestelnaam, 'toestelnaam hoort op de verbodenlijst te staan');
  assert.equal(ctx.VELDEN.toestel.vorm.toestelnaam, undefined,
    'het toestelveld draagt een id en een binding, nooit "Rahuls iPhone"');
});

test('4c. geen enkel veld is als persoonsgegeven gemarkeerd -- de sessie reist over een bus', () => {
  for (const [naam, veld] of Object.entries(ctx.VELDEN)) {
    assert.equal(veld.persoonsgegeven, false,
      naam + ' draagt een persoonsgegeven; dat repliceert dan over rtg:sessies:v1 naar andere processen');
  }
});

/* ---------------------------------------------------------------------------
   5. HET REGISTER verleent geen toegang en verzwakt geen bewijs.
   ------------------------------------------------------------------------- */
test('5. degraderen is nooit stil', () => {
  const reg = register();
  reg.open('abcdefghijkl', 'user-1', { authenticator: { type: 'passkey', authenticatorId: 'c1', herkomst: hk('cryptografisch') } });
  const r = reg.vul('abcdefghijkl', { authenticator: { type: 'wachtwoord', herkomst: hk('opgegeven') } });
  assert.ok(r.geweigerd.some(g => /verzwakken/.test(g.reden)),
    'een bewezen passkey-sessie mag niet stilletjes een opgegeven wachtwoordsessie worden');
  assert.equal(reg.lees('abcdefghijkl').context.authenticator.type, 'passkey');
});

test('5b. aanvullen mag wel, zolang het bewijs niet zwakker wordt', () => {
  const reg = register();
  reg.open('abcdefghijkl', 'user-1', { authenticator: { type: 'passkey', authenticatorId: 'c1', herkomst: hk('cryptografisch') } });
  reg.vul('abcdefghijkl', { toestel: { toestelId: 't9', bindingId: 'b9', bindingStand: 'bevestigd', herkomst: hk('cryptografisch') } });
  assert.equal(reg.lees('abcdefghijkl').context.toestel.toestelId, 't9');
});

test('5c. een onbekende sid levert niets op -- het register opent geen deur', () => {
  const reg = register();
  assert.equal(reg.lees('onbekend01xx'), null);
  assert.equal(reg.vul('onbekend01xx', {}).ok, false);
});

test('5d. het register bewaart geen token en geen tokenhash', () => {
  const db = { data: {} };
  const reg = maakSessieregister({ db, save() {} });
  reg.open('abcdefghijkl', 'user-1', { authenticator: { type: 'passkey', authenticatorId: 'c1', herkomst: hk('cryptografisch') } });
  const rauw = JSON.stringify(db.data.sessiecontext);
  assert.ok(!/[a-f0-9]{64}/.test(rauw), 'een sha256 in het register betekent dat er een token-afdruk in ligt');
  assert.deepEqual(Object.keys(db.data.sessiecontext['abcdefghijkl']).sort(),
    ['context', 'gezienOp', 'geopendOp', 'lidKey'].sort());
});

test('5e. een lege registerlezing schept geen opslag', () => {
  const db = { data: {} };
  const reg = maakSessieregister({ db, save() {
    assert.fail('een lege registerlezing hoort niets te bewaren');
  } });
  assert.equal(reg.lees('abcdefghijkl'), null);
  assert.deepEqual(reg.vanLid('user-1'), []);
  assert.deepEqual(db.data, {},
    'een read-only HTTP- of SSE-verzoek mag geen lege sessiecollectie aanmaken');
});

/* ---------------------------------------------------------------------------
   6. HET TOKEN draagt een sessie-identiteit, en oude tokens breken niet.
   ------------------------------------------------------------------------- */
test('6. sessieVan leest de sid, en zegt null bij een token van voor blok 1', () => {
  const crypto = require('crypto');
  const { maakTokens } = require('../server/accounts/tokens');
  const S = require('../server/accounts/state');
  S.setKeys ? null : null;
  // De sid wordt uit de tokenBODY gelezen; de handtekening doet hier niet mee.
  const body = (delen) => Buffer.from(delen.join('.')).toString('base64url') + '.' + 'a'.repeat(32);
  const t = maakTokens(() => null);
  assert.equal(t.sessieVan(body(['7', String(Date.now() + 1e6), String(Date.now()), 'AbCdEfGhIjKl'])), 'AbCdEfGhIjKl');
  assert.equal(t.sessieVan(body(['7', String(Date.now() + 1e6), String(Date.now())])), null,
    'een token van voor blok 1 heeft geen sessie-identiteit, en dat is waar in plaats van stuk');
  assert.equal(t.sessieVan('geen-token'), null);
});
