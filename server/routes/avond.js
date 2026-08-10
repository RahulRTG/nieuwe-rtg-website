/* RTG Evening OS: de routes. Een avond plannen, aannemen en volgen.

   De poort is `auth`: een avond hangt aan een lid, want er hangen reserveringen
   en ritten aan die op naam staan. De laag eronder bezit niets -- elke stap
   wijst naar een boeking in het domein dat hem al had.

   WAT DEZE ROUTES NIET DOEN, en dat is de kern van de zaak: ze boeken niet
   stilletjes. `/voorstel` levert een plan waar alles nog op `voorstel` staat;
   `/aanvragen` doet per stap de ECHTE aanvraag in het eigen domein en schrijft
   terug wat daar gebeurde -- inclusief "de zaak beslist nog". Een avond die
   zichzelf "geregeld" noemt terwijl er niets is bevestigd, is de duurste soort
   leugen: je merkt hem pas als je voor de deur staat. */
'use strict';

module.exports = (kern) => {
  const { app, db, save, crypto, schoon, auth, findSupplier } = kern;

  const voorkeuren = require('../kern/avond/voorkeuren')({ db, save, schoon,
    zorgVoor: (k) => (kern.zorgVoor ? kern.zorgVoor(k) : null) });
  const planlaag = require('../kern/avond/plan')({ db, save, crypto, schoon });
  const steller = require('../kern/avond/samenstellen')({ findSupplier, planlaag, voorkeuren });
  const aanvraaglaag = require('../kern/avond/aanvragen')({ planlaag, schoon });
  /* De mobiliteitskern hoort bij een ANDER domein en wordt later gemount. Dus
     op het moment van aanroepen bevragen, niet hier vastpakken. */
  const mob = () => (kern.reisPlan && kern.reisBoek
    ? { reisPlan: kern.reisPlan, reisBoek: kern.reisBoek, favLijst: kern.favLijst } : null);

  const stuur = (res, r) => (r && r.error)
    ? res.status(r.status || 400).json({ error: r.error, code: r.code || null, teLaatMin: r.teLaatMin })
    : res.json(r);

  /* Alle zaken waar we iets van weten. Bewust via de bestaande gids en niet via
     een eigen lijst: een tweede zakenlijst loopt binnen een week uit de pas. */
  const alleZaken = () => (db.data.suppliers || []).filter(s => s && s.code);

  /* ---------- de Hospitality DNA ---------- */
  app.post('/api/avond/voorkeuren', auth, (req, res) => {
    const zaak = schoon((req.body || {}).zaak, 30) || null;
    if ((req.body || {}).zet) voorkeuren.zet(req.session.key, (req.body || {}).zet);
    res.json({ ok: true, profiel: voorkeuren.overzicht(req.session.key, zaak) });
  });

  app.post('/api/avond/voorkeuren/zaak', auth, (req, res) => {
    const b = req.body || {};
    stuur(res, voorkeuren.zetVoorZaak(req.session.key, b.zaak, b.standen));
  });

  /* Wat een zaak zou zien. Deze route is er voor de GAST en niet voor de zaak:
     een toestemmingsscherm dat niet laat zien wat er werkelijk uitgaat, vraagt
     om vertrouwen zonder het te verdienen. */
  app.post('/api/avond/voorkeuren/proef', auth, (req, res) => {
    const b = req.body || {};
    res.json({ ok: true, zaak: schoon(b.zaak, 30) || null,
      ditZietDeZaak: voorkeuren.voorZaak(req.session.key, schoon(b.zaak, 30), { nu: Array.isArray(b.nu) ? b.nu : [] }) });
  });

  /* ---------- een avond voorstellen ---------- */
  app.post('/api/avond/voorstel', auth, (req, res) => {
    const w = req.body || {};
    if (!schoon(w.start, 5)) return res.status(400).json({ error: 'Hoe laat wil je beginnen?', code: 'start' });
    const uit = steller.stel(req.session.key, w, alleZaken());
    if (!uit.invoer.stappen.length) {
      return res.status(409).json({ error: 'Er is hier niets te plannen dat aan je wensen voldoet.',
        code: 'niets-gevonden', gaten: uit.gaten });
    }
    const gemaakt = planlaag.maak(req.session.key, uit.invoer);
    if (gemaakt.error) return stuur(res, Object.assign(gemaakt, { uitleg: uit.uitleg, gaten: uit.gaten }));
    res.json({ ok: true, avond: gemaakt.avond, uitleg: uit.uitleg, gaten: uit.gaten, aannames: uit.aannames });
  });

  app.post('/api/avond/mijn', auth, (req, res) => {
    res.json({ ok: true, avonden: planlaag.mijne(req.session.key) });
  });

  app.post('/api/avond', auth, (req, res) => {
    const a = planlaag.vanId(req.session.key, (req.body || {}).id);
    if (!a) return res.status(404).json({ error: 'Deze avond kennen we niet.', code: 'onbekend' });
    res.json({ ok: true, avond: planlaag.beeld(a) });
  });

  /* ---------- aanvragen ----------
     Hier gebeurt het echte werk, en hier wordt niets mooier gemaakt dan het is.
     Per stap wordt de aanvraag gedaan in het domein dat hem bezit; wat dat
     domein antwoordt, komt ongewijzigd op de stap te staan. Een tafel gaat naar
     `aangevraagd` en niet naar `bevestigd`: het lid vraagt aan, de zaak beslist
     (die regel stond al in routes/member/handel/uitjes.js en wordt hier niet
     omzeild omdat het toevallig prettiger klinkt). */
  app.post('/api/avond/aanvragen', auth, async (req, res) => {
    const a = planlaag.vanId(req.session.key, (req.body || {}).id);
    if (!a) return res.status(404).json({ error: 'Deze avond kennen we niet.', code: 'onbekend' });

    /* DE GEGEVENSPOORT, EN WAAROM HIJ HIER OOK MOET STAAN. `/api/reserveer`
       heeft hem (`gegevensStop(..., 'reservering')`), maar deze route roept
       `reserveerTafel` RECHTSTREEKS aan en liep er dus omheen: een avond
       aanvragen deed wat een reservering aanvragen niet mag. Zo'n omweg is het
       gevaarlijkste soort gat, want de poort staat er nog en lijkt te werken.
       Alleen vragen als er ook echt een tafel in het plan zit -- een avond van
       alleen vervoer hoeft geen telefoonnummer. */
    if (a.stappen.some(s => s.soort === 'eten' && s.zaak && s.staat === 'voorstel')
      && kern.gegevensStop(req, res, 'reservering')) return;

    const uitkomsten = [];
    for (let i = 0; i < a.stappen.length; i++) {
      const stap = a.stappen[i];
      if (stap.staat !== 'voorstel') { uitkomsten.push({ stap: stap.id, overgeslagen: true, staat: stap.staat }); continue; }

      if (stap.soort === 'eten' && stap.zaak && kern.reserveerTafel) {
        const r = kern.reserveerTafel(req.session, kern.liveCodename ? kern.liveCodename(req.session) : null, {
          supplierCode: stap.zaak, datum: a.datum, tijd: stap.van || a.start, personen: a.personen });
        if (r && r.error) {
          planlaag.koppel(req.session.key, a.id, stap.id, { staat: 'mislukt', reden: r.error });
          uitkomsten.push({ stap: stap.id, ok: false, reden: r.error });
        } else {
          const id = r && r.reservering ? r.reservering.id : null;
          planlaag.koppel(req.session.key, a.id, stap.id,
            { domein: 'reserveringen', id, staat: 'aangevraagd', reden: 'De zaak beslist over deze tafel.' });
          uitkomsten.push({ stap: stap.id, ok: true, staat: 'aangevraagd' });
        }
        continue;
      }

      if (stap.soort === 'vervoer') {
        const uit = await aanvraaglaag.vervoerStap(req.session.key, req.session, a, stap, i, mob());
        planlaag.koppel(req.session.key, a.id, stap.id,
          { domein: uit.domein, id: uit.id, staat: uit.staat, reden: uit.reden, centenPP: uit.centenPP });
        uitkomsten.push({ stap: stap.id, ok: uit.staat === 'bevestigd', staat: uit.staat,
          reden: uit.reden, code: uit.code || null });
        continue;
      }

      /* Alles waar (nog) geen echte aanvraagweg voor is, blijft staan als
         voorstel MET de reden. Stil op 'bevestigd' zetten zou het plan groen
         maken zonder dat er iets is geregeld. */
      planlaag.koppel(req.session.key, a.id, stap.id, { staat: 'voorstel',
        reden: 'Voor een stap van het soort "' + stap.soort + '" loopt de aanvraag nog niet via de avondplanner.' });
      uitkomsten.push({ stap: stap.id, ok: false, staat: 'voorstel', reden: 'nog geen aanvraagweg' });
    }

    save();
    const beeld = planlaag.beeld(planlaag.vanId(req.session.key, a.id));
    res.json({ ok: true, avond: beeld, uitkomsten,
      let: 'Wat hier "aangevraagd" heet, is aangevraagd en niet bevestigd. De zaak beslist.' });
  });

  /* Een stap zelf koppelen aan iets wat je al hebt geboekt (een rit die je in
     RTG OV hebt besteld, een tafel die je zelf regelde). Zo hoeft de planner
     niet elk domein te kennen om toch een kloppend beeld te geven. */
  app.post('/api/avond/koppel', auth, (req, res) => {
    const b = req.body || {};
    stuur(res, planlaag.koppel(req.session.key, b.id, b.stap,
      { domein: b.domein, id: b.boeking, staat: b.staat || 'bevestigd', reden: b.reden }));
  });
};
