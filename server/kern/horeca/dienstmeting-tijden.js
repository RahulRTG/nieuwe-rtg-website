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
/* EEN BELOFTE DRAAGT EEN KLOK EN GEEN DATUM, en die lezing hoort op een
   plek te staan. Deze meting had er een eigen: zij plakte de afgesproken
   tijd op de dag waarop de gang klaar stond. Rond middernacht is dat mis --
   een gang die om 23:35 wordt beloofd voor 00:05 kwam er als 1411 minuten
   te vroeg uit, en juist de late uren zijn de drukke uren van een keuken.
   De cadanslaag wist dit allang (klokTijdNaarMs rolt door naar de volgende
   dag als de tijd ver voor het anker ligt); die lezing wordt hier nu
   gedeeld in plaats van nagemaakt. Het anker is het moment waarop de zaal
   de gang vrijgaf, want dat is het moment waarop de belofte is gedaan. */
const { klokTijdNaarMs } = require('./cadans-doel');
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
        if (!perGang.has(k)) perGang.set(k, { om: x.serveerOm, vrij: [], klaar: [] });
        const v = Date.parse(x.vrijAt || '');
        if (!isNaN(v)) perGang.get(k).vrij.push(v);
        perGang.get(k).klaar.push(Date.parse(x.klaarAt));
      }
      for (const [, g] of perGang) {
        const laatste = Math.max(...g.klaar);
        const anker = g.vrij.length ? Math.min(...g.vrij) : laatste;
        const doel = klokTijdNaarMs(g.om, anker);
        if (doel === null) continue;
        afwijkingen.push(Math.round((laatste - doel) / MIN));
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
