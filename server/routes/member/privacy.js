/* Member-submodule: de AVG-rechten. Het volledige dossier downloaden
   (inzagerecht, onder de codenaam) en definitief verwijderen (vergetelheid):
   cv, chats, likes, live-locatie en account inclusief geupload document;
   sollicitaties worden geanonimiseerd en alle sessies uitgelogd.
   Gemount vanuit routes/member.js. */
const inzagelog = require('../../inzagelog');
const maakVergeten = require('../../kern/vergeten');

module.exports = (kern) => {
  const { app, auth, db, stateFor, myApplications, ordersVanKlant, commGast } = kern;
  const { lidBoard, lidBoardLog } = kern.lidboard;
  const { wisLid } = maakVergeten(kern);

  app.post('/api/privacy/export', auth, (req, res) => {
    if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
    const key = req.session.key;
    /* De gastgesprekken komen sinds de verhuizing uit de communicatiekern
       (kern/comm/gast.js) en niet meer rechtstreeks uit db.data.guestChats.

       DIT IS DE PLEK WAAR DIE VERHUIZING HET MEEST KOST ALS HIJ MIST. Een
       uitvoer is een RECHT -- "wat heeft u van mij" -- en een leeg antwoord
       ziet er niet fout uit: het lijkt gewoon alsof er niets was. Vandaar dat
       voorLid() zijn eigen oude voorraad eerst binnenhaalt en de toets ervoor
       (test/comm-gast.test.js) de dag van de verhuizing nabootst. */
    const chats = commGast ? commGast.voorLid(key) : {};
    const likes = db.data.posts.filter(p => p.likedBy && p.likedBy[key]).map(p => ({ postId: p.id, author: p.author }));
    const state = stateFor(req.session, req.body.lang);
    res.json({
      exportedAt: new Date().toISOString(),
      note: 'Alle gegevens die RTG over u bewaart, onder uw codenaam (pseudonimisering).',
      profile: state.user,
      cv: db.data.cvs[key] || null,
      applications: myApplications(key),
      invoices: state.invoices || [],
      trip: state.trip || null,
      live: db.data.live[key] || null,
      orders: ordersVanKlant(key),
      guestChats: chats,
      likedPosts: likes,
      notifications: db.data.notifications[key] || [],
      /* Uw boardroom hoort in dit dossier. Die knoppen bepalen of uw locatie
         gedeeld wordt, of uw paspoort opvraagbaar is en of u vindbaar bent:
         dat is niet zomaar een voorkeur, dat is de instelling waarmee u uw
         eigen gegevensdeling regelt. Het journaal erbij, want anders zou een
         export wel de huidige stand tonen maar niet wie hem heeft gezet -- en
         bij een kind is dat een ouder. */
      boardroom: typeof lidBoard === 'function' ? lidBoard(key) : null,
      boardroomLogboek: typeof lidBoardLog === 'function' ? lidBoardLog(key, 200) : [],
      // wie er in uw identiteitsdossier heeft gekeken, en waarom
      inzageInUwDossier: req.session.account ? inzagelog.voorBetrokkene(req.session.account.id) : []
    });
  });

  /* "Wie heeft er in mijn dossier gekeken?" -- het inzagerecht dat verder gaat
     dan een kopie van je eigen gegevens (AVG art. 15 lid 1 sub c). Elke keer
     dat iemand bij RTG de echte naam achter een codenaam opvraagt, staat dat in
     het inzagejournaal; hier kan de betrokkene dat zelf teruglezen.

     Zonder de naam van de kijker: dat is de persoonsdata van een ander, en die
     komt niet automatisch vrij omdat een lid vraagt. Wel de reden, het scherm
     en het moment -- dat is waar de vraag over gaat. Wie de persoon achter een
     regel wil weten, vraagt dat via RTG, en dan kijkt een mens ernaar. */
  app.post('/api/privacy/inzage', auth, (req, res) => {
    if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
    if (!req.session.account) return res.json({ inzage: [], note: 'Dit is een demoprofiel zonder accountdossier.' });
    res.json({
      inzage: inzagelog.voorBetrokkene(req.session.account.id),
      note: 'Elke keer dat iemand bij RTG uw echte naam achter uw codenaam opvroeg. Leeg is goed nieuws: dan is er niemand in uw dossier geweest.'
    });
  });

  /* Definitief verwijderen. Het beleid (welke takken weg, wat wordt
     geanonimiseerd, wat blijft met grond) woont in kern/vergeten.js. */
  app.post('/api/privacy/delete', auth, async (req, res) => {
    if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
    // await: sinds de bytes (mediastore, kluis) meegaan is dit ook I/O, en de
    // bevestiging hoort pas te komen als het echt gebeurd is
    await wisLid(req.session);
    res.json({ ok: true });
  });
};
