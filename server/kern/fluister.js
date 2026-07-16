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
   reserveringen, assets) reizen als context mee.

   En hij fluistert ook zelf: seintjes. Uit datums in je eigen weetjes
   (een verjaardag), uit je agenda (reserveringen, check-in, je
   24-uursblokken) en uit lopende zaken (bedenktijd, terugkoop). Verder
   onthoudt hij de laatste beurten van het gesprek, zodat een vervolgvraag
   gewoon begrepen wordt; ook dat gesprek wist "vergeet alles". */
module.exports = ({ db, save, schoon, anthropic }) => {
  const nu = () => new Date().toISOString();
  const lijsten = () => { if (!db.data.fluister) db.data.fluister = {}; };
  const van = key => {
    lijsten();
    const p = db.data.fluister[key] || (db.data.fluister[key] = { weetjes: [], focus: {}, at: nu() });
    if (!Array.isArray(p.gesprek)) p.gesprek = [];
    return p;
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

  /* ---- datums verstaan: "3 augustus" in een weetje wordt een echt seintje ---- */
  const MAANDEN = {
    januari: 1, februari: 2, maart: 3, april: 4, mei: 5, juni: 6, juli: 7,
    augustus: 8, september: 9, oktober: 10, november: 11, december: 12,
    january: 1, february: 2, march: 3, may: 5, june: 6, july: 7, august: 8, october: 10
  };
  const vandaag = () => new Date().toISOString().slice(0, 10);
  function datumUit(tekst) {
    const m = String(tekst).toLowerCase().match(/(\d{1,2})\s+(januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december|january|february|march|may|june|july|august|october)/);
    if (!m) return null;
    const dag = parseInt(m[1], 10), maand = MAANDEN[m[2]];
    if (!(dag >= 1 && dag <= 31)) return null;
    const jaar = new Date().getUTCFullYear();
    const dd = j => j + '-' + String(maand).padStart(2, '0') + '-' + String(dag).padStart(2, '0');
    return dd(jaar) >= vandaag() ? dd(jaar) : dd(jaar + 1);
  }
  const dagenTot = datum => Math.round((Date.parse(datum) - Date.parse(vandaag())) / 86400000);
  const wanneer = d => d <= 0 ? 'vandaag' : d === 1 ? 'morgen' : 'over ' + d + ' dagen';

  /* ---- proactief: Fluister fluistert zelf, nog voordat je iets vraagt ---- */
  const BEDENKTIJD_DAGEN = 14; // gelijk aan kern/assets.js
  function fluisterSeintjes(key) {
    const p = van(key);
    const s = [];
    // 1. datums in je eigen weetjes: verjaardagen en afspraken die naderen
    for (const w of p.weetjes) {
      const d = datumUit(w.tekst);
      if (!d) continue;
      const dgn = dagenTot(d);
      if (dgn > 21) continue;
      s.push({ icoon: /verjaardag|jarig|birthday/i.test(w.tekst) ? '🎂' : '📅', tekst: w.tekst + ' · ' + wanneer(dgn) + ' (' + d + ')' });
    }
    // 2. de eerstvolgende reservering, zodra hij dichtbij komt
    const res = (db.data.reserveringen || [])
      .filter(r => r.customerKey === key && ['aangevraagd', 'bevestigd'].includes(r.status) && r.datum >= vandaag())
      .sort((a, b) => (a.datum + a.tijd).localeCompare(b.datum + b.tijd))[0];
    if (res && dagenTot(res.datum) <= 2)
      s.push({ icoon: '🪑', tekst: wanneer(dagenTot(res.datum)) + ' ' + res.tijd + ' gereserveerd bij ' + res.supplierName + (res.status === 'aangevraagd' ? ' (wacht nog op bevestiging)' : '') });
    // 3. verblijf: de check-in nadert, of het is tijd om uit te checken
    for (const v of (db.data.verblijven || []).filter(v => (v.customerKey || v.key) === key)) {
      if (v.status === 'bevestigd' && v.aankomst >= vandaag() && dagenTot(v.aankomst) <= 7)
        s.push({ icoon: '🏨', tekst: 'Check-in ' + v.roomName + ' bij ' + v.supplierName + ' · ' + wanneer(dagenTot(v.aankomst)) });
      if (v.status === 'ingecheckt' && v.vertrek && dagenTot(v.vertrek) <= 1)
        s.push({ icoon: '🧳', tekst: 'Uitchecken bij ' + v.supplierName + ' · ' + wanneer(dagenTot(v.vertrek)) });
    }
    // 4. een geboekt 24-uursblok van een Shared Asset dat eraan komt
    for (const g of (db.data.assetGebruik || []).filter(g => g.key === key && g.datum >= vandaag() && dagenTot(g.datum) <= 7))
      s.push({ icoon: '🔑', tekst: 'Uw 24 uur bij ' + g.assetNaam + ' · ' + wanneer(dagenTot(g.datum)) + ' (' + g.datum + ')' });
    // 5. lopende asset-zaken: bedenktijd die nog loopt, terugkoop onderweg
    const bedenk = (db.data.assetTickets || []).filter(t => t.key === key && t.status === 'actief' &&
      Date.now() - Date.parse(t.at) < BEDENKTIJD_DAGEN * 86400000);
    if (bedenk.length) {
      const rest = Math.ceil(BEDENKTIJD_DAGEN - (Date.now() - Date.parse(bedenk[0].at)) / 86400000);
      s.push({ icoon: '↩️', tekst: 'Nog ' + rest + ' dag(en) bedenktijd op ' + bedenk.length + ' ticket(s); herroepen is kosteloos' });
    }
    for (const v of (db.data.assetTerugkoop || []).filter(v => v.key === key && v.status === 'aangevraagd'))
      s.push({ icoon: '⏳', tekst: 'Terugkoop ' + v.assetNaam + ': uiterlijk ' + v.uiterlijk + ' staat het bedrag in uw tegoed' });
    // 6. een vriendelijke duw: het jaar loopt en uw 24 uur staat nog nergens
    if (vandaag().slice(5, 7) >= '07') {
      const jaar = vandaag().slice(0, 4);
      const stil = (db.data.assetTickets || []).find(t => t.key === key && t.status === 'actief' &&
        Date.now() - Date.parse(t.at) >= BEDENKTIJD_DAGEN * 86400000 &&
        !(db.data.assetGebruik || []).some(g => g.key === key && g.assetId === t.assetId && g.datum.slice(0, 4) === jaar));
      if (stil) s.push({ icoon: '💡', tekst: 'Uw 24 uur van dit jaar bij ' + ((db.data.assets || []).find(a => a.id === stil.assetId) || {}).naam + ' staat nog niet gepland' });
    }
    return s.slice(0, 5);
  }

  function fluisterProfiel(key) {
    const p = van(key);
    return { ok: true, weetjes: p.weetjes, top: topFocus(p, 5), seintjes: fluisterSeintjes(key), gesprek: p.gesprek.length };
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
      p.gesprek = [];
      p.focus = {};
      save();
      return { ok: true, antwoord: 'Alles gewist: uw weetjes, ons gesprek en de gebruikstellers. We beginnen met een schone lei.', geleerd: true };
    }
    if (/wat (weet|onthoud) je (over|van) mij/i.test(q)) {
      const regels = [];
      if (p.weetjes.length) regels.push('U vertelde me: ' + p.weetjes.map(w => '"' + w.tekst + '"').join(', ') + '.');
      const top = topFocus(p, 3);
      if (top.length) regels.push('En ik zie dat u het meest werkt met: ' + top.join(', ') + '.');
      if (!regels.length) regels.push('Nog niets. Vertel me iets met "onthoud dat..." of gebruik de app; ik leer vanzelf wat u belangrijk vindt.');
      if (p.gesprek.length) regels.push('Verder onthoud ik alleen de laatste ' + p.gesprek.length + ' beurt(en) van ons gesprek.');
      regels.push('Wissen kan per weetje of in een keer ("vergeet alles").');
      return { ok: true, antwoord: regels.join(' ') };
    }
    const stand = standVan(key);
    const seintjes = fluisterSeintjes(key);
    // het antwoord gaat straks ook het gespreksgeheugen in (laatste 5 beurten)
    const klaar = antwoord => {
      p.gesprek.push({ u: q, a: String(antwoord).slice(0, 400), at: nu() });
      p.gesprek = p.gesprek.slice(-5);
      save();
      return { ok: true, antwoord };
    };
    if (anthropic) {
      try {
        const ctx = 'Lid: ' + codenaam + '. ' +
          (p.weetjes.length ? 'Weetjes die het lid zelf deelde: ' + p.weetjes.map(w => w.tekst).join('; ') + '. ' : '') +
          (topFocus(p, 3).length ? 'Gebruikt het meest: ' + topFocus(p, 3).join(', ') + '. ' : '') +
          (stand.length ? 'Actuele stand: ' + stand.join('; ') + '. ' : '') +
          (seintjes.length ? 'Actuele seintjes: ' + seintjes.map(x => x.tekst).join('; ') + '.' : '');
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-5', max_tokens: 300,
          system: 'Je bent Fluister, de persoonlijke assistent in de RTG-app. Antwoord kort, warm en concreet, in de taal van de vraag. Gebruik het persoonlijke beeld alleen als het helpt. Context: ' + ctx,
          messages: [...p.gesprek.flatMap(g => [{ role: 'user', content: g.u }, { role: 'assistant', content: g.a }]), { role: 'user', content: q }]
        });
        return klaar(response.content[0].text);
      } catch (e) { /* val terug op de eigen regels */ }
    }
    // de eigen regels: persoonlijk waar het kan, eerlijk waar het moet
    const groet = p.weetjes.length ? 'Ik denk aan uw ' + p.weetjes.length + ' weetje(s). ' : '';
    const fluistert = seintjes.length ? ' Mijn seintjes: ' + seintjes.map(x => x.icoon + ' ' + x.tekst).join(' | ') + '.' : '';
    if (stand.length || seintjes.length) return klaar(groet + (stand.length ? 'Dit speelt er nu voor u: ' + stand.join('; ') + '.' : 'Er staat niets open.') + fluistert + ' Vraag gerust door, of leer me iets met "onthoud dat...".');
    return klaar(groet + 'Ik ben Fluister, uw persoonlijke assistent. Leer me kennen met "onthoud dat..." en vraag "wat weet je over mij" wanneer u wilt; wissen kan altijd.');
  }

  return { fluisterZeg, fluisterOnthoud, fluisterVergeet, fluisterFocus, fluisterProfiel, fluisterSeintjes };
};
