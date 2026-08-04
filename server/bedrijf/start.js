/* RTG Werk OS (deellaag): het startscherm -- een werkplek per rol.

   Het startscherm is de plek waar een enterprise-werkplek meestal ontspoort:
   iedereen krijgt dezelfde twaalf blokken, de helft staat leeg, en na een week
   kijkt niemand er meer naar. Daarom staan hier drie regels in de code.

   1. EEN BLOK VERSCHIJNT ALLEEN ALS JE HET RECHT ERVOOR HEBT. Een programmeur
      krijgt geen leeg salarisblok te zien, een HR-medewerker geen lege
      releaselijst. Het scherm volgt de rollen en niet de smaak.
   2. WAT NIET GEMETEN WORDT, STAAT ER ALS NIET GEMETEN. Geen nul, geen streepje
      en geen lege grafiek die eruitziet als "rustige dag". Elk blok dat nog
      geen bron heeft, staat met naam en reden in `nietGemeten` -- dat is
      dezelfde afspraak als de tevredenheid op het schooldashboard, die null
      bleef tot er echt een peiling was.
   3. ELKE MODULE MELDT ZICH ZELF AAN. Een blok wordt geregistreerd door de
      laag die de gegevens heeft (sctx.startBron). Zo hoeft dit bestand niets
      te weten van projecten, tickets of contracten, en kan het niet
      achterlopen op wat er echt is.

   De snelle acties komen uit de RECHTEN en niet uit een lijst: een knop die je
   toch niet mag indrukken, hoort niet op je startscherm. */
'use strict';

// welke actie hoort bij welk recht; de bron van de knoppenrij
const ACTIES = [
  { recht: 'project', naam: 'Nieuwe taak', pad: '/api/bedrijf/taak/maak' },
  { recht: 'kennis', naam: 'Kennisbank doorzoeken', pad: '/api/bedrijf/kennis/zoek' },
  { recht: 'klant', naam: 'Nieuwe verkoopkans', pad: '/api/bedrijf/kans/maak' },
  { recht: 'service', naam: 'Ticket aanmaken', pad: '/api/bedrijf/ticket/maak' },
  { recht: 'bouw', naam: 'Incident melden', pad: '/api/bedrijf/incident/meld' },
  { recht: 'mens', naam: 'Verlof beoordelen', pad: '/api/bedrijf/verlof/lijst' },
  { recht: 'geld', naam: 'Uitgave indienen', pad: '/api/bedrijf/uitgave/maak' },
  { recht: 'recht', naam: 'Contract opzoeken', pad: '/api/bedrijf/contract/lijst' },
  { recht: 'besluit', naam: 'Besluit voorstellen', pad: '/api/bedrijf/besluit/maak' },
  { recht: 'it', naam: 'Apparaat uitgeven', pad: '/api/bedrijf/apparaat/zet' }
];

module.exports = (sctx) => {
  const { app, werkPoort, dag, rollenVan } = sctx;

  /* De blokkenregistratie. Een module roept dit aan als hij gebouwd is; tot
     die tijd staat zijn blok bij `nietGemeten` met de reden erbij. */
  sctx.startBronnen = [];
  sctx.startBron = (naam, recht, fn) => { sctx.startBronnen.push({ naam, recht, fn }); };

  // de blokken die het spec belooft, met wie ze levert
  const BELOOFD = [
    { naam: 'taken', bron: 'projecten' },
    { naam: 'agenda', bron: 'de bestaande RTG Agenda (routes/agenda.js)' },
    { naam: 'berichten', bron: 'de bestaande RTMAIL en Berichten' },
    { naam: 'documenten', bron: 'het bestaande RTG Office (kern/office/)' },
    { naam: 'goedkeuringen', bron: 'besluiten, uitgaven en contracten' },
    { naam: 'projecten', bron: 'projecten' },
    { naam: 'nieuws', bron: 'de kennisbank' },
    { naam: 'waarschuwingen', bron: 'deze laag zelf' },
    { naam: 'kpi', bron: 'het directiebeeld' }
  ];

  /* De waarschuwingen die deze laag ZELF kan onderbouwen. Alle drie komen uit
     de ledenlijst en niet uit een aanname, en alle drie noemen hun getal. */
  function waarschuwingen(g) {
    const uit = [];
    const leden = Object.values(g.w.leden || {});
    const wacht = leden.filter(l => l.status === 'wacht');
    if (wacht.length && (g.directie || g.rechten.includes('werkruimte')))
      uit.push({ soort: 'toegang', tekst: wacht.length + ' aanmelding(en) wachten op toelating: ' + wacht.map(l => l.naam).join(', ') + '.' });

    const verlopen = leden.filter(l => l.status === 'actief' &&
      (l.rollen || []).length && (l.rollen || []).every(r => r.tot && r.tot < dag()));
    if (verlopen.length && (g.directie || g.rechten.includes('werkruimte')))
      uit.push({ soort: 'toegang', tekst: verlopen.length + ' lid/leden heeft alleen nog verlopen rollen en kan dus niets meer; verleng of zet uit dienst.' });

    const externZonderEind = leden.filter(l => l.extern && l.status === 'actief' &&
      (l.rollen || []).some(r => !r.tot));
    if (externZonderEind.length && (g.directie || g.rechten.includes('it.beveiliging') || g.rechten.includes('werkruimte')))
      uit.push({ soort: 'beveiliging', tekst: externZonderEind.length + ' externe(n) heeft een rol zonder einddatum. Een externe zonder einddatum blijft binnen tot iemand eraan denkt.' });

    return uit;
  }

  app.post('/api/bedrijf/start', (req, res) => {
    const g = werkPoort(req, res); if (!g) return;
    const blokken = {};
    const nietGemeten = [];
    const geleverd = new Set();

    for (const b of sctx.startBronnen) {
      if (b.recht && !g.rechten.includes(b.recht)) continue;
      let uit = null;
      try { uit = b.fn(g); } catch (e) { uit = { fout: 'dit blok kon niet worden opgehaald' }; }
      if (uit != null) { blokken[b.naam] = uit; geleverd.add(b.naam); }
    }
    for (const b of BELOOFD) {
      if (geleverd.has(b.naam)) continue;
      nietGemeten.push({ blok: b.naam, reden: 'nog geen bron in deze werkruimte (' + b.bron + ')' });
    }

    blokken.waarschuwingen = waarschuwingen(g);
    const acties = ACTIES.filter(a => g.rechten.includes(a.recht) && !g.alleenLezen);

    res.json({ ok: true,
      wie: { naam: g.l.naam, functie: g.l.functie || null, afdeling: g.l.afdeling || null,
        rollen: g.directie ? ['directie'] : rollenVan(g.l), alleenLezen: !!g.alleenLezen },
      werkruimte: { code: g.w.code, naam: g.w.naam },
      blokken, snelleActies: acties, nietGemeten,
      let: 'Blokken volgen uw rollen: wat u niet mag, staat er niet als lege doos. Wat nog geen bron heeft, staat bij nietGemeten en niet als nul -- een leeg dashboard ziet er anders precies zo uit als een rustige dag.' });
  });
};
