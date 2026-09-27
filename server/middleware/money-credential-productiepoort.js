/* Productiegrendel voor geld-dragende codes die nog niet door de volledige
   lifecycle- en atomiciteitsproef zijn gekomen.

   Dit is bewust geen featureflag. Een omgevingsvariabele waarmee een beheerder
   deze deur toch open kan zetten, zou van een releaseblokkade een waarschuwing
   maken. De enige manier om een onderdeel te openen is zijn opslag- en
   geldtransactie aantoonbaar repareren, de control-tests toevoegen en deze
   grendel in code verwijderen.

   De grendel staat in de HTTP-keten vóór idemopslag en handlers. De pay-kern
   gebruikt dezelfde `blokkade` ook rechtstreeks: achtergrondwerk, een nieuwe
   route of een ondertekende Link-capability kan de HTTP-lijst daardoor niet
   omzeilen. Een intrekking/vrijgave staat niet in de lijst wanneer die veilig
   moet blijven om geld aan de gebruiker terug te geven. */
'use strict';

const CODE = 'MONEY_CREDENTIAL_NOT_RELEASED';
const BERICHT = 'Deze betaalwijze is nog niet voor productie vrijgegeven. Er is niets afgeschreven of uitgegeven.';

const EXACT = new Map([
  ['/api/pay/kascode', 'pay.kascode_en_vooraf'],
  ['/api/supplier/pay/in', 'pay.kascode_en_vooraf'],
  ['/api/supplier/pay/vooraf', 'pay.kascode_en_vooraf'],
  ['/api/supplier/pay/vastleg', 'pay.kascode_en_vooraf'],
  /* Dit supplier-loket accepteert momenteel uitsluitend `geld.kassa`; andere
     capabilities noemen supplier niet als aanvaarder. Daarom kan het exact
     dicht zonder een veilige Link-handeling te raken. */
  ['/api/supplier/link/cap/aanvaard', 'pay.kascode_en_vooraf'],

  ['/api/pay/tikcode', 'pay.tikcode'],
  ['/api/pay/tik', 'pay.tikcode']

  /* pay.tegoedbon staat hier sinds 27 september 2026 niet meer: hash-only,
     128 bits, een claim in een collectietransactie en een economische sleutel
     onder de boeking (kern/pay/tegoed-*.js, CODECREDENTIALS.json). Een deur gaat
     alleen zo open -- door de reparatie, niet door een vlag. */

  /* pay.giftcard_value_code evenmin sinds 27 september 2026: 128 bits,
     hash-only, intrekken en roteren, en de verzilvering in een
     collectietransactie op giftcards (kern/cadeaukaart*.js). Ook de
     kassabon met betaalwijze cadeaukaart gaat daar langs. */
]);

/* De AFHAALCODE (pay.order_pickup_code) staat hier sinds 27 september 2026
   niet meer: hij is een 128-bit bearer met hash-only opslag, vervaltijd,
   intrekking, rotatie en een atomaire claim (server/kern/afhaalcode.js), met
   bewijs in test/afhaalcode.test.js en de PostgreSQL-raceproef. De generator
   pickupCode (kern/util.js) bestaat nog, maar alleen als BONNUMMER: een label voor
   keuken, pas en kassabon dat niets autoriseert. Deze indeling wordt door de
   test tegen de bron gehouden, zodat een nieuwe aanroeper niet stil alsnog
   een bearer van vier tekens maakt: de kassa zoekt niet meer op `pickup`. */
const PICKUP_CODE_ISSUERS = Object.freeze({
  bonnummer: Object.freeze([
    'server/kern/lidacties/bestellen.js',
    'server/routes/member/kopen/bezorg.js',
    'server/routes/supplier/kassa/afrekenen.js',
    'server/routes/supplier/kassa/premium.js',
    'server/routes/supplier/kassa/verkoop.js',
    'server/routes/supplier/kassa/innen.js',
    'server/routes/supplier/kamers/voorzieningen.js',
    'server/routes/supplier/orders/keukenlijn.js'
  ])
});

/* Alternatieve kassaschermen delen dezelfde kerncode. Ze blijven voor contant
   of pin bruikbaar; alleen de RTG-Pay-tak is een consumer van kascode. */
const KAS_CONDITIONEEL = new Map([
  ['/api/supplier/pos/sale', 'method'],
  ['/api/supplier/pos/checkout', 'method'],
  ['/api/supplier/tafelticket/afrekenen', 'method'],
  ['/api/supplier/retail/verkoop', 'method'],
  ['/api/supplier/ticket/deurverkoop', 'method'],
  ['/api/festival/verkoop/rond', 'methode']
]);

function productie(env) {
  return String((env || process.env).NODE_ENV || '') === 'production';
}

function blokkade(feature, env) {
  if (!productie(env)) return null;
  return { status: 503, code: CODE, feature: String(feature || 'money_credential'), error: BERICHT };
}

function featureVoor(req) {
  if (String(req && req.method || '').toUpperCase() !== 'POST') return null;
  /* Express routeert standaard niet hoofdletter- of slash-strikt. De poort
     moet dus dezelfde canonieke ingang bewaken; anders bereikt `/KASCODE/` wel
     de handler maar niet deze grendel. */
  let pad = String(req && (req.path || req.url) || '').split('?')[0];
  /* Conservatief decoderen: Express decodeert routecomponenten wanneer hij een
     handler kiest. Een geencodeerde letter mag de grendel niet anders lezen dan
     de router. Ongeldige escapes matchen geen van onze bekende routes. */
  try { pad = decodeURIComponent(pad); } catch (e) {}
  pad = pad.toLowerCase();
  if (pad.length > 1) pad = pad.replace(/\/+$/, '');
  const vast = EXACT.get(pad);
  if (vast) return vast;
  if (pad === '/api/link/cap/maak' &&
      String(req && req.body && req.body.handeling || '').toLowerCase() === 'geld.kassa') {
    return 'pay.kascode_en_vooraf';
  }
  /* De algemene kassaverkoop blijft voor contant en pin beschikbaar. Alleen de
     takken die een nog-onbewezen bearer consumeren gaan dicht. De body is op
     deze plek al begrensd en ontleed door de lijfpoort. */
  const veld = KAS_CONDITIONEEL.get(pad);
  if (veld) {
    const methode = String(req && req.body && req.body[veld] || '').toLowerCase();
    if (methode === 'rtgpay' || methode === 'rtg') return 'pay.kascode_en_vooraf';
  }
  return null;
}

function antwoord(res, dicht) {
  return res.status(dicht.status).json({
    error: dicht.error,
    code: dicht.code,
    feature: dicht.feature
  });
}

module.exports = function moneyCredentialProductiepoort({ env } = {}) {
  return (req, res, next) => {
    if (!productie(env)) return next();
    const feature = featureVoor(req);
    return feature ? antwoord(res, blokkade(feature, env)) : next();
  };
};

module.exports.blokkade = blokkade;
module.exports.featureVoor = featureVoor;
module.exports.EXACT = EXACT;
module.exports.KAS_CONDITIONEEL = KAS_CONDITIONEEL;
module.exports.PICKUP_CODE_ISSUERS = PICKUP_CODE_ISSUERS;
module.exports.CODE = CODE;
module.exports.BERICHT = BERICHT;
