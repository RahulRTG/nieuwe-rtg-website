/* DE LUSINDEX (scripts/lussen.js + scripts/lib/lusvorm.js).

   WAT DEZE TOETS WERKELIJK BEWAAKT. Niet dat de meter een getal oplevert --
   dat doet elke meter. Hij bewaakt dat de meter NEE blijft zeggen waar nee
   hoort. Een lusmeter die te gretig `bewezenBegrensd` uitdeelt, is gevaarlijker
   dan geen lusmeter: hij zet een groen vinkje op de plek waar een mens anders
   zelf had gekeken. Elke geval hieronder met `niet` in de naam is daarom een
   VAL, en die vallen zijn niet verzonnen -- ze komen alle vier uit code die in
   deze boom staat.

   De zwaarste is `while(true){ for(;;){ break } }`. Een probe die enkel zoekt
   of er ergens in het lijf een `break` staat, noemt die lus onderbroken. Hij is
   het niet: die break hoort bij de binnenlus. Precies zo kwam de eerste meting
   in deze sessie op "alle 54 altijd-ware lussen hebben een uitweg", en dat was
   geen meting maar een vergissing met een geruststellende vorm. */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { parse } = require('../scripts/ast/parser');
const { loop: wandel } = require('../scripts/ast/walk');
const V = require('../scripts/lib/lusvorm');

/* Eerste lus uit een fragment. */
function eersteLus(bron) {
  const boom = parse(bron);
  let uit = null;
  wandel(boom, n => { if (!uit && V.LUSKNOPEN.has(n.type)) uit = n; });
  assert.ok(uit, 'geen lus gevonden in het fragment -- de toets zelf is stuk');
  return uit;
}
const graadVan = bron => { const l = eersteLus(bron); return V.terminatieVan(l, V.vormVan(l)).graad; };

test('een monotone teller tegen een niet-groeiende grens is BEWEZEN begrensd', () => {
  assert.equal(graadVan('for (let i = 0; i < rij.length; i++) { doe(rij[i]); }'), 'bewezenBegrensd');
  assert.equal(graadVan('for (let i = 0; i <= 10; i += 2) { doe(i); }'), 'bewezenBegrensd');
});

test('VAL: een teller wiens grens in het lijf groeit is NIET begrensd', () => {
  /* `for (let i=0;i<rij.length;i++) rij.push(x)` loopt eeuwig en ziet er tot op
     het laatste teken uit als een nette teller. */
  const l = eersteLus('for (let i = 0; i < rij.length; i++) { rij.push(i); }');
  const vorm = V.vormVan(l);
  assert.equal(vorm.begrenzing, 'TELLER_GROEIENDE_GRENS');
  assert.notEqual(V.terminatieVan(l, vorm).graad, 'bewezenBegrensd');
});

test('VAL: een teller die in het lijf wordt teruggezet is NIET begrensd', () => {
  assert.notEqual(graadVan('for (let i = 0; i < 10; i++) { if (x) i = 0; }'), 'bewezenBegrensd');
  assert.notEqual(graadVan('while (n < 5) { n = 0; }'), 'bewezenBegrensd');
});

test('de veiligheidsteller in de voorwaarde telt wel (het patroon uit bank/incasso.js)', () => {
  assert.equal(graadVan('while (t.volgendeAt <= grens && veiligheid++ < 500) { boek(t); }'), 'bewezenBegrensd');
  assert.equal(graadVan('while (pogingen < 5) { pogingen++; probeer(); }'), 'bewezenBegrensd');
});

test('een altijd-ware lus zonder uitweg heet geenUitwegGevonden', () => {
  assert.equal(graadVan('while (true) { tik(); }'), 'geenUitwegGevonden');
  assert.equal(graadVan('for (;;) { tik(); }'), 'geenUitwegGevonden');
});

test('VAL: de break van een BINNENlus bevrijdt de buitenlus niet', () => {
  assert.equal(graadVan('while (true) { for (;;) { break; } }'), 'geenUitwegGevonden');
  assert.equal(graadVan('while (true) { switch (x) { case 1: break; } }'), 'geenUitwegGevonden');
});

test('VAL: een return in een GENESTE functie is geen uitweg van de lus', () => {
  assert.equal(graadVan('while (true) { rij.forEach(function (x) { return x; }); }'), 'geenUitwegGevonden');
  assert.equal(graadVan('while (true) { const f = () => { return 1; }; f(); }'), 'geenUitwegGevonden');
});

test('een eigen break, return of throw is wel een uitweg -- maar alleen `uitwegAanwezig`', () => {
  /* NOOIT `bewezen`: of dat pad bereikbaar is, vraagt een control-flowgraaf.
     `while (true) { if (false) break; }` ziet er hier identiek uit. */
  assert.equal(graadVan('while (true) { if (klaar) break; }'), 'uitwegAanwezig');
  assert.equal(graadVan('while (true) { if (klaar) return 1; }'), 'uitwegAanwezig');
});

test('for-of: een literale rij is bewezen, een naam hoogstens aannemelijk', () => {
  assert.equal(graadVan('for (const x of [1, 2, 3]) { doe(x); }'), 'bewezenBegrensd');
  assert.equal(graadVan('for (const x of Object.keys(o)) { doe(x); }'), 'bewezenBegrensd');
  /* Een naam KAN een oneindige generator zijn. Dat is geen theoretisch bezwaar:
     zodra hier `bewezen` zou staan, stopt een mens met kijken. */
  assert.equal(graadVan('for (const x of lijst) { doe(x); }'), 'aannemelijkBegrensd');
});

test('de identiteit verschuift niet als de code verschuift', () => {
  const a = V.structuurhash(eersteLus('function f() { for (const x of lijst) { doe(x); } }'));
  const b = V.structuurhash(eersteLus('\n\n\nfunction f() {\n\n  for (const x of lijst) {\n    doe(x);\n  }\n}'));
  assert.equal(a, b, 'dezelfde lus drie regels lager moet dezelfde sleutel houden');
  const c = V.structuurhash(eersteLus('for (const x of andere) { doe(x); }'));
  assert.notEqual(a, c, 'een andere lus moet een andere sleutel krijgen');
});

test('een neveneffect in een geneste functie is niet het neveneffect van de lus', () => {
  assert.deepEqual(V.effectenVan(eersteLus('for (const x of a) { save(x); }')), ['opslag']);
  assert.deepEqual(V.effectenVan(eersteLus('for (const x of a) { later(() => save(x)); }')), []);
});

test('sterke componenten vinden de indirecte kring, en verzinnen er geen', () => {
  const b = { A: ['B'], B: ['C'], C: ['A'], D: ['A'], E: ['E'] };
  const groepen = V.sterkeComponenten(Object.keys(b), k => b[k]);
  const drie = groepen.filter(g => g.length === 3);
  assert.equal(drie.length, 1, 'A->B->C->A is een kring');
  assert.deepEqual(drie[0], ['A', 'B', 'C']);
  assert.ok(groepen.some(g => g.length === 1 && g[0] === 'E'), 'een zelfverwijzing is een kring van een');
  assert.ok(!groepen.some(g => g.includes('D') && g.length === 1), 'D wijst naar de kring maar zit er niet in');
});

test('de overlaprem meldt geen rem waar er geen is, en niets waar de vraag niet speelt', () => {
  const cb = bron => parse(bron).body[0].expression.arguments[0];
  assert.equal(V.overlapRemVan(cb('setInterval(async () => { await werk(); }, 1000)'), true), 'geenGevonden');
  assert.equal(V.overlapRemVan(cb('setInterval(async () => { if (bezig) return; await werk(); }, 1000)'), true), 'vermoedelijkAanwezig');
  assert.equal(V.overlapRemVan(cb('setInterval(() => { tel++; }, 1000)'), false), 'nietVanToepassing');
});

/* --------------------------------------------------------------------------
   HET REGISTER ZELF. Deze toets leest LUSSEN.json en niet de code: hij bewaakt
   dat het register de vorm houdt waarop de ratel en de documenten leunen. */
const REGISTER = path.join(__dirname, '..', 'LUSSEN.json');

test('het register draagt zijn assen apart en telt ze nergens op', () => {
  const j = JSON.parse(fs.readFileSync(REGISTER, 'utf8'));
  for (const v of ['sleutelwoordlussen', 'callbackIteratiesGeteld', 'directeRecursie', 'wederzijdseRecursieGroepen', 'moduleKringen', 'wekkers'])
    assert.equal(typeof j.assen[v], 'number', 'as ontbreekt: ' + v);
  /* Er mag geen veld zijn dat de assen optelt. Dat getal zou meteen gaan rondlopen. */
  assert.ok(!('totaal' in j.assen), 'de assen mogen geen optelsom dragen');
  assert.ok(j.buitenIndex.scripts && j.buitenIndex.test, 'scripts/ en test/ horen apart geteld te staan');
});

test('elke graad in het register bestaat in de gesloten verzameling', () => {
  const j = JSON.parse(fs.readFileSync(REGISTER, 'utf8'));
  for (const g of Object.keys(j.gemeten.terminatieVerdeling))
    assert.ok(V.GRADEN.includes(g), 'onbekende terminatiegraad in het register: ' + g);
  /* De twee graden die niemand kan zetten, mogen ook niet VOORKOMEN. Een graad
     in een register die geen enkele meting kan produceren, is een belofte. */
  for (const rij of j.nogNietTeZetten.filter(x => x.graad))
    assert.ok(!(rij.graad in j.gemeten.terminatieVerdeling),
      rij.graad + ' staat in het register terwijl er geen meting is die hem kan zetten');
});

test('de ratel bestaat en staat op getallen, niet op percentages', () => {
  const j = JSON.parse(fs.readFileSync(REGISTER, 'utf8'));
  for (const [k, v] of Object.entries(j.ratel))
    assert.ok(Number.isInteger(v), 'ratelwaarde ' + k + ' hoort een geheel getal te zijn, geen percentage');
});

/* --------------------------------------------------------------------------
   DE TWEEDE RONDE. Alle vier de regels hieronder komen uit de kalibratie: de
   vijf lussen die de eerste versie KRITIEK noemde, bleken alle vijf veilig. Een
   meter die veilige idiomen bovenaan zet, leert een mens de lijst negeren --
   dat is een duurdere fout dan een gemiste lus. */

test('een verzameling die elke ronde krimpt en nergens groeit, is begrensd', () => {
  assert.equal(graadVan('while (open.size > MAX) { open.delete(k); }'), 'bewezenBegrensd');
  assert.equal(graadVan('while (rij.length >= MAX) { rij.shift(); }'), 'bewezenBegrensd');
});

test('VAL: een verzameling die ook groeit bewijst niets (kern/pay/schaduw.js)', () => {
  /* `rij.unshift(...stuk)` bij een fout. Dit is geen tekort van de krimpregel,
     het is de reden dat hij te vertrouwen is. */
  const l = eersteLus('while (rij.length) { rij.splice(0, 5); rij.unshift(x); }');
  const vorm = V.vormVan(l);
  assert.equal(vorm.code, 'BRON_GROEIT_EN_KRIMPT');
  assert.equal(V.terminatieVan(l, vorm).graad, 'nietVastTeStellen');
});

test('een samengestelde EN-test wordt uitgepakt (kern/stuur/lus.js)', () => {
  assert.equal(graadVan('for (let i = 0; i < subs.length && tel < totaal; i++) { f(); }'), 'bewezenBegrensd');
});

test('VAL: een OF-test wordt NIET uitgepakt', () => {
  /* Bij `A || B` moeten beide onwaar worden; een begrensde disjunct bewijst
     niets. Wie hier plat door de test wandelt, verklaart deze lus begrensd. */
  assert.equal(graadVan('for (let i = 0; i < 10 || wachten; i++) { f(); }'), 'nietVastTeStellen');
});

test('een altijd-ware lus die elke ronde loslaat is een DIENST en geen defect', () => {
  const dienst = eersteLus('while (true) { const r = await lezer.read(); if (r.done) break; }');
  const vd = V.vormVan(dienst);
  const sd = V.soortVan(dienst, vd, V.terminatieVan(dienst, vd));
  assert.equal(sd.lussoort, 'dienst');
  assert.equal(sd.voortgang, 'blokkerendeWacht');
  /* en dan mag hij niet op `hoog` staan louter omdat er await in staat */
  const r = V.risicoVan(dienst, 'server/lib/browser.js', vd, V.terminatieVan(dienst, vd), [], 0, true, sd);
  assert.ok(r.klasse === 'laag' || r.klasse === 'midden', 'een dienstlus met blokkerende wacht is geen hoog risico, maar kreeg: ' + r.klasse);
});

test('een altijd-ware lus zonder await bezet de gebeurtenislus, en dat staat er', () => {
  const reken = eersteLus('for (;;) { if (s[i] === 125) break; i++; }');
  const vr = V.vormVan(reken);
  const sr = V.soortVan(reken, vr, V.terminatieVan(reken, vr));
  assert.equal(sr.lussoort, 'rekenlus');
  assert.equal(sr.voortgang, 'bezetDeLus');
});

test('elke onbekende lus draagt een REDEN uit een gesloten lijst', () => {
  const j = JSON.parse(fs.readFileSync(REGISTER, 'utf8'));
  const toegestaan = new Set(['GEEN_TELLER', 'EXTERNE_BRON', 'TELLER_VERZET', 'GROEIENDE_GRENS', 'BRON_GROEIT_EN_KRIMPT', 'ANALYSEGRENS']);
  const redenen = Object.keys(j.gemeten.onbekendRedenVerdeling);
  assert.ok(redenen.length > 0, 'zonder uitsplitsing is `onbekend` een eindbak in plaats van een werklijst');
  for (const r of redenen) assert.ok(toegestaan.has(r), 'onbekende reden-code in het register: ' + r);
});

/* --------------------------------------------------------------------------
   DE INVARIANT. Dit is de eigenlijke lat van dit register, en hij zegt met
   opzet NIET "alle lussen zijn veilig" -- dat kan niet, want terminatie is
   onbeslisbaar. Hij zegt:

     niets is onbekend zonder dat dit huis weet DAT het onbekend is en waarom.

   Elke ontdekte lus draagt een identiteit, een soort, een bereikbaarheid, een
   terminatiegraad, een risicovector en een bewijsstand -- en waar iets onbekend
   is, staat de reden erbij. Ontbreekt er een veld, dan is het register ongeldig
   en zakt de bouw. Dat is een sterkere norm dan een percentage, want een
   percentage kan stijgen doordat er lussen uit beeld vallen.

   De woordenlijsten staan HIER en niet in het meetscript. Dat is het punt: de
   toets is de autoriteit over wat een geldige waarde is. Verzint de meter
   morgen een zevende bereikweg, dan hoort dat een besluit te zijn en geen
   bijwerking. */
const VOCAB = {
  as: ['syntactisch', 'callback'],
  terminatie: ['bewezenBegrensd', 'aannemelijkBegrensd', 'uitwegAanwezig', 'geenUitwegGevonden', 'nietVastTeStellen'],
  lussoort: ['eindig', 'dienst', 'rekenlus', 'onbekend'],
  voortgang: ['blokkerendeWacht', 'bezetDeLus', 'nietVanToepassing'],
  bereikbaarheid: ['route', 'routeViaGraaf', 'wekker', 'opstart', 'bestandViaGraaf', 'scherm', 'onbekend'],
  risico: ['kritiek', 'hoog', 'midden', 'laag'],
  bewijs: ['bewezen', 'verschaald', 'verzwakt', 'geschorst', 'ongemeten', 'geenRouteGevonden']
};

test('INVARIANT: geen enkele lus mist een veld', () => {
  const j = JSON.parse(fs.readFileSync(REGISTER, 'utf8'));
  assert.ok(j.lussen.length > 1000, 'een lege index maakt elke invariant waar; dat is geen bewijs');
  const gemist = [];
  for (const l of j.lussen) {
    for (const veld of ['id', 'as', 'bestand', 'soort', 'begrenzing', 'terminatie', 'lussoort',
      'voortgang', 'bereikbaarheid', 'bewijs', 'domein', 'risico']) {
      if (l[veld] == null) gemist.push(l.id + ' mist ' + veld);
    }
    if (!Array.isArray(l.effecten)) gemist.push(l.id + ' mist effecten');
    if (!Array.isArray(l.risicoOpbouw)) gemist.push(l.id + ' mist risicoOpbouw');
    if (typeof l.await !== 'boolean') gemist.push(l.id + ' mist await');
    if (typeof l.nesting !== 'number') gemist.push(l.id + ' mist nesting');
    if (gemist.length > 5) break;
  }
  assert.deepEqual(gemist, [], 'LUSINDEX ONGELDIG -- deze velden ontbreken');
});

test('INVARIANT: onbekend draagt altijd een reden', () => {
  const j = JSON.parse(fs.readFileSync(REGISTER, 'utf8'));
  const zonder = [];
  for (const l of j.lussen) {
    if (l.terminatie === 'nietVastTeStellen' && !l.onbekendReden) zonder.push(l.id + ': terminatie onbekend zonder reden');
    if (l.bereikbaarheid === 'onbekend' && !l.bereikReden) zonder.push(l.id + ': bereikbaarheid onbekend zonder reden');
    if (zonder.length > 5) break;
  }
  assert.deepEqual(zonder, [], 'een onbekende zonder reden is een restbak, en dan is `onbekend` geen uitslag maar een gat');
});

test('INVARIANT: elke waarde komt uit een gesloten lijst', () => {
  const j = JSON.parse(fs.readFileSync(REGISTER, 'utf8'));
  const vreemd = new Set();
  for (const l of j.lussen) {
    for (const [veld, toegestaan] of Object.entries(VOCAB)) {
      if (l[veld] != null && !toegestaan.includes(l[veld])) vreemd.add(veld + ' = ' + l[veld]);
    }
  }
  assert.deepEqual([...vreemd], [], 'onbekende waarde(n) in het register -- een nieuwe stand hoort een besluit te zijn, geen bijwerking');
});

test('de zes dekkingen staan apart, en vijf ervan zijn beloften over volledigheid', () => {
  const j = JSON.parse(fs.readFileSync(REGISTER, 'utf8'));
  for (const k of ['ontdekking', 'identiteit', 'bereikbaarheid', 'indeling', 'bewijsstand'])
    assert.equal(j.dekking[k], 100, 'dekking.' + k + ' hoort 100 te zijn: hij zegt dat elke lus een STAND draagt, niet dat die stand gunstig is');
  /* En bewijskracht mag juist NIET vastgezet worden op 100. Zou die eis er staan,
     dan zou iemand hem halen door `geenRouteGevonden` als bewijs te tellen -- en
     dat is precies het verschil dat deze twee getallen uit elkaar houdt. */
  assert.ok(j.dekking.bewijskracht < 100, 'bewijskracht op 100 betekent dat een stand als bewijs is geteld');
  assert.ok(!('totaal' in j.dekking) && !('samengesteld' in j.dekking), 'de zes dekkingen worden nooit samengevat tot een getal');
});
