/* ============================================================================
   EERLIJKE OPSTARTCONTROLE: WAARSCHUW ALS DEMO-INSTELLINGEN MEE NAAR PRODUCTIE
   GAAN.

   Draait alleen in productie (NODE_ENV=production). Elke regel hier is een
   stand die op een testmachine prima is en op een echte machine niet: de
   universele demo-inlog, de standaard kantoorcode, geen SMTP.

   EEN WAARSCHUWING DIE IN HET GEWONE GEVAL AFGAAT, LEERT IEDEREEN HEM WEG TE
   KIJKEN. Dat is de reden dat de eigenaarscontrole hier staat en niet in
   config.valideer(): die kent alleen de omgeving, niet de database, en
   waarschuwde dus zodra RTG_OWNER_BOOTSTRAP ontbrak -- terwijl de normale
   eindstand juist IS dat die sleutel weg is. Hier zijn de accounts geladen en
   is de vraag wel te beantwoorden: bestaat er een eigenaarsaccount, en is de
   sleutel nog nodig?
   ========================================================================== */
'use strict';

module.exports = function startControle({ PRODUCTION, DEMO, accounts, eigenaar }) {
  /* DE VRIJGAVEPOORT (server/kern/vrijgave/), en die staat VOOR de
     productiegrens hieronder: een kapot register of een onleesbaar standbestand
     hoort op elke machine te klinken. Op een openbaar adres is het een weigering
     om te starten (de fout gaat hier ongevangen omhoog), elders een waarschuwing
     -- en de oordelen staan dan toch dicht. Stond eerst bij de montage van het
     kantoor, waar hij pas draaide als die kamer werd opgebouwd. */
  require('../kern/vrijgave').keurBijStart();
  if (!PRODUCTION) return;
  /* OFFICE_CODE en OFFICE_TOTP_SECRET openen in productie niets (B10, B24;
     geen eis meer sinds 4 oktober 2026). Staan ze toch gezet, dan worden ze
     genegeerd -- en dat gebeurt niet stil: een regel zegt welke en waarom. */
  const genegeerd = ['OFFICE_CODE', 'OFFICE_TOTP_SECRET'].filter(n => process.env[n]);
  if (genegeerd.length) console.warn('[start] ' + genegeerd.join(' en ') + (genegeerd.length > 1 ? ' staan' : ' staat') +
    ' gezet maar ' + (genegeerd.length > 1 ? 'worden' : 'wordt') + ' in productie genegeerd (B10/B24): het kantoor opent alleen op naam, met een passkey.');
  if (DEMO) console.warn('[start] LET OP: Magnaat Test is AAN in productie. Dit hoort uitsluitend op de afzonderlijke testinstallatie.');
  /* SMTP en AI worden al door config/productie.js hard geblokkeerd. Hier geen
     zachte waarschuwing meer: die suggereerde ten onrechte dat productie in
     zo'n half aangesloten stand mocht doorlopen. */
  /* HET EIGENAARSACCOUNT: alleen zeggen als het ECHT ergens over gaat.

     Sinds de registratie op het eigenaarsadres een eenmalige sleutel vraagt
     (RTG_OWNER_BOOTSTRAP, zie routes/auth/account.js) is er een stand waarin
     niemand ooit nog eigenaar kan worden: geen account op dat adres én geen
     sleutel gezet. Dan hoort er iets te staan. */
  try {
    const oAdres = eigenaar.eigenaarEmail();
    const oBestaat = !!accounts.findByLogin(oAdres);
    if (!oBestaat && !process.env.RTG_OWNER_BOOTSTRAP)
      console.warn('[start] LET OP: er is nog geen account op het eigenaarsadres (' + oAdres +
        ') en RTG_OWNER_BOOTSTRAP is niet gezet. Niemand kan zich nu als eigenaar registreren. Zet de sleutel, registreer een keer, en haal hem daarna weg.');
    if (oBestaat && process.env.RTG_OWNER_BOOTSTRAP)
      console.warn('[start] LET OP: RTG_OWNER_BOOTSTRAP staat nog gezet terwijl het eigenaarsaccount al bestaat. Haal hem uit de omgeving; hij heeft geen doel meer.');
  } catch (e) {}
};
