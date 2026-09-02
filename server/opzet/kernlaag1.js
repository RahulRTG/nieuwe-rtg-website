/* ============================================================================
   DE KERN SAMENSTELLEN -- deel 1, en de uitleg voor alle delen.

   WAAROM DIT OP POSITIE IS GEKNIPT EN NIET OP THEMA. De samenstelling was een
   aaneengesloten blok van 790 regels in server.js: honderddrie regels van de
   vorm Object.assign(kern, require(...)). De VOLGORDE daarvan doet ertoe -- een
   module die een andere uit de kern leest moet erna staan, en dat is hier al een
   keer misgegaan met de postlaag en de antivirus. Een thematische indeling zou
   die volgorde door de war gooien. Het zijn dus aaneengesloten stukken die in
   precies hun oude orde worden aangeroepen; doen alsof het een inhoudelijke
   indeling is, zou een net verhaal over een positionele knip zijn.

   WAAR DE GRENZEN LIGGEN, EN WAAROM NIET ELKE 6 KB. Een knip mag geen naam
   afsnijden van zijn gebruik. De eerste poging deed dat wel en het opstarten
   viel om op "bankregie is not defined" -- luid, meteen, en daarmee precies
   zoals bedoeld. De knipper schuift een grens nu vooruit tot niets meer
   oversteekt, dus de stukken zijn ongelijk van lengte. Dat is de goede ruil.

   DE TWEE DINGEN DIE ELKE LAAG BINNENKRIJGT

   `kern` is het gedeelde object dat elke laag verder vult -- Object.assign
   muteert hetzelfde object, dus wat laag 1 erin zet kan laag 2 lezen.
   `hulp` draagt de helpers en constanten uit server.js die deze modules nodig
   hebben, op EEN plek in plaats van acht eigen lijstjes.
   ========================================================================== */
'use strict';

const { maakVolwassen } = require('../kern/volwassen');

module.exports = (kern, hulp) => {
  const { DATA_DIR, PERSONAS, accounts, anthropic, boekingenVanKlant, crypto, db, findSupplier, keyVanCodenaam, ledenAantal, leeftijdVan, lidBoardUit, mail, media, ordersVanKlant, ordersVanZaak, rtf, save, schoon, sendPush, sendPushToUser, sociaal, sseClients, sseToCustomer } = hulp;

Object.assign(kern, sociaal); // de sociale kern-helpers erbij
/* Tafelticket (kern/tafelticket.js): de bonnen van dezelfde tafel op een
   gezegeld ticket (HMAC), met verse controle bij het afrekenen. De AI en de
   kassa lopen over dezelfde /api/supplier/tafelticket-route. */
Object.assign(kern, { tafelticket: require('../kern/tafelticket')({ crypto, dataDir: DATA_DIR, findSupplier, ordersVanZaak }) });
// De dynamische, gesloten RTG-code: HMAC-ondertekende, kort houdbare tokens die
// alleen ons systeem maakt en verifieert (dyncode.key, 0600, in .gitignore).
Object.assign(kern, { dyncode: require('../kern/dyncode')({ crypto, dataDir: DATA_DIR }) });
/* Magnaat leert alleen van anonieme tellingen. De gedeelde leerkring staat
   naast het spelplatform zodat ook de boardroom exact dezelfde kandidaten ziet. */
kern.magnaatLeren = require('../kern/spellen/magnaat/leerkring')({ db, save, crypto });
/* Spellen (kern/spellen.js): het spelplatform op de vriendenlaag; RTF- en
   RTG-leden spelen tegen elkaar. */
/* DE 18+-POORT KOMT OP DE KERN EN NIET ALLEEN IN DE SPELLENLAAG. Hij stond
   hieronder als argument van kern/spellen en nergens anders, en toen de App
   Store dezelfde grens nodig had (kern/appstore/arena.js: een score van een app
   van derden) was hij niet te bereiken zonder hem opnieuw te maken. Een tweede
   leeftijdsregel in een huis is er een te veel (LAT-regel 4), dus staat hij nu
   op de kern -- een regel die bepaalt wat er van iemand bewaard blijft, hoort
   vindbaar te zijn onder een naam. */
kern.volwassen = maakVolwassen({ accounts: hulp.accounts });
Object.assign(kern, require('../kern/spellen')({
  db, save, crypto, zijnVrienden: kern.zijnVrienden, codenaamVan: kern.codenaamVan, sseToCustomer,
  isGeblokkeerd: kern.isGeblokkeerd, socialZoek: kern.socialZoek, sociaalRate: kern.sociaalRate,
  // Rahul als spelmaatje: praat met een echte sleutel, valt anders terug op vaste tips
  anthropic, magnaatLeren: kern.magnaatLeren,
  // wie er NU is: de levende lijst van open live-verbindingen uit beide apps,
  // plus de poort "spelen uitgezet" (zie kern/spellen/presence.js)
  sseClients, lidBoardUit,
  // praten in het potje gaat de communicatiekern in; die bestaat pas in laag 4,
  // dus als FUNCTIE (zie kern/spellen/praat.js)
  comm: () => kern.comm,
  /* De 18+-poort staat in kern/volwassen.js: een eigen account, door RTG
     gekeurd (A3) en 18 of ouder. Daar staat ook waarom die keuring er eerst
     niet in zat en wat dat gat betekende. */
  volwassen: kern.volwassen
}));
/* RTG Veilig (kern/veilig/): de ruggengraat onder vier apps -- Thuiswacht
   ("ik ben over X minuten thuis"), het stille Codewoord, de Vitale check-in
   en Thuisrust ("niet storen tot thuis").

   De dodemansknop telt op de klok van DEZE server, niet in de app. Dat is de
   hele reden dat het werkt als de telefoon uitvalt: geen levensteken is zelf
   het signaal. Zie kern/veilig/wacht.js. */
/* De melding zelf staat in ./meldaan.js: hoe een alarm bij een lid landt, en
   waarom een rust-stand hem niet mag tegenhouden. Hier hangt alleen de draad. */
const meldAan = require('./meldaan')({ kern, db, save, crypto, sseToCustomer, sendPush, sendPushToUser });

Object.assign(kern, require('../kern/veiligheid')({
  db, save, crypto, schoon, mail,
  kluis: require('../accounts/kluis'),
  sociaal: { codenaamVan: kern.codenaamVan, zijnVrienden: kern.zijnVrienden },
  meldAan,
  appUrl: () => process.env.APP_URL || ''
}));
Object.assign(kern, require('../kern/instant-reality')({ db, save, crypto, schoon }));
kern.meldAan = meldAan;

/* Rahul kijkt mee (kern/kijken.js): een foto van iets, en hij zegt wat het is.
   De foto wordt nergens bewaard; zie de kop van die module. */
Object.assign(kern, require('../kern/kijken').maakKijken({ anthropic }));

/* Het salongesprek (kern/kletspraat/): de Rahul van het ene lid kletst met de
   Rahul van een vriend over hoe hun dag was. Een gimmick met drie sloten:
   alleen tussen vrienden, alleen als beiden het aan hebben staan, en altijd
   met verzonnen plaatsnamen. Zie de kop van die module. */
Object.assign(kern, require('../kern/kletspraat')({
  db, save, crypto,
  sociaal: { codenaamVan: kern.codenaamVan, zijnVrienden: kern.zijnVrienden },
  ordersVanKlant, boekingenVanKlant, anthropic,
  dagContext: require('../kern/context').dagContext, sseToCustomer
}));
/* De sweep: elke halve minuut kijken of er een wacht is afgelopen. Dit is de
   klok die doortikt terwijl de telefoon van het lid uit staat. De overgangen
   zijn idempotent (elke stap kijkt eerst naar de huidige status), dus een
   dubbele sweep levert hooguit een dubbele melding op, nooit een dubbele
   toestand. */
setInterval(() => { try { kern.veiligSweep(); } catch (e) { console.error('[veilig] sweep:', e.message); } }, 30 * 1000).unref();

/* De leerlaag (kern/leren.js): overhoorlijsten, het overhoorduel, samen aan
   projecten en schrijven met buddy-feedback; RTF- en RTG-leden doen samen mee. */
Object.assign(kern, require('../kern/leren')({
  db, save, crypto, codenaamVan: kern.codenaamVan, zijnVrienden: kern.zijnVrienden, socialZoek: kern.socialZoek,
  isGeblokkeerd: kern.isGeblokkeerd, sociaalRate: kern.sociaalRate, sseToCustomer, anthropic, leeftijdInstr: rtf.leeftijdInstr
}));
/* Het babyboekje (kern/baby.js): het dagboek van de allerkleinsten, met
   gezinsnamen en AI-gezinsmomenten; foto's gaan naar de mediastore. */
Object.assign(kern, require('../kern/baby')({ save, crypto, media, anthropic }));
/* De welzijnslaag (kern/welzijn.js): het prive-gevoelsdagboek van een kind;
   niemand leest mee, het scherm wijst zelf warm de weg naar hulp. */
Object.assign(kern, require('../kern/welzijn')({ save }));
/* De RTG-kantoren (kern/afdelingen.js): twaalf afdelingskamers en de
   boardroom die alles ziet en het functieschakelbord bedient. */
Object.assign(kern, require('../kern/afdelingen')({ db, save, crypto, anthropic, ledenAantal, accounts, keyVanCodenaam }));
};
