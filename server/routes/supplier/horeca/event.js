/* Horeca OS (deellaag): de zakelijke kant van een event -- offerte, akkoord,
   aanbetaling en nacalculatie.

   Het draaiboek, de mise-en-place, de menukeuze met allergenen en de check-in
   bestaan al (routes/supplier/events/). Wat ontbrak is het stuk waar het geld
   zit: wat is er afgesproken, is er getekend, is er aanbetaald, en heeft het
   uiteindelijk iets opgeleverd.

   Drie regels die hier in de code staan:

   1. EEN OFFERTE IS PAS EEN OPDRACHT NA EEN AKKOORD MET NAAM. Er is geen route
      die een offerte stilletjes op "bevestigd" zet; er hoort een naam bij, en
      een datum, en die blijven staan. Een keuken die kookt voor 350 gasten
      omdat iemand "ja" zei aan de telefoon, is precies hoe het misgaat.
   2. EEN GEWIJZIGDE OFFERTE IS EEN NIEUWE VERSIE. Posten aanpassen na akkoord
      kan niet zonder dat de klant opnieuw akkoord geeft; de vorige versie
      blijft bewaard. Anders staat er aan het eind een bedrag op de factuur dat
      niemand heeft gezien.
   3. DE NACALCULATIE REKENT MET WAT ER ECHT IS GEBEURD. Inkoop en gewerkte uren
      tegenover de opbrengst, met de marge erbij -- en als er geen kosten zijn
      ingevoerd, zegt hij dat in plaats van een prachtige marge te tonen. Een
      nacalculatie zonder kosten is geen nacalculatie. */
module.exports = (kern) => {
  const { app, save, schoon, supplierAuth, logActivity, horeca } = kern;
  const { H, nu, id, centen, uitEuro } = horeca;

  const E = (code) => { const h = H(code); if (!h.events) h.events = {}; return h.events; };
  const postSom = (posten) => posten.reduce((t, p) => t + p.centen * p.aantal, 0);
  const publiek = (e) => Object.assign({}, e, {
    totaalCenten: postSom(e.posten || []),
    aanbetaald: (e.aanbetalingen || []).reduce((t, a) => t + a.centen, 0),
    openstaand: postSom(e.posten || []) - (e.aanbetalingen || []).reduce((t, a) => t + a.centen, 0) });

  const leesPosten = (lijst) => (Array.isArray(lijst) ? lijst : []).slice(0, 100).map(p => ({
    id: id(3), omschrijving: schoon(p && p.omschrijving, 100) || 'Post',
    aantal: Math.max(1, Math.min(5000, parseInt(p && p.aantal, 10) || 1)),
    centen: p && p.prijs != null ? uitEuro(p.prijs) : centen(p && p.centen),
    soort: schoon(p && p.soort, 30) || 'algemeen' })).filter(p => p.centen || p.omschrijving);

  /* ---------- de offerte ---------- */
  app.post('/api/supplier/horeca/event/offerte', supplierAuth, (req, res) => {
    const naam = schoon(req.body.naam, 80);
    if (!naam) return res.status(400).json({ error: 'Hoe heet dit event?' });
    const posten = leesPosten(req.body.posten);
    if (!posten.length) return res.status(400).json({ error: 'Zet minstens een post op de offerte.' });
    const e = { id: id(5), naam, datum: schoon(req.body.datum, 10) || null,
      gasten: Math.max(1, Math.min(20000, parseInt(req.body.gasten, 10) || 1)),
      contact: schoon(req.body.contact, 80) || null, ruimte: schoon(req.body.ruimte, 60) || null,
      status: 'offerte', versie: 1, posten, historie: [], aanbetalingen: [], kosten: [],
      geldigTot: schoon(req.body.geldigTot, 10) || null, at: nu(), door: req.actor.name };
    E(req.supplier.code)[e.id] = e;
    save();
    logActivity(req.supplier.code, req.actor, 'maakte een offerte voor ' + naam);
    res.json({ ok: true, event: publiek(e) });
  });

  const eventVan = (req, res) => {
    const e = E(req.supplier.code)[String(req.body.eventId || '')];
    if (!e) { res.status(404).json({ error: 'Dat event kennen we niet.' }); return null; }
    return e;
  };

  // posten aanpassen: voor akkoord vrij, na akkoord alleen als een nieuwe
  // versie die opnieuw getekend moet worden
  app.post('/api/supplier/horeca/event/posten', supplierAuth, (req, res) => {
    const e = eventVan(req, res); if (!e) return;
    if (e.status === 'afgerond') return res.status(409).json({ error: 'Dit event is afgerond.' });
    const posten = leesPosten(req.body.posten);
    if (!posten.length) return res.status(400).json({ error: 'Zet minstens een post op de offerte.' });
    const wasBevestigd = e.status === 'bevestigd';
    e.historie.push({ versie: e.versie, posten: e.posten, totaal: postSom(e.posten), at: nu(), door: req.actor.name });
    e.historie = e.historie.slice(-20);
    e.posten = posten;
    e.versie += 1;
    if (wasBevestigd) { e.status = 'offerte'; e.akkoord = null; }
    save();
    res.json({ ok: true, event: publiek(e), opnieuwAkkoordNodig: wasBevestigd,
      let: wasBevestigd ? 'De posten zijn gewijzigd na akkoord: versie ' + e.versie + ' moet opnieuw worden bevestigd.' : null });
  });

  /* ---------- akkoord ---------- */
  app.post('/api/supplier/horeca/event/akkoord', supplierAuth, (req, res) => {
    const e = eventVan(req, res); if (!e) return;
    if (e.status === 'bevestigd') return res.status(409).json({ error: 'Deze versie is al bevestigd.' });
    const door = schoon(req.body.door, 80);
    if (!door) return res.status(400).json({ error: 'Wie geeft er akkoord? Zonder naam is het geen opdracht.' });
    e.akkoord = { door, op: schoon(req.body.op, 10) || nu().slice(0, 10), versie: e.versie,
      totaalCenten: postSom(e.posten), kanaal: schoon(req.body.kanaal, 30) || 'mail', at: nu(), genoteerdDoor: req.actor.name };
    e.status = 'bevestigd';
    save();
    logActivity(req.supplier.code, req.actor, 'legde akkoord vast voor ' + e.naam + ' (versie ' + e.versie + ')');
    res.json({ ok: true, event: publiek(e) });
  });

  /* ---------- aanbetaling ---------- */
  app.post('/api/supplier/horeca/event/aanbetaling', supplierAuth, (req, res) => {
    const e = eventVan(req, res); if (!e) return;
    if (e.status === 'offerte') return res.status(409).json({ error: 'Er is nog geen akkoord; een aanbetaling op een offerte zonder opdracht hoort niet.' });
    const bedrag = req.body.bedrag != null ? uitEuro(req.body.bedrag) : centen(req.body.centen);
    if (!bedrag) return res.status(400).json({ error: 'Welk bedrag is er aanbetaald?' });
    const totaal = postSom(e.posten);
    const al = (e.aanbetalingen || []).reduce((t, a) => t + a.centen, 0);
    if (al + bedrag > totaal) return res.status(400).json({ error: 'Dat is meer dan het totaal van de opdracht (' + (totaal / 100).toFixed(2) + ').' });
    e.aanbetalingen.push({ id: id(3), centen: bedrag, wijze: schoon(req.body.wijze, 20) || 'overboeking', at: nu(), door: req.actor.name });
    save();
    res.json({ ok: true, event: publiek(e), deel: Math.round((al + bedrag) / totaal * 100) });
  });

  /* ---------- nacalculatie ---------- */
  app.post('/api/supplier/horeca/event/kosten', supplierAuth, (req, res) => {
    const e = eventVan(req, res); if (!e) return;
    const soort = String(req.body.soort || 'inkoop');
    if (!['inkoop', 'uren', 'materiaal', 'derden', 'overig'].includes(soort))
      return res.status(400).json({ error: 'Kies inkoop, uren, materiaal, derden of overig.' });
    const bedrag = req.body.bedrag != null ? uitEuro(req.body.bedrag) : centen(req.body.centen);
    const uren = soort === 'uren' ? Math.max(0, Math.min(10000, Number(req.body.uren) || 0)) : null;
    if (!bedrag) return res.status(400).json({ error: 'Welk bedrag?' });
    e.kosten.push({ id: id(3), soort, omschrijving: schoon(req.body.omschrijving, 100) || soort,
      centen: bedrag, uren, at: nu(), door: req.actor.name });
    save();
    res.json({ ok: true, kosten: e.kosten.length, totaalKosten: e.kosten.reduce((t, k) => t + k.centen, 0) });
  });

  app.post('/api/supplier/horeca/event/nacalculatie', supplierAuth, (req, res) => {
    const e = eventVan(req, res); if (!e) return;
    const opbrengst = postSom(e.posten);
    const kosten = e.kosten.reduce((t, k) => t + k.centen, 0);
    const uren = e.kosten.filter(k => k.uren).reduce((t, k) => t + k.uren, 0);
    if (!e.kosten.length) {
      return res.json({ ok: true, event: e.naam, opbrengstCenten: opbrengst, kostenCenten: 0,
        margeCenten: null, margeProcent: null, compleet: false,
        let: 'Er zijn nog geen kosten ingevoerd. Een nacalculatie zonder kosten is geen nacalculatie; de marge blijft daarom leeg in plaats van 100%.' });
    }
    const perSoort = e.kosten.reduce((o, k) => Object.assign(o, { [k.soort]: (o[k.soort] || 0) + k.centen }), {});
    res.json({ ok: true, event: e.naam, gasten: e.gasten,
      opbrengstCenten: opbrengst, kostenCenten: kosten, perSoort, gewerkteUren: uren,
      margeCenten: opbrengst - kosten, margeProcent: opbrengst ? Math.round((opbrengst - kosten) / opbrengst * 1000) / 10 : null,
      perGast: e.gasten ? Math.round((opbrengst - kosten) / e.gasten) : null, compleet: true });
  });

  app.post('/api/supplier/horeca/event/lijst', supplierAuth, (req, res) => {
    const rijen = Object.values(E(req.supplier.code))
      .filter(e => !req.body.status || e.status === String(req.body.status))
      .sort((a, b) => String(a.datum || '~').localeCompare(String(b.datum || '~')))
      .map(e => ({ id: e.id, naam: e.naam, datum: e.datum, gasten: e.gasten, status: e.status, versie: e.versie,
        totaalCenten: postSom(e.posten), aanbetaald: (e.aanbetalingen || []).reduce((t, a) => t + a.centen, 0) }));
    res.json({ ok: true, aantal: rijen.length, events: rijen.slice(0, 200) });
  });
};
