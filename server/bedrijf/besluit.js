/* RTG Werk OS (deellaag): besluitvorming en governance.

   Een groot bedrijf heeft niet alleen taken maar formele BESLUITEN: wie stelde
   het voor, wie adviseerde, wie stemde, wat waren de bezwaren, en wanneer
   kijken we of het klopte. Vijf regels houden dat eerlijk:

   1. EEN BESLUIT HEEFT EEN EIGENAAR EN EEN ONDERBOUWING. Zonder allebei is het
      een idee.
   2. STEMMEN KAN PAS NA DE ADVIESRONDE. Wie eerst laat stemmen en daarna
      advies vraagt, vraagt geen advies maar instemming.
   3. EEN BEZWAAR VERDWIJNT NOOIT. Ook een aangenomen besluit draagt de
      bezwaren die er waren; dat is precies wat je bij de evaluatie wilt lezen.
   4. NIEMAND STEMT TWEE KEER, en niemand stemt namens een ander -- de stem
      hangt aan het lid-token dat hem uitbracht.
   5. ELK AANGENOMEN BESLUIT KRIJGT EEN EVALUATIEDATUM. Een besluit zonder
      terugkijkmoment is een besluit dat nooit fout kan zijn geweest.

   Wat hier NIET gebeurt: de AI beslist niets. Er is geen route die een besluit
   zonder menselijke stemmen aanneemt -- dezelfde merkregel als overal in dit
   huis. */
'use strict';

const SOORTEN = ['product', 'investering', 'prijs', 'lancering', 'beveiliging', 'personeel', 'contract', 'overig'];

module.exports = (sctx) => {
  const { app, save, schoon, nu, rid, dag, werkPoort, log, eigenVeld } = sctx;
  const B = (w) => { if (!w.besluiten) w.besluiten = {}; return w.besluiten; };

  const telling = (b) => ({
    voor: b.stemmen.filter(s => s.stem === 'voor').length,
    tegen: b.stemmen.filter(s => s.stem === 'tegen').length,
    onthouding: b.stemmen.filter(s => s.stem === 'onthouding').length
  });

  app.post('/api/bedrijf/besluit/maak', (req, res) => {
    const g = werkPoort(req, res, 'besluit'); if (!g) return;
    const titel = schoon(req.body.titel, 120);
    const onderbouwing = schoon(req.body.onderbouwing, 4000);
    if (!titel) return res.status(400).json({ error: 'Wat wordt er voorgesteld?' });
    if (!onderbouwing) return res.status(400).json({ error: 'Zonder onderbouwing is dit een idee en geen besluitvoorstel.' });
    const soort = String(req.body.soort || 'overig');
    if (!SOORTEN.includes(soort)) return res.status(400).json({ error: 'Kies een soort: ' + SOORTEN.join(', ') + '.' });
    const b = { id: rid(5), titel, onderbouwing, soort, status: 'advies',
      eigenaar: schoon(req.body.eigenaar, 60) || g.l.naam,
      alternatieven: Array.isArray(req.body.alternatieven)
        ? req.body.alternatieven.slice(0, 10).map(a => schoon(a, 300)).filter(Boolean) : [],
      adviezen: [], bezwaren: [], stemmen: [], evalueerOp: null,
      at: nu(), door: g.l.naam };
    B(g.w)[b.id] = b;
    log(g.w, g.l, 'besluit-voorgesteld', b.id, titel);
    save();
    res.json({ ok: true, besluit: b, soorten: SOORTEN,
      let: 'Het voorstel staat op ADVIES. Stemmen kan pas als de adviesronde is gesloten: wie eerst laat stemmen en daarna advies vraagt, vraagt geen advies maar instemming.' });
  });

  app.post('/api/bedrijf/besluit/advies', (req, res) => {
    const g = werkPoort(req, res, 'besluit'); if (!g) return;
    const b = eigenVeld(B(g.w), String(req.body.besluitId || ''));
    if (!b) return res.status(404).json({ error: 'Dat voorstel kennen we niet.' });
    if (b.status !== 'advies') return res.status(409).json({ error: 'De adviesronde van dit voorstel is gesloten.' });
    const tekst = schoon(req.body.tekst, 2000);
    if (!tekst) return res.status(400).json({ error: 'Wat is uw advies?' });
    const bezwaar = req.body.bezwaar === true;
    const rij = { id: rid(3), tekst, door: g.l.naam, bezwaar, at: nu() };
    if (bezwaar) b.bezwaren.push(rij); else b.adviezen.push(rij);
    save();
    res.json({ ok: true, adviezen: b.adviezen.length, bezwaren: b.bezwaren.length });
  });

  app.post('/api/bedrijf/besluit/stemronde', (req, res) => {
    const g = werkPoort(req, res, 'besluit'); if (!g) return;
    const b = eigenVeld(B(g.w), String(req.body.besluitId || ''));
    if (!b) return res.status(404).json({ error: 'Dat voorstel kennen we niet.' });
    if (b.status !== 'advies') return res.status(409).json({ error: 'Dit voorstel staat al op ' + b.status + '.' });
    b.status = 'stemmen'; b.adviesGeslotenAt = nu();
    save();
    res.json({ ok: true, besluit: { id: b.id, status: b.status },
      bezwaren: b.bezwaren.map(x => ({ door: x.door, tekst: x.tekst })),
      let: b.bezwaren.length ? 'Er liggen ' + b.bezwaren.length + ' bezwaar/bezwaren. Die blijven staan, ook als het voorstel wordt aangenomen.' : null });
  });

  app.post('/api/bedrijf/besluit/stem', (req, res) => {
    const g = werkPoort(req, res, 'besluit'); if (!g) return;
    const b = eigenVeld(B(g.w), String(req.body.besluitId || ''));
    if (!b) return res.status(404).json({ error: 'Dat voorstel kennen we niet.' });
    if (b.status !== 'stemmen') return res.status(409).json({
      error: b.status === 'advies' ? 'De adviesronde loopt nog; stemmen kan pas als die gesloten is.' : 'Er valt niets meer te stemmen: dit besluit is ' + b.status + '.' });
    const stem = String(req.body.stem || '');
    if (!['voor', 'tegen', 'onthouding'].includes(stem)) return res.status(400).json({ error: 'Stem voor, tegen of onthouding.' });
    /* De stem hangt aan het lid dat hem uitbrengt. De beheerder kan dus NIET
       namens iemand stemmen; dat is geen tekortkoming maar het punt. */
    if (g.directie) return res.status(403).json({ error: 'Stemmen doet een lid met een eigen sleutel, niet het beheer-token. Anders staat er straks een stem zonder gezicht.' });
    if (b.stemmen.some(s => s.lidId === g.l.id)) return res.status(409).json({ error: 'U heeft al gestemd.' });
    b.stemmen.push({ lidId: g.l.id, naam: g.l.naam, stem,
      toelichting: schoon(req.body.toelichting, 500) || null, at: nu() });
    save();
    res.json({ ok: true, telling: telling(b) });
  });

  app.post('/api/bedrijf/besluit/sluit', (req, res) => {
    const g = werkPoort(req, res, 'besluit'); if (!g) return;
    const b = eigenVeld(B(g.w), String(req.body.besluitId || ''));
    if (!b) return res.status(404).json({ error: 'Dat voorstel kennen we niet.' });
    if (b.status !== 'stemmen') return res.status(409).json({ error: 'Dit voorstel staat op ' + b.status + '.' });
    const t = telling(b);
    if (!b.stemmen.length) return res.status(409).json({ error: 'Er is niet gestemd. Een besluit zonder stemmen is geen besluit; de automaat neemt het hier niet over.' });
    /* De bedrijfsregels (bedrijf/regelpoort.js) kunnen eisen dat er eerst namens
       bepaalde rechten is goedgekeurd -- "een investeringsbesluit gaat niet
       dicht zonder de CFO". Er wordt hier geen eigen wachtstand ingevoerd: het
       besluit blijft gewoon in stemming staan, met de reden erbij. Late binding
       via sctx, want regelpoort.js wordt voor dit bestand gemount. */
    const regel = sctx.regelMagSluiten(g.w, b);
    if (regel.ontbreekt.length) return res.status(409).json({
      error: 'Een bedrijfsregel eist eerst goedkeuring namens ' + regel.ontbreekt.join(' en ') + '.',
      ontbreekt: regel.ontbreekt,
      let: 'Het besluit blijft in stemming staan. Goedkeuren gaat via /api/bedrijf/keur; een mens keurt daar één keer goed, dus twee rechten zijn ook echt twee mensen.' });

    const evalueerOp = schoon(req.body.evalueerOp, 10);
    const aangenomen = t.voor > t.tegen;
    if (aangenomen && !evalueerOp)
      return res.status(400).json({ error: 'Wanneer kijken we of dit besluit klopte? Een besluit zonder terugkijkmoment is een besluit dat nooit fout kan zijn geweest.' });
    if (evalueerOp && evalueerOp <= dag())
      return res.status(400).json({ error: 'Kies een evaluatiedatum in de toekomst.' });
    b.status = aangenomen ? 'aangenomen' : 'verworpen';
    b.telling = t; b.evalueerOp = aangenomen ? evalueerOp : null;
    b.geslotenAt = nu(); b.geslotenDoor = g.l.naam;
    log(g.w, g.l, 'besluit-' + b.status, b.id, b.titel + ' (' + t.voor + ' voor, ' + t.tegen + ' tegen)');
    save();
    res.json({ ok: true, besluit: b,
      let: b.bezwaren.length ? 'De ' + b.bezwaren.length + ' bezwaar/bezwaren blijven bij dit besluit staan; bij de evaluatie is dat het eerste wat je wilt lezen.' : null });
  });

  app.post('/api/bedrijf/besluiten', (req, res) => {
    const g = werkPoort(req, res, 'besluit'); if (!g) return;
    const rijen = Object.values(B(g.w))
      .filter(b => !req.body.status || b.status === String(req.body.status))
      .map(b => ({ id: b.id, titel: b.titel, soort: b.soort, status: b.status, eigenaar: b.eigenaar,
        telling: telling(b), bezwaren: b.bezwaren.length, evalueerOp: b.evalueerOp,
        evaluatieTeGaan: b.evalueerOp ? Math.round((Date.parse(b.evalueerOp) - Date.parse(dag())) / 86400000) : null }));
    res.json({ ok: true, aantal: rijen.length, besluiten: rijen,
      teEvalueren: rijen.filter(b => b.evaluatieTeGaan != null && b.evaluatieTeGaan <= 0) });
  });

  sctx.startBron('goedkeuringen', 'besluit', (g) => {
    const alle = Object.values(B(g.w));
    /* `zonderUitkomst` is de scherpe van de drie: een evaluatiedatum die is
       verstreken terwijl er niets is opgeschreven, is precies het geval waarin
       een besluit "geëvalueerd" heet zonder dat iemand heeft teruggekeken. Hij
       staat apart van `teEvalueren` (die telt ook wat vandaag aan de beurt is)
       zodat het verschil tussen "nog doen" en "blijven liggen" zichtbaar is. */
    return { inAdvies: alle.filter(b => b.status === 'advies').length,
      teStemmen: alle.filter(b => b.status === 'stemmen' && !b.stemmen.some(s => s.lidId === g.l.id)).length,
      teEvalueren: alle.filter(b => b.evalueerOp && b.evalueerOp <= dag()).length,
      zonderUitkomst: alle.filter(b => b.status === 'aangenomen' && b.evalueerOp && b.evalueerOp <= dag()
        && !(b.evaluaties || []).length).length };
  });

  return { BESLUITSOORTEN: SOORTEN, BESLUITEN: B };
};
