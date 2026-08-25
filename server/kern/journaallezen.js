/* Het journaal TERUGLEZEN -- apart van het schrijven, want het zijn twee zaken:
   schrijven gebeurt op het verzoekpad, lezen alleen als iemand het scherm opent.
   (En omdat ./journaalbestand.js anders tegen de omvangsgrens van de keuring
   aan groeit.)

   Een regel die niet te lezen is -- een halve schrijfactie na een stroomstoring,
   of een sleutel die niet past -- wordt OVERGESLAGEN en geteld, niet gegooid.
   Zou het lezen daarop gooien, dan is het hele journaal onleesbaar op precies
   het moment dat je het nodig hebt. */
'use strict';
const fs = require('fs');
const kluis = require('../kluis');

function maakLezer({ pad, huidig, oudeBestanden, stapel, klok, telOvergeslagen }) {
  /* Regels uit één bestand. Een regel die niet te lezen is (halve schrijfactie
   bij stroomuitval, of een sleutel die niet past) wordt overgeslagen en
   geteld -- niet gegooid. */
function uitBestand(naam) {
  let tekst;
  try { tekst = fs.readFileSync(pad(naam), 'utf8'); } catch (e) { return []; }
  const uit = [];
  for (const regel of tekst.split('\n')) {
    if (!regel) continue;
    try { uit.push(JSON.parse(kluis.ontsleutel(regel))); }
    catch (e) { telOvergeslagen(); }
  }
  return uit;
}

/* De laatste `max` regels, oudste eerst -- dezelfde volgorde als de array die
   hier vroeger stond, zodat het leespad erboven niet hoeft te weten dat dit
   veranderd is. Er wordt van nieuw naar oud gelezen en gestopt zodra er
   genoeg is, dus een vol journaal kost niet meer dan een leeg. */
function lees(max) {
  const grens = Math.max(1, Number(max) || 1000);
  let uit = stapel().slice();                       // wat nog niet gespoeld is
  if (uit.length < grens) {
    const bestanden = [huidig].concat(oudeBestanden());
    for (const n of bestanden) {
      uit = uitBestand(n).concat(uit);
      if (uit.length >= grens) break;
    }
  }
  return uit.slice(-grens);
}

/* Hoeveel regels staan er? Nieuwe regels tellen kost een leesronde, dus het
   antwoord wordt kort vastgehouden: dit voedt een scherm, geen beslissing. */
let telWaarde = null, telTijd = 0;
function aantal() {
  if (telWaarde !== null && klok() - telTijd < 10000) return telWaarde + stapel.length;
  let n = 0;
  for (const naam of [huidig].concat(oudeBestanden())) {
    try {
      const t = fs.readFileSync(pad(naam), 'utf8');
      for (let i = 0; i < t.length; i++) if (t.charCodeAt(i) === 10) n++;
    } catch (e) { /* weg is nul */ }
  }
  telWaarde = n; telTijd = klok();
  return n + stapel().length;
}

  return { lees, aantal };
}

module.exports = { maakLezer };
