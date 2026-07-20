/* Domein "techniek": het beveiligde technische statusbord voor de Backoffice.

   Alleen de eigenaar (standaard Rahul Imran Ismail, via RTG_OWNER_EMAIL) komt
   erin; hij kan anderen handmatig toegang geven. Het bord toont per subsysteem
   een groen/oranje/rood bolletje met de code en uitleg, laat zekeringen resetten
   ("er weer in doen") of met de hand uitschakelen, en heeft een AI die bij een
   storing een diagnose en herstelstappen geeft. */
const techniek = require('../techniek');
const functies = require('../functies');
const eigenaar = require('../eigenaar');
const dbmod = require('../db');
const { log } = require('../log');

module.exports = (kern) => {
  const { app, accounts, anthropic, archief, betaal, beveilig, crypto, db, mail, save, sendPushToUser, sessions, DATA_DIR, fs, path, LANDEN, keyVanCodenaam, gidsHaal, talen, onboarding,
    geldPasprijsZet, geldKortingZet, geldCommissieZet } = kern;
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
      if (beveilig) beveilig.meld('tech-toegang-geweigerd', 'kritiek',
        'Account "' + accounts.realNameOf(user) + '" probeerde de technische pagina te openen zonder recht.',
        { bron: 'user:' + user.id });
      return res.status(403).json({ error: 'Geen toegang tot de technische pagina.' });
    }
    req.techUser = user; next();
  }
  function eigenaarAlleen(req, res, next) {
    if (!isEigenaar(req.techUser)) return res.status(403).json({ error: 'Alleen de eigenaar mag dit.' });
    next();
  }

  function ctx() {
    return {
      db, accounts, anthropic, betaal, sessions, DATA_DIR, fs, path,
      STORE: dbmod.STORE, pgPing: dbmod.pgPing,
      mailGeconfigureerd: !!(process.env.SMTP_URL || process.env.SMTP_HOST),
      zekeringen: staat().zekeringen,
      // de geldlagen in de bewaking: beide grootboeken (wallet + bank) horen
      // met hun sluitcontrole op het bord, net als de nood-stand van de knop
      pay: kern.pay, bank: kern.bank, bankRegie: kern.bankregieOverzicht,
      // de stad in de bewaking: de Stadsdoos-vloot hoort erbij
      stad: kern.stad,
      // onze eigen fout-aggregatie (i.p.v. een externe tracker als Sentry)
      fouten: () => log.foutenSamenvatting()
    };
  }

  // Inloggen op de technische pagina: gewone accountgegevens, maar de toegang
  // wordt hier meteen gecontroleerd (anders 403, ook met geldig wachtwoord).
  app.post('/api/techniek/inloggen', async (req, res) => {
    const user = accounts.findByLogin(req.body.login);
    if (!user || !await accounts.verifyPassword(String(req.body.wachtwoord || ''), user.password_hash)) {
      if (beveilig) beveilig.meld('tech-login-mislukt', 'waarschuwing',
        'Mislukte inlogpoging op de technische pagina (login: ' + String(req.body.login || '').slice(0, 40) + ').',
        { bron: req.ip });
      return res.status(401).json({ error: 'Onjuiste inloggegevens.' });
    }
    if (!magInzien(user)) {
      // juist wachtwoord, maar geen recht op de technische pagina: hoog signaal
      if (beveilig) beveilig.meld('tech-login-zonder-recht', 'kritiek',
        'Account "' + accounts.realNameOf(user) + '" logde correct in maar heeft geen recht op de technische pagina.',
        { bron: 'user:' + user.id });
      return res.status(403).json({ error: 'Dit account heeft geen toegang tot de technische pagina.' });
    }
    res.json({ token: accounts.issueToken(user.id, 1), eigenaar: isEigenaar(user), naam: accounts.realNameOf(user) });
  });

  // Het statusbord: alle checks + zekeringen. Eigenaar ziet ook de toegangslijst.
  app.get('/api/techniek/status', techAuth, async (req, res) => {
    const checks = await techniek.draaiChecks(ctx());
    const t = staat();
    const zeker = Object.keys(t.zekeringen).map(id => ({ id, ...t.zekeringen[id] }));
    const cat = functies.catalogus(t.functies);
    const verzoeken = t.functieVerzoeken || [];
    const uit = {
      eigenaar: isEigenaar(req.techUser), naam: accounts.realNameOf(req.techUser),
      checks, zekeringen: zeker,
      functies: cat,
      doelgroepen: functies.DOELGROEPEN,
      functiesUit: cat.reduce((n, g) => n + g.functies.filter(f => !f.aan).length, 0),
      // extra beperkingen die alleen voor bepaalde doelgroepen gelden (functie
      // staat globaal aan, maar voor >=1 doelgroep uit)
      doelgroepUit: cat.reduce((n, g) => n + g.functies.reduce((m, f) => m + (f.aan ? f.doelgroepen.filter(d => !d.aan).length : 0), 0), 0),
      // open aanvragen bovenaan, daarna de laatst behandelde (audit-spoor)
      verzoeken: verzoeken.filter(v => v.status === 'wacht')
        .concat(verzoeken.filter(v => v.status !== 'wacht').slice(-8).reverse()),
      beveiliging: beveilig ? beveilig.samenvatting() : { open: 0, kritiek: 0, waarschuwing: 0, recent: [] },
      // eigen fout-aggregatie: totalen + de recentste storingsgroepen
      fouten: log.foutenSamenvatting(),
      samenvatting: {
        ok: checks.filter(c => c.status === 'ok').length,
        waarschuwing: checks.filter(c => c.status === 'waarschuwing').length,
        fout: checks.filter(c => c.status === 'fout').length
      }
    };
    if (isEigenaar(req.techUser)) {
      uit.toegang = t.toegang.map(id => { const u = accounts.getUserById(id); return { id, naam: u ? accounts.realNameOf(u) : '?', email: u ? accounts.emailOf(u) : null }; });
      // de juridische grenzen: waar zelfs de eigenaar bewust GEEN inzage heeft
      uit.grenzen = eigenaar.GRENZEN;
      // de archiefkast: instelbare live-vensterbreedte en de huidige verdeling
      uit.archief = archief ? { dagen: archief.dagen(), levend: (db.data.orders || []).length, gearchiveerd: archief.stat().aantal } : null;
      // de moderniseringsverzoeken die de eigenaar zelf via de AI heeft gevraagd
      uit.moderniseringen = (t.moderniseringen || []).slice(-8).reverse();
    }
    res.json(uit);
  });

  // Zekering resetten ("er weer in doen") of met de hand uitschakelen.
  app.post('/api/techniek/zekering', techAuth, eigenaarAlleen, (req, res) => {
    const t = staat();
    const z = t.zekeringen[req.body.id];
    if (!z) return res.status(404).json({ error: 'Onbekende zekering.' });
    if (req.body.actie === 'reset') { z.aan = true; z.reden = null; z.sindsGesprongen = null; }
    else if (req.body.actie === 'spring') { z.aan = false; z.reden = String(req.body.reden || 'handmatig uitgeschakeld').slice(0, 120); z.sindsGesprongen = Date.now(); }
    else return res.status(400).json({ error: 'Actie moet reset of spring zijn.' });
    save();
    res.json({ ok: true, id: req.body.id, aan: z.aan });
  });

  // De storingslijst (eigen fout-aggregatie) wissen: tellers terug naar nul.
  app.post('/api/techniek/fouten/wis', techAuth, eigenaarAlleen, (req, res) => {
    log.foutenReset();
    res.json({ ok: true });
  });

  /* De overige domeinen draaien als submodules op dezelfde gedeelde context
     (een keer bij het opstarten gemount, geen kosten per verzoek). */
  const tctx = { app, accounts, anthropic, archief, beveilig, crypto, db, mail, save, sendPushToUser,
    LANDEN, keyVanCodenaam, talen, onboarding, staat, eigenaarUser, isEigenaar, magInzien, techAuth, eigenaarAlleen, ctx,
    geldPasprijsZet, geldKortingZet, geldCommissieZet };
  require('./techniek/functie')(tctx);
  require('./techniek/boardroom')(tctx);
  require('./techniek/beheer')(tctx);

  // Hulp voor de kern: mag een door een zekering bewaakt subsysteem draaien?
  kern.zekeringMag = (id) => { const z = db.data.techniek && db.data.techniek.zekeringen && db.data.techniek.zekeringen[id]; return !z || z.aan !== false; };
};
