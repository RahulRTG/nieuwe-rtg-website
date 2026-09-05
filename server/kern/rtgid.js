/* RTG iD: de eigen digitale identiteit van het ecosysteem, gebouwd als
   DigiD-vervanger op de bestaande identiteitskluis. Beter, sneller,
   efficienter en veiliger door ontwerp:

   - Sneller: een dienst start een inlog en krijgt een koppelcode; het lid
     bevestigt in de eigen app met zijn passkey -- gezicht, vinger of pincode
     op het eigen toestel. Geen wachtwoord, geen sms.
   - Het is de PERSOON die bevestigt, niet het toestel. Een tik alleen bewees
     dat iemand de telefoon had waarop de sessie leeft; een geleend of gestolen
     toestel met een openstaande app kon dus een identiteit weggeven. De
     passkey-ceremonie hangt bovendien aan DEZE koppel, dus een opgevangen
     assertie past niet op een andere inlog. Zie bevestig() hieronder.
   - Veiliger (phishing-bestendig): de code loopt van het scherm van de
     dienst NAAR het lid, en het lid ziet in de eigen app welke dienst er
     aanklopt en welke gegevens die vraagt, voor er iets gebeurt. Een
     opgevangen code is binnen twee minuten waardeloos; tokens staan
     alleen gehasht op de server en leven kort.
   - Efficienter (selectieve deling): een dienst krijgt alleen de gevraagde
     en toegestane attributen. Wie alleen "18 of ouder" hoeft te weten,
     krijgt een bewijs 18plus en nooit de geboortedatum.
   - Beter: een volledig inzagelog (wie vroeg wat, wanneer), actieve
     sessies die het lid per dienst kan intrekken, en machtigingen
     (mantelzorg): een ander mag tijdelijk namens u inloggen, herroepbaar,
     en elke inlog namens u staat in uw eigen log.

   Opslag in de eigen collectie rtgid; maakRtgid(state) volgt het vaste kern-patroon. */

const { idVanKey } = require('../lib/lidsleutel');

const KOPPEL_TTL_MS = 2 * 60 * 1000;      // een koppelcode leeft twee minuten
const SESSIE_TTL_MS = 20 * 60 * 1000;     // een iD-sessie bij een dienst: twintig minuten
const MAX_LOG = 100, MAX_KOPPELS = 300, MAX_SESSIES = 300;
const ATTRIBUTEN = ['codenaam', '18plus', 'leeftijd', 'nationaliteit', 'naam'];
/* Daarnaast kan een dienst een BEWIJS vragen: `bewijs:vog`, `bewijs:big`. Die
   staan niet in de lijst hierboven omdat ze uit een ander register komen
   (kern/persoonseis-lijst.js, via ./rtgid-bewijs.js) en daar worden afgeleid in
   plaats van hier overgetypt. Wat er dan terugkomt is een vinkje en hooguit een
   einddatum -- nooit het nummer, nooit een lijst stukken. Zie de kop daar. */
const { isBewijsAttribuut } = require('./rtgid-bewijs');
const magVragen = (a) => ATTRIBUTEN.includes(a) || isBewijsAttribuut(a);

function maakRtgid({ db, save, bewerkCollectie, crypto, accounts, schoon, leeftijdVan, gidsHaal, keyVanCodenaam, stapOp, passkeysVan, vakbewijsBron }) {
  const eigen = require('./eigencollectie')({ db, domein: 'kern/rtgid', bezit: { rtgid: 'kaart' } });
  const nu = () => Date.now();
  const iso = t => new Date(t == null ? Date.now() : t).toISOString();
  const hash = t => crypto.createHash('sha256').update(String(t)).digest('hex');
  const vorm = b => {
    if (!Array.isArray(b.koppels)) b.koppels = [];
    if (!Array.isArray(b.sessies)) b.sessies = [];
    if (!b.logs || typeof b.logs !== 'object' || Array.isArray(b.logs)) b.logs = {};
    if (!Array.isArray(b.machtigingen)) b.machtigingen = [];
    return b;
  };
  function S() { return vorm(eigen.bak('rtgid', vorm)); }
  const cap = (l, m) => { if (l.length > m) l.length = m; };
  function logVan(key, bron) { const s = bron ? vorm(bron) : S(); if (!s.logs[key]) s.logs[key] = []; return s.logs[key]; }

  const toegang = require('./rtgid-koppeltoegang')({ crypto, nu: () => iso(), koppelTtlMs: KOPPEL_TTL_MS });
  const herstel = (doel, json) => {
    const oud = JSON.parse(json);
    for (const k of Object.keys(doel)) delete doel[k];
    Object.assign(doel, oud);
  };
  function metStaat(werk) {
    const doe = bron => {
      const s = vorm(bron);
      toegang.migreerLegacy(s);
      const antwoord = werk(s);
      if (antwoord && typeof antwoord.then === 'function')
        throw new Error('Een RTG-iD-collectietransactie mag niet asynchroon zijn.');
      return antwoord;
    };
    if (typeof bewerkCollectie === 'function') return bewerkCollectie('rtgid', doe);
    const s = S(), voor = JSON.stringify(s);
    try {
      const antwoord = doe(s);
      if (JSON.stringify(s) !== voor) save();
      return antwoord;
    } catch (e) { herstel(s, voor); throw e; }
  }

  function accountVanKey(key) {
    const id = idVanKey(key);
    if (id == null) return null;
    try { return accounts.getUserById(id); } catch (e) { return null; }
  }
  const codenaamUit = key => ((typeof gidsHaal === 'function' ? gidsHaal(key) : null) || {}).codename || 'lid';

  /* Wat een dienst te horen krijgt en waar dat op rust, staat apart in
     ./rtgid-claims.js: selectieve deling, het afgeleide 18plus-bewijs, de
     herkomst van de leeftijd en het betrouwbaarheidsniveau. Dit bestand gaat
     over WIE er aanklopt en of het lid akkoord gaat; dat over WAT er dan de
     deur uit mag. De gedeelde helpers gaan mee via de context. */
  const { niveauVoor, attributenVoor } = require('./rtgid-claims')({
    accounts, accountVanKey, codenaamUit, leeftijdVan,
    /* De bewijzenlaag komt LATER in de opzet dan RTG iD (kern/vakbewijs.js
       hangt in kernlaag3, dit in aanbouw2), dus hij wordt laat gebonden: een
       functie die de bron ophaalt wanneer hij nodig is. Zonder bron antwoordt
       de claim "niet na te gaan" en nooit "nee". */
    vakbewijsBron });

  const { start, statusVan, roteer, annuleer, wie } = require('./rtgid-dienst')({ metStaat, nu, iso, crypto,
    schoon, toegang, magVragen, attributenVoor, logVan, cap, MAX_LOG, MAX_KOPPELS });

  /* De app-kant -- de code opzoeken, bevestigen met een passkey, weigeren --
     staat in ./rtgid-bevestigen.js. Daar woont ook de passkey-eis zelf: dat is
     de enige plek waar een identiteit de deur uit gaat, en die plek hoort de
     eis te dragen. */
  const { koppelZoek, bevestig, weiger } = require('./rtgid-bevestigen')({
    S, save, metStaat, toegang, nu, iso, crypto, schoon, hash, cap, logVan, codenaamUit, accountVanKey,
    niveauVoor, stapOp, passkeysVan, MAX_LOG, MAX_SESSIES, SESSIE_TTL_MS });

  /* Inzage, regie (intrekken) en de mantelzorg-machtigingen staan apart, in
     ./rtgid-regie.js; de gedeelde interne helpers gaan mee via de context. */
  const { inzage, intrek, machtig, machtigIntrek } = require('./rtgid-regie')({
    metStaat, nu, iso, schoon, keyVanCodenaam, crypto, codenaamUit, accountVanKey,
    logVan, cap, ATTRIBUTEN, MAX_LOG });

  /* De bewijsmap van het lid zelf. Hij komt uit ./rtgid-bewijs.js en wordt hier
     alleen doorgegeven, want ./rtgid-claims.js heeft dezelfde module al voor de
     dienst-kant -- twee instanties zouden twee bronnen worden. */
  const { mijnBewijzen } = require('./rtgid-bewijs')({ accountVanKey, vakbewijsBron });

  return { rtgid: { start, statusVan, roteer, annuleer, wie, koppelZoek, bevestig, weiger, inzage, intrek, machtig,
    machtigIntrek, mijnBewijzen } };
}

module.exports = { maakRtgid };
