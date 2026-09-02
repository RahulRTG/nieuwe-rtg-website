/* EEN VERZOEK VERTALEN NAAR DRAGERS -- de enige plek waar dat gebeurt.

   WAAROM DIT BESTAAT. Drie plekken bouwden deze vertaling elk met de hand op uit
   geraden sessievelden: `s.id || s.sid || s.key`. `s.id` en `s.sid` bestaan
   nergens -- de sessie wordt per verzoek opgebouwd als `{ tier, key, account }`
   -- dus `sessie` viel stil terug op de IDENTITEITsleutel. Twee lagen zetten
   daarmee in werkelijkheid dezelfde stand: een lid dat "alleen deze inlog"
   dichtzette, zette zichzelf overal dicht, en niets zei dat.

   Twee van die drie plekken (de handhavingsweg: kern/stuur/luscontext.js en
   routes/stuur.js) lieten `apparaat` en `organisatie` bovendien helemaal weg,
   dus de join was daar onvolledig. Een vertaling die op drie plekken staat, is
   op zijn hoogst op een van die plekken goed.

   HIJ LEEST ALLEEN DE SESSIE EN DE AUTHORIZATION-KOP, en nooit req.body. Dat is
   de regel die deze hele laag draagt: zou een lid zijn eigen sleutel mogen
   meesturen, dan kan hij de sessie van iemand anders in isolatie zetten -- een
   aardig klinkende functie die in werkelijkheid een uitlogknop voor willekeurige
   leden is.

   WAT ONTBREEKT, KOMT TERUG MET ZIJN REDEN. Niet als kale `null`: een scherm dat
   een laag aanbiedt die niets doet, is erger dan een scherm dat de laag niet
   aanbiedt. De reden staat in ./dragers.js (`geenSleutel`) en wordt hier
   letterlijk doorgegeven -- niet overgetypt. */
'use strict';

const { tokenHash } = require('../sessies');
const dragerlijst = require('./dragers');
const accounts = require('../../accounts');

/* De dragers die een LID zelf kan zetten. Eén lijst, en deze is hem: hij stond
   ook in ./index.js overgetypt (`EIGEN_DRAGERS`) en in routes/isolatie.js
   (`EIGEN_LAGEN`), en drie kopieën van "wat is van mij" lopen uiteen zodra er
   een drager bij komt. */
const EIGEN_LAGEN = Object.freeze(['identiteit', 'sessie', 'apparaat']);

function bearerVan(req) {
  const kop = (req && typeof req.get === 'function' ? req.get('authorization') : '') || '';
  return kop.startsWith('Bearer ') ? kop.slice(7) : null;
}

/* Geeft { sleutels, ontbreekt } terug. `sleutels` is wat er WEL is;
   `ontbreekt` zegt per ontbrekende drager waarom, met de tekst uit dragers.js. */
function dragersVanVerzoek(req) {
  const s = (req && req.session) || {};
  const token = bearerVan(req);

  const sleutels = {
    /* De identiteit: dit lid, over al zijn inlogs heen. */
    identiteit: s.key || null,
    /* De sessie: DEZE inlog. Eén login is één sleutel, dus twee logins van
       hetzelfde account krijgen twee sessies -- wat de drager altijd al
       beloofde. De hash komt uit kern/sessies.js en is dus dezelfde die bepaalt
       of u bent ingelogd; een tweede definitie zou hier twee waarheden geven. */
    sessie: token ? tokenHash(token) : null,
    /* Het apparaat: alleen als er met een PASSKEY is ingelogd. De sleutel zit in
       het ondertekende token en wordt pas gelezen NA verificatie van die
       handtekening -- zonder die volgorde zou een aanvaller zijn eigen
       toestelkenmerk kunnen kiezen door het token te herschrijven, en dan is de
       drager een veld uit het verzoek. Bij een wachtwoordinlog blijft hij leeg,
       met de reden uit dragers.js. */
    apparaat: (token && typeof accounts.apparaatVanToken === 'function'
      ? accounts.apparaatVanToken(token) : null) || null,
    organisatie: null
  };

  const ontbreekt = {};
  for (const naam of ['identiteit', 'sessie', 'apparaat', 'organisatie']) {
    if (sleutels[naam]) continue;
    const d = dragerlijst.OP_NAAM[naam] || {};
    ontbreekt[naam] = d.geenSleutel ||
      (naam === 'sessie' ? 'dit verzoek draagt geen bearer-token' : 'geen sleutel beschikbaar');
  }
  return { sleutels, ontbreekt };
}

module.exports = { dragersVanVerzoek, EIGEN_LAGEN, bearerVan };
