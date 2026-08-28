/* School (deelmodule): de signalen rond een leerling, voor de mentor en de
   zorgcoordinator. Hoort bij school/analyse.js (dashboard en waarschuwingen),
   dat de verzuim- en gemiddelde-rekensom via de context meegeeft.

   Er komt geen risicoscore uit, geen percentage "kans op uitval" en geen label
   dat aan een kind blijft plakken. Wat eruit komt zijn de FACTOREN die iemand
   zelf kan nakijken: zoveel lessen gemist, zoveel keer te laat, dit
   gemiddelde, zoveel huiswerk open. De lijst staat op naam en niet op zwaarte
   -- een ranglijst maakt van "wie heeft aandacht nodig" vanzelf "wie
   presteert het slechtst".

   Wie erover beslist staat niet als losse zin in dit antwoord maar komt uit
   kern/schooladvies.js: die grens hoort op een plek te staan, niet in vijf
   kopieen. */
const { uitspraak } = require('../kern/schooladvies');

/* Vast per antwoord: de tekst hangt aan de lijst en niet aan een leerling, dus
   hij wordt hier een keer gemaakt en niet per verzoek opnieuw. */
const SIGNAAL = uitspraak('signaal',
  'Dit zijn waarnemingen waar een gesprek achter hoort.');

module.exports = (sctx) => {
  const { router, schoon, K, poort, presentieLijst, schoolVerzuim: verzuim, gemiddelde } = sctx;
  const MIN_LESSEN = 10;
  const dagen = (d) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
  const klassenVan = (sch) => Object.values(K()).filter(k => k.schoolCode === sch.code);

  /* ---------- signalen rond een leerling ----------
     Voor de mentor en de zorgcoordinator. Elke leerling met minstens een
     factor komt erin, op naam gesorteerd, met de factoren erbij en zonder
     score. Wat de school ermee doet, is een gesprek -- geen automatische
     maatregel, en dat staat er ook bij. */
  router.post('/school/signalen', (req, res) => {
    const g = poort(req, res, 'zorg.signaal'); if (!g) return;
    const klasCode = String(req.body.klasCode || '').trim().toUpperCase();
    const klassen = klassenVan(g.sch).filter(k => !klasCode || k.code === klasCode);
    if (klasCode && !klassen.length) return res.status(404).json({ error: 'Die klas hoort niet bij deze school.' });
    const rijen = [];
    for (const k of klassen) {
      for (const l of (k.leerlingen || [])) {
        const factoren = [];
        const v = verzuim(g.sch, les => les.klasCode === k.code && les.datum >= dagen(60));
        let eigen = { lessen: 0, gemist: 0, telaat: 0 };
        for (const les of presentieLijst(g.sch)) {
          if (les.klasCode !== k.code || les.datum < dagen(60)) continue;
          for (const r of les.regels) if (r.leerling === l.sleutel) {
            eigen.lessen++;
            if (r.stand === 'afwezig' || r.stand === 'ziek') eigen.gemist++;
            if (r.stand === 'telaat') eigen.telaat++;
          }
        }
        if (eigen.lessen >= MIN_LESSEN && eigen.gemist / eigen.lessen > 0.15)
          factoren.push({ wat: 'verzuim', uitleg: eigen.gemist + ' van ' + eigen.lessen + ' geregistreerde lessen gemist in zestig dagen' + (v.deel != null ? ' (klas: ' + Math.round(v.deel * 100) + '%)' : '') });
        if (eigen.telaat >= 5) factoren.push({ wat: 'te laat', uitleg: eigen.telaat + ' keer te laat in zestig dagen' });
        const cijfers = (k.cijfers || []).filter(c => c.leerling === l.sleutel);
        const gem = gemiddelde(cijfers);
        if (gem != null && cijfers.length >= 3 && gem < 5.5) factoren.push({ wat: 'cijfers', uitleg: 'gewogen gemiddelde ' + gem + ' over ' + cijfers.length + ' cijfers' });
        const openHw = (k.huiswerk || []).filter(h => !(h.afDoor || []).includes(l.sleutel) && h.deadline && h.deadline < new Date().toISOString().slice(0, 10)).length;
        if (openHw >= 3) factoren.push({ wat: 'huiswerk', uitleg: openHw + ' opdrachten met een verstreken inleverdatum niet afgevinkt' });
        if (factoren.length) rijen.push({ naam: l.naam, sleutel: l.sleutel, klas: k.naam, klasCode: k.code, factoren });
      }
    }
    res.json({ ok: true, aantal: rijen.length,
      leerlingen: rijen.sort((a, b) => String(a.naam).localeCompare(String(b.naam))).slice(0, 300),
      advies: true, besluitDoorMens: SIGNAAL.besluitDoorMens, adviesSoort: SIGNAAL.soort,
      beslist: SIGNAAL.beslist, bijschrift: SIGNAAL.bijschrift,
      uitleg: 'Dit zijn waarnemingen, geen voorspelling en geen oordeel. Er hoort een gesprek achter, geen maatregel uit het systeem. '
        + 'Er is bewust geen score en geen volgorde op zwaarte.',
      reden: schoon(req.body.reden, 120) || null });
  });

};
