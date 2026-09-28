/* DE BAK VAN EEN KORTLEVENDE BETAALCODE (kern/pay/kasbak.js): de kascode
   (./kassa.js, ./vooraf.js) en de tikcode (./tik.js) leven allebei hier, elk in
   een eigen collectie.

   Tot 27 september 2026 waren het zes hextekens (24 bits), kaal opgeslagen in
   een lijst en gezocht met find(). Nu, volgens het releasebeleid in
   CODECREDENTIALS.json:
   - 128 bits (../bearercode.js), op schijf alleen `toegang.code_hash`;
   - de kale code staat precies een keer in het antwoord op de uitgifte;
   - issuer, doel en scope, issued_at en expires_at, max_gebruik en gebruik;
   - zoeken loopt ALLE rijen af met timingSafeEqual (bearer.vind);
   - elke overgang loopt door EEN collectietransactie (PostgreSQL: advisory
     lock plus FOR UPDATE), dus twee instances zien elkaars claim.

   Uitgeven IS roteren: elke nog open code van hetzelfde lid wordt in dezelfde
   transactie ingetrokken. Een retry met dezelfde idem-sleutel maakt geen
   tweede code en toont de eerste niet opnieuw (409 zonder code).

   DE OUDE CODES. De lijst `oud` (payCodes of payTikCodes) droeg kale codes van
   hoogstens vijf minuten. Ze openen niets meer en worden bij de eerste
   handeling na de uitrol gewist: ongeldig maken is hier veiliger dan hashen,
   en wie er een op zijn scherm had, maakt een nieuwe. */
'use strict';

/* EEN collectietransactie, met de proceslokale kopie als terugval voor een
   losse toets zonder opslag -- in productie weigert die terugval hard. */
const transactieOp = ({ d, save, bewerkCollectie }) => (sleutel, werk) => {
  if (typeof bewerkCollectie === 'function') return bewerkCollectie(sleutel, werk);
  if (process.env.NODE_ENV === 'production')
    throw new Error(sleutel + ' vraagt in productie een collectietransactie.');
  const v = d()[sleutel];
  const k = JSON.parse(JSON.stringify(v && typeof v === 'object' ? v : {}));
  const voor = JSON.stringify(k);
  const r = werk(k);
  if (r && typeof r.then === 'function') throw new Error('Een codetransactie mag niet asynchroon zijn.');
  if (JSON.stringify(k) !== voor) { d()[sleutel] = k; save(); }
  return r;
};

module.exports = ({ d, save, crypto, nu, bewerkCollectie, COL, oud, namespace, prefix, issuer, doel, scope,
  geldigMs, maxGebruik, bewaarMs = 2 * 86400000 }) => {
  const iso = (ms) => new Date(ms == null ? nu() : ms).toISOString();
  const bearer = require('../bearercode')({ crypto, namespace, nu: () => iso() });
  const kaal = s => String(s == null ? '' : s).toUpperCase().replace(/[^0-9A-Z]/g, '');
  const weergave = code => { const k = kaal(code); return k.slice(0, 2) + '-' + k.slice(2).match(/.{1,4}/g).join('-'); };
  const afdruk = s => crypto.createHash('sha256').update(String(s)).digest('hex');
  const kopie = v => JSON.parse(JSON.stringify(v));

  const doeIn = transactieOp({ d, save, bewerkCollectie });
  const transactie = werk => doeIn(COL, bron => {
    if (!bron || typeof bron !== 'object' || Array.isArray(bron)) throw new Error(COL + ' hoort een kaart te zijn');
    return werk(bron);
  });
  /* De oude kale codes weg. Geen nieuwe array aanmaken waar er geen is. */
  let oudGewist = false;
  async function wisOud() {
    if (oudGewist) return;
    const v = d()[oud];
    if (Array.isArray(v) && v.length) await doeIn(oud, b => { if (Array.isArray(b)) b.splice(0); });
    oudGewist = true;
  }
  const kijk = () => { const v = d()[COL]; return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; };
  const zoek = (bron, code) => bearer.vind(Object.values(bron), kaal(code),
    r => r && r.toegang && r.toegang.code_hash);
  const reden = r => bearer.reden(r && r.toegang, { doel, scope });
  function ruim(bron) {
    const grens = nu() - bewaarMs;
    for (const [id, r] of Object.entries(bron))
      if (!r || (r.stand !== 'claimend' && !(Date.parse(r.bijgewerkt_at) >= grens))) delete bron[id];
  }
  const openVan = (bron, codenaam) => Object.values(bron).filter(r => r && r.codenaam === codenaam &&
    r.stand === 'open' && r.toegang && !r.toegang.ingetrokken_at);

  async function uitgeven({ codenaam, idem, extra }) {
    await wisOud();
    const idemHash = idem ? afdruk(COL + '|uitgifte|' + codenaam + '|' + idem) : null;
    return transactie(bron => {
      if (idemHash && Object.values(bron).some(r => r && r.codenaam === codenaam && bearer.zelfdeHash(r.idem_hash, idemHash)))
        return { status: 409, code: 'CODE_AL_UITGEGEVEN',
          error: 'Deze code is al gemaakt en wordt niet opnieuw getoond. Maak een nieuwe als je hem kwijt bent.' };
      ruim(bron);
      for (const r of openVan(bron, codenaam)) {
        bearer.intrekken(r.toegang, 'lid', 'vervangen door een nieuwe code');
        r.stand = 'ingetrokken'; r.bijgewerkt_at = iso();
      }
      const id = prefix + crypto.randomBytes(8).toString('hex').toUpperCase();
      const g = bearer.maak({ prefix, issuer, doel, scope, onderwerp: { soort: COL, id }, geldigMs, maxGebruik });
      g.toegang.code_hash = bearer.hash(kaal(g.code));
      bron[id] = Object.assign({ id, codenaam, toegang: g.toegang, stand: 'open', idem_hash: idemHash,
        claim: null, uitkomst: null, bijgewerkt_at: iso() }, extra || {});
      return { ok: true, eenmalig: true, code: weergave(g.code), geldigTot: Date.parse(g.toegang.expires_at),
        toegang: bearer.publiek(g.toegang) };
    });
  }

  /* Server-side intrekken: elke open code van dit lid. Een lopende claim blijft
     staan -- die hoort afgemaakt te worden, niet afgebroken. */
  async function intrekken({ codenaam }) {
    await wisOud();
    return transactie(bron => {
      let n = 0;
      for (const r of openVan(bron, codenaam)) {
        bearer.intrekken(r.toegang, 'lid', 'ingetrokken door het lid');
        r.stand = 'ingetrokken'; r.bijgewerkt_at = iso(); n++;
      }
      return { ok: true, ingetrokken: n };
    });
  }

  return { COL, bearer, kaal, weergave, afdruk, kopie, iso, doeIn, transactie, wisOud, kijk, zoek, reden,
    uitgeven, intrekken };
};

module.exports.transactieOp = transactieOp;
