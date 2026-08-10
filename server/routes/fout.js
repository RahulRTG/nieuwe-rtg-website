/* De ingang voor fouten uit de browser (public/shared/foutmelder.js).

   Waarom deze route bestaat: een storing die alleen op het toestel van een
   gebruiker optreedt, was hier onzichtbaar. Er is drie keer een oorzaak
   aangewezen die achteraf niet de zijne was, simpelweg omdat er geen spoor was
   -- en de console van een telefoon vragen is geen diagnose maar een gunst.

   Bewust ZONDER auth. Een fout die het inloggen zelf sloopt is juist de fout
   die je wilt zien, en die komt nooit binnen achter een poort die inloggen
   vereist. Wat er tegenover staat: er wordt niets bewaard en niets uitgevoerd,
   alleen gelogd, en de rem hieronder houdt het klein. */
module.exports = (kern) => {
  const { app, tooManyTries } = kern;
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
    log.warn('clientfout', {
      soort: kort(b.soort, 20),
      melding: kort(b.melding, 300),
      bestand: kort(b.bestand, 80),
      regel: Number(b.regel) || 0,
      pad: kort(b.pad, 120),
      ingelogd: b.ingelogd === true,
      ua: kort(req.headers['user-agent'], 120)
    });
    res.status(204).end();
  });
};
