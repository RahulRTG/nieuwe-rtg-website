/* School, deelbestand "zorg": het zorgdeel van een leerlingdossier bijwerken.

   Het LEZEN van een dossier staat in ./dossier.js. Dit bestand gaat over het
   zorgdeel, en dat is met opzet apart: het is het gevoeligste deel van wat een
   school over een kind bewaart -- ondersteuningsbehoefte, plan, individuele
   leerdoelen en de remedial-teaching-sessies.

   TWEE DINGEN DIE HIER VASTLIGGEN:

   1. HET STAAT ACHTER EEN EIGEN POORT ('zorg'), niet achter "mag het dossier
      lezen". Een mentor die de adresgegevens nodig heeft, hoort daarmee niet in
      het zorgplan te kunnen. Dat is dezelfde scheiding als bij de zwaarste
      inzage in het Werk OS (bedrijf/rollen-register.js).
   2. EEN LEERDOEL ZONDER WIE ERAAN WERKT IS EEN VOORNEMEN. Vandaar dat doelen
      en sessies bij elkaar staan: het plan en de uitvoering horen in een blik
      te zien te zijn, anders staat er een mooi plan waar niemand aan begint.

   Krijgt dezelfde sctx als ./dossier.js, plus zorgVan() -- er is EEN plek waar
   de vorm van een zorgdeel wordt gemaakt. */
'use strict';

module.exports = (sctx, { vind, zorgVan }) => {
  const { router, save, rid, nu, schoon, eigenVeld, poort, log } = sctx;

  /* ---------- het zorgdeel bijwerken ----------
     Ondersteuningsbehoefte, plan, individuele leerdoelen en de remedial-
     teaching-sessies staan hier bij elkaar: een leerdoel zonder wie eraan
     werkt is een voornemen. */
  router.post('/school/zorg/zet', (req, res) => {
    const g = poort(req, res, 'zorg'); if (!g) return;
    const l = vind(g.sch, req.body.leerlingId);
    if (!l) return res.status(404).json({ error: 'Deze leerling staat niet in de administratie.' });
    const z = zorgVan(l);
    if (req.body.behoefte !== undefined) z.behoefte = schoon(req.body.behoefte, 200) || null;
    if (req.body.plan !== undefined) z.plan = schoon(req.body.plan, 600) || null;
    if (req.body.doel) {
      z.doelen.unshift({ id: rid(3), tekst: schoon(req.body.doel, 200), vak: schoon(req.body.vak, 40) || null,
        tot: schoon(req.body.tot, 10) || null, at: nu(), door: g.p.naam, behaald: false });
      z.doelen = z.doelen.slice(0, 50);
    }
    if (req.body.doelBehaald) {
      const d = (z.doelen || []).find(x => x.id === String(req.body.doelBehaald));
      if (!d) return res.status(404).json({ error: 'Dat leerdoel staat niet in dit plan.' });
      d.behaald = true; d.behaaldAt = nu();
    }
    if (req.body.notitie) {
      z.notities.unshift({ id: rid(3), tekst: schoon(req.body.notitie, 600), at: nu(), door: g.p.naam });
      z.notities = z.notities.slice(0, 100);
    }
    log(g.sch, g.p, 'zorgdossier-gewijzigd', l.id, schoon(req.body.reden, 120) || 'bijwerken ondersteuningsplan');
    save();
    res.json({ ok: true, zorg: z });
  });

  /* Een remedial-teaching- of ondersteuningssessie noteren. Kort en feitelijk:
     wat is er gedaan, hoe lang, en of het hielp -- geen beoordeling van het kind. */
  router.post('/school/zorg/sessie', (req, res) => {
    const g = poort(req, res, 'zorg'); if (!g) return;
    const l = vind(g.sch, req.body.leerlingId);
    if (!l) return res.status(404).json({ error: 'Deze leerling staat niet in de administratie.' });
    const wat = schoon(req.body.wat, 200);
    if (!wat) return res.status(400).json({ error: 'Noteer wat er in de sessie is gedaan.' });
    const z = zorgVan(l);
    z.sessies.unshift({ id: rid(3), wat, vak: schoon(req.body.vak, 40) || null,
      minuten: Math.min(240, Math.max(5, Number(req.body.minuten) || 30)),
      begeleider: g.p.naam, at: nu(), vervolg: schoon(req.body.vervolg, 200) || null });
    z.sessies = z.sessies.slice(0, 200);
    log(g.sch, g.p, 'zorgsessie', l.id, 'begeleiding genoteerd');
    save();
    res.json({ ok: true, sessies: z.sessies.slice(0, 10) });
  });

  /* Delen met een externe begeleider: expliciet, per persoon, en terug te
     draaien. Zonder deze stap ziet een externe niets -- ook niet met de rol. */
  router.post('/school/zorg/deel', (req, res) => {
    const g = poort(req, res, 'zorg'); if (!g) return;
    const l = vind(g.sch, req.body.leerlingId);
    if (!l) return res.status(404).json({ error: 'Deze leerling staat niet in de administratie.' });
    const p = eigenVeld(g.sch.personeel || {}, req.body.personeelId);
    if (!p) return res.status(404).json({ error: 'Die begeleider staat niet bij deze school.' });
    const z = zorgVan(l);
    const aan = req.body.aan !== false;
    z.gedeeldMet = aan ? [...new Set((z.gedeeldMet || []).concat([p.id]))] : (z.gedeeldMet || []).filter(x => x !== p.id);
    log(g.sch, g.p, aan ? 'zorg-gedeeld' : 'zorg-delen-gestopt', l.id, 'met ' + p.naam);
    save();
    res.json({ ok: true, gedeeldMet: z.gedeeldMet });
  });

};
