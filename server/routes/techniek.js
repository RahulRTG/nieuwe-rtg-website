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
  const controle = require('./techniek/controle')({ app, db, save, beveilig,
    av: kern.antivirus, techAuth, eigenaarAlleen });

  /* Het statusbord staat in ./techniek/bord.js: het is een groot antwoord dat
     uit tien bronnen wordt samengesteld, en dat leest beter als een geheel dan
     tussen de knoppen die het bord bedienen. */
  require('./techniek/bord')({ techniek, functies, eigenaar, inzagelog, log,
    accounts, archief, beveilig, db, app, ctx, staat, isEigenaar, techAuth,
    bewaren: () => bewaarDeel, foutmelder: kern.foutmelder,
    controle,
    // de spelcijfers zijn een BORD-lezing en horen dus daar; zie ./techniek/bord.js
    spelTelemetrie: kern.spelTelemetrie });

  /* DE ZELFPROEF VAN DE ALARMWEG.

     Op de go-live-lijst stond "er komt een testfout binnen" als vinkje. Dat is
     niet af te vinken zonder met de hand een echte storing te veroorzaken, dus
     werd het afgevinkt op vertrouwen -- en juist die regel wees naar
     SENTRY_DSN, een variabele die niets leest. Een alarm dat je niet kunt
     beproeven is geen alarm.

     Deze knop stuurt een echte POST naar de ingestelde webhook, met soort
     "zelfproef" zodat de ontvanger weet dat het geen storing is, en WACHT op
     het antwoord. Je krijgt terug of het adres klopt, in plaats van te hopen.

     Alleen de eigenaar: het adres van de alarmweg is bedrijfsgevoelig, en een
     knop die verkeer naar buiten stuurt hoort niet bij iedereen met toegang
     tot het techniekbord te liggen. */
  app.post('/api/techniek/alarm/proef', techAuth, eigenaarAlleen, async (req, res) => {
    const melder = kern.foutmelder;
    if (!melder) return res.status(503).json({ ok: false, reden: 'de fout-melder is niet bedraad.' });
    const wie = (() => { try { return req.techUser ? accounts.realNameOf(req.techUser) : 'eigenaar'; } catch (e) { return 'eigenaar'; } })();
    const r = await melder.zelfproef(wie);
    res.json(Object.assign({ ok: !!r.ok }, r, { stand: melder.stand() }));
  });

  // Zekering resetten ("er weer in doen") of met de hand uitschakelen.
  app.post('/api/techniek/zekering', techAuth, eigenaarAlleen, (req, res) => {
    const t = staat();
    /* hasOwnProperty, geen kale indexering: met id "__proto__" leverde
       t.zekeringen[id] het prototype van Object op. Dat is truthy, dus de
       controle hieronder liet hem door, en de regels erna zetten .aan en
       .reden op Object.prototype -- vanaf dat moment heeft ELK object in dit
       proces die velden. Dat is niet alleen rommel: code die ergens
       `if (x.aan === false)` doet, verandert dan stil van gedrag. Alleen de
       eigenaar komt hier, maar een grendel die op vertrouwen leunt is geen
       grendel. */
    const zid = String(req.body.id || '');
    const z = Object.prototype.hasOwnProperty.call(t.zekeringen, zid) ? t.zekeringen[zid] : null;
    if (!z) return res.status(404).json({ error: 'Onbekende zekering.' });
    if (req.body.actie === 'reset') { z.aan = true; z.reden = null; z.sindsGesprongen = null; }
    else if (req.body.actie === 'spring') { z.aan = false; z.reden = String(req.body.reden || 'handmatig uitgeschakeld').slice(0, 120); z.sindsGesprongen = Date.now(); }
    else return res.status(400).json({ error: 'Actie moet reset of spring zijn.' });
    save();
    res.json({ ok: true, id: zid, aan: z.aan });
  });

  // De storingslijst (eigen fout-aggregatie) wissen: tellers terug naar nul.
  app.post('/api/techniek/fouten/wis', techAuth, eigenaarAlleen, (req, res) => {
    /* Wissen mag -- het is de storingslijst van de eigenaar -- maar niet
       spoorloos. Deze lijst is het enige wat vertelt dat er iets mis is
       geweest; een knop die hem leegt zonder een regel achter te laten is een
       knop om een incident te laten verdwijnen. Het aantal gaat mee, want juist
       "er stonden er 400 en nu nul" is wat je later wilt kunnen teruglezen. */
    const hoeveel = (log.foutenSamenvatting() || {}).totaal || 0;
    log.foutenReset();
    if (beveilig) beveilig.meld('fouten-gewist', 'waarschuwing',
      'De storingslijst is gewist (' + hoeveel + ' geteld) door user-' + (req.techUser && req.techUser.id) + '.',
      { bron: 'user:' + (req.techUser && req.techUser.id) });
    res.json({ ok: true, gewist: hoeveel });
  });

  /* De overige domeinen draaien als submodules op dezelfde gedeelde context
     (een keer bij het opstarten gemount, geen kosten per verzoek). */
  const tctx = { app, accounts, anthropic, archief, beveilig, wacht: kern.wacht, av: kern.antivirus, crypto, db, mail, save, sendPushToUser,
    LANDEN, keyVanCodenaam, talen, onboarding, staat, eigenaarUser, isEigenaar, magInzien, techAuth, eigenaarAlleen, ctx,
    betaalRegie: kern.betaalRegie, geldPasprijsZet, geldKortingZet, geldCommissieZet, tooManyTries, noteFailedTry, loginFails, kern };
  require('./techniek/inlog')(tctx);   // de inlog op deze pagina, met rem en gelijk antwoord
  const bewaarDeel = require('./techniek/bewaren')(tctx);
  require('./techniek/functie')(tctx);
  require('./techniek/boardroom')(tctx);
  require('./techniek/betalingen')(tctx);
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

  // Hulp voor de kern: mag een door een zekering bewaakt subsysteem draaien?
  kern.zekeringMag = (id) => { const z = db.data.techniek && db.data.techniek.zekeringen && db.data.techniek.zekeringen[id]; return !z || z.aan !== false; };
};
