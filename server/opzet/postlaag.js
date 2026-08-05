/* De POSTLAAG: alle modules van RTG Mail, in de enige volgorde waarin ze
   gebouwd kunnen worden.

   Dit bestand bestaat om twee redenen, en de tweede is de echte. De eerste:
   ./diensten2.js ging over de tien kilobyte. De tweede: de volgorde hieronder
   is geen smaak maar een afhankelijkheid. De haak die na elke bezorging draait
   (`zetNaBezorging`) kan pas gezet worden als de regels, de afwezigheid en de
   ontvangstbevestiging bestaan -- en die leunen op hun beurt op het postvak en
   op de teams. Staat die keten verspreid tussen andere diensten, dan verschuift
   er ooit een regel en draait er stilletjes niets meer na een bezorging.

   WAT ER NA DE BEZORGING GEBEURT, in deze volgorde:
     1. de regels van de ontvanger (opbergen, etiket, ster);
     2. zijn afwezigheidsbericht;
     3. de ontvangstbevestiging van een gedeeld postvak.
   Een fout in een van de drie mag de BEZORGING niet ongedaan maken; kern/rtmail.js
   vangt hem daarom af en logt hem. Het bericht is dan al bezorgd, en dat is de
   belangrijkste helft. */
'use strict';

module.exports = ({ db, save, crypto, findSupplier }) => {
  const CODENAMES = require('../accounts/kluis').CODENAMES;

  // RTMAIL: het interne postsysteem (de rail voor de automatiseringen)
  const rtmail = require('../kern/rtmail')({ db, save, crypto });
  /* Teams: een adres dat meerderen samen lezen (receptie@partner.rtg). Krijgt de
     codenaam-lijst en het zaakregister mee om te toetsen of een adres nog vrij
     is -- een team mag nooit het postvak van een persoon of zaak kapen. */
  const rtmailTeam = require('../kern/rtmail-team')({ db, save, crypto, rtmail, findSupplier,
    CODENAMES });
  /* Het postvak van een team staat apart van het team zelf: dat eerste gaat over
     post, dit tweede over wie erin zit. Ze raken elkaar op teamMet en isLid. */
  Object.assign(rtmailTeam, require('../kern/rtmail-teampost')({ save, rtmail, team: rtmailTeam }));
  /* Het postvak zelf: mappen, etiketten, favorieten, sluimeren en zoeken. Staat
     apart omdat de toestand PER BUS hangt en niet op het bericht -- anders
     verdwijnt post uit de verzonden-map van de afzender zodra de ontvanger hem
     opbergt. En de draad (het gesprek), die daarop leunt. */
  const rtmailVak = require('../kern/rtmail-vak')({ db, save, rtmail });
  const rtmailDraad = require('../kern/rtmail-draad')({ db, rtmail, vak: rtmailVak });
  /* De schrijfkant (concepten, uitgesteld verzenden, handtekening, afwezigheid,
     aliassen) en de regels die BIJ DE BEZORGING draaien. De regels hangen aan de
     haak in kern/rtmail.js, zodat ze langs elke bezorging komen -- ook langs post
     die 's nachts uit een automatisering of van buiten binnenvalt, en dat is nu
     juist de post waarvoor iemand een regel maakt. */
  const rtmailVrij = require('../kern/rtmail-vrij')({ rtmail, findSupplier,
    CODENAMES });
  const rtmailSchrijf = require('../kern/rtmail-schrijf')({ db, save, crypto, rtmail, vrij: rtmailVrij });
  const rtmailRegels = require('../kern/rtmail-regels')({ db, save, crypto, rtmail, vak: rtmailVak, schrijf: rtmailSchrijf });

  /* Rechten op een postvak (fijner dan "mag erin"), het journaal dat elke
     handeling op ANDERMANS post vastlegt, en het bewaarbeleid: termijn,
     juridische bewaring, aantoonbare vernietiging en export. */
  const rtmailRecht = require('../kern/rtmail-recht')({ db, save, crypto });
  const rtmailBewaar = require('../kern/rtmail-bewaar')({ db, save, rtmail, recht: rtmailRecht });
  /* Het dossier op een bericht in een gedeeld postvak (status, prioriteit,
     interne notities, koppeling aan klant of ticket) en de klok met de
     ontvangstbevestiging die hem betekenis geeft. */
  const rtmailSla = require('../kern/rtmail-sla')({ db, save, rtmail, team: rtmailTeam });
  const rtmailDossier = require('../kern/rtmail-dossier')({ db, save, crypto, rtmail, team: rtmailTeam, sla: rtmailSla });
  /* De haak na elke bezorging draagt drie dingen, in deze volgorde: de regels van
     de ontvanger, zijn afwezigheidsbericht, en de ontvangstbevestiging van een
     gedeeld postvak. Een fout in een van de drie mag de bezorging niet ongedaan
     maken -- kern/rtmail.js vangt hem daarom af en logt hem. */
  rtmail.zetNaBezorging((m) => { rtmailRegels.naBezorging(m); rtmailSla.naBezorging(m); });

  return { rtmail, rtmailTeam, rtmailVak, rtmailDraad, rtmailVrij, rtmailSchrijf,
    rtmailRegels, rtmailDossier, rtmailSla, rtmailRecht, rtmailBewaar };
};
