/* De Salon als app: plaatsen, de feed met paginering, profielen, reacties,
   bewaren, de veiligheidsknoppen en de drie AI-taken.

   Over de zichtbaarheidspoort: die blijft kern/salonviraal.js. Deze module
   voegt er twee dingen aan toe die de app nodig heeft en die de poort zelf niet
   kon weten:
   - je ziet je EIGEN post altijd (anders is je eigen profiel leeg tot iemand
     je post viraal maakt, en dat is geen profiel);
   - "volgen" kende alleen partners. Leden volgen nu ook elkaar, en dat telt
     hier mee als reden om iemand te zien.

   Alles loopt over de gewone leden-auth, dus Rahul kan elk van deze handelingen
   zelf uitvoeren via het stuur (kern/stuur.js). De AI plaatst nooit zelf: een
   bijschrift komt terug als tekst, de mens drukt op plaatsen.
   Gemount vanuit routes/member.js. */
const salonviraal = require('../../kern/salonviraal');

const { veiligeFout } = require('../../kern/util');
module.exports = (kern) => {
  const { app, express, auth, geenGast, db, findSupplier, zijnVrienden,
    salon, salonProfiel, salonReacties, salonAI, salonInzicht } = kern;
  // veiligeFout: laat de melding staan, haalt er alleen ons bestandssysteem uit
  const fout = (res, e) => res.status(400).json({ error: veiligeFout(e) });
  const uit = (res, r) => r && r.error ? res.status(400).json(r) : res.json(r);

  /* De kijker: waarom mag ik deze post zien? Partner-volgen (bestond al),
     vriendschap (bestond al) en lid-volgen (nieuw). */
  function poortVoor(sess) {
    const volgtLid = ((db.data.salon || {}).volgtLid || {})[sess.key] || [];
    const kijker = {
      volgt: (p) => {
        if (p.partnerCode) {
          const s = findSupplier(p.partnerCode);
          return !!(s && s.salon && Array.isArray(s.salon.volgers) && s.salon.volgers.includes(sess.key));
        }
        return !!(p.authorKey && volgtLid.includes(p.authorKey));
      },
      bevriend: (p) => !!(p.authorKey && sess.tier !== 'guest' && sess.key && zijnVrienden(sess.key, p.authorKey))
    };
    return (p) => (p.authorKey && p.authorKey === sess.key) || salonviraal.toonInSalon(p, kijker);
  }

  // ---- plaatsen en de feed ----
  app.post('/api/salon/plaats', express.json({ limit: '10mb' }), auth, async (req, res) => {
    if (geenGast(req, res)) return;
    try { uit(res, await salon.plaats(req.session, req.body || {})); } catch (e) { fout(res, e); }
  });

  app.post('/api/salon/weg', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try { uit(res, salon.verwijder(req.session, req.body.id)); } catch (e) { fout(res, e); }
  });

  /* De feed met echte paginering: `na` is de laatste post die je al hebt.
     Filters: onderwerp (hashtag), zoektekst, of alleen je bewaarde posts. */
  app.post('/api/salon/feed', auth, (req, res) => {
    try {
      res.json({ ok: true, ...salon.feed(req.session, req.body || {}, poortVoor(req.session)) });
    } catch (e) { fout(res, e); }
  });

  // waar gaat het over: de onderwerpen die leven, met hun aantallen
  app.post('/api/salon/onderwerpen', auth, (req, res) => {
    try { res.json({ ok: true, onderwerpen: salon.onderwerpen(req.body.limiet) }); } catch (e) { fout(res, e); }
  });

  // ---- profielen ----
  app.post('/api/salon/lid', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    try { uit(res, await salonProfiel.profiel(req.session, req.body.wie, req.body, poortVoor(req.session))); }
    catch (e) { fout(res, e); }
  });

  app.post('/api/salon/bio', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try { uit(res, salonProfiel.bioZet(req.session.key, req.body || {})); } catch (e) { fout(res, e); }
  });

  app.post('/api/salon/volg-lid', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    try { uit(res, await salonProfiel.volg(req.session.key, req.body.wie, !!req.body.aan)); } catch (e) { fout(res, e); }
  });

  app.post('/api/salon/volgend', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try { res.json({ ok: true, volgend: salonProfiel.volgend(req.session.key) }); } catch (e) { fout(res, e); }
  });

  app.post('/api/salon/bewaar', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try { uit(res, salonProfiel.bewaar(req.session.key, req.body.id, !!req.body.aan)); } catch (e) { fout(res, e); }
  });

  // ---- reacties ----
  app.post('/api/salon/reacties', auth, (req, res) => {
    try { uit(res, salonReacties.reacties(req.session, req.body.id)); } catch (e) { fout(res, e); }
  });

  app.post('/api/salon/reageer', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    try { uit(res, await salonReacties.reageer(req.session, req.body.id, req.body.tekst, req.body.op)); }
    catch (e) { fout(res, e); }
  });

  app.post('/api/salon/reactie-weg', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try { uit(res, salonReacties.reactieWeg(req.session, req.body.id, req.body.reactieId)); } catch (e) { fout(res, e); }
  });

  // wie mag er reageren op mijn post: iedereen, vrienden of niemand
  app.post('/api/salon/reacties-van', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try { uit(res, salonReacties.reactiesVan(req.session, req.body.id, req.body.stand)); } catch (e) { fout(res, e); }
  });

  // verbergen is prive (alleen voor jou); melden gaat naar het kantoor
  app.post('/api/salon/verberg', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try { uit(res, salonReacties.verberg(req.session.key, req.body.id, req.body.aan !== false)); } catch (e) { fout(res, e); }
  });

  app.post('/api/salon/meld', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try { uit(res, salonReacties.meld(req.session, req.body.id, req.body.reden)); } catch (e) { fout(res, e); }
  });

  /* ---- inzicht en archief: elders premium, hier in de pas ----
     Je eigen spiegel, zonder namen bij de cijfers en zonder ranglijst. */
  app.post('/api/salon/inzicht', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try { res.json(salonInzicht.overzicht(req.session.key)); } catch (e) { fout(res, e); }
  });

  app.post('/api/salon/archiveer', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try { uit(res, salonInzicht.archiveer(req.session.key, req.body.id, req.body.aan !== false)); } catch (e) { fout(res, e); }
  });

  // ---- de AI: stelt voor, plaatst nooit ----
  app.post('/api/salon/ai/bijschrift', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    try {
      const r = await salonAI.bijschrift(req.body.steekwoorden, req.body.plaats);
      res.status(r.ok ? 200 : (r.status || 400)).json(r);
    } catch (e) { fout(res, e); }
  });

  app.post('/api/salon/ai/reacties', auth, async (req, res) => {
    if (geenGast(req, res)) return;
    try {
      const r = await salonAI.reactiesSamen(req.session, req.body.id);
      res.status(r.ok ? 200 : (r.status || 400)).json(r);
    } catch (e) { fout(res, e); }
  });

  app.post('/api/salon/ai/waarover', auth, async (req, res) => {
    try { res.json(await salonAI.waarOverGaatHet()); } catch (e) { fout(res, e); }
  });
};
