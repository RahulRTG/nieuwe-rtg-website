/* Tijdelijke projectie van het oudere orderkanaal; opslag blijft onaangeraakt. */
'use strict';
const { hoofdfase, FASE_TEKST } = require('./orderbeeld-basis');
const DEFINITIEF = new Set(['geleverd','bezorgd','opgehaald','geserveerd','geweigerd','terugbetaald','geannuleerd']);

module.exports = function projecteerLegacy(order) {
  const levering = order.levering === 'bezorgen' ? 'bezorging' : 'afhaal';
  const status = String(order.status || 'nieuw');
  const productie = status === 'nieuw' ? 'wacht' : status === 'in bereiding' ? 'in-bereiding'
    : status === 'klaar' ? 'klaar' : DEFINITIEF.has(status) ? 'overgedragen' : 'wacht';
  const fulfillment = status === 'onderweg' ? 'onderweg' : status === 'bezorgd' ? 'geleverd'
    : ['opgehaald','geserveerd'].includes(status) ? 'opgehaald' : status === 'klaar' ? 'klaar-voor-overdracht'
      : levering === 'bezorging' ? 'bezorging-gepland' : 'afhaal-gepland';
  const assen = { acceptatie:status === 'geweigerd' ? 'geweigerd' : status === 'nieuw' ? 'ontvangen' : 'geaccepteerd',
    productie, fulfillment, betaling:order.refunded ? 'terugbetaald' : order.paid ? 'betaald' : 'openstaand',
    incident:status === 'geweigerd' ? 'open' : 'geen' };
  const fase = hoofdfase(assen), tekst = FASE_TEKST[fase] || FASE_TEKST.ontvangen;
  return { id:'legacy:' + order.ref, bron:'legacy-order', ref:order.ref,
    zaak:{ code:order.supplierCode, naam:order.supplierName || order.supplierCode },
    klant:{ codenaam:order.customerCodename || 'Gast' }, kanaal:levering, code:order.pickup || null,
    aangemaaktAt:order.at, producten:(order.items || []).map(i => ({ itemId:i.id, naam:i.name,
      aantal:i.qty, centen:Math.round(Number(i.price || 0) * 100), opties:i.opties || [] })),
    prijs:{ totaal:Math.round(Number(order.total || 0) * 100),
      betaald:order.paid ? Math.round(Number(order.total || 0) * 100) : 0,
      openstaand:order.paid ? 0 : Math.round(Number(order.total || 0) * 100), valuta:'EUR' },
    statussen:assen, fase, status:{ sleutel:fase, label:tekst[0], uitleg:tekst[1] },
    allergieControle:!!order.allergyNote, wijzigingen:[], _legacy:order };
};
