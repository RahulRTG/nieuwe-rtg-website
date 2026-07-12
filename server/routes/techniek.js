/* Domein "techniek": het beveiligde technische statusbord voor de Backoffice.

   Alleen de eigenaar (standaard Rahul Imran Ismail, via RTG_OWNER_EMAIL) komt
   erin; hij kan anderen handmatig toegang geven. Het bord toont per subsysteem
   een groen/oranje/rood bolletje met de code en uitleg, laat zekeringen resetten
   ("er weer in doen") of met de hand uitschakelen, en heeft een AI die bij een
   storing een diagnose en herstelstappen geeft. */
const techniek = require('../techniek');
const dbmod = require('../db');

module.exports = (kern) => {
  const { app, accounts, anthropic, betaal, db, save, sessions, DATA_DIR, fs, path } = kern;
  const OWNER_EMAIL = process.env.RTG_OWNER_EMAIL || 'rahul@rtg.example';

  function staat() {
    if (!db.data.techniek) db.data.techniek = {};
    const t = db.data.techniek;
    if (!Array.isArray(t.toegang)) t.toegang = [];
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
    if (!magInzien(user)) return res.status(403).json({ error: 'Geen toegang tot de technische pagina.' });
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
      zekeringen: staat().zekeringen
    };
  }

  // Inloggen op de technische pagina: gewone accountgegevens, maar de toegang
  // wordt hier meteen gecontroleerd (anders 403, ook met geldig wachtwoord).
  app.post('/api/techniek/inloggen', (req, res) => {
    const user = accounts.findByLogin(req.body.login);
    if (!user || !accounts.verifyPassword(String(req.body.wachtwoord || ''), user.password_hash))
      return res.status(401).json({ error: 'Onjuiste inloggegevens.' });
    if (!magInzien(user)) return res.status(403).json({ error: 'Dit account heeft geen toegang tot de technische pagina.' });
    res.json({ token: accounts.issueToken(user.id, 1), eigenaar: isEigenaar(user), naam: accounts.realNameOf(user) });
  });

  // Het statusbord: alle checks + zekeringen. Eigenaar ziet ook de toegangslijst.
  app.get('/api/techniek/status', techAuth, async (req, res) => {
    const checks = await techniek.draaiChecks(ctx());
    const t = staat();
    const zeker = Object.keys(t.zekeringen).map(id => ({ id, ...t.zekeringen[id] }));
    const uit = {
      eigenaar: isEigenaar(req.techUser), naam: accounts.realNameOf(req.techUser),
      checks, zekeringen: zeker,
      samenvatting: {
        ok: checks.filter(c => c.status === 'ok').length,
        waarschuwing: checks.filter(c => c.status === 'waarschuwing').length,
        fout: checks.filter(c => c.status === 'fout').length
      }
    };
    if (isEigenaar(req.techUser)) {
      uit.toegang = t.toegang.map(id => { const u = accounts.getUserById(id); return { id, naam: u ? accounts.realNameOf(u) : '?', email: u ? accounts.emailOf(u) : null }; });
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

  // Iemand handmatig toegang geven of intrekken (alleen de eigenaar).
  app.post('/api/techniek/toegang', techAuth, eigenaarAlleen, (req, res) => {
    const t = staat();
    const doel = accounts.findByLogin(req.body.email);
    if (!doel) return res.status(404).json({ error: 'Geen account met dat e-mailadres of die gebruikersnaam.' });
    if (isEigenaar(doel)) return res.status(400).json({ error: 'De eigenaar heeft altijd al toegang.' });
    if (req.body.actie === 'intrek') t.toegang = t.toegang.filter(id => id !== doel.id);
    else if (!t.toegang.includes(doel.id)) t.toegang.push(doel.id);
    save();
    res.json({ ok: true, toegang: t.toegang.length });
  });

  // AI-hulp: geef een diagnose en herstelstappen voor een (falende) check.
  app.post('/api/techniek/ai', techAuth, async (req, res) => {
    if (staat().zekeringen.ai && staat().zekeringen.ai.aan === false)
      return res.status(503).json({ error: 'De AI-zekering staat uit.' });
    const checks = await techniek.draaiChecks(ctx());
    const chk = checks.find(c => c.id === req.body.checkId);
    if (!chk) return res.status(404).json({ error: 'Onbekende check.' });
    const prompt = `Je bent de technische assistent van het RTG-platform (Node.js/Express, PostgreSQL). ` +
      `Subsysteem "${chk.naam}" (code ${chk.code}) heeft status ${chk.status.toUpperCase()}: ${chk.detail}\n` +
      `Geef in het Nederlands een korte diagnose en concrete herstelstappen (maximaal 6 bondige bullets). ` +
      `Noem waar nuttig de betrokken omgevingsvariabele of het bestand.`;
    let advies;
    if (anthropic) {
      try {
        const r = await anthropic.messages.create({ model: 'claude-opus-4-8', max_tokens: 600, messages: [{ role: 'user', content: prompt }] });
        advies = (r.content && r.content[0] && r.content[0].text) || null;
      } catch (e) { advies = null; }
    }
    if (!advies) advies = canned(chk);
    res.json({ check: { id: chk.id, naam: chk.naam, code: chk.code, status: chk.status }, advies, bron: anthropic ? 'ai' : 'ingebouwd' });
  });

  // Terugvaladvies zonder AI-sleutel: vaste, nuttige herstelstappen per check.
  function canned(chk) {
    const t = {
      postgres: '- Controleer of PostgreSQL draait en bereikbaar is.\n- Controleer DATABASE_URL (host, poort, wachtwoord).\n- Kijk of het connection-limiet niet vol zit (PG_POOL_MAX).\n- De app draait intussen door op de lokale snapshot als fallback.',
      schijf: '- Ruim oude bestanden/back-ups op in de datamap.\n- Vergroot de schijf of het volume.\n- Controleer of logs niet vollopen.',
      backups: '- Controleer of de back-uptaak draait (dagelijks).\n- Controleer schrijfrechten op de back-upmap.\n- Zet RTG_BACKUP_DIR voor een tweede kopie.',
      email: '- Zet SMTP_URL of SMTP_HOST/PORT/USER/PASS.\n- Test met een herstel-mail.',
      betalingen: '- Zet STRIPE_SECRET_KEY en STRIPE_WEBHOOK_SECRET voor echte betalingen.',
      ai: '- Zet ANTHROPIC_API_KEY voor echte AI-antwoorden.',
      versleuteling: '- Zet RTG_ENC_KEY (64 hex-tekens) voor versleuteling-at-rest.'
    };
    return (t[chk.id] || '- Bekijk de logs rond dit subsysteem.\n- Controleer de bijbehorende omgevingsvariabelen.') +
      '\n\n(Ingebouwd advies; zet ANTHROPIC_API_KEY voor een AI-diagnose op maat.)';
  }

  // Hulp voor de kern: mag een door een zekering bewaakt subsysteem draaien?
  kern.zekeringMag = (id) => { const z = db.data.techniek && db.data.techniek.zekeringen && db.data.techniek.zekeringen[id]; return !z || z.aan !== false; };
};
