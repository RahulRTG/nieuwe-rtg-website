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
  /* DEZE DRIE STONDEN NIET UITGEPAKT, en daardoor is deze server nooit gestart.
     `tlsOpties`, `poort` en `host` werden hieronder gebruikt maar nergens uit
     `opties` gehaald; in strict mode geeft dat een ReferenceError op de eerste
     regel van start(). De aanroeper (opzet/luister-poorten.js) vangt dat in een
     try/catch en schrijft "[imap] niet gestart: tlsOpties is not defined" naar
     het log -- een regel die niemand leest op een machine waar IMAP_POORT toch
     niet stond.

     Waarom geen enkele toets het zag: test/imap.test.js beproeft het GESPREK
     (./imap.js) met twee arrays, en dat is precies de goede keuze -- maar
     daarmee kwam de verbindingslaag nooit aan bod. Dezelfde vorm als
     eerlijkheidspunt 6.12: wat een laag hoger wordt opgehangen, valt buiten de
     toets die de laag zelf beproeft. Er staat nu een toets die deze server
     ECHT opstart en er een gesprek over voert (test/imap-socket.test.js). */
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
      /* EEN IDLE MOET STOPPEN ALS DE VERBINDING WEGVALT. Zonder dit blijft er
         een timer draaien die elke paar seconden een postvak inleest en naar een
         socket schrijft die niet meer bestaat -- per weggevallen client een, en
         niemand die het merkt tot het proces begint te knijpen. Dit is de derde
         plek waar een IDLE afgebroken wordt (zie stopIdle in ./imap.js) en de
         enige die je vergeet, want de andere twee komen van de client zelf. */
      const weg = () => { try { s.sluit(); } catch (e) {} };
      sok.on('close', weg);
      sok.on('error', weg);
    };
    const srv = tlsOpties && tlsOpties.key ? tls.createServer(tlsOpties, onConn) : net.createServer(onConn);
    return new Promise((res) => srv.listen(poort || 1143, host || '127.0.0.1', () => res(srv)));
  }

  return { start, gesprek };
};
