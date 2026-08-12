/* De sociale graaf (LIFE.md fase 1): negen sociale domeinen plus de Control
   Tower, samengebracht tot een beeld van wat er tussen mensen speelt.

   Wat deze toetsen bewaken is niet "komen er rijen uit" -- dat is te makkelijk
   waar te maken -- maar de vier beloften waar de laag op staat:

     1. hij bezit niets en schrijft nooit
     2. een bron die stukgaat wordt gemeld en neemt de andere niet mee
     3. `wacht` staat alleen op 'ik' als een domein dat FEITELIJK weet
     4. de vooruitblik rekent niets zelf uit maar vraagt het de levensgraaf

   Bij elke toets staat de mutatie die hem hoort te laten zakken (LAT.md regel
   2). Ze zijn alle vier met die mutatie gezien zakken voordat dit bestand hier
   kwam te staan. */
const test = require('node:test');
const assert = require('node:assert/strict');
const maakSocialeGraaf = require('../server/kern/socialegraaf');

const VANDAAG = new Date().toISOString().slice(0, 10);
const dagen = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

/* Een lege kern in de vorm die de domeinen ECHT hebben. Elke veldnaam hier is
   uit het domeinbestand overgenomen en niet verzonnen -- dat is precies de fout
   die kern/socialewereld.js maakte (zie test/socialewereld.test.js).

   EN DIE FOUT STOND HIER ZELF OOK IN, wat meteen laat zien waarom dit zo nauw
   luistert: `meetMijn` stond hier plat, terwijl Meet als OBJECT aan de kern
   hangt (kern.meet.meetMijn, zoals routes/meet.js hem pakt). De bron greep een
   niveau te hoog, viel bij ELKE aanroep in zijn eigen vangnet, en stond bij
   iedereen in stil[] -- en deze toets kon dat niet zien, want hij bouwde
   dezelfde verkeerde kern na. Een stub die niet op het domein lijkt, toetst de
   veronderstelling en niet de code. Gevonden door de routetoets, die de ECHTE
   kern krijgt (test/objectlaagroutes.test.js). */
function kernMet(over) {
  const k = {
    comm: { inbox: () => ({ gesprekken: [] }) },
    bijeenkomst: { mijnAgenda: () => ({ komt: [] }) },
    genootschap: { mijn: () => ({ groepen: [], uitnodigingen: [] }) },
    pulseFeed: () => ({ feed: [] }),
    salonInzicht: { overzicht: () => ({ posts: [] }) },
    socialConnecties: () => ({ connections: [], requests: [] }),
    vonkMijn: () => ({ status: 200, matches: [] }),
    rvMatches: () => ({ status: 200, matches: [] }),
    meet: { meetMijn: () => ({ kamers: [] }) },
    levensgraaf: { termijnen: () => [], graaf: () => ({ knopen: [] }) }
  };
  Object.assign(k, over || {});
  return k;
}
const graaf = (over) => maakSocialeGraaf({ kern: kernMet(over) }).socialegraaf;

/* DE MUTATIE: voeg een functie toe die iets bewaart (`plaats`, `nodigUit`).
   Dat is het begin van een tweede sociaal netwerk naast de elf die er al zijn,
   en precies wat LIFE.md par. 5 verbiedt. */
test('bezit niets: er is geen enkele manier om iets te schrijven', () => {
  /* De lijst staat er VOLUIT en niet als "geen enkele functie die schrijft",
     zodat elke nieuwe export een bewuste stap is. `lijn` kwam er in fase 4 bij
     en liet deze toets terecht zakken: dat is precies waar hij voor is. */
  assert.deepEqual(Object.keys(graaf()).sort(), ['NAMEN', 'beeld', 'lijn'],
    'de sociale graaf hoort ALLEEN te kunnen lezen');
});

/* DE BELANGRIJKSTE TOETS VAN DEZE LAAG, en om dezelfde reden als bij de
   samenhanglaag: een beeld waaruit een bron is weggevallen ZIET ER COMPLEET
   UIT. Bij negen bronnen weegt dat zwaarder dan bij drie -- de kans dat er een
   omvalt is drie keer zo groot, en de kans dat iemand het merkt even klein.

   DE MUTATIE: haal de try/catch in bronnen.js verzamel() weg, of laat de naam
   niet in stil[] belanden. */
test('een bron die stukgaat wordt gemeld en neemt de andere niet mee', () => {
  const g = graaf({
    comm: { inbox: () => { throw new Error('comm stuk'); } },
    meet: { meetMijn: () => { throw new Error('meet stuk'); } },
    genootschap: { mijn: () => ({ groepen: [], uitnodigingen: [
      { id: 'gr1', naam: 'De Kring', leden: 8 }] }) }
  });
  const b = g.beeld('k');
  assert.deepEqual(b.stil.sort(), ['gesprekken', 'meet']);
  assert.equal(b.momenten.length, 1, 'de andere zeven bronnen horen door te lopen');
  assert.equal(b.momenten[0].soort, 'uitnodiging');
});

/* De vooruitblik hangt aan een ANDERE laag dan de negen bronnen (de
   levensgraaf), en kan dus los omvallen. Dat hoort net zo zichtbaar te zijn.

   DE MUTATIE: haal de try/catch om vooruitMod heen weg in index.js -- dan valt
   het hele beeld om in plaats van alleen de vooruitblik. */
test('valt de Control Tower om, dan blijft het beeld staan en meldt het dat', () => {
  const g = graaf({
    levensgraaf: { termijnen: () => { throw new Error('tower stuk'); }, graaf: () => ({ knopen: [] }) },
    pulseFeed: () => ({ feed: [{ id: 'p1', tekst: 'Dag', at: VANDAAG, codenaam: 'Ux' }] })
  });
  const b = g.beeld('k');
  assert.deepEqual(b.stil, ['termijnen']);
  assert.equal(b.momenten.length, 1);
  assert.equal(b.vooruit.totaal, 0, 'geen tower betekent geen termijnen, geen halve');
});

/* DE REGEL DIE DEZE WERELD DRAAGT (LIFE.md par. 0 en hulp.js).

   `wacht` op 'ik' zetten omdat iets er dringend uitziet, is kunstmatige urgentie
   -- en dat is precies wat CLAUDE.md verbiedt. Het mag er alleen staan als het
   domein het FEITELIJK weet.

   DE MUTATIE: zet in bronnen.js bij `bijeenkomsten` de wachtstand hard op 'ik'
   in plaats van op `x.mijnAntwoord ? '' : 'ik'`. Dan wacht een bijeenkomst waar
   het lid allang op geantwoord heeft alsnog op hem. */
test('wacht staat alleen op mij als het domein dat echt weet', () => {
  const g = graaf({
    bijeenkomst: { mijnAgenda: () => ({ komt: [
      { id: 'b1', wat: 'Borrel', datum: dagen(3), groep: 'K', mijnAntwoord: null },
      { id: 'b2', wat: 'Lezing', datum: dagen(4), groep: 'K', mijnAntwoord: 'ja' }
    ] }) },
    pulseFeed: () => ({ feed: [{ id: 'p1', tekst: 'Dag', at: VANDAAG, codenaam: 'Ux' }] })
  });
  const b = g.beeld('k');
  assert.equal(b.momenten.find(m => m.kenmerk === 'b1').wacht, 'ik');
  assert.equal(b.momenten.find(m => m.kenmerk === 'b2').wacht, '',
    'wie al geantwoord heeft, heeft niets meer te doen');
  assert.equal(b.momenten.find(m => m.kenmerk === 'p1').wacht, '',
    'een bericht lezen is geen taak');
  assert.equal(b.telling.wachtOpMij, 1);
});

/* DE MUTATIE: laat `moment()` in hulp.js een onbekende wachtstand doorlaten.
   Dan kan een bron 'misschien' of 'binnenkort' aanleveren, sorteert WACHTRANG
   op undefined (NaN) en blijft de rij staan zoals hij binnenkwam -- zonder
   klacht, precies de fout die wereldkern.js ook een keer had. */
test('een verzonnen wachtstand komt de vorm niet door', () => {
  const g = graaf({
    genootschap: { mijn: () => ({ groepen: [], uitnodigingen: [
      { id: 'gr1', naam: 'De Kring', leden: 8 }] }) }
  });
  const m = g.beeld('k').momenten[0];
  assert.equal(m.wacht, 'ik');
  assert.ok(['ik', 'ander', ''].includes(m.wacht));
});

/* Wat bij MIJ ligt bovenaan. Dat is een andere weging dan de vier signalen van
   wereldkern.js: die weegt hoe dringend iets is, deze bij wie het ligt.

   DE MUTATIE: draai WACHTRANG om, of sorteer alleen op datum. Dan staat een
   bericht van vandaag boven een verzoek dat al drie dagen op iemand wacht. */
test('wat bij mij ligt staat boven wat alleen maar gebeurd is', () => {
  const g = graaf({
    socialConnecties: () => ({ connections: [], requests: [
      { key: 'x', codename: 'Sam', at: dagen(-3) }] }),
    pulseFeed: () => ({ feed: [{ id: 'p1', tekst: 'Vandaag', at: VANDAAG, codenaam: 'Ux' }] })
  });
  assert.deepEqual(g.beeld('k').momenten.map(m => m.soort), ['verzoek', 'bericht']);
});

/* DE TOETS DIE DE DUBBELE WAARHEID TEGENHOUDT (LIFE.md fase 1, LAT.md regel 4).

   De vooruitblik MOET de dagen van de levensgraaf overnemen en ze niet zelf
   uitrekenen. Zou hij zelf rekenen, dan verschilt het scherm ooit een dag met de
   Control Tower en kan niemand aanwijzen welke klopt.

   DE MUTATIE: laat vooruitblik.js `dagen` zelf uitrekenen uit `datum`. Deze
   toets levert een tower die met opzet een ONMOGELIJK getal teruggeeft; wie zelf
   rekent, komt op iets anders uit en zakt. */
test('de vooruitblik rekent niets zelf uit maar neemt de tower over', () => {
  const g = graaf({
    levensgraaf: {
      termijnen: () => [
        { id: 't1', naam: 'paspoort', wat: 'paspoort', kamer: 'gezelschap', bron: 'Entourage',
          datum: dagen(5), dagen: -999, waarvan: 'Sam', zwaar: true },
        { id: 't2', naam: 'verjaardag', wat: 'verjaardag', kamer: 'kring', bron: 'Attenties',
          datum: dagen(10), dagen: 10, waarvan: 'Noor', zwaar: false },
        /* een termijn uit een NIET-sociale kamer hoort hier niet in beeld */
        { id: 't3', naam: 'taxatie', wat: 'taxatie', kamer: 'bezit', bron: 'Logboek',
          datum: dagen(2), dagen: 2, waarvan: 'Villa', zwaar: true }
      ],
      graaf: () => ({ knopen: [] })
    }
  });
  const v = g.beeld('k').vooruit;
  assert.equal(v.totaal, 2, 'alleen de kamers die over mensen gaan');
  assert.equal(v.achterstallig.length, 1, 'dagen: -999 komt uit de tower en wordt niet nagerekend');
  assert.equal(v.achterstallig[0].waarvan, 'Sam', 'zonder naam is de waarschuwing nutteloos');
  assert.equal(v.komt.length, 1);
  assert.equal(v.komt[0].wat, 'verjaardag');
});

/* Cercle draagt gastpassen als AANTAL, niet als datum (kern/rechterhand/
   cercle.js). Er valt dus niets vooruit te blikken, en een verzonnen
   vervaldatum zou een waarschuwing zijn die nergens op slaat.

   DE MUTATIE: laat vooruitblik.js van een club een termijn maken met een
   verzonnen datum. Dan verschijnt er een aftelling die in geen enkele app
   bestaat. */
test('clubs tellen mee als telling, nooit als termijn', () => {
  const g = graaf({
    levensgraaf: {
      termijnen: () => [],
      graaf: () => ({ knopen: [
        { id: 'club:1', soort: 'club', naam: 'Milaan', kamer: 'kring' },
        { id: 'club:2', soort: 'club', naam: 'Parijs', kamer: 'kring' },
        { id: 'relatie:1', soort: 'relatie', naam: 'Noor', kamer: 'kring' }
      ] })
    }
  });
  const b = g.beeld('k');
  assert.equal(b.telling.clubs, 2);
  assert.equal(b.vooruit.totaal, 0, 'een club heeft geen vervaldatum en krijgt er geen');
});

/* Een poort is geen storing. Vonk eist 18+ met geverifieerd paspoort en geeft
   dan een fout terug in plaats van matches; dat hoort LEEG te zijn en niet STIL,
   want de bron werkt prima.

   EERLIJK OVER WAT DEZE TOETS BEWAAKT. De eerst opgeschreven mutatie was "haal
   `if (v.error) return []` weg in bronnen.js" -- en die is geprobeerd en liet
   deze toets NIET zakken: `lijst(undefined)` geeft al een lege lijst, dus de
   regel is expliciete bedoeling en geen dragende constructie. Dat hoort hier te
   staan in plaats van weggepoetst (LAT.md regel 2 en 6): een mutatie die je
   opschrijft zonder hem te draaien, is een bewering.

   DE MUTATIE DIE HEM WEL LAAT ZAKKEN: laat de bron bij een gesloten poort
   gooien (`if (v.error) throw new Error(v.error)`). Dan valt Vonk voor elk
   minderjarig lid in stil[] en lijkt er iets stuk terwijl de grens gewoon zijn
   werk doet. Dat is de fout die deze toets afdekt. */
test('een gesloten poort is leeg, niet stil', () => {
  const g = graaf({ vonkMijn: () => ({ status: 403, error: 'Vonk is voor 18 jaar en ouder.' }) });
  const b = g.beeld('k');
  assert.deepEqual(b.stil, [], 'een poort die dichthoudt is geen kapotte bron');
  assert.equal(b.momenten.length, 0);
});

/* Stilgezette gesprekken tellen niet mee: dat besluit heeft het lid zelf
   genomen. Een teller die daar overheen gaat, is het platform dat zegt "toch
   maar wel" -- en dat is de vorm van aandacht-bedelen waar CLAUDE.md over gaat.

   DE MUTATIE: haal `&& !g.stil` weg in bronnen.js. */
test('een stilgezet gesprek blijft stil, ook als er ongelezen berichten zijn', () => {
  const g = graaf({
    comm: { inbox: () => ({ gesprekken: [
      { id: 'g1', titel: 'Sam', ongelezen: 2, at: VANDAAG },
      { id: 'g2', titel: 'Gelezen', ongelezen: 0, at: VANDAAG },
      { id: 'g3', titel: 'Stilgezet', ongelezen: 9, at: VANDAAG, stil: true }
    ] }) }
  });
  const b = g.beeld('k');
  assert.deepEqual(b.momenten.map(m => m.kenmerk), ['g1']);
  assert.equal(b.telling.wachtOpMij, 1);
});

/* DE SCHAKELAARS UIT HET BELEID, in de graaf (LIFE.md par. 6).

   Twee van de drie werken hier: `vonk` houdt matches uit het beeld, en `bereik`
   laat alleen verbindingsverzoeken door van mensen met wie het lid een
   genootschap deelt.

   DAT LAATSTE IS EEN FILTER EN GEEN BLOKKADE, en dat onderscheid is de reden dat
   het hier staat en niet in kern/sociaal: blokkeren woont daar en blijft daar.
   Twee lijsten van "wie mag mij bereiken" zouden uiteenlopen (LAT.md regel 4).

   DE MUTATIE: laat bronnen.js het beleid niet raadplegen. Dan doet een knop die
   iemand omzette niets, en dat is erger dan geen knop. */
test('een uitgezette schakelaar versmalt wat de graaf toont', () => {
  const beleid = { knopAan: (key, knop) => knop !== 'vonk' && knop !== 'bereik' };
  const g = graaf({
    socialebeleid: beleid,
    vonkMijn: () => ({ status: 200, matches: [{ id: 'm1', met: 'Ux', at: VANDAAG }] }),
    rvMatches: () => ({ status: 200, matches: [{ id: 'r1', codenaam: 'Ux', sinds: VANDAAG }] }),
    socialConnecties: () => ({ connections: [], requests: [
      { key: 'x', codename: 'Bekend', at: VANDAAG },
      { key: 'y', codename: 'Vreemde', at: VANDAAG }
    ] }),
    genootschap: { mijn: () => ({ groepen: [], uitnodigingen: [] }),
      mijne: () => [{ id: 'g1' }], publiek: () => ({ ledenlijst: [{ codenaam: 'Bekend' }] }) }
  });
  const b = g.beeld('k');
  assert.deepEqual(b.momenten.filter(m => m.soort === 'match'), [],
    'met vonk uit blijven matches uit het beeld');
  assert.deepEqual(b.momenten.filter(m => m.soort === 'verzoek').map(m => m.wie), ['Bekend'],
    'met bereik uit komen alleen verzoeken uit een gedeeld genootschap door');
  assert.deepEqual(b.stil, [], 'een uitgezette schakelaar is geen stukke bron');
});
