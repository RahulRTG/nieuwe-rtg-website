/* DE KERN SAMENSTELLEN -- deel 2 van 7.
   Waarom er op positie is geknipt en wat `kern` en `hulp` zijn: zie de kop van
   ./kernlaag1.js. Wat er in dit deel zit, in deze volgorde:
     architect
     werkplaats
     mall
     appbieb
     reisbieb
     rtfbieb
     geloofbieb
     rtfkantoor
     rtfclubs
     onderzoekslab
     stadsraad
     payroll
     labfonds
     werkplek
     aanmeldingen
     pestgrens
     foodcourt
     reisbureau
     logies
     uitgaan
     gemeente
     overheid */
'use strict';

module.exports = (kern, hulp) => {
  const { LANDEN, accounts, anthropic, crypto, db, findSupplier, klokVan, notify, notifySupplier, openVacatures, save, schoon, sseToSupplier } = hulp;

/* RTG Architectenbureau (kern/architect.js): de vierde ontwerptak, voor het
   gebouwde: villa's, penthouses, landgoederen, chalets en paviljoens. AI tekent
   het concept uit, levert een bouwstaat en de blik van de chef-architect. */
Object.assign(kern, require('../kern/architect').maakArchitect({ db, save, crypto, anthropic, schoon }));
/* RTG Werkplaats (kern/werkplaats.js): het app-bureau van de kantoren. Bedenkt
   nieuwe apps en verbetert bestaande apps, de Bibliotheek en de App Store met AI
   (advies; een mens beslist en bouwt). */
Object.assign(kern, require('../kern/werkplaats').maakWerkplaats({ db, save, crypto, anthropic, schoon }));
/* De RTG Mall (kern/mall.js): de luxe shoppingmall in de leden-app; een
   gecureerde etagelijst van de retail-partners, elk met een eigen catalogus. */
Object.assign(kern, require('../kern/mall').maakMall({ db, save, crypto, isRetail: kern.retailIsRetail,
  // de verdieping RTG Thuis; laat opgehaald omdat Thuis verderop wordt gebouwd
  haalThuis: () => (kern.thuis && typeof kern.thuis.thuisMallAanbod === 'function' ? kern.thuis.thuisMallAanbod() : null) }));
/* De App-Bibliotheek (kern/appbieb.js): 20.000 professionele apps in de Mall,
   elk rond de duizend euro winkelwaarde, voor leden inbegrepen bij de pas. */
Object.assign(kern, require('../kern/appbieb').maakAppbieb({ db, save }));
/* De Reis-Bibliotheek (kern/reisbieb): echte, leesbare bestemmingsgidsen van
   eigen redactie; open voor iedereen die is aangemeld. */
Object.assign(kern, require('../kern/reisbieb').maakReisBieb({ db, save }));
/* De RTF App-Bibliotheek (kern/rtfbieb.js): de echte, gratis kind- en
   gezinsapps van de stichting; de kern staat hier al zodat de Mall
   (routes/member) hem ook kan tonen. */
Object.assign(kern, require('../kern/rtfbieb').maakRtfBieb({ db, save }));
/* De Geloof & Wijsheid-Bibliotheek (kern/geloofbieb.js): een miljoen boeken en
   apps over alle religies en levensbeschouwingen, als gelijken naast elkaar,
   respectvol en gratis; met dezelfde leeftijdspoort als de app-bibliotheek. */
Object.assign(kern, require('../kern/geloofbieb').maakGeloofBieb({ db, save }));
/* Het RTF-kantoor (kern/rtfkantoor.js): het eigen kantoor van de stichting,
   een spiegel van de RTG-kantoorstructuur; met de Clubs & steden-afdeling
   (kern/rtfclubs.js: samenwerking met grote (sport)clubs per stad) en het
   RTG Onderzoekslab (kern/onderzoekslab.js: hardware, software, dorpshulp,
   landbouw en onderzoek naar onderzoek, met een menselijke veiligheidstoets). */
Object.assign(kern, require('../kern/rtfkantoor')({ db, save, crypto, anthropic }));
Object.assign(kern, require('../kern/rtfclubs')({ db, save, crypto }));
Object.assign(kern, require('../kern/onderzoekslab')({ db, save, crypto, anthropic }));
// De Stadsraad: per stad een invloedrijke partner die in het gezamenlijke
// foundation-kantoor mee beslist over de lab-uitslagen
Object.assign(kern, require('../kern/stadsraad')({ db, save, crypto }));
/* RTG Payroll (kern/payroll.js): het loonkantoor draait op wat het platform
   al weet -- de klok, de rollen en de fiscale landtabellen. */
Object.assign(kern, require('../kern/payroll')({ db, save, crypto, accounts, LANDEN, klokVan, openVacatures, findSupplier }));
Object.assign(kern, require('../kern/labfonds')({ db, save, crypto, anthropic }));
/* De werkplek (kern/werkplek.js): RTG en RTF als twee aparte huizen om in te
   werken. Ze delen het platform, maar niet hun cijfers, hun bezetting of hun
   takenlijst; wie binnenkomt kiest eerst een huis. */
Object.assign(kern, require('../kern/werkplek')({ db, save, crypto }));
/* Aanmeldingen (kern/aanmeldingen.js): de aanmelding per pas is geheel
   geautomatiseerd (berichten, onboarding, rondleiding, RTF, veiligheid, privacy);
   alleen het accepteren of afwijzen blijft mensenwerk. De AI kent nooit zelf
   Lifestyle/Business toe. */
Object.assign(kern, require('../kern/aanmeldingen')({ db, save, crypto, schoon, accounts,
  // laat gebonden: de geld-regie wordt verderop gemount; bij het accepteren
  // (request-tijd) is kern.geldPasprijzen al beschikbaar voor het betaalschema.
  geldPasprijzen: () => (kern.geldPasprijzen ? kern.geldPasprijzen() : null) }));
/* De pestgrens (kern/pestgrens.js): drie waarschuwingen bij pesten, dan een
   vurig slotantwoord en 24 uur weg; daarna opent alleen een excuus de deur. */
Object.assign(kern, require('../kern/pestgrens')({ db, save }));
/* De RTG Food Court (kern/foodcourt.js): alle restaurants op een rij, in de
   stijl van een reserveerplatform; kies datum en gezelschap en zie de vrije
   tijdsloten. Reserveren loopt via het bestaande /api/reserveer. */
Object.assign(kern, require('../kern/foodcourt').maakFoodcourt({ db, save, crypto }));
/* Het RTG-reisbureau (kern/reisbureau.js): een echt reisbureau in de leden-app;
   leden bladeren door de samengestelde reizen en vragen er een aan tegen de
   nettoprijs. De aanvraag landt bij een RTG-reisadviseur (aangevraagd, mens
   bevestigt). */
Object.assign(kern, require('../kern/reisbureau').maakReisbureau({ db, save, crypto, anthropic }));
/* De losse verblijf-pagina (kern/logies.js): hotels, appartementen en villa's
   op een rij met hun vrije kamers; boeken loopt via /api/verblijf. */
Object.assign(kern, require('../kern/logies').maakLogies({ db }));
/* De losse uitgaan-pagina (kern/uitgaan.js): bars, clubs en beachclubs met hun
   avonden; aanmelden loopt via /api/event/rsvp. */
Object.assign(kern, require('../kern/uitgaan').maakUitgaan({ db, save, crypto }));
/* RTG Gemeente (kern/gemeente.js): het civiele systeem als partner-genre.
   Vier pijlers (meldingen openbare ruimte, burgerzaken/afspraken, vergunningen,
   afval/belasting/bestuur) voor inwoners, gemeente-medewerkers en partners. */
Object.assign(kern, require('../kern/gemeente').maakGemeente({ db, save, crypto, anthropic,
  findSupplier, notify, notifySupplier, sseToSupplier }));
// de gemeente-partner en zijn config bestaan meteen bij het opstarten, zodat een
// medewerker kan inloggen ook zonder dat er eerst een inwoner iets deed
kern.gemeente.seed();
/* De Overheid (kern/overheid.js): de landelijke laag naast de gemeente ·
   Berichtenbox, Belastingdienst (aangifte + toeslagen), RDW (voertuig +
   rijbewijs), KVK-ondernemersloket, sociale zekerheid (UWV/SVB) en een
   referendum, voor inwoners, ondernemers en rijksambtenaren. */
Object.assign(kern, require('../kern/overheid').maakOverheid({ db, save, crypto, anthropic,
  findSupplier, notify, notifySupplier, sseToSupplier }));
kern.overheid.seed();
// de RTG-vloot (autoverhuur, tweewielers) meteen in het RDW-register, zodat een
// kenteken-check op een huurauto de APK-status teruggeeft
kern.overheid.registreerVloot();
};
