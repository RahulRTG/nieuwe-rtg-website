/* Horeca OS (deellaag): de fooienpot en de loonkosten tegenover de omzet.

   Rooster, klokken en verlof staan al elders in het huis (staff/klok, de
   personeelsapp, hrplus). Dit zijn de twee dingen die een horecazaak dagelijks
   nodig heeft en die daar niet in zitten -- en het zijn allebei plekken waar
   het snel oneerlijk wordt.

   1. DE FOOIENPOT WORDT VERDEELD OVER GEWERKTE UREN, NIET OVER FUNCTIES.
      Iedereen die die dienst heeft gewerkt, doet mee -- ook de afwas en de
      keuken, want die verdienen de fooi mee. Wie een andere sleutel wil
      (bijvoorbeeld met een weging per functie), zet die expliciet; er is geen
      stille standaard die de bediening bevoordeelt.
      De restcenten gaan naar de mensen met de meeste uren, en de som van de
      delen is exact de pot. Dezelfde regel als bij het splitsen van een
      rekening: er hoort geen cent bij te komen of af te gaan.
   2. HET LOONPERCENTAGE REKENT MET DE OMZET ZONDER FOOI. Fooi is geen omzet
      van de zaak, dus hij hoort niet in de noemer -- anders ziet een goede
      avond er op papier goedkoper uit dan hij is.

   Wat hier NIET staat: een oordeel over wie te duur is. Het percentage is een
   feit met zijn twee getallen erbij; wat het betekent, hangt af van de zaak,
   het weer en de dag, en dat weet de manager beter dan een dashboard. */
module.exports = (kern) => {
  const { app, save, schoon, supplierAuth, logActivity, horeca } = kern;
  const { H, nu, id, heleCenten, uitEuro, totaal } = horeca;

  const P = (code) => { const h = H(code); if (!h.personeel) h.personeel = { potten: {}, loon: {} }; return h.personeel; };
  const vandaag = () => nu().slice(0, 10);

  /* ---------- de fooienpot ---------- */
  app.post('/api/supplier/horeca/fooienpot', supplierAuth, (req, res) => {
    const p = P(req.supplier.code);
    const datum = schoon(req.body.datum, 10) || vandaag();
    const h = H(req.supplier.code);
    // de pot van die dag: alle fooi op rekeningen die die dag zijn gesloten
    const uitRekeningen = Object.values(h.rekeningen)
      .filter(r => (r.geslotenAt || '').slice(0, 10) === datum)
      .reduce((t, r) => t + heleCenten(r.fooiCenten || 0), 0);
    const extra = req.body.extraCenten != null ? heleCenten(req.body.extraCenten) : uitEuro(req.body.extra);
    const pot = uitRekeningen + extra;

    const deelnemers = (Array.isArray(req.body.deelnemers) ? req.body.deelnemers : []).slice(0, 100)
      .map(d => ({ naam: schoon(d && d.naam, 60), uren: Math.max(0, Math.min(24, Number(d && d.uren) || 0)),
        weging: Math.max(0.1, Math.min(5, Number(d && d.weging) || 1)) }))
      .filter(d => d.naam && d.uren);
    if (!deelnemers.length) return res.status(400).json({ error: 'Wie heeft er gewerkt? Geef per persoon de gewerkte uren.' });
    if (!pot) return res.status(409).json({ error: 'Er is die dag geen fooi binnengekomen.' });

    /* Verdelen op uren maal weging. De restcenten gaan naar wie de meeste uren
       heeft; zo is de som exact de pot en niet een cent minder. */
    const punten = deelnemers.map(d => d.uren * d.weging);
    const totaalPunten = punten.reduce((t, x) => t + x, 0);
    let rest = pot;
    const verdeling = deelnemers.map((d, i) => {
      const deel = Math.floor(pot * punten[i] / totaalPunten);
      rest -= deel;
      return { naam: d.naam, uren: d.uren, weging: d.weging, centen: deel };
    });
    const volgorde = verdeling.map((v, i) => i).sort((a, b) => punten[b] - punten[a]);
    for (let i = 0; i < rest; i++) verdeling[volgorde[i % volgorde.length]].centen += 1;

    const uitgekeerd = verdeling.reduce((t, v) => t + v.centen, 0);
    if (uitgekeerd !== pot) return res.status(500).json({ error: 'De verdeling telt niet op tot de pot; er is niets vastgelegd.' });

    p.potten[datum] = { datum, potCenten: pot, uitRekeningen, extra, verdeling, at: nu(), door: req.actor.name };
    save();
    logActivity(req.supplier.code, req.actor, 'verdeelde de fooienpot van ' + datum + ' (' + (pot / 100).toFixed(2) + ')');
    res.json({ ok: true, datum, potCenten: pot, uitRekeningen, extra, verdeling, uitgekeerd,
      let: 'Verdeeld over gewerkte uren, inclusief keuken en afwas. De som van de delen is exact de pot.' });
  });

  app.post('/api/supplier/horeca/fooienpot/lijst', supplierAuth, (req, res) => {
    const p = P(req.supplier.code);
    const rijen = Object.values(p.potten).sort((a, b) => String(b.datum).localeCompare(String(a.datum))).slice(0, 90);
    res.json({ ok: true, potten: rijen, totaal: rijen.reduce((t, x) => t + x.potCenten, 0) });
  });

  /* ---------- loonkosten tegenover omzet ---------- */
  app.post('/api/supplier/horeca/loonkosten', supplierAuth, (req, res) => {
    const p = P(req.supplier.code);
    const datum = schoon(req.body.datum, 10) || vandaag();
    if (Array.isArray(req.body.diensten)) {
      p.loon[datum] = { datum, diensten: req.body.diensten.slice(0, 200).map(d => ({
        naam: schoon(d && d.naam, 60) || 'medewerker',
        uren: Math.max(0, Math.min(24, Number(d && d.uren) || 0)),
        uurloonCenten: d && d.uurloon != null ? uitEuro(d.uurloon) : heleCenten(d && d.uurloonCenten),
        afdeling: schoon(d && d.afdeling, 30) || 'zaal' })), at: nu() };
      save();
    }
    const dag = p.loon[datum];
    if (!dag) return res.status(404).json({ error: 'Voor ' + datum + ' staan er geen diensten. Zet ze eerst neer (diensten: [{naam, uren, uurloon}]).' });

    const h = H(req.supplier.code);
    const rekeningen = Object.values(h.rekeningen).filter(r => (r.geslotenAt || '').slice(0, 10) === datum && r.status === 'betaald');
    const omzet = rekeningen.reduce((t, r) => t + totaal(r).netto, 0);   // zonder fooi: die is niet van de zaak
    const fooi = rekeningen.reduce((t, r) => t + heleCenten(r.fooiCenten || 0), 0);
    const loon = dag.diensten.reduce((t, d) => t + Math.round(d.uren * d.uurloonCenten), 0);
    const uren = dag.diensten.reduce((t, d) => t + d.uren, 0);
    const perAfdeling = dag.diensten.reduce((o, d) => Object.assign(o, {
      [d.afdeling]: (o[d.afdeling] || 0) + Math.round(d.uren * d.uurloonCenten) }), {});

    res.json({ ok: true, datum, omzetCenten: omzet, fooiCenten: fooi, loonCenten: loon, uren, perAfdeling,
      loonpercentage: omzet ? Math.round(loon / omzet * 1000) / 10 : null,
      omzetPerUur: uren ? Math.round(omzet / uren) : null,
      bonnen: rekeningen.length,
      let: omzet
        ? 'Het percentage rekent met de omzet ZONDER fooi; fooi is geen omzet van de zaak. Wat een goed percentage is, hangt af van de zaak en de dag -- dat oordeel staat hier niet.'
        : 'Er is die dag nog geen omzet geboekt, dus er is geen percentage. Een deling door nul is geen 0%.' });
  });

  /* ---------- gastprofiel en punten (CRM light) ----------
     Een gast is hier een naam met voorkeuren, en niets meer: geen
     bezoekfrequentie-score, geen "waarde per gast"-cijfer. Wat de bediening
     moet weten om iemand goed te helpen -- allergie, voorkeurstafel, wat hij
     meestal drinkt -- en wat er is afgesproken. */
  app.post('/api/supplier/horeca/gast', supplierAuth, (req, res) => {
    const h = H(req.supplier.code);
    if (!h.gasten) h.gasten = {};
    const naam = schoon(req.body.naam, 60);
    if (!naam) return res.status(400).json({ error: 'Om wie gaat het?' });
    const sleutel = naam.toLowerCase();
    const g = h.gasten[sleutel] || (h.gasten[sleutel] = { naam, punten: 0, bezoeken: 0, at: nu() });
    if (req.body.allergie !== undefined) g.allergie = schoon(req.body.allergie, 120) || null;
    if (req.body.voorkeur !== undefined) g.voorkeur = schoon(req.body.voorkeur, 160) || null;
    if (req.body.notitie) g.notities = (g.notities || []).concat([{ tekst: schoon(req.body.notitie, 200), at: nu(), door: req.actor.name }]).slice(-20);
    if (req.body.bezoek === true) { g.bezoeken += 1; g.laatsteBezoek = vandaag(); }
    if (req.body.punten != null) {
      const punten = Math.round(Number(req.body.punten) || 0);
      if (g.punten + punten < 0) return res.status(400).json({ error: 'Een gast kan niet minder dan nul punten hebben.' });
      g.punten += punten;
      g.puntenLog = (g.puntenLog || []).concat([{ punten, reden: schoon(req.body.reden, 80) || null, at: nu() }]).slice(-50);
    }
    save();
    res.json({ ok: true, gast: g,
      let: 'Een gastprofiel bewaart wat nodig is om iemand goed te helpen. Er staat geen waarde-per-gast-score in; die maakt van gastvrijheid een rangorde.' });
  });

  app.post('/api/supplier/horeca/gasten', supplierAuth, (req, res) => {
    const h = H(req.supplier.code);
    const rijen = Object.values(h.gasten || {}).sort((a, b) => String(a.naam).localeCompare(String(b.naam)));
    res.json({ ok: true, aantal: rijen.length, gasten: rijen.slice(0, 500),
      metAllergie: rijen.filter(g => g.allergie).length });
  });
};
