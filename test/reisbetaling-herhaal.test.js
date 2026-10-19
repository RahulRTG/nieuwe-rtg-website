/* Een reisbetaling na een crash herhalen maakt de herkomst niet dubbel
   (server/kern/reisbureau-betaling.js betaal).

   Gevonden door TravelOS, nagemeten door Geld. De boeking zelf is veilig: hij
   draagt de economische sleutel pay-handeling:[reis, ref], en een herhaling
   geeft dezelfde boeking terug. Maar crashte het proces NA de boeking en VOOR
   markeerBetaald, dan schreef de herhaling de herkomstrijen en de klaargezette
   uitkeringen opnieuw weg: een reis van zes onderdelen kreeg twaalf rijen en
   tien uitkeringen bij een boeking. Een mens die de uitkeringen uitvoert
   (GELD.md: RTG keert niet vanzelf uit), betaalt het hotel dan twee keer.

   Hier met een betaalnaad die een herhaling op dezelfde sleutel herkent, en een
   reisbureau dat de eerste markeerBetaald laat vallen (de crash). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { maakReisbetaling } = require('../server/kern/reisbureau-betaling');
const IBIZA = require('../server/seed/partners.js').partnerTrips.find((t) => t.id === 'ibiza-jetset');

function wereld() {
  const db = { data: {} };
  const boekingen = new Map();
  const pay = { boekAsync: async (o) => {
    if (!boekingen.has(o.economischeSleutel)) boekingen.set(o.economischeSleutel, { id: 'PB' + (boekingen.size + 1) });
    return { ok: true, boeking: boekingen.get(o.economischeSleutel) };
  } };
  const aanvraag = { ref: 'RTG-R-HERHAAL', customerKey: 'lid-1', status: 'bevestigd', tripId: IBIZA.id, personen: 1, titel: 'Ibiza' };
  const toestand = { crash: true };
  const rb = { aanvraagVan: () => aanvraag, tripVan: () => IBIZA,
    markeerBetaald: (ref, b) => {
      if (toestand.crash) { toestand.crash = false; throw new Error('proces viel weg na de boeking'); }
      if (aanvraag.betaald) return { status: 409, error: 'al betaald' };
      aanvraag.betaald = b; return { ok: true, betaald: b };
    } };
  const r = maakReisbetaling({ db, save: () => {}, crypto, payVan: () => pay, reisbureauVan: () => rb }).reisbetaling;
  return { r, boekingen, aanvraag };
}

test('een crash tussen boeking en "betaald": de herhaling boekt niet dubbel en schrijft de herkomst en de uitkeringen een keer', async () => {
  const w = wereld();
  await assert.rejects(() => w.r.betaal({ key: 'lid-1' }, 'Codenaam', 'RTG-R-HERHAAL'), /viel weg/);
  const t = await w.r.betaal({ key: 'lid-1' }, 'Codenaam', 'RTG-R-HERHAAL');
  assert.equal(t.ok, true, JSON.stringify(t));
  assert.equal(w.boekingen.size, 1, 'een boeking');
  assert.equal(w.r.rijenVan('RTG-R-HERHAAL').length, 6, 'zes onderdelen, zes herkomstrijen');
  assert.equal(w.r.uitkeringenVan('RTG-R-HERHAAL').length, 5, 'vijf uitkeringen aan derden, een keer klaargezet');
  assert.ok(w.aanvraag.betaald, 'en nu heet de reis betaald');
  const derde = await w.r.betaal({ key: 'lid-1' }, 'Codenaam', 'RTG-R-HERHAAL');
  assert.equal(derde.alBetaald, true);
  assert.equal(w.r.rijenVan('RTG-R-HERHAAL').length, 6);
});
