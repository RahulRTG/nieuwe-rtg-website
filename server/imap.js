/* IMAP: een gewone mailclient laten meelezen met een RTG-postvak.

   DIT IS EEN ADAPTER EN GEEN TWEEDE MAILBOX. IMAP is een VERTALING boven op wat
   er al staat; de waarheid blijft in RTMAIL, en wie hier iets wijzigt wijzigt
   het daar. De tabel zelf (welke map, welke vlag, en waar hij wringt) staat in
   ./imap-vertaling.js.

   DIT BESTAND IS DE VORM VAN HET GESPREK: merken, commando's, de staat van de
   sessie, en de literal van APPEND. Wat de client uit een map HAALT staat in
   ./imap-lezen.js, wat hij erin ZET in ./imap-schrijf.js, en de verbinding
   eronder in ./imap-server.js -- die laatste splitsing is de reden dat dit te
   beproeven is met twee arrays in plaats van een netwerk.

   Het WACHTEN op nieuwe post (IDLE) staat in ./imap-idle.js: dat is de enige
   laag die uit zichzelf iets naar de client stuurt, en alles wat daar fout kan
   gaan is van een andere soort dan hier.

   WAT ER NIET IN ZIT: TLS op de poort zelf (dat doet ./imap-server.js met een
   eigen sleutel; anders hoort er een doorgeefluik voor) en JMAP/CardDAV/CalDAV.
   Zie TAKEN.md 5.13.

   DE INLOG. Een gewoon wachtwoord werkt hier NIET, en dat is met opzet: een
   mailclient bewaart zijn wachtwoord op schijf, en het RTG-wachtwoord opent
   veel meer dan een postvak. Wie IMAP wil, maakt een APPARAATSLEUTEL aan (via
   /api/member/rtmail/imap/sleutel). Die geeft toegang tot precies EEN postvak,
   is los in te trekken, en staat in het journaal. */
'use strict';

const { CRLF, MAPPEN, vakVan, isConceptMap } = require('./imap-vertaling');


module.exports = ({ vak, rtmail, sleutels, schrijf, idleMs, poort, host, tlsOpties }) => {
  /* De schrijfkant is OPTIONEEL: zonder `schrijf` bestaat Drafts niet en weigert
     APPEND zoals hij dat altijd deed. Zo blijft deze laag te beproeven met alleen
     een leesvak, en valt een aanroeper die de schrijflaag niet meegeeft niet om
     op undefined -- hij krijgt minder, en zegt dat. */
  const pen = schrijf ? require('./imap-schrijf')({ schrijf }) : null;
  const lees = require('./imap-lezen')({ vak, rtmail, schrijf });
  /* `idleMs` is er voor de TOETS: de enige manier om te zien dat een gestopte
     lus ook echt stilstaat, is wachten tot hij weer getikt zou hebben. */
  const wachten = require('./imap-idle')({ ms: idleMs });
  const mappen = () => MAPPEN.filter(m => !m.concepten || pen);

  /* Een sessie. Houdt bij wie er inlogde en welke map open staat; verder is
     alles een vraag aan de lagen eronder. */
  function sessie(uit) {
    let adres = null, open = null, lijst = [];
    // de literal van APPEND: zolang dit staat, is elke regel BRIEF en geen commando
    let brief = null;
    const zeg = (s) => uit(s + CRLF);
    // de IDLE-wacht van deze sessie; zie ./imap-idle.js
    const idle = wachten.maak({ zeg, tel: () => herlaad().length });

    function laad(mapNaam) {
      if (isConceptMap(mapNaam)) {
        if (!pen) return false;
        lijst = pen.alsBerichten(adres);
        open = mapNaam;
        return true;
      }
      const v = vakVan(mapNaam);
      if (!v) return false;
      /* OUDSTE EERST. IMAP nummert berichten oplopend vanaf 1 en die nummers
         moeten stabiel blijven binnen een sessie; RTMAIL levert nieuwste eerst.
         Die omkering is precies het soort detail waar een adapter op stukgaat. */
      lijst = vak.lijst(adres, { map: v, limit: 200 }).slice().reverse();
      open = mapNaam;
      return true;
    }
    const herlaad = () => { laad(open); return lijst; };

    return {
      get adres() { return adres; },
      get open() { return open; },
      get idlet() { return idle.lopend; },
      sluit: () => idle.stop(),
      async regel(ruw) {
        /* EERST DE BRIEF, DAN DE COMMANDO'S. Staat er een APPEND open, dan is
           deze regel een stuk van het bericht -- ook als er "LOGOUT" in staat.
           Wie dit omdraait, laat de INHOUD van een bericht commando's uitvoeren. */
        if (brief) {
          brief.buf += String(ruw == null ? '' : ruw) + CRLF;
          if (Buffer.byteLength(brief.buf) < brief.bytes) return;
          const r = pen.legAf(adres, brief.buf.slice(0, brief.bytes));
          const merk = brief.merk;
          brief = null;
          if (r.fout) return zeg(merk + ' NO ' + r.fout);
          if (open && isConceptMap(open)) { herlaad(); zeg('* ' + lijst.length + ' EXISTS'); }
          return zeg(merk + ' OK [APPENDUID 1 ' + r.concept.id + '] APPEND klaar');
        }
        const tekst = String(ruw || '').trim();
        if (!tekst) return;

        /* DONE IS HET ENIGE COMMANDO ZONDER MERK. Zo staat het in RFC 2177: de
           client sluit een IDLE af met een kale regel `DONE`, en het antwoord
           draagt het merk van de IDLE die ermee wordt afgesloten. Wie hem als
           gewoon commando ontleedt, ziet DONE als het MERK en een leeg
           commando -- dan hangt de client tot de verbinding wegvalt. */
        if (/^DONE$/i.test(tekst)) {
          if (!idle.lopend) return zeg('* BAD er liep geen IDLE');
          const merk = idle.merk;
          idle.stop();
          return zeg(merk + ' OK IDLE klaar');
        }
        /* Zolang een IDLE loopt is er niets anders te doen dan DONE -- met EEN
           uitzondering: LOGOUT. Dat is de client die afscheid neemt, en die
           laten wachten op een DONE die dan nooit komt, laat de sessie hangen.
           Deze uitzondering is er niet uit netheid maar omdat de toets het liet
           zien: `stopIdle()` in de LOGOUT-tak hieronder was ONBEREIKBAAR zolang
           deze regel er onvoorwaardelijk stond, en dan belooft die tak iets wat
           hij nooit doet. */
        if (idle.lopend && !/^\S+\s+LOGOUT\b/i.test(tekst)) return zeg('* BAD sluit eerst de IDLE af met DONE');

        const spatie = tekst.indexOf(' ');
        const merk = spatie < 0 ? tekst : tekst.slice(0, spatie);
        const rest = spatie < 0 ? '' : tekst.slice(spatie + 1);
        const spatie2 = rest.indexOf(' ');
        const cmd = (spatie2 < 0 ? rest : rest.slice(0, spatie2)).toUpperCase();
        const arg = spatie2 < 0 ? '' : rest.slice(spatie2 + 1);

        if (cmd === 'CAPABILITY') {
          /* Dit is een BELOFTE: de client richt zich erop in. IDLE er wel bij
             zetten en dan niets doen is de ergste vorm -- dan stopt hij met
             kijken en wacht op iets dat nooit komt. */
          zeg('* CAPABILITY IMAP4rev1 AUTH=PLAIN IDLE');
          return zeg(merk + ' OK CAPABILITY klaar');
        }
        if (cmd === 'LOGOUT') { idle.stop(); zeg('* BYE tot ziens'); zeg(merk + ' OK LOGOUT klaar'); return 'sluiten'; }
        if (cmd === 'NOOP') return zeg(merk + ' OK');

        if (cmd === 'LOGIN') {
          const m = /^"?([^"\s]+)"?\s+"?([^"]+)"?$/.exec(arg.trim());
          if (!m) return zeg(merk + ' NO geef gebruikersnaam en apparaatsleutel');
          const r = sleutels.controleer(m[1], m[2]);
          if (!r.ok) return zeg(merk + ' NO ' + r.waarom);
          adres = r.adres;
          return zeg(merk + ' OK ingelogd op ' + adres);
        }
        if (!adres) return zeg(merk + ' NO log eerst in');

        if (cmd === 'LIST') {
          for (const m of mappen()) zeg('* LIST (' + (m.concepten ? '\\Drafts' : '') + ') "/" "' + m.imap + '"');
          return zeg(merk + ' OK LIST klaar');
        }
        if (cmd === 'SELECT' || cmd === 'EXAMINE') {
          const naam = arg.trim().replace(/^"|"$/g, '');
          if (!laad(naam)) return zeg(merk + ' NO die map bestaat hier niet');
          zeg('* ' + lijst.length + ' EXISTS');
          zeg('* 0 RECENT');
          zeg('* FLAGS (\\Seen \\Flagged \\Draft)');
          zeg('* OK [UIDVALIDITY 1] stabiel');
          return zeg(merk + ' OK [' + (cmd === 'EXAMINE' ? 'READ-ONLY' : 'READ-WRITE') + '] ' + naam + ' geopend');
        }

        /* APPEND MAG ZONDER GEOPENDE MAP: hij noemt zijn eigen doelmap. Alles
           hieronder niet -- dat gaat over de map die open staat. */
        if (cmd === 'APPEND') {
          /* Bewust NIET stilzwijgend, ook nu er wel iets kan: een client die
             denkt dat zijn concept is opgeslagen terwijl dat niet zo is,
             verliest werk. Wat er wel en niet mag staat in ./imap-schrijf.js --
             kort: een client kan geen ONTVANGEN post maken. */
          if (!pen) return zeg(merk + ' NO APPEND kan hier niet; schrijf uw post in RTG Mail zelf');
          const b = pen.begin(arg);
          if (b.fout) return zeg(merk + ' NO ' + b.fout);
          brief = { merk, bytes: b.bytes, buf: '' };
          return zeg('+ ga verder');
        }

        if (!open) return zeg(merk + ' NO kies eerst een map met SELECT');
        const ctx = { merk, adres, open, lijst, zeg, uit, laad, herlaad };

        if (cmd === 'FETCH') return lees.fetch(arg, ctx);
        if (cmd === 'STORE') return lees.store(arg, ctx);
        if (cmd === 'SEARCH') return lees.search(arg, ctx);

        // wachten op nieuwe post; de lus en zijn afwegingen staan in ./imap-idle.js
        if (cmd === 'IDLE') {
          idle.start(merk, lijst.length);
          return zeg('+ idling');
        }

        return zeg(merk + ' BAD dat commando kent deze server niet');
      }
    };
  }

  return { sessie, IDLE_MS: wachten.IDLE_MS, MAPPEN, vakVan };
};
