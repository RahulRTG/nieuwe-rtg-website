/* Horeca (kern): DE TIJDMETINGEN van de dienstmeting.

   WAAROM DIT EEN EIGEN BESTAND IS. ./dienstmeting.js liep over de 10 kB-grens
   van keuringsregel 13. De snede ligt op een familie en niet op een regelnummer:
   hier staan de drie meetpunten die MINUTEN uit tijdstempels rekenen -- tijd tot
   eerste drank, spreiding binnen een gang, en beloofde tegen werkelijke
   gereedtijd. De rest van de meetlat telt dingen of zegt dat er niets te tellen
   valt.

   Die drie horen bij elkaar omdat ze dezelfde valkuil delen: een dienst zonder
   gegevens geeft GEEN nul. Nul complete gangen is niet "spreiding 0" maar "niet
   gemeten" -- een lege avond is geen perfecte avond. Elk van de drie geeft
   daarom een niet-gemeten-regel terug zodra zijn bron leeg is, en nooit een
   getal dat uit het ontbreken van gegevens komt. */
'use strict';

const MIN = 60000;
const minutenTussen = (a, b) => Math.round(Math.abs(Date.parse(a) - Date.parse(b)) / MIN);
const DRANK = ['bar', 'koffie'];

const gemeten = (naam, waarde, eenheid, rekensom) => ({ naam, soort: 'gemeten', waarde, eenheid, rekensom });
const nietGemeten = (naam, waarom) => ({ naam, soort: 'niet-gemeten', waarde: null, eenheid: null, rekensom: waarom });
const gemiddeld = (lijst) => Math.round(lijst.reduce((n, x) => n + x, 0) / lijst.length);

/* Van het openen van de rekening tot het moment dat het eerste glas de deur uit
   ging. Alleen tafels waar werkelijk een drank is uitgegeven tellen mee. */
function eersteDrank(reks, naam) {
    const drankTijden = [];
    for (const r of reks) {
      const start = r.geopendAt || r.at;
      if (!start) continue;
      const glazen = (r.regels || [])
        .filter((x) => DRANK.includes(String(x.station || '').toLowerCase()) && x.uitAt)
        .map((x) => x.uitAt).sort();
      if (glazen.length) drankTijden.push(minutenTussen(start, glazen[0]));
    }
  return drankTijden.length
    ? gemeten(naam, gemiddeld(drankTijden), 'minuten',
        'Gemiddelde over ' + drankTijden.length + ' tafel(s) waar een drank is uitgegeven: van het ' +
        'openen van de rekening tot het eerste glas op tafel.')
    : nietGemeten(naam, 'Er ging vandaag geen enkel glas de deur uit; een lege avond is geen snelle avond.');
}


/* Hoe lang stond het eerste bord te wachten op het laatste. Alleen over gangen
   die COMPLEET klaar zijn gemeld -- een halve gang spreidt niet, die loopt nog. */
function spreiding(reks, naam) {
    const spreidingen = [];
    for (const r of reks) {
      const perGang = new Map();
      for (const x of (r.regels || [])) {
        if (!x.klaarAt) continue;
        const k = String(x.gang || 0);
        if (!perGang.has(k)) perGang.set(k, []);
        perGang.get(k).push(x);
      }
      for (const [k, lijst] of perGang) {
        const alle = (r.regels || []).filter((x) => String(x.gang || 0) === k && x.vrijAt);
        if (!alle.length || lijst.length !== alle.length) continue;   // gang niet compleet
        if (lijst.length < 2) continue;                               // een bord spreidt niet
        const tijden = lijst.map((x) => Date.parse(x.klaarAt)).sort((a, b) => a - b);
        spreidingen.push(Math.round((tijden[tijden.length - 1] - tijden[0]) / MIN));
      }
    }
  return spreidingen.length
    ? gemeten(naam, gemiddeld(spreidingen), 'minuten',
        'Gemiddelde over ' + spreidingen.length + ' complete gang(en) met meer dan één bord: het laatste ' +
        'bord klaar min het eerste.')
    : nietGemeten(naam,
      'Geen enkele gang met meer dan één bord is vandaag compleet klaar gemeld. Nul gangen is geen spreiding van nul.');
}


/* De afgesproken serveertijd tegen het moment waarop de gang compleet klaar
   stond. Alleen waar de zaal een tijd MEEGAF: zonder belofte valt er niets te
   vergelijken, en een belofte verzinnen om toch een getal te hebben is precies
   wat grens 7 verbiedt. */
function belofte(reks, naam) {
    const afwijkingen = [];
    for (const r of reks) {
      const perGang = new Map();
      for (const x of (r.regels || [])) {
        if (!x.serveerOm || !x.klaarAt) continue;
        const k = String(x.gang || 0);
        if (!perGang.has(k)) perGang.set(k, { om: x.serveerOm, klaar: [] });
        perGang.get(k).klaar.push(Date.parse(x.klaarAt));
      }
      for (const [, g] of perGang) {
        const m = /^([0-2]?\d):([0-5]\d)$/.exec(g.om);
        if (!m) continue;
        const laatste = new Date(Math.max(...g.klaar));
        /* DE BELOFTE IS EEN KLOKTIJD, EN EEN DIENST LOOPT OVER MIDDERNACHT HEEN.

           Hier stond alleen `doel.setHours(...)`, en dat zet de afgesproken tijd
           altijd op de dag waarop de gang klaar was. Voor een gewone avond klopt
           dat. Maar een zaal die om 23:50 een gang voor "00:20" belooft, krijgt
           een doel van 00:20 diezelfde ochtend -- ruim drieentwintig uur eerder,
           en dus een afwijking van ~1415 minuten op een gang die keurig op tijd
           stond.

           Dat is geen randgeval: elke zaak die na middernacht doorserveert kreeg
           dit cijfer. En het is precies wat HORECA.md verbiedt -- een getal op
           een scherm dat niet meet wat het beweert te meten.

           De reparatie kiest de dag waarop de belofte het DICHTST bij het
           werkelijke moment ligt. Een afspraak ligt hoogstens uren van de
           uitvoering; ligt hij meer dan twaalf uur weg, dan is het de andere
           dag. Twaalf uur is de enige drempel die geen keuze is: verder dan dat
           is de andere kant altijd dichterbij.

           Gevonden doordat de volle suite om 23:50 over middernacht heen liep en
           test/horeca-dienstmeting.test.js zakte met "de gang stond een halfuur
           te vroeg klaar: 1411". De toets had gelijk; de meting niet. */
        const doel = new Date(laatste);
        doel.setHours(Number(m[1]), Number(m[2]), 0, 0);
        const HALVE_DAG = 12 * 60 * MIN;
        if (doel.getTime() - laatste.getTime() > HALVE_DAG) doel.setDate(doel.getDate() - 1);
        else if (laatste.getTime() - doel.getTime() > HALVE_DAG) doel.setDate(doel.getDate() + 1);
        afwijkingen.push(Math.round((laatste.getTime() - doel.getTime()) / MIN));
      }
    }
  return afwijkingen.length
    ? gemeten(naam, gemiddeld(afwijkingen.map(Math.abs)), 'minuten',
        'Gemiddelde afwijking over ' + afwijkingen.length + ' gang(en) waar de zaal een serveertijd meegaf: ' +
        'het moment waarop de gang compleet klaar stond, tegen die afgesproken tijd.')
    : nietGemeten(naam,
      'De zaal gaf vandaag bij geen enkele gang een serveertijd mee; zonder belofte valt er niets te vergelijken.');
}

module.exports = { eersteDrank, spreiding, belofte };
