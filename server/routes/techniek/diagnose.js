/* Techniek-diagnose per gemeten check ("wat is er aan de hand en hoe los ik
   het op?") met vaste, auditeerbare herstelstappen. Afgesplitst uit ./beheer
   zodat elk deel onder de 10 KB blijft; draait op dezelfde techniek-context. */
const techniek = require('../../techniek');
module.exports = (tctx) => {
  const { app, techAuth, ctx } = tctx;

  // Historische /ai-URL; de diagnose zelf is lokaal, deterministisch en
  // blijft daarom ook beschikbaar wanneer model-AI in de boardroom uitstaat.
  app.post('/api/techniek/ai', techAuth, async (req, res) => {
    const checks = await techniek.draaiChecks(ctx());
    const chk = checks.find(c => c.id === req.body.checkId);
    if (!chk) return res.status(404).json({ error: 'Onbekende check.' });
    const advies = canned(chk);
    res.json({ check: { id: chk.id, naam: chk.naam, code: chk.code, status: chk.status },
      advies, bron: 'ingebouwd', ai: false });
  });

  // Terugvaladvies zonder AI-sleutel: vaste, nuttige herstelstappen per check.
  function canned(chk) {
    const t = {
      postgres: '- Controleer of PostgreSQL draait en bereikbaar is.\n- Controleer DATABASE_URL (host, poort, wachtwoord).\n- Kijk of het connection-limiet niet vol zit (PG_POOL_MAX).\n- De app draait intussen door op de lokale snapshot als fallback.',
      schijf: '- Ruim oude bestanden/back-ups op in de datamap.\n- Vergroot de schijf of het volume.\n- Controleer of logs niet vollopen.',
      backups: '- Controleer of de back-uptaak draait (dagelijks).\n- Controleer schrijfrechten op de back-upmap.\n- Zet RTG_BACKUP_DIR voor een tweede kopie.',
      email: '- Zet SMTP_URL of SMTP_HOST/PORT/USER/PASS.\n- Test met een herstel-mail.',
      betalingen: '- Zet STRIPE_SECRET_KEY en STRIPE_WEBHOOK_SECRET voor echte betalingen.',
      ai: '- Configureer LOCAL_AI_URL en LOCAL_AI_MODEL voor lokale vrije taal, of laat de regelgestuurde werkmodus bewust actief.',
      versleuteling: '- Zet RTG_ENC_KEY (64 hex-tekens) voor versleuteling-at-rest.'
    };
    return (t[chk.id] || '- Bekijk de logs rond dit subsysteem.\n- Controleer de bijbehorende omgevingsvariabelen.') +
      '\n\n(Ingebouwde diagnose op basis van de gemeten check.)';
  }
};
