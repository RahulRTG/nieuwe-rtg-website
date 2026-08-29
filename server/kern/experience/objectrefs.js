/* Stabiele platformverwijzingen. Een wereld projecteert deze refs en maakt
   nooit een eigen kopie van het domeinobject. */
'use strict';

const DOMEIN_PER_SOORT = Object.freeze({
  verblijf: 'hospitality', vlucht: 'aviation', charter: 'aviation', reis: 'travel',
  afspraak: 'agenda', taak: 'notes', document: 'office', bestand: 'files',
  gesprek: 'communication', bijeenkomst: 'community', bericht: 'social',
  saldo: 'pay', verrekening: 'shared-expenses', toezegging: 'patronage',
  achterstallig: 'life', komt: 'life'
});

function schoonDeel(v, terugval) {
  const s = String(v || '').toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return (s || terugval || 'unknown').slice(0, 96);
}

function maakRef(item, crypto, wereld) {
  const soort = schoonDeel(item && (item.soort || item.type), 'item');
  const domain = schoonDeel(item && item.domain, DOMEIN_PER_SOORT[soort] || wereld || 'platform');
  let id = item && (item.kenmerk || item.id);
  if (!id) {
    const grond = [wereld, soort, item && item.titel, item && item.wanneer,
      item && item.van, item && item.link].map(x => String(x || '')).join('|');
    id = crypto.createHash('sha256').update(grond).digest('hex').slice(0, 20);
  }
  return Object.freeze({ domain, type: soort, id: schoonDeel(id, 'unknown') });
}

function sleutel(ref) {
  if (!geldig(ref)) return '';
  return ref.domain + ':' + ref.type + ':' + ref.id;
}

function geldig(ref) {
  return !!(ref && /^[a-z0-9._-]+$/.test(ref.domain || '') &&
    /^[a-z0-9._-]+$/.test(ref.type || '') && /^[a-z0-9._-]+$/.test(ref.id || ''));
}

module.exports = { maakRef, sleutel, geldig, DOMEIN_PER_SOORT };
