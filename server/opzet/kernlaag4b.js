/* DE KERN SAMENSTELLEN -- deel 4b.
   Waarom er op positie is geknipt en wat `kern` en `hulp` zijn: zie de kop van
   ./kernlaag1.js. Wat er in dit deel zit, in deze volgorde:
     bankregie
     bank
     reis
     invoerbalie + reisuitnodiging
     fiscaal/regelwacht
     fiscaal/btwaangifte
     thuis
     koppel
     tafelwensen
     checklijst
     werkvormen
     (opvang, afdelingshotel en regering staan sinds de 10 kB-knip in ./kernlaag4c.js) */
'use strict';

/* `bankregie` wordt hier verklaard en tot onderaan dit deel gebruikt; daarom
   loopt de grens met deel 4a ervoor en niet erin. */
module.exports = (kern, hulp) => {
  const { FISCAAL_PEILJAAR, LANDEN, accounts, anthropic, betaal, betaalOpdrachten, bijeen, rondEuro, crypto, db, findSupplier, fonds, keyVanCodenaam, log, magAi, ondernemerpoort, save, schoon, sseToCustomer, sseToOffice, sseToSupplier } = hulp;

/* Bankregie (kern/bankregie.js): de geldinfrastructuur-knop van de boardroom --
   een schakelaar met DRIE standen (partner -> hybride -> eigen) die bepaalt hoe
   RTG Bank clearet: via de externe kaart-naad, als eigen emissie, of allebei.
   Eerst gemount zodat de bank en de kantoor-routes dezelfde regie delen. */
const bankregie = require('../kern/bankregie').maakBankregie({ db, save });
Object.assign(kern, bankregie);
/* De BEVOEGDHEID (kern/bevoegdheid.js): de zesde as naast de vijf van de
   functieschakelaars. Die vijf gaan over wie de gebruiker is en wat de beheerder
   heeft uitgezet; deze gaat over wat RTG zelf mag. Hij leest wat er in de
   boardroom is vastgelegd en welke rail nu clearet -- dezelfde SEPA is een
   partnerhandeling of eigen werk, en dat verschil bepaalt het antwoord. */
const bevoegd = require('../kern/bevoegdheid').maakBevoegdheid({
  vergunning: bankregie.bankVergunning,
  partnerRails: bankregie.bankPartnerRails,
  clearing: bankregie.bankClearing,
  /* De terugstortstand bepaalt WELK GEZICHT de vermogens WALLET_SALDO en
     LID_UITBETALING hebben: gesloten circuit (een besluit, beperkt netwerk) of
     inwisselbaar saldo (een rail met een e-geldvergunning). Een schakelaar die
     de juridische positie verandert, hoort die verandering ook meteen in de
     bevoegdheidsvraag te laten doorwerken -- anders is hij een manier om
     eromheen te komen. */
  terugstorting: bankregie.bankTerugstorting
});
kern.bevoegd = bevoegd;
/* DE TERUGSTORTING AANSLUITEN OP DE BEVOEGDHEID. Sinds leden hun saldo kunnen
   terugstorten is walletsaldo elektronisch geld (zie de kop van WALLET_SALDO in
   kern/bevoegdheid/lijst.js), en die handeling mag alleen als LID_UITBETALING
   open staat. Zonder deze regel vraagt niemand dat, en dan weigert
   kern/pay/terug.js elke terugstorting -- dat is de veilige kant, maar het is
   niet de bedoeling. Late binding, want bevoegdheid wordt na pay gemount. */
if (kern.pay && kern.pay.koppelBevoegdTerug) kern.pay.koppelBevoegdTerug(id => bevoegd.mag(id));
/* RTG Bank (kern/bank): de eigen bank, gebouwd OP het RTG Pay-grootboek en met
   dezelfde dubbele-boekhoud-tucht -- rekeningen met een echt IBAN, storten (langs
   de 3-standen knop), overboeken, de brug van/naar de wallet, uitgaande SEPA achter
   de betaal-naad, en sparen met rente. Klaar om met een knop de eigen bank te worden. */
Object.assign(kern, require('../kern/bank')({ db, save, bijeen, crypto, schoon, betaal, pay: kern.pay, bankregie, keyVanCodenaam, accounts, sseToCustomer, sseToOffice, anthropic, betaalOpdrachten }));
/* De Reiswijzer (kern/reis.js): alle reisregels van elk land -- visum,
   rijrichting, alarmnummer, water, fooi, let-op -- in place op de gedeelde
   LANDEN-tabel gezet, VOOR de Regelwacht zodat de overlay er bovenop komt. */
Object.assign(kern, require('../kern/reis')({ LANDEN }));
/* DE INVOERBALIE (kern/invoer.js): een reis die elders geboekt is, alsnog in
   RTG krijgen -- REIZEN.md fase 2. Staat hier omdat hij twee dingen nodig heeft
   die hierboven pas ontstaan: de plaatsbepaling van de Reiswijzer (om een
   bestemming in vrije tekst te herkennen) en de kluis van het lid (waar het
   originele bewijsstuk heen gaat, met quotum en virusscan en al -- deze module
   krijgt geen eigen opslag). */
Object.assign(kern, require('../kern/invoer').maakInvoer({
  db, save, crypto, plaatsVind: kern.plaatsVind, bestandenUpload: kern.bestanden.bestandenUpload }));
/* DE REISUITNODIGING (kern/reisuitnodiging.js): een klaargezette reis plus een
   link. Het kantoor zet een reis klaar voor iemand die nog geen lid is, en een
   lid nodigt zijn reisgenoot uit. Krijgt de Invoerbalie mee (daar landen de
   overgenomen onderdelen; een tweede plek zou een tweede antwoord geven op
   "waar staat mijn reis") en de bestaande identiteitscontrole -- er komt geen
   eigen manier bij om vast te stellen wie iemand is. */
Object.assign(kern, require('../kern/reisuitnodiging').maakReisuitnodiging({
  db, save, crypto, invoer: kern.invoer, idGeverifieerd: kern.idGeverifieerd }));
/* HET REISGEZELSCHAP (kern/reisgezelschap.js): de mensen rond EEN reis, en de
   poort die bepaalt wie wat van die reis ziet. Staat hier omdat hij de
   samengestelde Reis nodig heeft (kern.mijnReizen, hierboven gemonteerd) en de
   codenaam-laag -- er komt geen tweede plek waar een reis wordt samengesteld,
   en geen tweede plek waar een naam vandaan komt. */
Object.assign(kern, require('../kern/reisgezelschap').maakReisgezelschap({
  db, save, crypto, mijnReizen: kern.mijnReizen, codenaamVan: kern.codenaamVan,
  keyVanCodenaam }));
/* De tijdzone-hulp van het huis leent diezelfde plaatsbepaling: van een zaak in
   "Ibiza" weten we zo dat zij in Europe/Madrid staat. Een keer registreren, en
   daarna geven de Mall, de vakwerk-agenda en de Food Court gegarandeerd
   HETZELFDE antwoord op "hoe laat is het bij deze zaak". */
require('../kern/tijdzone').zetLandVind(kern.landVind);
/* RTG Thuis (kern/thuis): thuisverhuur van lid aan lid -- ons antwoord op
   Airbnb, met alle premium functies gratis en de Reiswijzer aan boord. De
   commerciele tak (kern/thuis/zakelijk) draait op dezelfde landtabel als de
   rest van het huis: daar komt de logies-btw vandaan. */
Object.assign(kern, require('../kern/thuis')({ db, save, crypto, schoon, reiswijzer: kern.reiswijzer, landVind: kern.landVind, findSupplier, LANDEN }));
/* De werkvloer-laag: de koppellaag (kern/koppel.js) zet een handeling van
   het ene scherm op het andere -- betalen op afstand met een RTG-code,
   aftekenen voor verzending, tekenen voor ontvangst. De tafellijst
   (kern/tafelwensen.js) brengt allergenen en wensen per stoel bij de
   bediening en per tafel bij de keuken. De checklijst (kern/checklijst.js)
   deel je met je team; iedereen vinkt zelf af. */
Object.assign(kern, require('../kern/koppel')({ db, save, crypto, schoon, dyncode: kern.dyncode, sseToSupplier }));
Object.assign(kern, require('../kern/tafelwensen')({ db, save, crypto, schoon }));
Object.assign(kern, require('../kern/checklijst')({ db, save, crypto, schoon }));
/* De visumtaak (kern/visumtaak.js) en de gedekte tafel (kern/tafeldek.js):
   dwarsverbindingen op wat hierboven al staat (reiswijzer, tafelwensen, de
   agenda en het zorgprofiel). De domeinen kennen deze lagen niet: luchthaven,
   reisbureau en de tafelplanning roepen de laat gebonden, optionele haken
   visumtaakVan/tafeldekVan aan, die vanaf hier iets teruggeven. */
Object.assign(kern, require('../kern/visumtaak').maakVisumtaak({ agenda: kern.agenda, reiswijzer: kern.reiswijzer }));
/* DE REISWACHT (kern/reiswacht.js): wat er speelt rond de komende reizen --
   REIZEN.md fase 3. Een momentopname bij opvraging en uitdrukkelijk geen
   achtergrondwachter; elke bron meldt zichzelf, ook (juist) de bronnen die er
   niet zijn. Leest laat uit de kern, want hij hangt aan De Reis (kernlaag3w),
   Entourage (kernlaag4) en de agenda. */
Object.assign(kern, require('../kern/reiswacht').maakReiswacht({ kern }));
/* DE OPLOSSER (kern/reisoplosser.js): de knop "Los het op" -- REIZEN.md fase 5.
   Leest de wacht en de domeinen, zet hoogstens een taak in de eigen agenda
   (na een klik van de mens, idempotent); boeken en betalen blijft bij het
   domein. Zelfde late lezing als de wacht, om dezelfde reden. */
Object.assign(kern, require('../kern/reisoplosser').maakReisoplosser({ kern }));
Object.assign(kern, require('../kern/tafeldek').maakTafeldek({ tafelwensen: kern.tafelwensen, zorgVoor: kern.zorgVoor }));
/* De werkvormen (kern/werkvormen.js): elke zaak krijgt automatisch elke
   gereedschapskist die bij haar past -- een zzp'er die ritten rijdt heeft
   de vervoerstools EN de zzp-tools. De afleiding zelf hangt al aan db
   (db.capsVan); dit is de kern-ingang voor de route. */
Object.assign(kern, require('../kern/werkvormen')({ db }));
/* De ONDERNEMING (kern/onderneming): één bedrijfsobject dat bestaat vanaf
   "ik denk erover na" tot een groep met meerdere vennootschappen. Hij hangt
   hier, direct achter de werkvormen, omdat hij hun afleiding samenvoegt met
   twee assen die zij niet kent: de rechtsvorm (zzp, bv, stichting) en de
   levensfase. De boekingen- en bonnen-index komt rechtstreeks uit ../db,
   net als in kern/leverancier.js: O(1) per zaak in plaats van een scan. */
Object.assign(kern, require('../kern/onderneming')({ db, save, crypto, schoon, findSupplier,
  /* Codenaam en pas van de eigenaar, voor de catalogus-wensen op het kantoor.
     Uit de sociale kern, die eerder is gebouwd -- zo staat er ook daar geen
     echte naam in een lijst. */
  codenaamVan: kern.codenaamVan, tierVan: kern.soortVan,
  /* Een bestuurder of aandeelhouder wijst naar een MENS, en niet naar zestig
     tekens tekst: kern/onderneming/bestuur-persoon.js zoekt de codenaam op en
     legt het betrouwbaarheidsniveau vast dat er op dat moment stond. */
  keyVanCodenaam, lidstandVan: require('../kern/betrouwbaarheid').maakLidstand({ accounts }),
  ordersVanZaak: require('../db').ordersVanZaak, boekingenVanZaak: require('../db').boekingenVanZaak,
  /* De aanvraag om een zaak loopt langs de BESTAANDE aanmeldingsstroom
     (gemount in kernlaag2), zodat er geen tweede deur ontstaat naast de deur
     waar een mens voor staat. Zie de kop van kern/onderneming/index.js. */
  aanmeldingen: kern.aanmeldingen,
  /* De poort die elke nieuwe zaak al door de basis loodst. Gelezen en niet
     nagebouwd: twee lijsten die allebei "is deze zaak er klaar voor" beweren,
     lopen uiteen. */
  ondernemerpoort,
  /* Het personeel van een zaak woont in de identiteitskluis (SQLite), niet in
     db.data. De toegangslaag telt en klokt het; namen worden hier niet
     opgehaald. Zie kern/onderneming/toegang.js. */
  staffLijst: (code) => accounts.listStaff(code),
  /* De AI-laag van het Ondernemers-OS draait op dezelfde client en dezelfde
     poort als de rest van het huis; zonder sleutel valt hij terug op de eigen
     data. Zie kern/onderneming/ontwerper.js. */
  anthropic, magAi }));
/* De onboarding kan nu pas weten hoe De Salon en de bedrijvenkant heten: ze
   worden later gebouwd dan zij. Hier gaan de haken erin, zodat het meebouwen
   (het eerste Salon-bericht en het eigen bedrijf) echt ergens op uitkomt.
   Bewust ZONDER `if`: raakt deze bedrading zoek, dan hoort dat bij het opstarten
   om te vallen en niet stil een onboarding op te leveren die niets doet. */
kern.onboarding.zetHaken({ salon: kern.salon, ondernemingNieuw: kern.ondernemingNieuw,
  ondernemingVanEigenaar: kern.ondernemingVanEigenaar });
/* De Rechtsvormwacht (kern/onderneming/rechtsvormwacht.js): rechtsvormen --
   Nederlandse en buitenlandse in een register -- worden automatisch bijgewerkt
   in plaats van overgetypt. Zelfde ontwerp als de Regelwacht hierboven: een
   gevalideerde overlay op het gedeelde register, herstart-vast, met een
   dagelijkse bron-check en de ingebouwde tabel als veilige basis. Hij hangt
   direct achter de onderneming, want die tabel is van hem. */
Object.assign(kern, require('../kern/onderneming/rechtsvormwacht')({ db, save }));

/* RTG CONCERN (kern/concern): het dak boven de onderneming. Zie CONCERN.md.
   Hangt DIRECT ACHTER de onderneming en die volgorde is niet vrij:
   entiteitOnderneming() wijst een bestaande onderneming aan. Andersom leest de
   onderneming niets van het concern -- de oude weg blijft dus werken zonder dat
   er ooit een entiteit bestaat. */
Object.assign(kern, require('../kern/concern')({ db, save, crypto, schoon, findSupplier,
  // Discovery leest de bestaande onderneming van deze aanvrager; zie ./voorstel.js
  ondernemingVind: kern.ondernemingVind }));
kern.rechtsvormwacht.herstelOverlay();
const rvTimer = setInterval(() => { kern.rechtsvormwacht.check().catch(() => {}); },
  Number(process.env.RECHTSVORM_CHECK_MS || 86400000));
if (rvTimer.unref) rvTimer.unref();
/* De drie kamers van RTG Kantoren (opvang, afdelingshotel, regering) staan in
   ./kernlaag4c.js: op de 10 kB-grens uitgeknipt, en zij zijn de naad -- ze
   gebruiken als enige hier `bankregie` niet. */
/* Pay draait op de eigen bank zodra die live is: een saldotekort in de wallet
   wordt eerst gedekt vanaf de eigen betaalrekening (eigen rails), en pas
   daarna via de kaart-naad. Late binding, want de bank bouwt op pay. */
kern.pay.koppelBank(({ codenaam, centen }) => bankregie.bankLedenAan()
  ? kern.bank.bankDekWallet({ codenaam, centen })
  : { status: 403, error: 'De leden-bank is niet live.' });
/* DE TWEE PLAFONDS KOMEN HIER AAN HUN BRON. Ze zijn de grond onder het besluit
   in kern/bevoegdheid/lijst.js (WALLET_SALDO: gesloten circuit, harde
   plafonds), en stonden tot nu toe als constante in de twee lagen die ze
   handhaven -- alleen te verzetten door een programmeur. De boardroom zet ze nu
   (kern/bankregie/instellingen.js) en die twee lagen lezen ze hier vandaan.
   Late binding om dezelfde reden als de regel hierboven: pay en de puntenlaag
   bestaan al voordat de bankregie is gebouwd, en tot dat moment geldt hun eigen
   standaard. */
kern.pay.koppelPlafond(() => bankregie.bankPlafonds().walletCenten);
/* EN DE WAARDELAAG LEEST HETZELFDE GETAL. kern/waarde/klassen.js droeg voor
   PERSONAL_FUNDED een eigen plafondCenten, en dat liep meteen uit de pas: de
   boardroom verzette het walletplafond naar 10.000 en die laag weigerde nog
   steeds op 5.000, met een melding die een ander bedrag noemde dan het scherm
   van het lid. Twee waarheden over hetzelfde getal is precies wat LAT.md
   regel 4 verbiedt. */
if (kern.waarde && typeof kern.waarde.koppelWalletPlafond === 'function') {
  kern.waarde.koppelWalletPlafond(() => bankregie.bankPlafonds().walletCenten);
}
kern.puntenKoppelPlafond(() => bankregie.bankPlafonds().puntenCenten);
/* De geldnaden (cutover-reconcile en de late binding van het fonds aan de bank)
   staan in ./kern-geldnaden.js: dit deel liep over de 10 kB-grens. Ze horen
   achteraan, want ze kunnen pas als alles hierboven er is. bankregie gaat mee
   omdat hij hier wordt gemaakt en niet in hulp zit. */
require('./kern-geldnaden')(kern, hulp, { bankregie });
};
