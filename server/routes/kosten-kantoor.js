/* RTG KOSTPRIJS -- de kantoorkant. Alles achter boardroomAuth.

   Afgesplitst van ./kosten.js toen dat bestand door de omvangsgrens ging, en de
   naad ligt op een echt verschil in LEZER. Daar staan de twee routes waarmee een
   gebruiker zijn EIGEN kosten ziet; hier staat het bord waarop een mens besluit
   wat een ander gaat betalen: tarieven, nota's, leveranciersfacturen, de
   maandafsluiting en het vrijgeven van de doorbelasting.

   ALLEEN DE BOARDROOM, en dat is geen voorzichtigheid. Een tarief bepaalt wat er
   op andermans rekening komt, en vrijgeven zet die rekening klaar. Dat is geen
   handeling voor een gewone kantoormedewerker; vandaar boardroomAuth en niet
   officeAuth.

   Gemount vanuit opzet/routes-dwars.js, met dezelfde domeingrens als ./kosten.js
   -- het is een lezer van dezelfde kern en niet een tweede domein. */
module.exports = (kern) => {
  const { app, boardroomAuth, boardroomWie, kosten } = kern;
  const eigenBeeld = require('./kosten-beeld')(kosten);

  const maand = (b) => {
    const p = String((b && b.periode) || '').trim();
    return /^\d{4}-\d{2}$/.test(p) ? p : kosten.periodeVan();
  };

  /* Het huisbeeld: wie kost wat, dekt het zichzelf, en klopt onze eigen
     optelsom met de nota's die we echt hebben betaald. Die laatste is de
     zelfcontrole en staat er met opzet in hetzelfde antwoord: een kostenbeeld
     zonder afstemming vertelt je niet dat het misschien de helft mist. */
  app.post('/api/office/kosten/overzicht', boardroomAuth, (req, res) => {
    const p = maand(req.body);
    res.json({ ok: true, periode: p, perioden: kosten.perioden(),
      gebruikers: kosten.alleDragers(p),
      dekking: kosten.dekkingHuis(p),
      afstemming: kosten.afstemming(p),
      verdeling: kosten.verdeling(p).regels,
      nietGemeten: kosten.nietGemeten(p),
      ontbreekt: { tarieven: kosten.ontbrekendeTarieven(), nota: kosten.ontbrekendeNota(p) } });
  });

  app.post('/api/office/kosten/gebruiker', boardroomAuth, (req, res) => {
    const drager = String((req.body || {}).drager || '').trim();
    if (!drager) return res.status(400).json({ error: 'Geen gebruiker opgegeven.' });
    res.json(eigenBeeld(drager, maand(req.body)));
  });

  app.post('/api/office/kosten/tarieven', boardroomAuth, (req, res) => {
    res.json({ ok: true, tarieven: kosten.tarieven(), soorten: kosten.SOORTEN, graden: kosten.GRAAD });
  });

  app.post('/api/office/kosten/tarief/zet', boardroomAuth, (req, res) => {
    const b = req.body || {};
    const r = kosten.tariefZet(b.soort, b.perEenheid, b.bron, boardroomWie(req), b.factuurId);
    res.status(r.status || 200).json(r);
  });

  app.post('/api/office/kosten/nota', boardroomAuth, (req, res) => {
    const p = maand(req.body);
    res.json({ ok: true, periode: p, posten: kosten.posten(p), ontbreekt: kosten.ontbrekendeNota(p) });
  });

  app.post('/api/office/kosten/nota/zet', boardroomAuth, (req, res) => {
    const b = req.body || {};
    const r = kosten.postZet(maand(b), b.soort, b.centen, b.bron, boardroomWie(req), b.factuurId);
    res.status(r.status || 200).json(r);
  });

  /* NU PEILEN. Opslag is een stand en geen stroom (KOSTEN.md): de
     onderhoudsronde peilt hem uit zichzelf, maar wie net iets heeft opgeruimd of
     een maand wil afsluiten, wil niet tot de volgende ronde wachten. De rem van
     een uur zit in de kern; deze knop mag hem overrulen, want een mens die
     bewust op "nu meten" drukt weet wat hij vraagt. */
  app.post('/api/office/kosten/peil', boardroomAuth, (req, res) => {
    res.json(Object.assign({ ok: true }, kosten.peilOpslag(true), { laatste: kosten.laatstePeiling() }));
  });

  /* DE FACTUREN VAN ONZE EIGEN LEVERANCIERS. Hier eindigt de herkomstketen: een
     tarief of een nota kan naar zo'n factuur verwijzen, en dan staat er geen
     ingetikte zin onder een bedrag maar een nummer dat je naast een
     bankafschrift kunt leggen. */
  app.post('/api/office/kosten/leveranciersfacturen', boardroomAuth, (req, res) => {
    const b = req.body || {};
    res.json({ ok: true, facturen: kosten.leveranciersfacturen(b.periode || null) });
  });

  app.post('/api/office/kosten/leveranciersfactuur/zet', boardroomAuth, (req, res) => {
    const b = req.body || {};
    const r = kosten.leveranciersfactuurZet({ leverancier: b.leverancier, nummer: b.nummer,
      periode: maand(b), centen: b.centen, omschrijving: b.omschrijving, door: boardroomWie(req) });
    res.status(r.status || 200).json(r);
  });

  /* De herkomst van EEN gebruiker. De tegenhanger voor een lid over zijn eigen
     regel staat in ./kosten.js; twee routes op een kern, want het antwoord hoort
     hetzelfde te zijn en alleen de vraag wie erom mag vragen verschilt. */
  app.post('/api/office/kosten/herkomst', boardroomAuth, (req, res) => {
    const b = req.body || {};
    const drager = String(b.drager || '').trim();
    if (!drager) return res.status(400).json({ error: 'Geen gebruiker opgegeven.' });
    const r = kosten.herkomst(maand(b), drager, b.soort);
    res.status(r.status || 200).json(r);
  });

  /* DE MAAND SLUITEN. Drie standen, en de middelste heeft tanden: een maand in
     onderzoek gaat niet naar de rekening van een lid. Zie kern/kosten/periode.js
     voor waarom een verklaring tekst is en geen vinkje. */
  app.post('/api/office/kosten/vooruitblik', boardroomAuth, (req, res) => {
    const b = req.body || {};
    res.json(Object.assign({ ok: true }, kosten.vooruitblik(maand(b), b.drager || null),
      { trefzekerheid: kosten.trefzekerheid() }));
  });

  app.post('/api/office/kosten/periode', boardroomAuth, (req, res) => {
    res.json(Object.assign({ ok: true }, kosten.periodeStand(maand(req.body))));
  });

  app.post('/api/office/kosten/periode/verklaar', boardroomAuth, (req, res) => {
    const b = req.body || {};
    const r = kosten.periodeVerklaar(maand(b), b.sleutel, b.tekst, boardroomWie(req));
    res.status(r.status || 200).json(r);
  });

  app.post('/api/office/kosten/periode/sluit', boardroomAuth, (req, res) => {
    const r = kosten.periodeSluit(maand(req.body), boardroomWie(req));
    res.status(r.status || 200).json(r);
  });

  app.post('/api/office/kosten/periode/heropen', boardroomAuth, (req, res) => {
    const b = req.body || {};
    const r = kosten.periodeHeropen(maand(b), b.reden, boardroomWie(req));
    res.status(r.status || 200).json(r);
  });

  /* HET KANTOORSLOT op de verbruiksgrens van een gebruiker (fair use). Apart van
     het slot dat een lid voor zichzelf zet: die twee betekenen iets anders, en
     de strengste wint. */
  app.post('/api/office/kosten/grens/zet', boardroomAuth, (req, res) => {
    const b = req.body || {};
    const drager = String(b.drager || '').trim();
    if (!drager) return res.status(400).json({ error: 'Geen gebruiker opgegeven.' });
    const r = kosten.grensZet(drager,
      { waarschuwCenten: b.waarschuwCenten, plafondCenten: b.plafondCenten }, 'kantoor', boardroomWie(req));
    res.status(r.status || 200).json(r);
  });

  app.post('/api/office/kosten/beleid', boardroomAuth, (req, res) => {
    res.json({ ok: true, beleid: kosten.beleid(), drempelCenten: kosten.DREMPEL_CENTEN });
  });

  app.post('/api/office/kosten/beleid/zet', boardroomAuth, (req, res) => {
    const b = req.body || {};
    const r = kosten.beleidZet(b.pas, b.stand, b.reden, boardroomWie(req));
    res.status(r.status || 200).json(r);
  });

  app.post('/api/office/kosten/voorstel', boardroomAuth, (req, res) => {
    res.json(Object.assign({ ok: true }, kosten.voorstel(maand(req.body))));
  });

  /* Vrijgeven: hier gaat er echt iets naar de rekening van een mens. Daarom een
     aparte route met een eigen handeling, de naam van wie het deed eronder, en
     één keer per maand. Dit is het moment waar GELD.md par. 3 over gaat: de
     machine zet klaar, een mens bevestigt. */
  app.post('/api/office/kosten/vrijgeven', boardroomAuth, (req, res) => {
    const r = kosten.vrijgeven(maand(req.body), boardroomWie(req));
    res.status(r.status || 200).json(r);
  });
};
