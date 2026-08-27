/* ============================================================================
   VERMOGENS: VERKLAREN, AFTREKKEN, UITLEGGEN.

   De acht vermogens zelf en hun afhankelijkheden staan in ./vermogenlijst.js --
   inclusief de reden waarom de afhankelijkheidsgraaf is zoals hij is, en welke
   afhankelijkheid de meting eruit heeft geslagen. Dit bestand is de motor
   eromheen: een lijst namen in, een geldige verklaring uit.

   TWEE RICHTINGEN OP DEZELFDE GRAAF, en geen van beide is de omgekeerde van de
   ander. `verklaar` telt op wat een vermogen VEREIST; `zonder` haalt weg wat op
   een weggevallen vermogen LEUNDE. Wie denkt met een van de twee toe te kunnen,
   levert of een koopbaar dat retour belooft zonder ooit bevestigd te zijn, of
   een koopknop boven een artikel waarvan de prijs net wegviel.
   ========================================================================== */
'use strict';

const { VERMOGENS, NIET_GEBOUWD } = require('./vermogenlijst');

const IDS = VERMOGENS.map(v => v.id);
const OP_ID = new Map(VERMOGENS.map(v => [v.id, v]));
const vermogen = (id) => OP_ID.get(String(id == null ? '' : id)) || null;
const isVermogen = (id) => OP_ID.has(String(id == null ? '' : id));

/* De verklaring van EEN koopbaar: welke vermogens, met hun afhankelijkheden
   afgedwongen. Dit is de enige weg waarlangs een lijst vermogens ontstaat -- een
   adapter die zijn eigen lijst samenstelt, kan `retour` afleveren op iets dat
   nooit is bevestigd, en dat is precies de leugen die deze laag hoort te weren.

   ONBEKENDE NAMEN VERDWIJNEN NIET STIL. Ze komen terug in `geweigerd`, met de
   reden erbij: een domein dat `verhuur` aanmeldt hoort te horen dat dat woord
   hier niet bestaat, niet een lijst waar het stilletjes uit is gevallen
   (LAT-regel 5). */
function verklaar(lijst) {
  const gevraagd = [...new Set((Array.isArray(lijst) ? lijst : []).map(x => String(x || '')))];
  const geweigerd = [];
  const heeft = new Set();
  for (const id of gevraagd) {
    if (!isVermogen(id)) {
      geweigerd.push({ vermogen: id, reden: NIET_GEBOUWD[id] || 'Dit vermogen bestaat niet in kern/commerce/vermogens.js.' });
      continue;
    }
    heeft.add(id);
  }
  /* De afhankelijkheden, herhaald tot er niets meer verandert. Eén ronde is niet
     genoeg: `retour` hangt aan `bevestig` en `bevestig` aan `prijs`, dus een
     koopbaar dat alleen `retour` verklaart mist na één ronde nog steeds `prijs`.
     Acht vermogens, dus de lus eindigt gegarandeerd. */
  let veranderd = true;
  const afgeleid = [];
  while (veranderd) {
    veranderd = false;
    for (const id of [...heeft]) {
      for (const nodig of vermogen(id).vereist) {
        if (heeft.has(nodig)) continue;
        heeft.add(nodig); afgeleid.push({ vermogen: nodig, door: id });
        veranderd = true;
      }
    }
  }
  /* `toon` staat er altijd bij, en dat is geen vrijgevigheid: een koopbaar dat
     niet te tonen is, is geen koopbaar maar een rij in een database. Het is ook
     het enige vermogen dat de meting bijna overal vond (79 van 99). */
  if (!heeft.has('toon')) { heeft.add('toon'); afgeleid.push({ vermogen: 'toon', door: 'koopbaar' }); }
  return { heeft: IDS.filter(id => heeft.has(id)), afgeleid, geweigerd };
}

/* DE ANDERE KANT OP, EN HIJ IS NET ZO NODIG. `verklaar` voegt toe wat een
   vermogen VEREIST; dit haalt weg wat op een weggevallen vermogen LEUNDE. Zonder
   dit levert een adapter die `prijs` laat vallen (een artikel zonder bedrag) een
   koopbaar op dat nog steeds `bevestig` verklaart -- en dan staat er een
   koopknop boven een ding dat geen prijs heeft.

   Waarom niet gewoon "verklaar opnieuw met de rest": omdat verklaar de
   afhankelijkheid juist weer zou TOEVOEGEN. Optellen en aftrekken zijn hier twee
   richtingen op dezelfde graaf en geen van beide is de omgekeerde van de ander.

   De weggevallen vermogens komen mét hun aanleiding terug, zodat een scherm kan
   zeggen "geen koopknop want geen prijs" in plaats van alleen de knop weg te
   laten (LAT-regel 5). */
function zonder(lijst, wegLijst) {
  const heeft = new Set((Array.isArray(lijst) ? lijst : []).filter(isVermogen));
  const weg = [];
  const haal = (id, door) => {
    if (!heeft.has(id)) return;
    heeft.delete(id); weg.push({ vermogen: id, door });
    for (const v of VERMOGENS) if (v.vereist.includes(id)) haal(v.id, id);
  };
  for (const id of (Array.isArray(wegLijst) ? wegLijst : [])) haal(String(id || ''), 'aanbieder');
  return { heeft: IDS.filter(id => heeft.has(id)), weg };
}

const kan = (koopbaar, id) => !!(koopbaar && Array.isArray(koopbaar.vermogens) && koopbaar.vermogens.includes(id));

/* Waarom een handeling NIET kan, in de taal van de koper. De afrekening en de
   schermen vragen dit allebei, zodat er nooit twee verschillende zinnen over
   dezelfde weigering bestaan. Geen zin verzinnen voor een onbekend vermogen: dan
   staat er straks een nette uitleg onder een naam die niemand kent. */
function waaromNiet(koopbaar, id) {
  if (kan(koopbaar, id)) return null;
  const v = vermogen(id);
  if (!v) return 'Deze handeling bestaat niet.';
  const titel = (koopbaar && koopbaar.titel) || 'Dit';
  return titel + ' kan niet ' + v.label.toLowerCase().replace(/^(te |kan |is |kost |komt )/, '') +
    '. De aanbieder heeft dat niet ingericht.';
}

module.exports = { VERMOGENS, IDS, NIET_GEBOUWD, vermogen, isVermogen, verklaar, zonder, kan, waaromNiet };
