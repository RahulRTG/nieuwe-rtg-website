/* ============================================================================
   DE PERSOONLIJKE STAND -- en waarom er geen groen vinkje in staat.

   Een gewone statuspagina zegt "Payments: degraded performance". Dat is voor
   bijna iedereen die hem leest onwaar in beide richtingen: wie er geen last van
   heeft schrikt, en wie er wel last van heeft ziet niet dat het over hem gaat.

   Deze module beantwoordt daarom een kleinere en eerlijkere vraag: RAAKT ER OP
   DIT MOMENT EEN BEKENDE STORING EEN VAN UW LOPENDE ZAKEN?

   WAT HIER MET OPZET NIET STAAT: "RTG werkt normaal voor u". Dat zou een
   BEWERING zijn over beschikbaarheid, en die wordt hier niet gemeten -- er is
   geen meting per lid en er is geen beschikbaarheidscijfer (BESTUUR.md: elke
   bewering draagt een bewijsgraad, en `niet vast te stellen` is een eersteklas
   uitslag naast in orde en storing). Het antwoord bij geen treffer is dus
   "wij zien niets dat uw zaken raakt", en dat is iets anders dan "alles werkt".

   EN HET LEEST TWEE BRONNEN DIE NIET HETZELFDE ZIJN. Of een storing bestaat en
   verholpen is, weet RTG Command; wat Service aan de melders heeft VERTELD staat
   in ./patroon.js. Deze module toont het tweede en doet niet alsof het het
   eerste is -- een lid dat hier "verholpen" leest, leest dat wij dat gemeld
   hebben, en niet dat een meter het bevestigt.
   ========================================================================== */
'use strict';

const { STANDEN } = require('./klassen');

module.exports = function maakPersoonlijk({ zaken, patronen }) {
  function stand(melder) {
    const mijn = zaken.bak().filter(z => z.melder === String(melder || '') && !(STANDEN[z.stand] || {}).eind);

    const raakt = [];
    for (const z of mijn) {
      for (const k of z.koppelingen) {
        if (k.soort !== 'incident') continue;
        const gemeld = patronen.gemeldHersteld(k.code);
        raakt.push({
          zaak: z.id, titel: z.titel, incident: k.code,
          /* Drie standen en geen twee. `onbekend` bestaat omdat Service alleen
             weet wat zij zelf heeft gemeld; dat is niet hetzelfde als "loopt nog". */
          wij: gemeld ? 'gemeld-hersteld' : 'onbekend',
          gemeldAt: gemeld ? gemeld.at : null,
          zin: gemeld
            ? 'Wij hebben gemeld dat storing ' + k.code + ' is verholpen. Werkt het bij u nog niet, ' +
              'laat het weten in zaak ' + z.id + '.'
            : 'Uw zaak ' + z.id + ' is gekoppeld aan storing ' + k.code + '. U hoeft niets te doen; ' +
              'u hoort van ons zodra hij verholpen is.'
        });
      }
    }

    return {
      ok: true,
      zaken: mijn.length,
      raakt,
      /* De kop die het lid leest. Geen groen, geen percentage, geen geruststelling
         die niet gemeten is. */
      kop: raakt.length
        ? 'Er speelt een storing die uw melding raakt.'
        : 'Wij zien op dit moment geen storing die uw zaken raakt.',
      let: raakt.length
        ? null
        : 'Dit gaat over uw eigen zaken en is geen uitspraak over het hele platform: RTG meet ' +
          'beschikbaarheid niet per lid, dus "er is niets bekend" is iets anders dan "alles werkt".'
    };
  }

  return { stand };
};
