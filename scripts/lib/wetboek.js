/* ============================================================================
   HET WETBOEK -- de gedeelde lezer van WETTEN.json.

   Drie scripts kijken naar dezelfde lijst: `npm run wetten` (de stand),
   `npm run sabotage` (de proef) en `npm run zekerheid` (wat we weten en niet
   weten). Zouden ze elk hun eigen lezer hebben, dan lopen die binnen een maand
   uiteen -- dat is LAT.md regel 4, en dit huis heeft die fout al drie keer
   gemaakt. Dus: een lezer, een vormcontrole, een stel standen.

   WAT HIER GEEN OORDEEL IN ZIT. Deze module leest en controleert de VORM. Of
   een wet ook echt wordt gehandhaafd, weet alleen scripts/sabotage.js, want dat
   is de enige die het probeert. Wie hier een tweede oordeel inbouwt, bouwt een
   meter die nooit heeft uitgeslagen.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const WORTEL = path.join(__dirname, '..', '..');
const WETBOEK_PAD = path.join(WORTEL, 'WETTEN.json');
const UITSLAG_PAD = path.join(WORTEL, 'SABOTAGE.json');

/* DE VIER UITKOMSTEN VAN EEN PROEF, en het zijn er vier en geen twee.

   LAT.md regel 2 schrijft ze voor: RAAK, AFGESLAGEN, GELUKT, NIET GEPROBEERD.
   Hier heten ze naar wat ze over een WET zeggen, en er is er een bijgekomen die
   in de praktijk de gevaarlijkste bleek:

     raak            de sabotage is aangebracht en de genoemde wachter werd
                     rood. Dit is het enige bewijs dat telt.
     afgeslagen      de sabotage is aangebracht en de wachter bleef groen. De
                     wet staat wel opgeschreven, maar niets houdt hem tegen.
                     Dit is een bevinding, geen storing.
     blind           de wachter was AL rood voordat er iets gesaboteerd werd.
                     Dan bewijst zijn rood niets -- niet over deze wet en niet
                     over iets anders. Zonder deze stand zou elke kapotte toets
                     als bewijs meetellen, en dat is precies hoe een meter gaat
                     liegen (LAT.md regel 10).
     losgeraakt      het aanknopingspunt van de sabotage staat niet meer in de
                     code, of staat er meer dan een keer. Het recept wijst dan
                     naar iets dat er niet is; dat is geen groen en geen rood
                     maar een kapot recept, en het hoort luid te zijn.
     nietGeprobeerd  overgeslagen (--snel, een filter, of afgebroken).
     mensenwerk      deze wet heeft met opzet geen machinale handhaver. Staat
                     met een reden in het wetboek en wordt nooit als bewezen
                     geteld. */
const STANDEN = ['raak', 'afgeslagen', 'blind', 'losgeraakt', 'nietGeprobeerd', 'mensenwerk'];

/* HET RECEPT KRIJGT EEN VINGERAFDRUK, en die is er om een stille leugen te
   voorkomen.

   Zonder deze afdruk gebeurt het volgende: iemand verandert het recept (ander
   bestand, andere zoektekst, andere wachter), SABOTAGE.json blijft staan met
   de oude uitslag "raak", en `npm run wetten` meldt vrolijk dat de wet bewezen
   is -- op grond van een proef die nooit voor dit recept is gedraaid. Met de
   afdruk erbij heet dat wat het is: verlopen, opnieuw meten.

   De TEKST van de wet zit er bewust ook in. Wie de wet herformuleert tot iets
   anders dan wat er bewezen is, hoort zijn bewijs kwijt te raken. */
function receptAfdruk(wet) {
  const s = wet.sabotage
    ? JSON.stringify([wet.wet, wet.sabotage.bestand, wet.sabotage.zoek, wet.sabotage.zet, wet.sabotage.wachters])
    : JSON.stringify([wet.wet, 'mensenwerk', wet.mensenwerk]);
  return crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
}

/* Een wachter is een tekenreeks met een soort ervoor, zodat sabotage.js weet
   hoe hij hem moet draaien EN hoe hij de uitslag moet lezen:

     test:test/x.test.js   node --test op dat bestand; rood = exitcode != 0
     check:23              node scripts/check.js; rood = er staat een kruis
                           onder de kop die met "23)" begint. Niet "de hele
                           keuring zakt", want dan telt elke andere regel mee
                           als bewijs voor deze wet.
     e2e:test/x.e2e.js     zelfde als test:, maar heeft een browser nodig; zonder
                           browser is de uitkomst `blind` en niet groen.
     script:node ...       een los script; rood = exitcode != 0. Voor wetten die
                           door gereedschap worden bewaakt en niet door een toets. */
function ontleedWachter(w) {
  const i = String(w).indexOf(':');
  if (i < 0) return null;
  const soort = w.slice(0, i), doel = w.slice(i + 1);
  if (!['test', 'e2e', 'check', 'script'].includes(soort) || !doel) return null;
  /* De sleutel is waarop de nulmeting wordt hergebruikt. Alle check-wachters
     delen er een, want het is een keuring: hem elf keer draaien voor elf wetten
     kost elf keer bijna twee minuten en levert elf keer hetzelfde antwoord. */
  return { soort, doel, sleutel: soort === 'check' ? 'check' : soort + ':' + doel };
}

/* De vormcontrole. Geen smaak, alleen of het gelezen kan worden -- want een
   wetboek dat half klopt, geeft een halve stand en die leest als een hele. */
function keurVorm(boek) {
  const fouten = [];
  if (!boek || !Array.isArray(boek.wetten)) return ['WETTEN.json heeft geen lijst `wetten`'];
  const gezien = new Set();
  for (const [i, w] of boek.wetten.entries()) {
    const waar = 'wet ' + (i + 1) + ' (' + (w.id || 'zonder id') + ')';
    if (!w.id || !/^[a-z0-9-]+$/.test(w.id)) fouten.push(waar + ': id ontbreekt of is geen kleine-letters-naam');
    else if (gezien.has(w.id)) fouten.push(waar + ': dit id staat er twee keer in');
    else gezien.add(w.id);
    if (!w.wet || w.wet.length < 15) fouten.push(waar + ': de wet zelf staat er niet, of is te kort om iets te betekenen');
    if (!w.bron || !w.bron.bestand || !w.bron.anker) fouten.push(waar + ': geen bron met bestand + anker');
    if (!Array.isArray(w.handhaver)) fouten.push(waar + ': `handhaver` hoort een lijst te zijn (leeg mag, dan is het mensenwerk)');
    if (w.sabotage && w.mensenwerk) fouten.push(waar + ': een wet is machinaal gehandhaafd OF mensenwerk, niet allebei');
    if (!w.sabotage && !w.mensenwerk) fouten.push(waar + ': zonder sabotage-recept hoort er een reden te staan waarom het mensenwerk is');
    if (w.sabotage) {
      const s = w.sabotage;
      if (!s.bestand || !s.zoek || typeof s.zet !== 'string') fouten.push(waar + ': het recept mist bestand, zoek of zet');
      if (s.zoek === s.zet) fouten.push(waar + ': zoek en zet zijn gelijk -- dan verandert er niets en bewijst de proef niets');
      if (!Array.isArray(s.wachters) || !s.wachters.length) fouten.push(waar + ': het recept noemt geen wachter die rood moet worden');
      else for (const wa of s.wachters) if (!ontleedWachter(wa)) fouten.push(waar + ': onleesbare wachter "' + wa + '"');
      if (!s.wat) fouten.push(waar + ': het recept zegt niet in gewone woorden WAT er wordt uitgezet');
    }
  }
  return fouten;
}

function lees() {
  const ruw = fs.readFileSync(WETBOEK_PAD, 'utf8');
  const boek = JSON.parse(ruw);
  const vormfouten = keurVorm(boek);
  for (const w of boek.wetten || []) w.afdruk = receptAfdruk(w);
  return { boek, vormfouten };
}

/* De laatst gemeten uitslag. Ontbreekt hij, dan is dat GEEN nul en geen groen:
   dan is er niets gemeten, en dat woord staat er ook (LAT.md regel 3). */
function leesUitslag() {
  try { return JSON.parse(fs.readFileSync(UITSLAG_PAD, 'utf8')); }
  catch (e) { return null; }
}

/* DE STAND VAN EEN WET, op EEN plek uitgerekend.

   wetten.js toont hem, zekerheid.js telt hem en test/wetten.test.js ijkt hem.
   Zouden die drie elk hun eigen redenering hebben, dan is "bewezen" drie
   verschillende dingen en zegt het getal niets. */
function standVan(wet, uitslag) {
  if (wet.mensenwerk) return { stand: 'mensenwerk', reden: wet.mensenwerk };
  if (!uitslag || !uitslag.wetten) return { stand: 'nietGemeten', reden: 'SABOTAGE.json bestaat niet -- er is nooit iets geprobeerd' };
  const u = uitslag.wetten[wet.id];
  if (!u) return { stand: 'nietGemeten', reden: 'deze wet staat niet in de laatste sabotageronde' };
  if (u.afdruk !== wet.afdruk) return { stand: 'verlopen', reden: 'het recept of de wettekst is veranderd sinds de meting', was: u.stand };
  return { stand: u.stand, reden: u.reden || '', wachter: u.wachter, duurMs: u.duurMs };
}

/* Het getal dat als meter in NORM.json staat: hoeveel wetten NIET bewezen zijn.
   Alles wat niet `raak` is telt mee -- ook mensenwerk, ook niet gemeten. Dat is
   met opzet streng: de meter heet "onbewezen" en niet "kapot", en een wet die
   niemand ooit heeft geprobeerd is precies zo onbewezen als een wet waarvan de
   proef werd afgeslagen.

   DE NAAM van de meter staat NIET hier maar in scripts/wetten.js, en dat is geen
   slordigheid. Keuringsregel 35 zoekt meters die in een eigen script wonen op de
   vorm `const METER = '...'` in scripts/*.js -- niet in scripts/lib/. Stond de
   naam hier, dan ontsnapte deze meter aan de ijkplicht, en dat is precies het
   gat waar de zeven liegende meters ooit doorheen zijn gekomen. */
function onbewezen(boek, uitslag) {
  return (boek.wetten || []).filter(w => standVan(w, uitslag).stand !== 'raak').length;
}

module.exports = { WORTEL, WETBOEK_PAD, UITSLAG_PAD, STANDEN,
  lees, leesUitslag, standVan, onbewezen, ontleedWachter, receptAfdruk, keurVorm };
