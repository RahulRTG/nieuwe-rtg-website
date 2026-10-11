/* WAT KEURINGSREGEL 28 PER ROUTE BESLIST, los van het lezen van de schijf.

   scripts/check.js regel 28 loopt server/ door en houdt de tellers bij; het
   oordeel over een stuk bron staat hier, zodat test/poortoordeel.test.js het
   op een paar regels bron kan nagaan zonder de hele keuring te draaien. De
   poortnamen (POORT_MW, POORT_BINNEN) en de publieke lijst blijven waar ze
   wonen, in check.js en in ./publiek.js, en komen als argument binnen: zo
   krijgt ./poortbereik.js ze ook, en twee lijsten van wat een poort is lopen
   uiteen (LAT.md regel 4).

   VIJF UITKOMSTEN PER ROUTE, in deze volgorde:

     poortwachter  een naam uit poortMw staat voor de handler
     binnen        de handler roept een poort uit poortBinnen aan
     kaal          de handler geeft ergens een 401 of 403 terug
     publiek       geen van drieen, maar het pad staat met reden op de lijst
     gat           geen van vieren: de keuring zakt

   Daarnaast zegt `gezien` of de publieke uitzondering voor dit pad nog iets
   doet. Zo niet, dan eist de opruimcontrole in check.js dat hij weg gaat. */
'use strict';

/* DE STAART NIET MEE-MATCHEN. Hier stond ([\s\S]{0,800}) in het patroon zelf,
   en dat CONSUMEERT die 800 tekens: exec() zoekt daarna verder voorbij de
   staart en slaat elke route over die er binnen valt. Uitkomst: 709 van de
   ~1900 routes bekeken, en netjes "alles in orde" gemeld. Een regel die een
   fractie ziet en volledigheid suggereert is precies wat deze regel moet
   tegenhouden -- gevonden doordat een mutatie NIET beet (LAT.md regel 2). */
const ROUTE = /app\.(get|post|put|delete|patch)\(\s*['"](\/api\/[^'"]*)['"]\s*,/g;
const VOLGENDE = /app\.(get|post|put|delete|patch)\(\s*['"]/;
const VENSTER = 800;

/* `bron` is al zonder commentaar (check.js leest hem met zonderCommentaar):
   een poortnaam in uitleg is geen poort. */
function beoordeelBron(tekst, { poortMw, poortBinnen, publiek }) {
  const bron = String(tekst), uit = [];
  for (const m of bron.matchAll(ROUTE)) {
    const pad = m[2];
    /* HET VENSTER STOPT BIJ DE VOLGENDE ROUTE. Zonder die knip keek deze
       regel 800 tekens vooruit en liep daarmee de BUURMAN in: een route zonder
       poort werd goedgekeurd omdat de route eronder ergens een 401 teruggaf.
       Precies dat gebeurde bij /api/aanmeld/start, en het kwam pas aan het
       licht doordat een `await` van zes tekens de 401 van de buurman net
       buiten het venster duwde -- een groene regel die aan een toevallige
       tekstafstand hing. Valse goedkeuring is bij deze regel de gevaarlijke
       richting; een venster dat over de grens kijkt is er een bron van. */
    const ruw = bron.slice(m.index + m[0].length, m.index + m[0].length + VENSTER);
    const volgende = ruw.search(VOLGENDE);
    const staart = volgende > 0 ? ruw.slice(0, volgende) : ruw;
    const knip = staart.search(/=>|function\s*\(/);
    const voor = knip > 0 ? staart.slice(0, knip) : staart.slice(0, 80);
    let soort, gezien = false;
    if ([...voor.matchAll(/([A-Za-z_$][\w$]*)/g)].some(x => poortMw.has(x[1]))) soort = 'poortwachter';
    /* EERST TE SLIM GEWEEST. Hier stond ook een heuristiek op "staat er
       idToken/token/sleutel/code in het lijf" als bewijs van een poort. Dat
       keurde meteen een handvol routes goed die alleen een BEDRIJFSCODE uit
       de body lezen -- en dat is geen geloofsbrief. Valse goedkeuring is de
       gevaarlijke richting bij deze regel: een gemiste melding is stil.
       Routes die hun bewijs echt in het lijf dragen (RTG iD met een idToken)
       staan nu bij naam op de publieke lijst, met die reden erbij. */
    else if (poortBinnen.test(staart)) soort = 'binnen';
    /* EEN KALE 401 OF 403 IS EEN TEKSTAFSTAND EN GEEN POORT. Hij telt hier
       als gesloten, maar hij maakt een uitzondering met een reden niet
       overbodig. /api/auth/login flipte daar drie keer op: zijn 401 schoof
       het venster in of uit zodra de handler korter of langer werd (de laatste
       keer toen de wachtwoordrem naar kern/identiteit/wachtwoordrem.js
       verhuisde, N28), terwijl er niets veranderde aan wie er binnenkomt.
       ./publiek.js zegt daar zelf: de naam blijft staan. De opruimcontrole in
       check.js geldt dus alleen voor een echte poort (een poortwachter of
       poortBinnen). Het oordeel over een GAT verandert daar niet door: een
       kale 401 telde al als gesloten, ook toen hij de uitzondering nog wel
       overbodig maakte. */
    else if (/\b(401|403)\b/.test(staart)) { soort = 'kaal'; gezien = publiek.has(pad); }
    else if (publiek.has(pad)) { soort = 'publiek'; gezien = true; }
    else soort = 'gat';
    uit.push({ methode: m[1].toUpperCase(), pad, soort, gezien });
  }
  return uit;
}

module.exports = { beoordeelBron, VENSTER };
