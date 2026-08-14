/* Member-submodule: de persoonlijke AI en Rahul/concierge-chat. De vrije
   AI-conversatie (model met regelgestuurde uitwijk) en de doorlopende chat met het
   eigen account (vertaald in de taal van het lid).
   Gemount vanuit routes/member.js. */
module.exports = (kern) => {
  const { app, auth, anthropic, aiSystemPrompt, cannedAnswer, trChat, convOf, talen,
    memberSays, accounts } = kern;
  const aiStatus = () => require('../../ai').beschikbaarheid(anthropic);

  app.post('/api/ai/status', auth, (req, res) => res.json(aiStatus()));

  app.post('/api/ai', auth, async (req, res) => {
    if (req.session.tier === 'guest') {
      return res.status(403).json({ error: 'De persoonlijke AI is exclusief voor leden.' });
    }
    // Alleen role/content overnemen, geschiedenis begrensd op de laatste 12 beurten.
    const history = (Array.isArray(req.body.messages) ? req.body.messages : [])
      .filter(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .map(m => ({ role: m.role, content: m.content.slice(0, 2000) }))
      .slice(-12);
    // De Claude API vereist dat het gesprek met een user-beurt begint; de
    // proactieve opener van de AI staat vooraan als assistant, knip die eraf.
    while (history.length && history[0].role !== 'user') history.shift();
    if (!history.length || history[history.length - 1].role !== 'user') {
      return res.status(400).json({ error: 'Geen vraag ontvangen.' });
    }

    if (anthropic) {
      try {
        const response = await anthropic.messages.create({
          model: 'claude-opus-4-8',
          max_tokens: 1024,
          system: aiSystemPrompt(req.session.tier, null, req.session.key),
          messages: history
        });
        const reply = response.content
          .filter(b => b.type === 'text')
          .map(b => b.text)
          .join('\n')
          .trim();
        return res.json({ reply: reply || 'Excuses, ik heb geen antwoord kunnen formuleren.', source: 'ai', ai: true, modus: 'ondersteund' });
      } catch (e) {
        console.error('AI-provider niet bereikbaar; handmatige werkmodus blijft actief:', e.message);
      }
    }
    /* De PAS gaat mee, want het register hangt eraan (AI_TONE in kern/ai.js:
       RTG tutoyeert, Lifestyle en Business spreken met u). Deze regel gaf hem
       eerst niet mee, en dit is de aanroep die zonder API-sleutel ALTIJD loopt
       -- dus in elke demo en de hele suite kreeg een RTG Pass-lid de u-vorm. */
    res.json({ reply: cannedAnswer(history[history.length - 1].content, req.session.tier), source: 'regels', ai: false, modus: 'handmatig' });
  });

  app.post('/api/chat/history', auth, (req, res) => {
    if (!req.session.account) return res.json({ messages: [], mode: 'rahul', leeg: true });
    // het lid leest alles (ook concierge-antwoorden) in de eigen taal
    trChat(convOf(req.session.account.id), talen.taalVan(req.body.lang)).then(messages => res.json({
      messages,
      mode: req.session.tier === 'rtg' ? 'rahul' : 'concierge',
      phone: accounts.phoneOf(req.session.account)
    }));
  });

  app.post('/api/chat/send', auth, async (req, res) => {
    if (!req.session.account) return res.status(403).json({ error: 'Alleen voor accounts.' });
    const text = String(req.body.text || '').trim();
    if (!text) return res.status(400).json({ error: 'Leeg bericht.' });
    const taal = talen.taalVan(req.body.lang);
    await memberSays(req.session.account, text, 'app', taal);
    const messages = await trChat(convOf(req.session.account.id), taal);
    res.json({ ok: true, messages, mode: req.session.tier === 'rtg' ? 'rahul' : 'concierge' });
  });
};
