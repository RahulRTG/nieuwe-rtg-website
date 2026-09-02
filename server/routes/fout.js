/* De ingang voor fouten uit de browser (public/shared/foutmelder.js).

   Waarom deze route bestaat: een storing die alleen op het toestel van een
   gebruiker optreedt, was hier onzichtbaar. Er is drie keer een oorzaak
   aangewezen die achteraf niet de zijne was, simpelweg omdat er geen spoor was
   -- en de console van een telefoon vragen is geen diagnose maar een gunst.

   Bewust ZONDER auth. Een fout die het inloggen zelf sloopt is juist de fout
   die je wilt zien, en die komt nooit binnen achter een poort die inloggen
   vereist.

   SINDS RTG SERVICE WORDT ER WEL IETS BEWAARD, EN WEL PRECIES EEN DING: een
   teller per FOUT-VORM. Wat hier stond was "alleen gelogd", en dat was eerlijk
   maar nutteloos -- een fout die tienduizend keer optreedt zag er in het logboek
   uit als tienduizend losse regels, en er was geen enkele manier om te zien dat
   iemand die om hulp vraagt op een KAPOT scherm stond.

   Wat er nu gebeurt is groeperen op vingerafdruk (kern/service/foutsignaal.js),
   en dat is met opzet iets anders dan opslaan: er gaat geen codenaam, geen
   sessiesleutel en geen token in. Deze deur staat zonder inlog open, dus alles
   wat er binnenkomt is van een onbekende -- er wordt geteld hoe VAAK iets
   gebeurde en niet WIE het overkwam. Het logboek blijft daarnaast gewoon
   schrijven: dat is de diagnose, dit is de telling. */
module.exports = (kern) => {
  const { app, tooManyTries } = kern;
  /* LAAT GEBONDEN, en dat is geen stijl. Deze router wordt opgehangen VOOR
     kern/service bestaat; een `const { serviceFoutsignaal } = kern` hierboven
     bevriest dan een undefined, en de teller telt voor altijd niets zonder dat
     iets dat meldt. Dat is exact de stille breuk waar de doorkijk in
     opzet/domeingrens.js voor bestaat -- die leest elke keer opnieuw uit de
     echte kern, dus hier hoort de naam pas op aanroepmoment te worden gehaald. */
  const signaal = () => kern.serviceFoutsignaal || null;
  // log komt uit de module zelf: hij zit niet in de kern-bundel die routes krijgen
  const { log } = require('../log');

  /* DE GRENS VAN 4 kB STOND HIER, EN DEED NIETS. Er staat een globale
     express.json({limit:'8mb'}) voor alle routes (server/opzet/lijfpoort.js);
     tegen de tijd dat deze laag draait is het lichaam al geparsed, en een
     tweede json()-laag met een kleinere grens laat het gewoon door. De grens
     stond dus in de broncode en niet in het gedrag: twintig kilobyte kwam er
     zonder morren in. Voor een deur die met opzet ZONDER inlog openstaat is dat
     precies de verkeerde helft om alleen op papier te hebben.

     Nu op de lengte van het verzoek zelf, voor de rem en voor het loggen. */
  const MAX_LIJF = 4 * 1024;
  app.post('/api/fout/client', (req, res) => {
    const lang = Number(req.headers['content-length'] || 0);
    if (lang > MAX_LIJF) return res.status(413).json({ error: 'Een foutmelding past in 4 kB.' });
    // een kapot scherm meldt hooguit drie keer; wie meer stuurt is geen scherm
    if (tooManyTries && tooManyTries(res, 'clientfout:' + req.ip, 30, 60000)) return;
    const b = req.body || {};
    const kort = (v, n) => String(v == null ? '' : v).slice(0, n);
    /* Alleen deze velden, en afgekapt. Een foutmelding kan zelf bevatten wat
       iemand typte, dus hij gaat kort mee en nooit met het lichaam van een
       verzoek eraan. Geen token, geen codenaam, geen naam. */
    const gemeld = {
      soort: kort(b.soort, 20),
      melding: kort(b.melding, 300),
      bestand: kort(b.bestand, 80),
      regel: Number(b.regel) || 0,
      pad: kort(b.pad, 120)
    };
    log.warn('clientfout', Object.assign({}, gemeld, {
      ingelogd: b.ingelogd === true,
      ua: kort(req.headers['user-agent'], 120)
    }));
    /* En tellen. `ingelogd` en de user-agent gaan NIET mee: die staan in het
       logboek voor een diagnose, maar in een teller die blijft staan zijn ze
       een profiel in wording. De teller mag nooit de reden zijn dat deze route
       omvalt -- een kapot scherm dat zijn fout niet kwijt kan, is stiller dan
       een kapot scherm. */
    const sig = signaal();
    if (sig) {
      try { sig.meld(gemeld); }
      catch (e) { console.error('[fout] foutsignaal', e && e.message); }
    }
    res.status(204).end();
  });
};
