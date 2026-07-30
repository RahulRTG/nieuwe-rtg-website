/* Member-submodule: de AVG-rechten. Het volledige dossier downloaden
   (inzagerecht, onder de codenaam) en definitief verwijderen (vergetelheid):
   cv, chats, likes, live-locatie en account inclusief geupload document;
   sollicitaties worden geanonimiseerd en alle sessies uitgelogd.
   Gemount vanuit routes/member.js. */
const inzagelog = require('../../inzagelog');

module.exports = (kern) => {
  const { app, auth, db, save, stateFor, myApplications, ordersVanKlant, accounts,
    sessions, forgetSession, fs, path, UPLOAD_DIR, broadcastSync, gidsWeg, liveCodename } = kern;

  app.post('/api/privacy/export', auth, (req, res) => {
    if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
    const key = req.session.key;
    const chats = {};
    for (const [k, msgs] of Object.entries(db.data.guestChats || {})) {
      if (k.split('|')[1] === key) chats[k] = msgs;
    }
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

  app.post('/api/privacy/delete', auth, (req, res) => {
    if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
    const key = req.session.key;
    // cv en live-locatie weg, chats weg, likes weg
    delete db.data.cvs[key];
    delete db.data.live[key];
    for (const k of Object.keys(db.data.guestChats || {})) if (k.split('|')[1] === key) delete db.data.guestChats[k];
    for (const p of db.data.posts) if (p.likedBy) delete p.likedBy[key];
    // sollicitaties anonimiseren: het bedrijf houdt zijn administratie,
    // maar zonder iets dat naar deze persoon herleidbaar is
    for (const list of Object.values(db.data.applications || {})) {
      for (const a of list) if (a.key === key) {
        a.name = '(op verzoek verwijderd)'; a.contact = ''; a.note = '';
        a.cv = null; a.codename = null; a.key = null;
      }
    }
    // meldingen weg (bij demo-profielen is dit de gedeelde demo-bel)
    if (db.data.notifications[key]) db.data.notifications[key] = [];
    /* En wat Rahul van u weet. Dit stond hier niet, en dat viel niemand op: de
       bezem in test/vergeten.test.js veegt wel door de hele database, maar het
       proeflid praatte nooit met Rahul, dus die tak werd nooit aangemaakt.
       Wat er in staat is precies het soort ding waarvoor art. 17 bestaat: de
       weetjes die u zelf deelde, de laatste beurten van uw gesprek en waar u
       het meest mee werkt. "vergeet alles" in de chat wiste het al; verwijderen
       hoort minstens net zo grondig te zijn als dat. */
    /* Alles wat rechtstreeks onder de sleutel van dit lid staat. Als lijst, niet
       als losse regels: zo is in een oogopslag te zien welke takken meegaan, en
       is er een plek om er een bij te zetten. Elke naam hier is een tak die
       ALLEEN over dit lid gaat -- zijn voorkeuren, zijn spullen, zijn geheugen.
       De bezem in test/vergeten.test.js bewaakt dat de lijst compleet blijft. */
    for (const tak of [
      'fluister',           // wat Rahul van u weet: weetjes, gesprek, gebruik
      'rahulRespect',       // de teller van de pestgrens
      'favorieten',         // uw adressen
      'zorgProfielen',      // allergieen en dieet: bijzondere persoonsgegevens
      'memberTaal',         // uw taalkeuze
      'wallet',             // uw passen, tickets en sleutels
      'punten',             // uw spaarsaldo (zonder account niet meer te besteden)
      'appInstallaties', 'reisInstallaties', 'rijksInstallaties',  // wat u installeerde
      'clipsVolg',          // wie u volgt
      'lifestyle',          // uw rechterhand-voorkeuren
      'ontmoetVoorkeur', 'ontmoetPosities',   // Salon-ontmoetingen en uw positie daarin
      'accountRollen'       // uw koppelingen aan werkplekken
    ]) { if (db.data[tak]) delete db.data[tak][key]; }
    /* De bel van de zaak. Daar staat na een bestelling of een cadeaukaart een
       regel als "<codenaam> kocht ...", en die codenaam is precies waarmee dit
       lid weer terug te vinden is. De zaak mag haar eigen administratie houden,
       dus we halen de regel niet weg maar de PERSOON eruit -- net zoals dat
       hierboven met sollicitaties gebeurt. */
    const cn = (function () { try { return liveCodename && liveCodename(req.session); } catch (e) { return null; } })();
    /* Cadeaukaarten zijn een geval apart: daar zit geld in dat de zaak nog moet
       honoreren, dus die vernietigen zou iets weggooien wat niet van ons is. De
       kaart blijft dus geldig; alleen de KOPER verdwijnt eruit. */
    for (const g of db.data.giftcards || []) {
      if (g.customerKey === key) { g.customerKey = null; g.kocht = '(verwijderd)'; }
    }
    if (cn && db.data.supplierNotifications) {
      for (const lijst of Object.values(db.data.supplierNotifications)) {
        for (const n of lijst || []) {
          for (const veld of ['title', 'body']) {
            if (typeof n[veld] === 'string' && n[veld].includes(cn)) n[veld] = n[veld].split(cn).join('(verwijderd)');
          }
        }
      }
    }
    /* Uit de ledengids. Dit is de laatste plek waar de sleutel aan de codenaam
       vastzit; bleef hij staan, dan was het lid na "verwijderen" nog gewoon op
       codenaam te vinden en te bellen -- en dan is verwijderd een halve
       waarheid. test/vergeten.test.js veegt na afloop door de hele database om
       te controleren dat er geen enkele tak meer overblijft. */
    if (typeof gidsWeg === 'function') gidsWeg(key);
    // echt account: verwijder het account zelf, inclusief documentupload
    if (req.session.account) {
      const doc = accounts.deleteUser(req.session.account.id);
      if (doc) { try { fs.unlinkSync(path.join(UPLOAD_DIR, path.basename(doc))); } catch (e) {} }
    }
    /* Het inzagejournaal blijft staan, bewust. Het bevat geen naam en geen
       e-mailadres -- alleen een account-id dat na deze regel nergens meer op
       slaat, plus wie er keek en waarom. Zou het wel worden gewist, dan kon
       iemand zijn eigen sporen uitvegen door een account te verwijderen, en dat
       is precies waarvoor een auditlog niet bedoeld is (AVG art. 17 lid 3
       laat bewaren toe waar dat voor een rechtsvordering of wettelijke plicht
       nodig is). Wat overblijft is de-geidentificeerd. */
    // alle sessies van dit lid uitloggen
    for (const [h, sess] of sessions) if (sess.key === key) forgetSession(h);
    save();
    broadcastSync(['rtg', 'lifestyle', 'business'], 'salon');
    res.json({ ok: true });
  });
};
