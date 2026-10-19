/* De veegronde voor terugbetalingen: de uitgaande tegenhanger van ./hervat.js.

   Een terugbetaling die de provider aannam maar nog niet bevestigde, staat op
   BIJ_PROVIDER en wacht op een melding (./terug.js). Bleef die melding weg,
   dan stond hij daar eeuwig, alleen als getal in betaalregie-waarheid.js. Dat
   gold voor elke provider; de simulatiebank liet het zien
   (test/terugveeg.test.js).

   Besluit van de integrator (19 oktober 2026): de simulatie rondt niets zelf
   af -- dan lost zij op wat bij een echte provider open blijft -- en deze ronde
   is voor elke provider gelijk:
     - na een wachttijd vraagt hij de terugbetaling opnieuw na bij de provider
       (betaal.haalTerugbetaling, op het refund-id dat de provider gaf);
     - bevestigd of geweigerd gaat via providerTerugbetaling, de weg die een
       melding ook neemt, zodat hij precies een keer telt, ook als de melding
       daarna alsnog binnenkomt;
     - zonder uitsluitsel na MAX navragen krijgt de opdracht een ESCALATIE voor
       een mens. Zijn stand blijft BIJ_PROVIDER: "wij weten het niet" is geen
       "terugbetaald", en ook geen "mislukt". */
'use strict';

const { WACHT_MS } = require('./hervat');
const MAX = WACHT_MS.length;
const GEDAAN = new Set(['refunded', 'succeeded']);
const MIS = new Set(['failed', 'canceled', 'cancelled']);

module.exports = function maakTerugveeg({ doos, save, nuIso, gebeurtenis, betaal, providerTerugbetaling, log }) {
  const tijdVan = w => { const n = typeof w === 'number' ? w : Date.parse(String(w || '')); return Number.isFinite(n) ? n : 0; };
  const open = op => op && op.status === 'BIJ_PROVIDER' && op.providerRefundId && !op.escalatie;

  async function veeg({ tot, limiet } = {}) {
    const grens = Number.isFinite(tot) ? tot : tijdVan(tot || nuIso());
    const max = Math.min(100, Math.max(1, Number(limiet) || 25));
    const uit = { bekeken: 0, bevestigd: 0, geweigerd: 0, wachtNog: 0, geescaleerd: 0 };
    for (const r of Object.values(doos())) {
      for (const op of (r && r.terugbetaalOpdrachten) || []) {
        if (!open(op) || uit.bekeken >= max) continue;
        const volgende = op.veegVolgendeAt ? tijdVan(op.veegVolgendeAt) : tijdVan(op.bijgewerktAt) + WACHT_MS[0];
        if (volgende > grens) continue;
        uit.bekeken++;
        let p = null, fout = null;
        try {
          if (!betaal || typeof betaal.haalTerugbetaling !== 'function') throw new Error('Navraag naar terugbetalingen is niet aangesloten.');
          p = await betaal.haalTerugbetaling(r.provider, { providerId: r.providerPaymentId || r.providerId, refundId: op.providerRefundId });
        } catch (e) { fout = e; }
        const s = String((p && p.status) || '').toLowerCase();
        if (GEDAAN.has(s) || MIS.has(s)) {
          await providerTerugbetaling({ eventId: 'veeg:' + op.providerRefundId + ':' + s, aanbieder: r.provider,
            providerRefundId: op.providerRefundId, referentie: r.id, gelukt: GEDAAN.has(s),
            centen: Number.isFinite(p.bedrag) ? p.bedrag : op.centen, valuta: p.valuta || r.valuta });
          uit[GEDAAN.has(s) ? 'bevestigd' : 'geweigerd']++;
          continue;
        }
        const n = (Number(op.veegPogingen) || 0) + 1;
        op.veegPogingen = n;
        if (n >= MAX) {
          op.escalatie = { at: nuIso(), reden: 'geen uitsluitsel van de provider na ' + n + ' navragen' +
            (fout ? ' (laatste fout: ' + String(fout.message || fout).slice(0, 120) + ')' : '') };
          gebeurtenis(r, 'TERUGBETALING_ESCALATIE', { opdrachtId: op.id, reden: op.escalatie.reden });
          uit.geescaleerd++;
          if (log && log.warn) log.warn('betaalwaarheid: terugbetaling zonder uitsluitsel, een mens moet dit afstemmen', { id: r.id, opdracht: op.id });
        } else {
          op.veegVolgendeAt = new Date(grens + WACHT_MS[n]).toISOString();
          uit.wachtNog++;
        }
        save();
      }
    }
    return uit;
  }

  /* wat er voor de reconciliatie nog openstaat aan terugbetalingen */
  function openstaand() {
    const uit = { terugWacht: 0, terugWachtCenten: 0, terugEscalatie: 0 };
    for (const r of Object.values(doos())) {
      for (const op of (r && r.terugbetaalOpdrachten) || []) {
        if (op.status !== 'BIJ_PROVIDER' && op.status !== 'VASTGELEGD') continue;
        uit.terugWacht++; uit.terugWachtCenten += op.centen;
        if (op.escalatie) uit.terugEscalatie++;
      }
    }
    return uit;
  }

  return { veeg, openstaand };
};

module.exports.WACHT_MS = WACHT_MS;
