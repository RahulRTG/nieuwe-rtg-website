/* DE KERN SAMENSTELLEN -- deel 6 van 7.
   Waarom er op positie is geknipt en wat `kern` en `hulp` zijn: zie de kop van
   ./kernlaag1.js. Wat er in dit deel zit, in deze volgorde:
     ov
     mobiliteit
     navigatie
     muziek
     muziek-samen
     muziek-uitgave
     muziek-rahul
     clips
     office
     stuur
     webauthn
     wbw
     sleutelwoorden
     aanmeldgesprek
     algpin
     werkvenster
     eenaccount
     kantoorgesprek */
'use strict';

module.exports = (kern, hulp) => {
  const { accounts, anthropic, app, crypto, db, etaMinutes, findSupplier, haversine, keyVanCodenaam, klokVan, leeftijdVan, log, logActivity, loginFails, noteFailedTry, notify, pinSlot, rememberSession, save, sessieregister, schoon, sseToCustomer, sseToOffice, supplierState } = hulp;

/* RTG OV (kern/ov.js): al het vervoer in een app. Lijnen met haltes, live
   voertuigen via de PDA, twee snelle check-ins (oplichtende code of GPS) en
   uitchecken met eerlijke km-prijs via RTG Pay. Na pay en sociaal gemount. */
Object.assign(kern, require('../kern/ov').maakOv({
  db, save, crypto, schoon, codenaamVan: kern.codenaamVan, haversine, etaMinutes, pay: kern.pay, notify
}));
/* Het Mobility OS (kern/mobiliteit/): de vervoerskern onder alles wat rijdt,
   vaart of vliegt. Een moduleregister met afhankelijkheden (welk vervoer
   bestaat waar), een voertuigmodel voor alle categorieen, een rittenmotor die
   alle vervoersvormen deelt, instelbare toewijzing, dispatch en bedrijfspendel.
   Vertrek en bestemming komen uit RTG zelf -- onze horeca, hotels en OV-haltes
   -- dus na ov gemount, dat de lijnen en haltes neerzet. */
Object.assign(kern, require('../kern/mobiliteit').maakMobiliteit({
  db, save, crypto, schoon, codenaamVan: kern.codenaamVan, haversine, etaMinutes,
  notify, findSupplier, logActivity, sseToOffice, sseToCustomer,
  // de kaartverkoop rekent af via dezelfde betaalkern en met dezelfde
  // OV-prijsformule als het uitchecken; geen tweede som, geen tweede grootboek
  pay: kern.pay, ovPrijsVan: kern.ovPrijsVan,
  // voor de dienstverbandcontrole bij zakelijke ritten
  accounts
}));
/* DE APPBRUG: een app-rit wordt ook een vervoersOPDRACHT en komt zo op het
   dispatchbord. HIER en niet in kern/lidacties, dat vóór mobiliteit staat en
   opdrachtMaak dus niet kent. Zie MAATSTAF.md par. 7.5. */
Object.assign(kern, {
  appbrug: require('../kern/mobiliteit/appbrug')({
    opdrachtMaak: kern.opdrachtMaak, opdrachtMet: kern.opdrachtMet, opdrachtNaar: kern.opdrachtNaar
  })
});

/* RTG Navigatie (kern/navigatie.js): het huiseigen navigatiesysteem. Een eigen
   wegennet met A*-route, bocht-voor-bocht en ETA per vervoerwijze; bestemmingen
   uit onze leveranciers, het OV, de loketten en de POI-lagen (tank/laad), en RTG
   Flits op de route. Niets naar derden. Na flits en ov gemount (koppelt eraan). */
Object.assign(kern, require('../kern/navigatie').maakNavigatie({
  db, save, crypto, haversine, flitsRond: kern.flitsRond, flitsMeld: kern.flitsMeld
}));
/* De PLAATSLAAG (kern/plaats/, zie PLAATS.md): hekken, vensters, waarnemingen
   en het actielog. Hij LEEST de geometrie die er al ligt -- de gebiedenboom van
   het stadsweefsel (kernlaag1) en de zaken -- en bezit zelf geen positie. Hier
   gemount en niet eerder, omdat het weefsel er dan staat; een halve motor
   doorgeven aan de domeingrens levert een stille undefined op. */
Object.assign(kern, require('../kern/plaats')({ db, save, crypto,
  weefsel: kern.weefsel, navPoi: kern.navPoi }));
require('./plaatsbronnen')(kern, hulp);
/* RTG Clips (kern/clips.js): korte verticale video's die alleen op het
   toestel van de maker staan (OPFS); RTG bewaart enkel titel, affiche en
   het signaal-doorgeefluik. De feed is een eindige dagselectie, bewust
   zonder oneindige scroll. Na sociaal gemount (codenamen). */
/* RTG Studio: zelf muziek maken. Alles wordt opgewekt, niets gesampled -- zie
   kern/muziek-instrumenten.js. Daardoor zit er geen licentie van een ander in
   wat een lid maakt, en mag zijn eigen stuk wel onder zijn eigen clip. */
/* De studio is in drie lagen bedraad, en de volgorde is nodig: samen levert de
   makers-lijst waar muziek zijn toegang op baseert, en uitgave heeft beide. */
kern.muziekSamen = null;
Object.assign(kern, require('../kern/muziek')({ db, save, crypto, schoon,
  magBij: (t, key) => (kern.muziekSamen ? kern.muziekSamen.muziekMagBij(t, key) : t.key === key),
  stempel: (t, key) => { if (kern.muziekSamen) kern.muziekSamen.muziekStempel(t, key); } }));
kern.muziekSamen = require('../kern/muziek-samen')({ save,
  trackMet: kern.muziekTrackMet, codenaamVan: kern.codenaamVan });
Object.assign(kern, kern.muziekSamen);
Object.assign(kern, require('../kern/muziek-uitgave')({ db, save, crypto, schoon,
  trackMet: kern.muziekTrackMet, codenaamVan: kern.codenaamVan,
  makersVan: kern.muziekMakersVan, notify,
  // de haak van de Media OS: nieuw werk wekt volgers (zie ./mediaos.js)
  nieuwWerk: (key, soort, titel) => (kern.mediaNieuwWerk ? kern.mediaNieuwWerk(key, soort, titel) : null),
}));
kern.muziekRahul = require('../kern/muziek-rahul')({ schoonTrack: kern.muziekSchoonTrack });
Object.assign(kern, require('../kern/clips').maakClips({
  db, save, crypto, schoon, codenaamVan: kern.codenaamVan, sseToCustomer, sseToOffice,
  // eigen muziek mag onder een eigen clip; de muziekmodule toetst het eigendom
  eigenTrack: kern.muziekEigenTrack,
  // de haak van de Media OS: nieuw werk wekt volgers (zie ./mediaos.js)
  nieuwWerk: (key, soort, titel) => (kern.mediaNieuwWerk ? kern.mediaNieuwWerk(key, soort, titel) : null),
}));
/* RTG Office (kern/office.js): het eigen kantoorpakket. Documenten
   (tekstdocument of rekenblad) op het account, alleen-lezen te delen op
   codenaam. Na sociaal gemount (codenamen en de codenaam-opzoeker). */
Object.assign(kern, require('../kern/office').maakOffice({
  db, save, crypto, schoon, codenaamVan: kern.codenaamVan, keyVanCodenaam, sseToCustomer, anthropic
}));
/* Het AI-stuur (kern/stuur.js): Rahul voert acties uit op elk toegestaan
   API-pad, als interne aanroep met de eigen inlog van de gebruiker. Een
   codepad, dezelfde rechten en dezelfde schakelkast als de app-knoppen. */
Object.assign(kern, require('../kern/stuur').maakStuur({ log, anthropic, app, crypto }));
/* Passkeys (kern/webauthn.js): inloggen met vingerafdruk/gezicht/sleutel.
   De verificatie draait op de eigen WebAuthn-laag (server/webauthn.js) op Node's
   crypto; wij bewaren alleen publieke sleutels per account, challenges leven kort
   en in RAM. Voor de auth-routes gemount (die geven de passkey-login een sessie). */
Object.assign(kern, require('../kern/webauthn').maakWebauthn({ db, save, accounts, schoon }));
/* Wie betaalt wat (kern/wbw.js): het gedeelde uitgavenlijstje van een groep
   Salon-vrienden, met sluitende centenverdeling en verrekenen via RTG Pay.
   Na pay en sociaal gemount (gebruikt beide). */
Object.assign(kern, require('../kern/wbw').maakWbw({
  db, save, crypto, schoon, codenaamVan: kern.codenaamVan,
  connectieTussen: kern.connectieTussen, verbActief: kern.verbActief, pay: kern.pay, notify
}));
/* Het aanmeldgesprek (kern/aanmeldgesprek.js): Rahul vervangt het ouderwetse
   aanmeldformulier met een menselijk gesprek dat de velden voor de ene
   registratieroute oplevert (en op "waarom?" eerlijk uitlegt waarvoor iets
   dient). */
/* Sleutelwoorden (kern/sleutelwoorden.js): inloggen door een gesprek met
   Rahul en vier onthouden woorden, drie per keer (roterend, scrypt, met een
   slot). Moet VOOR het aanmeldgesprek staan, want dat gebruikt swStart/swZeg. */
Object.assign(kern, require('../kern/sleutelwoorden').maakSleutelwoorden({ db, save, crypto, accounts, slot: pinSlot }));
Object.assign(kern, require('../kern/aanmeldgesprek').maakAanmeldgesprek({ db, schoon, leeftijdVan, swStart: kern.swStart, swZeg: kern.swZeg }));
/* De algemene pin (kern/algpin.js): een pincode van het lid die de
   privacygevoelige apps op het OS beschermt en waarmee de werk-apps openen
   (het ene account = bevoegdheid, de pin = bewijs). */
Object.assign(kern, require('../kern/algpin').maakAlgPin({ db, save, crypto, slot: pinSlot }));
/* Het werkvenster (kern/werkvenster.js): de werkgever bepaalt wanneer
   personeel op de werkpagina en de PDA mag; de server dwingt dat af bij elke
   ingang naar een personeelssessie. Rahul adviseert los daarvan (agenda,
   uren, zorgprofiel) maar blokkeert nooit. */
Object.assign(kern, require('../kern/werkvenster').maakWerkvenster({
  db, save, klokVan, zorgVan: kern.zorgVan, haversine
}));
/* Een account voor alles (kern/eenaccount.js): mensen registreren zich een
   keer; personeel, zaak en kantoor zijn daarna koppelingen aan dat ene
   account (na bewijs van de werk-inlog), en accStart munt exact dezelfde
   sessies als de losse logins. */
Object.assign(kern, require('../kern/eenaccount').maakEenAccount({
  db, save, crypto, accounts, findSupplier, checkCred: kern.checkCred, hasCred: kern.hasCred,
  DEMO: kern.DEMO, DEMO_SUPPLIER: kern.DEMO_SUPPLIER, OFFICE_CODE: kern.OFFICE_CODE,
  veiligGelijk: kern.veiligGelijk, totpOk: kern.totpOk, rememberSession, logInlog: kern.logInlog,
  logActivity, supplierState, officeState: kern.officeState, magWerken: kern.magWerken,
  pinInfo: kern.pinInfo, pinCheck: kern.pinCheck,
  // hetzelfde doel-slot als /api/supplier/login: een pin, een teller
  pinSlot,
  // en dezelfde persoonseis als /api/supplier/login: het ene account is geen achterdeur
  persoonsPoort: kern.persoonsPoort,
  // MIJN RTG blok 3: hier ontstaat een tweede context voor dezelfde mens
  sessieregister
}));
/* Het kantoorgesprek (kern/kantoorgesprek.js): de backoffice binnenkomen door
   met Rahul te praten in plaats van een codeveld in te vullen. Zelfde slot als
   de kantoordeur zelf (bucket 'office:<ip>'), zodat de vriendelijkere weg geen
   zwakkere weg is; wat er ingetypt wordt gaat nergens heen. */
Object.assign(kern, require('../kern/kantoorgesprek').maakKantoorgesprek({
  OFFICE_CODE: kern.OFFICE_CODE, veiligGelijk: kern.veiligGelijk, totpOk: kern.totpOk,
  crypto, rememberSession, officeState: kern.officeState, logInlog: kern.logInlog,
  loginFails, noteFailedTry
}));

};
