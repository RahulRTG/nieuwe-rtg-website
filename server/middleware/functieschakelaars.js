/* De functieschakelaars: per functionaliteit een bewuste aan/uit-knop, beheerd
   vanaf de technische pagina en de Boardroom. Staat een functie uit, dan geeft
   zijn API 503 met een zin die uitlegt waarom, niet een kale foutcode.

   Een functie kan op vijf manieren dicht staan, en het antwoord vertelt welke:
   globaal, per pas, per land, per persoon, of per genre zaken. Dat onderscheid
   is belangrijk voor wie het leest: "uitgeschakeld door de beheerder" en "in
   jouw land uitgeschakeld" zijn voor een gebruiker twee heel andere dingen.

   De technische pagina en de health-checks blijven altijd bereikbaar, anders
   kan de eigenaar niets meer aanzetten zodra hij iets heeft uitgezet.

   Zuinig met opzoekwerk: het land van een lid en de zaak achter een
   leveranciersverzoek halen we alleen op als er ook echt regels van dat soort
   staan. Anders zou elk verzoek een opzoeking kosten voor een regel die er
   niet is. */

/* Landcode van een lid voor de "per land"-regels: het bij registratie gekozen
   land wint, anders leiden we het af uit de nationaliteit op het geverifieerde
   paspoort (bijvoorbeeld "Duitse" -> DE). */
function natieNaarLand(nat) {
  const s = String(nat || '').toLowerCase();
  if (!s) return null;
  if (/nederland|dutch|holland/.test(s)) return 'NL';
  if (/belg/.test(s)) return 'BE';
  if (/duits|german|deutsch/.test(s)) return 'DE';
  if (/frans|french|franc/.test(s)) return 'FR';
  if (/spaan|spanish|espa/.test(s)) return 'ES';
  if (/japan/.test(s)) return 'JP';
  return null;
}

const ZIN = {
  globaal: 'Deze functie is tijdelijk uitgeschakeld door de beheerder.',
  pas: 'Deze functie is voor jouw pas uitgeschakeld door de beheerder.',
  land: 'Deze functie is in jouw land uitgeschakeld door de beheerder.',
  plaats: 'Deze functie is in jouw woonplaats uitgeschakeld door de beheerder.',
  persoon: 'Deze functie is voor jouw account uitgeschakeld door de beheerder.',
  genre: 'Deze functie is voor dit genre zaken uitgeschakeld door RTG.'
};

function schakelaars({ db, accounts, functies, sessionFor, findSupplier, wachter }) {
  return (req, res, next) => {
    const p = req.path;
    if (!p.startsWith('/api/')) return next();
    if (p.startsWith('/api/techniek') || p === '/api/health' || p === '/api/ready') return next();
    /* De meetlijn van de storingswachter: elke afgeronde API-respons meldt
       zijn status. BOVEN de vroege return hieronder, want de wachter moet ook
       meten als er nog nooit iets geschakeld is -- anders bewaakt hij alleen
       installaties waar al een keer een hand aan de kast zat. Dat de kast
       zelf hierlangs 503's produceert is veilig: meet() telt een 503 bewust
       nooit mee (dat is de taal van "bewust dicht", geen storing). */
    if (wachter) res.on('finish', () => { try { wachter.meet(p, res.statusCode); } catch (e) {} });
    const staat = (db.data && db.data.techniek && db.data.techniek.functies) || null;
    /* De snelle uitgang: is er nog nooit iets geschakeld, dan staat alles aan
       -- maar alleen zolang elke functie standaard AAN is. Een functie die
       standaard UIT hoort te staan moet ook op een verse installatie dicht
       zitten, anders betekent "standaard uit" niets. */
    if (!staat && !functies.HEEFT_UIT_STANDAARD) return next();

    // De doelgroep van dit verzoek: uit het pad (leverancier/personeel/intern/
    // foundation) of uit de pas van het ingelogde lid (RTG/Lifestyle/Business).
    let user = null, sessieTier = null, zaakGenre = null;
    const tok = (req.get('authorization') || '').replace(/^Bearer\s+/i, '') || (req.body && req.body.token) || req.query.token;
    try { if (tok) user = accounts.verifyToken(tok); } catch (e) {}
    // geen accounttoken? dan kan het een sessietoken zijn: een gast (de gratis
    // app) of een demo-pas; zo kan de boardroom ook de gratis app besturen
    if (tok && !user) {
      try { const s = sessionFor(tok); if (s && s.tier) sessieTier = s.tier; } catch (e) {}
    }
    const doelgroep = functies.doelgroepVanVerzoek(p, user) ||
      (sessieTier ? functies.tierNaarDoelgroep(sessieTier) : null);

    // de leveranciers-regie: alleen als er genre-regels staan (bewaard of als
    // standaard-matrix in de catalogus) zoeken we de zaak op
    if ((p.startsWith('/api/supplier') || p.startsWith('/api/staff')) &&
        (functies.HEEFT_GENRE_STANDAARD || functies.heeftGenreRegels(staat))) {
      try {
        const s = tok && sessionFor(tok);
        if (s && s.role === 'supplier') { const z = findSupplier(s.code); zaakGenre = z ? z.type : null; }
      } catch (e) {}
    }

    // land, woonplaats en persoonssleutel (voor de fijne assen); de opzoeking
    // gebeurt alleen als er ook echt regels van dat soort staan
    let land = null, plaats = null, persoon = null;
    if (user) {
      persoon = 'user-' + user.id;
      const wilLand = functies.heeftLandRegels(staat);
      const wilPlaats = functies.heeftPlaatsRegels(staat);
      if (wilLand || wilPlaats) {
        try {
          const md = accounts.getMemberState(user.id) || {};
          if (wilLand) land = md.land || natieNaarLand(md.nationaliteit) || null;
          if (wilPlaats) plaats = functies.plaatsNorm(md.plaats);
        } catch (e) {}
      }
    }

    const dicht = functies.padGeblokkeerd(p, staat, { doelgroep, land, plaats, persoon, genre: zaakGenre });
    if (dicht) {
      return res.status(503).json({
        error: ZIN[dicht.reden] || ZIN.globaal,
        functie: dicht.id, naam: dicht.naam, reden: dicht.reden, doelgroep: doelgroep || undefined
      });
    }
    next();
  };
}

module.exports = { schakelaars, natieNaarLand, ZIN };
