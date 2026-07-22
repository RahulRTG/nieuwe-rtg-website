/* Het aanmeldgesprek: Rahul neemt de HELE poort over, inloggen en aanmelden.
   Een menselijk gesprek waarin hij zelf ontdekt of je nieuw bent of terugkomt;
   op elke "waarom?" legt hij eerlijk uit waarvoor iets dient. Aan het eind
   levert het precies de velden op die de ENE registratieroute al kent, of de
   gebruikersnaam voor de ENE inlogroute; het wachtwoord van een terugkerend lid
   gaat NOOIT door dit gesprek (dat typt de app rechtstreeks). Een vriendelijker
   ingang, nooit een tweede toegangspad.

   Afspraken (bewust): Rahul heet Rahul, nooit "butler". Warmtespiegel: hij
   volgt de gebruiker en blijft er altijd een stapje onder. De woonplaats komt
   het liefst vanzelf; anders één keer subtiel gevraagd, en overslaan mag altijd
   (een volledig adres nooit hier). Het accounttype adviseert hij (RTG Pass);
   interesse in Lifestyle/Business noteert hij eerlijk, beloven doet hij NOOIT.
   Noemt iemand z'n werk, dan stelt hij de personeelskoppeling voor; het bewijs
   blijft de eigen pincode.

   maakAanmeldgesprek(state) volgt het vaste kern-patroon en werkt zonder
   API-sleutel. De vaste teksten en pure herkenners staan in
   ./aanmeldgesprek-hulp.js, het aanmeld-pad in ./aanmeldgesprek-aanmeld.js;
   hier staan de gespreksstaat, het doel-onderscheid en het inlog-pad. */

const maakHulp = require('./aanmeldgesprek-hulp');
const aanmeldStap = require('./aanmeldgesprek-aanmeld');

const MAX_GESPREKKEN = 500;
const MAX_BEURTEN = 60;
const TTL_MS = 30 * 60 * 1000;

function maakAanmeldgesprek({ db, schoon, leeftijdVan, swStart, swZeg }) {
  const { ord, UITLEG, warmteVan, toon, pikWoonplaats, pikWerkgever, pikPasInteresse, WAAROM, isWaarom } = maakHulp({ db, schoon });
  const gesprekken = new Map(); // id -> { stap, velden, warmte, beurten, at, werkgever }
  const nu = () => Date.now();

  function opruimen() {
    if (gesprekken.size < MAX_GESPREKKEN) return;
    for (const [id, g] of gesprekken) { if (nu() - g.at > TTL_MS) gesprekken.delete(id); }
    while (gesprekken.size >= MAX_GESPREKKEN) { gesprekken.delete(gesprekken.keys().next().value); }
  }

  /* het inlog-pad opent standaard de sleutelwoorden-uitdaging (veiliger, en
     "inloggen is een gesprek met de AI"); wie liever het wachtwoord tikt, kan
     dat altijd zeggen. Zonder sleutelwoorden-motor valt alles terug op het
     wachtwoord, zodat bestaande accounts nooit vastlopen. */
  function naarWoordInlog(g, u) {
    g.login = { u };
    if (typeof swStart !== 'function') {
      g.stap = 'login-af';
      return { tekst: 'Welkom terug. Typ je wachtwoord hieronder; het gaat rechtstreeks de kluis in, niet door dit gesprek.', login: g.login };
    }
    const r = swStart(u);
    if (r && r.error) { g.stap = 'login-naam'; return { tekst: r.error }; }
    g.sw = { id: r.id };
    g.stap = 'sw-open';
    return { tekst: 'Fijn, welkom terug. We doen het veilig met je sleutelwoorden: verweef je ' + ord(r.posA) + ' en je ' + ord(r.posB) + ' sleutelwoord losjes in een zin. (Liever met je wachtwoord? Zeg "wachtwoord".)' };
  }

  function intakeStart() {
    opruimen();
    const id = 'ag' + nu().toString(36) + Math.random().toString(36).slice(2, 8);
    const g = { stap: 'doel', velden: {}, warmte: 0, beurten: 0, at: nu(), werkgever: null };
    gesprekken.set(id, g);
    return { id, tekst: 'Hi, ik ben Rahul.. wat kan ik voor je doen? Ik kan je aanmelden, inloggen, of eerst even uitleggen wat RTG is.' };
  }

  function intakeZeg(id, ruwTekst) {
    const g = gesprekken.get(id);
    if (!g) return { status: 404, error: 'Dit gesprek ken ik niet (meer). Begin gerust opnieuw.' };
    if (++g.beurten > MAX_BEURTEN) { gesprekken.delete(id); return { status: 429, error: 'Dit gesprek werd wel erg lang; begin even opnieuw.' }; }
    g.at = nu();
    const tekst = schoon(String(ruwTekst || ''), 280);
    if (!tekst) return { tekst: 'Zeg maar gewoon wat je denkt; ik luister.' };
    g.warmte = warmteVan(tekst, g.warmte);
    // de opportunistische pikkers horen bij het aanmeld-pad; tijdens inloggen en
    // de sleutelwoorden laten we ze rusten (een sleutelwoord is geen woonplaats)
    if (!/^(login|sw-|vergeten)/.test(g.stap)) { pikWoonplaats(g, tekst); pikWerkgever(g, tekst); pikPasInteresse(g, tekst); }
    if (isWaarom(tekst) && WAAROM[g.stap]) return { tekst: WAAROM[g.stap] };

    switch (g.stap) {
      case 'doel': {
        // Rahul ontdekt zelf of iemand komt inloggen, aanmelden, of uitleg wil
        const wilUitleg = /\b(uitleg|leg .*uit|wat is (dit|rtg)|wat doen jullie|vertel (me )?meer|meer weten|hoe werkt|wat kan (ik|je)|informatie|wat voor)\b/i.test(tekst);
        const wilIn = /\b(inloggen|log in|al lid|al een account|ik ben lid|ken(t|nen)? (je )?m(e|ij)|welkom terug|terugkerend|bestaand account|weer hier)\b/i.test(tekst);
        const wilNieuw = /\b(eerste keer|voor het eerst|nieuw|aanmelden|lid worden|registreren|nog geen|account maken|nog niet)\b/i.test(tekst);
        const mail = /[^@\s]+@[^@\s]+\.[^@\s]+/.exec(tekst);
        if (wilUitleg && !wilIn && !wilNieuw) return { tekst: UITLEG };
        if (wilIn && !wilNieuw) {
          if (mail) return naarWoordInlog(g, mail[0].toLowerCase());
          g.stap = 'login-naam';
          return { tekst: 'Ha, welkom terug. Even kijken: welk e-mailadres of welke gebruikersnaam gebruik je hier?' };
        }
        if (wilNieuw && !wilIn) {
          g.stap = 'hallo';
          return { tekst: toon(g, 'Leuk je te ontmoeten; dan regelen wij je aanmelding gewoon in dit gesprek. ', 'Wat leuk! Dan regelen we het hier samen. ') + 'Maar eerst: hoe gaat het vandaag?' };
        }
        // een los e-mailadres als eerste zin = vrijwel zeker een terugkerend lid
        if (mail) return naarWoordInlog(g, mail[0].toLowerCase());
        return { tekst: 'Allebei goed hoor. Zeg het maar: kom je inloggen, word je vandaag lid, of wil je eerst uitleg?' };
      }
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
        return { tekst: 'Typ je wachtwoord gewoon hieronder, dan ben je zo binnen. Kom je er niet uit: zeg "opnieuw" of "wachtwoord vergeten".', login: g.login || null };
      }
      case 'vergeten-mail': {
        const mail = /[^@\s]+@[^@\s]+\.[^@\s]+/.exec(tekst);
        if (!mail) return { tekst: 'Typ je e-mailadres even voluit (met @), dan zorg ik voor de herstel-link.' };
        g.stap = 'doel'; g.login = null;
        return { tekst: 'Als ik ' + mail[0].toLowerCase() + ' ken, ligt de herstel-link nu in je mail. Volg hem even; daarna log ik je hier zo weer in.', vergeten: { u: mail[0].toLowerCase() } };
      }
      default:
        // alle overige stappen zijn het aanmeld-pad (hallo t/m wachtwoord)
        return aanmeldStap(g, tekst, ruwTekst, id, { schoon, leeftijdVan, toon, gesprekken });
    }
  }

  return { intakeStart, intakeZeg };
}

module.exports = { maakAanmeldgesprek };
