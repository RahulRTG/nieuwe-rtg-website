/* Het aanmeldgesprek: Rahul neemt de HELE poort over, inloggen en aanmelden.
   Een menselijk gesprek waarin hij zelf ontdekt of je nieuw bent of terugkomt;
   op elke "waarom?" legt hij eerlijk uit waarvoor iets dient. Aan het eind
   levert het precies de velden op die de ENE registratieroute al kent, of de
   gebruikersnaam voor de ENE inlogroute; het wachtwoord van een terugkerend lid
   gaat NOOIT door dit gesprek (dat typt de app rechtstreeks). Een vriendelijker
   ingang, nooit een tweede toegangspad.

   Afspraken (bewust): Rahul heet Rahul, nooit een diensttitel. Warmtespiegel: hij
   volgt de gebruiker en blijft er altijd een stapje onder. De woonplaats komt
   het liefst vanzelf; anders één keer subtiel gevraagd, en overslaan mag altijd
   (een volledig adres nooit hier). Het accounttype adviseert hij (RTG Pass);
   interesse in Lifestyle/Business noteert hij eerlijk, beloven doet hij NOOIT.
   Noemt iemand z'n werk, dan stelt hij de personeelskoppeling voor; het bewijs
   blijft de eigen pincode.

   maakAanmeldgesprek(state) volgt het vaste kern-patroon en werkt zonder
   API-sleutel. De vaste teksten en pure herkenners staan in
   ./aanmeldgesprek-hulp.js, het aanmeld-pad in ./aanmeldgesprek-aanmeld.js en
   het inlog-pad in ./aanmeldgesprek-inlog.js; hier staan de gespreksstaat en
   het doel-onderscheid. */

const crypto = require('crypto');   // de gespreks-id is een sleutel, zie intakeStart()
const maakHulp = require('./aanmeldgesprek-hulp');
const aanmeldStap = require('./aanmeldgesprek-aanmeld');
const maakInlog = require('./aanmeldgesprek-inlog');

const MAX_GESPREKKEN = 500;
const MAX_BEURTEN = 60;
const TTL_MS = 30 * 60 * 1000;

function maakAanmeldgesprek({ db, schoon, leeftijdVan, swStart, swZeg }) {
  const { ord, UITLEG, warmteVan, toon, pikWoonplaats, pikWerkgever, pikPasInteresse, WAAROM, isWaarom } = maakHulp({ db, schoon });
  const gesprekken = new Map(); // id -> { stap, velden, warmte, beurten, at, werkgever }
  const nu = () => Date.now();
  // het inlog-pad (login, sleutelwoorden, wachtwoord vergeten) als submodule
  const { naarWoordInlog, inlogStap } = maakInlog({ swStart, swZeg, ord, schoon, gesprekken });

  function opruimen() {
    if (gesprekken.size < MAX_GESPREKKEN) return;
    for (const [id, g] of gesprekken) { if (nu() - g.at > TTL_MS) gesprekken.delete(id); }
    while (gesprekken.size >= MAX_GESPREKKEN) { gesprekken.delete(gesprekken.keys().next().value); }
  }

  function intakeStart() {
    opruimen();
    /* DE ID VAN EEN INTAKEGESPREK IS EEN SLEUTEL, GEEN NUMMER.

       intakeZeg() zoekt het gesprek op deze id op en verder op niets: er is nog
       geen sessie, want dit is het gesprek VOOR de aanmelding. Wie de id raadt,
       praat verder in andermans intake -- en daar staan naam, woonplaats,
       werkgever en pasinteresse in.

       Er stond `Math.random().toString(36).slice(2, 8)`: zes tekens uit een
       generator die niet voor dit doel is gemaakt en waarvan de toestand uit
       eerdere trekkingen valt af te leiden. Nu twaalf hexadecimale tekens uit de
       systeembron. Gevonden bij het invoeren van RTG_ZAAD. */
    const id = 'ag' + nu().toString(36) + crypto.randomBytes(6).toString('hex');
    const g = { stap: 'doel', velden: {}, warmte: 0, beurten: 0, at: nu(), werkgever: null };
    gesprekken.set(id, g);
    return { id, tekst: 'Ik ben Rahul. Aanmelden, inloggen, of eerst uitleg?' };
  }

  async function intakeZeg(id, ruwTekst) {
    const g = gesprekken.get(id);
    if (!g) return { status: 404, error: 'Dit gesprek ken ik niet (meer). Begin gerust opnieuw.' };
    if (++g.beurten > MAX_BEURTEN) { gesprekken.delete(id); return { status: 429, error: 'Dit gesprek werd wel erg lang; begin even opnieuw.' }; }
    g.at = nu();
    const tekst = schoon(String(ruwTekst || ''), 280);
    if (!tekst) return { tekst: 'Zeg het maar.' };
    g.warmte = warmteVan(tekst, g.warmte);
    // de opportunistische pikkers horen bij het aanmeld-pad; tijdens inloggen en
    // de sleutelwoorden laten we ze rusten (een sleutelwoord is geen woonplaats)
    if (!/^(login|sw-|vergeten)/.test(g.stap)) { pikWoonplaats(g, tekst); pikWerkgever(g, tekst); pikPasInteresse(g, tekst); }
    if (isWaarom(tekst) && WAAROM[g.stap]) return { tekst: WAAROM[g.stap] };

    switch (g.stap) {
      case 'doel': {
        // Rahul ontdekt zelf of iemand komt inloggen, aanmelden, of uitleg wil
        /* De drie wegen, herkend in het Nederlands EN het Engels: een
           internationale gast die "sign up" typt hoort niet in een lus van
           dezelfde wedervraag te belanden. (De vragen zelf reizen daarna
           gewoon mee met de taal van het toestel.) */
        const wilUitleg = /\b(uitleg|leg .*uit|wat is (dit|rtg)|wat doen jullie|vertel (me )?meer|meer weten|hoe werkt|wat kan (ik|je)|informatie|wat voor|explain|what is (this|rtg)|tell me more|how does (this|it) work|more info)\b/i.test(tekst);
        const wilIn = /\b(inloggen|log ?in|sign in|al lid|al een account|ik ben lid|ken(t|nen)? (je )?m(e|ij)|welkom terug|terugkerend|bestaand account|weer hier|already (a )?member|existing account|welcome back)\b/i.test(tekst);
        const wilNieuw = /\b(eerste keer|voor het eerst|nieuw|aanmelden|lid worden|registreren|nog geen|account maken|nog niet|sign ?up|register|new here|become a member|first time|join|create an account)\b/i.test(tekst);
        const mail = /[^@\s]+@[^@\s]+\.[^@\s]+/.exec(tekst);
        if (wilUitleg && !wilIn && !wilNieuw) return { tekst: UITLEG };
        if (wilIn && !wilNieuw) {
          if (mail) return naarWoordInlog(g, mail[0].toLowerCase());
          g.stap = 'login-naam';
          // entree: het inlogpad draagt zijn eigen kopregel in de poort,
          // zoals de ballotage dat voor nieuwe leden doet
          return { entree: true, tekst: 'Welkom terug. Je e-mailadres of gebruikersnaam?' };
        }
        if (wilNieuw && !wilIn) {
          g.stap = 'hallo';
          return { tekst: toon(g, 'Dan regelen we dat hier. ', 'Leuk! Dan regelen we dat hier. ') + 'Hoe gaat het vandaag?' };
        }
        // een los e-mailadres als eerste zin = vrijwel zeker een terugkerend lid
        if (mail) return naarWoordInlog(g, mail[0].toLowerCase());
        return { tekst: 'Kom je inloggen, word je lid, of wil je uitleg?' };
      }
      default: {
        // de login-/sw-/vergeten-stappen lopen via het inlog-pad; geeft dat
        // null terug, dan is het een aanmeld-stap (hallo t/m wachtwoord)
        const inlog = await inlogStap(g, tekst, id);
        if (inlog) return inlog;
        return aanmeldStap(g, tekst, ruwTekst, id, { schoon, leeftijdVan, toon, gesprekken });
      }
    }
  }

  return { intakeStart, intakeZeg };
}

module.exports = { maakAanmeldgesprek };
