/* ============================================================================
   DE LIJST, DEEL TWEE -- IDENTITEIT, GENRE, EN WAT GEEN DEUR IS.

   Drie soorten die niets met elkaar te maken hebben behalve dat ze geen
   objectpoort zijn (die staan in ./lijst.js):

     AUTHENTICATED  de identiteit staat al vast; deze poort VERSMALT hem
                    (geen gast, een manager, een eigen account).
     genre-cap      wat voor soort ZAAK dit is -- geen capability, zie ./index.js.
     geen deur      een rem of een volledigheidscontrole. Ze staan er MET NAAM
                    bij en niet weggelaten: een poort die je niet als deur
                    herkent belandt stil als "geen deur" in het register, en dan
                    weet niemand of dat gemeten is of vergeten.

   naam -> { toegang, veld?, versmalt?, genre?, soort?, wat }
   ========================================================================== */
'use strict';

const POORTEN = {
  /* ---- AUTHENTICATED: de identiteit staat al vast, deze poort versmalt hem ---- */

  'geenGast': { toegang: 'AUTHENTICATED', versmalt: 'geen anonieme demo-gast',
    wat: 'een echt account mag, ook de gratis laag; alleen een anonieme gast niet' },
  'eisAccount': { toegang: 'AUTHENTICATED', versmalt: 'een eigen RTG-account',
    wat: 'req.session.account moet bestaan' },
  'echtId': { toegang: 'AUTHENTICATED', versmalt: 'een eigen RTG-account, geen gast',
    wat: 'weigert tier "guest" en een sessie zonder account; geeft anders het account-id terug' },
  'sessie': { toegang: 'AUTHENTICATED', versmalt: 'RTF-lid, geen gast',
    wat: 'sessieVan() plus de eis dat het profiel geen gast is -- een Foundation-adres is voor RTF-leden' },
  'managerOnly': { toegang: 'AUTHENTICATED', versmalt: 'manager',
    wat: 'req.actor.manager, gezet door supplierAuth' },
  'managerOf': { toegang: 'AUTHENTICATED', versmalt: 'manager',
    wat: 'req.actor.manager, gezet door supplierAuth' },
  'actor': { toegang: 'AUTHENTICATED', versmalt: 'een zaak in de sessie',
    wat: 'wie.vanZaak(req); 401 zonder zaak' },
  'alleenPersoneel': { toegang: 'AUTHENTICATED', versmalt: 'personeelslogin',
    wat: 'req.actor.staffId moet bestaan voor het personeelsstuur' },
  'alleenBaas': { toegang: 'AUTHENTICATED', versmalt: 'de eigenaar',
    wat: 'isBaas(req) -- alleen de eigenaar komt bij het papierwerk' },
  'eigenaarAlleen': { toegang: 'AUTHENTICATED', versmalt: 'de eigenaar',
    wat: 'eigenaar.isEigenaar(accounts, req.session.account) -- alleen de eigenaar beheert de platform-onboarding' },
  'lid': { toegang: 'AUTHENTICATED', versmalt: 'geen gast',
    wat: 'req.session.tier !== guest' },
  'gast': { toegang: 'AUTHENTICATED', versmalt: 'geen gast',
    wat: 'RTG Bank is voor leden' },
  'gate': { toegang: 'AUTHENTICATED', versmalt: 'geen gast, en de bank moet live zijn',
    wat: 'gast() plus dicht(): een schakelaar en een identiteit in een poort' },
  'geenEchtAccount': { toegang: 'AUTHENTICATED', versmalt: 'een echt account',
    wat: 'een anonieme gast kan niet met RTG Pay betalen' },
  'geenEchtAccount': { toegang: 'AUTHENTICATED', versmalt: 'een echt account',
    wat: 'een anonieme gast kan niet met RTG Pay betalen' },
  'echtAccount': { toegang: 'AUTHENTICATED', versmalt: 'een echt account',
    wat: 'de algemene pin hoort bij een echt RTG-account' },
  'echtAccount': { toegang: 'AUTHENTICATED', versmalt: 'een echt account',
    wat: 'de rollenkoppeling hoort bij een echt RTG-account' },
  'eigenSleutel': { toegang: 'AUTHENTICATED', versmalt: 'een echt account',
    wat: 'een vakbewijs hoort bij een echt RTG-account' },
  'echtLid': { toegang: 'AUTHENTICATED', versmalt: 'een echt account',
    wat: 'meedoen aan het Lab-fonds vraagt een gratis RTG-account' },
  'ontmoetKey': { toegang: 'AUTHENTICATED', versmalt: 'een echt account',
    wat: 'eisAccount() en dan de eigen sessiesleutel' },
  'lidOk': { toegang: 'AUTHENTICATED', versmalt: 'Business Pass',
    wat: 'borden zijn onderdeel van de Business Pass' },
  'eis': { toegang: 'AUTHENTICATED', versmalt: 'Lifestyle of Business Pass',
    wat: 'deze app is onderdeel van de Lifestyle Pass' },
  'eis': { toegang: 'AUTHENTICATED', versmalt: 'Lifestyle of Business Pass',
    wat: 'Rendez-vous is voor Signature-members' },
  'kyc': { toegang: 'AUTHENTICATED', versmalt: 'kyc afgerond',
    wat: 'onboarding.payGate(req.session)' },

  /* ---- genre-cap: WAT VOOR SOORT ZAAK is dit. Geen capability -- zie de kop ---- */

  'eisRetail': { toegang: 'AUTHENTICATED', genre: 'retail',
    wat: "db.capsVan(req.supplier).includes('retail')" },
  'eisVracht': { toegang: 'AUTHENTICATED', genre: 'vracht',
    wat: "db.capsVan(req.supplier).includes('vracht')" },
  'eisVak': { toegang: 'AUTHENTICATED', genre: 'vak',
    wat: 'vak().isVak(req.supplier) -- alleen voor dienstverlenende zaken' },
  'eisDorp': { toegang: 'AUTHENTICATED', genre: 'verblijf-afdelingen',
    wat: 'dorpKan(req.supplier) -- heeft deze zaak een afdelingenbord' },
  'eisBeveiliging': { toegang: 'AUTHENTICATED', genre: 'beveiliging',
    wat: 'bevIsBeveiliging(req.supplier)' },
  'eisGroothandel': { toegang: 'AUTHENTICATED', genre: 'groothandel',
    wat: 'de zaak moet een groothandel zijn' },
  'ovZaakOnly': { toegang: 'AUTHENTICATED', genre: 'ov',
    wat: "req.supplier.type !== 'ov'" },
  'ovZaakOnly': { toegang: 'AUTHENTICATED', genre: 'ov',
    wat: "req.supplier.type !== 'ov'" },
  'eisSalonProfiel': { toegang: 'AUTHENTICATED', genre: 'salon',
    wat: 'de zaak moet een salonprofiel hebben' },
  'eisSalonProfiel': { toegang: 'AUTHENTICATED', genre: 'salon',
    wat: 'de zaak moet een salonprofiel hebben' },

  /* ---- geen deur: wel een rem, geen identiteit ---- */

  'geremd': { toegang: null, soort: 'geen-deur',
    wat: 'uitsluitend een snelheidsrem per IP; stelt geen identiteit vast' },
  'doosSleutelOk': { toegang: null, soort: 'geen-deur',
    wat: 'telt afketsers per IP voordat de sleutel wordt gecontroleerd; de rem, niet de deur' },
  /* GEEN DEUR, EN DAT IS HIER HET PUNT: gegevensStop kijkt of de SESSIE de
     gegevens draagt die een handeling nodig heeft (een bezorgadres, een
     geboortedatum) en stelt geen identiteit vast -- die staat al vast als hij
     draait. Hem als deur tellen geeft 22 routes een klasse die zij niet aan hem
     ontlenen. Zie kern/gegevenspoort.js, stop(). */
  'gegevensStop': { toegang: null, soort: 'geen-deur',
    wat: 'volledigheidscontrole op de sessiegegevens; stelt geen identiteit vast en versmalt er geen' }
};

module.exports = { POORTEN };
