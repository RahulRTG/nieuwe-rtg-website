/* ============================================================================
   DE ZES GETALLEN VAN DE VERRAADRONDE, apart en puur.

   WAAROM DIT EEN EIGEN MODULE IS. De ronde zelf start vier servers en duurt
   minuten; daar komt nooit een mutatie bij. Maar de REGELS die de zes getallen
   opleveren zijn precies het stuk waar een fout onzichtbaar in kan zitten -- en
   een verkeerde telling maakt van een blinde ronde een groene.

   De belangrijkste regel staat hier dan ook als functie en niet als een
   optelling middenin een script:

       BLINDE INJECTIES = TOEGEDIEND - WAARGENOMEN

   Dat verschil is het enige getal dat zegt of er iets is GELEERD. Nul
   bevindingen bij nul waarnemingen betekent niet "bestand tegen", maar "niet
   gekeken".

   EN DE TWEEDE REGEL, die er net zo hard toe doet: de ronde zakt op BLINDHEID
   en op ONHERHAALBAARHEID, en nooit op een bevinding. Een bevinding is winst --
   daarvoor is de motor gebouwd. Zou een bevinding de poort rood maken, dan is
   de beloning voor goed zoeken een rode CI, en dan zoekt niemand meer.
   ========================================================================== */
'use strict';

/* Een invariantschending is iets anders dan een verschil. Een verschil kan een
   nette foutmelding zijn -- het systeem dat zich gedraagt. Een SCHENDING is een
   harde waarheid die breekt: hier de belofte dat een met 2xx bevestigde
   schrijfactie er na een herstart nog is.

   Die twee door elkaar halen levert of paniek over nette fouten, of stilte over
   verloren gegevens. */
function isSchending(gezien) {
  const bevestigd = !gezien.some(g => /^schrijfStatus:/.test(g));   // de schrijfactie gaf gewoon 2xx
  const weg = gezien.some(g => /^terugNaHerstart: true -> false$/.test(g));
  return bevestigd && weg;
}

function telSamen(rondes, verklaard) {
  const lijst = Array.isArray(rondes) ? rondes : [];
  const toegediend = lijst.filter(r => r.toegediend).length;
  const waargenomen = lijst.filter(r => r.toegediend && r.waargenomen).length;
  return {
    verklaard: Number(verklaard) || 0,
    toegediend,
    waargenomen,
    invariantschendingen: lijst.filter(r => r.toegediend && isSchending(r.gezien || [])).length,
    /* Toegediend en niets zag het. Het enige getal dat zegt of er iets is geleerd. */
    blindeInjecties: toegediend - waargenomen,
    onherhaalbareRondes: lijst.filter(r => r.toegediend && r.herhaalbaar === false).length
  };
}

/* Zakt de ronde? Op blindheid en onherhaalbaarheid -- niet op bevindingen. */
const zakt = (t) => (t.blindeInjecties > 0 || t.onherhaalbareRondes > 0);

module.exports = { telSamen, isSchending, zakt };
