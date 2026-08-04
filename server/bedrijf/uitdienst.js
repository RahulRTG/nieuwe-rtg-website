/* RTG Werk OS (deellaag): het uitdienstproces. Hoort bij bedrijf/it.js.

   Dit is de module die de belofte uit golf 1 waarmaakt. Daar stond bij
   /lid/uit-dienst: "het IT-deel hangt hier later aan; de plek waar dat gebeurt
   is deze, en niet een tweede knop ergens anders." Hier is die plek.

   Een uitdiensttreding is EEN proces met zes stappen, en drie regels erbij:

   1. HET PROCES SLUIT NIET VANZELF. Er is geen knop "alles gedaan"; elke stap
      draagt de naam van wie hem deed en het tijdstip. Een uitstroom die
      zichzelf afvinkt, is de reden dat oud-medewerkers maanden later nog
      binnenkomen.
   2. WAT NOG UITSTAAT, WORDT GETELD EN NIET GESCHAT. De stap "apparaten terug"
      kan niet worden afgevinkt zolang er nog een apparaat op naam staat --
      het systeem weet dat, dus het hoort het te weigeren.
   3. HET PROCES BEGINT VANZELF. Zodra een lid uit dienst gaat staat het
      dossier klaar; niemand hoeft eraan te denken. Eraan denken is precies wat
      er misgaat op de dag dat iemand vertrekt. */
'use strict';

module.exports = (sctx) => {
  const { app, save, schoon, nu, werkPoort, log, eigenVeld, STAPPEN, APPARATEN: A, LICENTIES: L, UITDIENST: U } = sctx;

  function dossier(w, lidId) {
    const u = eigenVeld(U(w), lidId);
    if (u) return u;
    const nieuw = { lidId, stappen: {}, at: nu() };
    U(w)[lidId] = nieuw;
    return nieuw;
  }

  // wat er feitelijk nog uitstaat: geteld uit de inventaris, niet ingevuld
  function openstaand(w, lidId) {
    return {
      apparaten: Object.values(A(w)).filter(a => a.bijLid === lidId)
        .map(a => ({ id: a.id, soort: a.soort, nummer: a.nummer, sinds: a.uitAt })),
      licenties: Object.values(L(w)).filter(l => l.toegewezen.includes(lidId)).map(l => l.product)
    };
  }

  app.post('/api/bedrijf/uitdienst', (req, res) => {
    const g = werkPoort(req, res, 'it'); if (!g) return;
    const alleen = String(req.body.lidId || '');
    const leden = Object.values(g.w.leden).filter(l => l.status === 'uit dienst' && (!alleen || l.id === alleen));
    const rijen = leden.map(l => {
      const d = dossier(g.w, l.id);
      const open = openstaand(g.w, l.id);
      const gedaan = STAPPEN.filter(s => d.stappen[s]);
      return { lidId: l.id, naam: l.naam, laatsteDag: l.laatsteDag, reden: l.uitReden,
        stappen: STAPPEN.map(s => ({ stap: s, gedaan: !!d.stappen[s],
          door: d.stappen[s] ? d.stappen[s].door : null, at: d.stappen[s] ? d.stappen[s].at : null })),
        klaar: gedaan.length === STAPPEN.length,
        openstaand: open };
    });
    save();
    res.json({ ok: true, aantal: rijen.length, uitdienst: rijen, stappen: STAPPEN,
      nietKlaar: rijen.filter(r => !r.klaar).length,
      let: 'De sleutel is bij het uit dienst gaan al ingetrokken. Wat hier staat is de rest, en dat vinkt zichzelf niet af.' });
  });

  app.post('/api/bedrijf/uitdienst/stap', (req, res) => {
    const g = werkPoort(req, res, 'it'); if (!g) return;
    const l = eigenVeld(g.w.leden, String(req.body.lidId || ''));
    if (!l) return res.status(404).json({ error: 'Dat lid kennen we niet.' });
    if (l.status !== 'uit dienst') return res.status(409).json({ error: 'Dit lid is niet uit dienst; er valt niets af te ronden.' });
    const stap = schoon(req.body.stap, 60);
    if (!STAPPEN.includes(stap)) return res.status(400).json({ error: 'Onbekende stap. Kies: ' + STAPPEN.join(', ') + '.' });

    /* De stap die het systeem zelf kan nakijken, kijkt het zelf na. Afvinken
       dat de apparaten terug zijn terwijl er nog een laptop op naam staat, is
       precies het vinkje dat een audit later niet overleeft. */
    const open = openstaand(g.w, l.id);
    if (stap === 'apparaten terug' && open.apparaten.length)
      return res.status(409).json({ error: 'Er staat nog materiaal op naam van ' + l.naam + ': ' +
        open.apparaten.map(a => a.soort + ' ' + a.nummer).join(', ') + '. Neem het eerst in.',
        openstaand: open.apparaten });
    if (stap === 'sleutels ingetrokken' && open.licenties.length)
      return res.status(409).json({ error: 'Er staan nog licenties op naam: ' + open.licenties.join(', ') + '.',
        openstaand: open.licenties });

    const d = dossier(g.w, l.id);
    d.stappen[stap] = { door: g.l.naam, at: nu(), notitie: schoon(req.body.notitie, 200) || null };
    log(g.w, g.l, 'uitdienst-stap', l.id, stap);
    save();
    const gedaan = STAPPEN.filter(s => d.stappen[s]);
    res.json({ ok: true, lid: l.naam, stap, gedaan: gedaan.length, van: STAPPEN.length,
      klaar: gedaan.length === STAPPEN.length,
      resterend: STAPPEN.filter(s => !d.stappen[s]) });
  });

  sctx.startBron('it', 'it', (g) => {
    const uit = Object.values(g.w.leden).filter(l => l.status === 'uit dienst');
    const open = uit.filter(l => {
      const d = eigenVeld(U(g.w), l.id);
      return !d || STAPPEN.some(s => !d.stappen[s]);
    });
    return { uitdienstOpen: open.length,
      apparatenUit: Object.values(A(g.w)).filter(a => a.bijLid).length,
      licentieOverschrijding: Object.values(L(g.w)).filter(l => l.toegewezen.length > l.aantal).length };
  });
};
