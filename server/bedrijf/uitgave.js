/* RTG Werk OS (deellaag): de UITGAVE -- een betaling die een bedrijf wil doen,
   met wie hem indiende, wie hem goedkeurde en tot welk bedrag die mocht.

   WAAROM DIT ER NU IS. AUTHORITY.md fase 5 liet twee dingen open die allebei
   een ONDERWERP misten: de tekengrens per organisatie, en functiescheiding
   ("wie een betaling maakt, keurt hem niet goed"). Het Werk OS had geen
   betaling, en start.js wees al naar /api/bedrijf/uitgave/maak zonder dat die
   route bestond. Zonder onderwerp zou elke grendel een schijnbewaker zijn.

   VIER REGELS, en elk komt uit de vraag "hoe zou ik hier onderuit komen?":

   1. DE INDIENER KOMT UIT DE SESSIE. `door` is het lid met een eigen sleutel;
      het beheer-token dient niets in, want dan staat er een uitgave zonder
      gezicht -- en dan is "de indiener keurt niet goed" niet te toetsen.
   2. DE INDIENER KEURT NIET GOED. Ook niet met een tweede recht: dat houdt de
      grendel in ./regelpoort.js tegen (keurGrendel hieronder), en een uitgave
      eist altijd minstens een goedkeuring namens `geld.goedkeuren`, ook als
      geen enkele bedrijfsregel iets eist. Anders keurt niemand een uitgave
      onder de drempel, en is hij met alleen de indiener "rond".
   3. HET BEDRAG STAAT VAST. Er is geen route die het wijzigt: een andere
      betaling is een nieuwe uitgave. De goedkeuring gaat over precies dit
      bedrag (`bijWaardeCenten`, dezelfde grendel als bij een contract).
   4. EEN TEKENGRENS VERSMALT ALLEEN (AUTHORITY.md regel 2). Een lid kan een
      grens dragen; wie erboven zit keurt niet goed namens `geld.goedkeuren`.
      Geen grens is geen versmalling, en een grens verleent nooit een recht.

   GELD VERLAAT HET HUIS NIET VANZELF (GELD.md). Deze laag verplaatst niets:
   een goedgekeurde uitgave wordt buiten RTG betaald, en een mens die niet de
   indiener is noteert dat met een kenmerk. De stand wordt BEREKEND uit de
   goedkeuringen en die notitie, en nergens met de hand gezet. */
'use strict';

const EENHEID = require('../kern/geld/eenheid');

module.exports = (sctx) => {
  const { app, save, schoon, nu, rid, werkPoort, beheerVan, log, eigenVeld } = sctx;
  const U = (w) => { if (!w.uitgaven) w.uitgaven = {}; return w.uitgaven; };
  const euro = (c) => (Number(c || 0) / 100).toFixed(2);

  /* De stand, afgeleid. `regelStand` komt uit ./regelpoort.js en weet welke
     goedkeuringen nog ontbreken; hier komt alleen de betaalnotitie bij. */
  function standVan(w, u) {
    const s = sctx.regelStand(w, 'uitgave', u);
    const stand = u.betaald ? 'betaald' : s.mag ? 'goedgekeurd' : 'wacht op goedkeuring';
    return { stand, ontbreekt: s.ontbreekt, eist: s.eist };
  }
  const toon = (w, u) => Object.assign({ id: u.id, omschrijving: u.omschrijving, begunstigde: u.begunstigde,
    factuur: u.factuur, bedrag: euro(u.waardeCenten), afdeling: u.afdeling, land: u.land,
    door: u.door.naam, at: u.at, betaald: u.betaald || null,
    goedkeuringen: (u.goedkeuringen || []).filter(k => !k.vervallen).map(k => ({ naam: k.naam, recht: k.recht, at: k.at })) },
  standVan(w, u));

  app.post('/api/bedrijf/uitgave/maak', (req, res) => {
    const g = werkPoort(req, res, 'geld'); if (!g) return;
    if (g.directie || !g.l.id) return res.status(403).json({
      error: 'Een uitgave dient een lid met een eigen sleutel in, niet het beheer-token. Anders is niet te zien wie hem maakte, en dan kan niemand toetsen dat de indiener hem niet zelf goedkeurt.' });
    const omschrijving = schoon(req.body.omschrijving, 160);
    const begunstigde = schoon(req.body.begunstigde, 80);
    const centen = EENHEID.naarCenten(Number(req.body.bedrag)) || 0;
    if (!omschrijving || !begunstigde) return res.status(400).json({ error: 'Een uitgave heeft een omschrijving en een begunstigde.' });
    if (!(centen > 0)) return res.status(400).json({ error: 'Een uitgave heeft een bedrag boven nul, in euro.' });
    const u = { id: rid(5), omschrijving, begunstigde, factuur: schoon(req.body.factuur, 40) || null,
      waardeCenten: centen, afdeling: schoon(req.body.afdeling, 40) || null,
      land: (schoon(req.body.land, 2) || '').toUpperCase() || null,
      door: { lidId: g.l.id, naam: g.l.naam }, at: nu(), goedkeuringen: [], betaald: null };
    U(g.w)[u.id] = u;
    log(g.w, g.l, 'uitgave-ingediend', u.id, euro(centen));
    save();
    const t = toon(g.w, u);
    res.json({ ok: true, uitgave: t,
      let: 'Ingediend. Nodig: goedkeuring namens ' + t.ontbreekt.join(' en ') + ', door een ander dan u. RTG verplaatst geen geld: na de goedkeuring wordt hij buiten RTG betaald.' });
  });

  app.post('/api/bedrijf/uitgaven', (req, res) => {
    const g = werkPoort(req, res, 'geld'); if (!g) return;
    const rijen = Object.values(U(g.w)).map(u => toon(g.w, u)).sort((a, b) => String(b.at).localeCompare(String(a.at)));
    res.json({ ok: true, aantal: rijen.length, uitgaven: rijen,
      let: 'De stand is berekend uit de goedkeuringen en de betaalnotitie; niemand zet hem met de hand.' });
  });

  /* Betaald NOTEREN. Er gaat geen geld; een mens die de betaling buiten RTG deed
     schrijft op dat het gebeurde, met een kenmerk. Niet de indiener: wie een
     betaling maakt en hem ook als betaald afvinkt, heeft de hele keten alleen
     in handen (scope.js, conflict inkoop-en-betalen). */
  app.post('/api/bedrijf/uitgave/betaald', (req, res) => {
    const g = werkPoort(req, res, 'geld'); if (!g) return;
    if (g.directie || !g.l.id) return res.status(403).json({ error: 'Betaald noteert een lid met een eigen sleutel, niet het beheer-token.' });
    const u = eigenVeld(U(g.w), String(req.body.id || ''));
    if (!u) return res.status(404).json({ error: 'Die uitgave kennen we niet.' });
    if (u.betaald) return res.status(409).json({ error: 'Deze uitgave staat al als betaald, sinds ' + u.betaald.at + '.' });
    if (u.door.lidId === g.l.id) return res.status(409).json({
      error: 'U diende deze uitgave in, dus u noteert hem niet als betaald. Wie een betaling maakt en hem ook afvinkt, heeft de hele keten alleen in handen.' });
    const s = standVan(g.w, u);
    if (s.stand !== 'goedgekeurd') return res.status(409).json({
      error: 'Deze uitgave is nog niet goedgekeurd. Nog nodig: ' + s.ontbreekt.join(' en ') + '.' });
    const kenmerk = schoon(req.body.kenmerk, 60);
    if (!kenmerk) return res.status(400).json({ error: 'Noteer het kenmerk van de betaling (bijvoorbeeld de bankreferentie).' });
    u.betaald = { door: g.l.naam, lidId: g.l.id, kenmerk, at: nu() };
    log(g.w, g.l, 'uitgave-betaald-genoteerd', u.id, kenmerk);
    save();
    res.json({ ok: true, uitgave: toon(g.w, u),
      let: 'Genoteerd als betaald. RTG heeft niets overgemaakt; dit is uw notitie dat het buiten RTG is gebeurd.' });
  });

  /* De tekengrens van een lid zetten of weghalen. Dezelfde deur als de rollen
     (beheerVan): wie rollen toekent, begrenst ze ook. Leeg haalt de grens weg. */
  app.post('/api/bedrijf/lid/tekengrens', (req, res) => {
    const w = beheerVan(req, res); if (!w) return;
    const l = eigenVeld(w.leden, String(req.body.lidId || ''));
    if (!l) return res.status(404).json({ error: 'Dat lid kennen we niet.' });
    const leeg = req.body.bedrag == null || req.body.bedrag === '';
    const centen = leeg ? null : EENHEID.naarCenten(Number(req.body.bedrag));
    if (!leeg && !(centen >= 0)) return res.status(400).json({ error: 'Een tekengrens is een bedrag in euro, of leeg om hem weg te halen.' });
    l.tekengrensCenten = centen;
    log(w, null, 'tekengrens', l.id, leeg ? 'weg' : euro(centen));
    save();
    res.json({ ok: true, lidId: l.id, tekengrens: leeg ? null : euro(centen),
      let: leeg ? 'Geen tekengrens: dit lid keurt goed binnen zijn rechten.'
        : 'Dit lid keurt namens geld.goedkeuren niets goed boven ' + euro(centen) + ' euro. Een grens versmalt alleen; hij geeft geen recht.' });
  });

  /* De grendels die ./regelpoort.js voor elke goedkeuring vraagt. Een object
     terug is een weigering, null is door. */
  function keurGrendel(g, soort, obj, recht) {
    if (soort === 'uitgave' && obj.door && obj.door.lidId === g.l.id) return { status: 409,
      error: 'U diende deze uitgave in, dus u keurt hem niet goed -- ook niet namens een ander recht. Functiescheiding: de indiener en de goedkeurder zijn twee mensen.' };
    const grens = g.l.tekengrensCenten;
    if (recht === 'geld.goedkeuren' && grens != null && Number(obj.waardeCenten || 0) > grens) return { status: 403,
      error: 'Dit bedrag (' + euro(obj.waardeCenten) + ' euro) ligt boven uw tekengrens van ' + euro(grens) + ' euro. Een lid met een hogere grens keurt dit goed.' };
    return null;
  }
  /* Wat een soort altijd eist, los van de bedrijfsregels. */
  const basisEis = (soort) => (soort === 'uitgave' ? ['geld.goedkeuren'] : []);

  sctx.startBron('uitgaven', 'geld', (g) => ({
    wachtOpGoedkeuring: Object.values(U(g.w)).filter(u => standVan(g.w, u).stand === 'wacht op goedkeuring').length }));

  return { UITGAVEN: U, keurGrendel, basisEis };
};
