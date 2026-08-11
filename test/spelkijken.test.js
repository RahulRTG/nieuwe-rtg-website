/* Meekijken bij een lopend potje. Twee poorten die verschillend werk doen:
   MAG DIT SPEL bekeken worden (per spel in de descriptor, standaard NIET), en
   MAG JIJ dit potje bekijken (vriend van een speler, of mededeelnemer aan
   hetzelfde toernooi).

   De reden dat het per spel moet en niet in het algemeen mag, staat als toets
   onderaan: de weergave van 30 Seconden verbergt de kaart voor de rader door
   op zijn spelersindex te kijken -- en een kijker heeft geen index, dus die
   zou hem juist wel zien. Nagemeten, niet aangenomen.

   Draai los: node --experimental-sqlite --test test/spelkijken.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const maakSpellen = require('../server/kern/spellen');
const maakRegister = require('../server/kern/spellen/register');
const { lekken } = require('../server/kern/spellen/zicht');
const spelCtx = { save() {}, crypto: require('crypto'), schud: (a) => a, beurtDoor() {}, codenaamVan: (x) => 'CN-' + x, nudge() {} };
const REG = maakRegister(spelCtx);

function opstelling({ vrienden = () => false, geblokkeerd = () => false } = {}) {
  const db = { data: { spellen: { potjes: {}, wachtrij: {} } } };
  const kern = maakSpellen({ db, save() {}, crypto: require('crypto'), zijnVrienden: vrienden,
    codenaamVan: (x) => 'CN-' + x, sseToCustomer() {}, isGeblokkeerd: geblokkeerd,
    socialZoek: async () => [], sociaalRate: () => true, volwassen: () => true,
    sseClients: [], lidBoardUit: () => false });
  const potje = (id, soort, spelers, extra) => {
    const p = Object.assign({ id, soort, modus: 'vrij', spelers, uitgenodigd: [], beurt: 0,
      teams: [0, 1, 0, 1], status: 'bezig', winnaar: null, at: new Date().toISOString() }, extra || {});
    REG.INITS[soort](p);
    db.data.spellen.potjes[id] = p;
    return p;
  };
  return { db, kern, potje };
}

test('een vriend van een speler mag meekijken', () => {
  const o = opstelling({ vrienden: (mij, sp) => mij === 'vriend' });
  o.potje('p1', 'schaak', ['a', 'b']);
  const r = o.kern.spelKijk('vriend', 'p1');
  assert.equal(r.status, 200);
  assert.equal(r.potje.kijker, true, 'het antwoord zegt dat je kijkt en niet speelt');
  assert.deepEqual(r.potje.spelers, ['CN-a', 'CN-b'], 'op codenaam');
  assert.ok(r.potje.staat.bord, 'en het bord is te zien');
});

test('een vreemde mag niet meekijken', () => {
  const o = opstelling();
  o.potje('p1', 'schaak', ['a', 'b']);
  const r = o.kern.spelKijk('vreemde', 'p1');
  assert.equal(r.status, 403);
  assert.match(r.error, /vrienden|toernooi/);
});

test('een speler gebruikt de kijkweergave niet', () => {
  // die heeft zijn eigen weergave, met zijn eigen hand erin
  const o = opstelling({ vrienden: () => true });
  o.potje('p1', 'schaak', ['a', 'b']);
  assert.equal(o.kern.spelKijk('a', 'p1').status, 403);
});

test('een blokkade weegt zwaarder dan een vriendschap', () => {
  const o = opstelling({ vrienden: () => true, geblokkeerd: (mij, sp) => sp === 'b' });
  o.potje('p1', 'schaak', ['a', 'b']);
  assert.equal(o.kern.spelKijk('vriend', 'p1').status, 403,
    'wie jou heeft geblokkeerd hoeft niet te dulden dat je zijn partij volgt');
});

test('wat aan een persoon hangt valt weg in de kijkweergave', () => {
  const o = opstelling({ vrienden: () => true });
  o.potje('p1', 'pesten', ['a', 'b']);
  const kijker = o.kern.spelKijk('vriend', 'p1').potje.staat;
  assert.equal(kijker.hand, undefined, 'een kijker ziet niemands kaarten');
  assert.ok(Array.isArray(kijker.aantallen), 'wel hoeveel kaarten iedereen heeft');
  assert.ok(kijker.open, 'en wat er open ligt');
});

test('een mededeelnemer aan hetzelfde toernooi mag meekijken', () => {
  const o = opstelling();   // geen vrienden
  o.kern.toernooiNieuw('a', { soort: 'schaak', maat: 4, vorm: 'knockout', spelers: ['b', 'c', 'd'] });
  const t = o.db.data.spelToernooien[0];
  ['b', 'c', 'd'].forEach(x => o.kern.toernooiAntwoord(x, t.id, true));
  const anderePartij = t.paren[1];
  const kijker = t.paren[0].a;                       // speelt zelf in de andere wedstrijd
  const r = o.kern.spelKijk(kijker, anderePartij.potje);
  assert.equal(r.status, 200, 'in een toernooi kijk je bij de andere wedstrijd');
  assert.equal(r.potje.kijker, true);
});

/* ---------- waarom het per spel moet ---------- */

test('de poort weigert een spel dat niet bekeken mag worden', () => {
  /* De descriptor zeggen dat het niet mag is een ding; hem ook echt laten
     weigeren is een ander. Zonder deze toets kon de controle uit magKijken
     verdwijnen zonder dat er iets rood werd -- gemeten met een mutatie. */
  const o = opstelling({ vrienden: () => true });
  o.potje('p2', 'seconden', ['a', 'b', 'c', 'd'], { modus: 'teams' });
  const r = o.kern.spelKijk('vriend', 'p2');
  assert.equal(r.status, 403);
  assert.match(r.error, /niet meekijken/);
});

test('30 Seconden mag NIET bekeken worden, en dit is de reden', () => {
  /* De spelerweergave verbergt de kaart voor de RADER op zijn spelersindex. Een
     kijker heeft geen index, dus `indexOf(null)` geeft -1 en dat is nooit
     gelijk aan de rader -- de kaart zou dus juist aan de kijker getoond
     worden, die hem kan doorgeven. Deze toets meet dat, zodat de uitzondering
     geen aanname is. */
  const p = secondenMetKaart();
  const rader = (p.beurt + 2) % p.spelers.length;
  assert.equal(REG.ZICHT.seconden.speler(p, p.staat, p.spelers[rader]).kaart, null, 'de rader ziet de kaart niet');
  assert.ok(REG.ZICHT.seconden.speler(p, p.staat, null).kaart, 'maar zonder speler WEL -- vandaar geen kijkweergave');
  assert.equal(REG.ZICHT.seconden.kijker, null, 'dus heeft dit spel er geen');
});

test('meekijken staat standaard UIT voor een nieuw spel', () => {
  /* Opt-in en niet opt-out: een spel dat de vraag niet beantwoordt is niet te
     bekijken, in plaats van per ongeluk wel. */
  const spel = "module.exports = () => ({ spel: { sleutel: 'nieuw', naam: 'Nieuw', max: 2, wereld: 'rtg', init(){}, zet(){}, zicht: { speler(){} } } });";
  const fs = require('fs'), os = require('os'), path = require('path');
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'kijk-'));
  try {
    fs.writeFileSync(path.join(map, 'nieuw.js'), spel);
    const { ZICHT } = maakRegister(spelCtx, map);
    assert.equal(ZICHT.nieuw.kijker, null, 'zonder zicht.kijker: niet te bekijken');
  } finally { fs.rmSync(map, { recursive: true, force: true }); }
});

test('vijftien spellen mogen bekeken worden, en precies een niet', () => {
  const uit = Object.keys(REG.ZICHT).filter(k => !REG.ZICHT[k].kijker);
  assert.deepEqual(uit, ['seconden'], 'elke andere uitzondering hoort een reden te hebben');
});

/* ---------- de bewaking die de drie fouten had gevonden ----------

   Hierboven staat 30 Seconden met naam en toenaam, en dat is precies het
   probleem met de oude opzet: het was de ENIGE die iemand had nagemeten. De
   vlag `kijken: true` was verder een bewering, en hij klopte bij drie van de
   zestien spellen niet -- 30 Seconden lekte de kaart, en Reactieduel en
   Schatduel GOOIDEN een uitzondering zodra een kijker langskwam, wat de route
   in een 500 veranderde. Geen enkele toets riep spelKijk op die twee aan.

   Deze twee toetsen vervangen die bewering door een meting over alle spellen
   tegelijk, zodat het volgende spel er vanzelf onder valt. */

/* SPELLEN WAARVAN HET GEHEIM PAS NA EEN ZET BESTAAT.

   Dit tafeltje is de reden dat de eerste versie van deze bewaking niets waard
   was: hij bouwde elk potje met alleen `init` en riep dan `lekken` aan. Bij
   vijftien spellen ligt er dan al genoeg op tafel (kaarten zijn gedeeld, rekken
   gevuld), maar bij 30 Seconden is `st.kaart` nog null -- er valt niets te
   verbergen, dus er lekt niets, dus de toets was groen terwijl hij precies het
   spel moest bewaken waarvoor hij bestond. Gemeten met een mutatie, niet
   bedacht.

   Een spel dat hier hoort te staan en het niet doet, laat deze toets dus
   onterecht slagen. Daarom controleert `inGang` hieronder dat een opgevoerde
   zet de staat ECHT verandert: een tafeltje dat stil verouderd is (actie
   hernoemd, zet geweigerd) valt om in plaats van niets meer te doen. */
const OPENING = {
  seconden: { door: 0, zet: { actie: 'kaart' } }
};

// een lopend potje, in een staat waarin er iets te verbergen valt
function inGang(soort) {
  const spelers = ['a', 'b', 'c', 'd'].slice(0, Math.max(REG.SPEL[soort].min || 2, 2));
  const p = { id: 'q_' + soort, soort, modus: REG.SPEL[soort].teams === 'altijd' ? 'teams' : 'vrij',
    spelers, uitgenodigd: [], beurt: 0, teams: [0, 1, 0, 1], status: 'bezig', winnaar: null, at: '' };
  REG.INITS[soort](p);
  const o = OPENING[soort];
  if (o) {
    const voor = JSON.stringify(p.staat);
    REG.ZETTEN[soort](p, spelers[o.door], o.zet);
    assert.notEqual(JSON.stringify(p.staat), voor,
      'de openingszet van ' + soort + ' verandert niets meer; dit tafeltje is verouderd');
  }
  return p;
}

const secondenMetKaart = () => inGang('seconden');

test('de lektoets vindt het geval waarvoor hij bestaat', () => {
  /* De positieve controle, en die staat hier omdat een bewaker die niets kan
     vinden geen bewaker is. Vindt deze toets niets meer, dan bewijst de
     volgende ook niets meer -- dan is `lekken` stuk en niet de spellen. */
  const p = secondenMetKaart();
  assert.deepEqual(lekken(REG.ZICHT.seconden.speler, p, p.staat), ['kaart'],
    'de spelerweergave van 30 Seconden hoort `kaart` aan een niet-speler te lekken');
});

test('geen enkel spel dat ZONDER_SPELER claimt, lekt iets naar een kijker', () => {
  /* ZONDER_SPELER betekent: "mijn spelerweergave is zonder speler veilig als
     kijkweergave". Vijftien spellen doen die claim, en dit is de plek waar hij
     wordt nagerekend in plaats van geloofd.

     `lekken` vindt de STRUCTURELE vorm: een veld dat de weergave voor minstens
     EEN speler verbergt en aan een kijker wel toont. Dat is de vorm van alle
     drie de gevonden fouten. Het potje komt via `inGang`, zodat er ook echt
     iets te verbergen valt -- zie het tafeltje daarboven voor waarom dat niet
     vanzelf spreekt. */
  for (const [soort, z] of Object.entries(REG.ZICHT)) {
    if (!z.zonderSpeler) continue;
    const p = inGang(soort);
    assert.deepEqual(lekken(z.speler, p, p.staat), [], soort + ' lekt iets naar een kijker');
  }
});

test('elke kijkweergave werkt ook echt, bij elk spel dat er een heeft', () => {
  /* De toets die er niet was. Reactieduel en Schatduel stonden op
     `kijken: true` terwijl hun weergave `st.tijden[mij].length` las -- voor een
     kijker `undefined.length`, dus een uitzondering en een 500. Dat kon er
     stil in zitten omdat geen enkele toets spelKijk op die twee aanriep, en de
     catalogustoets alleen naar de vlag keek. */
  const o = opstelling({ vrienden: () => true });
  for (const soort of Object.keys(REG.ZICHT)) {
    if (!REG.ZICHT[soort].kijker) continue;
    const spelers = ['a', 'b', 'c', 'd'].slice(0, Math.max(REG.SPEL[soort].min || 2, 2));
    o.potje('k_' + soort, soort, spelers);
    const r = o.kern.spelKijk('vriend', 'k_' + soort);
    assert.equal(r.status, 200, 'meekijken bij ' + soort + ' hoort te werken');
    assert.ok(r.potje.staat, soort + ' geeft een kijker geen staat');
  }
});

/* ---------- het gedeelde scherm ---------- */

test('een gedeeld scherm van 30 Seconden krijgt de kaart niet', () => {
  /* De hele reden dat het zicht drie lagen heeft. De kaart zit niet in wat
     `publiek` teruggeeft, dus een scherm KAN hem niet krijgen -- dat is iets
     anders dan hem niet sturen. */
  const p = secondenMetKaart();
  const scherm = REG.ZICHT.seconden.publiek(p, p.staat);
  assert.ok(p.staat.kaart, 'er ligt wel degelijk een kaart');
  assert.equal(scherm.kaart, undefined, 'maar het scherm ziet hem niet');
  assert.ok(Array.isArray(scherm.scores), 'wel de stand');
  assert.equal(typeof scherm.rader, 'number', 'en wie er raadt');
});

test('geen enkele projectie toont iets wat een speler verborgen wordt', () => {
  /* Dezelfde lekregel als voor kijkers, maar dan voor het scherm in de kamer.
     Hij staat apart omdat een projectie een ANDERE functie is: hem meenemen in
     de toets hierboven zou de indruk wekken dat die twee samen bewaakt worden,
     en dan valt een nieuw `publiek` er stil buiten. */
  for (const [soort, z] of Object.entries(REG.ZICHT)) {
    if (!z.publiek) continue;
    const p = inGang(soort);
    const scherm = z.publiek(p, p.staat);
    for (const veld of Object.keys(scherm)) {
      if (scherm[veld] === null || scherm[veld] === undefined) continue;
      const verborgenVoorIemand = p.spelers.some((sp) => {
        const v = z.speler(p, p.staat, sp)[veld];
        return v === null || v === undefined;
      });
      assert.ok(!verborgenVoorIemand,
        soort + ' projecteert `' + veld + '`, terwijl de spelerweergave dat voor minstens een speler verbergt');
    }
  }
});
