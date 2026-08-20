/* ============================================================================
   DE KERN-AANBOUW, DEEL TWEE: identiteit, wonen, vervoer en clubs.

   RTG iD en de wallet, de zorgpolis, het huis (homekit, merken), vracht en
   gebouw, clubs, verzorging, de marina, de planners, Alpine en de lesmaker --
   met de routers die erop leunen. Vervolg van ./aanbouw.js; daar staat waarom
   deze twee gescheiden zijn.

   DE VOLGORDE IS GEDRAG: de zorgpolis wil de wallet die er vlak boven bij komt.
   ========================================================================== */
'use strict';

module.exports = function bouwKernAanTwee(kern, grens) {
  const { db, save, crypto, schoon, sseToCustomer, accounts, anthropic,
    beveilig, logboek, fs, path, DATA_DIR, rtf, gidsHaal, keyVanCodenaam, leeftijdVan, leeftijdInstr } = kern;
  /* RTG iD (kern/rtgid.js): de DigiD-vervanger op de eigen identiteitskluis;
     koppelcode-inlog met bevestiging in de app, selectieve gegevensdeling,
     inzagelog met intrekken en herroepbare machtigingen. */
  Object.assign(kern, require('../kern/rtgid').maakRtgid({ db, save, crypto, accounts, schoon, leeftijdVan, gidsHaal, keyVanCodenaam,
    /* Bevestigen vraagt een passkey (kern/rtgid.js legt uit waarom die eis daar
       staat en niet in de route). De MECHANIEK blijft in kern/webauthn.js: het
       doel waaraan de ceremonie hangt is de koppel-id, zodat een assertie die
       bij de ene inlog hoort niet op een andere past. De origin en de hostnaam
       komen uit het verzoek en reizen mee in `bewijs` -- die horen bij de deur
       en niet bij deze module. */
    stapOp: ({ user, doel, bewijs }) => kern.webauthnStapOpMaak(user, bewijs.ceremonie, bewijs.antwoord,
      bewijs.origin, bewijs.hostnaam, doel),
    passkeysVan: user => kern.webauthnAantal(user) }));
  require('../routes/rtgid')(grens('rtgid'));
  /* RTG Wallet (kern/wallet.js) en de zorgtak van de verzekeraar
     (kern/zorgpolis.js): de zorgpas op codenaam ligt direct in de wallet. */
  /* pay en codenaamVan komen erbij omdat de feestmunt sindsdien ECHT betaald
     wordt (kern/wallet.js). Allebei bestaan ze hier al lang: pay wordt in
     kernlaag3 gebouwd, de sociale kern nog eerder, en deze aanbouw hangt aan
     kernlaag7b -- er is dus niets laat te binden. */
  Object.assign(kern, require('../kern/wallet').maakWallet({ db, save, crypto, schoon,
    pay: kern.pay, codenaamVan: kern.codenaamVan }));
  Object.assign(kern, require('../kern/zorgpolis').maakZorgpolis({ db, save, crypto, schoon, keyVanCodenaam,
    walletVoeg: kern.walletVoeg, walletWegBron: kern.walletWegBron }));
  require('../routes/zorgwallet')(grens('zorgwallet'));
  require('../routes/stuur')(grens('stuur'));
  require('../routes/vonk')(grens('vonk'));
  require('../routes/voorspel')(grens('voorspel'));
  require('../routes/synergie')(grens('synergie'));
  require('../routes/balans')(grens('balans'));
  require('../routes/account')(grens('account'));
  /* De app-gids (kern/appgids.js): de leerlaag achter het ?-knopje dat de
     gedeelde basis-laag op elke app-pagina zet; openbare uitleg, geen data. */
  kern.appgids = require('../kern/appgids');
  require('../routes/gids')(grens('gids'));
  /* De RTG Home Kit (kern/homekit.js): alle elektronica van het lid op een
     plek, met AI-scenes; sloten blijven altijd handwerk van het lid zelf. */
  Object.assign(kern, require('../kern/homekit')({ db, save, crypto, schoon, anthropic }));
  Object.assign(kern, require('../kern/homemerken')({ db, save, schoon }));
  require('../routes/home')(grens('home'));
  /* RTG Vracht (kern/vracht.js): internationale vracht voor expediteurs, over
     lucht, water en land; publiek volgen op volgcode zonder klantgegevens. */
  Object.assign(kern, require('../kern/vracht')({ db, save, crypto, schoon }));
  require('../routes/vracht')(grens('vracht'));
  /* RTG Enterprise (kern/gebouw.js): het complete kantoorgebouw-systeem met
     receptie, zalen, badges, facilitair, valet en de luxe jetset-laag. */
  Object.assign(kern, require('../kern/gebouw')({ db, save, crypto, schoon }));
  require('../routes/gebouw')(grens('gebouw'));
  /* RTG Clubs (kern/clubs.js): de golf- en countryclub (teetimes, pro's,
     maandbeker) en de sport- en fitnessclub (leden, lessen, banen, PT). */
  Object.assign(kern, require('../kern/clubs')({ db, save, crypto, schoon }));
  require('../routes/clubs')(grens('clubs'));
  /* RTG Verzorging (kern/verzorging.js): de beauty-salon en barbier, petcare
     en de kinderopvang met nanny-service (mens bevestigt, alleen voornamen). */
  Object.assign(kern, require('../kern/verzorging')({ db, save, crypto, schoon }));
  require('../routes/verzorging')(grens('verzorging'));
  /* RTG Marina (kern/marina.js): de jachthaven met ligplaatsen, passanten,
     de brandstofsteiger, service/helling en de marina-concierge op het water. */
  Object.assign(kern, require('../kern/marina')({ db, save, crypto, schoon }));
  require('../routes/marina')(grens('marina'));
  /* RTG Planners & Advies (kern/planners.js): weddings en prive-events,
     professionele diensten en verzekeringen; de mens houdt het laatste woord. */
  Object.assign(kern, require('../kern/planners')({ db, save, crypto, schoon }));
  require('../routes/planners')(grens('planners'));
  /* RTG Alpine (kern/alpine.js): het wintersport- en seizoensresort met
     pistes, liften, het lawineniveau van de berggids, skischool en chalets. */
  Object.assign(kern, require('../kern/alpine')({ db, save, crypto, schoon }));
  require('../routes/alpine')(grens('alpine'));
  /* De Lesmaker (kern/lesmaker.js): leraren maken met AI lesstof uit de
     bibliotheken en zetten die live op de klas-PDA van de kinderen. */
  Object.assign(kern, require('../kern/lesmaker')({ db, save, crypto, schoon, anthropic, leeftijdInstr: rtf.leeftijdInstr }));
  require('../routes/lesmaker')(grens('lesmaker'));
  // De Zaakdoos-vloot (satelliet-ping + /api/doos/*); altijd-aan, achter de
  // gedeelde sleutel. Na kern gemount omdat de meting-route kern.afdelingen leest.
  require('../routes/doos')(grens('doos'));
  require('../routes/code')(grens('code'));
  /* RTG LINK (kern/link/, LINK.md): de adres- en capabilitylaag. Een gescande
     code -> welk TYPE ding is dit -> wie of wat is het -> wat mag DEZE scanner
     hier vragen. Staat NA routes/code.js omdat hij dezelfde ondertekening leest,
     en hij haalt zijn oplossers op bij de deuren die er al zijn: de contactpin
     (kern/sociaal/pin*.js) en de zakenlijst. Niets ervan wordt hier herbouwd --
     de laag schikt bestaande stappen, en de rem die ze delen woont sinds deze
     ronde in kern/link/rem.js. */
  Object.assign(kern, require('../kern/link')({
    db: kern.db, save: kern.save, crypto,
    dyncodeGeef: () => kern.dyncode,
    codenaamVan: (sleutel) => kern.codenaamVan(sleutel),
    // dezelfde teller als de rest van deze laag gebruikt, per lid per onderwerp
    rate: (wie, wat, max, perMs) => kern.sociaalRate(wie, wat, max, perMs),
    handleVanPin: (pin) => kern.handleVanPin(pin),
    pinNormaliseer: (ruw) => kern.pinNormaliseer(ruw),
    pinKijk: (mij, doel) => kern.pinKijk(mij, doel),
    liveKijk: (mij, token) => kern.liveKijk(mij, token),
    /* Dezelfde teller als de pindeur, met dezelfde sleutel: dertig pogingen per
       uur per lid, hoe je ze ook verdeelt over de twee loketten. */
    persoonRate: (mij) => kern.sociaalRate(mij, 'pinzoek', 30, 60 * 60 * 1000),
    /* De stand van een band, voor "wat kan ik hier nog aan doen" in mijn
       koppelingen. Uit de sociale kern gehaald en niet nagerekend: of een
       verzoek nog openstaat is daar de waarheid. */
    bandStand: (mij, ander) => kern.statusVan(mij, kern.connectieTussen(mij, ander)),
    zaakVan: (code) => kern.findSupplier(code)
  }));
  /* De eerste capability, en hij komt uit het domein dat hem bezit: RTG Pay.
     "Betaal mij 18,50 voor diner" als code van twee minuten. De linklaag laat
     hem zien en laat een mens bevestigen; het boeken zelf blijft in kern/pay --
     daar is maar EEN plek waar geld beweegt, en die blijft het.

     Hier en niet in kernlaag3 (waar RTG Pay wordt gebouwd), omdat de linklaag
     pas hierboven bestaat. Aanmelden gooit bij een definitie die niet deugt, en
     dat hoort: een half register is een register dat je pas wantrouwt nadat er
     iets misging. */
  kern.linkHandeling(require('../kern/pay/vraagcode')({
    pay: kern.pay,
    payGate: kern.onboarding && kern.onboarding.payGate,
    schoon: kern.schoon
  }));
  /* En de tweede: de kassacode, die al bestond en nu een capability IS in plaats
     van een leesbare code in een QR. De eerste die een ZAAK aanvaardt. */
  kern.linkHandeling(require('../kern/pay/kassacode')({ pay: kern.pay, schoon: kern.schoon }));
  /* En de inner die daarbij hoort: vier kassa-ingangen, een manier waarop een
     betaalcode binnenkomt. Hij hangt HIER omdat hij de linklaag nodig heeft, en
     hij leest die pas bij de aanroep -- vandaar dat hij `kern` als geheel
     meekrijgt (zie de kop van kern/pay/kasinnen.js). */
  kern.kasInnen = require('../kern/pay/kasinnen')(kern);
  require('../routes/link')(grens('link'));
  // RTG Veilig: Thuiswacht, Codewoord, Vitale check-in en Thuisrust.
  require('../routes/veiligheid')(grens('veiligheid'));
  require('../routes/instant-reality')(grens('instant-reality'));
  /* De RTG Life-stapel staat in ./aanbouw3.js. Die hangt hier ONDERAAN en niet
     ergens in het midden: elke laag daar leest lagen die hierboven zijn
     gemonteerd (de agenda, zorg, verzorging, de identiteitskluis). */
  require('./aanbouw3')(kern, grens);
};
