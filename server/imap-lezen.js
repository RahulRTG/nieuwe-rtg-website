/* IMAP: WAT DE CLIENT UIT EEN MAP HAALT EN ERIN VERANDERT -- FETCH, STORE en
   SEARCH.

   Afgesplitst van ./imap.js toen dat bestand met APPEND en IDLE over de
   tienkilobyte-grens ging, en op een naad die er al lag: ./imap.js gaat over de
   VORM van het gesprek (merken, commando's, de literal van APPEND, de staat van
   de sessie), en deze drie gaan over de INHOUD van een geopende map.

   DE REGEL DIE HIER GELDT, en die is bij STORE het hele punt: wie hier iets
   wijzigt, wijzigt het in RTMAIL. Er is geen IMAP-schaduwadministratie die
   daarna uit de pas loopt. Een client die een ster zet, zet hem in het postvak.

   De sessie geeft zijn staat mee in `ctx` en niet via een gesloten scope. Dat is
   met opzet: zo is elk van deze drie te beproeven met een object in de hand, en
   kan deze laag niets aanraken wat er niet in staat. */
'use strict';

const { CRLF, isConceptMap, alsBericht, vlaggenVan } = require('./imap-vertaling');

module.exports = ({ vak, rtmail, schrijf }) => {
  /* ctx: { merk, adres, open, lijst, zeg, uit, laad, herlaad }
     - zeg(s)  : een regel naar de client (CRLF erachter)
     - uit(s)  : rauw, zonder CRLF -- alleen voor het lijf van een bericht
     - herlaad(): de open map opnieuw inlezen; geeft de nieuwe lijst terug */
  function fetch(arg, ctx) {
    const { merk, lijst, zeg, uit } = ctx;
    const m = /^(\d+)(?::(\d+|\*))?\s+(.+)$/.exec(String(arg || '').trim());
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
        uit(tekst + CRLF + ')' + CRLF);
      } else {
        zeg('* ' + i + ' FETCH (FLAGS (' + vlaggenVan(b).join(' ') + ') INTERNALDATE "' + b.at + '")');
      }
    }
    return zeg(merk + ' OK FETCH klaar');
  }

  function store(arg, ctx) {
    const { merk, adres, open, lijst, zeg, herlaad } = ctx;
    const m = /^(\d+)\s+([+-]?)FLAGS(?:\.SILENT)?\s+\(?([^)]*)\)?$/i.exec(String(arg || '').trim());
    if (!m) return zeg(merk + ' BAD onbegrepen STORE');
    const b = lijst[parseInt(m[1], 10) - 1];
    if (!b) return zeg(merk + ' NO dat bericht staat niet in deze map');
    const aan = m[2] !== '-';
    const vlaggen = m[3].split(/\s+/).filter(Boolean).map(x => x.toLowerCase());

    /* EEN CONCEPT IS GEEN POST. `vak.ster` en `rtmail.lees` kennen dat id niet,
       en gelezen of favoriet betekent er ook niets. Wat er wel betekenis heeft
       is weggooien, en dat gaat naar de conceptenlaag. */
    if (isConceptMap(open)) {
      if (vlaggen.includes('\\deleted') && aan) {
        const r = schrijf ? schrijf.gooiWeg(adres, b.id) : { error: 'concepten staan hier niet' };
        if (r && r.error) return zeg(merk + ' NO ' + r.error);
        herlaad();
        return zeg(merk + ' OK concept weggegooid');
      }
      return zeg(merk + ' OK op een concept doet die vlag niets');
    }

    // HIER WORDT DE WAARHEID GEWIJZIGD, en dat gebeurt in RTMAIL zelf
    if (vlaggen.includes('\\flagged')) vak.ster(adres, b.id, aan);
    if (vlaggen.includes('\\seen')) rtmail.lees(adres, b.id);
    if (vlaggen.includes('\\deleted') && aan) vak.verplaats(adres, b.id, 'prullenbak');
    const na = herlaad();
    const nieuw = na.find(x => x.id === b.id);
    if (nieuw) zeg('* ' + (na.indexOf(nieuw) + 1) + ' FETCH (FLAGS (' + vlaggenVan(nieuw).join(' ') + '))');
    return zeg(merk + ' OK STORE klaar');
  }

  function search(arg, ctx) {
    const { merk, adres, open, lijst, zeg } = ctx;
    const vraag = String(arg || '').replace(/^(TEXT|BODY|SUBJECT)\s+/i, '').replace(/^"|"$/g, '').trim();

    /* In een conceptmap zoekt de postvakzoeker niets: die kent alleen post. Dan
       zoeken we in de geladen lijst zelf -- precies dezelfde verzameling die de
       client net heeft opgehaald, dus de nummers kloppen. Stil niets teruggeven
       zou "geen treffers" heten terwijl het "niet gezocht" is. */
    if (isConceptMap(open)) {
      const k = vraag.toLowerCase();
      const nrs = [];
      lijst.forEach((b, i) => {
        if (!k || (b.onderwerp + ' ' + b.tekst + ' ' + b.naar).toLowerCase().includes(k)) nrs.push(i + 1);
      });
      zeg('* SEARCH' + (nrs.length ? ' ' + nrs.join(' ') : ''));
      return zeg(merk + ' OK SEARCH klaar');
    }

    const r = vak.zoek(adres, vraag, { limit: 100 });
    const nrs = [];
    if (r.ok) for (const b of r.berichten) {
      const i = lijst.findIndex(x => x.id === b.id);
      if (i >= 0) nrs.push(i + 1);
    }
    zeg('* SEARCH' + (nrs.length ? ' ' + nrs.sort((a, b) => a - b).join(' ') : ''));
    return zeg(merk + ' OK SEARCH klaar');
  }

  return { fetch, store, search };
};
