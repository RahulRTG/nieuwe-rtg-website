/* RTG ZELF ALS WERKGEVER -- de deuren (kern/rtghuis.js, VRIJHEID.md).

   Dezelfde verdeling als de RTFoundation-positie (routes/office/instellingen.js):
   de STAND mag het hele kantoor zien, hem MAKEN is boardroom -- de eigenaar,
   want er ontstaat een werkgever en een eerste leidinggevende.

   De afdelingen zet een leidinggevende VAN DE RTG-ZAAK, met zijn eigen login.
   Niet het anonieme kantoor: wie iemand in een kamer zet, bepaalt voor wie hij
   de dienst draagt, en dat hoort een naam te hebben. */
'use strict';

module.exports = (kern) => {
  const { app, officeAuth, supplierAuth, managerOnly, boardroomAuth, boardroomWie, rtghuis, vrijheid } = kern;
  const antwoord = (res, r) => r && r.error ? res.status(r.status || 400).json(r) : res.json(r);

  app.post('/api/office/rtghuis', officeAuth, (req, res) => res.json(rtghuis.stand()));

  app.post('/api/office/rtghuis/maak', boardroomAuth, async (req, res) => {
    let r;
    const mis = await vrijheid.vastleggen(() => { r = rtghuis.maak(req.body || {}, boardroomWie(req)); });
    if (mis) return res.status(mis.status || 503).json(mis);
    antwoord(res, r);
  });

  /* Wie zit in welke kamer, voor een leidinggevende van RTG zelf. */
  app.post('/api/supplier/rtg/afdelingen', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const code = req.supplier.code;
    if (!rtghuis.isRtgZaak(code)) return res.status(404).json({ error: 'Afdelingen bestaan alleen in de zaak van RTG zelf.' });
    const kamers = rtghuis.kamerIds();
    res.json({ ok: true, kamers, leden: Object.fromEntries(kamers.map(k => [k, rtghuis.ledenVan(k)])) });
  });

  app.post('/api/supplier/rtg/afdeling', supplierAuth, async (req, res) => {
    if (!managerOnly(req, res)) return;
    const door = req.actor && req.actor.staffId != null ? String(req.actor.staffId) : null;
    const b = req.body || {};
    let r;
    const mis = await vrijheid.vastleggen(() => {
      r = rtghuis.afdelingZet(req.supplier.code, String(b.staffId || ''), b.kamers, { door, leidinggevende: !!door });
    });
    if (mis) return res.status(mis.status || 503).json(mis);
    antwoord(res, r);
  });
};
