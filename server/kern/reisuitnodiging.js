/* DE REISUITNODIGING -- een klaargezette reis en een eenmalige bearer-link.

   De link geeft nooit een pas en bewaart geen schaduwprofiel. De code zelf is
   128 bits, verlaat alleen de uitgifte en staat daarna uitsluitend als hash in
   reisUitnodigingen. Controle, claim, intrekking en rotatie lopen door dezelfde
   collectietransactie. De overdracht naar reisInvoer is een herstelbare saga:
   eerst wordt de code exclusief aan dit lid geclaimd, daarna schrijft
   invoer.neemOver idempotent op uitnodigings-id, en pas dan wordt de claim
   voltooid. Een crash kan daardoor worden hervat door hetzelfde lid en nooit
   door een tweede lid.

   Er gaan geen bestanden mee. Alleen gelezen reisregels worden overgenomen;
   bewijsstukken blijven in de kluis van hun eigenaar. */
'use strict';
const klok = require('../lib/klok');

const DAGEN_GELDIG = 30;
const SOORTEN_UIT = ['klaargezet', 'reisgenoot'];
const DOEL = 'travelos-reisuitnodiging';
const SCOPE = ['reis.lezen', 'reis.overnemen'];
const DUBBELTIK_MS = 5000;

function vasteAppBasis(env = process.env) {
  const vast = String(env.APP_URL || '').trim();
  if (!vast) return env.NODE_ENV === 'production'
    ? { ok: false, error: 'APP_URL ontbreekt voor reisuitnodigingen.' }
    : { ok: true, basis: '' };
  try {
    const url = new URL(vast);
    if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.search || url.hash)
      return { ok: false, error: 'APP_URL is geen veilige vaste oorsprong.' };
    if (env.NODE_ENV === 'production' && url.protocol !== 'https:')
      return { ok: false, error: 'APP_URL moet in productie HTTPS gebruiken.' };
    return { ok: true, basis: url.origin };
  } catch (e) { return { ok: false, error: 'APP_URL is geen geldige vaste oorsprong.' }; }
}

module.exports.maakReisuitnodiging = ({ db, save, bewerkCollectie, crypto, invoer, idGeverifieerd }) => {
  const nu = () => klok.datum().toISOString();
  const schoon = (v, n) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, n || 120);
  const datum = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) ? String(s) : null;
  const bearer = require('./bearercode')({ crypto, namespace: 'reisuitnodiging', nu });
  const eigen = require('./eigencollectie')({ db, domein: 'kern/reisuitnodiging', bezit: { reisUitnodigingen: 'kaart' } });
  const bak = () => eigen.bak('reisUitnodigingen');

  function migreerLegacy(bron) {
    for (const u of Object.values(bron || {})) {
      if (!u || u.toegang || !u.code) continue;
      const issued = Number.isFinite(Date.parse(u.at)) ? u.at : nu();
      const eind = /^\d{4}-\d{2}-\d{2}$/.test(String(u.geldigTot || ''))
        ? u.geldigTot + 'T23:59:59.999Z'
        : new Date(Date.parse(issued) + DAGEN_GELDIG * 86400000).toISOString();
      u.toegang = {
        code_hash: bearer.hash(u.code), issuer: u.doorWie || u.door || 'legacy',
        doel: DOEL, scope: [...SCOPE], onderwerp: { soort: 'reisuitnodiging', id: u.id },
        issued_at: issued, expires_at: eind, max_gebruik: 1,
        gebruik: u.opgeeist ? 1 : 0, laatst_gebruikt_at: u.opgeeist && u.opgeeist.at || null,
        /* Ook een cryptografisch sterke legacy-code stond in een query-URL en
           kan dus in browser-, proxy- of maillogs zijn beland. Hashen maakt zo'n
           reeds gelekt geheim niet opnieuw veilig: alleen bewuste rotatie wel. */
        ingetrokken_at: nu(), ingetrokken_door: 'legacy-migratie',
        intrekreden: u.ingetrokken ? 'oude uitnodiging was ingetrokken'
          : 'legacy querycredential vereist rotatie', rotatie: 1
      };
      delete u.code;
      delete u.geldigTot;
      delete u.ingetrokken;
    }
  }

  function transactie(werk) {
    const doe = bron => {
      if (!bron || typeof bron !== 'object' || Array.isArray(bron))
        throw new Error('reisUitnodigingen hoort een kaart te zijn');
      migreerLegacy(bron);
      return werk(bron);
    };
    if (typeof bewerkCollectie === 'function') return bewerkCollectie('reisUitnodigingen', doe);
    const bron = bak();
    const voor = JSON.stringify(bron);
    const antwoord = doe(bron);
    if (antwoord && typeof antwoord.then === 'function') throw new Error('reisuitnodiging-transactie mag niet asynchroon zijn');
    if (JSON.stringify(bron) !== voor) save();
    return antwoord;
  }

  function vindCode(bron, code) {
    return bearer.vind(Object.values(bron || {}), code, u => u && u.toegang && u.toegang.code_hash);
  }
  const statusReden = u => bearer.reden(u && u.toegang, { doel: DOEL, scope: SCOPE });
  const publiek = (u, delen = false) => {
    const p = { id: u.id, soort: u.soort, doorCodenaam: u.doorCodenaam || null,
      bestemming: u.bestemming, venster: u.venster, aantal: (u.onderdelen || []).length,
      toegang: bearer.publiek(u.toegang), opgeeist: !!u.opgeeist,
      ingetrokken: !!(u.toegang && u.toegang.ingetrokken_at),
      claim: u.claim ? { status: u.claim.status, at: u.claim.at, voltooid_at: u.claim.voltooid_at || null } : null };
    if (delen) p.onderdelen = u.onderdelen;
    return p;
  };

  function schoneOnderdelen(rij) {
    const uit = [];
    for (const o of (Array.isArray(rij) ? rij : []).slice(0, 40)) {
      const soort = schoon(o && o.soort, 20), titel = schoon(o && o.titel, 120), van = datum(o && o.van);
      if (!soort || !titel || !van) continue;
      uit.push({ soort, titel, van, tot: datum(o.tot), bestemming: schoon(o.bestemming, 80),
        kenmerk: schoon(o.kenmerk, 40), herkomst: schoon(o.herkomst, 20) || 'handmatig' });
    }
    return uit;
  }

  const afdruk = waarde => crypto.createHash('sha256').update(String(waarde || '')).digest('hex');

  function maak(soort, door, doorCodenaam, onderdelen, doorWie, idem) {
    if (!SOORTEN_UIT.includes(soort)) return { status: 400, error: 'Onbekend soort uitnodiging.' };
    const rij = schoneOnderdelen(onderdelen);
    if (!rij.length) return { status: 400, error: 'Zet eerst minstens één reisonderdeel klaar (met een naam en een datum).' };
    const app = vasteAppBasis();
    /* Eerst de vaste oorsprong bewijzen, pas daarna de eenmalige credential
       maken. Anders kan een configuratiefout het geheim wel opslaan maar uit
       het antwoord laten vallen, waardoor alleen een rotatie het kan redden. */
    if (!app.ok) return { status: 503, error: 'Reisuitnodigingen zijn tijdelijk niet veilig geconfigureerd.' };
    return transactie(bron => {
      const vinger = afdruk(JSON.stringify({ soort, door, onderdelen: rij }));
      const idemHash = String(idem || '').trim()
        ? afdruk('reisuitnodiging-idem|' + String(door || '') + '|' + String(idem).trim()) : null;
      const dubbeltikHash = afdruk('reisuitnodiging-dubbeltik|' + String(door || '') + '|' + vinger);
      const bestaand = Object.values(bron).find(u => u && (
        (idemHash && u.idem_hash === idemHash) ||
        (!idemHash && u.dubbeltik_hash === dubbeltikHash &&
          Date.now() - Date.parse(u.toegang && u.toegang.issued_at) >= 0 &&
          Date.now() - Date.parse(u.toegang && u.toegang.issued_at) < DUBBELTIK_MS)
      ));
      if (bestaand) {
        if (bestaand.idem_fingerprint && bestaand.idem_fingerprint !== vinger)
          return { status: 409, error: 'Deze herhaalsleutel hoort al bij een andere reisuitnodiging.' };
        return { status: 409,
          error: 'Deze uitnodiging is al eenmalig uitgegeven en wordt niet opnieuw getoond. Roteer haar als de ontvanger de link niet kreeg.',
          herhaald: true, uitnodiging: publiek(bestaand) };
      }
      const dagen = rij.map(o => o.tot || o.van).concat(rij.map(o => o.van)).sort();
      const id = 'U-' + crypto.randomBytes(8).toString('hex');
      let gemaakt;
      do {
        gemaakt = bearer.maak({ prefix: 'REIS', issuer: doorWie || door,
          doel: DOEL, scope: SCOPE, onderwerp: { soort: 'reisuitnodiging', id },
          geldigMs: DAGEN_GELDIG * 86400000, maxGebruik: 1 });
      } while (Object.values(bron).some(x => x && x.toegang && x.toegang.code_hash === gemaakt.toegang.code_hash));
      const u = { id, soort, door, doorCodenaam: doorCodenaam || null, doorWie: doorWie || null,
        bestemming: (rij.find(o => o.bestemming) || {}).bestemming || '',
        venster: { van: dagen[0], tot: dagen[dagen.length - 1] }, onderdelen: rij,
        toegang: gemaakt.toegang, claim: null, opgeeist: null, at: nu(), code_historie: [],
        idem_hash: idemHash, idem_fingerprint: idemHash ? vinger : null,
        dubbeltik_hash: idemHash ? null : dubbeltikHash };
      bron[id] = u;
      /* Het geheim reist in het fragment. Een fragment wordt door de browser
         niet naar RTG, een proxy of een accesslog gestuurd; de pagina wist het
         bovendien uit de adresbalk voordat zij haar eerste verzoek doet. */
      return { ok: true, uitnodiging: publiek(u, true),
        link: app.basis + '/apps/reisuitnodiging.html#code=' + encodeURIComponent(gemaakt.code) };
    });
  }

  const zetKlaar = (wie, onderdelen, idem) => maak('klaargezet', 'kantoor', null, onderdelen, schoon(wie, 60), idem);
  const nodigUit = (key, codenaam, onderdelen, idem) =>
    maak('reisgenoot', key, schoon(codenaam, 60), onderdelen, schoon(codenaam, 60), idem);

  const gebruik = require('./reisuitnodiging-gebruik')({ transactie, vindCode, statusReden,
    publiek, bearer, invoer, idGeverifieerd, nu, crypto, DOEL, SCOPE, vasteAppBasis });
  return { reisuitnodiging: Object.assign({ zetKlaar, nodigUit }, gebruik) };
};

module.exports.DOEL = DOEL;
module.exports.SCOPE = SCOPE;
module.exports.vasteAppBasis = vasteAppBasis;
