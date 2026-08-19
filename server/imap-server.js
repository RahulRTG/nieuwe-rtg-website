/* IMAP: de verbinding. Het GESPREK staat in ./imap.js.

   Deze splitsing is meer dan een omvangkwestie. Een protocol-adapter die zijn
   sockets kent, is alleen te beproeven met een echte verbinding erbij -- en
   dan toets je het netwerk in plaats van het protocol. Nu neemt ./imap.js
   regels aan en geeft regels terug, en doet dit bestand het saaie deel:
   verbinden, regels knippen, en de deur dichtdoen.

   ZONDER TLS-SLEUTEL PRAAT HIJ PLAT. Dat wordt niet verstopt: er staat een
   waarschuwing in het log bij het starten, en de kop van server/server.js zegt
   dat hij dan alleen achter een eigen doorgeefluik hoort. Een mailpoort die
   stilzwijgend onversleuteld luistert, is precies hoe wachtwoorden over een
   kantoornetwerk gaan zwerven. */
'use strict';
const net = require('net');
const tls = require('tls');
const maakGesprek = require('./imap');

const CRLF = '\r\n';

module.exports = (opties) => {
  /* Poort, host en tlsOpties UIT DE OPTIES halen, zoals ./smtp-in-server.js dat
     ook doet. Die regel ontbrak hier: start() gebruikte de drie namen wel maar
     bond ze nergens, dus elke poging om IMAP aan te zetten liep op een
     ReferenceError -- keurig weggevangen door de try/catch van de aanroeper, die
     er "[imap] niet gestart" van maakte. Een deur die nooit opengaat en dat
     meldt als een detail. */
  const { poort, host, tlsOpties } = opties || {};
  const gesprek = maakGesprek(opties);

  /* De server. `tlsOpties` met een sleutel en certificaat maakt er IMAPS van;
     zonder draait hij plat, en dat hoort alleen achter een eigen doorgeefluik.
     Er wordt niet gedaan alsof plat veilig is. */
  function start() {
    const onConn = (sok) => {
      sok.setEncoding('utf8');
      let buf = '';
      const s = gesprek.sessie((tekst) => { try { sok.write(tekst); } catch (e) {} });
      sok.write('* OK RTG Mail IMAP klaar' + CRLF);
      sok.on('data', async (stuk) => {
        buf += stuk;
        let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const regel = buf.slice(0, i).replace(/\r$/, '');
          buf = buf.slice(i + 1);
          try { if (await s.regel(regel) === 'sluiten') sok.end(); }
          catch (e) { try { sok.write('* BAD er ging iets mis' + CRLF); } catch (e2) {} }
        }
      });
      sok.on('error', () => {});
    };
    const srv = tlsOpties && tlsOpties.key ? tls.createServer(tlsOpties, onConn) : net.createServer(onConn);
    return new Promise((res) => srv.listen(poort || 1143, host || '127.0.0.1', () => res(srv)));
  }

  return { start, gesprek };
};
