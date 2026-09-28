/* Een kleine maar echte wereld voor de kas- en tikcode (test/kascode-*.test.js):
   kern/pay/kassa.js, vooraf.js en tik.js, samen.js voor de samenstelling,
   kern/waarde/reserve.js voor de reservering en db/economische-boeking.js voor
   de economische sleutel. Alleen het grootboek is een nabouw met dezelfde regel
   als kern/pay/index.js: een lid gaat nooit onder nul, extern: en rtg: wel. */
'use strict';
const crypto = require('node:crypto');

module.exports = function kaswereld({ cryptoIn = crypto, delen } = {}) {
  const klok = { t: Date.parse('2026-09-27T10:00:00Z') };
  const data = { paySaldi: { 'lid:A': 20000, 'lid:C': 5000 }, payBoekingen: [] };
  const stuk = { crash: false, weiger: null, weigerRek: null, crashBij: 0, n: 0 };
  let n = 0;
  const saldi = () => data.paySaldi;
  const boek = ({ van, naar, centen, soort, oms, ref }) => {
    if (stuk.weiger && soort === 'kassa' && (!stuk.weigerRek || stuk.weigerRek === van)) return stuk.weiger;
    if (!/^(extern|rtg):/.test(van) && (saldi()[van] || 0) < centen) return { status: 402, error: 'Onvoldoende saldo.' };
    saldi()[van] = (saldi()[van] || 0) - centen; saldi()[naar] = (saldi()[naar] || 0) + centen;
    const rij = { id: 'PB' + (++n), van, naar, centen, soort, oms, ref: ref || null, at: klok.t };
    data.payBoekingen.unshift(rij);
    return { ok: true, boeking: rij };
  };
  const eenmaal = require('../../server/db/economische-boeking')({ db: { data, writable: true }, store: 'json',
    bijeen: async f => f(), save() {} });
  const ctx = { crypto: cryptoIn, save() {}, nu: () => klok.t, d: () => data, db: { data },
    schoon: (s, m) => String(s == null ? '' : s).slice(0, m), rekLid: c => 'lid:' + c, rekPartner: c => 'partner:' + c,
    saldoVan: r => Math.round(saldi()[r] || 0), grootboek: () => data.payBoekingen, boek, boekAsync: async a => boek(a),
    geldModus: 'schaduw', zorgSaldo: async () => ({ ok: true, bijgeladen: 0 }), seintje() {}, waarde: null,
    economischeBoekingEenmaal: async (i, w) => {
      const r = await eenmaal(i, w);
      if (stuk.crash || ++stuk.n === stuk.crashBij) { stuk.crash = false; throw new Error('antwoord kwijt na commit'); }
      return r;
    },
    betaaldienstKosten: c => 10 + Math.round(c / 100), bijOntvangst: () => ({ apart: 0 }),
    opdrachten: { registreerTeruggang() {} }, MIN_CENTEN: 1, MAX_CENTEN: 500000, KASCODE_MS: 300000, KASCODE_MAX: 50000 };
  Object.assign(ctx, require('../../server/kern/pay/samen')(ctx));
  // een betaling uit twee potjes (budget, dan eigen wallet), zoals ./samen.js die met een waardelaag geeft
  if (delen) ctx.stelSamen = () => ({ ok: true, delen: delen.map(x => Object.assign({}, x)) });
  const r = require('../../server/kern/waarde/reserve').maakReserve({ db: { data }, save() {}, crypto, nu: () => klok.t });
  ctx.waarde = { reservering: r.vind, reserveer: r.reserveer, vastleggen: r.vastleggen, vrijgeven: r.vrijgeven,
    reserveringenVan: r.voorRef };
  const kassa = require('../../server/kern/pay/kassa')(ctx);
  const vooraf = require('../../server/kern/pay/vooraf')(ctx);
  const tik = require('../../server/kern/pay/tik')(Object.assign({}, ctx, { stuur: async ({ van, aanCodenaam, centen, soort }) =>
    boek({ van: 'lid:' + van, naar: 'lid:' + aanCodenaam, centen, soort }) }));
  return { kassa, vooraf, tik, data, klok, stuk, saldi, waarde: ctx.waarde,
    kaal: s => String(s).replace(/[^0-9A-Z]/g, ''),
    regels: soort => data.payBoekingen.filter(b => b.soort === soort) };
};
