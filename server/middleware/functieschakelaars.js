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

/* De ZINNEN en de twee 503-antwoorden wonen in schakelaar-antwoord.js. Dat is
   geen opsplitsing om de opsplitsing: dit bestand kwam met de uitleg erbij over
   de omvanggrens van 10 kB, en de deltapoort hield dat tegen. Wat eruit is
   gegaan hoort ook bij elkaar -- het is de vraag WAT een beller te horen krijgt,
   los van de vraag OF hij erdoor mag. */
const antwoord = require('./schakelaar-antwoord');
const { ZIN, bekendeBeller } = antwoord;

function schakelaars({ db, accounts, functies, sessionFor, findSupplier, wachter, bevoegdVan }) {
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
    /* DE ZESDE AS: MAG RTG DIT? De vijf hieronder gaan over wie de gebruiker is
       en wat de beheerder heeft uitgezet. Deze gaat over iets anders -- of RTG
       bevoegd is de handeling zelf te verrichten (kern/bevoegdheid.js) -- en
       staat daarom BOVEN de vroege return: hij hangt niet aan de bewaarde
       schakelaarstand, dus "er is nog nooit iets uitgezet" mag hem niet
       overslaan.

       MAAR HIJ ANTWOORDT NOOIT VOOR DE DEUR. Hier stond hij zonder die regel,
       en dat brak een invariant die dit huis wel degelijk bewaakt: elk
       leden-endpoint weigert een leverancier- of kantoortoken met 401
       (test/auth-rol.test.js). /api/bank/krediet gaf voortaan 503 aan iedereen
       -- ook aan wie er helemaal niet hoorde te zijn. Twee dingen mis: het
       antwoord op "mag RTG dit" kwam voor het antwoord op "wie ben jij", en het
       vertelde aan een willekeurige beller welke vermogens dicht staan en
       waarom.

       De regel is nu: de bevoegdheid geldt alleen voor de DOELGROEP van de
       functie. Hoort de beller daar niet bij (of is hij niemand), dan zwijgt
       deze laag en laat hij de deur van de route zelf antwoorden. Dat is ook
       inhoudelijk juist: "hiervoor is een vergunning nodig" is geen antwoord op
       een verkeerd token. */
    const bevoegd = bevoegdVan && bevoegdVan();
    if (bevoegd) {
      const f = functies.functieVoorPad(p);
      if (f && f.vermogen) {
        const tok = (req.get('authorization') || '').replace(/^Bearer\s+/i, '') || (req.body && req.body.token) || req.query.token;
        let gebruiker = null, tier = null;
        try { if (tok) gebruiker = accounts.verifyToken(tok); } catch (e) {}
        if (tok && !gebruiker) { try { const ses = sessionFor(tok); if (ses && ses.tier) tier = ses.tier; } catch (e) {} }
        const doel = functies.doelgroepVanVerzoek(p, gebruiker) ||
          (tier ? functies.tierNaarDoelgroep(tier) : null);
        const raakt = doel && Array.isArray(f.doelgroepen) && f.doelgroepen.includes(doel);
        if (raakt) {
          let oordeel = bevoegd.mag(f.vermogen);
          // het land pas opzoeken als de vergunning zich tot landen beperkt
          if (oordeel.mag && gebruiker && bevoegd.landTelt()) {
            let land = null;
            try {
              const md = accounts.getMemberState(gebruiker.id) || {};
              land = md.land || natieNaarLand(md.nationaliteit) || null;
            } catch (e) {}
            if (land) oordeel = bevoegd.mag(f.vermogen, { land });
          }
          if (!oordeel.mag) {
            /* Aan een vreemde vertellen we niet welke vergunning ontbreekt. De
               alinea hierboven belooft te zwijgen tegen wie "niemand is", maar
               doelgroepVanVerzoek() leidt de doelgroep ook uit het PAD af, dus
               voor /api/supplier, /api/staff, /api/office en /api/foundation gold
               dat niet. Zie schakelaar-antwoord.js. Blokkeren blijft blokkeren;
               alleen de uitleg gaat eraf. */
            return res.status(503).json(antwoord.bevoegdheid(bekendeBeller(gebruiker, tier), f, oordeel));
          }
        }
      }
    }

    const staat = (db.data && db.data.techniek && db.data.techniek.functies) || null;
    /* DE SNELLE UITGANG: is er nog nooit iets geschakeld, dan staat alles aan.
       Dat klopte zolang elke functie standaard AAN was, en zo was het ook: er
       bestond geen enkele functie met standaard:false. Zodra die er wel een is,
       stond hij op een verse installatie gewoon open -- en dan betekent
       "standaard uit" niets.

       De uitgang blijft daarom bestaan, maar laat de functies die STANDAARD UIT
       zijn erdoorheen zakken naar de gewone afhandeling. Hem helemaal weghalen
       zou veel meer doen dan bedoeld: dan gaat op een verse installatie ineens
       de hele regelmachine draaien (genre-, land- en plaatsregels uit de
       standaardmatrix), en die sliep daar juist. */
    if (!staat && functies.HEEFT_UIT_STANDAARD) {
      const f = functies.functieVoorPad(p);
      if (!f || f.standaard !== false) return next();
    } else if (!staat) return next();

    // De doelgroep van dit verzoek: uit het pad (leverancier/personeel/intern/
    // foundation) of uit de pas van het ingelogde lid (RTG/Lifestyle/Business).
    let user = null, sessieTier = null, zaakGenre = null;
    const tok = (req.get('authorization') || '').replace(/^Bearer\s+/i, '') || (req.body && req.body.token) || req.query.token;
    try { if (tok) user = accounts.verifyToken(tok); } catch (e) {}
    // geen accounttoken? dan kan het een sessietoken zijn: een gast (de gratis
    // app) of een demo-pas; zo kan de boardroom ook de gratis app besturen
    let sessie = null;
    if (tok && !user) {
      try { sessie = sessionFor(tok) || null; if (sessie && sessie.tier) sessieTier = sessie.tier; } catch (e) {}
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
      /* Wie zich niet heeft bekendgemaakt, hoort alleen de neutrale zin -- de
         naam van een functie is geen publieke informatie. Sinds 18 augustus
         2026, en het is een besluit: zie de kop van schakelaar-antwoord.js voor
         wat het kost en waarom de statuscode 503 blijft. */
      return res.status(503).json(antwoord.dicht(bekendeBeller(user, sessie), dicht, doelgroep));
    }
    next();
  };
}

module.exports = { schakelaars, natieNaarLand, ZIN };
