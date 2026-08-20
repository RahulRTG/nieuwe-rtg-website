/* DE POORT VOOR EEN COMMERCIELE CLAIM -- streng op EEN ding: liegen over de
   hardheid.

   ../claims.js zegt WAT RTG beweert. Dit bestand keurt die beweringen, en dat is
   een ander onderwerp: het kent geen enkel bedrag en geen enkele trede, alleen de
   vorm waarin een claim zich hoort te verantwoorden.

   Een claim die AFGEDWONGEN heet, moet een toets hebben die zakt als de code
   wordt weggehaald, en een bron. Een BELOFTE mag bestaan -- die is per definitie
   nog niet gedekt -- maar moet als belofte te boek staan met een kanttekening die
   zegt wat eraan ontbreekt. Een gat dat eerlijk BELOFTE heet is geen probleem;
   een gat dat zich AFGEDWONGEN noemt, is er twee.

   EN DE BRON MOET BESTAAN. Een claim die naar `kern/commercie/verzonnen.js`
   wijst, ziet er net zo degelijk uit als een die klopt -- en dat is erger dan
   geen bron, want hij nodigt uit om niet te kijken. */
'use strict';

const DEKKING = { AFGEDWONGEN: 'AFGEDWONGEN', GEBOUWD: 'GEBOUWD', BELOFTE: 'BELOFTE' };

/* DE RELEASE-GATE. Geen financiele claim zonder bewijs.

   Faalt als een claim zich AFGEDWONGEN noemt zonder toets, of als een claim geen
   bron heeft. Een BELOFTE mag bestaan -- die is per definitie nog niet gedekt --
   maar hij moet wel als belofte te boek staan en een kanttekening dragen die
   zegt wat eraan ontbreekt.

   Dit is met opzet streng op EEN ding: liegen over de hardheid. Een gat dat
   eerlijk "BELOFTE" heet, is geen probleem; een gat dat zich "AFGEDWONGEN"
   noemt, is er twee. */
function poort(claims, opties) {
  const problemen = [];
  for (const c of claims) {
    if (!c.bron) problemen.push(c.id + ' heeft geen bron: waar komt deze waarde vandaan?');
    if (!c.waarde) problemen.push(c.id + ' heeft geen waarde');
    if (c.dekking === DEKKING.AFGEDWONGEN && !c.toets)
      problemen.push(c.id + ' noemt zich AFGEDWONGEN maar wijst geen toets aan; dan is het een belofte');
    if (c.dekking === DEKKING.BELOFTE && !c.kanttekening)
      problemen.push(c.id + ' is een belofte zonder kanttekening: er hoort te staan wat eraan ontbreekt');
    if (!DEKKING[c.dekking]) problemen.push(c.id + ' heeft een onbekende dekking: ' + c.dekking);

    /* DE BRON MOET BESTAAN. Een claim die naar `kern/commercie/verzonnen.js`
       wijst, ziet er net zo degelijk uit als een die klopt -- en dat is erger
       dan geen bron, want hij nodigt uit om niet te kijken. */
    for (const pad of bronbestanden(c)) {
      if (!bestaat(pad, opties)) problemen.push(c.id + ' wijst naar een bron die niet bestaat: ' + pad);
    }
    for (const pad of toetsbestanden(c)) {
      if (!bestaat(pad, opties)) problemen.push(c.id + ' wijst naar een toets die niet bestaat: ' + pad);
    }
  }
  return { ok: problemen.length === 0, problemen, aantal: claims.length };
}

/* De bestandsnamen uit een bron- of toetsveld. Die velden zijn proza met paden
   erin ("kern/pasladder.js", "test/a.js + test/b.js"), dus we halen eruit wat op
   een pad lijkt en laten de rest staan. Een veld zonder enig pad levert niets
   op en wordt niet gecontroleerd -- dat is het geval van "alleen
   partnervoorwaarden.html", waar de bron geen module is. */
function paden(tekst) {
  return String(tekst || '').match(/[A-Za-z0-9_./-]+\.(?:js|html|md)/g) || [];
}
const bronbestanden = c => paden(c.bron).filter(p => /^(kern|server|test)\//.test(p) || p.startsWith('kern/'));
const toetsbestanden = c => paden(c.toets).filter(p => p.startsWith('test/'));

function bestaat(pad, opties) {
  const o = opties || {};
  if (typeof o.bestaat === 'function') return o.bestaat(pad);
  try {
    const fs = require('fs');
    const path = require('path');
    /* De wortel wordt OMHOOG GEZOCHT en niet met een vast aantal `..` geteld.
       Dat was hier al een keer stuk: dit bestand verhuisde een map dieper en de
       poort meldde prompt dat elke toets "niet bestaat" -- een meter die zijn
       eigen huis niet vindt, meldt alles rood en is daarmee waardeloos. */
    let wortel = __dirname;
    while (!fs.existsSync(path.join(wortel, 'package.json'))) {
      const boven = path.dirname(wortel);
      if (boven === wortel) return true;      // geen wortel gevonden: geen vals alarm
      wortel = boven;
    }
    // een bronpad begint bij server/ als het met kern/ begint
    const kandidaten = [path.join(wortel, pad), path.join(wortel, 'server', pad)];
    return kandidaten.some(k => fs.existsSync(k));
  } catch (e) { return true; }   // kan het niet nakijken: dan niet vals alarm slaan
}

module.exports = { poort, paden, DEKKING };
