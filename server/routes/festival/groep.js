/* Routes "festival" (deelmodule): DE GROEP.

   DIT IS DE LEDENKANT, en de enige in dit domein. Alle andere festivalroutes
   gaan over de ZAAK die het festival draait; een groep is tussen GASTEN. De
   organisatorkant leest hier niets: zie de kop van kern/festival/groep.js.

   DE CODENAAM KOMT UIT DE SESSIE. Steeds dezelfde regel als bij de klok, de
   naam op een bewijsstuk en de zaakcode van een partnerband, en hier weegt hij
   het zwaarst: zou `codenaam` uit het lichaam komen, dan maakt iemand een groep
   op andermans naam, stapt hij uit een groep waar hij niet in zit, en leest hij
   de stand van een groep waar hij niet bij hoort. Een groep is dan geen groep
   meer maar een lijst waar iedereen aan kan zitten.

   ER GAAT HIER NIETS DE DEUR UIT. Geen uitnodiging, geen herinnering, geen
   melding aan een ander lid. Wie meedoet, doet dat zelf met een code die hij
   van een mens heeft gekregen. */
'use strict';

module.exports = (kern) => {
  const { app, auth, festival, geenGast, liveCodename } = kern;

  const httpCode = (v) => (Number.isInteger(v) && v >= 100 && v <= 599 ? v : 200);
  const stuur = (res, r) => res.status(httpCode(r && r.status)).json(r);
  const nietGevonden = { status: 404, error: 'Deze groep bestaat niet.' };

  /* Het festival en de editie waar dit over gaat. Een lid bezit geen festival,
     dus er is hier geen eigendomsvraag -- de groep bewaakt zichzelf met de code
     en met het lidmaatschap. */
  const waar = (req) => {
    const b = req.body || {};
    const f = festival.festivalVind(String(b.festival || ''));
    return f ? { fid: f.id, eid: String(b.editie || '') } : null;
  };

  app.post('/api/festival/groep', auth, (req, res) => {
    if (geenGast(req, res)) return;
    const w = waar(req);
    if (!w) return stuur(res, nietGevonden);
    stuur(res, festival.groepMaak(w.fid, w.eid, {
      naam: (req.body || {}).naam,
      maker: liveCodename(req.session)        // uit de SESSIE, nooit uit het lichaam
    }));
  });

  app.post('/api/festival/groep/mee', auth, (req, res) => {
    if (geenGast(req, res)) return;
    const w = waar(req);
    if (!w) return stuur(res, nietGevonden);
    stuur(res, festival.groepDeelnemen(w.fid, w.eid, {
      code: (req.body || {}).code, codenaam: liveCodename(req.session)
    }));
  });

  app.post('/api/festival/groep/weg', auth, (req, res) => {
    if (geenGast(req, res)) return;
    const w = waar(req);
    if (!w) return stuur(res, nietGevonden);
    stuur(res, festival.groepVerlaat(w.fid, w.eid, {
      id: (req.body || {}).id, codenaam: liveCodename(req.session)
    }));
  });

  app.post('/api/festival/groep/code', auth, (req, res) => {
    if (geenGast(req, res)) return;
    const w = waar(req);
    if (!w) return stuur(res, nietGevonden);
    stuur(res, festival.groepCodeVernieuw(w.fid, w.eid, {
      id: (req.body || {}).id, codenaam: liveCodename(req.session)
    }));
  });

  app.post('/api/festival/groep/stand', auth, (req, res) => {
    if (geenGast(req, res)) return;
    const w = waar(req);
    if (!w) return stuur(res, nietGevonden);
    stuur(res, festival.groepStand(w.fid, w.eid, (req.body || {}).id, liveCodename(req.session)));
  });

  app.post('/api/festival/groep/mijn', auth, (req, res) => {
    if (geenGast(req, res)) return;
    const w = waar(req);
    if (!w) return stuur(res, nietGevonden);
    const e = festival.editieVind(w.fid, w.eid);
    const mijn = festival.groepenVan(e, liveCodename(req.session));
    res.json({ ok: true, groepen: mijn.map(g => ({ id: g.id, naam: g.naam, leden: g.leden.length })) });
  });
};
