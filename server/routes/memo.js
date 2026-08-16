/* RTG Memo: spraakmemo's leven als gewone bestanden in de RTG
   Bestanden-kluis (geen tweede opslaglaag); deze route doet alleen wat de
   kluis niet kan -- een korte samenvatting van het transcript dat het TOESTEL
   zelf meeluisterde tijdens de opname. Er gaat geen audio naar een model en de
   server bewaart het transcript niet. Selecteren en actiepunten aanwijzen kan
   betrouwbaar lokaal, dus daar wordt geen AI-provider voor aangeroepen.
   Altijd-aan gemount; via de stuur-laag ook voor Rahul bereikbaar. */
const { samenvat, actiepunten } = require('../lib/lokale-taal');
const MAX_TRANSCRIPT = 8000;

module.exports = (kern) => {
  const { app, auth } = kern;

  app.post('/api/memo/samenvat', auth, async (req, res) => {
    const t = String((req.body || {}).transcript || '').slice(0, MAX_TRANSCRIPT).trim();
    if (!t) return res.status(400).json({ error: 'Er is geen transcript; zet bij het opnemen het meeluisteren aan.' });
    const woorden = t.split(/\s+/).length;
    const samenvatting = samenvat(t, { maxZinnen: 3, maxTekens: 700 }) || t.slice(0, 700);
    const acties = actiepunten(t, { max: 3 });
    const extra = acties.filter(a => !samenvatting.toLowerCase().includes(a.wat.toLowerCase()))
      .map(a => '- ' + a.wat);
    const uit = samenvatting + (extra.length ? '\n\nActies:\n' + extra.join('\n') : '');
    res.json({ ok: true, samenvatting: uit, ai: false, bron: 'lokale-taal', modus: 'handmatig', woorden });
  });
};
