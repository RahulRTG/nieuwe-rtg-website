/* School (deelmodule) "directie": de directiewerkbank op kantoren-niveau,
   met de onderwijsregels leidend. De cockpit toont AGGREGATEN per klas
   (rooster gezet, huiswerkdruk, open absenties) en signalen die helpen
   zonder te controleren -- geen cijfers van leerlingen, geen namen in
   signalen, geen ranglijsten en geen omzet. Plus: een schoolbrede
   mededeling die in een keer bij alle klassen (en dus alle gezinnen)
   landt, met de afzender er eerlijk bij. */
module.exports = (sctx) => {
  const { router, save, rid, nu, schoon, K, schoolVan, klasSamenvatting } = sctx;

  const vandaag = () => new Date().toISOString().slice(0, 10);
  const overDagen = d => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10);

  /* De signalen van de school: wat verdient aandacht van de directie?
     Bewust zonder leerlingnamen: de directie stuurt op de organisatie,
     de leraar kent de kinderen. */
  function signalen(sch, klassen) {
    const s = [];
    const wacht = Object.values(sch.personeel || {}).filter(p => p.status === 'wacht').length;
    if (wacht) s.push({ soort: 'personeel', tekst: wacht + ' aanmelding(en) van personeel wachten op een besluit.' });
    for (const k of klassen) {
      if (!k.roosterRegels) s.push({ soort: 'rooster', tekst: 'Klas ' + k.naam + ' heeft nog geen rooster; de gezinnen zien dan een lege week.' });
      if (k.openAbsenties) s.push({ soort: 'absentie', tekst: 'Klas ' + k.naam + ': ' + k.openAbsenties + ' ziekmelding(en) staan nog open; even afhandelen geeft het gezin rust.' });
      if (k.huiswerkWeek > 5) s.push({ soort: 'druk', tekst: 'Klas ' + k.naam + ' heeft ' + k.huiswerkWeek + ' opdrachten met een inleverdatum deze week; kijk of de druk te verdelen is.' });
    }
    return s.slice(0, 12);
  }

  router.post('/school/directie/cockpit', (req, res) => {
    const sch = schoolVan(req, res); if (!sch) return;
    const grens = overDagen(7);
    const klassen = Object.values(K()).filter(k => k.schoolCode === sch.code).map(k => {
      const basis = klasSamenvatting(k);
      return Object.assign(basis, {
        roosterRegels: (k.rooster || []).length,
        // huiswerkdruk als aantal, nooit wie wat af heeft: dat is aan de leraar
        huiswerkWeek: (k.huiswerk || []).filter(h => h.deadline && h.deadline >= vandaag() && h.deadline <= grens).length
      });
    });
    const personeel = Object.values(sch.personeel || {});
    res.json({ ok: true, naam: sch.naam, plaats: sch.plaats, status: sch.status || 'actief',
      kpi: { klassen: klassen.length,
        leerlingen: klassen.reduce((n, k) => n + (k.leerlingen || 0), 0),
        actief: personeel.filter(p => p.status === 'actief').length,
        wacht: personeel.filter(p => p.status === 'wacht').length },
      klassen, signalen: signalen(sch, klassen),
      // de laatste schoolbrede mededelingen (alleen die van de directie zelf)
      mededelingen: Object.values(K()).filter(k => k.schoolCode === sch.code)
        .flatMap(k => (k.mededelingen || []).filter(m => m.vanDirectie))
        .filter((m, i, a) => a.findIndex(x => x.groepId === m.groepId) === i)
        .sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 5) });
  });

  /* Een schoolbrede mededeling: een keer schrijven, elke klas ziet hem,
     met de afzender er eerlijk bij. */
  router.post('/school/directie/mededeling', (req, res) => {
    const sch = schoolVan(req, res); if (!sch) return;
    const tekst = schoon(req.body.tekst, 400);
    if (!tekst) return res.status(400).json({ error: 'Schrijf de mededeling.' });
    const groepId = rid(4);
    let n = 0;
    for (const k of Object.values(K()).filter(k => k.schoolCode === sch.code)) {
      k.mededelingen.unshift({ id: rid(3), groepId, tekst, at: nu(), vanDirectie: true, van: 'Directie ' + sch.naam });
      n++;
    }
    save();
    res.json({ ok: true, klassen: n });
  });
};
