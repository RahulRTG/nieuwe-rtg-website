/* WELKE BASIS MAG EEN LINK IN EEN E-MAIL KRIJGEN ALS APP_URL ONTBREEKT?

   De kop van appUrl() in ../server.js legt uit waarom de Origin- en Host-kop
   geen bron zijn voor een herstellink: die zet de aanvrager zelf, en dan stuurt
   RTG een echte mail met een echt hersteltoken naar het domein van een
   aanvaller. In productie was dat al dicht. BUITEN productie nam appUrl() de kop
   nog gewoon over, en "buiten productie" is ook een server zonder NODE_ENV op een
   publiek adres. Een POST /api/auth/forgot met `Origin: https://kwaad.example`
   schreef die link in de outbox.

   DE REGEL. Een kop mag de basis alleen leveren als de link die eruit ontstaat
   naar DEZE machine of het eigen netwerk wijst (../lib/lokaaladres.js) -- dan
   kan een aanvaller er niets mee, want het token komt terecht bij een adres van
   het slachtoffer zelf. In de toetsstand mag het altijd: die luistert alleen op
   de loopback (../config/omgeving.js) en zijn toetsen lopen op wisselende
   poorten. In alle andere gevallen is er GEEN basis, en dan weigert de route
   die een link wil versturen met de reden -- liever geen mail dan een mail met
   het domein van iemand anders. */
'use strict';
const { lokaalAdres } = require('./lokaaladres');

/* Is de host van deze URL lokaal? Een IPv6-adres tussen haken wordt hier zelf
   gelezen: lokaalAdres() knipt op de eerste dubbele punt, en dan heet elk
   IPv6-adres "lokaal" omdat er een lege naam overblijft. */
function lokaleUrl(url) {
  let host;
  try { host = new URL(url).hostname.toLowerCase(); } catch (e) { return false; }
  if (!host) return false;
  if (host.startsWith('[')) return host === '[::1]';
  return lokaalAdres(host);
}

/* De basis uit het verzoek, of '' als die niet te vertrouwen is. */
function basisUitVerzoek(req, env) {
  if (!req || !req.headers) return '';
  const kandidaat = req.headers.origin || (req.protocol && req.get ? req.protocol + '://' + req.get('host') : '');
  if (!kandidaat || kandidaat === 'null') return '';
  if ((env || process.env).NODE_ENV === 'test') return kandidaat;
  return lokaleUrl(kandidaat) ? kandidaat : '';
}

const ONTBREEKT = 'APP_URL ontbreekt: deze installatie kent haar eigen adres niet, en een link in een e-mail '
  + 'wordt nooit gebouwd uit een adres dat de aanvrager meestuurt. Zet APP_URL, of open de site via een lokaal adres.';

module.exports = { basisUitVerzoek, lokaleUrl, ONTBREEKT };
