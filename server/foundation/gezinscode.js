/* DE GEZINSCODE (CODECREDENTIALS.json: foundation.family_profile_access,
   besluit B18 van 4 oktober 2026).

   Tot B18 was de gezinscode zes tekens uit een alfabet van 31 (circa 30 bits)
   en tegelijk de SLEUTEL van het gezin in de opslag (`gezinnen[code]`). Daarmee
   was hij twee dingen in een: het adres waaronder het gezin woont, en het
   geheim waarmee je binnenkomt. Het adres staat ook in elke sociale handle
   (`rtf:CODE:pid`), dus wie een codenaam van een gezinslid zag, had de helft van
   de inlog al.

   Die twee zijn nu uit elkaar:
   - het ADRES blijft `g.code` (de zes tekens). Het opent NIETS: elke route op
     een adres vraagt daarnaast een gezinssessie (./gezinstoken.js);
   - de GEZINSCODE is een 128-bit bearer (GC.<32 hex>, kern/bearercode.js) die
     alleen als hash bestaat, in de eigen collectie foundationGezinscode (adres
     -> credential), met issuer, doel, scope,
     onderwerp (alleen adres en id van het gezin, verder niets), issued_at, expires_at en een
     gebruiksteller. Kaal bestaat hij alleen in het antwoord dat hem uitgeeft
     (gezin/maak en gezin/code/roteer).

   Zoeken vergelijkt de hash tegen ELK gezin met timingSafeEqual, zonder vroege
   uitgang. Een oude zes-tekencode heeft de verkeerde vorm en opent niets; een
   gezin zonder rij in die collectie heeft nog geen gezinscode en kan alleen via de
   beheerder (met een lopende sessie) een nieuwe krijgen. Er wordt niets
   omgezet: een geheim dat raw in de sleutel van de opslag stond wordt geen
   hash met een nieuwe vervaltijd.

   Geldig 366 dagen (het plafond van kern/bearercode.js) en hooguit 10.000
   keer gebruikt; daarna, of na intrekken, maakt de beheerder een nieuwe. Een
   mens tikt hem over: spaties en streepjes vallen weg, kleine letters worden
   hoofdletters, en 32 hextekens zonder voorvoegsel krijgen `GC.` ervoor. */
'use strict';

const klok = require('../lib/klok');

const DOEL = 'gezin-inloggen';
const SCOPE = Object.freeze(['foundation.gezin.inloggen']);
const VORM = /^GC\.[0-9A-F]{32}$/;
const MAX_GEBRUIK = 10000;
const COLLECTIE = 'foundationGezinscode';

function normaliseer(raw) {
  let s = String(raw == null ? '' : raw).toUpperCase().replace(/[\s-]/g, '');
  if (/^[0-9A-F]{32}$/.test(s)) s = 'GC.' + s;
  return VORM.test(s) ? s : null;
}

function maak({ db, crypto, bewerkCollectie, G, productie = process.env.NODE_ENV === 'production',
  nu = () => klok.datum().toISOString() }) {
  const bearer = require('../kern/bearercode')({ crypto, namespace: 'foundation.gezinscode', nu });
  const LEEG = bearer.hash('GC.' + '0'.repeat(32));
  let eigen = null;
  const bezit = () => eigen || (eigen = require('../kern/eigencollectie')({ db, domein: 'foundation/gezinscode',
    bezit: { [COLLECTIE]: 'kaart' } }));
  const kijk = () => bezit().kijk(COLLECTIE);

  /* Elke schrijfhandeling is een collectietransactie op de EIGEN collectie (in
     PostgreSQL advisory lock plus FOR UPDATE). Niet op `foundation`: een
     transactie vervangt haar collectie door een kopie, en een gezinsroute die
     intussen op een await stond (een pincode hashen) zou dan in een verweesd
     object schrijven. Zonder transactie weigert productie liever dan te raden. */
  function transactie(werk) {
    if (typeof bewerkCollectie === 'function')
      return Promise.resolve(bewerkCollectie(COLLECTIE, kaart => {
        if (!kaart || typeof kaart !== 'object' || Array.isArray(kaart)) throw new Error(COLLECTIE + ' hoort een kaart te zijn');
        return werk(kaart);
      }));
    if (productie) return Promise.reject(new Error('gezinscode: geen collectietransactie in productie'));
    return Promise.resolve(werk(bezit().bak(COLLECTIE)));
  }
  const eigenRij = (kaart, code) => Object.prototype.hasOwnProperty.call(kaart, code) ? kaart[code] : null;

  function reden(code, t) {
    if (!t) return 'geen-gezinscode';
    const r = bearer.reden(t, { doel: DOEL, scope: SCOPE });
    if (r) return r;
    const gezinnen = typeof G === 'function' ? G() : {};
    if (!Object.prototype.hasOwnProperty.call(gezinnen, code)) return 'geen-gezin';
    /* Het adres plus het id: komt een gewist adres ooit terug bij een nieuw
       gezin, dan opent een achtergebleven code dat nieuwe gezin niet. */
    const o = t.onderwerp || {};
    return o.gezin === code && o.id === String(gezinnen[code].id || '') ? null : 'onderwerp';
  }

  /* Een nieuwe gezinscode voor dit gezin; de vorige vervalt doordat hij wordt
     vervangen (zijn hash staat nergens meer). De kale waarde komt EEN keer terug. */
  function geef(g, door) {
    const adres = String((g && g.code) || '');
    if (!adres) return Promise.reject(new Error('gezinscode vereist een gezin'));
    return transactie(kaart => {
      const vorige = eigenRij(kaart, adres);
      const m = bearer.maak({ prefix: 'GC', issuer: 'rtg.foundation', doel: DOEL, scope: SCOPE,
        onderwerp: { gezin: adres, id: String(g.id || '') }, geldigMs: require('../kern/bearercode').MAX_GELDIG_MS, maxGebruik: MAX_GEBRUIK });
      m.toegang.rotatie = vorige && Number.isSafeInteger(vorige.rotatie) ? vorige.rotatie + 1 : 1;
      m.toegang.uitgegeven_door = String(door || '').slice(0, 40);
      kaart[adres] = m.toegang;
      return m.code;
    });
  }

  /* Constant-time over ELKE gezinscode; een vorm die niet klopt wordt toch
     tegen elke rij vergeleken, zodat de tijd niets over de vorm verraadt.
     Geeft het adres van het gezin, of null. */
  function zoekIn(kaart, raw) {
    const kaal = normaliseer(raw);
    const gezocht = kaal ? bearer.hash(kaal) : LEEG;
    let hit = null;
    for (const [code, t] of Object.entries(kaart || {}))
      if (t && bearer.zelfdeHash(t.code_hash, gezocht)) hit = code;
    if (!kaal || !hit || reden(hit, kaart[hit])) return null;
    return hit;
  }
  const vind = raw => zoekIn(kijk(), raw);

  /* DE CLAIM, na de pincode: opnieuw zoeken (hij kan intussen geroteerd of
     ingetrokken zijn), dezelfde gezin, en het gebruik tellen -- in een commit. */
  function claim(raw, code) {
    return transactie(kaart => {
      const hit = zoekIn(kaart, raw);
      if (!hit || hit !== String(code || '')) return false;
      bearer.gebruik(kaart[hit]);
      return true;
    });
  }

  function intrek(code, door, waarom) {
    return transactie(kaart => {
      const t = eigenRij(kaart, String(code || ''));
      if (!t) return false;
      bearer.intrekken(t, door, waarom || 'ingetrokken door de beheerder');
      return true;
    });
  }
  /* Een gewist gezin neemt zijn gezinscode mee. */
  const vergeet = code => transactie(kaart => { const had = !!eigenRij(kaart, String(code || '')); delete kaart[String(code || '')]; return had; });

  /* Wat de beheerder ziet: wanneer uitgegeven, tot wanneer, hoe vaak gebruikt,
     of hij is ingetrokken. Nooit de hash, nooit het onderwerp. */
  function publiek(code) {
    const t = eigenRij(kijk(), String(code || ''));
    const p = bearer.publiek(t);
    if (!p) return { stand: 'geen', reden: 'Dit gezin heeft nog geen gezinscode. De beheerder maakt er een.' };
    const r = reden(String(code), t);
    return { stand: r ? 'ongeldig' : 'actief', reden: r, uitgegeven: p.issued_at, geldigTot: p.expires_at,
      gebruikt: p.gebruik, maxGebruik: p.max_gebruik, rotatie: p.rotatie, ingetrokken: p.ingetrokken_at };
  }

  return { geef, vind, claim, intrek, vergeet, publiek, normaliseer, COLLECTIE, DOEL, SCOPE, MAX_GEBRUIK };
}

module.exports = { maak, normaliseer, COLLECTIE, DOEL, SCOPE, VORM, MAX_GEBRUIK };
