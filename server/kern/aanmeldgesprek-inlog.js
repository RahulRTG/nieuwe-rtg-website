/* Het inlog-pad van het aanmeldgesprek (kern/aanmeldgesprek.js): de stappen
   nadat Rahul heeft ontdekt dat iemand terugkomt. Standaard het wachtwoord (dat
   heeft iedereen); wie zelf sleutelwoorden instelde, kan die uitdaging alsnog
   starten. Het wachtwoord zelf gaat NOOIT door dit gesprek -- dat tikt de app
   rechtstreeks. Ook het "wachtwoord vergeten"-herstel loopt hierlangs. De motor
   roept inlogStap aan voor de login-/sw-/vergeten-stappen; ctx bundelt de
   gedeelde hulp en de gesprek-Map (voor het opruimen bij een geslaagde login). */

module.exports = function maakInlog({ swStart, swZeg, ord, schoon, gesprekken }) {
  /* het inlog-pad opent standaard met het wachtwoord (veiliger dan een verplicht
     sleutelwoord-scherm voor wie er geen heeft); wie liever sleutelwoorden tikt,
     vraagt er gewoon om. Zonder sleutelwoorden-motor valt alles terug op het
     wachtwoord, zodat bestaande accounts nooit vastlopen. */
  function naarWoordInlog(g, u) {
    g.login = { u };
    g.stap = 'login-af';
    const swKan = typeof swStart === 'function';
    return { tekst: 'Welkom terug. Typ je wachtwoord hieronder; het gaat rechtstreeks de kluis in, niet door dit gesprek.' +
      (swKan ? ' (Heb je sleutelwoorden ingesteld? Zeg "sleutelwoorden".)' : ''), login: g.login };
  }
  // wie liever met zijn eigen sleutelwoorden inlogt, start de uitdaging alsnog
  function naarSleutelwoorden(g) {
    const r = swStart((g.login || {}).u || '');
    if (r && r.error) { g.stap = 'login-naam'; return { tekst: r.error }; }
    g.sw = { id: r.id };
    g.stap = 'sw-open';
    return { tekst: 'Goed, we doen het met je sleutelwoorden: verweef je ' + ord(r.posA) + ' en je ' + ord(r.posB) + ' sleutelwoord losjes in een zin. (Toch het wachtwoord? Zeg "wachtwoord".)' };
  }

  // de login-/sw-/vergeten-stappen; geeft null terug voor elke andere stap,
  // zodat de motor kan doorschakelen naar het aanmeld-pad.
  function inlogStap(g, tekst, id) {
    switch (g.stap) {
      case 'login-naam': {
        if (/\bvergeten\b/i.test(tekst)) {
          g.stap = 'vergeten-mail';
          return { tekst: 'Geen zorgen, dat regelen we zo. Welk e-mailadres gebruik je hier? Dan zorg ik voor een herstel-link.' };
        }
        const mail = /[^@\s]+@[^@\s]+\.[^@\s]+/.exec(tekst);
        const u = mail ? mail[0].toLowerCase() : schoon(tekst.replace(/^(met\s+|mijn\s+(e-?mail(adres)?|gebruikersnaam|naam)\s+is\s+|het\s+is\s+)/i, ''), 80);
        if (!u || u.length < 2) return { tekst: 'Welk e-mailadres of welke gebruikersnaam gebruik je hier? Typ hem even voluit.' };
        return naarWoordInlog(g, u);
      }
      case 'sw-open': {
        if (/\bwachtwoord\b/i.test(tekst)) { g.stap = 'login-af'; g.sw = null; return { tekst: 'Ook goed. Typ je wachtwoord hieronder; het gaat rechtstreeks de kluis in, niet door dit gesprek.', login: g.login || null }; }
        if (/\bopnieuw\b/i.test(tekst)) { g.stap = 'doel'; g.login = null; g.sw = null; return { tekst: 'Prima, we beginnen opnieuw. Inloggen, aanmelden, of wil je uitleg?' }; }
        const r = swZeg((g.sw || {}).id || '', tekst);
        if (r.error) { g.stap = 'login-naam'; g.sw = null; return { tekst: r.error + ' Met welk e-mailadres of welke gebruikersnaam ken ik je? (Of zeg "wachtwoord".)' }; }
        g.stap = 'sw-sluit';
        const echo = r.echo ? ' Ik hoor je "' + r.echo + '" terug.' : '';
        return { tekst: 'Dank je.' + echo + ' Sluit nu af met je ' + ord(r.posSluit) + ' sleutelwoord.' };
      }
      case 'sw-sluit': {
        if (/\bwachtwoord\b/i.test(tekst)) { g.stap = 'login-af'; g.sw = null; return { tekst: 'Ook goed. Typ je wachtwoord hieronder.', login: g.login || null }; }
        const r = swZeg((g.sw || {}).id || '', tekst);
        g.sw = null;
        if (r.ok) { gesprekken.delete(id); return { inlog: { userId: r.userId }, tekst: 'Daar ben je weer. Welkom terug.' }; }
        g.stap = 'login-naam';
        return { tekst: (r.error || 'Dat klopte net niet helemaal.') + ' Zullen we het opnieuw proberen? Met welk e-mailadres of welke gebruikersnaam ken ik je? (Of zeg "wachtwoord".)' };
      }
      case 'login-af': {
        // wachtwoord kwijt: Rahul regelt de herstel-link zelf (de app vraagt
        // hem stil aan; of het adres bestaat, verklapt niemand)
        if (/\bvergeten\b/i.test(tekst)) {
          const u = g.login && /@/.test(g.login.u) ? g.login.u : null;
          if (u) return { tekst: 'Geen zorgen. Als ik ' + u + ' ken, ligt er zo een herstel-link in je mail; volg die even en kom terug, dan ben ik hier.', vergeten: { u } };
          g.stap = 'vergeten-mail';
          return { tekst: 'Geen zorgen, dat regelen we zo. Welk e-mailadres gebruik je hier? Dan zorg ik voor een herstel-link.' };
        }
        if (/\b(opnieuw|ander (adres|account)|verkeerde?|toch (aanmelden|lid|nieuw))\b/i.test(tekst)) {
          g.stap = 'doel'; g.login = null;
          return { tekst: 'Geen punt, we beginnen gewoon opnieuw. Kom je inloggen, of word je lid?' };
        }
        // wie zelf sleutelwoorden heeft ingesteld, mag er alsnog voor kiezen
        if (/\bsleutelwoord/i.test(tekst) && typeof swStart === 'function' && g.login) return naarSleutelwoorden(g);
        return { tekst: 'Typ je wachtwoord gewoon hieronder, dan ben je zo binnen. Kom je er niet uit: zeg "opnieuw" of "wachtwoord vergeten".', login: g.login || null };
      }
      case 'vergeten-mail': {
        const mail = /[^@\s]+@[^@\s]+\.[^@\s]+/.exec(tekst);
        if (!mail) return { tekst: 'Typ je e-mailadres even voluit (met @), dan zorg ik voor de herstel-link.' };
        g.stap = 'doel'; g.login = null;
        return { tekst: 'Als ik ' + mail[0].toLowerCase() + ' ken, ligt de herstel-link nu in je mail. Volg hem even; daarna log ik je hier zo weer in.', vergeten: { u: mail[0].toLowerCase() } };
      }
      default:
        return null;
    }
  }

  return { naarWoordInlog, naarSleutelwoorden, inlogStap };
};
