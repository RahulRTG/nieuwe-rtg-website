/* Kern-module "kantoorgesprek": de RTG-Backoffice binnenkomen door met Rahul te
   praten, in plaats van een codeveld in te vullen.

   Waarom een vaste stappenmachine en niet de vrije AI: dit is een deur. Wat hier
   binnenkomt is een kantoorcode en een tweede factor, en dat hoort elke keer
   precies hetzelfde te gaan, toetsbaar, zonder dat er ooit een model bij zit dat
   iets zou kunnen "meedenken". Rahul klinkt hier dus als Rahul, maar hij
   improviseert niet.

   Drie dingen die dit anders maken dan het gegevensgesprek, en die alle drie
   bewust zijn:

   1. WAT HIER BINNENKOMT WORDT NERGENS BEWAARD. Geen gespreksgeheugen, geen
      merkteken met waarde, geen log met de code erin. De machine houdt alleen
      bij WELKE vraag openstaat, nooit het antwoord.

   2. HETZELFDE SLOT ALS HET FORMULIER. De chat gebruikt dezelfde teller en
      dezelfde bucket als /api/office/login ('office:' + ip). Zou dat niet zo
      zijn, dan was "alles via Rahul" een zachtere deur dan het veld dat het
      vervangt -- dan had je de backoffice makkelijker te raden gemaakt door hem
      vriendelijker te maken. Dat is de verkeerde ruil.

   3. HIJ ZEGT NIET WELKE HELFT FOUT WAS. Een fout op de code en een fout op de
      tweede factor geven allebei hetzelfde antwoord, want anders vertelt de deur
      je of je de code al goed hebt.

   Het antwoordveld heet `verborgen`: daarmee weet het scherm dat het de invoer
   moet maskeren. Een chatvenster toont normaal wat je typt, en een kantoorcode
   hoort niet leesbaar in beeld te staan. */

const TTL_MS = 5 * 60 * 1000;      // een deur hoort niet lang open te staan
const MAX_GESPREKKEN = 200;
const MAX_BEURTEN = 12;

function maakKantoorgesprek({ OFFICE_CODE, veiligGelijk, totpOk, crypto, rememberSession,
  officeState, logInlog, loginFails, noteFailedTry }) {
  const gesprekken = new Map();    // id -> { veld, at, beurten }
  const nu = () => Date.now();
  const tweedeFactor = () => !!process.env.OFFICE_TOTP_SECRET;

  function opruimen() {
    for (const [id, g] of gesprekken) if (nu() - g.at > TTL_MS) gesprekken.delete(id);
    while (gesprekken.size >= MAX_GESPREKKEN) gesprekken.delete(gesprekken.keys().next().value);
  }

  /* Staat het slot dicht? Dezelfde bucket als het formulier, dus tien misslagen
     op welke van de twee deuren dan ook zetten ze allebei vijf minuten op slot. */
  const opSlot = (ip) => {
    const f = loginFails.get('office:' + ip);
    return !!(f && f.until > nu());
  };

  function kantoorStart(ip) {
    if (opSlot(ip)) return { status: 429, error: 'Te veel pogingen. Probeer het over een paar minuten opnieuw.' };
    opruimen();
    const id = 'kg' + crypto.randomBytes(9).toString('hex');
    gesprekken.set(id, { veld: 'code', at: nu(), beurten: 0 });
    return { status: 200, id, veld: 'code', verborgen: true,
      tekst: 'Welkom bij de RTG-Backoffice. Wat is de kantoorcode?' };
  }

  function kantoorZeg(id, ruw, ip, req) {
    if (opSlot(ip)) return { status: 429, error: 'Te veel pogingen. Probeer het over een paar minuten opnieuw.' };
    const g = gesprekken.get(String(id || ''));
    if (!g) return { status: 404, error: 'Dit gesprek ken ik niet meer. Begin gerust opnieuw.' };
    if (++g.beurten > MAX_BEURTEN) { gesprekken.delete(id); return { status: 429, error: 'Dit duurde te lang; begin opnieuw.' }; }
    g.at = nu();

    /* De invoer blijft hier: hij gaat nergens heen, wordt nergens bewaard en
       staat in geen enkel antwoord terug. */
    const tekst = String(ruw == null ? '' : ruw).trim();

    if (/^(stop|laat maar|annuleer|toch niet)$/i.test(tekst)) {
      gesprekken.delete(id);
      return { status: 200, gestopt: true, tekst: 'Goed, dan laten we het hierbij.' };
    }

    const mis = () => {
      gesprekken.delete(id);
      noteFailedTry('office:' + ip, ip);
      logInlog('office', false, null, req);
      // bewust hetzelfde antwoord voor de code en de tweede factor
      return { status: 401, error: 'Dat klopt niet. Begin gerust opnieuw.' };
    };

    if (g.veld === 'code') {
      if (!veiligGelijk(tekst.toUpperCase(), OFFICE_CODE)) return mis();
      if (tweedeFactor()) {
        g.veld = 'totp';
        return { status: 200, id, veld: 'totp', verborgen: true,
          tekst: 'Dank u. En de zescijferige code uit uw authenticator-app?' };
      }
      return binnen(id, req);
    }

    if (g.veld === 'totp') {
      if (!totpOk(process.env.OFFICE_TOTP_SECRET, tekst)) return mis();
      return binnen(id, req);
    }

    gesprekken.delete(id);
    return { status: 400, error: 'Begin gerust opnieuw.' };
  }

  function binnen(id, req) {
    gesprekken.delete(id);
    loginFails.delete('office:' + (req && req.ip));
    const token = crypto.randomBytes(24).toString('hex');
    rememberSession(token, { role: 'office' });
    logInlog('office', true, 'backoffice via gesprek', req);
    return { status: 200, binnen: true, token, state: officeState(),
      tekst: 'U bent binnen. Ik zet het kantoor voor u open.' };
  }

  return { kantoorStart, kantoorZeg };
}

module.exports = { maakKantoorgesprek };
