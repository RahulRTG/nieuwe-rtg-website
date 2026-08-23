/* WAT ELK TOETSBESTAND KOSTTE, OPGESCHREVEN IN PLAATS VAN GERADEN.

   De suite draaide 906 bestanden in alfabetische volgorde met vier tegelijk, en
   niemand wist welke de trage waren. Dat kost op twee manieren:

   1. Wie de suite sneller wil maken, begint met zoeken in plaats van met
      repareren. "welke bestanden zijn traag" was hier een vraag waar je een
      eigen meting voor moest opzetten.
   2. Alfabetisch is de slechtste volgorde die er is. Start een bestand van tien
      minuten als laatste, dan staan drie van de vier werkers die tien minuten
      niets te doen. Longest Processing Time First lost dat op, maar dat kan
      alleen als je de tijden HEBT.

   Dit is een reporter van node --test die niets uitzendt en alleen opschrijft.
   Node geeft per bestand een `test:complete` op nesting 0 waarvan de naam het
   bestand zelf is; dat is de bestandstotaal-gebeurtenis en niet een toets erin.
   Die schrijven we als JSONL naar het pad in RTG_TESTTIJDEN_RUW, zodat meerdere
   node-aanroepen in een ronde (de begrensde batch en elk geisoleerd bestand)
   allemaal in dezelfde stapel landen. scripts/test-runner.js voegt ze daarna
   samen tot .testtijden.json.

   Waarom JSONL en append: twee processen schrijven hier tegelijk in. Een append
   van een korte regel is atomair genoeg op elk systeem waar dit draait; een
   read-modify-write van een JSON-object is dat niet, en dan verlies je stil de
   helft van de metingen -- precies het soort stilte waar LAT-regel 5 over gaat.

   Zonder RTG_TESTTIJDEN_RUW doet hij niets (dan draait iemand node --test met
   de hand), en een schrijffout mag nooit een groene ronde rood maken: meten is
   hier geen bewering over de code. */
'use strict';
const fs = require('fs');
const path = require('path');

module.exports = async function* tijdreporter(bron) {
  const doel = process.env.RTG_TESTTIJDEN_RUW;
  const wortel = path.join(__dirname, '..', '..');
  for await (const e of bron) {
    if (!doel || e.type !== 'test:complete') continue;
    const d = e.data || {};
    if (d.nesting !== 0 || !d.file || !d.name) continue;
    // de bestandstotaal-gebeurtenis: de naam IS het bestand (een toets erin
    // heet anders). Zonder deze vergelijking zou elke losse toets meetellen.
    let zelfdeBestand = false;
    try { zelfdeBestand = path.resolve(process.cwd(), d.name) === path.resolve(d.file); } catch (err) { /* rare naam */ }
    if (!zelfdeBestand) continue;
    const ms = d.details && Number(d.details.duration_ms);
    if (!Number.isFinite(ms)) continue;
    const regel = JSON.stringify({ bestand: path.relative(wortel, d.file), ms: Math.round(ms) }) + '\n';
    try { fs.appendFileSync(doel, regel); } catch (err) { /* meten mag nooit de ronde breken */ }
  }
};
