/* De Zaakdoos-vloot: de sleutelwacht en de /api/doos/-eindpunten (kloon,
   status, meting, buurmelding, rapport) plus de satelliet-ping. De proxy- en
   journaal-lagen die elke aanvraag omhullen blijven in server.js.

   NIET ELKE ROUTE ZIT ACHTER DE SLEUTEL. Per route, met reden:
     meting, buurmelding, update  achter de doossleutel (./doos-wacht.js):
                                  in productie alleen een eigen sleutel per
                                  doos en zaak (B12), met de scope per familie
     kloon                        idem, en alleen de eigen zaak (./doos-kloon.js)
     status                       bewust open: elke app pollt hem om te weten of
                                  er een doos is en of die lokaal draait; zonder
                                  doos antwoordt hij {doos:false}
     rapport                      open OP EEN DOOS (het statuspaneel in de zaak),
                                  achter de sleutel op een server die geen doos
                                  is -- daar is het alleen verkenningswerk:
                                  pings, uitvalminuten, cachegrootte */
module.exports = (kern) => {
  const { app, db, save, crypto, beveilig, zaakdoos } = kern;

  // de rondreistijd peilen voor de satellietmodus; zonder inloggen.
  app.get('/api/sat/ping', (req, res) => res.json({ ok: 1, t: Date.now() }));

  /* De sleutelwacht van de doos-vloot, met de eigen sleutel per doos (fase 7),
     staat in ./doos-wacht.js. */
  const doosSleutelOk = require('./doos-wacht')({ crypto, beveilig, register: () => kern.doosSleutels, noteerAfketser: () => {
    if (!Array.isArray(db.data.doosAfketsers)) db.data.doosAfketsers = [];
    db.data.doosAfketsers.unshift({ at: Date.now() });
    db.data.doosAfketsers = db.data.doosAfketsers.slice(0, 500);
    save();
  } });

  /* De kloon per zaak en het update-kanaal staan in ./doos-kloon.js. */
  require('./doos-kloon')(kern, doosSleutelOk);
  app.get('/api/doos/status', (req, res) => res.json(zaakdoos.status()));
  /* Het meetstation van de doos-vloot: dozen die met instemming van de partner
     meedoen (RTG_DOOS_NETWERK=1) melden hier hun lijnmeting. Compact en anoniem
     van aard: naam, rondreistijd, modus en journaalstand; geen zaakdata. */
  app.post('/api/doos/meting', (req, res) => {
    // een melding VIA een buurdoos vraagt de scope buurmelding van de melder
    if (!doosSleutelOk(req, res, req.body && req.body.via ? 'buurmelding' : 'meting')) return;
    /* Een bewezen doos schrijft op de bus als zichzelf; een doos met de gedeelde
       sleutel blijft zonder actor, want zijn naam is een zelfopgave. */
    if (req.doosBewezen) return require('../kern/dienstidentiteit').alsDoos(req.doosBewezen, () => meting(req, res));
    meting(req, res);
  });
  function meting(req, res) {
    if (!Array.isArray(db.data.doosMetingen)) db.data.doosMetingen = [];
    const b = req.body || {};
    const meting = {
      doos: req.doosBewezen || String(b.doos || 'doos').replace(/[<>]/g, '').slice(0, 40),
      bewezen: !!req.doosBewezen, zaak: req.doosZaak || null,
      rtt: Math.max(0, Math.min(60000, Math.round(Number(b.rtt) || 0))),
      modus: b.modus === 'lokaal' ? 'lokaal' : 'cloud',
      journaal: Math.max(0, Math.round(Number(b.journaal) || 0)), at: Date.now()
    };
    // een buurdoos die de melding doorgaf, laat zijn via-stempel achter
    if (b.via) meting.via = String(b.via).replace(/[<>]/g, '').slice(0, 40);
    // de plek van de doos (met instemming meegegeven) voor de wereldkaart
    if (b.plek && Number.isFinite(Number(b.plek.lat)) && Number.isFinite(Number(b.plek.lon))) {
      meting.plek = { lat: Math.max(-90, Math.min(90, Number(b.plek.lat))), lon: Math.max(-180, Math.min(180, Number(b.plek.lon))) };
    }
    // het beheer op afstand: de doos meldt zijn softwareversie, netwerkrol
    // en stroombron mee, zodat het wereldbord en de Ingenieurs ze zien
    if (b.versie) meting.versie = String(b.versie).replace(/[^\w.\-]/g, '').slice(0, 20);
    if (b.wifi) meting.wifi = ['accesspoint', 'versterker', 'uit'].includes(b.wifi) ? b.wifi : 'uit';
    if (b.stroom && (b.stroom.bron === 'net' || b.stroom.bron === 'batterij')) {
      meting.stroom = { bron: b.stroom.bron, pct: b.stroom.pct == null ? null : Math.max(0, Math.min(100, Math.round(Number(b.stroom.pct) || 0))) };
    }
    db.data.doosMetingen.unshift(meting);
    db.data.doosMetingen = db.data.doosMetingen.slice(0, 2000);
    save();
    // staat er vanaf het wereldbord een opdracht klaar (reset/hulp/update),
    // geef hem mee; anders krijgt een doos op een oude versie vanzelf de
    // update-opdracht (hooguit een keer per kwartier, tegen het spammen)
    let opdracht = kern.afdelingen ? kern.afdelingen.opdrachtVoorDoos(meting.doos) : null;
    const doel = db.data.doosUpdate;
    if (!opdracht && doel && doel.versie && meting.versie && meting.versie !== doel.versie) {
      if (!db.data.doosUpdatePogingen) db.data.doosUpdatePogingen = {};
      const vorige = db.data.doosUpdatePogingen[meting.doos] || 0;
      if (Date.now() - vorige > 15 * 60 * 1000) {
        db.data.doosUpdatePogingen[meting.doos] = Date.now();
        save();
        opdracht = 'update';
      }
    }
    // de gewenste netwerkrol reist met de eigen melding mee terug (de doos
    // past hem alleen toe als de stand nieuwer is dan wat hij al draait)
    const netwerk = (db.data.doosNetwerk || {})[meting.doos] || null;
    const uit = { ok: true };
    if (req.doosSleutelTot) uit.sleutelTot = req.doosSleutelTot; // de doos ziet wanneer hij moet roteren
    if (opdracht) uit.opdracht = opdracht;
    if (netwerk) uit.netwerk = netwerk;
    res.json(uit);
  }
  /* De buurtfailover: een buurdoos zonder eigen lijn geeft zijn melding hier
     (op een doos die de lijn nog wel heeft) af; deze doos stuurt hem door naar
     de cloud met een via-stempel. Alleen op een doos, alleen met de sleutel. */
  let buurFout = []; const BUUR_MAX = 4;
  app.post('/api/doos/buurmelding', async (req, res) => {
    if (!zaakdoos.actief) return res.status(404).json({ error: 'Dit is geen doos.' });
    /* Een eigen sleutel van de buur kan deze doos niet nakijken (het register
       staat in de cloud, niet in de kloon): hij reist ongewijzigd mee en de
       cloud keurt hem op de scope buurmelding. Weigert die, dan weigert dit ook. */
    const eigen = req.get('x-doos-eigen-sleutel') ? { 'x-doos-id': req.get('x-doos-id') || '',
      'x-doos-eigen-sleutel': req.get('x-doos-eigen-sleutel') } : null;
    if (!eigen && !doosSleutelOk(req, res, 'buurmelding')) return;
    /* Hooguit BUUR_MAX geweigerde doorgiften per kwartier: onder de IP-rem van de
       cloud (acht), zodat een vreemde op het wifi deze doos daar niet buitensluit. */
    const nuT = Date.now(); buurFout = buurFout.filter(t => nuT - t < 15 * 60000);
    if (eigen && buurFout.length >= BUUR_MAX) return res.status(429).json({ error: 'Te veel geweigerde buurmeldingen; probeer het over een kwartier opnieuw.' });
    const doorgegeven = await zaakdoos.buurDoorgeven(req.body || {}, eigen);
    if (eigen && doorgegeven === 403) { buurFout.push(nuT); return res.status(403).json({ error: 'Geen toegang.' }); }
    res.json({ ok: true, doorgegeven: doorgegeven === true });
  });
  /* Het nachtwerk van de doos-vloot: elke doos die meedoet, stuurt om vier uur
     in de nacht een dagrapport over de lijn: pings, gemiddelde rondreistijd,
     uitval en naspeelwerk. Compact en zonder zaakdata, achter de sleutel. */
  app.post('/api/doos/rapport', (req, res) => {
    if (!doosSleutelOk(req, res, 'rapport')) return;
    if (!Array.isArray(db.data.doosRapporten)) db.data.doosRapporten = [];
    const b = req.body || {};
    // met een eigen sleutel rapporteert een doos alleen over zichzelf en zijn zaak
    if (req.doosZaak && b.zaak != null && String(b.zaak).toUpperCase() !== req.doosZaak)
      return res.status(403).json({ error: 'Deze sleutel rapporteert alleen voor zijn eigen zaak.' });
    db.data.doosRapporten.unshift({
      doos: req.doosBewezen || String(b.doos || 'doos').replace(/[<>]/g, '').slice(0, 40), zaak: req.doosZaak || null,
      datum: /^\d{4}-\d{2}-\d{2}$/.test(String(b.datum)) ? String(b.datum) : new Date().toISOString().slice(0, 10),
      pings: Math.max(0, Math.round(Number(b.pings) || 0)),
      rttGem: Math.max(0, Math.min(60000, Math.round(Number(b.rttGem) || 0))),
      uitval: Math.max(0, Math.round(Number(b.uitval) || 0)),
      lokaalMin: Math.max(0, Math.round(Number(b.lokaalMin) || 0)),
      nagespeeld: Math.max(0, Math.round(Number(b.nagespeeld) || 0)),
      kloonLeeftijdMin: b.kloonLeeftijdMin == null ? null : Math.max(0, Math.round(Number(b.kloonLeeftijdMin) || 0)),
      kasStuks: Math.max(0, Math.round(Number(b.kasStuks) || 0)),
      journaalNu: Math.max(0, Math.round(Number(b.journaalNu) || 0)), at: Date.now()
    });
    db.data.doosRapporten = db.data.doosRapporten.slice(0, 1000);
    save();
    res.json({ ok: true });
  });
  /* Het dagrapport van deze doos zelf (lokaal, voor het zaak-scherm en de tests).
     Op een server die GEEN doos is valt er niets nuttigs te tonen en is dit
     alleen verkenningswerk; daar geldt dus de sleutel. Zie de kop. */
  app.get('/api/doos/rapport', (req, res) => {
    if (!zaakdoos.status().doos && !doosSleutelOk(req, res, 'rapport')) return;
    res.json(zaakdoos.dagrapport());
  });
};
