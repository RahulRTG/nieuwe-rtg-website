/* Techniek-diagnose: de AI-hulp per check ("wat is er aan de hand en hoe los ik
   het op?") met een ingebouwd terugvaladvies zonder AI-sleutel. De zekering
   'ai' in de boardroom sluit deze route af. Afgesplitst uit ./beheer zodat elk
   deel onder de 10 KB blijft; draait op dezelfde techniek-context. */
const techniek = require('../../techniek');
module.exports = (tctx) => {
  const { app, anthropic, staat, techAuth, ctx } = tctx;

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
      email: '- Zet een geldige SMTP_URL.\n- Test met een herstel-mail en controleer de aflevering.',
      betalingen: '- Zet STRIPE_SECRET_KEY en STRIPE_WEBHOOK_SECRET voor echte betalingen.',
      ai: '- Zet ANTHROPIC_API_KEY voor echte AI-antwoorden.',
      versleuteling: '- Zet RTG_ENC_KEY (64 hex-tekens) voor versleuteling-at-rest.'
    };
    return (t[chk.id] || '- Bekijk de logs rond dit subsysteem.\n- Controleer de bijbehorende omgevingsvariabelen.') +
      '\n\n(Ingebouwd advies; zet ANTHROPIC_API_KEY voor een AI-diagnose op maat.)';
  }
};
