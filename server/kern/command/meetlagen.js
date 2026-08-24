/* DE MEETKANT VAN COMMAND -- de sonde, de servicedoelen, het alarm, de
   gezondheidskaart en het incident, aan elkaar in de enige volgorde waarin ze
   kunnen staan.

   Ze stonden in ./index.js en zijn eruit gehaald toen de gezondheidskaart erbij
   kwam en dat bestand door de omvangsband ging. De naad lag er al: dit zijn de
   vier lagen die METEN EN OORDELEN, en de ruggengraat (register, journaal,
   beleid, risico, recepten, operator, puls) heeft geen van vieren nodig.

   DE VOLGORDE IS EEN AFHANKELIJKHEID EN GEEN SMAAK:

     sonde       klopt van buitenaf aan en legt de monsters vast
     slo         rekent het foutbudget, en zet de sonde bij zijn cijfers
     alarm       piept als een van beide een drempel passeert
     gezondheid  legt alles naast elkaar, met de bewijsgraad erbij
     incident    onthoudt wat er stuk was, en wacht op een conclusie

   Die laatste hoort in deze rij en niet bij de uitzonderingenrij: het alarm
   piept, de kaart oordeelt, en het incident is het enige van de vijf dat er nog
   is als het alarm allang weer zwijgt.

   Alle vier delen dezelfde regel, en het is de belangrijkste in dit bestand:
   ZE METEN NIETS TWEE KEER. De reizen van de sonde komen uit dezelfde SLO.json
   als de doelen; het alarm leest de lagen eronder in plaats van zelf te tellen;
   de gezondheidskaart leest ze alle drie. Wie hier een eigen meting bij zet,
   krijgt twee schermen die op een dag iets anders zeggen over hetzelfde -- en
   dan gelooft niemand meer welk van de twee. */
'use strict';

function maakMeetlagen({ db, save, journaal, kwaliteit, canary, sseToOffice }) {
  /* De sonde levert de metingen van BUITENAF en de SLO-meter houdt het
     foutbudget bij; ze staan in deze volgorde omdat de meter de sonde erbij zet
     en niet andersom. De reizen komen uit dezelfde SLO.json als de doelen, via
     slo.laadNorm() -- dus één bestand met de norm, en geen tweede lijstje
     reizen dat langzaam iets anders gaat toetsen. */
  const slolaag = require('./slo');
  const sonde = require('./sonde').maakSonde({ db, save,
    reizen: () => slolaag.laadNorm().reizen || [] });
  const slo = slolaag.maakSlo({ meting: require('../../meting'), sonde });

  /* HET ALARM. Hij meet niets zelf: elke controle leest een laag die er al is.
     Een alarm met een eigen meting zegt op een dag iets anders dan het scherm
     waar het over gaat. De drempels komen uit SLO.json, de controles staan in
     de module -- een regeltaal in een configuratiebestand is een tweede
     implementatie die je niet kunt toetsen. */
  const alarm = require('./alarm').maakAlarm({ db, save, journaal, slo, sonde, canary, kwaliteit,
    norm: () => slolaag.laadNorm(), sein: sseToOffice });
  alarm.tikker();

  /* DE GEZONDHEIDSKAART. Niet "wat staat er in de gegevens" (dat is ./puls.js)
     maar "doen de vermogens het, en hoe hard is dat bewijs". Hij hangt hier
     onderaan omdat hij de drie hierboven leest en zelf niets meet. */
  const gezondheid = require('./gezondheid').maakGezondheid({ db, save, slo, sonde, alarm, kwaliteit, journaal });

  /* HET INCIDENT. Hij leest de gezondheidskaart en niets anders; hij meet dus
     ook niets zelf. De machine OPENT hier en een mens SLUIT: een incident dat
     zichzelf sluit, laat een storing achter zonder conclusie. */
  const incident = require('./incident').maakIncidenten({ db, save, journaal, gezondheid });

  return { sonde, slo, alarm, gezondheid, incident, slolaag };
}

module.exports = { maakMeetlagen };
