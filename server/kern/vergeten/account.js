/* Vergeten, deelbestand "account": HET ACCOUNT ZELF, MET DE HELE IDENTITEITSMAP.

   De vijfde soort naast de vier uit de kop van ../vergeten.js, en de laatste
   stap van een wissing: wat er van de PERSOON achter de codenaam bestaat. Het
   gezin aan het account, de paspoortscans en selfies op schijf, en de
   accountrij met zijn kluis. Afgesplitst uit ../vergeten.js toen die met de
   positietabel (./positie.js) opnieuw over de 10 kB-grens zou gaan; de naad is
   echt: hier staat wat er met de IDENTITEIT gebeurt, daar de volgorde van de
   hele wissing.

   Hier stond `deleteUser` gevolgd door het unlinken van het ENE bestand dat de
   database nog onthield. Dat dekte de werkelijkheid niet:

   - elke upload schreef een nieuw bestand met een tijdstempel, terwijl id_doc
     telkens overschreven werd -- dus alle eerdere pogingen bleven als wees
     staan (en de afwijzingsmail raadt letterlijk aan het opnieuw te proberen
     met een duidelijkere foto, dus dat gebeurt);
   - de SELFIE stond in member_state, en die rij verdwijnt mee met het account
     -- dus na deleteUser was de naam niet meer te lezen en werd hij nooit
     gewist. Niet die ene, geen enkele.

   Het lid kreeg intussen "ok: true", en niets faalde. Precies de wees waar de
   kop van ../vergeten.js en ./bytes.js over gaan.

   De map is nu zelf de administratie: alles wat <id>- heet gaat weg, wat de
   database er ook nog van weet. Vóór deleteUser, want daarna is het id nog wel
   bekend maar de rest niet meer -- en de volgorde kost niets: mislukt de
   verwijdering van het account, dan is een gewiste scan geen verlies maar
   precies wat het lid vroeg.

   Het inzagejournaal blijft staan, bewust. Het bevat geen naam en geen
   e-mailadres -- alleen een account-id dat na deze stap nergens meer op slaat,
   plus wie er keek en waarom. Anders veegt iemand zijn eigen sporen uit door
   zijn account te verwijderen (AVG art. 17 lid 3 laat bewaren toe waar dat
   voor een rechtsvordering of wettelijke plicht nodig is). Wat overblijft is
   de-geidentificeerd. */
'use strict';

module.exports = ({ kern, accounts, UPLOAD_DIR }) => {
  // de identiteitsmap (paspoortscans en selfies): zie ../../identiteitsmap.js
  const identiteitsmap = require('../../identiteitsmap').maakIdentiteitsmap(UPLOAD_DIR);

  function wisAccount(sessie) {
    if (!sessie || !sessie.account) return;
    /* Het gezin aan dit account (foundation/gezinseigenaar.js) en de
       koppelingen als oppas of familie. Niet in een lege catch: blijft het
       gezin staan, dan blijven er gegevens van kinderen achter zonder ouder. */
    if (kern.rtf && typeof kern.rtf.vergeetAccount === 'function') kern.rtf.vergeetAccount(sessie.account.id);
    try { identiteitsmap.wisAllesVan(sessie.account.id); } catch (e) {}
    accounts.deleteUser(sessie.account.id);
  }

  return { wisAccount };
};
