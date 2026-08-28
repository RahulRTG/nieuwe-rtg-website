/* Kern-module "vergeten": het recht op vergetelheid (AVG art. 17), op een plek.

   Dit stond eerst in de route, maar het is geen route-werk: het is BELEID. Welke
   takken meegaan, wat er wordt geanonimiseerd in plaats van gewist, en wat er
   met een reden mag blijven staan -- dat hoort als een leesbaar geheel bij
   elkaar, niet verspreid tussen het afhandelen van een verzoek.

   De vier soorten:

   1. WEG. Alles wat alleen over dit lid gaat: zijn voorkeuren, zijn spullen,
      zijn geheugen, zijn eigen Salon-posts. Dat staat in ./vergeten/eigen.js --
      als enige van de vier stond die soort hier nog los in de functie, en de
      lijst met takken was daar het onderwerp geworden in plaats van de gang van
      zaken.
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
  const { db, save, bijeen, accounts, sessions, forgetSession, fs, path, UPLOAD_DIR,
    broadcastSync, gidsWeg, liveCodename, media, bestanden } = kern;
  /* Het lidboard staat onder een eigen naam op de kern; alleen het wissen van
     het logboek is hier nodig. */
  const { lidBoardLogWis } = kern.lidboard || {};
  /* De vierde soort, en die stond hier niet: WAT ALLEEN ALS VERWIJZING IN
     db.data STAAT. De foto's, snaps, verhalen, site-beelden en kluisbestanden
     liggen als losse versleutelde bestanden op schijf; hier stond alleen het
     pad. Dat beleid staat in ./vergeten/bytes.js, met de uitleg erbij. Het
     werkt met een Set die hieronder wordt gevuld en aan het eind geleegd --
     verzamelen VOOR het weggooien, want daarna is de link weg. */
  const bytes = require('./vergeten/bytes')({ db, media, bestanden });
  // de identiteitsmap (paspoortscans en selfies): zie ../identiteitsmap.js
  const identiteitsmap = require('../identiteitsmap').maakIdentiteitsmap(UPLOAD_DIR);
  const anoniem = require('./vergeten/anoniem')({ db, accounts, spelVergeet: kern.spelVergeet });
  const { wisGesprekkenVan: wisGesprekken, wisSollicitatiechats } = require('./vergeten/gesprekken');
  const eigen = require('./vergeten/eigen')({ db, lidBoardLogWis });

  /* Wist dit lid definitief. Async omdat de mediastore ook een objectopslag op
     afstand kan zijn (S3); de aanroeper wacht erop voordat hij antwoordt --
     anders meldt het scherm "verwijderd" terwijl de foto's nog gaan. */
  async function wisLid(sessie) {
    const key = sessie.key;
    /* DE CODENAAM WORDT HIER GEPAKT, VOOR DE EERSTE VEEG. In de idempotentiering
       van betalen staat niet de sleutel maar de CODENAAM, en zodra de ledengids
       weg is (gidsWeg, verderop) is hij nergens meer op te halen. liveCodename
       neemt een SESSIE en geen sleutel -- dat is de tweede lijn onder
       sessie.codename, voor een sessie die hem niet zelf draagt. */
    let codenaam = sessie.codename || null;
    if (!codenaam && typeof liveCodename === 'function') {
      try { codenaam = liveCodename(sessie) || null; } catch (e) { codenaam = null; }
    }
    const teWissen = new Set();
    /* DE EERSTE SOORT: alles wat alleen over dit lid gaat -- zijn voorkeuren,
       zijn spullen, zijn geheugen, zijn eigen Salon-posts. De lijst met takken
       staat in ./vergeten/eigen.js; daar is de LIJST het onderwerp, en hier zou
       hij het bestand overheersen. */
    eigen.wisEigen(key, bytes.noteerPostBeelden, teWissen, codenaam);
    /* De gesprekken van de communicatiekern. De regel staat apart (./vergeten/
       gesprekken.js) omdat hij binnen deze functie niet los te toetsen was --
       en precies daardoor stond hij er eerst helemaal niet: de bezem liep groen
       over een database waar de berichten van het verwijderde lid nog in
       stonden. Zie de kop daar voor welke lezing van art. 17 hij volgt. */
    wisGesprekken(db, key);
    /* En de schakel van een sollicitatie: het record dat zegt wie er
       solliciteerde. Zie de opmerking bij wisSollicitatiechats(). */
    wisSollicitatiechats(db, key);
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
    /* Echt account: het account zelf weg, met de HELE identiteitsmap erbij.

       Hier stond `deleteUser` gevolgd door het unlinken van het ENE bestand dat
       de database nog onthield. Dat dekte de werkelijkheid niet:

       - elke upload schreef een nieuw bestand met een tijdstempel, terwijl
         id_doc telkens overschreven werd -- dus alle eerdere pogingen bleven
         als wees staan (en de afwijzingsmail raadt letterlijk aan het opnieuw
         te proberen met een duidelijkere foto, dus dat gebeurt);
       - de SELFIE stond in member_state, en die rij verdwijnt mee met het
         account -- dus na deleteUser was de naam niet meer te lezen en werd hij
         nooit gewist. Niet die ene, geen enkele.

       Het lid kreeg intussen "ok: true", en niets faalde. Precies de wees waar
       de kop van dit bestand en ./vergeten/bytes.js over gaan; voor de
       mediastore en de kluis is dat gat gedicht en voor de identiteitsmap
       overgeslagen.

       De map is nu zelf de administratie: alles wat <id>- heet gaat weg, wat de
       database er ook nog van weet. Vóór deleteUser, want daarna is het id nog
       wel bekend maar de rest niet meer -- en de volgorde kost niets: mislukt de
       verwijdering van het account, dan is een gewiste scan geen verlies maar
       precies wat het lid vroeg. */
    if (sessie.account) {
      try { identiteitsmap.wisAllesVan(sessie.account.id); } catch (e) {}
      accounts.deleteUser(sessie.account.id);
    }
    /* Het inzagejournaal blijft staan, bewust. Het bevat geen naam en geen
       e-mailadres -- alleen een account-id dat na deze regel nergens meer op
       slaat, plus wie er keek en waarom. Zou het wel worden gewist, dan kon
       iemand zijn eigen sporen uitvegen door een account te verwijderen, en dat
       is precies waarvoor een auditlog niet bedoeld is (AVG art. 17 lid 3
       laat bewaren toe waar dat voor een rechtsvordering of wettelijke plicht
       nodig is). Wat overblijft is de-geidentificeerd. */
    /* EN HET API-SPOOR. Dat bewaart per geslaagde schrijfhandeling WIE er
       handelde -- de sleutel, nooit een naam. Na een wissing hoort die sleutel
       daar niet meer te staan: de bezem van test/vergeten.test.js gaat door de
       hele database en rekent er terecht op af. De regels zelf blijven (wat er
       gebeurde en wanneer), de actor wordt "gewist", de keten wordt opnieuw
       gezegeld en er komt een regel bij die zegt dát er is herschreven, met de
       oude kop erin. Zo verdwijnt de persoon zonder dat het spoor stilletjes
       een ander verleden gaat vertellen. */
    if (kern.apiSpoor && kern.apiSpoor.wisActor) kern.apiSpoor.wisActor(key, 'recht op vergetelheid (AVG art. 17)');
    // alle sessies van dit lid uitloggen
    for (const [h, sess] of sessions) if (sess.key === key) forgetSession(h);
    /* EEN SUCCESANTWOORD BETEKENT HIER OOK: OP SCHIJF.

       De gewone save() is write-behind. Onder de volledige parallelle suite
       bleek daardoor dat /api/privacy/delete al 200 teruggaf terwijl db.json
       nog alle persoonsgegevens en zelfs het vakbewijs bevatte. Een losse
       wachttijd in de test maskeert die race; een herstart of backup kan hem in
       productie net zo goed raken.

       De bestaande duurzame bundel houdt save() het ene mutatiepunt en dwingt
       daarna de opslag af voordat wisLid terugkeert. Daarmee geldt voor een
       definitieve AVG-wissing dezelfde simpele waarheid als voor geld en eigen
       werk: bevestigd is vastgelegd. */
    await bijeen(() => { save(); }, { duurzaam: true });
    broadcastSync(['rtg', 'lifestyle', 'business'], 'salon');
    /* En dan pas de bytes. Ná save(), zodat een fout in de opslag (S3 even
       onbereikbaar) de administratieve wissing niet terugdraait: het lid is dan
       hoe dan ook weg uit de database, en wat er op de opslag achterblijft is
       een wees zonder verwijzing in plaats van een half verwijderd lid. */
    await bytes.wisMedia(teWissen);
  }

  return { wisLid };
};
