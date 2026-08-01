/* Kern-module "vergeten": het recht op vergetelheid (AVG art. 17), op een plek.

   Dit stond eerst in de route, maar het is geen route-werk: het is BELEID. Welke
   takken meegaan, wat er wordt geanonimiseerd in plaats van gewist, en wat er
   met een reden mag blijven staan -- dat hoort als een leesbaar geheel bij
   elkaar, niet verspreid tussen het afhandelen van een verzoek.

   De vier soorten:

   1. WEG. Alles wat alleen over dit lid gaat: zijn voorkeuren, zijn spullen,
      zijn geheugen, zijn eigen Salon-posts. Dat staat hieronder.
   2. DE PERSOON ERUIT, DE REST BLIJFT. Waar zijn spoor in het werk van een
      ander zit: een reactie in andermans draad, een DM die de helft van
      iemands gesprek is, de bel van een zaak, een cadeaukaart met geld erin.
      Dat staat in ./vergeten/anoniem.js.
   3. BLIJFT, MET GROND. De fiscale administratie en het inzagejournaal. Die
      staan met termijn en al in server/bewaartermijnen.js; een uitzondering die
      alleen in een test is afgevinkt, kan niemand navertellen.
   4. DE BYTES BUITEN DE DATABASE, en die soort ontbrak. Foto's, snaps,
      verhalen, site-beelden en kluisbestanden liggen als losse versleutelde
      bestanden op schijf of in de objectopslag; in db.data staat alleen het
      pad. Dit beleid haalde het pad weg en liet het bestand staan -- een wees
      die wij nog gewoon kunnen openen, en bij RTG Bestanden gaat dat over
      paspoortscans, contracten en medische brieven. Dat staat nu in
      ./vergeten/bytes.js.

   test/vergeten.test.js en test/vergeten-gezelschap.test.js vegen na afloop door
   de HELE database en rekenen af wat er nog van het lid in staat -- voor elke
   pas apart, want een Lifestyle-lid heeft takken die een RTG-lid niet heeft. */
module.exports = function maakVergeten(kern) {
  const { db, save, accounts, sessions, forgetSession, fs, path, UPLOAD_DIR,
    broadcastSync, gidsWeg, liveCodename, lidBoardLogWis, media, bestanden } = kern;
  /* De vierde soort, en die stond hier niet: WAT ALLEEN ALS VERWIJZING IN
     db.data STAAT. De foto's, snaps, verhalen, site-beelden en kluisbestanden
     liggen als losse versleutelde bestanden op schijf; hier stond alleen het
     pad. Dat beleid staat in ./vergeten/bytes.js, met de uitleg erbij. Het
     werkt met een Set die hieronder wordt gevuld en aan het eind geleegd --
     verzamelen VOOR het weggooien, want daarna is de link weg. */
  const bytes = require('./vergeten/bytes')({ db, media, bestanden });
  const anoniem = require('./vergeten/anoniem')({ db, accounts });

  /* Wist dit lid definitief. Async omdat de mediastore ook een objectopslag op
     afstand kan zijn (S3); de aanroeper wacht erop voordat hij antwoordt --
     anders meldt het scherm "verwijderd" terwijl de foto's nog gaan. */
  async function wisLid(sessie) {
    const key = sessie.key;
    const teWissen = new Set();
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
      // eerst de beelden van die posts noteren, anders zijn ze na de filter
      // niet meer terug te vinden en blijven ze als wees op schijf staan
      bytes.noteerPostBeelden(key, teWissen);
      db.data.posts = db.data.posts.filter(p => p.authorKey !== key);
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
    /* En dan de tweede soort: alles waar het spoor van dit lid in het werk van
       een ANDER zit -- reacties onder andermans post, sollicitaties, DM's, het
       aanmeldingsdossier, cadeaukaarten, de bel van de zaak. Daar gaat de
       persoon eruit en blijft de rest staan. Het oordeel per geval staat bij
       dat geval in ./vergeten/anoniem.js. */
    const cn = (function () { try { return liveCodename && liveCodename(sessie); } catch (e) { return null; } })();
    anoniem.anonimiseer(key, cn, sessie);
    /* De snaps en verhalen, de eigen sites, en de kluis. Alle drie dragen bytes
       buiten db.data; het waarom staat bij elk van hen in ./vergeten/bytes.js. */
    bytes.wisSnapsEnVerhalen(key, teWissen);
    bytes.wisSites(key, teWissen);
    bytes.wisKluis(key);
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
    /* En dan pas de bytes. Ná save(), zodat een fout in de opslag (S3 even
       onbereikbaar) de administratieve wissing niet terugdraait: het lid is dan
       hoe dan ook weg uit de database, en wat er op de opslag achterblijft is
       een wees zonder verwijzing in plaats van een half verwijderd lid. */
    await bytes.wisMedia(teWissen);
  }

  return { wisLid };
};
