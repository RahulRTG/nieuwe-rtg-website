/* SMTP ONTVANGEN: het gesprek. De verbinding staat in ./smtp-in-server.js.

   HET GAT DAT DIT DICHT. Dit huis kon post VERSTUREN (./smtp.js naar een
   smarthost, ./smtp-direct.js rechtstreeks met DKIM) en een mailclient kon
   MEELEZEN (./imap.js). Wat er niet was, is iets dat post AANNEEMT. Post van
   buiten kwam alleen binnen via /api/mail/binnen -- een HTTP-poort waar iets
   anders een compleet RFC 5322-bericht in moest duwen. Er luisterde niets op
   poort 25, en dus kwam er in de praktijk niets binnen tenzij iemand er met de
   hand een relay voor zette.

   WAT DIT WEL IS: de ontvangende helft van SMTP (RFC 5321) voor EIGEN post.
   EHLO/HELO, MAIL FROM, RCPT TO, DATA, RSET, NOOP, QUIT, en STARTTLS als er een
   sleutel is.

   WAT DIT NIET IS, en dat hoort er hardop bij te staan:

     GEEN RELAY. Elke RCPT TO wordt getoetst bij kern/mailaanname.js: kent dit
     huis dit adres? Zo niet, dan 550 -- meteen, voordat er ook maar een byte
     inhoud is aangenomen. Dit is de belangrijkste regel van het bestand. Een
     ontvanger die eerst aanneemt en daarna weigert, stuurt een foutbericht naar
     een afzender die meestal vervalst is (backscatter), en een ontvanger die
     doorstuurt voor vreemden is binnen een dag een spamrelay.

     GEEN AUTH. Dit is de poort voor binnenkomende post, niet voor verzenden.
     Een client die hier wil inloggen om iets de wereld in te sturen, hoort dat
     niet te kunnen -- dus is er geen AUTH, en dus is er niets om te misbruiken.

     GEEN WACHTRIJ, GEEN BOUNCES. Wat wordt aangenomen, wordt meteen bezorgd; wat
     niet kan, wordt geweigerd met een code die de VERZENDENDE server begrijpt.
     Die server bewaart het bericht en probeert het opnieuw (4xx) of vertelt het
     zijn afzender (5xx). Dat is precies waar SMTP goed in is, en het is beter
     dan wat wij ervoor in de plaats zouden zetten.

   HET GESPREK KENT GEEN SOCKET. Het neemt regels aan en geeft regels terug, net
   als ./imap.js. Daardoor is dit te beproeven met twee arrays in plaats van een
   netwerk -- en dan toets je het protocol en niet de verbinding.

   DE GRENZEN staan met een getal en een reden. Een luisterende poort zonder
   grenzen is een uitnodiging: een verbinding die nooit iets zegt, een bericht
   dat blijft groeien, duizend ontvangers in een envelop. De DATA-fase en de
   grens op de omvang staan in ./smtp-in-data.js. */
'use strict';

const { MAX_BYTES, maakOntvangst, antwoordCode } = require('./smtp-in-data');

const CRLF = '\r\n';

// Meer dan tien ontvangers in een envelop is voor dit huis geen normale post
// maar een verspreidlijst. Honderd commando's is ruim voor het langste eerlijke
// gesprek en kort genoeg om een lus af te kappen.
const MAX_ONTVANGERS = 10;
const MAX_COMMANDOS = 100;
const MAX_REGEL = 4096;

/* Het adres uit "MAIL FROM:<...>" of "RCPT TO:<...>". Alles buiten de punthaken
   is parameter (SIZE=, BODY=) en gaat ons niet aan. Een leeg adres (<>) is
   geldig en betekent "dit is een foutbericht"; dat mag binnenkomen. */
function adresUit(rest) {
  const m = /<([^>]*)>/.exec(String(rest || ''));
  if (m) return m[1].trim();
  // sommige oude servers laten de punthaken weg
  const kaal = String(rest || '').trim().split(/\s+/)[0] || '';
  return kaal.replace(/^:/, '').trim();
}

module.exports = ({ aanname, naam, starttls }) => {
  const host = String(naam || 'rtg-mail');

  /* Een sessie is EEN verbinding. `schrijf` zet een regel op de lijn; de
     aanroeper hoeft niets van het protocol te weten behalve dat.

     `ip` gaat mee omdat SPF zonder het IP van de andere kant geen uitslag is --
     dat is het hele idee van SPF. */
  function sessie(schrijf, { ip } = {}) {
    let helo = '', van = null, naar = [], data = null;
    let commandos = 0, tls = false;

    const zeg = (code, tekst) => schrijf(code + ' ' + tekst + CRLF);
    const reset = () => { van = null; naar = []; data = null; };

    function begroet() { schrijf('220 ' + host + ' RTG Mail klaar' + CRLF); }

    /* EHLO noemt wat wij kunnen. Alleen wat er ECHT is: STARTTLS staat er niet
       als er geen sleutel ligt, want een aankondiging die faalt is erger dan
       geen aankondiging -- de andere kant heeft dan al besloten hem te
       gebruiken. */
    function ehlo(arg) {
      helo = String(arg || '').trim().slice(0, 255);
      const regels = ['SIZE ' + MAX_BYTES, '8BITMIME', 'ENHANCEDSTATUSCODES'];
      if (starttls && !tls) regels.push('STARTTLS');
      schrijf('250-' + host + CRLF);
      regels.forEach((r, i) => schrijf('250' + (i === regels.length - 1 ? ' ' : '-') + r + CRLF));
    }

    /* Een regel van de andere kant. Geeft 'sluiten' terug als de verbinding
       dicht mag; verder niets. Async, want het aannemen van een bericht slaat
       DNS aan voor SPF en DMARC. */
    async function regel(ruweRegel) {
      const lijn = String(ruweRegel == null ? '' : ruweRegel).slice(0, MAX_REGEL);

      // in de DATA-fase is elke regel inhoud, ook iets dat op een commando lijkt
      if (data) {
        const af = data.regel(lijn);
        if (!af) return;
        const envelop = van;
        reset();
        if (af.teGroot) { zeg(552, 'Dit bericht is groter dan ' + MAX_BYTES + ' bytes.'); return; }
        const r = await aanname.neemAan({ ruw: af.ruw, ip, envelopeVan: envelop, helo });
        if (r && r.ok) { zeg(250, 'Aangenomen (' + r.id + ')'); return; }
        // welke code daarbij hoort en waarom: zie ./smtp-in-data.js
        zeg(antwoordCode(r), (r && r.error) || 'Kon dit bericht niet aannemen.');
        return;
      }

      if (++commandos > MAX_COMMANDOS) { zeg(421, 'Te veel commando\'s; tot ziens.'); return 'sluiten'; }

      const sp = lijn.indexOf(' ');
      const cmd = (sp < 0 ? lijn : lijn.slice(0, sp)).toUpperCase();
      const rest = sp < 0 ? '' : lijn.slice(sp + 1);

      switch (cmd) {
        case 'EHLO': ehlo(rest); return;
        case 'HELO': helo = String(rest).trim().slice(0, 255); zeg(250, host); return;
        case 'STARTTLS':
          if (!starttls || tls) { zeg(454, 'STARTTLS is hier niet beschikbaar.'); return; }
          zeg(220, 'Klaar om over te schakelen naar TLS.');
          /* De verbinding versleutelen doet de LAAG ERONDER; dit gesprek weet
             niet wat een socket is. Na de overschakeling begint het gesprek
             opnieuw -- dat is geen beleefdheid maar de regel: alles wat voor
             TLS is gezegd, is door een meelezer te veranderen geweest. */
          helo = ''; reset(); tls = true;
          return 'starttls';
        case 'MAIL':
          if (!/^FROM:/i.test(rest)) { zeg(501, 'Verwacht: MAIL FROM:<adres>'); return; }
          reset();
          van = adresUit(rest.slice(5));
          zeg(250, 'Afzender genoteerd');
          return;
        case 'RCPT': {
          if (van === null) { zeg(503, 'Eerst MAIL FROM.'); return; }
          if (!/^TO:/i.test(rest)) { zeg(501, 'Verwacht: RCPT TO:<adres>'); return; }
          if (naar.length >= MAX_ONTVANGERS) { zeg(452, 'Te veel ontvangers in een bericht.'); return; }
          const adres = adresUit(rest.slice(3));
          /* HIER STAAT DE DEUR. Geen bekend postvak, geen post -- en het
             antwoord komt voordat er inhoud is aangenomen, zodat de andere kant
             het zijn afzender kan vertellen in plaats van dat wij dat later met
             een foutbericht naar een vermoedelijk vervalst adres doen. */
          const kent = aanname.kentAdres(adres);
          if (!kent) { zeg(550, 'Dit adres bestaat hier niet: ' + adres); return; }
          naar.push(kent.adres);
          zeg(250, 'Ontvanger genoteerd');
          return;
        }
        case 'DATA':
          if (!naar.length) { zeg(503, 'Eerst een geldige RCPT TO.'); return; }
          data = maakOntvangst();
          zeg(354, 'Ga uw gang; eindig met een regel die alleen een punt bevat.');
          return;
        case 'RSET': reset(); zeg(250, 'Schoon'); return;
        case 'NOOP': zeg(250, 'Ja'); return;
        case 'VRFY':
          /* Bewust GEEN antwoord op de vraag of een adres bestaat. VRFY is de
             oudste adressen-oogstmachine die er is: een vreemde kan er een
             ledenlijst mee opbouwen, en dit huis draait juist op codenamen. */
          zeg(252, 'Daar doen wij geen uitspraak over.');
          return;
        case 'QUIT': zeg(221, 'Tot ziens'); return 'sluiten';
        default: zeg(500, 'Dat commando ken ik niet.'); return;
      }
    }

    // wat de laag eronder moet weten na een geslaagde STARTTLS
    const naTls = () => { tls = true; };

    return { begroet, regel, naTls,
      // alleen om te kunnen beproeven wat er in de sessie staat
      _stand: () => ({ helo, van, naar: naar.slice(), inData: !!data, tls, commandos }) };
  }

  return { sessie, MAX_BYTES, MAX_ONTVANGERS, MAX_COMMANDOS, adresUit };
};
