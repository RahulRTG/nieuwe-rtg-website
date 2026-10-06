/* Gedeelde bouwstenen voor een bearer-code die zelf een deur opent.

   Dit bestand bezit GEEN opslag en beslist GEEN bevoegdheid. Een domein houdt
   zijn credential bij het onderwerp waarop hij recht geeft en zet elke
   controle/mutatie in zijn eigen collectietransactie. Deze laag voorkomt wel
   dat elk domein opnieuw (en net anders) crypto, metadata en vergelijking
   uitvindt.

   De kale code wordt precies eenmaal aan de uitgever gegeven. Op schijf staat
   alleen `code_hash`; zoeken vergelijkt hashes met timingSafeEqual en stopt
   niet bij de eerste rij.

   VERSIE 2 staat in ./bearercode-v2.js en gaat aan zodra een aanroeper
   `geldigheid` meegeeft. Zonder dat veld is dit exact v1 (vastgelegd in
   test/bearercode.test.js). Twee fabriekopties zijn nieuw: `normaal` (een
   domein dat zijn codes anders normaliseert, zodat de hash in maak() meteen
   klopt en niet achteraf wordt overschreven) en `sluit`/`spoor` voor v2. */
'use strict';

const klok = require('../lib/klok');
const maakV2 = require('./bearercode-v2');

const MAX_GELDIG_MS = 366 * 86400000;
/* SCHADUW voor de stille duur: een v1-code zonder bruikbare geldigMs krijgt
   nog steeds 30 dagen, maar dat wordt hier GETELD per namespace en doel (geen
   onderwerp, geen code, geen mens). Pas als deze teller in productie op nul
   staat, kan de stille duur een weigering worden zonder een domein te breken. */
const STILLE_DUUR = new Map();

/* De vergelijking zelf, los van een namespace, zodat een laag met een eigen
   hashvoorvoegsel (kern/codelevenscyclus.js) dezelfde gebruikt en geen tweede
   schrijft (Fase 0, D13). Elke rij wordt afgelopen, ook na een treffer. */
function hashGelijk(crypto, a, b) {
  if (!/^[a-f0-9]{64}$/i.test(String(a || '')) || !/^[a-f0-9]{64}$/i.test(String(b || ''))) return false;
  return crypto.timingSafeEqual(Buffer.from(String(a), 'hex'), Buffer.from(String(b), 'hex'));
}
function vindOpHash(crypto, rijen, gezocht, veld = 'code_hash') {
  let gevonden = null;
  for (const rij of rijen || []) if (rij && hashGelijk(crypto, rij[veld], gezocht)) gevonden = rij;
  return gevonden;
}

module.exports = ({ crypto, namespace, nu = () => klok.datum().toISOString(), normaal: eigenNormaal, sluit, spoor }) => {
  if (!crypto || typeof crypto.randomBytes !== 'function' || typeof crypto.createHash !== 'function' ||
      typeof crypto.timingSafeEqual !== 'function') throw new Error('bearercode vereist node:crypto');
  const ns = String(namespace || '').trim();
  if (!ns) throw new Error('bearercode vereist een vaste namespace');

  const normaal = typeof eigenNormaal === 'function' ? waarde => String(eigenNormaal(waarde))
    : waarde => String(waarde == null ? '' : waarde).trim().toUpperCase();
  const hash = waarde => crypto.createHash('sha256')
    .update('rtg-bearer-v1|' + ns + '|' + normaal(waarde)).digest('hex');
  const zelfdeHash = (a, b) => hashGelijk(crypto, a, b);
  const vind = (rijen, code, veld = 'code_hash') => {
    const gezocht = hash(code);
    let gevonden = null;
    for (const rij of (Array.isArray(rijen) ? rijen : Object.values(rijen || {}))) {
      const waarde = typeof veld === 'function' ? veld(rij) : (rij && rij[veld]);
      if (rij && zelfdeHash(waarde, gezocht)) gevonden = rij;
    }
    return gevonden;
  };
  const codeNieuw = prefix => {
    const p = normaal(prefix).replace(/[^A-Z0-9_-]/g, '').slice(0, 12);
    const geheim = crypto.randomBytes(16).toString('hex').toUpperCase(); // 128 bits
    return p ? p + '.' + geheim : geheim;
  };
  const v2 = maakV2({ crypto, ns, nu, hash, codeNieuw: p => codeNieuw(p), plafondMs: MAX_GELDIG_MS, sluit, spoor });
  const maak = (opdracht) => {
    if (opdracht && opdracht.geldigheid !== undefined) return v2.maak(opdracht);
    return maakV1(opdracht || {});
  };
  const maakV1 = ({ prefix, issuer, doel, scope, onderwerp, geldigMs, maxGebruik = 1 }) => {
    const issuedAt = nu();
    if (!Number(geldigMs)) {
      const sleutel = ns + '|' + String(doel || '').trim().slice(0, 100);
      STILLE_DUUR.set(sleutel, (STILLE_DUUR.get(sleutel) || 0) + 1);
      if (spoor) spoor({ soort: 'stille-duur', namespace: ns, doel: String(doel || ''), at: issuedAt });
    }
    const duur = Math.max(1000, Math.min(Number(geldigMs) || 30 * 86400000, MAX_GELDIG_MS));
    const kaleCode = codeNieuw(prefix);
    const toegang = {
      code_hash: hash(kaleCode),
      issuer: String(issuer || '').trim().slice(0, 100),
      doel: String(doel || '').trim().slice(0, 100),
      scope: [...new Set([].concat(scope || []).map(x => String(x || '').trim()).filter(Boolean))],
      onderwerp: Object.assign({}, onderwerp || {}),
      issued_at: issuedAt,
      expires_at: new Date(Date.parse(issuedAt) + duur).toISOString(),
      max_gebruik: Math.max(1, Math.min(Math.round(Number(maxGebruik) || 1), 10000)),
      gebruik: 0,
      laatst_gebruikt_at: null,
      ingetrokken_at: null,
      ingetrokken_door: null,
      intrekreden: null,
      rotatie: 1
    };
    if (!toegang.issuer || !toegang.doel || !toegang.scope.length)
      throw new Error('bearercode vereist issuer, doel en scope');
    return { code: kaleCode, toegang };
  };
  const reden = (toegang, verwacht = {}) => {
    if (!toegang) return 'onbekend';
    if (toegang.contractversie !== 2) return redenV1(toegang, verwacht);
    return v2.voorReden(toegang, verwacht) || v2.naReden(toegang, verwacht, redenV1(toegang, verwacht));
  };
  const redenV1 = (toegang, verwacht) => {
    if (verwacht.doel && toegang.doel !== verwacht.doel) return 'verkeerd-doel';
    const scopes = [].concat(verwacht.scope || []);
    if (scopes.some(s => !(toegang.scope || []).includes(s))) return 'scope-ontbreekt';
    if (toegang.ingetrokken_at) return 'ingetrokken';
    if (!Number.isFinite(Date.parse(toegang.expires_at)) || Date.parse(toegang.expires_at) <= Date.parse(nu())) return 'verlopen';
    if (!Number.isSafeInteger(toegang.gebruik) || !Number.isSafeInteger(toegang.max_gebruik))
      return 'ongeldige-gebruiksteller';
    if (!verwacht.negeerGebruik && toegang.gebruik >= toegang.max_gebruik) return 'opgebruikt';
    return null;
  };
  const gebruik = toegang => {
    toegang.gebruik += 1;
    toegang.laatst_gebruikt_at = nu();
    return toegang;
  };
  const intrekken = (toegang, actor, redenTekst) => {
    if (!toegang.ingetrokken_at) {
      toegang.ingetrokken_at = nu();
      toegang.ingetrokken_door = String(actor || 'onbekend').slice(0, 100);
      toegang.intrekreden = String(redenTekst || 'ingetrokken').slice(0, 200);
    }
    return toegang;
  };
  const publiek = toegang => toegang ? {
    issuer: toegang.issuer, doel: toegang.doel, scope: [...(toegang.scope || [])],
    issued_at: toegang.issued_at, expires_at: toegang.expires_at,
    max_gebruik: toegang.max_gebruik, gebruik: toegang.gebruik,
    laatst_gebruikt_at: toegang.laatst_gebruikt_at,
    ingetrokken_at: toegang.ingetrokken_at, rotatie: toegang.rotatie
  } : null;

  const trekIn = (toegang, actor, redenTekst) => v2.trekIn(toegang, intrekken, actor, redenTekst);
  const roteer = (oud, opties) => v2.roteer(oud, intrekken, opties);
  const leidAf = (ouder, verzoek) => v2.leidAf(ouder, verzoek, reden);

  return { normaal, hash, zelfdeHash, vind, codeNieuw, maak, reden, gebruik, intrekken, publiek,
    trekIn, roteer, leidAf, contracthash: v2.contracthash };
};

module.exports.MAX_GELDIG_MS = MAX_GELDIG_MS;
module.exports.hashGelijk = hashGelijk;
module.exports.vindOpHash = vindOpHash;
module.exports.stilleDuur = () => Object.fromEntries(STILLE_DUUR);
