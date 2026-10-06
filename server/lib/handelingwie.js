/* Het handelingsspoor (./handelingsspoor.js): de afdruk van een verzoeklijf en
   WIE er handelt. Geknipt uit dat bestand (keuringsregel 13); de reden achter
   beide staat in de kop daarvan. */
'use strict';

const crypto = require('crypto');

/* Velden die niet in de afdruk horen: de idem-sleutel is geen inhoud, en vrije
   tekst maakt van twee gelijke handelingen twee verschillende. Zelfde lijst en
   zelfde reden als in lib/idem-poort.js. */
const BUITEN_AFDRUK = new Set(['idem', 'idempotentieSleutel', 'notitie', 'omschrijving', 'oms', 'toelichting']);

function afdrukVan(body) {
  if (!body || typeof body !== 'object') return '';
  const uit = {};
  for (const k of Object.keys(body).sort()) {
    if (BUITEN_AFDRUK.has(k)) continue;
    uit[k] = body[k];
  }
  try { return crypto.createHash('sha256').update(JSON.stringify(uit)).digest('hex').slice(0, 16); }
  catch (e) { return ''; }
}

/* WIE. Zie de kop: liever 'niemand aan te wijzen' dan een verzonnen naam. */
function wieVan(req) {
  const s = req.session;
  if (s && s.key) return String(s.key).slice(0, 60);
  const pad = String(req.path || req.url || '');
  if (pad.startsWith('/api/office') || pad.startsWith('/api/command')) return 'kantoor (gedeelde code)';
  if (pad.startsWith('/api/supplier') || pad.startsWith('/api/partner')) return 'partner (niet herleid)';
  return 'anoniem';
}

module.exports = { afdrukVan, wieVan, BUITEN_AFDRUK };
