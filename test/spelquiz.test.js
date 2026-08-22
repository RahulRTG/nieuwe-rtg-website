/* HET QUIZDUEL: teams, schoolvragen, en wat er NIET over de lijn gaat.

   Dit is het eerste spel met varianten, en dat maakt het ook het eerste spel
   waar "dezelfde motor, andere bron" een bewering is in plaats van een plan.
   Vier dingen staan hier onder toets:

   1. HET ANTWOORD BLIJFT OP DE SERVER. De juiste keuze staat in de staat van
      het potje -- de server moet hem kunnen nakijken -- en `zicht.speler` is de
      enige weg naar buiten. Staat hij daar per ongeluk in, dan is de hele quiz
      een kwestie van de netwerktab openen.
   2. TEAMS TELLEN SAMEN. In teams wint niet de beste speler maar het beste
      koppel, en gelijk blijft gelijk.
   3. DE SCHOOLBRON IS DE ECHTE LEERSTOF, en levert alleen vragen op die een
      mens kan beantwoorden: minstens twee opties, en het juiste antwoord staat
      ertussen. Een som met een enkele optie is geen vraag maar een knop.
   4. DE SCHOOLBRON SCHRIJFT NIETS BIJ IN HET LEERPASPOORT. Een quiz tegen een
      klasgenoot is een spel; die uitslag hoort geen schoolvoortgang te worden,
      want dan is winnen van een klasgenoot ineens een cijfer.

   Draai los: node --test test/spelquiz.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const school = require('../server/kern/spellen/quiz-school');
const { opgave, MEERKEUZE, SOORTEN } = require('../server/kern/leerstof-gen');
const { DOELEN } = require('../server/kern/leerstof');

const maakQuiz = () => require('../server/kern/spellen/quiz')({
  save() {}, schud: (a) => a.slice(), codenaamVan: (h) => 'CN-' + h, nudge() {}, ZONDER_SPELER: Symbol('zonder')
});
// een potje zoals de lobby het neerzet; TEAMS is [0,1,0,1,...] net als daar
const potjeMet = (spelers, extra) => Object.assign({
  id: 'p1', soort: 'quiz', spelers, teams: [0, 1, 0, 1, 0, 1], modus: 'vrij',
  status: 'bezig', beurt: 0, winnaar: null, variant: null
}, extra || {});

/* ================= de leerstof-kant ================= */

test('MEERKEUZE zegt precies welke generatoren opties teruggeven', () => {
  /* Deze lijst is een BEWERING naast de code (leerstof-gen.js), en precies het
     soort bewering dat stil onwaar wordt: iemand bouwt een generator om en de
     quiz legt ineens een vraag met een enkele optie voor. Hier wordt hij
     nagemeten tegen wat de generatoren werkelijk doen. */
  const perSoort = {};
  for (const d of Object.values(DOELEN)) if (d.gen) (perSoort[d.gen.soort] = perSoort[d.gen.soort] || []).push(d.gen);
  for (const [soort, gens] of Object.entries(perSoort)) {
    let metOpties = 0, zonder = 0;
    for (const g of gens) for (let i = 0; i < 25; i++) {
      const o = opgave(g);
      if (o.opties && o.opties.length > 1 && o.opties.includes(o.a)) metOpties++; else zonder++;
    }
    if (MEERKEUZE.includes(soort))
      assert.equal(zonder, 0, soort + ' staat in MEERKEUZE maar geeft niet altijd bruikbare opties');
    else
      assert.equal(metOpties, 0, soort + ' geeft wel opties maar staat niet in MEERKEUZE');
  }
  for (const soort of MEERKEUZE) assert.ok(SOORTEN.includes(soort), soort + ' bestaat niet als generator');
});

test('elke stofkeuze levert tien echte meerkeuzevragen op', () => {
  /* Een keuze in de app die nul (of onbeantwoordbare) vragen oplevert is een
     dode knop, en dat merkt een docent pas voor de klas. */
  assert.ok(school.STOFKEUZE.length >= 20, 'er staat echte leerstof klaar: ' + school.STOFKEUZE.length);
  for (const stof of school.STOFKEUZE) {
    const vragen = school.vragenVoor(stof, 10);
    assert.equal(vragen.length, 10, stof);
    for (const v of vragen) {
      assert.ok(v.v && typeof v.v === 'string', stof + ': een vraag zonder tekst');
      assert.ok(v.opties.length > 1, stof + ': een vraag met een enkele optie is geen vraag');
      assert.ok(v.j >= 0 && v.j < v.opties.length, stof + ': het juiste antwoord staat er niet tussen');
    }
  }
});

test('de stofkeuze is afgeleid uit de leerstof en niet met de hand geschreven', () => {
  /* Zou hij met de hand staan, dan loopt hij achter zodra er een leerdoel bij
     komt -- en dat is precies onzichtbaar. Elke keuze hoort bij minstens een
     leerdoel dat er echt is, en elk meerkeuze-leerdoel hoort bij een keuze. */
  for (const stof of school.STOFKEUZE) assert.ok(school.doelenVoor(stof).length, stof + ' heeft geen leerdoelen');
  for (const d of Object.values(DOELEN)) {
    if (!d.gen || !d.groep || !MEERKEUZE.includes(d.gen.soort)) continue;
    assert.ok(school.STOFKEUZE.includes(d.vak + ' groep ' + d.groep),
      'leerdoel ' + d.id + ' hoort bij geen enkele stofkeuze');
  }
});

test('een stof die niet bestaat levert geen stille terugval maar een duidelijke fout', () => {
  /* Terugvallen op de algemene bank zou betekenen dat een docent schoolstof
     koos en algemene kennis kreeg. Dat het NIET kan gebeuren langs de gewone
     weg (de keuzelijst is gesloten) maakt de melding juist belangrijker: dan
     is het een fout in de bedrading, en die hoort te zeggen wat er mis is.
     Hij zei eerst "Cannot read properties of undefined". */
  assert.throws(() => school.vragenVoor('latijn groep 9', 10), /geen leerstof voor "latijn groep 9"/);
});

/* ================= het spel ================= */

test('de speler krijgt zijn vraag met opties, en nooit welke goed is', () => {
  const { quizInit, quizView } = maakQuiz();
  const p = potjeMet(['anna', 'boris']);
  quizInit(p);
  const zicht = quizView(p, p.staat, 'anna');
  assert.deepEqual(Object.keys(zicht).sort(), ['goed', 'nr', 'opties', 'stand', 'tot', 'vraag'],
    'er staat een veld in de spelerweergave dat er niet hoorde: ' + JSON.stringify(Object.keys(zicht)));
  /* En op inhoud, want een veld met een andere naam is net zo lek. De staat
     kent het juiste antwoord (`j`); dat getal mag nergens in de weergave
     opduiken naast de opties zelf. */
  const plat = JSON.stringify(zicht);
  for (const veld of ['"j"', '"juist"', '"antwoord"', '"oplossing"'])
    assert.equal(plat.includes(veld), false, 'de weergave draagt ' + veld);
  assert.equal(zicht.vraag, p.staat.vragen[0].v);
  assert.deepEqual(zicht.opties, p.staat.vragen[0].opties);
});

test('wie klaar is krijgt geen elfde vraag, en de rest speelt door', () => {
  const { quizInit, quizZet, quizView } = maakQuiz();
  const p = potjeMet(['anna', 'boris']);
  quizInit(p);
  for (let i = 0; i < 10; i++) quizZet(p, 'anna', { actie: 'antwoord', keuze: p.staat.vragen[i].j });
  assert.equal(quizView(p, p.staat, 'anna').vraag, null);
  assert.equal(quizZet(p, 'anna', { actie: 'antwoord', keuze: 0 }).status, 409);
  assert.equal(p.status, 'bezig', 'boris is nog niet klaar');
  assert.ok(quizView(p, p.staat, 'boris').vraag, 'en die krijgt gewoon zijn vraag');
});

test('alles goed wint van bijna alles goed', () => {
  const { quizInit, quizZet } = maakQuiz();
  const p = potjeMet(['anna', 'boris']);
  quizInit(p);
  for (let i = 0; i < 10; i++) {
    quizZet(p, 'anna', { actie: 'antwoord', keuze: p.staat.vragen[i].j });
    quizZet(p, 'boris', { actie: 'antwoord', keuze: i === 3 ? (p.staat.vragen[i].j + 1) % p.staat.vragen[i].opties.length : p.staat.vragen[i].j });
  }
  assert.equal(p.status, 'klaar');
  assert.equal(p.winnaar, 'CN-anna');
  assert.equal(p.gelijk, undefined);
});

test('in teams telt de som van het koppel, en niet de beste speler', () => {
  /* Dit is het hele verschil tussen 2-tegen-2 en vier mensen naast elkaar: de
     sterkste speler zit in het VERLIEZENDE team, en dat hoort ook zo uit te
     pakken. anna (team 0) heeft alles goed maar cirrus (ook team 0) niets;
     boris en duin (team 1) hebben er allebei zes. */
  const { quizInit, quizZet } = maakQuiz();
  const p = potjeMet(['anna', 'boris', 'cirrus', 'duin'], { modus: 'teams' });
  quizInit(p);
  const mis = (v) => (v.j + 1) % v.opties.length;
  for (let i = 0; i < 10; i++) {
    const v = p.staat.vragen[i];
    quizZet(p, 'anna', { actie: 'antwoord', keuze: v.j });
    quizZet(p, 'cirrus', { actie: 'antwoord', keuze: mis(v) });
    quizZet(p, 'boris', { actie: 'antwoord', keuze: i < 6 ? v.j : mis(v) });
    quizZet(p, 'duin', { actie: 'antwoord', keuze: i < 6 ? v.j : mis(v) });
  }
  assert.equal(p.status, 'klaar');
  assert.deepEqual([p.staat.goed.anna, p.staat.goed.cirrus, p.staat.goed.boris, p.staat.goed.duin], [10, 0, 6, 6]);
  assert.equal(p.winnaar, 'CN-boris & CN-duin', 'twaalf samen wint van tien samen');
});

test('de teamstand staat in de weergave, en op het gedeelde scherm ook', () => {
  const { quizInit, quizZet, spel } = maakQuiz();
  const p = potjeMet(['anna', 'boris', 'cirrus', 'duin'], { modus: 'teams' });
  quizInit(p);
  quizZet(p, 'anna', { actie: 'antwoord', keuze: p.staat.vragen[0].j });
  const zicht = spel.zicht.speler(p, p.staat, 'boris');
  assert.deepEqual(zicht.teams, [1, 0], 'anna zit in team 0 en had er een goed');
  assert.deepEqual(spel.zicht.publiek(p, p.staat).teams, [1, 0], 'en een televisie ziet hetzelfde');
  // zonder teams staat hij er niet: vier losse getallen zouden een team
  // suggereren dat niet bestaat
  const vrij = potjeMet(['anna', 'boris']);
  quizInit(vrij);
  assert.equal(spel.zicht.speler(vrij, vrij.staat, 'anna').teams, undefined);
  assert.equal(spel.zicht.publiek(vrij, vrij.staat).teams, undefined);
});

test('twee teams met evenveel goed is gelijkspel, ook al was er iemand eerder klaar', () => {
  /* Bij ieder-voor-zich breekt "wie was het eerst klaar" een gelijke stand.
     Dat criterium is van EEN speler en zegt niets over twee mensen samen, dus
     in teams blijft gelijk gewoon gelijk. */
  const { quizInit, quizZet } = maakQuiz();
  const p = potjeMet(['anna', 'boris', 'cirrus', 'duin'], { modus: 'teams' });
  quizInit(p);
  for (const sp of ['anna', 'cirrus', 'boris', 'duin'])
    for (let i = 0; i < 10; i++) quizZet(p, sp, { actie: 'antwoord', keuze: p.staat.vragen[i].j });
  assert.equal(p.status, 'klaar');
  assert.equal(p.gelijk, true);
  assert.equal(p.winnaar, null);
});

test('de schoolbron levert schoolvragen en de algemene bron algemene', () => {
  const { quizInit } = maakQuiz();
  const algemeen = potjeMet(['anna', 'boris']);
  quizInit(algemeen);
  const bank = require('../server/kern/spellen/quiz-data');
  assert.ok(bank.some(r => r[0] === algemeen.staat.vragen[0].v), 'de eerste vraag komt uit de algemene bank');

  const stof = potjeMet(['anna', 'boris'], { variant: { bron: 'school', stof: 'taal groep 3' } });
  quizInit(stof);
  assert.equal(stof.staat.vragen.length, 10);
  assert.equal(bank.some(r => r[0] === stof.staat.vragen[0].v), false, 'dit hoort geen algemene-kennisvraag te zijn');
  for (const v of stof.staat.vragen) assert.ok(v.opties.length > 1 && v.j >= 0);
});

test('een schoolquiz schrijft niets bij in het leerpaspoort', () => {
  /* De grens tussen SPELEN en LEREN. Zou een gewonnen quiz een leerdoel
     bijschrijven, dan is winnen van een klasgenoot een cijfer -- precies wat
     "leren is geen wedstrijd" tegenhoudt. Structureel afgedwongen: het spel
     krijgt de onderwijslaag niet eens binnen, dus er is niets om aan te
     roepen. */
  for (const bestand of ['quiz.js', 'quiz-school.js']) {
    const bron = fs.readFileSync(path.join(__dirname, '..', 'server', 'kern', 'spellen', bestand), 'utf8');
    const code = bron.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const woord of ['onderwijs', 'doelBehaald', 'paspoort', 'leerstofSessies'])
      assert.equal(new RegExp('\\b' + woord + '\\b').test(code), false,
        bestand + ' raakt de schoolvoortgang aan (' + woord + ')');
  }
});
