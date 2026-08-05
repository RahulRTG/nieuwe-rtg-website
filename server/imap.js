/* IMAP: een gewone mailclient laten meelezen met een RTG-postvak.

   WAAROM DIT EEN ADAPTER IS EN GEEN TWEEDE MAILBOX. Het postvakmodel van dit
   huis (kern/rtmail-vak.js) kent mappen, etiketten, favorieten en sluimeren.
   IMAP kent mappen en vlaggen. Dat lijkt op elkaar maar is het niet, en de
   verleiding is om het model naar IMAP te buigen. Dat gebeurt hier niet: IMAP
   is een VERTALING boven op wat er al staat, en de waarheid blijft in RTMAIL.
   Wie hier iets wijzigt, wijzigt het daar -- er is geen tweede administratie.

   DE VERTALING, en waar hij wringt:

     INBOX      -> de map 'in'
     Archive    -> de map 'archief'
     Trash      -> de map 'prullenbak'
     Sent       -> wat dit adres verstuurd heeft
     \\Seen      -> gelezen
     \\Flagged   -> favoriet
     etiketten  -> die bestaan niet in IMAP; ze zijn zichtbaar als sleutelwoord
                   maar een client kan ze niet altijd tonen. Dat is een
                   TEKORTKOMING VAN HET PROTOCOL en niet van dit huis, en hij
                   staat hier opgeschreven in plaats van weggemoffeld.
     sluimeren  -> bestaat niet in IMAP. Sluimerende post is in de client
                   gewoon zichtbaar. Ook dat is eerlijker dan hem verbergen:
                   een client die post niet ziet die er wel is, is erger.

   WAT DIT WEL EN NIET IS. Dit is een LEESLAAG met vlaggen: SELECT, FETCH,
   SEARCH, STORE en EXPUNGE-loos verplaatsen. Wat er NIET in zit: APPEND (een
   client die post in het postvak schrijft), IDLE (wachten op nieuwe post) en
   TLS op de poort zelf. Die drie staan in TAKEN, want een half beloofde IMAP
   is erger dan geen: een client die APPEND probeert en een fout krijgt, denkt
   dat zijn concept verloren is.

   DE INLOG. Een gewoon wachtwoord werkt hier NIET, en dat is met opzet: een
   mailclient bewaart zijn wachtwoord op schijf, en het RTG-wachtwoord opent
   veel meer dan een postvak. Wie IMAP wil, maakt een APPARAATSLEUTEL aan (via
   /api/member/rtmail/imap/sleutel). Die geeft toegang tot precies EEN postvak,
   is los in te trekken, en staat in het journaal.

   Dit bestand is het GESPREK: regels erin, regels eruit, zonder socket. De
   server die dat gesprek over een verbinding voert staat in ./imap-server.js.
   Die splitsing kwam door de tien-kilobyte-regel, maar hij is ook de reden dat
   dit te beproeven is met twee arrays in plaats van een netwerk. */
'use strict';

const CRLF = '\r\n';
// de vertaaltabel; alles wat hier niet in staat, bestaat voor een client niet
const MAPPEN = [
  { imap: 'INBOX', vak: 'in' },
  { imap: 'Archive', vak: 'archief' },
  { imap: 'Trash', vak: 'prullenbak' },
  { imap: 'Sent', vak: 'uit' }
];

module.exports = ({ vak, rtmail, sleutels, poort, host, tlsOpties }) => {
  const vakVan = (naam) => (MAPPEN.find(m => m.imap.toLowerCase() === String(naam || '').toLowerCase()) || {}).vak || null;

  /* Een bericht als RFC 5322-tekst. Een client verwacht een heel bericht, geen
     JSON -- dus bouwen we hem hier op uit wat RTMAIL bewaart. De koppen zijn
     bewust minimaal en eerlijk: wat we niet weten, verzinnen we niet. */
  function alsBericht(m) {
    const kop = [
      'From: ' + m.van,
      'To: ' + m.naar,
      'Subject: ' + m.onderwerp,
      'Date: ' + new Date(m.at).toUTCString(),
      'Message-ID: <' + m.id + '@rtmail>',
      m.antwoordOp ? 'In-Reply-To: <' + m.antwoordOp + '@rtmail>' : null,
      'X-RTG-Vertrouwd: ' + (m.vertrouwd ? 'ja' : 'nee'),
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8'
    ].filter(Boolean).join(CRLF);
    return kop + CRLF + CRLF + String(m.tekst || '');
  }

  const vlaggenVan = (m) => {
    const v = [];
    if (m.gelezen) v.push('\\Seen');
    if (m.favoriet) v.push('\\Flagged');
    for (const l of (m.labels || [])) v.push(String(l).replace(/[^A-Za-z0-9_-]/g, ''));
    return v.filter(Boolean);
  };

  /* Een sessie. Houdt bij wie er inlogde en welke map open staat; verder is
     alles een vraag aan de lagen eronder. */
  function sessie(schrijf) {
    let adres = null, open = null, lijst = [];
    const zeg = (s) => schrijf(s + CRLF);

    function laad(mapNaam) {
      const v = vakVan(mapNaam);
      if (!v) return false;
      /* OUDSTE EERST. IMAP nummert berichten oplopend vanaf 1 en die nummers
         moeten stabiel blijven binnen een sessie; RTMAIL levert nieuwste eerst.
         Die omkering is precies het soort detail waar een adapter op stukgaat. */
      lijst = vak.lijst(adres, { map: v, limit: 200 }).slice().reverse();
      open = mapNaam;
      return true;
    }

    return {
      get adres() { return adres; },
      get open() { return open; },
      async regel(ruw) {
        const tekst = String(ruw || '').trim();
        if (!tekst) return;
        const spatie = tekst.indexOf(' ');
        const merk = spatie < 0 ? tekst : tekst.slice(0, spatie);
        const rest = spatie < 0 ? '' : tekst.slice(spatie + 1);
        const spatie2 = rest.indexOf(' ');
        const cmd = (spatie2 < 0 ? rest : rest.slice(0, spatie2)).toUpperCase();
        const arg = spatie2 < 0 ? '' : rest.slice(spatie2 + 1);

        if (cmd === 'CAPABILITY') {
          zeg('* CAPABILITY IMAP4rev1 AUTH=PLAIN');
          return zeg(merk + ' OK CAPABILITY klaar');
        }
        if (cmd === 'LOGOUT') { zeg('* BYE tot ziens'); zeg(merk + ' OK LOGOUT klaar'); return 'sluiten'; }
        if (cmd === 'NOOP') return zeg(merk + ' OK');

        if (cmd === 'LOGIN') {
          const m = /^"?([^"\s]+)"?\s+"?([^"]+)"?$/.exec(arg.trim());
          if (!m) return zeg(merk + ' NO geef gebruikersnaam en apparaatsleutel');
          const uit = sleutels.controleer(m[1], m[2]);
          if (!uit.ok) return zeg(merk + ' NO ' + uit.waarom);
          adres = uit.adres;
          return zeg(merk + ' OK ingelogd op ' + adres);
        }
        if (!adres) return zeg(merk + ' NO log eerst in');

        if (cmd === 'LIST') {
          for (const m of MAPPEN) zeg('* LIST () "/" "' + m.imap + '"');
          return zeg(merk + ' OK LIST klaar');
        }
        if (cmd === 'SELECT' || cmd === 'EXAMINE') {
          const naam = arg.trim().replace(/^"|"$/g, '');
          if (!laad(naam)) return zeg(merk + ' NO die map bestaat hier niet');
          zeg('* ' + lijst.length + ' EXISTS');
          zeg('* 0 RECENT');
          zeg('* FLAGS (\\Seen \\Flagged)');
          zeg('* OK [UIDVALIDITY 1] stabiel');
          return zeg(merk + ' OK [' + (cmd === 'EXAMINE' ? 'READ-ONLY' : 'READ-WRITE') + '] ' + naam + ' geopend');
        }
        if (!open) return zeg(merk + ' NO kies eerst een map met SELECT');

        if (cmd === 'FETCH') {
          const m = /^(\d+)(?::(\d+|\*))?\s+(.+)$/.exec(arg.trim());
          if (!m) return zeg(merk + ' BAD wat moet ik ophalen?');
          const van = Math.max(1, parseInt(m[1], 10));
          const tot = m[2] === '*' ? lijst.length : (m[2] ? parseInt(m[2], 10) : van);
          const wat = m[3].toUpperCase();
          for (let i = van; i <= Math.min(tot, lijst.length); i++) {
            const b = lijst[i - 1];
            if (!b) continue;
            if (/BODY|RFC822/.test(wat)) {
              const tekst = alsBericht(b);
              zeg('* ' + i + ' FETCH (FLAGS (' + vlaggenVan(b).join(' ') + ') RFC822 {' + Buffer.byteLength(tekst) + '}');
              schrijf(tekst + CRLF + ')' + CRLF);
            } else {
              zeg('* ' + i + ' FETCH (FLAGS (' + vlaggenVan(b).join(' ') + ') INTERNALDATE "' + b.at + '")');
            }
          }
          return zeg(merk + ' OK FETCH klaar');
        }

        if (cmd === 'STORE') {
          const m = /^(\d+)\s+([+-]?)FLAGS(?:\.SILENT)?\s+\(?([^)]*)\)?$/i.exec(arg.trim());
          if (!m) return zeg(merk + ' BAD onbegrepen STORE');
          const b = lijst[parseInt(m[1], 10) - 1];
          if (!b) return zeg(merk + ' NO dat bericht staat niet in deze map');
          const aan = m[2] !== '-';
          const vlaggen = m[3].split(/\s+/).filter(Boolean).map(x => x.toLowerCase());
          /* HIER WORDT DE WAARHEID GEWIJZIGD, en dat gebeurt in RTMAIL zelf.
             Een client die een ster zet, zet hem in het postvak -- niet in een
             IMAP-schaduwadministratie die daarna uit de pas loopt. */
          if (vlaggen.includes('\\flagged')) vak.ster(adres, b.id, aan);
          if (vlaggen.includes('\\seen')) rtmail.lees(adres, b.id);
          if (vlaggen.includes('\\deleted') && aan) vak.verplaats(adres, b.id, 'prullenbak');
          laad(open);
          const nieuw = lijst.find(x => x.id === b.id);
          if (nieuw) zeg('* ' + (lijst.indexOf(nieuw) + 1) + ' FETCH (FLAGS (' + vlaggenVan(nieuw).join(' ') + '))');
          return zeg(merk + ' OK STORE klaar');
        }

        if (cmd === 'SEARCH') {
          const vraag = arg.replace(/^(TEXT|BODY|SUBJECT)\s+/i, '').replace(/^"|"$/g, '').trim();
          const r = vak.zoek(adres, vraag, { limit: 100 });
          const nrs = [];
          if (r.ok) for (const b of r.berichten) {
            const i = lijst.findIndex(x => x.id === b.id);
            if (i >= 0) nrs.push(i + 1);
          }
          zeg('* SEARCH' + (nrs.length ? ' ' + nrs.sort((a, b) => a - b).join(' ') : ''));
          return zeg(merk + ' OK SEARCH klaar');
        }

        if (cmd === 'APPEND') {
          /* Bewust NIET stilzwijgend: een client die denkt dat zijn concept is
             opgeslagen terwijl dat niet zo is, verliest werk. Liever een
             duidelijke weigering. */
          return zeg(merk + ' NO APPEND kan hier niet; schrijf uw post in RTG Mail zelf');
        }
        return zeg(merk + ' BAD dat commando kent deze server niet');
      }
    };
  }

  return { sessie, alsBericht, vlaggenVan, MAPPEN, vakVan };
};
