/* RTG Memo: spraakmemo's leven als gewone bestanden in de RTG
   Bestanden-kluis (geen tweede opslaglaag); deze route doet alleen wat de
   kluis niet kan -- een korte Rahul-samenvatting van het transcript dat het
   TOESTEL zelf meeluisterde tijdens de opname. Er gaat geen audio door de
   AI en de server bewaart het transcript niet. Zonder AI-sleutel komt er
   een eerlijke demo-samenvatting, nooit neptekst die slim lijkt.
   Altijd-aan gemount; via de stuur-laag ook voor Rahul bereikbaar. */
const MAX_TRANSCRIPT = 8000;

module.exports = (kern) => {
  const { app, auth, anthropic } = kern;

  app.post('/api/memo/samenvat', auth, async (req, res) => {
    const t = String((req.body || {}).transcript || '').slice(0, MAX_TRANSCRIPT).trim();
    if (!t) return res.status(400).json({ error: 'Er is geen transcript; zet bij het opnemen het meeluisteren aan.' });
    const woorden = t.split(/\s+/).length;
    const basis = 'Demo-samenvatting (zonder AI-sleutel): je memo telt ongeveer ' + woorden +
      ' woorden en begint met "' + t.slice(0, 80) + (t.length > 80 ? '...' : '') + '"';
    if (!anthropic) return res.json({ ok: true, samenvatting: basis, ai: false });
    try {
      const r = await anthropic.messages.create({
        model: 'claude-sonnet-5', max_tokens: 300,
        system: 'Je bent Rahul, de rustige AI-assistent van RTG. Vat een ingesproken memo kort samen in het ' +
          'Nederlands (je/jij): maximaal drie zinnen, plus hooguit drie actiepunten als die er echt in zitten. ' +
          'Verzin niets en beloof nooit iets namens RTG.',
        messages: [{ role: 'user', content: 'Transcript van de memo:\n' + t }]
      });
      const tekst = r && r.content && r.content[0] && r.content[0].text;
      res.json({ ok: true, samenvatting: String(tekst || basis).trim(), ai: true });
    } catch (e) { res.json({ ok: true, samenvatting: basis, ai: false }); }
  });
};
