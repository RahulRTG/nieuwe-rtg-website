/* Guest OS (deellaag): VERDELEN, FOOI EN AFREKENEN.

   De rekensom staat in kern/gast/afrekenen.js; hier alleen de bedrading. Twee
   dingen die je aan deze routes moet weten:

   - VERDELEN KNIPT DE REKENING NIET. Er ontstaat geen tweede rekening; er komt
     een afspraak op te liggen over wie welk deel betaalt. Splitsen in echte
     losse rekeningen is een handeling van de BEDIENING (horeca/schuif.js), want
     dan gaat de tafel uit elkaar en dat is een besluit van de zaak.
   - AFREKENEN LIEGT NIET. Alleen de rails die echt geld verplaatsen doen mee
     (cadeaubon, tegoed, hotelkamer). Kaart en online vanaf de telefoon van de
     gast bestaan hier nog niet, en dat zegt het antwoord met zoveel woorden in
     plaats van een groen vinkje te tonen. */
'use strict';

module.exports = (kern) => {
  const { app, afrekenlaag, orderlaag, gastAuth, stuur, folioBoek } = kern;

  /* ---------- de verdeling ---------- */
  app.post('/api/gast/verdeel', gastAuth, (req, res) => {
    const { zaakcode, rekening, deelnemer } = req.gast;
    const b = req.body || {};
    const uit = afrekenlaag.verdeel(zaakcode, rekening, { wijze: b.wijze, delen: b.delen, nr: b.nr });
    if (uit.error) return stuur(res, uit);
    /* De verdeling teruggeven MET de handles erbij: een rij nummers is voor de
       gast betekenisloos, en het scherm zou ze anders zelf moeten koppelen. */
    const wie = (nr) => (rekening.deelnemers || []).find(d => d.nr === nr);
    res.json({ ok: true, wijze: uit.verdeling.wijze,
      delen: uit.verdeling.delen.map(d => ({ nr: d.nr, handle: wie(d.nr) ? wie(d.nr).handle : ('Gast ' + d.nr),
        centen: d.centen, ik: !!deelnemer && d.nr === deelnemer.nr })),
      teBetalen: uit.verdeling.teBetalen,
      wijzen: afrekenlaag.WIJZEN });
  });

  /* ---------- fooi ---------- */
  app.post('/api/gast/fooi', gastAuth, (req, res) => {
    const { zaakcode, rekening, deelnemer } = req.gast;
    const b = req.body || {};
    /* Geen voorstel, geen percentageknop met een voorgeselecteerde waarde: wat
       er niet expliciet wordt gegeven, wordt niet gerekend. */
    if (b.centen == null) return res.status(400).json({ error: 'Hoeveel fooi wil je geven?', code: 'fooi-leeg' });
    stuur(res, afrekenlaag.fooi(zaakcode, rekening, deelnemer, b.centen));
  });

  /* ---------- betalen ---------- */
  app.post('/api/gast/betaal', gastAuth, (req, res) => {
    const { zaakcode, rekening, deelnemer } = req.gast;
    const b = req.body || {};
    stuur(res, afrekenlaag.betaal(zaakcode, rekening, deelnemer, {
      wijze: b.wijze, centen: b.centen, bonCode: b.bonCode, kamer: b.kamer,
      idem: b.idem, apparaat: b.apparaat, folioBoek }));
  });

  /* ---------- het logboek van deze rekening ----------
     Dezelfde gebeurtenissen als de zaak ziet, maar zonder personeelsnamen en
     zonder sleutels. Een gast hoort te kunnen nakijken wat er met zijn geld en
     zijn bestelling is gebeurd; dat is geen extraatje maar de reden dat er een
     audit ligt. */
  app.post('/api/gast/logboek', gastAuth, (req, res) => {
    const { rekening, deelnemer } = req.gast;
    res.json({ ok: true,
      tijdlijn: orderlaag.tijdlijn(rekening),
      logboek: (rekening.audit || []).slice(-60).map(a => ({ at: a.at, wie: a.actor, wat: a.wat,
        van: a.van, naar: a.naar, reden: a.reden })),
      ik: deelnemer ? deelnemer.handle : null });
  });
};
