/* ONTLEEDT DIT BESTAND, JA OF NEE -- zonder er een proces voor te starten.

   Keuringsregel 1 startte per bestand een `spawnSync(node --check)`. Gemeten
   over de 4823 bestanden die hij keurt: 127.619 ms, waarvan vrijwel alles
   procesopstart. In-proces met `new vm.Script` kost hetzelfde werk 1.188 ms --
   dezelfde bestanden, aan beide kanten nul afgekeurd, en geen enkel bestand dat
   de een wel en de ander niet vindt. Daarmee ging de VOLLE keuring van ongeveer
   160 naar 34 seconden.

   WAAROM DAT MEER IS DAN ONGEDULD. Twee minuten is precies lang genoeg om de
   keuring uit de werkronde te duwen: hij spreekt dan pas na een push, op de
   duurste plek. Erger nog is wat een lang venster met de UITSLAG doet -- een
   ronde kwam rood op `package.json` terwijl de wijziging klopte, doordat een
   ijkproces in de twee minuten ernaast even een pakket had bijgeschreven. Een
   poort die zo lang openstaat, meet iets anders dan de wijziging.

   DE WIKKEL IS DE HELE TRUC EN GEEN NETHEID. `new vm.Script(bron)` ontleedt als
   SCRIPT, en daar is een top-level `return` verboden -- terwijl die in een
   CommonJS-module volkomen legaal is en door `node --check` gewoon wordt
   geaccepteerd (`if (!process.env.X) return;` bovenaan een module komt echt
   voor). De kale variant zou zo'n bestand afkeuren en de keuring rood laten
   staan op iets wat klopt. Met de echte CommonJS-wikkel eromheen komen de twee
   wegen overeen; test/syntaxproef.test.js houdt dat vast door ze op elk geval
   naast elkaar te leggen in plaats van deze bewering te geloven.

   DEZE MODULE WOONT HIER EN NIET IN scripts/check.js, om dezelfde reden als
   scripts/lib/takenlijst.js: een keuring die alles bij het laden uitvoert, is
   geen module om tegen te toetsen. De mutatiemotor kan een `catch` hier
   omdraaien en zien dat er iets zakt.

   WAT DEZE WEG NIET DEKT, nagemeten en niet aangenomen: een bestand met een
   shebang of met ESM-syntax loopt in de wikkel stuk. In server/, public/ en
   test/ staat er vandaag geen enkele van beide (0 en 0). Komt er ooit een
   ESM-bestand, dan hoort deze zeef dat te MELDEN in plaats van het stil te
   accepteren -- vandaar dat de ontleedfout letterlijk wordt doorgegeven en niet
   samengevat.

   `vm.Script` ONTLEEDT alleen. Er wordt niets uitgevoerd en de wikkel wordt
   nooit aangeroepen. */
'use strict';
const vm = require('vm');

/* De letterlijke CommonJS-wikkel. Node zet deze zelf om elke module heen; door
   hem hier na te bouwen ontleedt de zeef wat node ook zou ontleden. */
const KOP = '(function (exports, require, module, __filename, __dirname) {';
const STAART = '\n});';

/* Geeft de ontleedfout als tekenreeks, of null als het bestand ontleedt.

   De invoer is BRON en geen pad, zodat een toets hem een verzonnen bestand kan
   voeden zonder iets op schijf te zetten -- en zodat een ijking geen spoor kan
   achterlaten dat een kill niet opruimt (TAKEN.md 6.11). */
function syntaxfout(bron, naam) {
  try {
    new vm.Script(KOP + bron + STAART, { filename: naam || 'onbekend.js' });
    return null;
  } catch (e) {
    return (e && e.message) ? e.message : String(e);
  }
}

module.exports = { syntaxfout, KOP, STAART };
