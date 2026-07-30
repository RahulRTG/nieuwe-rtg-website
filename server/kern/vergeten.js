/* Kern-module "vergeten": het recht op vergetelheid (AVG art. 17), op een plek.

   Dit stond eerst in de route, maar het is geen route-werk: het is BELEID. Welke
   takken meegaan, wat er wordt geanonimiseerd in plaats van gewist, en wat er
   met een reden mag blijven staan -- dat hoort als een leesbaar geheel bij
   elkaar, niet verspreid tussen het afhandelen van een verzoek.

   De drie soorten die je hieronder tegenkomt:

   1. WEG. Alles wat alleen over dit lid gaat: zijn voorkeuren, zijn spullen,
      zijn geheugen, zijn eigen Salon-posts.
   2. DE PERSOON ERUIT, DE REST BLIJFT. Waar zijn spoor in het werk van een
      ander zit: een reactie in andermans draad, een DM die de helft van
      iemands gesprek is, de bel van een zaak, een cadeaukaart met geld erin.
   3. BLIJFT, MET GROND. De fiscale administratie en het inzagejournaal. Die
      staan met termijn en al in server/bewaartermijnen.js; een uitzondering die
      alleen in een test is afgevinkt, kan niemand navertellen.

   test/vergeten.test.js en test/vergeten-gezelschap.test.js vegen na afloop door
   de HELE database en rekenen af wat er nog van het lid in staat -- voor elke
   pas apart, want een Lifestyle-lid heeft takken die een RTG-lid niet heeft. */
module.exports = function maakVergeten(kern) {
  const { db, save, accounts, sessions, forgetSession, fs, path, UPLOAD_DIR,
    broadcastSync, gidsWeg, liveCodename, lidBoardLogWis } = kern;

  /* Wist dit lid definitief. Geeft niets terug; de aanroeper antwoordt. */
  function wisLid(sessie) {
    const key = sessie.key;
    // cv en live-locatie weg, chats weg, likes weg
    delete db.data.cvs[key];
    delete db.data.live[key];
    for (const k of Object.keys(db.data.guestChats || {})) if (k.split('|')[1] === key) delete db.data.guestChats[k];
    for (const p of db.data.posts) if (p.likedBy) delete p.likedBy[key];
    /* De eigen Salon-posts gaan WEG. Dat is de schoonste lezing van art. 17:
       het is de inhoud van dit lid en dit lid vraagt vergetelheid. De reacties
       van anderen eronder verdwijnen mee -- dat is de prijs, en die is bewust
       betaald: een post laten staan met "(verwijderd)" erboven bewaart nog
       steeds wat iemand schreef toen hij nog niet weg wilde. */
    if (Array.isArray(db.data.posts)) {
      db.data.posts = db.data.posts.filter(p => p.authorKey !== key);
    }
    /* Zijn REACTIES onder posts van anderen liggen anders: dat is de draad van
       iemand anders. Daar gaat alleen de persoon uit, niet het gesprek. */
    for (const p of db.data.posts || []) {
      for (const c of p.comments || []) {
        if (c.key === key) { c.key = null; c.who = '(verwijderd)'; }
      }
    }
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
      'accountRollen',      // uw koppelingen aan werkplekken
      'ledenBoard'          // uw eigen boardroom: wat u wel en niet deelt
    ]) { if (db.data[tak]) delete db.data[tak][key]; }
    /* En het journaal van die boardroom. Dat staat apart omdat het geen tak op
       de sleutel is maar een eigen lijst; het hoort er wel bij, want het legt
       vast WIE welke knop zette -- bij een kind is dat een ouder. Blijft het
       staan na "verwijder mijn gegevens", dan houden we een spoor van iemand
       die er niet meer is. */
    if (typeof lidBoardLogWis === 'function') lidBoardLogWis(key);
    /* De bel van de zaak. Daar staat na een bestelling of een cadeaukaart een
       regel als "<codenaam> kocht ...", en die codenaam is precies waarmee dit
       lid weer terug te vinden is. De zaak mag haar eigen administratie houden,
       dus we halen de regel niet weg maar de PERSOON eruit -- net zoals dat
       hierboven met sollicitaties gebeurt. */
    const cn = (function () { try { return liveCodename && liveCodename(sessie); } catch (e) { return null; } })();
    /* Het contactboek tussen de pas-niveaus (kern/lid.js): puur boekhouding,
       twee codenamen en verder niets. Daar valt niets aan te bewaren voor een
       ander, dus dat gaat gewoon weg. */
    if (cn && Array.isArray(db.data.contacts)) {
      db.data.contacts = db.data.contacts.filter(c => c.higher !== cn && c.rtg !== cn);
    }
    /* Een DM is de helft van andermans gesprek. Die ander mag zijn eigen verkeer
       houden; hij hoeft alleen niet meer te weten met wie. Dus blijft het
       bericht staan en verdwijnt de naam aan beide kanten. */
    if (cn && Array.isArray(db.data.dms)) {
      for (const d of db.data.dms) {
        if (d.from === cn) d.from = '(verwijderd)';
        if (d.to === cn) d.to = '(verwijderd)';
      }
    }
    /* En zijn reacties met alleen een codenaam (de oudere vorm zonder sleutel). */
    if (cn) {
      for (const p of db.data.posts || []) {
        for (const c of p.comments || []) if (c.who === cn) c.who = '(verwijderd)';
      }
    }
    /* Het aanmeldingsdossier: RTG houdt het besluit (wie zei ja tegen welke pas,
       en wanneer), want dat is haar eigen administratie van een menselijke
       beslissing. De AANVRAGER gaat eruit, net als bij sollicitaties. */
    for (const a of db.data.aanmeldingen || []) {
      const raakt = (a.userId != null && key === 'user-' + a.userId) ||
        (cn && a.codenaam === cn) || (a.contact && sessie.account &&
          String(a.contact).toLowerCase() === String(accounts.emailOf(sessie.account) || '').toLowerCase());
      if (raakt) { a.naam = '(op verzoek verwijderd)'; a.contact = ''; a.codenaam = null; a.userId = null; }
    }
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
    if (sessie.account) {
      const doc = accounts.deleteUser(sessie.account.id);
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
  }

  return { wisLid };
};
