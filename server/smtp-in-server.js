/* SMTP ONTVANGEN: de verbinding. Het GESPREK staat in ./smtp-in.js.

   Dezelfde splitsing als bij IMAP (./imap-server.js), en om dezelfde reden: een
   protocol-adapter die zijn sockets kent, is alleen te beproeven met een echte
   verbinding erbij -- en dan toets je het netwerk in plaats van het protocol.
   Dit bestand doet het saaie deel: verbinden, regels knippen, TLS aanzetten, en
   de deur dichtdoen als de andere kant niets meer zegt.

   VIER DINGEN DIE EEN LUISTERENDE POORT NODIG HEEFT en die niets met SMTP te
   maken hebben:

     een klok        een verbinding die niets zegt, hoort na een tijd dicht te
                     gaan. Zonder die klok houdt een handvol stille verbindingen
                     de poort bezet.
     een plafond     meer dan zoveel verbindingen tegelijk weigeren we met 421.
                     Dat is een eerlijk antwoord: de verzendende server probeert
                     het later opnieuw.
     een regelgrens  een "regel" zonder einde is een geheugenlek dat je kunt
                     opsturen. Bij te veel bytes zonder nieuwe regel: dicht.
     STARTTLS        de overschakeling zelf, want het gesprek weet niet wat een
                     socket is. Zonder sleutel praat hij plat, en dat wordt niet
                     verstopt: dat staat in het log bij het starten.

   HIJ STAAT UIT tenzij MAIL_IN_POORT is gezet -- zie opzet/luister.js. Een
   mailpoort die vanzelf openstaat op elke machine waar dit draait, is een deur
   die niemand heeft besloten open te zetten. */
'use strict';
const net = require('net');
const tls = require('tls');
const maakGesprek = require('./smtp-in');

const STIL_MS = 300000;        // vijf minuten; RFC 5321 noemt dit als minimum
const MAX_VERBINDINGEN = 50;
const MAX_BUFFER = 65536;      // een regel van 64 kB is geen regel meer

module.exports = (opties) => {
  const { aanname, naam, poort, host, tlsOpties } = opties || {};
  const gesprek = maakGesprek({ aanname, naam, starttls: !!(tlsOpties && tlsOpties.key) });
  let open = 0;

  function bedien(sok) {
    if (++open > MAX_VERBINDINGEN) {
      try { sok.write('421 Te veel verbindingen; probeer het zo opnieuw.\r\n'); } catch (e) {}
      sok.end();
      open--;
      return;
    }
    sok.setEncoding('utf8');
    sok.setTimeout(STIL_MS);

    let buf = '';
    let huidige = sok;
    const schrijf = (t) => { try { huidige.write(t); } catch (e) {} };
    const s = gesprek.sessie(schrijf, { ip: sok.remoteAddress || '' });
    s.begroet();

    /* Regels knippen. LET OP DE VOLGORDE: eerst alles wat er ligt afhandelen,
       dan pas nieuwe data aannemen -- een DATA-fase levert duizenden regels in
       een handvol pakketten, en die moeten alle langs het gesprek. */
    const verwerk = async (stuk) => {
      buf += stuk;
      if (buf.length > MAX_BUFFER) { schrijf('500 Regel te lang.\r\n'); sok.end(); return; }
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const regel = buf.slice(0, i).replace(/\r$/, '');
        buf = buf.slice(i + 1);
        let uit;
        try { uit = await s.regel(regel); }
        catch (e) {
          /* Een fout hier is ONZE fout, en dan hoort andermans post niet
             verloren te gaan: 451 laat de verzendende server het later opnieuw
             proberen. Stil de verbinding verbreken zou hetzelfde effect hebben
             maar zonder uitleg in zijn log. */
          schrijf('451 Er ging hier iets mis; probeer het later opnieuw.\r\n');
          continue;
        }
        if (uit === 'sluiten') { sok.end(); return; }
        if (uit === 'starttls') { naarTls(); return; }
      }
    };

    /* De overschakeling naar TLS. De bestaande socket wordt de onderlaag van een
       TLS-socket; alles wat er nog in de buffer stond gaat WEG -- dat is geen
       slordigheid maar de regel. Wat voor de handshake is binnengekomen, kan
       door een meelezer zijn geschreven. */
    function naarTls() {
      buf = '';
      sok.removeAllListeners('data');
      const veilig = new tls.TLSSocket(sok, Object.assign({ isServer: true }, tlsOpties));
      veilig.setEncoding('utf8');
      veilig.setTimeout(STIL_MS);
      huidige = veilig;
      s.naTls();
      veilig.on('data', verwerk);
      veilig.on('timeout', () => { try { veilig.write('421 Te lang stil.\r\n'); } catch (e) {} veilig.end(); });
      veilig.on('error', () => {});
      veilig.on('close', klaar);
    }

    let geteld = false;
    function klaar() { if (!geteld) { geteld = true; open--; } }

    sok.on('data', verwerk);
    sok.on('timeout', () => { schrijf('421 Te lang stil.\r\n'); sok.end(); });
    sok.on('error', () => {});
    sok.on('close', klaar);
  }

  /* Luisteren. `tlsOpties` met een sleutel maakt er GEEN implicit-TLS-poort van:
     poort 25 is per definitie plat met STARTTLS erbij. De sleutel is er dus voor
     de overschakeling, niet voor de poort zelf. */
  function start() {
    const srv = net.createServer(bedien);
    return new Promise((res, rej) => {
      srv.once('error', rej);
      srv.listen(poort || 2525, host || '127.0.0.1', () => res(srv));
    });
  }

  return { start, gesprek, bedien };
};
