/* Routes "festival" (deelmodule): DE ARTIEST, DE RIDER EN HET PODIUM.

   WIE IETS VASTLEGT, KOMT UIT DE SESSIE. `door` komt nooit uit het lichaam --
   niet bij het bevestigen van een boeking en niet bij het afvinken van een
   riderpunt. Dat is de zesde keer in dit domein en steeds om dezelfde reden:
   een verslag van een menselijke uitspraak ("Marta bevestigde dit") is niets
   waard als de aanvrager zelf mag invullen wie Marta is.

   EN HET MOMENT KOMT VAN DE SERVER. Het podiumbeeld is een cockpit: als de
   telefoon de tijd mag meesturen, kan iemand het scherm rustig praten door een
   uur terug te vragen. Dezelfde regel als bij de poort.

   HET BEELD IS TE LEZEN ZONDER MANAGER. Een stage manager is geen manager in
   de zin van kern/personeel.js. Wat er nu op zijn podium speelt en wat er open
   staat, hoort hij te zien; het schema VERANDEREN is managerwerk. */
'use strict';

module.exports = (kern, deur) => {
  const { app, festival, logActivity, managerOnly, supplierAuth } = kern;
  const { mijn, editieVan, geenFestival, stuur } = deur;

  const wie = (req) => (req.actor && req.actor.name) || '';
  const nu = () => {
    const t = new Date().toISOString();
    return { datum: t.slice(0, 10), tijd: t.slice(11, 16) };
  };

  /* ---- het schema ---- */

  app.post('/api/festival/boeking', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const f = mijn(req);
    if (!f) return stuur(res, geenFestival);
    const r = festival.boekingZet(f.id, editieVan(req), req.body || {});
    if (r.ok) logActivity(req.supplier.code, req.actor, 'zette ' + r.boeking.artiest + ' in het schema');
    stuur(res, r);
  });

  app.post('/api/festival/boeking/stand', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const f = mijn(req);
    if (!f) return stuur(res, geenFestival);
    const r = festival.boekingStand(f.id, editieVan(req), {
      ...(req.body || {}), door: wie(req)         // uit de SESSIE, nooit uit het lichaam
    });
    if (r.ok) logActivity(req.supplier.code, req.actor, r.boeking.artiest + ' staat nu op ' + r.boeking.stand);
    stuur(res, r);
  });

  app.post('/api/festival/boekingen', supplierAuth, (req, res) => {
    const f = mijn(req);
    if (!f) return stuur(res, geenFestival);
    stuur(res, festival.boekingenVan(f.id, editieVan(req), (req.body || {}).dag));
  });

  /* ---- de rider ---- */

  app.post('/api/festival/rider', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const f = mijn(req);
    if (!f) return stuur(res, geenFestival);
    stuur(res, festival.riderZet(f.id, editieVan(req), req.body || {}));
  });

  /* AFVINKEN MAG IEDEREEN DIE ER STAAT. Wie de handdoeken neerlegt is niet de
     manager, en een riderpunt dat pas 's avonds op zijn naam kan komen, wordt
     's ochtends niet afgevinkt. Zijn naam komt wel uit de sessie. */
  app.post('/api/festival/rider/vink', supplierAuth, (req, res) => {
    const f = mijn(req);
    if (!f) return stuur(res, geenFestival);
    stuur(res, festival.riderVink(f.id, editieVan(req), { ...(req.body || {}), door: wie(req) }));
  });

  app.post('/api/festival/boeking/extra', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const f = mijn(req);
    if (!f) return stuur(res, geenFestival);
    stuur(res, festival.extraZet(f.id, editieVan(req), req.body || {}));
  });

  /* DE AFREKENING IS EEN OVERZICHT. Er zit hier geen betaalknop naast en die
     komt er ook niet bij: geld verlaat het huis niet vanzelf (GELD.md). */
  app.post('/api/festival/boeking/afrekening', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const f = mijn(req);
    if (!f) return stuur(res, geenFestival);
    stuur(res, festival.afrekening(f.id, editieVan(req), (req.body || {}).boeking));
  });

  /* ---- de vloer ---- */

  app.post('/api/festival/podiumbeeld', supplierAuth, (req, res) => {
    const f = mijn(req);
    if (!f) return stuur(res, geenFestival);
    const eid = editieVan(req);
    const e = festival.editieVind(f.id, eid);
    if (!e) return stuur(res, { status: 404, error: 'Deze editie bestaat niet.' });
    const t = nu();
    const dag = festival.dagOpMoment(e, t.datum, t.tijd);
    if (!dag) return stuur(res, { ok: true, geenDag: true, podia: [] });
    stuur(res, festival.podiumBeeld(f.id, eid, { dag: dag.id, tijd: t.tijd }));
  });
};
