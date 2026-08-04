/* RTG Werk OS (deellaag): het directiebeeld.

   Een directiedashboard is de makkelijkste plek om te liegen: elk getal dat je
   niet meet, wordt een nul, en elke nul ziet eruit als rust. Drie regels
   houden dit beeld eerlijk, en het zijn dezelfde als bij het horeca-dagbeeld:

   1. ELK CIJFER DRAAGT ZIJN NOEMER. Waar een deling in zit, staan teller en
      noemer erbij.
   2. WAT NIET GEMETEN WORDT, IS NIET NUL. Een module zonder gegevens levert
      `null` en een regel in `nietGemeten`, met de reden erbij.
   3. ER WORDT NIETS VOORSPELD. Geen omzetprognose, geen verloopvoorspelling,
      geen "verwachte" cijfers. Wat er staat is wat er NU is, met een
      tijdstempel. Een voorspelling hoort pas te bestaan als er genoeg
      afgesloten perioden zijn om hem aan te toetsen, en die zijn er niet.

   Het beeld leest alleen uit de eigen werkruimte. Een holding die haar
   dochters wil optellen, doet dat met een EIGEN handeling
   (/api/bedrijf/geconsolideerd) en met het beheer-token van elke dochter --
   niet omdat het technisch moet, maar omdat een moeder niet ongemerkt in de
   boeken van een dochter hoort te kijken. */
'use strict';

module.exports = (sctx) => {
  const { app, dag, werkPoort, eigenVeld, W } = sctx;

  function beeld(w) {
    const uit = { werkruimte: { code: w.code, naam: w.naam, land: w.land, valuta: w.valuta } };
    const niet = [];

    const leden = Object.values(w.leden || {});
    const actief = leden.filter(l => l.status === 'actief');
    uit.mensen = { actief: actief.length, wachtend: leden.filter(l => l.status === 'wacht').length,
      uitDienst: leden.filter(l => l.status === 'uit dienst').length,
      extern: actief.filter(l => l.extern).length };

    const projecten = Object.values(w.projecten || {});
    const taken = Object.values(w.taken || {});
    if (projecten.length) {
      const klaar = taken.filter(t => t.kolom === 'klaar').length;
      uit.projecten = { lopend: projecten.filter(p => p.status === 'loopt').length,
        taken: taken.length, takenKlaar: klaar,
        deelKlaar: taken.length ? Math.round(klaar / taken.length * 100) : null,
        teLaat: taken.filter(t => t.kolom !== 'klaar' && t.deadline && t.deadline < dag()).length,
        urenGeschreven: Math.round(taken.reduce((n, t) => n + (t.uren || 0), 0) * 10) / 10 };
    } else niet.push({ blok: 'projecten', reden: 'geen enkel project in deze werkruimte' });

    const kansen = Object.values(w.kansen || {});
    if (kansen.length) {
      const gewonnen = kansen.filter(k => k.fase === 'gewonnen');
      const verloren = kansen.filter(k => k.fase === 'verloren');
      uit.verkoop = { klanten: Object.values(w.klanten || {}).length,
        openKansen: kansen.length - gewonnen.length - verloren.length,
        gewonnen: gewonnen.length, gewonnenCenten: gewonnen.reduce((t, k) => t + k.bedragCenten, 0),
        verloren: verloren.length,
        scoringPct: (gewonnen.length + verloren.length)
          ? Math.round(gewonnen.length / (gewonnen.length + verloren.length) * 1000) / 10 : null,
        noemer: gewonnen.length + verloren.length + ' afgesloten kans(en)' };
    } else niet.push({ blok: 'verkoop', reden: 'nog geen verkoopkansen' });

    const tickets = Object.values(w.tickets || {});
    if (tickets.length) {
      const dicht = tickets.filter(t => t.status === 'gesloten');
      const cijfers = tickets.map(t => t.tevredenheid).filter(x => typeof x === 'number');
      uit.service = { open: tickets.length - dicht.length, gesloten: dicht.length,
        storingenOpen: Object.values(w.storingen || {}).filter(s => !s.opgelostAt).length,
        tevredenheid: cijfers.length >= 5
          ? { gemiddelde: Math.round(cijfers.reduce((a, b) => a + b, 0) / cijfers.length * 10) / 10, aantal: cijfers.length }
          : null,
        tevredenheidUitleg: cijfers.length >= 5 ? null : 'nog ' + (5 - cijfers.length) + ' antwoord(en) nodig' };
    } else niet.push({ blok: 'service', reden: 'nog geen tickets' });

    const releases = Object.values(w.releases || {});
    if (releases.length) {
      const prod = releases.filter(r => r.omgeving === 'productie');
      uit.bouw = { releasesProductie: prod.length, teruggedraaid: prod.filter(r => r.teruggedraaid).length,
        openIssues: Object.values(w.issues || {}).filter(i => i.status === 'open' || i.status === 'bezig').length,
        vlaggenOverDatum: Object.values(w.vlaggen || {}).filter(v => v.opruimen < dag()).length };
    } else niet.push({ blok: 'bouw', reden: 'nog geen releases' });

    const contracten = Object.values(w.contracten || {});
    if (contracten.length) {
      uit.recht = { actief: contracten.filter(c => c.status === 'actief').length,
        zonderEinddatum: contracten.filter(c => !c.eindigt).length,
        opzegdagBinnen30: contracten.filter(c => c.eindigt && c.opzegtermijnDagen &&
          new Date(Date.parse(c.eindigt) - c.opzegtermijnDagen * 86400000).toISOString().slice(0, 10) >= dag() &&
          new Date(Date.parse(c.eindigt) - c.opzegtermijnDagen * 86400000).toISOString().slice(0, 10) <= new Date(Date.parse(dag()) + 30 * 86400000).toISOString().slice(0, 10)).length };
    } else niet.push({ blok: 'recht', reden: 'nog geen contracten' });

    const besluiten = Object.values(w.besluiten || {});
    if (besluiten.length) {
      uit.governance = { inAdvies: besluiten.filter(b => b.status === 'advies').length,
        inStemming: besluiten.filter(b => b.status === 'stemmen').length,
        aangenomen: besluiten.filter(b => b.status === 'aangenomen').length,
        teEvalueren: besluiten.filter(b => b.evalueerOp && b.evalueerOp <= dag()).length };
    } else niet.push({ blok: 'governance', reden: 'nog geen besluiten' });

    const it = Object.values(w.apparaten || {});
    if (it.length || Object.values(w.licenties || {}).length) {
      uit.it = { apparaten: it.length, uitgegeven: it.filter(a => a.bijLid).length,
        onversleuteld: it.filter(a => !a.versleuteld).length,
        licentieOverschrijding: Object.values(w.licenties || {}).filter(l => l.toegewezen.length > l.aantal).length };
    } else niet.push({ blok: 'it', reden: 'nog geen apparaten of licenties' });

    uit.nietGemeten = niet;
    uit.gemetenOp = new Date().toISOString();
    return uit;
  }

  app.post('/api/bedrijf/beeld', (req, res) => {
    const g = werkPoort(req, res, 'cijfer'); if (!g) return;
    res.json(Object.assign({ ok: true }, beeld(g.w), {
      let: 'Elk cijfer draagt zijn noemer, en wat niet gemeten wordt staat bij nietGemeten in plaats van op nul. Er staat geen enkele voorspelling in dit beeld: wat hier staat is wat er nu is, met een tijdstempel.' }));
  });

  /* Geconsolideerd: EEN handeling, en alleen met het beheer-token van elke
     dochter erbij. Een moeder die ongemerkt in de boeken van haar dochters kan
     kijken, maakt van "de werkruimte is de grens" een leuze. */
  app.post('/api/bedrijf/geconsolideerd', (req, res) => {
    const w = sctx.beheerVan(req, res); if (!w) return;
    const sleutels = req.body.dochterTokens && typeof req.body.dochterTokens === 'object' ? req.body.dochterTokens : {};
    const dochters = Object.values(W()).filter(x => x.moeder === w.code);
    const mee = [], zonder = [];
    for (const d of dochters) {
      if (eigenVeld(sleutels, d.code) === d.beheerToken) mee.push(d); else zonder.push(d.code);
    }
    const delen = [w].concat(mee).map(beeld);
    const som = (pad) => delen.reduce((t, b) => {
      const v = pad.split('.').reduce((o, k) => (o == null ? null : o[k]), b);
      return t + (typeof v === 'number' ? v : 0);
    }, 0);
    res.json({ ok: true, werkruimtes: delen.map(d => d.werkruimte),
      nietMeegeteld: zonder,
      totalen: { mensenActief: som('mensen.actief'), projectenLopend: som('projecten.lopend'),
        gewonnenCenten: som('verkoop.gewonnenCenten'), ticketsOpen: som('service.open'),
        contractenActief: som('recht.actief') },
      delen,
      let: zonder.length
        ? zonder.length + ' dochter(s) tellen NIET mee: zonder hun beheer-token kijkt een moeder hier niet in de boeken. Dat is geen fout maar de grens.'
        : 'Alle dochters hebben hun sleutel meegegeven; dit totaal is compleet.' });
  });

  sctx.startBron('kpi', 'cijfer', (g) => {
    const b = beeld(g.w);
    return { mensen: b.mensen.actief, projecten: b.projecten ? b.projecten.lopend : null,
      openTickets: b.service ? b.service.open : null, nietGemeten: b.nietGemeten.length };
  });

  return { bedrijfsbeeld: beeld };
};
