/* ============ De API van het communicatieplatform (kern/comm) ============

   EEN KOPPELVLAK VOOR ALLE COMMUNICATIE. Hier stond het niet: er waren een
   berichtenlijst, een DM-route in de sociale laag, een sollicitatiechat in de
   werk-app, een gastcontact bij de leverancier en een kamerroute bij Meet --
   vijf ingangen naar hetzelfde soort ding, elk met een eigen vorm.

   Deze routes zijn dun met opzet: ze doen de auth, geven de vraag door aan
   kern/comm en geven het antwoord terug. Alle regels (wie mag erin, hoe lang
   mag je wijzigen, wat is een geldige reactie) staan in de kern, want daar
   komt ook elke andere module langs. Een regel die alleen in een route staat,
   geldt niet voor de module die de kern rechtstreeks aanroept.

   En omdat alles over de gewone leden-auth loopt, kan Rahul deze routes via
   het stuur (kern/stuur.js) ook zelf aanroepen -- een goede route IS de
   AI-koppeling. Behalve versturen: opstellen mag de AI, versturen doet de
   mens. Zie /ai hieronder, dat levert tekst en plaatst niets.

   Gemount vanuit routes/member.js. */
const { veiligeFout } = require('../../kern/util');

module.exports = (kern) => {
  const { app, auth, geenGast, comm, commBronnen, commAi, zijnVrienden } = kern;
  if (!comm) return;
  const fout = (res, e) => res.status(400).json({ error: veiligeFout(e) });
  const mij = (req) => req.session.key;

  /* De inbox: alles wat van jou is, uit de kern EN uit de bronnen die nog in
     hun eigen module wonen (kern/comm/bronnen.js). Voor wie kijkt is dat een
     lijst; dat de ene helft hier woont en de andere daar, is een detail van
     nu en geen eigenschap van het ontwerp. */
  app.post('/api/comm/inbox', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try {
      comm.levensteken(mij(req));
      const eigen = comm.inbox(mij(req), { lade: req.body.lade, archief: !!req.body.archief });
      let extern = [];
      if (!req.body.archief && commBronnen) {
        extern = commBronnen.alles(mij(req), req.session.account);
        if (req.body.lade) extern = extern.filter((g) => g.lade === req.body.lade);
      }
      const alles = eigen.gesprekken.concat(extern)
        .sort((a, b) => (b.vast ? 1 : 0) - (a.vast ? 1 : 0) ||
          String(b.at || '').localeCompare(String(a.at || '')));
      res.json({ ok: true, gesprekken: alles, laden: eigen.laden,
        ongelezen: alles.reduce((n, g) => n + (g.ongelezen || 0), 0) });
    } catch (e) { fout(res, e); }
  });

  /* Een gesprek openen: de berichten, wie er typt, en de stand.

     EEN BRON OPENT NIET MEER, en dat is goed nieuws. Er stonden vier kanalen
     buiten de kern; het gastcontact en de sollicitatiechat zijn inmiddels echt
     verhuisd en komen hier gewoon als gesprek binnen. Wat overblijft in
     kern/comm/bronnen.js zijn twee LEESLIJSTEN -- de Berichtenbox van
     MijnOverheid en het doorlopende gesprek met Rahul -- en die hebben allebei
     een eigen scherm waar ze thuishoren. Vandaar dat open() daar null geeft en
     deze tak de lezer netjes doorstuurt in plaats van een leeg venster te
     tonen. */
  app.post('/api/comm/gesprek', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try {
      comm.levensteken(mij(req));
      const id = String(req.body.id || '');
      if (id.startsWith('bron:')) {
        const uit = commBronnen && commBronnen.open(mij(req), id, req.body.lang);
        if (!uit) throw new Error('Dit gesprek lees je in zijn eigen app.');
        const rij = (commBronnen.alles(mij(req), req.session.account) || []).find((g) => g.id === id) || {};
        return res.json({ ok: true, gesprek: Object.assign({}, rij, uit, { id, extern: true, typt: [] }) });
      }
      res.json({ ok: true, gesprek: comm.gesprek(mij(req), id, { aantal: req.body.aantal }) });
    } catch (e) { fout(res, e); }
  });

  /* Een gesprek beginnen met iemand. Alleen 1-op-1 en groepen: een gesprek met
     een SOORT (een rit, een bestelling, een ticket) hoort door de module te
     worden gemaakt die er verstand van heeft, niet door een scherm dat een
     soort in een verzoek zet.

     EN ALLEEN MET WIE JE AL KENT. Dit is de regel die deze route bijna niet
     had. De kern maakt een gesprek van elke lijst sleutels die hij krijgt --
     terecht, want een rit koppelt ook een chauffeur aan een reiziger die
     elkaar niet kennen, en dat is de bedoeling. Maar dan moet de POORT hier
     staan: zonder deze controle kon elk lid een gesprek openen met elke andere
     sleutel en daar berichten in zetten. Een ongevraagd gesprek is spam, en op
     een platform dat op codenaam draait is het erger dan dat -- het is een
     manier om te toetsen of een codenaam bestaat.

     De sociale laag weet wie met wie verbonden is (zijnVrienden); die vraag
     stellen we hier, en niet in de kern, omdat vriendschap iets van het
     sociale domein is en niet van het gespreksmodel. */
  app.post('/api/comm/begin', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try {
      const met = Array.isArray(req.body.met) ? req.body.met : [req.body.met];
      const anderen = [...new Set(met.filter(Boolean).map(String))].filter((k) => k !== mij(req));
      if (!anderen.length) throw new Error('Met wie?');
      if (!zijnVrienden) throw new Error('De sociale laag is niet beschikbaar.');
      for (const ander of anderen) {
        if (!zijnVrienden(mij(req), ander)) {
          throw new Error('Je bent nog niet verbonden met deze codenaam.');
        }
      }
      const g = anderen.length === 1
        ? comm.tussen(mij(req), anderen[0])
        : comm.gesprekMaak({ soort: 'group', deelnemers: [mij(req)].concat(anderen),
          titel: req.body.titel, door: mij(req) });
      res.json({ ok: true, gesprek: comm.gesprek(mij(req), g.id) });
    } catch (e) { fout(res, e); }
  });

  /* Versturen. Alleen voor gesprekken van de kern.

     HIER STOND EEN DOORGEEFLUIK, en dat was fout op twee manieren. Het riep
     app._router.handle() aan om het verzoek naar de route van de module te
     sturen -- een Express-truc, en dit huis heeft zijn eigen router
     (server/web/routing.js), dus het gaf een 500. Maar ook als het had
     gewerkt was het de verkeerde vorm: een route die een andere route naspeelt
     is een tweede plek waar je moet weten hoe die eerste heet en wat hij
     verwacht.

     Nu zegt /gesprek bij een bron gewoon WAAR je moet zijn (het veld
     `antwoord`), en de app post daar rechtstreeks naartoe. De module blijft de
     enige ingang op haar eigen voorraad, met al haar controles, en er is niets
     nagebouwd. */
  app.post('/api/comm/stuur', auth, (req, res) => {
    if (geenGast(req, res)) return;
    try {
      const id = String(req.body.id || '');
      if (id.startsWith('bron:')) {
        throw new Error('Dit kanaal heeft zijn eigen verstuurweg; open het gesprek opnieuw.');
      }
      comm.levensteken(mij(req));
      comm.bericht({ gesprekId: id, van: mij(req), tekst: req.body.tekst,
        antwoordOp: req.body.antwoordOp });
      res.json({ ok: true, gesprek: comm.gesprek(mij(req), id) });
    } catch (e) { fout(res, e); }
  });

  /* De standkant (wijzigen, wissen, reacties, lezen, vlaggen, concept, typen,
     de por, zoeken en @Rahul) staat in ./comm-stand.js -- hier aangeroepen op
     de plek waar die routes stonden. */
  require('./comm-stand')({ app, auth, geenGast, comm, commAi, fout, mij });
};
