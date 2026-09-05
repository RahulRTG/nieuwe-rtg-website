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
   `ontbreekt` zegt per ontbrekende drager waarom, met de tekst uit dragers.js.

   TWEE INGANGEN EN EEN LICHAAM. `dragersVanVerzoek` is de weg voor een ROUTE:
   die draait na `auth`, dus req.session bestaat. Een MIDDLEWARE die vóór elke
   router staat heeft die sessie nog niet -- hij moet hem zelf oplossen uit het
   token -- en krijgt daarom `dragersVanSessie`. De regel "de sleutel komt uit de
   sessie en nooit uit het verzoek" staat daarmee nog steeds op een plek; alleen
   de manier waarop de sessie binnenkomt verschilt. Twee kopieën van dit lichaam
   zouden na een jaar twee verschillende sleutels opleveren voor dezelfde mens. */
/* DE SESSIE UIT EEN TOKEN, met late binding -- zelfde patroon als zetLaag in
   middleware/isolatiepoort.js, en om dezelfde reden.

   WAAROM DIT ERBIJ MOEST, en het is de duurste bevinding van deze laag. Een
   middleware staat VOOR `auth`, dus req.session bestaat daar niet. `identiteit`
   viel daardoor terug op null, en de isolatiepoort kon een stand op `identiteit`
   niet zien -- terwijl dat precies is wat een lid zet als hij zijn account
   beschermt (routes/isolatie.js: `String(b.drager || 'identiteit')`).

   GEMETEN en niet vermoed (scripts/isolatieschaduw.js): met een stand op
   `sessie` woog de poort 117 verzoeken en zou hij er onder `isolatie` 85
   sluiten; met dezelfde stand op `identiteit` woog hij er NUL. De laag stond
   dus aan, telde netjes, en keek langs de gewoonste beschermstand heen.

   HIJ WORDT INGEHANGEN EN NIET NAGEBOUWD. opzet/diensten2.js heeft precies een
   resolveSession, met twee takken (een demo-sessie in het geheugen en een
   ondertekend accounttoken). Die hier overtypen zou een tweede antwoord geven op
   "wie is dit" zodra er een derde tak bij komt -- en dan zet een lid zich dicht
   op een sleutel die de poort niet kent. Zonder oplosser blijft `identiteit`
   gewoon null, met zijn reden: dat is minder dan het kan zijn, maar het is nooit
   een VERKEERDE sleutel. */
let oplosSessie = null;
function zetSessieOplosser(fn) { oplosSessie = typeof fn === 'function' ? fn : null; }
function sessieOplosserGereed() { return typeof oplosSessie === 'function'; }
function losSessie(token) {
  if (!token) return null;
  if (!oplosSessie) throw new Error('isolatie/sessiedragers: de centrale sessieoplosser is niet gemonteerd');
  return oplosSessie(token) || null;
}

function dragersVanSessie(sess, token) {
  /* De sessie wordt alleen opgelost als hij er niet al is: een aanroeper die hem
     meegeeft, heeft hem via `auth` gekregen en dat is dezelfde bron. */
  const s = sess || (token ? (losSessie(token) || {}) : {});

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

/* De routekant: de sessie staat er al, het token staat in de kop. */
function dragersVanVerzoek(req) {
  return dragersVanSessie((req && req.session) || null, bearerVan(req));
}

module.exports = { zetSessieOplosser, sessieOplosserGereed, losSessie,
  dragersVanVerzoek, dragersVanSessie, EIGEN_LAGEN, bearerVan };
