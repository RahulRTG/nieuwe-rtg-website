/* Sociale kernen samenstellen. De positionele splitsing en de contracten van
   kern/hulp staan in kernlaag1.js; volgorde volgt de gebruikte afhankelijkheden. */
'use strict';

module.exports = (kern, hulp) => {
  const { accounts, anthropic, bewerkCollectie, bijeen, inBundel, broadcastSync, crypto, db, findSupplier, keyVanCodenaam, ledenAantal, leeftijdVan, liveCodename, media, notify, notifySupplier, onboarding, rtmail, save, schoon } = hulp;
  // sseToCustomer/sseToSupplier/sseToOffice worden via hulp.* gelezen (zie kern.comm)


/* Het Huis: het reisdossier achter de hoofdingang. Leest alleen wat er al is --
   de eigen reis van het lid, en de papieren die Entourage al bewaakt. Die grens
   wordt daar berekend en hier niet nog een keer: een limiet hoort op één plek. */
kern.huis = require('../kern/huis')({
  reisVan: (sess) => (sess && sess.account
    ? (accounts.getMemberState(sess.account.id) || {}).trip
    : (sess && sess.tier !== 'guest' ? db.data.trip : null)) || null,
  entourageVan: (sess) => { try { return kern.entourage(sess.key); } catch (e) { return null; } }
});
// Rendez-vous deelt zijn 18+/KYC-poort met Vonk; de route bewaakt de pas.
Object.assign(kern, require('../kern/rendezvous')({ db, save, crypto, anthropic, notify, accounts, leeftijdVan,
  /* codenaamVan en niet liveCodename: zie de kop van kern/rendezvous.js. Laat
     gebonden, want de sociale laag wordt later samengesteld. */
  codenaamVan: (k) => kern.codenaamVan(k),
  /* tableZet komt uit kern/rechterhand (kernlaag3) en staat er dus al: bij twee
     akkoorden krijgt elk lid de gelegenheid in zijn EIGEN dossier. */
  tableZet: kern.tableZet,
  /* De contactpin uit kern/sociaal: Encounter LEENT hem als adres en maakt geen
     eigen koppelcode. Zie de kop van kern/rendezvous-kring.js. */
  handleVanPin: (pin) => kern.handleVanPin(pin) }));
// De wauw-laag: stemming, verjaardagsglans en De Terugblik over alle socials
Object.assign(kern, require('../kern/wauw')({ db, save, accounts, socialConnecties: kern.socialConnecties }));
// RTG Pulse: het eigen 9+-microblog (chronologisch, zonder verslavende trucs)
Object.assign(kern, require('../kern/pulse')({ db, save, crypto, liveCodename, notify,
  stemmingVan: kern.stemmingVan, jarigVan: kern.jarigVan }));
/* De leeslaag wordt hier samengesteld. De HTTP-router krijgt één wereldfeed,
   geen toegang tot de losse Pulse- en Salon-domeinen. Hun privacyregels blijven
   bij de bron; er wordt geen tweede opslag of selectiebeleid gemaakt. */
const salonZicht = require('../kern/salon/zichtbaarheid')({ db, findSupplier, zijnVrienden: kern.zijnVrienden });
kern.wereldFeed = require('../kern/wereld/feed')({ db, codenaamVan: kern.codenaamVan,
  zijnVrienden: kern.zijnVrienden, salonToegang: salonZicht.magZien,
  pulseLezen: key => ((kern.pulseFeed(key, 'volgend') || {}).feed || []) }).feed;
// De Salon bewaart zijn eigen posts en publicatierechten.
kern.salon = require('../kern/salon')({ db, save, media, liveCodename, codenaamVan: kern.codenaamVan,
  crypto, broadcastSync, spraaktekst: kern.spraaktekst });
kern.salonProfiel = require('../kern/salon/profiel')({ db, save, codenaamVan: kern.codenaamVan,
  keyVanCodenaam: kern.keyVanCodenaam, liveCodename, salon: kern.salon });
kern.salonReacties = require('../kern/salon/reacties')({ db, save, liveCodename, codenaamVan: kern.codenaamVan,
  keyVanCodenaam: kern.keyVanCodenaam, zijnVrienden: kern.zijnVrienden, salon: kern.salon, notify });
kern.salon.ai = require('../kern/salon/ai')({ anthropic, salon: kern.salon });
kern.salonInzicht = require('../kern/salon/inzicht')({ db, save, salon: kern.salon });
/* UITLICHTEN is een redactiehandeling en geen vinkje (kern/salon/uitlichten.js).
   De twee haken naar de Media OS zijn LAAT GEBONDEN: die laag wordt pas in
   opzet/mediaos.js samengesteld, en zonder haak licht de redactie gewoon uit --
   er gaat dan alleen geen melding uit. Zelfde patroon als `nieuwWerk`. */
kern.salonUitlichten = require('../kern/salon/uitlichten')({
  db, save, schoon, codenaamVan: kern.codenaamVan,
  nieuwMoment: (id, soort, titel) => (kern.mediaNieuwMoment ? kern.mediaNieuwMoment(id, soort, titel) : null),
  aanwezigZorg: (soort, code, naam) => (kern.aanwezigZorg ? kern.aanwezigZorg(soort, code, naam) : null)
});

/* Métier (kern/metier/): de beroepskant. Het profiel draait op de codenaam, RTG
   bevestigt alleen wat het echt zag (de bewezen rollen komen uit de sleutelbos
   van kern/eenaccount.js) en de echte naam geeft het lid per werkgever vrij uit
   de kluis -- intrekbaar, met een eigen inzagelog. Zie kern/metier/bewijs.js. */
kern.metier = require('../kern/metier')({ db, save, liveCodename, codenaamVan: kern.codenaamVan, findSupplier });
kern.metierZoek = require('../kern/metier/zoek')({ codenaamVan: kern.codenaamVan, metier: kern.metier, PAGINA: kern.metier.PAGINA });
kern.metier.zoek = kern.metierZoek.zoek;
kern.metierBewijs = require('../kern/metier/bewijs')({ db, save, accounts, codenaamVan: kern.codenaamVan,
  keyVanCodenaam, findSupplier, notifySupplier, notify });
kern.metierNetwerk = require('../kern/metier/netwerk')({ db, save, codenaamVan: kern.codenaamVan,
  keyVanCodenaam, zijnVrienden: kern.zijnVrienden, liveCodename, notify, metier: kern.metier });
kern.metierAI = require('../kern/metier/ai')({ anthropic, metier: kern.metier, netwerk: kern.metierNetwerk });
kern.metierLoon = require('../kern/metier/loon')({ db });

/* Genootschap (kern/genootschap/): besloten groepen van leden, met een prikbord
   en bijeenkomsten. Bewust een EIGEN app en geen verbouwing van Cercle (het
   register van je societeiten) of Rendez-vous (de datingdienst van de Lifestyle
   Pass); zie de kop van kern/genootschap/index.js voor waarom. */
kern.genootschap = require('../kern/genootschap')({ db, save, codenaamVan: kern.codenaamVan,
  keyVanCodenaam, liveCodename, notify, zijnVrienden: kern.zijnVrienden });
kern.genootschapBeheer = require('../kern/genootschap/beheer')({ save, codenaamVan: kern.codenaamVan,
  keyVanCodenaam, genootschap: kern.genootschap });
kern.prikbord = require('../kern/genootschap/prikbord')({ db, save, codenaamVan: kern.codenaamVan,
  liveCodename, notify, genootschap: kern.genootschap });
kern.bijeenkomst = require('../kern/genootschap/bijeenkomst')({ db, save, codenaamVan: kern.codenaamVan,
  notify, genootschap: kern.genootschap });
kern.genootschapAI = require('../kern/genootschap/ai')({ anthropic, genootschap: kern.genootschap,
  prikbord: kern.prikbord, bijeenkomst: kern.bijeenkomst });
kern.genootschapInzicht = require('../kern/genootschap/inzicht')({ db, save, genootschap: kern.genootschap,
  prikbord: kern.prikbord, bijeenkomst: kern.bijeenkomst });
kern.genootschapUitvoer = require('../kern/genootschap/uitvoer')({ genootschap: kern.genootschap,
  codenaamVan: kern.codenaamVan });
/* De Berichten-app: zoeken over alle kanalen, gesprekken vastzetten/stilzetten/
   archiveren, en de drie AI-taken (samenvatten, een antwoord opstellen, de
   afspraken eruit halen). De AI stelt op, de mens verstuurt. */
kern.berichten = require('../kern/berichten')({ db, save, bijeen, inBundel, socialConnecties: kern.socialConnecties,
  dmSleutel: kern.dmSleutel, codenaamVan: kern.codenaamVan, rtmail, overheid: kern.overheid, anthropic,
  // de brug wordt hieronder pas gezet; vandaar bij gebruik ophalen
  commDm: () => kern.commDm, commWerk: () => kern.commWerk });

/* De communicatiekern (kern/comm) en de vier bruggen ernaartoe staan in
   ./kernlaag4-comm.js. Ze worden HIER aangeroepen en niet vanuit server.js,
   want de volgorde is inhoudelijk: na kern.berichten (de AI-laag wordt
   hergebruikt) en voor kern.care. */
require('./kernlaag4-comm')(kern, hulp);

/* Toren 4: RTG Care (zorg & welzijn). Behandelingen boeken met het zorgprofiel
   dat meereist en een aparte, veilige intake-deling per aanbieder.
   De metingen-deur gaat LAAT GEBONDEN mee: kern/metingen.js hangt verderop in
   de bouw, en een kopie op dit moment zou undefined bevriezen -- de stille
   breuk waar opzet/domeingrens.js over gaat. Bij de samenvoeging van de
   Life-tak eerst weggevallen; vier zorgtoetsen wezen hem meteen aan. */
Object.assign(kern, require('../kern/care')({ db, save, crypto, schoon, notify, zorgVoor: kern.zorgVoor, zorgMee: kern.zorgMee,
  metingVanBehandelaar: (...a) => kern.metingVanBehandelaar(...a) }));
// Fluister: de persoonlijke assistent met geheugen (weetjes + focus)
/* Geldregie (kern/geldregie.js): RTG bepaalt de geldkant vanuit de boardroom:
   pasprijzen (publiek zichtbaar), de interne partnervergoeding per genre of
   zaak, en het RTG-ledenvoordeel per genre (RTG legt bij; de nettoprijzen-
   belofte uit de voorwaarden blijft intact). Voor lidacties gemount, want
   de betaal-seams rekenen het voordeel mee. */
Object.assign(kern, require('../kern/geldregie').maakGeldregie({ db, save }));
/* Ledenregister (kern/ledenregister.js): het kantooroverzicht van alle leden op
   codenaam, gesplitst per stad/land/alfabet/geslacht en pas, met de omzet per pas
   en de 30%-foundationsplit (20% lokaal, 10% RTF). Na de geldregie gemount, want
   het leunt op de pasprijzen daaruit. */
Object.assign(kern, require('../kern/ledenregister')({ accounts, onboarding, geldPasprijzen: kern.geldPasprijzen, ledenAantal, db }));
/* RTG Kostprijs (KOSTEN.md) met de economielaag ervoor (ECONOMIE.md). Die
   volgorde is een afhankelijkheid: de kostprijs verdeelt zijn nota's over de vier
   werelden en vraagt de firewall of de ene wereld de andere iets mag neerleggen.
   NA de geldregie om de pasprijs; het fonds gaat laat gebonden mee. Zet ook de
   kostenhaak aan, die tot hier leeg was. */
Object.assign(kern, require('../kern/economie')({ db, save }));
/* De eerste sensor van AUTONOMIE (server/kern/bedrijfsmaat/): de bedrijfsmaten
   uitgerekend op de pasgeschiedenis, de laatste bezoekdag, de uitkomsten en de
   lidmaatschapstermijnen, en elk getal over mensen langs de groepspoort. Leest
   alleen; na de economielaag omdat elke maat een economische wereld draagt. */
kern.bedrijfsmaat = require('../kern/bedrijfsmaat/stand')({
  lees: { ritten: () => db.data.rides, bestellingen: () => db.data.orders,
    betaalschemas: () => db.data.lidmaatschapBetalingen },
  pasgeschiedenis: kern.pasgeschiedenis, aanwezigheid: kern.aanwezigheid });
Object.assign(kern, require('../kern/kosten')({ db, save, bewerkCollectie, accounts, economie: kern.economie,
  keyVanCodenaam, bestandenOpslag: kern.bestandenOpslag,
  geldPasprijzen: () => (kern.geldPasprijzen ? kern.geldPasprijzen() : null),
  fonds: () => kern.fonds }));
/* De betaallaag meldt zijn transactiekosten op het OPLAADMOMENT (WAARDE.md par.
   1). Late binding: pay wordt eerder gebouwd en hoeft niets van de kosten te
   weten -- zelfde draadje als koppelGrens in kernlaag3b. */
if (kern.pay && kern.pay.koppelKosten) kern.pay.koppelKosten(kern.kosten.meldTransactie);
// En de RTFoundation-kant: zonder dit ziet een gezin nooit wat de RTFoundation
// voor hem betaalt. Late binding; die router bestaat al.
if (kern.rtf && kern.rtf.setKostenHook) kern.rtf.setKostenHook(() => kern.kosten);
/* De ledenbalie hangt in ./kernlaag7.js, met een eigen kern (kern/ledenbalie*.js)
   en een eigen zetel. Hier stond een TWEEDE bedrading uit een andere tak die
   een maakLedenbalie() verwachtte die deze kern niet heeft -- de server startte
   er niet eens op. Een kamer, een deur, een bedrading. */
};
