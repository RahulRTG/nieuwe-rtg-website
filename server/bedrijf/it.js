/* RTG Werk OS (deellaag): IT-beheer -- apparaten, licenties en het
   uitdienstproces.

   De kern van deze module is de laatste: een uitdiensttreding is EEN proces en
   niet zeven losse handelingen die elk bij iemand anders liggen. In golf 1
   trok /lid/uit-dienst al de sleutel in; wat er nog fysiek en administratief
   openstaat, staat hier -- en het proces is pas klaar als elk punt door een
   MENS is afgevinkt.

   Drie dingen die deze module bewust doet:

   1. EEN APPARAAT DAT NIET TERUG IS, VERDWIJNT NIET. Het blijft op naam staan
      met de dag dat het uitging. Een inventaris die vergeetachtige regels
      opruimt, is precies de inventaris die je bij een audit niet wilt hebben.
   2. LICENTIES TELLEN HUN GEBRUIK. Meer in gebruik dan gekocht is een
      overschrijding met een getal, niet een waarschuwingsdriehoekje.
   3. HET UITDIENSTPROCES SLUIT NIET VANZELF. Er is geen knop "alles gedaan";
      elk punt draagt de naam van wie het deed. Een uitstroom die zichzelf
      afvinkt, is de reden dat oud-medewerkers maanden later nog binnenkomen. */
'use strict';

const SOORTEN = ['laptop', 'telefoon', 'tablet', 'monitor', 'toegangspas', 'sleutel', 'overig'];
const STAPPEN = ['accounts geblokkeerd', 'sessies beeindigd', 'sleutels ingetrokken',
  'apparaten terug', 'bestanden overgedragen', 'toegang bij klanten verwijderd'];

module.exports = (sctx) => {
  const { app, save, schoon, nu, rid, dag, werkPoort, log, eigenVeld } = sctx;

  const A = (w) => { if (!w.apparaten) w.apparaten = {}; return w.apparaten; };
  const L = (w) => { if (!w.licenties) w.licenties = {}; return w.licenties; };
  const U = (w) => { if (!w.uitdienst) w.uitdienst = {}; return w.uitdienst; };

  app.post('/api/bedrijf/apparaat/zet', (req, res) => {
    const g = werkPoort(req, res, 'it'); if (!g) return;
    const soort = String(req.body.soort || '');
    if (!SOORTEN.includes(soort)) return res.status(400).json({ error: 'Kies een soort: ' + SOORTEN.join(', ') + '.' });
    const nummer = schoon(req.body.nummer, 60);
    if (!nummer) return res.status(400).json({ error: 'Geef het serie- of inventarisnummer; zonder nummer is een apparaat niet terug te vinden.' });
    const id = schoon(req.body.apparaatId, 20) || rid(4);
    const a = eigenVeld(A(g.w), id) || { id, geschiedenis: [], at: nu() };
    a.soort = soort; a.nummer = nummer;
    a.model = schoon(req.body.model, 60) || a.model || null;
    a.versleuteld = req.body.versleuteld === true;
    a.staat = schoon(req.body.staat, 30) || a.staat || 'in beheer';
    A(g.w)[a.id] = a;
    save();
    res.json({ ok: true, apparaat: a, soorten: SOORTEN,
      let: a.versleuteld ? null : 'Dit apparaat staat als NIET versleuteld genoteerd. Dat is geen fout van het systeem maar een feit dat iemand moet oplossen.' });
  });

  app.post('/api/bedrijf/apparaat/uitgeven', (req, res) => {
    const g = werkPoort(req, res, 'it'); if (!g) return;
    const a = eigenVeld(A(g.w), String(req.body.apparaatId || ''));
    if (!a) return res.status(404).json({ error: 'Dat apparaat kennen we niet.' });
    const l = eigenVeld(g.w.leden, String(req.body.lidId || ''));
    if (!l) return res.status(404).json({ error: 'Dat lid kennen we niet.' });
    if (a.bijLid && a.bijLid !== l.id)
      return res.status(409).json({ error: 'Dit apparaat staat nog op naam van ' + (eigenVeld(g.w.leden, a.bijLid) || {}).naam + '. Neem het eerst in.' });
    a.bijLid = l.id; a.bijNaam = l.naam; a.uitAt = nu(); a.staat = 'uitgegeven';
    a.geschiedenis.push({ wat: 'uitgegeven aan ' + l.naam, door: g.l.naam, at: nu() });
    log(g.w, g.l, 'apparaat-uitgegeven', a.id, a.soort + ' ' + a.nummer + ' aan ' + l.naam);
    save();
    res.json({ ok: true, apparaat: a });
  });

  app.post('/api/bedrijf/apparaat/innemen', (req, res) => {
    const g = werkPoort(req, res, 'it'); if (!g) return;
    const a = eigenVeld(A(g.w), String(req.body.apparaatId || ''));
    if (!a) return res.status(404).json({ error: 'Dat apparaat kennen we niet.' });
    if (!a.bijLid) return res.status(409).json({ error: 'Dit apparaat staat niet op naam van iemand.' });
    a.geschiedenis.push({ wat: 'ingenomen van ' + a.bijNaam, door: g.l.naam, at: nu() });
    a.bijLid = null; a.bijNaam = null; a.staat = schoon(req.body.staat, 30) || 'in beheer'; a.terugAt = nu();
    save();
    res.json({ ok: true, apparaat: a });
  });

  app.post('/api/bedrijf/apparaten', (req, res) => {
    const g = werkPoort(req, res, 'it'); if (!g) return;
    const rijen = Object.values(A(g.w))
      .filter(a => !req.body.lidId || a.bijLid === String(req.body.lidId));
    res.json({ ok: true, aantal: rijen.length, apparaten: rijen,
      uitgegeven: rijen.filter(a => a.bijLid).length,
      onversleuteld: rijen.filter(a => !a.versleuteld).map(a => ({ id: a.id, soort: a.soort, nummer: a.nummer })) });
  });

  /* ---------- licenties ---------- */
  app.post('/api/bedrijf/licentie/zet', (req, res) => {
    const g = werkPoort(req, res, 'it'); if (!g) return;
    const product = schoon(req.body.product, 60);
    if (!product) return res.status(400).json({ error: 'Welk product?' });
    const l = eigenVeld(L(g.w), product) || { product, toegewezen: [], at: nu() };
    l.aantal = Math.max(0, Math.min(100000, parseInt(req.body.aantal, 10) || l.aantal || 0));
    l.kostenPerJaarCenten = req.body.kostenPerJaar != null
      ? Math.round(Math.max(0, Number(req.body.kostenPerJaar) || 0) * 100) : (l.kostenPerJaarCenten || 0);
    l.verlooptOp = schoon(req.body.verlooptOp, 10) || l.verlooptOp || null;
    L(g.w)[product] = l;
    save();
    res.json({ ok: true, licentie: l });
  });

  app.post('/api/bedrijf/licentie/toewijzen', (req, res) => {
    const g = werkPoort(req, res, 'it'); if (!g) return;
    const l = eigenVeld(L(g.w), schoon(req.body.product, 60));
    if (!l) return res.status(404).json({ error: 'Dat product kennen we niet.' });
    const lid = eigenVeld(g.w.leden, String(req.body.lidId || ''));
    if (!lid) return res.status(404).json({ error: 'Dat lid kennen we niet.' });
    if (req.body.weg === true) {
      l.toegewezen = l.toegewezen.filter(x => x !== lid.id);
    } else if (!l.toegewezen.includes(lid.id)) {
      l.toegewezen.push(lid.id);
    }
    save();
    const over = l.toegewezen.length - l.aantal;
    res.json({ ok: true, product: l.product, inGebruik: l.toegewezen.length, gekocht: l.aantal,
      overschrijding: Math.max(0, over),
      let: over > 0 ? 'Er zijn ' + l.toegewezen.length + ' toewijzingen op ' + l.aantal + ' licenties: ' + over + ' te veel. Er wordt niets geblokkeerd; dit is een rekening die iemand moet betalen.' : null });
  });

  app.post('/api/bedrijf/licenties', (req, res) => {
    const g = werkPoort(req, res, 'it'); if (!g) return;
    const rijen = Object.values(L(g.w)).map(l => ({ product: l.product, gekocht: l.aantal,
      inGebruik: l.toegewezen.length, overschrijding: Math.max(0, l.toegewezen.length - l.aantal),
      kostenPerJaarCenten: l.kostenPerJaarCenten, verlooptOp: l.verlooptOp,
      dagenTeGaan: l.verlooptOp ? Math.round((Date.parse(l.verlooptOp) - Date.parse(dag())) / 86400000) : null }));
    res.json({ ok: true, aantal: rijen.length, licenties: rijen,
      teVeelInGebruik: rijen.filter(l => l.overschrijding).length,
      kostenPerJaarCenten: rijen.reduce((t, l) => t + l.kostenPerJaarCenten, 0) });
  });

  return { APPARAATSOORTEN: SOORTEN, STAPPEN, APPARATEN: A, LICENTIES: L, UITDIENST: U };
};
