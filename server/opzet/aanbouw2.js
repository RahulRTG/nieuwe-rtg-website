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
  Object.assign(kern, require('../kern/rtgid').maakRtgid({ db, save, crypto, accounts, schoon, leeftijdVan, gidsHaal, keyVanCodenaam }));
  require('../routes/rtgid')(grens('rtgid'));
  /* RTG Wallet (kern/wallet.js) en de zorgtak van de verzekeraar
     (kern/zorgpolis.js): de zorgpas op codenaam ligt direct in de wallet. */
  Object.assign(kern, require('../kern/wallet').maakWallet({ db, save, crypto, schoon }));
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
  // RTG Veilig: Thuiswacht, Codewoord, Vitale check-in en Thuisrust.
  require('../routes/veiligheid')(grens('veiligheid'));
  // Wie ben ik voor Rahul: omgang, voornaamwoorden en de eigen geloofskeuze.
  require('../routes/ik')(grens('ik'));
};
