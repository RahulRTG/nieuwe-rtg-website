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
  const handel = async (res, werk) => {
    try { stuur(res, await Promise.resolve(werk())); }
    catch (e) {
      /* Een opslagfout mag nooit een zojuist aangeboden kale code naar stdout
         kopiëren. De operationele foutteller gebruikt daarom alleen de route. */
      console.error('[festivalgroep] veilige verwerking mislukt');
      res.status(503).json({ error: 'De groep kon niet veilig worden verwerkt. Probeer het later opnieuw.' });
    }
  };
  const idem = req => String(((req.body || {}).idem || req.get('idempotency-key') || '')).slice(0, 200);

  /* Het festival en de editie waar dit over gaat. Een lid bezit geen festival,
     dus er is hier geen eigendomsvraag -- de groep bewaakt zichzelf met de code
     en met het lidmaatschap. */
  const waar = (req) => {
    const b = req.body || {};
    const f = festival.festivalVind(String(b.festival || ''));
    return f ? { fid: f.id, eid: String(b.editie || '') } : null;
  };

  app.post('/api/festival/groep', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    const w = waar(req);
    if (!w) return stuur(res, nietGevonden);
    await handel(res, () => festival.groepMaak(w.fid, w.eid, {
      naam: (req.body || {}).naam,
      maker: liveCodename(req.session)        // uit de SESSIE, nooit uit het lichaam
    }, idem(req)));
  });

  /* Alleen een code is genoeg voor een gast die nog geen festival ziet. Het
     zoeken en claimen gebeurt in één collectietransactie; er is geen los
     zoek-endpoint en nul of meerdere treffers geven dezelfde weigering. */
  app.post('/api/festival/groep/mee', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    const b = req.body || {}, w = waar(req);
    if (!w && (b.festival || b.editie)) return stuur(res, nietGevonden);
    await handel(res, () => festival.groepDeelnemen(w && w.fid, w && w.eid, {
      code: b.code, codenaam: liveCodename(req.session)
    }));
  });

  app.post('/api/festival/groep/weg', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    const w = waar(req);
    if (!w) return stuur(res, nietGevonden);
    await handel(res, () => festival.groepVerlaat(w.fid, w.eid, {
      id: (req.body || {}).id, codenaam: liveCodename(req.session)
    }));
  });

  app.post('/api/festival/groep/code', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    const w = waar(req);
    if (!w) return stuur(res, nietGevonden);
    await handel(res, () => festival.groepCodeVernieuw(w.fid, w.eid, {
      id: (req.body || {}).id, codenaam: liveCodename(req.session)
    }, idem(req)));
  });

  app.post('/api/festival/groep/stand', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    const w = waar(req);
    if (!w) return stuur(res, nietGevonden);
    await handel(res, () => festival.groepStand(w.fid, w.eid,
      (req.body || {}).id, liveCodename(req.session)));
  });

  app.post('/api/festival/groep/mijn', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    const w = waar(req);
    if (!w) return stuur(res, nietGevonden);
    await handel(res, () => {
      const e = festival.editieVind(w.fid, w.eid);
      const mijn = festival.groepenVan(e, liveCodename(req.session));
      return { ok: true, groepen: mijn.map(g => ({ id: g.id, naam: g.naam,
        leden: g.leden.length, toegang: g.toegang })) };
    });
  });
};
