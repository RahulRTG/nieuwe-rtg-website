/* RTG Werk OS (deellaag): de TEKENGRENS en de BETAALWIJZE van een uitgave.

   Twee besluiten van de eigenaar (23 september 2026), en dit bestand is de plek
   waar ze iets tegenhouden:

   1. DE STRENGSTE VAN TWEE GRENZEN. Een lid van de werkruimte kan een tekengrens
      dragen (hier gezet, zoals zijn rollen). Is de werkruimte gekoppeld aan een
      entiteit in de concerngraaf, en is dit lid daar bestuurder of gevolmachtigde
      op zijn RTG-codenaam, dan geldt ook de tekenlimiet uit die graaf -- en de
      laagste van de twee wint. Beide versmallen alleen; geen van beide verleent
      een recht. Een bestuurder met een vrije naam of als extern vastgelegd telt
      niet mee: vergelijken op een naam die niemand heeft gecontroleerd is raden.
   2. DE BETAALWIJZE kiest de werkruimte zelf: `extern` (standaard) of `rekening`.
      De tweede kan alleen als RTG die weg heeft aangezet (kern/werkbetaling.js).
      Zet RTG hem later uit, dan valt de werkruimte terug op extern, met de reden.

   De koppeling aan een entiteit legt alleen een lid dat zelf eigenaar van die
   entiteit is (zijn RTG-sleutel), nooit het beheer-token: anders kan iemand zijn
   werkruimte aan andermans bedrijf hangen en diens tekenlimieten lenen. */
'use strict';

const EENHEID = require('../kern/geld/eenheid');

module.exports = (sctx) => {
  const { app, save, schoon, werkPoort, log, eigenVeld, kern } = sctx;
  const euro = (c) => (Number(c || 0) / 100).toFixed(2);

  /* Wie de werkruimte beheert, zet de grens -- maar nooit zijn EIGEN grens: een
     versmalling die de versmalde zelf kan weghalen, versmalt niets. */
  app.post('/api/bedrijf/lid/tekengrens', (req, res) => {
    const g = werkPoort(req, res, 'werkruimte'); if (!g) return;
    const w = g.w;
    const l = eigenVeld(w.leden, String(req.body.lidId || ''));
    if (!l) return res.status(404).json({ error: 'Dat lid kennen we niet.' });
    if (!g.directie && l.id === g.l.id) return res.status(409).json({
      error: 'Uw eigen tekengrens zet een ander. Een grens die u zelf kunt weghalen, begrenst niets.' });
    const leeg = req.body.bedrag == null || req.body.bedrag === '';
    const centen = leeg ? null : EENHEID.naarCenten(Number(req.body.bedrag));
    if (!leeg && !(centen >= 0)) return res.status(400).json({ error: 'Een tekengrens is een bedrag in euro, of leeg om hem weg te halen.' });
    l.tekengrensCenten = centen;
    log(w, g.directie ? null : g.l, 'tekengrens', l.id, leeg ? 'weg' : euro(centen));
    save();
    res.json({ ok: true, lidId: l.id, tekengrens: leeg ? null : euro(centen),
      let: leeg ? 'Geen tekengrens in de werkruimte. Is de werkruimte aan een entiteit gekoppeld, dan kan de concerngraaf nog een grens geven.'
        : 'Dit lid keurt namens geld.goedkeuren niets goed boven ' + euro(centen) + ' euro. Een grens versmalt alleen; hij geeft geen recht.' });
  });

  app.post('/api/bedrijf/werkruimte/entiteit', (req, res) => {
    const g = werkPoort(req, res, 'werkruimte'); if (!g) return;
    /* Het beheer-token is geen gezicht (403); een lid zonder RTG-account heeft een
       goede sleutel maar geen entiteit om te bezitten (409, en dus niet uitgelogd). */
    if (g.directie || !g.l.rtgKey) return res.status(g.directie ? 403 : 409).json({
      error: 'Een werkruimte koppelt u aan een entiteit met een lid dat aan zijn eigen RTG-account hangt, niet met het beheer-token.' });
    const id = schoon(req.body.entiteitId, 40);
    /* Loskoppelen doet ook alleen de eigenaar van wat er NU hangt: anders is
       loskoppelen de weg om de tekenlimieten en het bestuur te ontlopen. */
    const huidig = g.w.entiteitId ? kern.entiteitVind(g.w.entiteitId) : null;
    if (huidig && huidig.eigenaar !== g.l.rtgKey) return res.status(404).json({ error: 'De gekoppelde entiteit staat niet op uw naam.' });
    if (!id) {
      g.w.entiteitId = null; log(g.w, g.l, 'entiteit-los', null); save();
      return res.json({ ok: true, entiteitId: null, let: 'Losgekoppeld: alleen de tekengrens van de werkruimte telt nog.' });
    }
    const e = kern.entiteitVind(id);
    if (!e || e.eigenaar !== g.l.rtgKey) return res.status(404).json({ error: 'Deze entiteit staat niet op uw naam.' });
    g.w.entiteitId = e.id;
    log(g.w, g.l, 'entiteit-gekoppeld', e.id);
    save();
    res.json({ ok: true, entiteitId: e.id,
      let: 'Gekoppeld. Wie in deze werkruimte ook bestuurder of gevolmachtigde van de entiteit is op zijn codenaam, keurt voortaan binnen de laagste van twee grenzen.' });
  });

  app.post('/api/bedrijf/werkruimte/betaalwijze', (req, res) => {
    const g = werkPoort(req, res, 'werkruimte'); if (!g) return;
    const wijze = String(req.body.wijze || '');
    if (!['extern', 'rekening'].includes(wijze)) return res.status(400).json({ error: 'Kies extern of rekening.' });
    const rtg = kern.werkBankpadStand();
    if (wijze === 'rekening' && !rtg.aan) return res.status(409).json({
      error: 'RTG heeft betalen via RTG Rekening voor werkruimtes (nog) niet aangezet.', uitleg: rtg.uitleg });
    g.w.betaalwijze = wijze;
    log(g.w, g.l, 'betaalwijze', null, wijze);
    save();
    res.json(Object.assign({ ok: true }, betaalwijze(g.w)));
  });

  /* Welke weg geldt NU: de keuze van de werkruimte, tenzij RTG de weg dicht heeft. */
  function betaalwijze(w) {
    if (w.betaalwijze !== 'rekening') return { wijze: 'extern', gekozen: w.betaalwijze || 'extern', reden: null };
    const rtg = kern.werkBankpadStand();
    return rtg.aan ? { wijze: 'rekening', gekozen: 'rekening', reden: null }
      : { wijze: 'extern', gekozen: 'rekening', reden: 'RTG heeft betalen via RTG Rekening uitgezet; tot het weer aan staat, wordt buiten RTG betaald.' };
  }

  /* De grendel op het bedrag. Null is door; een object is de weigering. */
  function tekengrensWeigering(g, obj, recht) {
    if (recht !== 'geld.goedkeuren') return null;
    const bedrag = Number(obj.waardeCenten || 0);
    const eigen = g.l.tekengrensCenten;
    if (eigen != null && bedrag > eigen) return { status: 403,
      error: 'Dit bedrag (' + euro(bedrag) + ' euro) ligt boven uw tekengrens van ' + euro(eigen) + ' euro in deze werkruimte. Een lid met een hogere grens keurt dit goed.' };
    if (!g.w.entiteitId || !g.l.rtgCodenaam) return null;
    const m = kern.concernMagTekenen(g.w.entiteitId, bedrag / 100);
    const ik = (m.teLaag || []).find(x => x.herkend && x.wie === g.l.rtgCodenaam);
    if (ik) return { status: 403,
      error: 'Dit bedrag (' + euro(bedrag) + ' euro) ligt boven uw tekenlimiet van ' + Number(ik.limiet).toFixed(2) +
        ' euro als bestuurder of gevolmachtigde van de gekoppelde entiteit. De strengste van de twee grenzen geldt.' };
    return null;
  }

  return { tekengrensWeigering, betaalwijze };
};
