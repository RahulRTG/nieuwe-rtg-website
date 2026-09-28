/* De publieke voordeur van Invisible Arrival: remmen, de pass herkennen, en de
   drie handelingen van de houder op zijn eigen pass (lezen, roteren,
   intrekken). De pass zelf -- uitgifte, hash-only opslag, verval, de
   transactie -- woont in kern/arrivalpas.js; hier staat alleen wat HTTP is.

   Een pass die bij het lezen dicht blijkt (reservering geweigerd, geannuleerd,
   no-show of afgerond) wordt ook als ingetrokken vastgelegd, zodat de stand
   in de opslag zegt wat de deur al deed. */
'use strict';

const rem = require('../../../rem');

module.exports = ({ app, db, arrivalpas }) => {
  const interpretRem = rem({ windowMs: 60000, limit: 30, key: req => 'arrival-interpret|' + req.ip });
  const requestRem = rem({ windowMs: 15 * 60000, limit: 8, key: req => 'arrival-request|' + req.ip });
  const passRem = rem({ windowMs: 60000, limit: 60, key: req => 'arrival-pass|' + req.ip });
  const pulseRem = rem({ windowMs: 60000, limit: 20, key: req => 'arrival-pulse|' + req.ip });
  const reserveringVan = id => (db.data.reserveringen || []).find(x => x.id === id) || null;
  const arrivalVan = rij => {
    const a = rij && ((db.data.horeca || {})[rij.supplierCode] || {}).arrivals;
    return a && Object.prototype.hasOwnProperty.call(a, rij.id) ? a[rij.id] : null;
  };
  const geenOpslag = res => res.status(503).json({ error: 'De pass kon nu niet veilig worden bijgewerkt. Probeer het zo opnieuw.' });

  async function arrivalPassAuth(req, res, next) {
    res.set('Cache-Control', 'no-store');
    const uit = arrivalpas.lees((req.body || {}).pass, reserveringVan);
    if (uit.status !== 200) {
      if (uit.dicht) try { await arrivalpas.sluitDicht(uit.rij.id, 'reservering gaat niet door'); } catch (e) { /* de deur is al dicht */ }
      return res.status(uit.status).json({ error: uit.error });
    }
    const a = arrivalVan(uit.rij);
    if (!a) return res.status(401).json({ error: 'Deze Arrival Pass is niet geldig.' });
    req.arrival = { code: uit.rij.supplierCode, a, rij: uit.rij };
    next();
  }

  app.post('/api/arrival/pass/roteer', passRem, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    let uit;
    try { uit = await arrivalpas.roteer((req.body || {}).pass, reserveringVan); } catch (e) { return geenOpslag(res); }
    if (uit.status !== 200) return res.status(uit.status).json({ error: uit.error });
    res.json({ ok: true, eenmalig: true, accessToken: uit.code,
      let: 'Dit is uw nieuwe pass; de vorige werkt niet meer.' });
  });

  app.post('/api/arrival/pass/intrek', passRem, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    let uit;
    try { uit = await arrivalpas.intrek((req.body || {}).pass); } catch (e) { return geenOpslag(res); }
    if (uit.status !== 200) return res.status(uit.status).json({ error: uit.error });
    res.json({ ok: true, let: 'De pass is ingetrokken. Uw reservering zelf blijft staan.' });
  });

  return { interpretRem, requestRem, passRem, pulseRem, arrivalPassAuth, reserveringVan, geenOpslag };
};
