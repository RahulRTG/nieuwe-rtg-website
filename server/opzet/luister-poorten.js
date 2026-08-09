/* DE MAILPOORTEN die naast de site staan. Afgesplitst van ./luister.js.

   Twee deuren, en ze hebben drie dingen gemeen:

     ze staan UIT     tenzij IMAP_POORT of MAIL_IN_POORT is gezet. Een mailpoort
                      die vanzelf openstaat op elke machine waar dit draait, is
                      een deur die niemand heeft besloten open te zetten.
     ze binden lokaal tenzij je een host meegeeft. Naar buiten wijzen is een
                      besluit, geen standaard.
     ze mogen vallen  zonder de site mee te nemen. Een mailpoort die niet
                      opengaat is vervelend; een site die daardoor niet start,
                      is erger.

   WAT ZE NIET GEMEEN HEBBEN: hun kant op. IMAP laat een client MEELEZEN met wat
   er al ligt; SMTP NEEMT POST AAN van vreemde servers. Die tweede is de kant
   waar het misgaat als je niet oplet, en daarom staat de weigering daar vooraan:
   geen bekend postvak, geen post (server/smtp-in.js). */
'use strict';

module.exports = (kern) => {
  const fs = require('fs');

  /* IMAP: een externe mailclient laten meelezen (server/imap.js). Staat UIT
     tenzij IMAP_POORT is gezet, en dat is met opzet: een mailpoort die vanzelf
     openstaat op elke machine waar dit draait, is een deur die niemand heeft
     besloten open te zetten. Zonder TLS-sleutel praat hij plat, en dan hoort hij
     alleen achter een eigen doorgeefluik -- er wordt niet gedaan alsof dat
     veilig is. */
  if (process.env.IMAP_POORT) {
    try {
      
      const tlsOpties = process.env.IMAP_KEY && process.env.IMAP_CERT
        ? { key: fs.readFileSync(process.env.IMAP_KEY), cert: fs.readFileSync(process.env.IMAP_CERT) } : null;
      require('../imap-server')({ vak: kern.rtmailVak, rtmail: kern.rtmail, sleutels: kern.mailSleutel,
        poort: Number(process.env.IMAP_POORT), host: process.env.IMAP_HOST || '127.0.0.1', tlsOpties })
        .start().then(() => console.log('[imap] luistert op ' + (process.env.IMAP_HOST || '127.0.0.1') + ':' +
          process.env.IMAP_POORT + (tlsOpties ? ' (TLS)' : ' -- PLAT, zet er een doorgeefluik met TLS voor')));
    } catch (e) { console.warn('[imap] niet gestart:', e && e.message); }
  }

  /* SMTP ONTVANGEN (server/smtp-in.js): post van buiten aannemen. Staat UIT
     tenzij MAIL_IN_POORT is gezet -- zelfde regel als IMAP hierboven, en om
     dezelfde reden: een mailpoort die vanzelf openstaat op elke machine waar dit
     draait, is een deur die niemand heeft besloten open te zetten.

     WAAROM DIT ER IS. Dit huis kon post versturen en een client kon meelezen,
     maar er nam niets post AAN. Alles van buiten moest via /api/mail/binnen, en
     dus kwam er in de praktijk niets binnen tenzij er met de hand een relay voor
     stond. Nu kan hij het zelf.

     POORT 25 VRAAGT RECHTEN. Onder de 1024 luisteren mag een gewoon proces niet;
     draai met CAP_NET_BIND_SERVICE, of zet hem op 2525 met een doorstuurregel
     ervoor. Mislukt het luisteren, dan zegt hij dat en draait de rest gewoon
     door -- een mailpoort die niet opengaat, mag de site niet meenemen. */
  if (process.env.MAIL_IN_POORT) {
    try {
      const mHost = process.env.MAIL_IN_HOST || '127.0.0.1';
      /* STARTTLS: eigen sleutel als die er is, anders DIE VAN DE SITE.

         Zonder deze terugval was versleuteld het geval waarin je twee extra
         variabelen had gezet, en plat het geval waarin je niets deed -- op een
         machine die allang een certificaat heeft voor haar eigen site. Dat is de
         verkeerde standaard: op poort 25 is TLS opportunistisch, de verzendende
         kant gebruikt hem als hij wordt aangeboden en controleert de naam meestal
         niet. Een certificaat dat niet exact bij het mailadres hoort is daar dus
         nog altijd veel beter dan geen.

         Wat hij NIET doet: er zelf een aanmaken. Een mailpoort die als bijwerking
         een sleutelpaar op schijf zet, doet iets wat niemand heeft gevraagd. */
      let tlsOpties = null;
      if (process.env.MAIL_IN_KEY && process.env.MAIL_IN_CERT) {
        tlsOpties = { key: fs.readFileSync(process.env.MAIL_IN_KEY), cert: fs.readFileSync(process.env.MAIL_IN_CERT) };
      } else if (process.env.RTG_TLS_KEY && process.env.RTG_TLS_CERT) {
        try {
          tlsOpties = { key: fs.readFileSync(process.env.RTG_TLS_KEY), cert: fs.readFileSync(process.env.RTG_TLS_CERT) };
        } catch (e) { tlsOpties = null; }
      }
      require('../smtp-in-server')({ aanname: kern.mailAanname, naam: process.env.MAIL_DOMEIN || 'rtg-mail',
        poort: Number(process.env.MAIL_IN_POORT), host: mHost, tlsOpties })
        .start().then(() => console.log('[smtp-in] neemt post aan op ' + mHost + ':' + process.env.MAIL_IN_POORT +
          (tlsOpties ? ' (STARTTLS beschikbaar)' : ' -- ZONDER STARTTLS, dus alles gaat plat over de lijn')))
        /* EEN MISLUKTE START HOORT TE ZEGGEN WAT ERAAN TE DOEN IS. "EACCES" is
           voor wie het niet kent geen mededeling maar een raadsel, en dit is de
           meest voorkomende manier waarop deze poort niet opengaat. De webserver
           doet dit al zo (zie opzet/luister.js); hier stond alleen de kale fout. */
        .catch((e) => {
          const c = e && e.code;
          const waar = mHost + ':' + process.env.MAIL_IN_POORT;
          console.warn('[smtp-in] niet gestart -- ' + (c === 'EACCES'
            ? 'geen rechten om op ' + waar + ' te luisteren. Poorten onder 1024 vragen root of'
              + ' CAP_NET_BIND_SERVICE; of zet MAIL_IN_POORT=2525 met een doorstuurregel van 25 ernaartoe.'
            : c === 'EADDRINUSE'
              ? waar + ' is al in gebruik -- draait er al een mailserver op deze machine?'
              : 'kon niet op ' + waar + ' luisteren: ' + (e && e.message))
            + ' De site draait gewoon door; er komt alleen geen post binnen.');
        });
    } catch (e) { console.warn('[smtp-in] niet gestart:', e && e.message); }
  }
};
