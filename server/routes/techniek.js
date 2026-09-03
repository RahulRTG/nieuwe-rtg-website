/* Domein "techniek": het beveiligde technische statusbord voor de Backoffice.

   Alleen de eigenaar (standaard Rahul Imran Ismail, via RTG_OWNER_EMAIL) komt
   erin; hij kan anderen handmatig toegang geven. Het bord toont per subsysteem
   een bolletje met code en uitleg, laat zekeringen resetten of met de hand
   uitschakelen, en heeft een AI die bij een storing herstelstappen geeft. */
const techniek = require('../techniek');
const functies = require('../functies');
const eigenaar = require('../eigenaar');
const inzagelog = require('../inzagelog');
const envelop = require('../opzet/envelop');
const { log } = require('../log');

module.exports = (kern) => {
  const { app, accounts, anthropic, archief, betaal, beveilig, crypto, db, mail, save, sendPushToUser,
          sessions, DATA_DIR, fs, path, LANDEN, keyVanCodenaam, talen, onboarding, geldPasprijsZet,
          geldKortingZet, geldCommissieZet,
          // de gedeelde inlogrem: dezelfde teller en dezelfde vijf minuten als elders
    tooManyTries,
          noteFailedTry, loginFails } = kern;
  const OWNER_EMAIL = eigenaar.OWNER_EMAIL;

  function staat() {
    if (!db.data.techniek) db.data.techniek = {};
    const t = db.data.techniek;
    if (!Array.isArray(t.toegang)) t.toegang = [];
    if (!t.functies) t.functies = {}; // leeg = alles op de standaard (aan)
    if (!t.zekeringen) t.zekeringen = techniek.standaardZekeringen();
    // ontbrekende standaard-zekeringen bijvullen (voor nieuwe versies)
    const std = techniek.standaardZekeringen();
    for (const k of Object.keys(std)) if (!t.zekeringen[k]) t.zekeringen[k] = std[k];
    return t;
  }
  function eigenaarUser() {
    const t = staat();
    if (t.eigenaarId) { const u = accounts.getUserById(t.eigenaarId); if (u) return u; }
    const u = accounts.findByLogin(OWNER_EMAIL);
    if (u) { t.eigenaarId = u.id; save(); }
    return u || null;
  }
  function isEigenaar(user) { const o = eigenaarUser(); return !!(user && o && user.id === o.id); }
  function magInzien(user) { if (!user) return false; if (isEigenaar(user)) return true; return staat().toegang.includes(user.id); }

  function gebruikerUit(req) {
    const auth = req.get('authorization') || '';
    const token = auth.replace(/^Bearer\s+/i, '') || (req.body && req.body.token) || req.query.token;
    return token ? accounts.verifyToken(token) : null;
  }
  function techAuth(req, res, next) {
    const user = gebruikerUit(req);
    if (!user) return res.status(401).json({ error: 'Log in met je account.' });
    if (!magInzien(user)) {
      // een GELDIG account dat toch de technische pagina probeert te openen: dit
      // is een mogelijke rechten-escalatie -> meteen een kritieke melding
      /* GEEN ECHTE NAAM OP HET VEILIGHEIDSBORD.

         Dit haalde de naam uit de identiteitskluis en zette hem in een melding
         die daarna gewoon in db.data blijft staan. Twee dingen mis: de naam
         lekt uit de kluis naar de gedeelde database (het hele codenaam-ontwerp
         is dat hij daar NIET staat), en de opvraging ging langs het
         inzagejournaal heen -- terwijl elke andere weg naar die naam er wel in
         komt. Een uitzondering die niemand aanvroeg.

         De melding draagt nu de identiteitssleutel. Wie wil weten wie dat is,
         vraagt het op via /api/office/inzage, en dan staat die opvraging
         netjes in het journaal. Precies zoals het hoort. */
      if (beveilig) beveilig.meld('tech-toegang-geweigerd', 'kritiek',
        'Account user-' + user.id + ' probeerde de technische pagina te openen zonder recht.',
        { bron: 'user:' + user.id });
      return res.status(403).json({ error: 'Geen toegang tot de technische pagina.' });
    }
    envelop.zet(req, { soort: 'techniek', id: 'user-' + user.id, identiteit: 'bewezen',
      gezagBron: isEigenaar(user) ? 'eigenaar' : 'toegekend', gezagBaas: !!isEigenaar(user) });
    req.techUser = user; next();
  }
  function eigenaarAlleen(req, res, next) {
    if (!isEigenaar(req.techUser)) return res.status(403).json({ error: 'Alleen de eigenaar mag dit.' });
    next();
  }

  const ctx = require('./techniek/context')({
    kern, db, accounts, anthropic, betaal, sessions, DATA_DIR, fs, path, mail,
    zekeringen: () => staat().zekeringen
  });
  /* DE KETENLEZER voor het zegel van de beschermstand: bij het omzetten wordt de
     hashketen van het journaal nagelopen en de uitslag bewaard. Lui, want
     kern.command bestaat op dit punt in de montage nog niet.

     DIT IS EEN BEWUSTE KOPPELING techniek -> command, en de enige. De hashketen
     van het journaal is het enige bewijs in dit huis dat kán breken als er iets
     aan de historie verandert; een tweede keten voor de techniekkant zou de
     teller sparen en de regel dupliceren, en dat is precies de ruil die LAT.md
     regel 4 verbiedt. Hij staat als kernGedeeld in NORM.json, met deze reden. */
  /* De isolatielaag wordt verderop gemount, maar de incidentcontrole heeft haar
     ceremonie NU al nodig: `herstel` verlaagt de stand van het hele platform en
     die weg hoort niet zwakker te zijn dan de weg waarlangs een lid zijn eigen
     sessie ontsluit. Lui doorgegeven, want de laag bestaat op dit punt nog niet
     -- hem hier bouwen zou een tweede exemplaar maken met een eigen lijst
     ceremonies, en dan dekt een ceremonie die de een kent de ander niet. */
  let isolatieDeel = null;
  const controle = require('./techniek/controle')({ app, db, save, beveilig,
    av: kern.antivirus, techAuth, eigenaarAlleen,
    journaal: () => (kern.command ? kern.command.journaal : null),
    ontsluitpoort: (vraag) => {
      if (!isolatieDeel) {
        const e = new Error('De isolatielaag is niet gemonteerd; de ceremonie voor het platform kan ' +
          'niet worden nagekeken. Herstel loopt hier niet omheen.');
        e.status = 503;
        throw e;
      }
      return isolatieDeel.isolatie.huisCeremoniePoort(vraag);
    } });

  /* Het statusbord staat in ./techniek/bord.js: het is een groot antwoord dat
     uit tien bronnen wordt samengesteld, en dat leest beter als een geheel dan
     tussen de knoppen die het bord bedienen. */
  require('./techniek/bord')({ techniek, functies, eigenaar, inzagelog, log,
    accounts, archief, beveilig, db, app, ctx, staat, isEigenaar, techAuth,
    bewaren: () => bewaarDeel, foutmelder: kern.foutmelder,
    controle,
    // de spelcijfers zijn een BORD-lezing en horen dus daar; zie ./techniek/bord.js
    spelTelemetrie: kern.spelTelemetrie });

  /* De drie eigenaar-knoppen (alarmzelfproef, zekering, storingslijst wissen)
     staan in ./techniek/knoppen.js: dit bestand monteert domeinen. */
  require('./techniek/knoppen')({ app, kern, accounts, staat, save, log, beveilig,
    techAuth, eigenaarAlleen });

  /* De overige domeinen draaien als submodules op dezelfde gedeelde context
     (een keer bij het opstarten gemount, geen kosten per verzoek). */
  /* `appUrl` reist mee omdat de isolatiecockpit een WebAuthn-grens nodig heeft
     en die NOOIT uit een kop mag komen: zou de origin uit Origin of Host komen,
     dan kiest de aanvrager zijn eigen grens en is de binding een formaliteit.
     Zelfde afspraak als routes/rtgid.js en routes/auth/webauthn.js. */
  const tctx = { app, accounts, anthropic, appUrl: kern.appUrl, archief, beveilig, wacht: kern.wacht, av: kern.antivirus, crypto, db, mail, save, sendPushToUser,
    LANDEN, keyVanCodenaam, talen, onboarding, staat, eigenaarUser, isEigenaar, magInzien, techAuth, eigenaarAlleen, ctx,
    betaalRegie: kern.betaalRegie, geldPasprijsZet, geldKortingZet, geldCommissieZet, tooManyTries, noteFailedTry, loginFails, kern };
  require('./techniek/inlog')(tctx);   // de inlog op deze pagina, met rem en gelijk antwoord
  const bewaarDeel = require('./techniek/bewaren')(tctx);
  require('./techniek/functie')(tctx);
  require('./techniek/boardroom')(tctx);
  require('./techniek/betalingen')(tctx);
  require('./techniek/aikosten')(tctx);  // de stand van de modelkraan (server/ai-meter.js)
  require('./techniek/beheer')(tctx);
  require('./techniek/wacht')(tctx);
  require('./techniek/papieren')(tctx);
  require('./techniek/sso')(tctx);
  /* De tenants: welke org IS de klant, en welke werkruimtes en zaken vallen
     eronder. Naast de SSO-koppelingen en achter dezelfde poort -- het is
     dezelfde grens, van de andere kant bekeken. */
  require('./techniek/tenant')(tctx);
  /* De toestandsvingerafdruk: per collectie een aantal en een gezouten hash,
     nooit inhoud. Draagt de vier matrixkolommen die over de TOESTAND gaan. */
  require('./techniek/vingerafdruk')(tctx);
  /* De isolatiecockpit: dezelfde standen als de incidentcontrole, maar per
     DRAGER (organisatie, identiteit, sessie, apparaat) in plaats van huis-breed.
     Hij leest de huisstand uit de incidentcontrole en bezit hem niet. */
  isolatieDeel = require('./techniek/isolatie')(tctx);

  // Hulp voor de kern: mag een door een zekering bewaakt subsysteem draaien?
  kern.zekeringMag = (id) => { const z = db.data.techniek && db.data.techniek.zekeringen && db.data.techniek.zekeringen[id]; return !z || z.aan !== false; };
};
