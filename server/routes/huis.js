/* Routes voor Het Huis: het reisdossier achter de hoofdingang.

   Twee endpoints en verder niets: het dossier zelf, en het dossier als platte
   tekst om mee te nemen. Alles achter de leden-inlog, en alles op de sessie --
   nooit een sleutel of een lidnummer uit de body, want dan kon je in het
   dossier van een ander kijken. */
module.exports = (kern) => {
  const { app, auth, huis, anthropic } = kern;
  if (!huis) return;

  app.post('/api/member/huis/dossier', auth, (req, res) => res.json(huis.dossier(req.session)));

  app.post('/api/member/huis/map', auth, (req, res) => res.json(huis.map(req.session)));

  /* Rahul over het dossier. De MODULE telt (hoeveel er open staat, hoeveel dagen
     nog); Rahul verwoordt hoogstens. Zonder AI-sleutel is de vaste zin het
     antwoord -- die is al compleet, want hij komt uit dezelfde telling. Rahul
     verzint hier dus nooit een onderdeel bij en belooft nooit een bevestiging:
     dat is precies waar dit dossier eerlijk over hoort te zijn. */
  app.post('/api/member/huis/rahul', auth, async (req, res) => {
    const d = huis.dossier(req.session);
    if (!anthropic || !d.reis) return res.json({ ok: true, tekst: d.tekst, ai: false });
    try {
      const feiten = [
        'Bestemming: ' + d.reis.bestemming,
        'Wanneer: ' + d.reis.datums,
        d.reis.nogDagen == null ? '' : ('Dagen tot vertrek: ' + d.reis.nogDagen),
        'Bevestigd: ' + d.bevestigd + ' van ' + d.tijdlijn.length,
        'Vraagt aandacht: ' + d.open.map(o => o.wat).join('; '),
        'Wacht op een partner: ' + d.afwachten.map(a => a.wat).join('; ')
      ].filter(Boolean).join('\n');
      const r = await anthropic.messages.create({
        model: 'claude-sonnet-5', max_tokens: 260,
        system: 'Je bent Rahul, de rustige conciërge van RTG. Vat een reisdossier samen in het Nederlands, in de u-vorm, ' +
          'in maximaal vier zinnen. Zeg wat er nog aandacht vraagt en wat alleen afgewacht wordt. ' +
          'Verzin NOOIT een onderdeel, een datum of een merk erbij, en zeg nooit dat iets bevestigd of geboekt is ' +
          'als dat er niet staat. Beloof nooit iets wat niet vaststaat: geen toegang tot een pas of dienst, ' +
          'geen goedkeuring, geen boeking. Geen aanmoediging, geen haast, geen uitroeptekens.',
        messages: [{ role: 'user', content: 'Dossier:\n' + feiten }]
      });
      const t = r && r.content && r.content[0] && r.content[0].text;
      res.json({ ok: true, tekst: String(t || '').trim() || d.tekst, ai: true });
    } catch (e) { res.json({ ok: true, tekst: d.tekst, ai: false }); }
  });
};
