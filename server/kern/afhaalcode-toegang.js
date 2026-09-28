/* Het opslag- en cryptocontract van de afhaalcode (zie ./afhaalcode.js voor
   de levenscyclus). Hier staat wat een rij in `afhaalToegang` IS: welke
   bestelling hem mag dragen, hoe een lid gehasht wordt, wanneer een rij
   verjaart, en wat er naar buiten mag. Er staat hier nooit een kale code: de
   bearer bestaat alleen als `code_hash` in `toegang` en in de historie. */
'use strict';

const klok = require('../lib/klok');

const DOEL = 'order-afhaal';
const SCOPE = Object.freeze(['kassa.order.uitgeven']);
const GELDIG_MS = 6 * 3600000;
const BETAAL_VENSTER_MS = 2 * 60000;
const BEWAAR_MS = 30 * 86400000;
const DICHT = ['geserveerd', 'opgehaald', 'bezorgd', 'geweigerd', 'terugbetaald', 'geannuleerd'];

module.exports = ({ crypto, nu = () => klok.datum().toISOString() }) => {
  const bearer = require('./bearercode')({ crypto, namespace: 'pay.order_pickup_code', nu });
  const afdruk = s => crypto.createHash('sha256').update(String(s)).digest('hex');
  const lidHash = o => afdruk('rtg-afhaal-lid-v1|' + String(o.customerKey || o.customerTier || ''));
  const ms = () => Date.parse(nu());
  const idem = v => { const s = String(v == null ? '' : v).trim(); return /^[A-Za-z0-9_.:-]{8,128}$/.test(s) ? s : null; };
  /* Open en afhaalbaar. Een bezorging gaat met de bezorger mee en een
     interne spoedbon heeft geen klant. Een tafelbon die achteraf via "de
     rekening" loopt krijgt pas een code als hij betaald is (of aan de balie
     wordt afgerekend): anders rekenen twee wegen tegelijk af. */
  const open = o => !!o && !o.intern && !o.refunded && !DICHT.includes(o.status) && o.levering !== 'bezorgen';
  const mag = o => open(o) && (!!o.paid || !!o.aanBalie);
  function ruim(bron) {
    const grens = ms() - BEWAAR_MS;
    for (const [ref, r] of Object.entries(bron))
      if (!r || !(Date.parse(r.bijgewerkt_at) >= grens)) delete bron[ref];
  }
  function stand(r) {
    if (!r) return 'geen';
    if (r.uitgifte) return 'uitgegeven';
    if (!r.toegang) return 'geen';
    return bearer.reden(r.toegang, { doel: DOEL, scope: SCOPE }) || 'actief';
  }
  const publiek = r => ({ ref: r.ref, stand: stand(r), toegang: bearer.publiek(r.toegang),
    uitgegeven_at: r.uitgifte ? r.uitgifte.at : null });
  const eigenRij = (r, o) => !r || (r.supplierCode === o.supplierCode && r.lid_hash === lidHash(o));
  function nieuweRij(bron, o) {
    return bron[o.ref] = { ref: o.ref, supplierCode: o.supplierCode, lid_hash: lidHash(o),
      toegang: null, historie: [], uitgifte: null, betaling: null, betaald_bij_uitgifte: false, bijgewerkt_at: nu() };
  }
  function sluitOud(r, actor, reden) {
    if (!r.toegang) return;
    bearer.intrekken(r.toegang, actor, reden);
    r.historie.push(r.toegang);
    if (r.historie.length > 12) r.historie.splice(0, r.historie.length - 12);
    r.toegang = null;
  }
  const ikBen = (o, key) => !!o && (o.customerKey || o.customerTier) === key;

  return { bearer, afdruk, lidHash, ms, idem, open, mag, ruim, stand, publiek, eigenRij, nieuweRij,
    sluitOud, ikBen, nu, DOEL, SCOPE, GELDIG_MS, BETAAL_VENSTER_MS, DICHT };
};

module.exports.DOEL = DOEL;
module.exports.SCOPE = SCOPE;
module.exports.GELDIG_MS = GELDIG_MS;
