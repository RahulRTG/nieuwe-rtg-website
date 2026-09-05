/* Cryptografisch en opslagcontract van de luchthaven-boarding-pass.

   De boeking en de pass hebben ieder een openbaar, niet-geheim id. Alleen de
   BP-code is een bearer. Zij bestaat uit 128 willekeurige bits, wordt bij
   uitgifte eenmaal teruggegeven en staat daarna uitsluitend als SHA-256-hash
   in de luchthaven-collectie. Ook oude, korte VL-codes worden bij de
   startupmigratie alleen gehasht en meteen ingetrokken; een zwakke legacycode
   wordt dus nooit door de migratie opnieuw geldig gemaakt. */
'use strict';

const DOEL = 'airport-boarding-pass';
const SCOPE = Object.freeze([
  'airport.partner.verify',
  'airport.lounge.entry'
]);
const MAX_GEBRUIK = 32;

module.exports = ({ crypto, nu = () => new Date().toISOString() }) => {
  const bearer = require('../bearercode')({
    crypto, namespace: 'travelos.airport_boarding_pass', nu: iso
  });

  function iso() {
    const waarde = typeof nu === 'function' ? nu() : nu;
    const datum = waarde instanceof Date ? waarde : new Date(waarde);
    return Number.isFinite(datum.getTime()) ? datum.toISOString() : new Date().toISOString();
  }
  const nieuwId = prefix => String(prefix || '') + '_' + crypto.randomBytes(16).toString('hex');
  const lidHash = key => crypto.createHash('sha256')
    .update('rtg-airport-pass-lid-v1|' + String(key || '')).digest('hex');

  function luchthaven(bron) {
    const l = bron && typeof bron === 'object' && !Array.isArray(bron) ? bron : {};
    for (const naam of ['vluchten', 'boekingen', 'koffers', 'security', 'charters', 'vips', 'lounge'])
      if (!Array.isArray(l[naam])) l[naam] = [];
    return l;
  }
  const vindVlucht = (l, id) => l.vluchten.find(v =>
    v.id === String(id || '') || v.nummer === String(id || '').trim().toUpperCase());
  const vindBoeking = (l, id, key) => l.boekingen.find(b =>
    b.id === String(id || '') && (key == null || b.key === key));
  const historie = b => Array.isArray(b && b.pass_historie) ? b.pass_historie : [];

  function onderwerp(b, v) {
    return { soort: 'boarding-pass', id: b.pass_id, boeking_id: b.id,
      vlucht_id: v.id, lid_hash: lidHash(b.key) };
  }
  function onderwerpKlopt(b, v, toegang) {
    const o = toegang && toegang.onderwerp;
    return !!(o && o.soort === 'boarding-pass' && o.id === b.pass_id &&
      o.boeking_id === b.id && o.vlucht_id === v.id && o.lid_hash === lidHash(b.key));
  }
  function geldigheidMs(v) {
    const einde = Date.parse(String(v.datum || '') + 'T23:59:59.999Z');
    const vanaf = Date.parse(iso());
    if (!Number.isFinite(einde) || !Number.isFinite(vanaf)) return 24 * 60 * 60 * 1000;
    return Math.max(1000, einde - vanaf);
  }
  function maakToegang(b, v, rotatie) {
    if (!b.pass_id) b.pass_id = nieuwId('bp');
    const gemaakt = bearer.maak({ prefix: 'BP', issuer: 'travelos.airport',
      doel: DOEL, scope: SCOPE, onderwerp: onderwerp(b, v),
      geldigMs: geldigheidMs(v), maxGebruik: MAX_GEBRUIK });
    gemaakt.toegang.rotatie = Math.max(1, Number(rotatie) || 1);
    return gemaakt;
  }
  function publiek(b) {
    const t = b && b.toegang;
    return t ? Object.assign({ id: b.pass_id,
      stand: t.ingetrokken_at ? 'ingetrokken' :
        (Date.parse(t.expires_at) <= Date.parse(iso()) ? 'verlopen' : 'actief')
    }, bearer.publiek(t)) : null;
  }

  /* Geen vroege return: iedere actuele én historische hash wordt altijd met
     timingSafeEqual vergeleken. Zo verraadt de positie in de collectie niet
     welke pass overeenkwam. Een historische treffer wordt wel onthouden, maar
     kan door de consumer nooit als actuele credential worden gebruikt. */
  function vindOpCode(l, code) {
    const gezocht = bearer.hash(String(code || '').slice(0, 80));
    let huidig = null, oud = null;
    for (const b of l.boekingen) {
      const gelijkHuidig = bearer.zelfdeHash(b && b.toegang && b.toegang.code_hash, gezocht);
      if (gelijkHuidig) huidig = { b, toegang: b.toegang };
      for (const toegang of historie(b)) {
        const gelijkOud = bearer.zelfdeHash(toegang && toegang.code_hash, gezocht);
        if (gelijkOud) oud = { b, toegang };
      }
    }
    return huidig || oud ? { huidig, oud } : null;
  }

  function legacyToegang(b, v, kaleCode) {
    const at = Number.isFinite(Date.parse(b.at)) ? new Date(b.at).toISOString() : iso();
    const ingetrokken = iso();
    return {
      code_hash: bearer.hash(kaleCode), issuer: 'travelos.airport-legacy-migration',
      doel: DOEL, scope: [...SCOPE], onderwerp: onderwerp(b, v), issued_at: at,
      expires_at: ingetrokken, max_gebruik: 1, gebruik: 0,
      laatst_gebruikt_at: null, ingetrokken_at: ingetrokken,
      ingetrokken_door: 'startup-migration', intrekreden: 'zwakke legacycode gesloten',
      rotatie: 0
    };
  }

  function migreerLegacy(bron) {
    const l = luchthaven(bron);
    let aantal = 0;
    for (const b of l.boekingen) {
      if (!b || typeof b !== 'object') continue;
      if (!Array.isArray(b.pass_historie)) b.pass_historie = [];
      const v = vindVlucht(l, b.vluchtId) || { id: String(b.vluchtId || '') };
      if (typeof b.code === 'string' && b.code.trim()) {
        if (!b.pass_id) b.pass_id = nieuwId('bp');
        b.pass_historie.push(legacyToegang(b, v, b.code));
        delete b.code;
        aantal++;
      }
      /* Verdedigingsdiepte voor eventuele tussenvormen uit een mislukte
         voorproductieronde. Deze velden mogen nooit kaal op schijf blijven. */
      for (const naam of ['pass_code', 'boarding_pass_code', 'raw_secret']) {
        if (typeof b[naam] === 'string' && b[naam]) {
          if (!b.pass_id) b.pass_id = nieuwId('bp');
          b.pass_historie.push(legacyToegang(b, v, b[naam]));
          delete b[naam];
          aantal++;
        }
      }
      if (b.toegang && typeof b.toegang === 'object') {
        for (const naam of ['code', 'secret', 'raw']) delete b.toegang[naam];
      }
      if (b.pass_historie.length > 24)
        b.pass_historie.splice(0, b.pass_historie.length - 24);
    }
    return aantal;
  }

  return { bearer, luchthaven, vindVlucht, vindBoeking, historie, nieuwId,
    lidHash, onderwerpKlopt, maakToegang, publiek, vindOpCode, migreerLegacy,
    DOEL, SCOPE, MAX_GEBRUIK };
};

module.exports.DOEL = DOEL;
module.exports.SCOPE = SCOPE;
