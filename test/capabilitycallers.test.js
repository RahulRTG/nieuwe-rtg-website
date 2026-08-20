/* ============================================================================
   GEEN CAPABILITY ZONDER CALLER -- de tweede van de vier regels uit
   CONTROLPLANE.md, machinaal gemeten in plaats van met de hand geteld.

   WAT HIER WERKELIJK OP HET SPEL STAAT. Op 20 augustus 2026 telde een handmatige
   scan zes van de acht capabilities als "wordt nergens gevraagd". Het
   productprofiel beschreef ze, toetsen vertelden de tabel na, en commentaar legde
   uit hoe ze werkten -- en niemand werd ooit tegengehouden. Een telling met de
   hand is precies een keer goed: op de dag dat je hem doet.

   DE BEWERINGEN DIE ERTOE DOEN:

     toets 2   commentaar telt niet als aanroeper -- juist die soort ziet eruit
               als bewijs en is het niet
     toets 3   een toets telt niet als aanroeper -- zo zagen de zes stille
               capabilities er destijds gedekt uit
     toets 5   een routetabel telt alleen mee als hij WERKELIJK weigert
     toets 6   en alleen als de tabel zelf een aanroeper heeft, anders verplaatst
               de stille belofte zich een laag
     toets 8   in het echte huis heeft elke capability een caller

   Draai los: node --experimental-sqlite --test test/capabilitycallers.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const handhaving = require('../server/kern/commercie/handhaving');
const routepoort = require('../server/kern/commercie/routepoort');
const caps = require('../server/kern/commercie/capaciteiten');

const WORTEL = path.join(__dirname, '..');

/* Een aanroeper van `beoordeel` moet in de lijst zitten, anders telt de
   routetabel nergens mee -- dat is toets 6 en het is hier de normale toestand. */
const ECHTE_AANROEPER = { pad: 'server/opzet/leverancierpoort.js',
  bron: 'const r = routepoort.beoordeel(pad, trede);' };

/* ------------------------------------------------------- de stripper */

test('1. de stripper haalt commentaar weg en laat tekenreeksen staan', () => {
  const bron = [
    "const url = 'https://rtg.example/a//b';   // can_use_ai in commentaar",
    "/* can_use_pos wordt hier uitgelegd */",
    "caps.mag(pas, 'can_use_pos');"
  ].join('\n');
  const schoon = handhaving.zonderCommentaar(bron);
  assert.match(schoon, /a\/\/b/, 'een URL in een tekenreeks is geen commentaar');
  assert.ok(!schoon.includes('in commentaar'));
  assert.ok(!schoon.includes('wordt hier uitgelegd'));
  assert.match(schoon, /mag\(pas, 'can_use_pos'\)/);
});

/* DE EERSTE BEWERING. Een toelichting die uitlegt hoe can_use_pos werkt, leest
   als bewijs dat het werkt. Dat is de gevaarlijkste soort vermelding. */
test('2. een capability die alleen in commentaar staat, is stil', () => {
  const huis = [ECHTE_AANROEPER,
    { pad: 'server/routes/verzonnen.js', bron: '/* hier zou can_use_lifestyle_service moeten staan */' }];
  const r = handhaving.meet(huis);
  const rij = r.rijen.find(x => x.cap === 'can_use_lifestyle_service');
  assert.equal(rij.stil, true);
  assert.equal(rij.poorten.length, 0);
  assert.equal(rij.vermeldingen.length, 1, 'de vermelding wordt wel geteld, apart');

  const p = handhaving.poort(huis);
  assert.equal(p.ok, false);
  assert.match(p.problemen.join('\n'), /in commentaar, en dat leest als bewijs/);
});

/* DE TWEEDE BEWERING. Precies hoe de zes stille capabilities er gedekt uitzagen:
   er stonden toetsen op. Een toets die een tabel navertelt, bewijst dat de tabel
   klopt en niet dat er iets mee gebeurt. */
test('3. een toets telt niet als aanroeper', () => {
  const huis = [ECHTE_AANROEPER,
    { pad: 'test/iets.test.js', bron: "assert.equal(caps.mag('business', 'can_use_lifestyle_service'), true);" }];
  const rij = handhaving.meet(huis).rijen.find(x => x.cap === 'can_use_lifestyle_service');
  assert.equal(rij.stil, true, 'een toets is geen slot');
  assert.equal(rij.toetsen.length, 1);
  assert.match(handhaving.poort(huis).problemen.join('\n'), /de tabel navertellen/);
});

test('4. beschrijven is geen tegenhouden', () => {
  const huis = [ECHTE_AANROEPER,
    { pad: 'server/routes/scherm.js', bron: "const nodig = caps.tredenMet('can_use_lifestyle_service');" }];
  const rij = handhaving.meet(huis).rijen.find(x => x.cap === 'can_use_lifestyle_service');
  assert.equal(rij.stil, true, 'een scherm dat vertelt wat je nodig hebt, is geen slot');
  assert.equal(rij.beschrijvingen.length, 1);

  // en een echte poort in server/ telt wel
  const met = handhaving.meet([ECHTE_AANROEPER,
    { pad: 'server/routes/scherm.js', bron: "if (caps.mag(pas, 'can_use_lifestyle_service')) return true;" }]);
  assert.equal(met.rijen.find(x => x.cap === 'can_use_lifestyle_service').stil, false);
});

/* DE DERDE BEWERING. De reparatie van de vijf stille capabilities werd een
   tabel, en een tabel is geen mag()-aanroep. De meter kreeg daarvoor geen
   uitzondering maar een GEDRAGSbewijs: de regel telt alleen als hij weigert. */
test('5. een routetabelregel telt alleen mee als hij werkelijk weigert', () => {
  const bewijs = handhaving.routebewijs();
  for (const [pad, cap] of routepoort.KAART) {
    const regels = bewijs[cap] || [];
    const mij = regels.find(r => r.pad === pad);
    assert.ok(mij, pad + ' staat in de tabel maar weigert nergens voor -- dan is de regel decoratie');
    const r = routepoort.beoordeel(pad, mij.weigertVoor);
    assert.equal(r.ok, false);
    assert.equal(r.cap, cap);
    assert.match(r.error, /abonnement van deze zaak/);
  }
});

/* DE VIERDE BEWERING. Anders verplaatst het probleem zich een laag omhoog: een
   tabel die weigert maar nergens wordt geraadpleegd, is dezelfde stille belofte. */
test('6. de routetabel telt alleen mee als `beoordeel` zelf een aanroeper heeft', () => {
  const zonder = handhaving.meet([{ pad: 'test/iets.test.js', bron: 'routepoort.beoordeel(a, b);' }]);
  assert.equal(zonder.tabelLeeft, false, 'een aanroep in test/ maakt de tabel niet levend');
  assert.equal(zonder.rijen.find(x => x.cap === 'can_use_pos').stil, true);

  const eigen = handhaving.meet([{ pad: 'server/kern/commercie/routepoort.js', bron: 'beoordeel(a, b);' }]);
  assert.equal(eigen.tabelLeeft, false, 'zichzelf aanroepen telt niet');

  const met = handhaving.meet([ECHTE_AANROEPER]);
  assert.equal(met.tabelLeeft, true);
  assert.equal(met.rijen.find(x => x.cap === 'can_use_pos').stil, false);

  /* EN NIET ELKE UITGANG TELT. `capabilityVoor` zegt welke capability bij een
     pad hoort en houdt niemand tegen; wie die zou meetellen, laat een module die
     alleen wil WETEN doorgaan voor een module die een deur bewaakt. */
  const alleenOpzoeken = handhaving.meet([
    { pad: 'server/routes/scherm.js', bron: 'const cap = routepoort.capabilityVoor(pad);' }]);
  assert.equal(alleenOpzoeken.tabelLeeft, false, 'opzoeken is geen oordelen');

  /* Dit ging bijna mis: toen de zaak-opzoeking van de leverancierspoort naar
     `voorZaak` verhuisde, riep die poort geen `beoordeel` meer aan. Beide
     ingangen tellen dus, en allebei met naam. */
  const viaVoorZaak = handhaving.meet([
    { pad: 'server/opzet/leverancierpoort.js', bron: 'routepoort.voorZaak(kern.zaakAbonnement, code, pad);' }]);
  assert.equal(viaVoorZaak.tabelLeeft, true);
});

/* ------------------------------------------------------- de routetabel */

test('7. het langste voorvoegsel wint, en een onbekend pad valt nergens onder', () => {
  assert.equal(routepoort.capabilityVoor('/api/supplier/command/beleid/zet'), 'can_use_enterprise_governance');
  assert.equal(routepoort.capabilityVoor('/api/supplier/command/graaf'), null,
    'de cockpit is geen governance; alleen beleid en journaal zijn dat');
  assert.equal(routepoort.capabilityVoor('/api/supplier/mall'), null);
  assert.equal(routepoort.capabilityVoor(''), null);
  assert.equal(routepoort.capabilityVoor(undefined), null);

  // zonder trede: de gedocumenteerde terugval, en die is bewust NIET dicht
  const terug = routepoort.beoordeel('/api/supplier/pos/sale', null);
  assert.equal(terug.ok, true, 'een migratie die rechten intrekt is een storing met een nette naam');
  assert.equal(terug.pas, 'business');
});

test('7b. de sortering is een eigenschap en geen toeval', () => {
  /* In de echte tabel overlapt vandaag geen enkel paar, dus daar valt niets aan
     te zien. Een eigenschap die je niet kunt aantonen is geen eigenschap, dus
     bouwen we de overlap die er morgen bij kan komen. */
  const kaart = [
    ['/api/supplier/command/', 'can_use_pos'],
    ['/api/supplier/command/beleid', 'can_use_enterprise_governance']
  ];
  assert.equal(routepoort.capabilityVoor('/api/supplier/command/beleid/zet', kaart),
    'can_use_enterprise_governance', 'het specifieke antwoord wint van het algemene');
  assert.equal(routepoort.capabilityVoor('/api/supplier/command/graaf', kaart), 'can_use_pos');
});

test('7c. de vaste contactpersoon kiest een baan en sluit geen deur', () => {
  /* can_use_dedicated_support is de enige van de vijf die NIET als slot hoort te
     werken: iedereen krijgt hulp, de trede bepaalt of daar een naam aan hangt. */
  const { contactlijn } = require('../server/routes/supplier/abonnement');
  const zonder = caps.tredenMet('can_be_partner').find(t => !caps.mag(t, 'can_use_dedicated_support'));
  const met = caps.tredenMet('can_use_dedicated_support')[0];

  assert.equal(contactlijn(zonder, 'Sanne').soort, 'lijn');
  assert.equal(contactlijn(zonder, 'Sanne').naam, null,
    'zonder de capability hoort er geen naam te staan, ook niet als er een bekend is');
  assert.match(contactlijn(zonder, null).tekst, /gewone lijn/);

  assert.equal(contactlijn(met, 'Sanne').naam, 'Sanne');
  assert.equal(contactlijn(met, null).naam, null);
  assert.match(contactlijn(met, null).tekst, /wijst die toe/,
    'geen verzonnen naam: nooit claimen dat iets geregeld is wat niet geregeld is');
});

/* ---------------------------------------------------------- het spiegelbeeld */

/* REGEL 2 IS "GEEN CAPABILITY ZONDER CALLER". De andere kant is even hard en
   werd nergens gesteld: RTG mag geen afdwingbaar onderdeel hebben dat op geen
   enkele trede staat. Zo'n capability is een SPOOK -- hij houdt mensen tegen,
   maar er is geen product waar hij bij hoort, dus niemand kan hem kopen. */
test('7d. een capability die wordt afgedwongen maar nergens te koop is, is een spook', () => {
  /* Een verzonnen capability bestaat niet in de tabel, dus die kunnen we niet
     nabootsen. Wat we WEL kunnen toetsen is de regel zelf, op de echte tabel:
     elke capability die ergens wordt afgedwongen, hoort op minstens een trede te
     staan. */
  for (const cap of Object.keys(caps.CAPS)) {
    const treden = caps.tredenMet(cap);
    assert.ok(treden.length > 0,
      cap + ' staat op geen enkele trede: niemand kan hem kopen, en toch bestaat hij');
  }

  const huis = [ECHTE_AANROEPER,
    { pad: 'server/routes/x.js', bron: "caps.mag(pas, 'can_use_pos');" }];
  assert.equal(handhaving.spoken(huis).aantal, 0,
    'vandaag is er geen enkel spook -- en juist daarom hoort deze meting te bestaan, ' +
    'want de dag dat er een komt, komt hij stil');

  /* EN DAN MOET HIJ ER OOK EEN KUNNEN VINDEN. Zonder dit stuk toetst het
     bovenstaande alleen dat er vandaag niets is, en dat blijft groen als de
     meting helemaal niets doet -- een mutatie liep daar dwars doorheen. Dus
     maken we er zelf een: een capability die wel wordt afgedwongen en op geen
     enkele trede staat. */
  const naam = 'can_do_spook_in_een_toets';
  caps.CAPS[naam] = 'een onderdeel dat op geen enkele trede staat';
  try {
    const g = handhaving.spoken([ECHTE_AANROEPER,
      { pad: 'server/routes/x.js', bron: "caps.mag(pas, '" + naam + "');" }]);
    assert.equal(g.aantal, 1);
    assert.equal(g.spoken[0].cap, naam);
    assert.match(g.problemen[0], /geen enkele trede/);
    assert.match(g.problemen[0], /toch houdt hij mensen tegen/);

    // en een capability die NERGENS wordt afgedwongen is geen spook maar een naam
    assert.equal(handhaving.spoken([ECHTE_AANROEPER]).aantal, 0,
      'niet gekocht en niet afgedwongen: dan houdt hij ook niemand tegen');
  } finally {
    delete caps.CAPS[naam];      // de tabel is gedeeld; hem laten staan besmet elke toets hierna
  }
});

/* ------------------------------------------------------- het echte huis */

test('8. in dit huis heeft elke capability een caller', () => {
  const bestanden = [];
  for (const map of ['server', 'test']) {
    (function loop(dir) {
      for (const naam of fs.readdirSync(dir)) {
        const vol = path.join(dir, naam);
        const st = fs.statSync(vol);
        if (st.isDirectory()) { if (naam !== 'data' && naam !== 'node_modules') loop(vol); continue; }
        if (naam.endsWith('.js')) bestanden.push({ pad: path.relative(WORTEL, vol), bron: fs.readFileSync(vol, 'utf8') });
      }
    })(path.join(WORTEL, map));
  }
  const r = handhaving.poort(bestanden);
  assert.equal(r.aantal, Object.keys(caps.CAPS).length);
  assert.equal(r.ok, true, 'stil: ' + r.stil.join(', ') + '\n' + r.problemen.join('\n'));

  /* En de andere kant: niets wordt afgedwongen zonder dat het te koop is. */
  const g = handhaving.spoken(bestanden);
  assert.equal(g.aantal, 0, g.problemen.join('\n'));
});
