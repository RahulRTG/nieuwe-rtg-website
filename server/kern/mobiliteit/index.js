/* Kern-module "mobiliteit": het Mobility OS. Een vervoerskern waarmee
   personen, bedrijven en vervoerders elk type vervoer plannen, boeken,
   uitvoeren en betalen.

   DE ONTWERPKEUZE. Elk vervoerstype is een aan- of uitzetbare module, maar
   alle modules gebruiken dezelfde ritten-, gebruikers-, locatie-, veiligheids-
   en betaalkern. Daardoor kan RTG met taxi's beginnen zonder later alles
   opnieuw te bouwen als er OV, pendelbussen, boten of helikopters bij komen.

   WAT DEZE KERN WEL EN NIET IS. Hij is GEEN tweede huishouding naast wat er
   al staat. Leden, codenamen, leveranciers, personeel, betalingen, meldingen
   en de functieschakelkast bestaan al; deze kern gebruikt ze. Wat hier bij
   komt is de vervoerslaag eroverheen:

     modulecatalogus + register  welke vervoersvormen waar bestaan
     voertuigcatalogus + assets  een voertuigmodel voor alles wat rijdt,
                                 vaart of vliegt, met fail-closed papieren
     keten + opdracht/voortgang  een rittenmotor die alle vervoersvormen deelt
     plekken                     vertrek en bestemming uit RTG zelf (horeca,
                                 hotels, haltes) in plaats van een eigen adresboek
     matching                    toewijzing met instelbare wegingen en uitleg
     dispatch + dispatch-acties  het scherm van de planner: eerst kijken, dan doen
     pendel + pendel-rooster     bedrijfsvervoer met een dienstregeling
     overeenkomst + kaartje      OV-kaartverkoop: een vervoerbewijs mag alleen
                                 uit een geldige overeenkomst met de vervoerder
     cdt + cdt-tijden/-export    de Nederlandse taxiverplichting: diensten,
                                 arbeids-, rij- en rusttijden, en een export
     reisplan + reis             taxi en OV in EEN reis, met EEN overzicht
     reisbeleid + zakelijk       het reisbeleid van een werkgever: grenzen,
                                 goedkeuring en het maandoverzicht

   DE BOUWVOLGORDE ZIT IN HET REGISTER, NIET IN DE CODE. Taxi (ride_hailing)
   en de OV-planner staan standaard aan; charters, boten en OV-kaartverkoop
   staan uit tot de contracten, de vergunningen en de menselijke bevestiging er
   zijn. De code voor die producten staat er dus wel, maar hij is niet aan te
   zetten zonder dat de voorwaarden geregeld zijn -- dat is precies wat een
   afhankelijkheid in de catalogus doet.

   WAT HIER BEWUST NIET GEBEURT. Geld verplaatsen. Een rit rekent af via
   kern/pay, zoals elke andere RTG-betaling, en de gebeurtenis 'payment.settled'
   is een aantekening op de opdracht en geen tweede grootboek. En RTG voert zelf
   geen commerciele luchtvaart of zeevaart uit: die producten zijn een
   marktplaats voor gecertificeerde exploitanten, wat je terugziet in de
   boekingsvorm 'aanvraag' -- daar zit altijd een mens tussen. */

function maakMobiliteit(state) {
  const { db, save, crypto, schoon, codenaamVan, haversine, etaMinutes, notify,
    findSupplier, logActivity, sseToOffice, sseToCustomer, pay, ovPrijsVan, accounts, bewerkCollectie, afwezigOp } = state;

  const nu = () => new Date().toISOString();
  const id = p => (p || 'mb') + crypto.randomBytes(4).toString('hex');

  const opslag = require('./opslag')({ db });
  const mobSave = () => {
    const sleutels = opslag.bestaande();
    return sleutels.length && typeof save.sleutels === 'function'
      ? save.sleutels(sleutels)
      : save();
  };

  /* De gedeelde context. Hij wordt EEN keer bij het opstarten gevuld en aan
     alle deelmodules meegegeven; kruisverwijzingen lopen erover, zodat er geen
     module een andere rechtstreeks hoeft te requiren. De volgorde hieronder is
     gedrag: assets leunt op het register, de opdracht op plekken en het
     register, matching op assets, dispatch op alledrie. */
  const ctx = { db, save: mobSave, crypto, schoon, nu, id, codenaamVan, haversine, etaMinutes,
    notify, findSupplier, logActivity, sseToOffice, sseToCustomer, pay, ovPrijsVan, accounts, afwezigOp };

  ctx.opslag = opslag;   // de enige db-aanraking; zie ./opslag.js

  Object.assign(ctx, require('./register')(ctx));
  Object.assign(ctx, require('./plekken')(ctx));
  Object.assign(ctx, require('./assets')(ctx));
  Object.assign(ctx, require('./opdracht')(ctx));
  Object.assign(ctx, require('./voortgang')(ctx));
  Object.assign(ctx, require('./matching')(ctx));
  Object.assign(ctx, require('./dispatch')(ctx));
  Object.assign(ctx, require('./dispatch-acties')(ctx));   // leunt op poolVan uit ./dispatch
  Object.assign(ctx, require('./pendel')(ctx));
  Object.assign(ctx, require('./pendel-rooster')(ctx));
  // de kaartverkoop: de overeenkomst eerst, want de uitgifte leunt op magVerkopen
  Object.assign(ctx, require('./overeenkomst')(ctx));
  Object.assign(ctx, require('./kaartje')(ctx));
  Object.assign(ctx, require('./kaartje-beeld')(ctx));
  // de 128-bit code; de collectietransactie gaat alleen naar hem en niet de kern in
  Object.assign(ctx, require('./kaarttoegang')(Object.assign({}, ctx, { bewerkCollectie })));
  Object.assign(ctx, require('./kaartje-gebruik')(ctx));
  Object.assign(ctx, require('./abonnement')(ctx));   // leunt op de kaartjesvoorraad
  Object.assign(ctx, require('./storing')(ctx));
  // de multimodale planner: leunt op de lijnen, de tarieven en de kaartverkoop
  Object.assign(ctx, require('./reisfactoren')(ctx));
  Object.assign(ctx, require('./reisplan-etappe')(ctx));
  Object.assign(ctx, require('./reisplan')(ctx));
  Object.assign(ctx, require('./reis')(ctx));
  // de zakelijke laag: het beleid eerst, want de rittenmotor toetst eraan
  Object.assign(ctx, require('./reisbeleid')(ctx));
  // de toets staat apart (10 KB-lat); hij leunt op beleidVan/werktBij hierboven
  Object.assign(ctx, require('./reisbeleid-toets')(ctx));
  Object.assign(ctx, require('./zakelijk')(ctx));
  // de CDT-laag: de registratie eerst, de uitvoer daarna (die leest de diensten)
  Object.assign(ctx, require('./cdt')(ctx));
  Object.assign(ctx, require('./cdt-export')(ctx));

  ctx.ensureRegister();
  ctx.ensureAssets();
  ctx.ensureOpdrachten();
  ctx.ensurePendel();
  ctx.ensureMatching();
  ctx.ensureOvereenkomsten();
  ctx.ensureKaartjes();
  ctx.ensureStoringen();
  ctx.ensureCdt();
  ctx.ensureExport();
  ctx.ensureReizen();
  ctx.ensureBeleid();

  const reiziger = require('./reiziger')({ ctx, schoon });

  /* ctx.save is de gerichte mobiliteitscommit voor de deelmodules. Hij mag
     nooit als `save` naar de gedeelde kern lekken: kernlaag6 voegt dit
     antwoord met Object.assign samen en zou dan de algemene opslagfunctie
     vervangen. Dat liet een WerkOS-route 200 antwoorden terwijl alleen de
     mobiliteitscollecties waren nagekeken en de werkruimte na SIGKILL weg was.
     Naar buiten blijft daarom de oorspronkelijke, algemene save zichtbaar. */
  return Object.assign({}, ctx, reiziger, { save });
}

module.exports = { maakMobiliteit };
