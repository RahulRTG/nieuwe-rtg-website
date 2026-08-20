/* Routes "festival" (deelmodule): DE DIENST.

   TWEE KANTEN MET EEN HEEL VERSCHILLEND DOEL. Het rooster MAKEN is managerwerk
   en gaat over iedereen; het rooster LEZEN doet een medewerker over zichzelf,
   op een telefoon, vaak lopend, en dan telt elke seconde die hij niet hoeft te
   zoeken.

   WIE DE DIENST VAN IS, KOMT UIT DE SESSIE. /api/festival/dienst/mijn kent geen
   `wie` in het lichaam: dan leest een medewerker de dienst van een collega,
   inclusief zijn briefing en met wie hij staat. Dat is dezelfde regel als bij
   de klok, de codenaam en de zaakcode -- de vijfde keer in dit domein, en elke
   keer omdat het lichaam van een verzoek geen bewijs van identiteit is.

   ER WORDT HIER NIET INGEKLOKT. Die knop hoort bij kern/personeel.js en staat
   daar al; een tweede klok levert een tweede urenstaat op, en dan is er een die
   niet klopt bij de loonrun. */
'use strict';

module.exports = (kern, deur) => {
  const { app, festival, logActivity, managerOnly, supplierAuth } = kern;
  const { mijn, editieVan, geenFestival, stuur } = deur;

  const nu = () => {
    const t = new Date().toISOString();
    return { datum: t.slice(0, 10), tijd: t.slice(11, 16) };
  };

  app.post('/api/festival/dienst', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const f = mijn(req);
    if (!f) return stuur(res, geenFestival);
    const r = festival.dienstZet(f.id, editieVan(req), req.body || {});
    if (r.ok) logActivity(req.supplier.code, req.actor, 'zette een dienst voor ' + r.dienst.wie);
    stuur(res, r);
  });

  app.post('/api/festival/dienst/weg', supplierAuth, (req, res) => {
    if (!managerOnly(req, res)) return;
    const f = mijn(req);
    if (!f) return stuur(res, geenFestival);
    stuur(res, festival.dienstWeg(f.id, editieVan(req), (req.body || {}).id));
  });

  /* Het hele rooster van een dag: voor wie het maakt en voor wie het bewaakt. */
  app.post('/api/festival/diensten', supplierAuth, (req, res) => {
    const f = mijn(req);
    if (!f) return stuur(res, geenFestival);
    stuur(res, festival.dienstenVan(f.id, editieVan(req), (req.body || {}).dag));
  });

  /* DE ENE VRAAG VAN DE MEDEWERKER. De lopende dag komt van de server (een
     festivaldag loopt over middernacht heen) en de naam uit de sessie. */
  app.post('/api/festival/dienst/mijn', supplierAuth, (req, res) => {
    const f = mijn(req);
    if (!f) return stuur(res, geenFestival);
    const eid = editieVan(req);
    const e = festival.editieVind(f.id, eid);
    if (!e) return stuur(res, { status: 404, error: 'Deze editie bestaat niet.' });
    const t = nu();
    const dag = festival.dagOpMoment(e, t.datum, t.tijd);
    stuur(res, festival.mijnDienst(f.id, eid, {
      wie: (req.actor && req.actor.name) || '',       // uit de SESSIE, nooit uit het lichaam
      dag: dag ? dag.id : '', tijd: t.tijd
    }));
  });
};
