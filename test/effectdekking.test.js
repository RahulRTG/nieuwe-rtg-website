/* HET EFFECTMODEL EN ZIJN DERDE BRON -- de collecties die de proef zag bewegen.

   WAAR DIT VANDAAN KOMT. Het effectmodel had 2513 van de 4643 paden zonder
   profiel, en zolang dat zo is kan hij nooit de laag zijn die beslist. De voor
   de hand liggende reactie is: meer verklaringen schrijven. Dat is 4643 paden
   een voor een nakijken, en een register dat zo volloopt, loopt vol met
   gissingen.

   De uitweg is een KLEINERE NOEMER: IDEMPROEF.json heeft per route gemeten welke
   COLLECTIES bewogen, en dat zijn er 236 -- een lijst die een mens wel kan
   nalopen. De afleiding wordt daarmee: route --(gemeten schrijfactie)-->
   collectie --(register)--> effect, en alleen de laatste pijl is mensenwerk.

   WAT DEZE TOETS BEWIJST, en de vierde is de belangrijkste:

   1. de afleiding werkt: een pad dat aantoonbaar in een ingedeelde collectie
      schreef, draagt het effect van die collectie met de graad `afgeleid`;
   2. de twee bronnen worden OPGETELD en niet gerangschikt. Dat is een besluit
      uit een meting: waar ze niet overlappen, spreken ze elkaar niet tegen maar
      zien ze elk iets wat de ander principieel niet kan zien;
   3. een pad zonder enige bron geeft NOOIT een lege lijst terug -- ook niet als
      de proef er wel collecties zag maar geen ervan is ingedeeld;
   4. de graad is een rangorde van BEWIJS: een gemeten schrijfactie slaat een
      vermoeden uit een categorie. Zonder die regel viel /api/adres/zoek dicht
      met de reden IDENTITEIT_WIJZIGEN;
   5. een tikfout in een effectnaam laat de module bij het LADEN omvallen en niet
      bij het eerste incident;
   6. er is maar EEN lezer van IDEMPROEF.json in deze laag.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - `bankSaldi` uit effectcollecties.js halen        -> 1 ZAKT (RAAK).
   - de twee bronnen laten rangschikken in plaats van
     optellen, verklaard wint                         -> 1 en 2 ZAKKEN (RAAK).
   - hetzelfde de andere kant op, afgeleid wint       -> 2 ZAKT (RAAK). Allebei
     de richtingen zijn gedraaid, want een toets die maar een van tweeen vangt,
     laat de helft van de rangorde door.
   - wel optellen maar `bronnen` er een laten noemen  -> 1 en 2 ZAKKEN (RAAK).
     Dit is de stille variant: de effecten kloppen en het ETIKET liegt, zodat
     een mens de optelling niet meer kan natrekken.
   - `effecten: []` teruggeven bij een onbekend pad   -> 3 ZAKT (RAAK).
   - het vermoeden boven de afleiding zetten          -> 1, 2 en 4 ZAKKEN. De
     bewering zit in 4; dat 1 en 2 meezakken is geen te grove mutatie maar het
     gevolg: staat het vermoeden vooraan, dan komt de afleiding voor geen enkel
     pad met een categorie nog aan bod.
   - een effectnaam verhaspelen in effectcollecties   -> HET HELE BESTAND ZAKT,
     bij het LADEN. Dat is precies wat toets 5 bewaakt en de bedoeling van de
     fail-fast: een tikfout hoort de bouw te laten omvallen en niet een collectie
     stil ongeclassificeerd te laten tot het eerste incident.

   Draai los: node --test test/effectdekking.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const functies = require('../server/functies');
const effecten = require('../server/kern/isolatie/effecten');
const effectcollecties = require('../server/kern/isolatie/effectcollecties');
const proefmeting = require('../server/kern/isolatie/proefmeting');

test('1. een gemeten schrijfactie in een ingedeelde collectie levert een effect op', () => {
  /* Eerst de meting zelf: dit pad raakte aantoonbaar een collectie. */
  const pad = [...['/api/bank/overboek', '/api/pay/stuur', '/api/appstore/bonnen']]
    .find(p => (proefmeting.collectiesVan(p) || new Set()).size);
  assert.ok(pad, 'er hoort minstens één pad met een gemeten collectie te zijn');

  /* En dan de afleiding erover. */
  const raak = [...proefmeting.collectiesVan(pad)].some(c => effectcollecties.effectVan(c));
  const prof = effecten.effectenVan(pad, 'POST', functies.functieVoorPad(pad));
  if (raak) {
    assert.ok(['verklaard', 'afgeleid'].includes(prof.graad));
    assert.ok((prof.bronnen || []).includes('afgeleid'),
      pad + ' raakt een ingedeelde collectie en hoort die als bron te noemen');
  }

  /* Een collectie die met naam is ingedeeld, draagt zijn effect ook echt. */
  const saldo = effectcollecties.effectVan('bankSaldi');
  assert.ok(saldo, 'bankSaldi hoort ingedeeld te zijn');
  assert.equal(saldo.effect, 'GELD_BEWEGEN');
  assert.ok(saldo.grond && saldo.grond.length > 5, 'elke indeling draagt een grond');
});

test('2. de twee bronnen worden opgeteld en niet gerangschikt', () => {
  /* WAAR HET BESLUIT VANDAAN KOMT is /api/member/ai/tegoed: de VERKLARING ziet
     aan de naam dat er een model wordt aangeroepen, de PROEF zag in de collectie
     dat er tegoed beweegt. Wie de een de ander laat overschrijven, gooit telkens
     een van beide effecten weg.

     WAAROM DE TOETS DAT PAD NIET MEER VASTPINT, en dat is geen verzwakking.
     Of de proef die schrijfactie ZIET, hangt af van de volgorde van de ronde:
     rijVan() in kern/commercie/tegoed.js maakt de tegoedrij aan zodra hij
     ontbreekt, dus een eerdere route die hem al aanmaakte laat deze meting leeg.
     IDEMPROEF.json droeg op de tak van deze laag `aiTegoed` voor dit pad en op
     main (hermeten op 2f5780040) niets -- allebei correct gemeten, en alleen de
     samenvoeging ziet het verschil. Een toets die op zo'n rij staat vastgepind,
     meet de volgorde van de proefronde en niet de regel.

     De regel gaat over de POPULATIE, dus die wordt hier GETELD in plaats van
     aangenomen: er hoort minstens een pad te zijn waar allebei de bronnen
     spreken en waar ze elkaar AANVULLEN. De telling wordt met opzet niet
     vastgelegd op een getal -- hij beweegt met elke proefronde mee, en een
     vastgelegd getal zou van deze toets een versheidswachter maken die hij niet
     is. Wat er niet mag gebeuren is dat hij op NUL komt. */
  const paden = [...new Set(Object.values(require('../IDEMPROEF.json').perRoute).map(r => r.pad))];
  const metingVan = (p) => {
    const uit = new Set();
    for (const col of proefmeting.collectiesVan(p) || []) {
      const rij = effectcollecties.effectVan(col);
      if (rij) uit.add(rij.effect);
    }
    return uit;
  };

  const beide = [];
  const aanvullend = [];
  for (const p of paden.slice().sort()) {
    const prof = effecten.effectenVan(p, 'POST', functies.functieVoorPad(p));
    if ((prof.bronnen || []).length < 2) continue;
    beide.push(p);
    const meting = metingVan(p);
    const buitenDeMeting = (prof.effecten || []).filter(e => !meting.has(e));
    if (meting.size && buitenDeMeting.length) aanvullend.push({ pad: p, prof, meting });
  }

  assert.ok(beide.length,
    'geen enkel pad waar allebei de bronnen spreken -- dan is de optelling niet te zien');
  assert.ok(aanvullend.length,
    'geen enkel pad waar de twee bronnen elkaar AANVULLEN. Dat is precies wat een ' +
    'rangorde oplevert: de verliezer valt weg, en dan is er nooit meer iets buiten ' +
    'de winnaar te zien (' + beide.length + ' paden met twee bronnen)');

  /* En dan het getuigenpad zelf, het eerste op alfabet zodat de uitslag niet van
     de volgorde van het register afhangt. */
  const g = aanvullend[0];
  assert.deepEqual((g.prof.bronnen || []).slice().sort(), ['afgeleid', 'verklaard'],
    g.pad + ': allebei de bronnen horen mee te doen');
  for (const e of g.meting) {
    assert.ok(g.prof.effecten.includes(e),
      g.pad + ': de meting zag ' + e + ' en dat hoort mee te tellen');
  }
  assert.ok(g.prof.effecten.some(e => !g.meting.has(e)),
    g.pad + ': de verklaring draagt een effect dat de meting niet ziet, en dat hoort mee te tellen');
  /* En de gronden van allebei staan in het antwoord, zodat een mens de optelling
     kan natrekken in plaats van hem te moeten geloven. */
  assert.ok(g.prof.gronden.length >= 2);
});

test('3. geen enkel pad krijgt een lege lijst terug', () => {
  const prof = effecten.effectenVan('/api/dit/bestaat/niet', 'POST', null);
  assert.equal(prof.effecten, null, 'null en niet []: leeg leest als "dit doet niets"');
  assert.equal(prof.graad, 'onbekend');
  assert.ok(prof.gronden[0].length > 10, 'ook een onbekende zegt waarom hij onbekend is');

  /* En het lastigste geval: de proef ZAG collecties bewegen, maar geen ervan is
     ingedeeld. Dat is iets anders dan "niets gemeten", en het antwoord zegt dat. */
  const pad = [...new Set(Object.values(require('../IDEMPROEF.json').perRoute).map(r => r.pad))]
    .find(p => {
      const c = proefmeting.collectiesVan(p);
      return c && c.size && ![...c].some(x => effectcollecties.effectVan(x)) &&
        effecten.effectenVan(p, 'POST', functies.functieVoorPad(p)).graad === 'onbekend';
    });
  if (pad) {
    const prof2 = effecten.effectenVan(pad, 'POST', functies.functieVoorPad(pad));
    assert.equal(prof2.effecten, null);
    assert.match(prof2.gronden[0], /collectie\(s\) bewegen/,
      'het antwoord hoort te zeggen dat er wél iets bewoog maar niets is ingedeeld');
  }
});

test('4. een meting slaat een vermoeden', () => {
  /* Dit is de bug die eruit is gehaald: /api/adres/zoek zit in de categorie
     "Toegang en identiteit", dus het VERMOEDEN zegt IDENTITEIT_WIJZIGEN. Een
     adres opzoeken wijzigt geen identiteit. De categorie zegt waar iets woont,
     een meting wat het doet. */
  const functie = { id: 'proef', naam: 'Proef', categorie: 'Toegang en identiteit' };
  const metMeting = [...new Set(Object.values(require('../IDEMPROEF.json').perRoute).map(r => r.pad))]
    .find(p => {
      const c = proefmeting.collectiesVan(p);
      return c && [...c].some(x => effectcollecties.effectVan(x));
    });
  assert.ok(metMeting, 'er hoort een pad met een ingedeelde gemeten collectie te zijn');
  const prof = effecten.effectenVan(metMeting, 'POST', functie);
  assert.notEqual(prof.graad, 'vermoed',
    'een pad met een gemeten collectie hoort nooit op een categorievermoeden terug te vallen');

  /* En omgekeerd: zonder meting en zonder verklaring blijft het vermoeden staan.
     Het wordt niet weggegooid -- het is alleen de zwakste van de drie. */
  const zonder = effecten.effectenVan('/api/geen/enkele/meting/hier', 'POST', functie);
  assert.equal(zonder.graad, 'vermoed');
  assert.deepEqual(zonder.effecten, ['RECHT_VERLENEN', 'IDENTITEIT_WIJZIGEN']);
});

test('5. een tikfout in een effectnaam valt om bij het laden', () => {
  assert.throws(() => effectcollecties.keurIn(['GELD_BEWEGEN']),
    /onbekend effect/,
    'een naam die niet in de effectenlijst staat, hoort de module te laten omvallen');
  /* En met de echte lijst gaat hij goed -- anders bewijst de regel hierboven niets. */
  assert.ok(effectcollecties.keurIn(effecten.NAMEN) > 50);
});

test('6. er is één lezer van IDEMPROEF.json in deze laag', () => {
  /* Twee modules hebben hem nodig en om verschillende redenen, en allebei met
     dezelfde valkuil (een 404 bewijst niets over de route). Die valkuil twee keer
     uitschrijven is LAT.md regel 4: twee plekken die hetzelfde beslissen,
     beslissen na een jaar iets anders. */
  const map = path.join(__dirname, '..', 'server', 'kern', 'isolatie');
  /* Het gaat om LEZEN en niet om noemen: vier bestanden verwijzen in hun
     commentaar naar IDEMPROEF.json, en dat is precies de bedoeling -- daar staat
     waar hun getallen vandaan komen. De toets kijkt dus alleen naar CODE, en
     gebruikt daarvoor dezelfde commentaarstripper als de rest van het huis;
     zelf een regex op commentaar schrijven is hoe deze toets de eerste keer
     fout ging.

     En het gaat om het OPBOUWEN VAN HET PAD, niet om de naam noemen. Twee
     modules noemen IDEMPROEF.json in een tekst die ze teruggeven -- ./besluit.js
     in zijn bewijsregel, ./leesset.js in zijn prijskaartje -- en dat hoort zo:
     een antwoord dat zijn bron noemt is beter dan een antwoord dat dat niet
     doet. Wat niet mag is een tweede plek die het bestand OPENT. */
  const { codeRegelsUit } = require('../scripts/lib/werkelijkheid');
  const OPENT = /(?:path\.join|require)\s*\([^;]*IDEMPROEF\.json/;
  const lezers = fs.readdirSync(map).filter(n => n.endsWith('.js')).filter(n => {
    const bron = fs.readFileSync(path.join(map, n), 'utf8');
    return codeRegelsUit(bron).some(r => OPENT.test(r[1]));
  });
  assert.deepEqual(lezers, ['proefmeting.js'],
    'alleen proefmeting.js hoort IDEMPROEF.json te LEZEN; nu: ' + lezers.join(', '));
});
