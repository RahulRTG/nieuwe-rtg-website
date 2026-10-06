/* De toestemming voor gezondheidsgegevens (foundation/gezondheidstoestemming.js,
   kern/welzijn.js; 5 oktober 2026). Geven of intrekken met hetzelfde lijf is
   hetzelfde verzoek: de eerste oproep zet de stand, de tweede vindt hem al zo.
   De route geeft geen geheim terug, dus een afgespeeld antwoord onthult niets.

   De prijs, uitgeschreven: geven, intrekken en weer geven binnen het venster
   van vijf seconden speelt bij de derde het antwoord van de eerste af, en dan
   staat er geen toestemming. Dat faalt naar de VEILIGE kant: de volgende
   bewaarpoging krijgt weer 409 en vraagt het opnieuw. */
'use strict';
const SLEUTELS = {
  'POST /api/foundation/gezin/toestemming/gezondheid': { zelfdeVerzoek: true },
  'POST /api/rtf/welzijn/toestemming': { zelfdeVerzoek: true },
  /* De wisronde van de gezinnen (foundation/gezinbewaren.js) is een RONDE, net als
     /api/techniek/bewaren/veeg: elke oproep rekent opnieuw na wat rijp is. Een
     afgespeeld antwoord zou "2 gewist" melden over een ronde die niets deed. */
  'POST /api/techniek/bewaren/gezinnen': { nietIdempotent: true,
    waarom: 'een wisronde rekent bij elke oproep opnieuw na; een tweede ronde vindt het gewiste niet meer, en een proef verandert niets' }
};
module.exports = { SLEUTELS };
