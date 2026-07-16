/* Fluister: de persoonlijke assistent van het hele ecosysteem. Een soort
   Siri, maar dan voor deze code: iedereen gebruikt hem voor zichzelf, en hij
   leert de gebruiker kennen.

   Twee soorten geheugen, allebei van de gebruiker zelf:
   - weetjes: wat je hem expliciet vertelt ("onthoud dat ik cava drink,
     nooit rode wijn"); wisbaar per stuk of in een keer, en altijd
     opvraagbaar ("wat weet je over mij?") - volledige transparantie.
   - focus: welke schermen en kaarten je het meest gebruikt (geteld door de
     inklap-laag in de apps). Daarmee weet hij waar je heen wilt en klapt
     de app precies open wat jouw ogen nodig hebben.

   Antwoorden komen van Claude als er een sleutel is, anders van de eigen
   regels; het geheugen en de actuele stand van het lid (bestellingen,
   reserveringen, assets) reizen als context mee. */
module.exports = ({ db, save, schoon, anthropic }) => {
  const nu = () => new Date().toISOString();
  const lijsten = () => { if (!db.data.fluister) db.data.fluister = {}; };
  const van = key => {
    lijsten();
    return db.data.fluister[key] || (db.data.fluister[key] = { weetjes: [], focus: {}, at: nu() });
  };

  function fluisterOnthoud(key, tekstIn) {
    const tekst = schoon(String(tekstIn || '').replace(/^onthoud\s+(dat\s+|alsjeblieft\s+)?/i, ''), 200);
    if (!tekst) return { status: 400, error: 'Vertel me wat ik moet onthouden.' };
    const p = van(key);
    if (!p.weetjes.some(w => w.tekst.toLowerCase() === tekst.toLowerCase())) {
      p.weetjes.push({ tekst, at: nu() });
      p.weetjes = p.weetjes.slice(-30);
      save();
    }
    return { ok: true, weetjes: p.weetjes };
  }
  function fluisterVergeet(key, wat) {
    const p = van(key);
    if (wat === 'alles') p.weetjes = [];
    else {
      const i = parseInt(wat, 10);
      if (!(i >= 0) || i >= p.weetjes.length) return { status: 404, error: 'Dat weetje ken ik niet.' };
      p.weetjes.splice(i, 1);
    }
    save();
    return { ok: true, weetjes: p.weetjes };
  }
  // de inklap-laag stuurt door wat je het meest gebruikt; alleen tellers, nooit inhoud
  function fluisterFocus(key, scoresIn) {
    const p = van(key);
    const scores = scoresIn && typeof scoresIn === 'object' ? scoresIn : {};
    for (const [naam, n] of Object.entries(scores).slice(0, 40)) {
      const k = schoon(naam, 40);
      if (k && Number.isFinite(Number(n))) p.focus[k] = Math.min(100000, Math.max(0, Math.round(Number(n))));
    }
    save();
    return { ok: true };
  }
  const topFocus = (p, n) => Object.entries(p.focus).sort((a, b) => b[1] - a[1]).slice(0, n).map(x => x[0]);

  function fluisterProfiel(key) {
    const p = van(key);
    return { ok: true, weetjes: p.weetjes, top: topFocus(p, 5) };
  }

  // de actuele stand van dit lid, kort: dat maakt de antwoorden persoonlijk
  function standVan(key) {
    const delen = [];
    const orders = (db.data.orders || []).filter(o => (o.customerKey || o.customerTier) === key && !['geserveerd', 'geweigerd', 'terugbetaald', 'bezorgd', 'opgehaald'].includes(o.status));
    if (orders.length) delen.push(orders.length + ' lopende bestelling(en)');
    const res = (db.data.reserveringen || []).filter(r => r.customerKey === key && ['aangevraagd', 'bevestigd'].includes(r.status));
    if (res.length) delen.push('eerstvolgende reservering ' + res[0].datum + ' ' + res[0].tijd + ' bij ' + res[0].supplierName);
    const vb = (db.data.verblijven || []).filter(v => (v.customerKey || v.key) === key && ['bevestigd', 'ingecheckt'].includes(v.status));
    if (vb.length) delen.push('verblijf: ' + vb[0].roomName + ' (' + vb[0].status + ')');
    const tickets = (db.data.assetTickets || []).filter(t => t.key === key && t.status === 'actief');
    if (tickets.length) delen.push(tickets.length + ' Shared Asset-ticket(s)');
    return delen;
  }

  /* Het gesprek. Eerst de eigen commando's (onthouden, opvragen, vergeten);
     daarna Claude met het volledige persoonlijke beeld, of de eigen regels. */
  async function fluisterZeg(key, codenaam, qIn) {
    const q = String(qIn || '').trim().slice(0, 600);
    if (!q) return { status: 400, error: 'Zeg iets.' };
    const p = van(key);
    if (/^onthoud\b/i.test(q)) {
      const r = fluisterOnthoud(key, q);
      if (r.error) return r;
      return { ok: true, antwoord: 'Onthouden: "' + r.weetjes[r.weetjes.length - 1].tekst + '". U kunt dit altijd terugzien of wissen met "wat weet je over mij".', geleerd: true };
    }
    if (/vergeet alles/i.test(q)) {
      fluisterVergeet(key, 'alles');
      return { ok: true, antwoord: 'Alles gewist. We beginnen met een schone lei.', geleerd: true };
    }
    if (/wat (weet|onthoud) je (over|van) mij/i.test(q)) {
      const regels = [];
      if (p.weetjes.length) regels.push('U vertelde me: ' + p.weetjes.map(w => '"' + w.tekst + '"').join(', ') + '.');
      const top = topFocus(p, 3);
      if (top.length) regels.push('En ik zie dat u het meest werkt met: ' + top.join(', ') + '.');
      if (!regels.length) regels.push('Nog niets. Vertel me iets met "onthoud dat..." of gebruik de app; ik leer vanzelf wat u belangrijk vindt.');
      regels.push('Wissen kan per weetje of in een keer ("vergeet alles").');
      return { ok: true, antwoord: regels.join(' ') };
    }
    const stand = standVan(key);
    if (anthropic) {
      try {
        const ctx = 'Lid: ' + codenaam + '. ' +
          (p.weetjes.length ? 'Weetjes die het lid zelf deelde: ' + p.weetjes.map(w => w.tekst).join('; ') + '. ' : '') +
          (topFocus(p, 3).length ? 'Gebruikt het meest: ' + topFocus(p, 3).join(', ') + '. ' : '') +
          (stand.length ? 'Actuele stand: ' + stand.join('; ') + '.' : '');
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-5', max_tokens: 300,
          system: 'Je bent Fluister, de persoonlijke assistent in de RTG-app. Antwoord kort, warm en concreet, in de taal van de vraag. Gebruik het persoonlijke beeld alleen als het helpt. Context: ' + ctx,
          messages: [{ role: 'user', content: q }]
        });
        return { ok: true, antwoord: response.content[0].text };
      } catch (e) { /* val terug op de eigen regels */ }
    }
    // de eigen regels: persoonlijk waar het kan, eerlijk waar het moet
    const groet = p.weetjes.length ? 'Ik denk aan uw ' + p.weetjes.length + ' weetje(s). ' : '';
    if (stand.length) return { ok: true, antwoord: groet + 'Dit speelt er nu voor u: ' + stand.join('; ') + '. Vraag gerust door, of leer me iets met "onthoud dat...".' };
    return { ok: true, antwoord: groet + 'Ik ben Fluister, uw persoonlijke assistent. Leer me kennen met "onthoud dat..." en vraag "wat weet je over mij" wanneer u wilt; wissen kan altijd.' };
  }

  return { fluisterZeg, fluisterOnthoud, fluisterVergeet, fluisterFocus, fluisterProfiel };
};
