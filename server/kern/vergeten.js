/* Kern-module "vergeten": het recht op vergetelheid (AVG art. 17), op een plek.

   Dit stond eerst in de route, maar het is geen route-werk: het is BELEID. Welke
   takken meegaan, wat er wordt geanonimiseerd in plaats van gewist, en wat er
   met een reden mag blijven staan -- dat hoort als een leesbaar geheel bij
   elkaar, niet verspreid tussen het afhandelen van een verzoek.

   De soorten, elk in een eigen deelbestand onder ./vergeten/:

   1. WEG (eigen.js). Alles wat alleen over dit lid gaat: zijn voorkeuren,
      zijn spullen, zijn geheugen, zijn eigen Salon-posts.
   2. DE PERSOON ERUIT, DE REST BLIJFT (anoniem.js). Waar zijn spoor in het
      werk van een ander zit: een reactie in andermans draad, een DM die de
      helft van iemands gesprek is, de bel van een zaak, een cadeaukaart.
   3. BLIJFT, MET GROND. De fiscale administratie en het inzagejournaal, met
      termijn en al in server/bewaartermijnen.js.
   4. DE BYTES BUITEN DE DATABASE (bytes.js). Foto's, snaps, verhalen,
      site-beelden en kluisbestanden liggen als losse versleutelde bestanden
      op schijf; een weggehaald pad met een blijvend bestand is een wees die
      wij nog kunnen openen.
   5. DE POSITIE IN EEN DOMEIN MET EEN EIGEN DEUR (positie.js). Een rit, een
      SOS, een bezorgpunt: het domein wist, deze route vraagt het.
   En als laatste het account zelf, met de identiteitsmap (account.js).

   test/vergeten.test.js en test/vergeten-gezelschap.test.js vegen na afloop door
   de HELE database en rekenen af wat er nog van het lid in staat -- voor elke
   pas apart, want een Lifestyle-lid heeft takken die een RTG-lid niet heeft. */
module.exports = function maakVergeten(kern) {
  const { db, save, bijeen, accounts, sessions, forgetSession, fs, path, UPLOAD_DIR,
    broadcastSync, gidsWeg, liveCodename, media, bestanden } = kern;
  /* Het lidboard staat onder een eigen naam op de kern; alleen het wissen van
     het logboek is hier nodig. */
  const { lidBoardLogWis } = kern.lidboard || {};
  /* De bytes werken met een Set die hieronder wordt gevuld en aan het eind
     geleegd -- verzamelen VOOR het weggooien, want daarna is de link weg. */
  const bytes = require('./vergeten/bytes')({ db, media, bestanden });
  // het account en de identiteitsmap (paspoortscans en selfies)
  const account = require('./vergeten/account')({ kern, accounts, UPLOAD_DIR });
  // de positie van dit lid in de domeinen met een eigen deur
  const positie = require('./vergeten/positie')(kern);
  const anoniem = require('./vergeten/anoniem')({ db, accounts, spelVergeet: kern.spelVergeet });
  const { wisGesprekkenVan: wisGesprekken, wisSollicitatiechats } = require('./vergeten/gesprekken');
  const eigen = require('./vergeten/eigen')({ db, lidBoardLogWis });
  const aanwezigheid = require('./aanwezigheid');
  const pasgeschiedenis = require('./pasgeschiedenis');

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
    /* EERST DE POSITIES (./vergeten/positie.js): die vragen een domein om te
       wissen, en ontbreekt er een, dan faalt dit vóór de rest van de wissing. */
    positie.wisPosities(key, codenaam);
    const teWissen = new Set();
    /* DE EERSTE SOORT: alles wat alleen over dit lid gaat -- zijn voorkeuren,
       zijn spullen, zijn geheugen, zijn eigen Salon-posts. De lijst met takken
       staat in ./vergeten/eigen.js; daar is de LIJST het onderwerp, en hier zou
       hij het bestand overheersen. */
    eigen.wisEigen(key, bytes.noteerPostBeelden, teWissen, codenaam);
    /* De twee bronnen onder de bedrijfsmaten (AUTONOMIE.md): de bezoekdag gaat
       weg, de pasovergangen verliezen hun codenaam. Waarom die twee verschillen
       staat bij `vergeet` in elk van beide. */
    if (codenaam) { aanwezigheid.vergeet(codenaam); pasgeschiedenis.vergeet(codenaam); }
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
    /* Het account zelf, met het gezin eraan en de HELE identiteitsmap erbij
       (paspoortscans en selfies): ./vergeten/account.js, met het waarom van de
       volgorde en van het inzagejournaal dat bewust blijft staan. */
    account.wisAccount(sessie);
    /* EN HET API-SPOOR. Dat bewaart per schrijfhandeling WIE er handelde (de
       sleutel, nooit een naam); de bezem van test/vergeten.test.js rekent erop
       af als die blijft staan. De regels blijven, de actor wordt "gewist", de
       keten wordt opnieuw gezegeld en een regel zegt dat er is herschreven, met
       de oude kop erin: de persoon verdwijnt zonder dat het spoor een ander
       verleden vertelt. */
    // het externe anker: eerst de herzegeling tekenen (./vergeten-anker.js)
    const reden = 'recht op vergetelheid (AVG art. 17)';
    const herzegeling = require('./vergeten-anker').voor(kern, key, sessie, reden);
    if (kern.apiSpoor && kern.apiSpoor.wisActor) kern.apiSpoor.wisActor(key, reden);
    /* EN HET SESSIEREGISTER VAN MIJN RTG. Dat is iets anders dan de sessies die
       hieronder worden uitgelogd: forgetSession raakt de Map met tokens, dit
       register houdt de CONTEXT per sessie (waar, met welk toestel, hoe zeker)
       en overleeft het token met opzet. Zonder deze regel bleef de sleutel van
       het lid daar staan -- de bezem van test/vergeten-gezelschap.test.js vond
       hem terug als tak `sessiecontext (sleutel)`.

       De functie woont in het register zelf en niet hier, om twee redenen: die
       module BEZIT de collectie (kern/eigencollectie), en wissen moet kijken
       naar wat er staat in plaats van naar wat vanLid() nog toont -- die filtert
       op een TTL van dertig dagen, en juist de oudste rij is de rij die het
       langst blijft liggen. */
    if (kern.sessieregister && kern.sessieregister.wisLid) kern.sessieregister.wisLid(key);
    /* DemocratieOS: de kwesties blijven, de weg van het inbrengersnummer naar de mens niet. */
    if (kern.democratieVergeet) kern.democratieVergeet(key);
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
    await require('./vergeten-anker').naar(kern, herzegeling);
    /* En dan pas de bytes. Ná save(), zodat een fout in de opslag (S3 even
       onbereikbaar) de administratieve wissing niet terugdraait: het lid is dan
       hoe dan ook weg uit de database, en wat er op de opslag achterblijft is
       een wees zonder verwijzing in plaats van een half verwijderd lid. */
    await bytes.wisMedia(teWissen);
  }

  return { wisLid };
};
