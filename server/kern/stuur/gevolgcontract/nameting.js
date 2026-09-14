/* DE NAMETING -- wat is er WERKELIJK gebeurd, tegen wat we voorspelden.

   ./vergelijk.js houdt een VOORUITBLIK tegen een CONTRACT, vóór de handeling. Dit doet
   het andere eind: het houdt de VOORSPELDE klassen tegen de WAARGENOMEN klassen uit
   server/effectbon.js, ná de handeling. Twee vergelijkingen op twee momenten, en met
   opzet in twee bestanden -- wie ze samenvoegt, kan niet meer zien of een bevinding over
   een verwachting of over een feit gaat.

   DE VIER UITKOMSTEN, EN DE VIERDE IS DE ENIGE DIE ECHT MOET:

     VOORSPELD_EN_GEZIEN     de klasse was voorspeld en is waargenomen.
     VOORSPELD_NIET_GEZIEN   voorspeld, niet waargenomen, EN de meter had dekking op het
                             choke point waar die klasse langs moet. Dit is het echte
                             signaal: of de voorspelling klopt niet, of het effect bleef
                             uit. Beide zijn interessant en geen van beide is ruis.
     GEZIEN_NIET_VOORSPELD   waargenomen en door niemand voorspeld: een onverklaarde
                             bijwerking. Dit is wat een effectcontract hoort te vinden.
     NIET_MEETBAAR           voorspeld, niet waargenomen, en de meter KON het niet zien.

   ZONDER DIE VIERDE VERANDERT "GEEN OBSERVATIE" STILLETJES IN "GEEN EFFECT", en dan is
   deze hele laag een machine die zichzelf gerust stelt. Vandaar dat de dekking van de bon
   hier wordt GELEZEN en niet aangenomen:

     UITGAANDE_AANROEP   valt in `NIET_GEMETEN` van de effectmeter (externe-aanroep): er
                         is geen choke point, dus hierover is nooit iets vast te stellen.
                         Altijd NIET_MEETBAAR zolang die blinde zone bestaat.
     schreefOpslag=false een klasse die via de opslag moet komen, is dan ECHT niet
                         gebeurd: het choke point stond aan en telde nul. Dat is het
                         relevante signaal uit de eerste bullet.
     schreefOpslag=true  er is geschreven, maar niet in een ingedeelde collectie. In de
                         ondiepe stand is een wijziging op zijn plaats onzichtbaar, dus
                         "niet gezien" zegt hier niets -> NIET_MEETBAAR, tenzij de bon
                         DIEP is (RTG_STAATLOG=2); dan is de dekking er wel en wordt het
                         alsnog een signaal.

   EN ZIJ BESLIST NIETS. Net als ./vergelijk.js geeft zij een uitslag met een reden; of er
   iets van komt (een melding, een geblokkeerde autonomie, een zaak) staat bij de
   aanroeper. Een nameting die zelf weigert, weigert na de handeling -- dat is geen poort
   maar een verrassing. */
'use strict';

const { werkwoorden } = require('./woorden');

const UITKOMSTEN = Object.freeze(['VOORSPELD_EN_GEZIEN', 'VOORSPELD_NIET_GEZIEN',
  'GEZIEN_NIET_VOORSPELD', 'NIET_MEETBAAR']);

/* Welke klasse via welke weg wordt waargenomen. Alleen deze twee wegen bestaan; wat er
   niet in staat, komt langs geen enkel choke point en is dus per definitie niet meetbaar.
   Dat is een uitspraak over de METER en niet over de handeling. */
const WEG = Object.freeze({
  UITGAANDE_AANROEP: 'geen',          // NIET_GEMETEN: externe-aanroep
  DERDENCODE_UITVOEREN: 'geen',       // draait in de cel; geen teller
  ONVERTROUWDE_BYTES: 'geen',         // NIET_GEMETEN: bestand
  BULK_UITVOER: 'geen',               // een uitdraai verlaat het huis buiten de opslag om
  EXTERN_BEREIKEN: 'bericht'          // mail en sms zijn choke points
  /* al het andere: 'opslag' -- zie wegVan() */
});
const wegVan = (klasse) => WEG[klasse] || 'opslag';

function nameet(voorspeld, bon) {
  const b = bon || {};
  const dekking = b.dekking || {};
  const gezien = new Set(Array.isArray(b.klassen) ? b.klassen : []);
  const wil = [...new Set((Array.isArray(voorspeld) ? voorspeld : [])
    .filter(w => werkwoorden().includes(w)))].sort();

  const rijen = [];
  for (const k of wil) {
    if (gezien.has(k)) { rijen.push({ klasse: k, uitkomst: 'VOORSPELD_EN_GEZIEN', weg: wegVan(k) }); continue; }
    const weg = wegVan(k);
    if (weg === 'geen') {
      rijen.push({ klasse: k, uitkomst: 'NIET_MEETBAAR', weg,
        reden: k + ' komt langs geen enkel choke point (blinde zone: ' +
          (dekking.blind || []).join(', ') + '); hierover is niets vast te stellen' });
      continue;
    }
    if (weg === 'opslag' && dekking.schreefOpslag === true && dekking.diep !== true) {
      rijen.push({ klasse: k, uitkomst: 'NIET_MEETBAAR', weg,
        reden: 'er is geschreven maar niet in een ingedeelde collectie, en in de ondiepe stand ' +
          'is een wijziging op zijn plaats onzichtbaar -- "niet gezien" zegt hier niets' });
      continue;
    }
    rijen.push({ klasse: k, uitkomst: 'VOORSPELD_NIET_GEZIEN', weg,
      reden: weg === 'opslag'
        ? 'het opslag-choke point stond aan en telde ' + (dekking.schreefOpslag ? 'wel een schrijfactie maar geen ingedeelde collectie' : 'nul') +
          ': of de voorspelling klopt niet, of het effect bleef uit'
        : 'het bericht-choke point stond aan en zag niets' });
  }
  for (const k of [...gezien].sort())
    if (!wil.includes(k))
      rijen.push({ klasse: k, uitkomst: 'GEZIEN_NIET_VOORSPELD', weg: wegVan(k),
        reden: 'waargenomen en door niemand voorspeld: een onverklaarde bijwerking' });

  const tel = { VOORSPELD_EN_GEZIEN: 0, VOORSPELD_NIET_GEZIEN: 0, GEZIEN_NIET_VOORSPELD: 0, NIET_MEETBAAR: 0 };
  for (const r of rijen) tel[r.uitkomst]++;
  return {
    verzoek: b.verzoek || null, capability: b.capability || null,
    rijen, telling: tel,
    /* GEEN SAMENGESTELD CIJFER. Een "voorspellingsscore" van 3 op 4 zou de vierde
       uitkomst wegmiddelen, en die vierde is precies waarom deze laag bestaat
       (BEWIJSMACHINE.md verbiedt zo'n cijfer boven een scorecard). */
    reden: rijen.length
      ? rijen.map(r => r.uitkomst + ':' + r.klasse).join('; ')
      : 'er was niets voorspeld en niets waargenomen'
  };
}

module.exports = { nameet, UITKOMSTEN, WEG, wegVan };
