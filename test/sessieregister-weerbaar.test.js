/* DE POORT EN HET REGISTER ONDER AANVAL (server/kern/identiteit/sessiecontext.js
   en server/kern/identiteit/sessieregister.js).

   Wat deze twee beschermen: wat er werkelijk een sessie in komt. De poort
   (sessiecontext.bouw) laat alleen velden van de gesloten lijst door, elk met
   een volledige herkomst, en de graad van een claim komt uit de METHODE en
   nooit uit de invoer. Het register bewaart die context per sid, laat een
   anker (sleutelbinding, toestel) nooit vervangen en een claim nooit stil
   verzwakken, en vergeet een sessie die gesloten, verlopen of gewist is.

   Aanvulling op test/sessiecontext.test.js en test/sessieregister-takken.test.js;
   hier staat de aanvalskant: een gestolen token dat zijn eigen sleutel wil
   binden, een claim die zijn eigen graad meestuurt, een gemanipuleerde rij in
   de opslag, en sessies die na sluiten of wissen nog zouden moeten werken.

   Wat hier niet mag sneuvelen:
   1. een claim kan zijn eigen graad niet kiezen: velden buiten de vorm (ook in
      de herkomst) worden weggesneden, en een onvolledige herkomst houdt de
      hele claim tegen -- elk van de vijf vragen apart;
   2. verboden en onbekende velden worden geweigerd MET reden, en een
      vormfout in een waarde houdt de claim tegen in plaats van hem half op te
      slaan;
   3. een gestolen token kan zijn eigen sleutel niet over die van het lid
      binden, ook niet als de opgeslagen claim beschadigd is -- en alles-of-
      niets: een botsing schrijft NIETS, ook niet de onschuldige claims ernaast;
   4. bewijs verzwakt nooit stil, en vervallen bewijs zakt naar `vermoed`
      (niet naar `onbekend`) tot het opnieuw is bevestigd;
   5. een gesloten, verlopen of gewiste sessie bestaat niet meer: lezen,
      aanvullen, raken en tonen leveren niets op, en wissen raakt geen ander lid;
   6. het vangnet per lid laat de oudste wijken, nooit de zojuist geopende, en
      nooit een sessie van een ander lid.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - in sessieregister.vul de regel `if (botsing.length) return ...` vervangen
     door `if (false) return ...`
     -> "3. een gestolen token kan zijn eigen sleutel niet binden" ZAKT (RAAK).
   - in sessiecontext.herkomstOk de regel `if (!isTekst(h.regelversie)) return false;`
     weggehaald
     -> "1b. een herkomst zonder een van de vijf antwoorden houdt de claim
        tegen" ZAKT (RAAK).
   - in sessieregister.lees `> REGISTER_TTL_MS` vervangen door `> REGISTER_TTL_MS * 2`
     -> "5b. een sessie over de termijn verdwijnt bij het lezen" ZAKT (RAAK).

   Draai: node --test test/sessieregister-weerbaar.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const ctx = require('../server/kern/identiteit/sessiecontext');
const { maakSessieregister, REGISTER_TTL_MS } = require('../server/kern/identiteit/sessieregister');

const NU_ISO = () => new Date().toISOString();
const hk = (methode, extra = {}) => Object.assign({ bron: 'toets', methode, vastgesteldOp: NU_ISO(), regelversie: 'v1' }, extra);
const sid = (n) => ('w' + String(n).padStart(11, '0')).slice(0, 12);
const SLEUTEL_LID = 'L'.repeat(32), SLEUTEL_DIEF = 'D'.repeat(32);

function opzet({ metSleutels = true } = {}) {
  const db = { data: {} };
  const bewaard = [];
  const save = () => bewaard.push('alles');
  if (metSleutels) save.sleutels = (s) => bewaard.push(s.join(','));
  return { r: maakSessieregister({ db, save }), db, bewaard };
}
const terug = (db, s, ms) => { db.data.sessiecontext[s].gezienOp = new Date(Date.now() - ms).toISOString(); };

/* ---------------------------------------------------------------- de poort */

test('1. een claim kan zijn eigen graad niet kiezen: alles buiten de vorm wordt weggesneden', () => {
  const { context, geweigerd } = ctx.bouw({
    authenticator: { type: 'wachtwoord', assurance: 'laag', graad: 'bewezen', toestelnaam: 'Rahuls iPhone',
      herkomst: hk('opgegeven', { graad: 'bewezen', vertrouwd: true }) }
  });
  assert.deepEqual(geweigerd, []);
  assert.deepEqual(Object.keys(context.authenticator).sort(), ['assurance', 'herkomst', 'type']);
  assert.deepEqual(Object.keys(context.authenticator.herkomst).sort(), ['bron', 'methode', 'regelversie', 'vastgesteldOp']);
  assert.equal(ctx.stand(context).authenticator.graad, 'vermoed', 'opgegeven blijft vermoed, wat de invoer ook zegt');
});

test('1b. een herkomst zonder een van de vijf antwoorden houdt de claim tegen', () => {
  const goed = hk('gemeten');
  const kapot = [
    null, 'tekst', {},
    Object.assign({}, goed, { bron: '' }),
    Object.assign({}, goed, { bron: 'x'.repeat(65) }),
    Object.assign({}, goed, { methode: 'gevoel' }),
    Object.assign({}, goed, { vastgesteldOp: undefined }),
    Object.assign({}, goed, { vastgesteldOp: 'gisteren' }),
    Object.assign({}, goed, { vastgesteldOp: 0 }),
    Object.assign({}, goed, { regelversie: '' }),
    Object.assign({}, goed, { regelversie: 3 }),
    Object.assign({}, goed, { bevestigdOp: 'ooit' })
  ];
  for (const h of kapot) {
    assert.equal(ctx.herkomstOk(h), false, JSON.stringify(h));
    const { context, geweigerd } = ctx.bouw({ toestel: { toestelId: 't1', herkomst: h } });
    assert.deepEqual(context, {}, 'met herkomst ' + JSON.stringify(h) + ' mag niets binnenkomen');
    assert.match(geweigerd[0].reden, /geen geldige herkomst/);
  }
  // Met een geldige bevestiging wordt die bewaard; null is "nooit bevestigd" en mag.
  const later = new Date(Date.now() + 1000).toISOString();
  const { context } = ctx.bouw({ toestel: { toestelId: 't1', herkomst: Object.assign({}, goed, { bevestigdOp: later }) } });
  assert.equal(context.toestel.herkomst.bevestigdOp, later);
  assert.equal(ctx.herkomstOk(Object.assign({}, goed, { bevestigdOp: null })), true);
  assert.equal(ctx.bouw({ toestel: { toestelId: 't1', herkomst: Object.assign({}, goed, { bevestigdOp: null }) } }).context.toestel.herkomst.bevestigdOp, undefined);
});

test('2. verboden en onbekende velden worden geweigerd, elk met een reden; een vormfout houdt de claim tegen', () => {
  const ruw = {
    ip: { waarde: '10.0.0.1', herkomst: hk('gemeten') },
    useragent: 'Mozilla',
    vertrouwen: { stand: 'sterk', herkomst: hk('cryptografisch') },
    toestel: { toestelId: 'met spatie', herkomst: hk('cryptografisch') },
    sleutelbinding: { keyRef: 'k'.repeat(65), herkomst: hk('cryptografisch') },
    context: { contextId: 'zaak-1', contextVersie: 'een', herkomst: hk('gemeten') },
    authenticator: { type: '', herkomst: hk('gemeten') }
  };
  const { context, geweigerd } = ctx.bouw(ruw);
  assert.deepEqual(context, {}, 'niets van dit alles mag binnenkomen');
  const per = Object.fromEntries(geweigerd.map(g => [g.veld, g]));
  assert.equal(per.ip.verboden, true);
  assert.match(per.ip.reden, /persoonsgegeven/);
  assert.equal(per.useragent.verboden, true);
  assert.match(per.vertrouwen.reden, /gesloten/);
  assert.equal(per.toestel.reden, 'toestelId is geen geldige sleutel');
  assert.equal(per.sleutelbinding.reden, 'keyRef is geen geldige sleutel');
  assert.equal(per.context.reden, 'contextVersie is geen geldige getal');
  assert.equal(per.authenticator.reden, 'type is geen geldige tekst');
  assert.equal(geweigerd.length, 7);
});

test('2b. geen object, een lege claim of een claim met alleen lege waarden komt er niet in', () => {
  for (const ruw of [null, 'tekst', 42, [], [{ toestel: {} }]]) {
    assert.deepEqual(ctx.bouw(ruw), { context: {}, geweigerd: [{ veld: '(geheel)', reden: 'geen object' }] });
  }
  const { context, geweigerd } = ctx.bouw({
    toestel: null,
    authenticator: 'wachtwoord',
    context: { contextId: null, contextSoort: undefined, herkomst: hk('gemeten') }
  });
  assert.deepEqual(context, {});
  assert.deepEqual(geweigerd.map(g => g.reden), ['geen object', 'geen object', 'geen enkele waarde binnen de vorm']);
  // Een getal als contextVersie mag, ook 0; Infinity niet.
  assert.equal(ctx.bouw({ context: { contextVersie: 0, herkomst: hk('gemeten') } }).context.context.contextVersie, 0);
  assert.equal(ctx.bouw({ context: { contextVersie: Infinity, herkomst: hk('gemeten') } }).geweigerd[0].reden, 'contextVersie is geen geldige getal');
});

test('2c. namen van de prototypeketen openen geen veld', () => {
  const ruw = JSON.parse('{"__proto__":{"keyRef":"x","herkomst":{}},"constructor":{"keyRef":"x"},"hasOwnProperty":{"x":1}}');
  const { context, geweigerd } = ctx.bouw(ruw);
  assert.deepEqual(Object.keys(context), [], 'geen enkel prototypeveld komt in de context');
  assert.equal(geweigerd.length, 3, 'elk wordt geweigerd en niet stil overgeslagen');
});

test('2d. een methode uit de prototypeketen is geen herkomst, en kan zo geen sterk bewijs verdringen', () => {
  /* METHODEN['constructor'] vond via het prototype een functie: de claim
     kwam erin met graad undefined, en in vul() telde de oude graad daarna als
     -1, zodat elke volgende claim -- ook een opgegeven -- de controle op
     verzwakking omzeilde. */
  for (const methode of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
    const { context, geweigerd } = ctx.bouw({ authenticator: { type: 'passkey', herkomst: hk(methode) } });
    assert.equal(context.authenticator, undefined, methode + ': komt niet in de context');
    assert.equal(geweigerd.length, 1, methode + ': en wordt geweigerd, niet stil overgeslagen');
    assert.equal(typeof geweigerd[0].reden, 'string', methode + ': met een reden in tekst');
  }
  const { r, db } = opzet();
  const s = sid(9);
  r.open(s, 'user-1', { authenticator: { type: 'passkey', herkomst: hk('cryptografisch') } });
  r.vul(s, { authenticator: { type: 'passkey', herkomst: hk('constructor') } });
  r.vul(s, { authenticator: { type: 'wachtwoord', herkomst: hk('opgegeven') } });
  assert.equal(db.data.sessiecontext[s].context.authenticator.type, 'passkey', 'het sterke bewijs blijft staan');
});

test('4. de graad: vervallen bewijs zakt naar vermoed, een nieuwe bevestiging herstelt hem', () => {
  const veld = { verval: 60 * 1000 };
  const t0 = Date.UTC(2026, 9, 14, 10, 0, 0);
  const claim = { herkomst: { bron: 'toets', methode: 'cryptografisch', vastgesteldOp: new Date(t0).toISOString(), regelversie: 'v1' } };
  const vers = ctx.graadMet(claim, veld, t0 + 60 * 1000);
  assert.equal(vers.graad, 'bewezen', 'precies op de termijn geldt het nog');
  assert.equal(vers.ouderdomMs, 60 * 1000);
  const oud = ctx.graadMet(claim, veld, t0 + 60 * 1000 + 1);
  assert.deepEqual([oud.graad, oud.vervallen], ['vermoed', true]);
  assert.match(oud.reden, /vervallen bewijs is geen bewijs/);
  const bevestigd = Object.assign({}, claim, { herkomst: Object.assign({}, claim.herkomst, { bevestigdOp: new Date(t0 + 50 * 1000).toISOString() }) });
  assert.equal(ctx.graadMet(bevestigd, veld, t0 + 100 * 1000).graad, 'bewezen', 'de bevestiging is het nieuwe peil');
  // Wat al vermoed was, blijft vermoed na verval; het zakt niet naar onbekend.
  const zwak = { herkomst: Object.assign({}, claim.herkomst, { methode: 'afgeleid' }) };
  const z = ctx.graadMet(zwak, veld, t0 + 10 * 60 * 1000);
  assert.deepEqual([z.graad, z.vervallen], ['vermoed', true]);
  // Zonder (geldige) herkomst is er geen graad, met of zonder verval.
  assert.equal(ctx.graadMet(null, veld).graad, 'onbekend');
  assert.equal(ctx.graadMet({}, veld).graad, 'onbekend');
  assert.equal(ctx.graadMet({ herkomst: { methode: 'cryptografisch' } }, null).graad, 'onbekend');
  // Zonder verval geen ouderdom: een veld dat niet vervalt, rekent ook niet.
  assert.equal(ctx.graadMet(claim, {}, t0 + 1e12).graad, 'bewezen');
  assert.equal(ctx.graadVan(Object.assign({ veld: 'bestaatniet' }, claim)).graad, 'bewezen');
});

test('4b. de stand toont elk veld, ook wat ontbreekt, en nooit een samengesteld cijfer', () => {
  for (const leeg of [null, undefined, {}]) {
    const s = ctx.stand(leeg);
    assert.deepEqual(Object.keys(s).sort(), Object.keys(ctx.VELDEN).sort());
    for (const v of Object.values(s)) assert.deepEqual([v.aanwezig, v.graad], [false, 'onbekend']);
  }
  const { context } = ctx.bouw({ toestel: { toestelId: 't1', herkomst: hk('cryptografisch') } });
  const s = ctx.stand(context);
  assert.deepEqual([s.toestel.aanwezig, s.toestel.graad], [true, 'bewezen']);
  assert.equal(s.authenticator.aanwezig, false);
  assert.ok(!('totaal' in s) && !('score' in s));
});

/* ------------------------------------------------------------ het register */

test('3. een gestolen token kan zijn eigen sleutel niet binden, en een botsing schrijft niets', () => {
  const { r, db, bewaard } = opzet();
  const s = sid(1);
  r.open(s, 'user-1', { sleutelbinding: { keyRef: SLEUTEL_LID, herkomst: hk('cryptografisch') },
    toestel: { toestelId: 'toestel-lid', herkomst: hk('cryptografisch') } });
  const voor = JSON.stringify(db.data.sessiecontext[s]);
  const schrijfVoor = bewaard.length;

  for (const poging of [
    { sleutelbinding: { keyRef: SLEUTEL_DIEF, herkomst: hk('cryptografisch') } },
    { toestel: { toestelId: 'toestel-dief', herkomst: hk('cryptografisch') } },
    // Met een onschuldige claim ernaast: ook die mag niet worden geschreven.
    { sleutelbinding: { keyRef: SLEUTEL_DIEF, herkomst: hk('cryptografisch') },
      authenticator: { type: 'passkey', herkomst: hk('cryptografisch') } }
  ]) {
    const uit = r.vul(s, poging);
    assert.equal(uit.ok, false);
    assert.equal(uit.reden, 'herbinding');
    assert.ok(uit.geweigerd.some(g => /al gebonden/.test(g.reden)), 'de weigering zegt waarom');
  }
  assert.equal(JSON.stringify(db.data.sessiecontext[s]), voor, 'de rij is onveranderd, ook gezienOp');
  assert.equal(bewaard.length, schrijfVoor, 'er is niets weggeschreven');

  // Dezelfde sleutel nog een keer verandert niets en mag.
  assert.equal(r.vul(s, { sleutelbinding: { keyRef: SLEUTEL_LID, herkomst: hk('cryptografisch') } }).ok, true);
  assert.equal(r.lees(s).context.sleutelbinding.keyRef, SLEUTEL_LID);
});

test('3b. ook een beschadigde opgeslagen binding wordt niet vervangen', () => {
  const { r, db } = opzet();
  const s = sid(2);
  r.open(s, 'user-1', { sleutelbinding: { keyRef: SLEUTEL_LID, herkomst: hk('cryptografisch') } });
  // De herkomst raakt beschadigd in de opslag: de graad wordt onbekend.
  delete db.data.sessiecontext[s].context.sleutelbinding.herkomst;
  const uit = r.vul(s, { sleutelbinding: { keyRef: SLEUTEL_DIEF, herkomst: hk('cryptografisch') } });
  assert.deepEqual([uit.ok, uit.reden], [false, 'herbinding'], 'een zwakke oude claim opent geen herbinding');
  assert.equal(db.data.sessiecontext[s].context.sleutelbinding.keyRef, SLEUTEL_LID);
  // Een anker dat nog NIET gezet was, mag wel later komen.
  const t = sid(3);
  r.open(t, 'user-1', {});
  assert.equal(r.vul(t, { sleutelbinding: { keyRef: SLEUTEL_LID, herkomst: hk('cryptografisch') } }).ok, true);
  assert.equal(r.lees(t).context.sleutelbinding.keyRef, SLEUTEL_LID);
});

test('4c. bewijs verzwakt nooit stil; even sterk of sterker mag, en een kapotte oude claim mag hersteld worden', () => {
  const { r, db } = opzet();
  const s = sid(4);
  r.open(s, 'user-1', { authenticator: { type: 'passkey', herkomst: hk('cryptografisch') },
    context: { contextId: 'zaak-1', herkomst: hk('afgeleid') } });
  const uit = r.vul(s, { authenticator: { type: 'wachtwoord', herkomst: hk('opgegeven') },
    context: { contextId: 'zaak-2', herkomst: hk('gemeten') }, ip: { x: 1 } });
  assert.equal(uit.ok, true);
  const redenen = uit.geweigerd.map(g => g.veld + ':' + (g.verboden ? 'verboden' : g.reden));
  assert.ok(redenen.includes('authenticator:zou het bewijs verzwakken; degraderen is nooit stil'));
  assert.ok(redenen.includes('ip:verboden'));
  const rij = db.data.sessiecontext[s];
  assert.equal(rij.context.authenticator.type, 'passkey', 'de sterke claim blijft');
  assert.equal(rij.context.context.contextId, 'zaak-2', 'de sterkere claim kwam erbij');
  // Een beschadigde oude claim (graad onbekend) mag door een geldige worden vervangen.
  delete rij.context.authenticator.herkomst.methode;
  assert.equal(r.vul(s, { authenticator: { type: 'wachtwoord', herkomst: hk('opgegeven') } }).ok, true);
  assert.equal(rij.context.authenticator.type, 'wachtwoord');
});

test('5. een gesloten sessie bestaat niet meer, voor geen enkele ingang', () => {
  const { r, bewaard } = opzet();
  const s = sid(5);
  r.open(s, 'user-1', { toestel: { toestelId: 't1', herkomst: hk('cryptografisch') } });
  assert.equal(r.vanLid('user-1').length, 1);
  assert.equal(r.sluit(s), true);
  const na = bewaard.length;
  assert.equal(r.lees(s), null);
  assert.deepEqual(r.vul(s, { context: { contextId: 'z', herkomst: hk('gemeten') } }), { ok: false, reden: 'onbekende sessie' });
  assert.equal(r.raak(s), false);
  assert.equal(r.sluit(s), false, 'twee keer sluiten meldt geen tweede succes');
  assert.deepEqual(r.vanLid('user-1'), []);
  assert.equal(bewaard.length, na, 'niets op een gesloten sessie schrijft nog');
  // Opnieuw openen met dezelfde sid is een NIEUWE sessie zonder de oude claims.
  r.open(s, 'user-1', {});
  assert.deepEqual(r.lees(s).context, {});
});

test('5b. een sessie over de termijn verdwijnt bij het lezen, en de grens ligt precies op de termijn', () => {
  const { r, db } = opzet();
  const echt = Date.now;
  const T = echt();
  try {
    Date.now = () => T;
    const s = sid(6), u = sid(7);
    r.open(s, 'user-1', {});
    r.open(u, 'user-1', {});
    // open() stempelt met new Date(); zet het venster op exact T.
    for (const x of [s, u]) db.data.sessiecontext[x].gezienOp = new Date(T).toISOString();
    Date.now = () => T + REGISTER_TTL_MS;
    assert.ok(r.lees(s), 'precies op de termijn bestaat hij nog');
    assert.equal(r.vanLid('user-1').length, 2);
    Date.now = () => T + REGISTER_TTL_MS + 1;
    assert.equal(r.vanLid('user-1').length, 0, 'de lijst toont geen verlopen sessie');
    assert.equal(r.lees(u), null);
    assert.ok(!(u in db.data.sessiecontext), 'lezen ruimt de verlopen rij op');
    assert.ok(s in db.data.sessiecontext, 'een andere verlopen rij blijft liggen tot iemand hem leest');
    assert.equal(r.wisLid('user-1'), 1, 'wissen ziet ook wat de lijst niet meer toont');
  } finally { Date.now = echt; }
});

test('5c. raken schuift het venster op, hoogstens eens per uur, en houdt zo een levende sessie in leven', () => {
  const { r, db, bewaard } = opzet();
  const s = sid(8);
  r.open(s, 'user-1', {});
  assert.equal(r.raak(s), false, 'net geopend: niets te schrijven');
  terug(db, s, 3600 * 1000 - 5000);
  assert.equal(r.raak(s), false);
  terug(db, s, 3600 * 1000 + 5000);
  const voor = bewaard.length;
  assert.equal(r.raak(s), true);
  assert.equal(bewaard.length, voor + 1);
  assert.ok(Date.now() - new Date(db.data.sessiecontext[s].gezienOp).getTime() < 5000);
  // Een kapotte gezienOp geldt als oud: raken herstelt hem in plaats van te crashen.
  db.data.sessiecontext[s].gezienOp = 'onzin';
  assert.equal(r.raak(s), true);
  assert.ok(Number.isFinite(new Date(db.data.sessiecontext[s].gezienOp).getTime()));
  for (const fout of [null, 'kort', 'x'.repeat(12) + 'y', sid(999)]) assert.equal(r.raak(fout), false);
});

test('5d. wissen neemt alleen de sessies van dat lid mee, en schrijft niets als er niets was', () => {
  const { r, db, bewaard } = opzet({ metSleutels: false });
  r.open(sid(10), 'user-1', {});
  r.open(sid(11), 'user-1', {});
  r.open(sid(12), 'user-2', {});
  r.open(sid(13), null, {});
  const voor = bewaard.length;
  assert.equal(r.wisLid('user-1'), 2);
  assert.equal(bewaard.length, voor + 1, 'een keer bewaren, via de gewone save');
  assert.deepEqual(Object.keys(db.data.sessiecontext).sort(), [sid(12), sid(13)]);
  assert.equal(r.wisLid('user-1'), 0);
  assert.equal(r.wisLid(''), 0);
  assert.equal(r.wisLid(null), 0, 'zonder sleutel wordt niet "alles zonder sleutel" gewist');
  assert.ok(sid(13) in db.data.sessiecontext);
  assert.equal(bewaard.length, voor + 1, 'niets gewist, niets bewaard');
});

test('6. het vangnet laat de oudste van DAT lid wijken, nooit de nieuwste en nooit een ander lid', () => {
  const { r, db } = opzet();
  r.open(sid(500), 'user-2', {});
  terug(db, sid(500), 10 * 24 * 3600 * 1000); // de oudste rij van allemaal, maar van een ander lid
  for (let i = 0; i < r.MAX_PER_LID; i++) {
    r.open(sid(100 + i), 'user-1', {});
    terug(db, sid(100 + i), (r.MAX_PER_LID - i) * 60 * 1000);
  }
  assert.equal(r.vanLid('user-1').length, r.MAX_PER_LID);
  r.open(sid(300), 'user-1', {});
  const mijne = r.vanLid('user-1').map(x => x.sid);
  assert.equal(mijne.length, r.MAX_PER_LID);
  assert.ok(!mijne.includes(sid(100)), 'de oudste van user-1 is weg');
  assert.ok(mijne.includes(sid(101)));
  assert.equal(mijne[0], sid(300), 'de nieuwste staat bovenaan en is gebleven');
  assert.ok(sid(500) in db.data.sessiecontext, 'user-2 is niet geraakt');
  // Een sessie zonder lidsleutel valt buiten het vangnet en buiten elke lijst.
  r.open(sid(600), '', {});
  assert.equal(db.data.sessiecontext[sid(600)].lidKey, null);
  assert.deepEqual(r.vanLid(''), []);
  assert.deepEqual(r.vanLid(null), []);
});

test('6b. de lijst toont codes en standen, geen namen, en zegt per sessie de soort', () => {
  const { r } = opzet();
  r.open(sid(700), 'user-1', {
    authenticator: { type: 'passkey', authenticatorId: 'cred-1', herkomst: hk('cryptografisch') },
    toestel: { toestelId: 'toestel-1', herkomst: hk('cryptografisch') },
    context: { contextId: 'ZAAK1', contextSoort: 'zaak', herkomst: hk('gemeten') },
    toestelnaam: 'Rahuls iPhone'
  });
  r.open(sid(701), 'user-1', {});
  const [a, b] = r.vanLid('user-1').sort((x, y) => x.sid.localeCompare(y.sid));
  assert.deepEqual([a.soort, a.toestelId, a.contextSoort, a.contextId], ['passkey', 'toestel-1', 'zaak', 'ZAAK1']);
  assert.equal(a.stand.toestel.graad, 'bewezen');
  assert.ok(!JSON.stringify(a).includes('Rahul'), 'de verboden naam is nergens in de lijst');
  assert.deepEqual([b.soort, b.toestelId, b.contextSoort, b.contextId], [null, null, null, null]);
  assert.ok(a.vertrouwen && b.vertrouwen, 'de vertrouwensstand wordt berekend, ook voor een lege sessie');
});

test('7. open en vul weigeren een ongeldige sid zonder iets te schrijven', () => {
  const { r, db, bewaard } = opzet();
  for (const fout of [undefined, '', 'a b c d e f g', 'ä'.repeat(12), 'x'.repeat(11), 123456789012]) {
    assert.equal(r.open(fout, 'user-1', {}).ok, false);
    assert.equal(r.vul(fout, {}).ok, false);
    assert.equal(r.lees(fout), null);
    assert.equal(r.sluit(fout), false);
  }
  assert.equal(bewaard.length, 0);
  assert.deepEqual(db.data.sessiecontext || {}, {});
  // Een geldige sid zonder rij: vul weigert, en schept geen rij.
  assert.deepEqual(r.vul(sid(900), {}), { ok: false, reden: 'onbekende sessie' });
  assert.ok(!(sid(900) in (db.data.sessiecontext || {})));
  // Een rij zonder gezienOp geldt als verlopen bij lezen.
  r.open(sid(901), 'user-1', {});
  delete db.data.sessiecontext[sid(901)].gezienOp;
  assert.equal(r.lees(sid(901)), null);
});

test('7b. open en vul zonder context schrijven geen claim; een rij zonder gezienOp zakt achteraan en wijkt eerst', () => {
  const { r, db } = opzet();
  assert.deepEqual(r.open(sid(950), 'user-3', null).geweigerd, []);
  assert.deepEqual(r.lees(sid(950)).context, {});
  assert.deepEqual(r.vul(sid(950), null), { ok: true, geweigerd: [] });
  assert.deepEqual(r.lees(sid(950)).context, {});
  // Een rij zonder gezienOp (beschadigd) telt als de oudste en wordt door raken hersteld.
  delete db.data.sessiecontext[sid(950)].gezienOp;
  assert.equal(r.raak(sid(950)), true);
  delete db.data.sessiecontext[sid(950)].gezienOp;
  for (let i = 0; i < r.MAX_PER_LID; i++) r.open(sid(960 + i), 'user-3', {});
  assert.ok(!(sid(950) in db.data.sessiecontext), 'de rij zonder venster is als eerste geweken');
  assert.equal(r.vanLid('user-3').length, r.MAX_PER_LID);
});

/* De vertrouwensstand in de lijst wordt berekend uit de graden, en is nooit
   harder dan het zwakste feit waar hij op rust (kern/identiteit/vertrouwen.js). */
test('8. de vertrouwensstand in de lijst: nooit harder dan het zwakste feit eronder', () => {
  const { r } = opzet();
  const geval = (n, ctxRuw) => {
    r.open(sid(800 + n), 'user-' + (800 + n), ctxRuw);
    return r.vanLid('user-' + (800 + n))[0].vertrouwen;
  };
  const alles = geval(1, {
    authenticator: { type: 'passkey', herkomst: hk('cryptografisch') },
    toestel: { toestelId: 't1', herkomst: hk('cryptografisch') },
    sleutelbinding: { keyRef: SLEUTEL_LID, herkomst: hk('cryptografisch') } });
  assert.deepEqual([alles.stand, alles.graad], ['gebonden', 'bewezen']);
  assert.match(alles.graadReden, /cryptografisch aangetoond/);
  assert.equal(alles.gronden[0].staat, 'passkey');

  const totp = geval(2, {
    authenticator: { type: 'wachtwoord+totp', herkomst: hk('gemeten') },
    toestel: { toestelId: 't1', herkomst: hk('cryptografisch') },
    sleutelbinding: { keyRef: SLEUTEL_LID, herkomst: hk('cryptografisch') } });
  assert.deepEqual([totp.stand, totp.graad], ['gebonden', 'gemeten'], 'de gemeten inlog trekt de graad omlaag');
  assert.match(totp.graadReden, /zwakste feit/);
  assert.equal(totp.gronden[0].staat, 'wachtwoord en authenticator');

  const kennis = geval(3, {
    authenticator: { type: 'wachtwoord', herkomst: hk('opgegeven') },
    sleutelbinding: { keyRef: SLEUTEL_LID, herkomst: hk('cryptografisch') } });
  assert.deepEqual([kennis.stand, kennis.graad], ['kennis', 'vermoed'],
    'een sleutelbinding zonder bezit tilt kennis niet naar gebonden');
  assert.equal(kennis.gronden[2].staat, 'bewezen');
  assert.match(kennis.gronden[2].betekenis, /niet aan een sleutel gebonden/);

  const tweef = geval(4, { authenticator: { type: 'wachtwoord+totp', herkomst: hk('gemeten') } });
  assert.deepEqual([tweef.stand, tweef.graad], ['tweefactor', 'gemeten']);

  const niets = geval(5, {});
  assert.deepEqual([niets.stand, niets.graad], ['onbekend', 'onbekend']);
  assert.match(niets.graadReden, /niets vastgesteld/);
  assert.ok(niets.nietMeegewogen.length > 0, 'de stand zegt wat hij niet bekeek');

  // De naam van de inlog komt uit de soort; een onbekende soort wordt niet verzonnen.
  const naam = (n, type, methode) => geval(n, { authenticator: { type, herkomst: hk(methode) } }).gronden[0].staat;
  assert.equal(naam(6, 'sleutelwoorden', 'gemeten'), 'sleutelwoorden');
  assert.equal(naam(7, 'overdracht', 'afgeleid'), 'overgedragen sessie');
  assert.equal(naam(8, 'iets', 'cryptografisch'), 'sleutelbezit');
  assert.equal(naam(9, 'iets', 'gemeten'), 'gedeeld geheim');
  assert.equal(naam(10, 'wachtwoord', 'gemeten'), 'wachtwoord');
  // Alleen een bewezen toestel tilt een kennis-inlog naar bezit.
  const toestel = geval(11, { authenticator: { type: 'wachtwoord', herkomst: hk('gemeten') },
    toestel: { toestelId: 't1', herkomst: hk('cryptografisch') } });
  assert.deepEqual([toestel.stand, toestel.graad], ['bezit', 'gemeten']);
});
