/* Events (deelmodule): de keukencoach: het vuurplan (alle kanten van een
   bon tegelijk warm op de pas) en de coachregels over voorrang, batchen,
   overschot, tafels en bezetting. Krijgt de gedeelde context een keer bij
   het opstarten vanuit kern/events.js. */
module.exports = (ctx) => {
  const { crypto, sectiesForOrder, RUN_STATIONS, ALT_IDEE, coachCache, SECTIE_MIN } = ctx;
  /* Het vuurplan: wanneer moet elke kant van een bon starten zodat alles
     tegelijk warm op de pas ligt. Rekent per kant met de nominale tijd (of
     prepMin op het gerecht) en de fase die de kant al heeft: klaar telt 0,
     bezig telt de halve tijd, niet gestart telt de volle tijd. De kant met
     de langste resttijd bepaalt het doel; de rest wacht precies zo lang dat
     iedereen samen bij nul uitkomt. */
  function sectieTijd(s, o, sec) {
    let t = SECTIE_MIN[sec] || 8;
    for (const it of (o.items || [])) {
      const m = (s.menu || []).find(x => x.id === it.id);
      if (m && m.station !== 'bar' && (m.sectie || 'warm') === sec && m.prepMin) t = Math.max(t, m.prepMin);
    }
    return t;
  }
  function vuurplan(s, o) {
    const nodig = sectiesForOrder(s, o);
    const fase = o.secties || {};
    const faseVan = k => k === 'bar' ? (o.stations || {}).bar : fase[k];
    const rest = {};
    for (const sec of nodig) {
      const t = sectieTijd(s, o, sec);
      rest[sec] = fase[sec] === 'klaar' ? 0 : fase[sec] === 'bezig' ? Math.ceil(t / 2) : t;
    }
    // de bar telt als eigen kant mee: drankjes gaan met de rest van de bon samen uit
    const barNodig = (o.items || []).some(it => { const m = (s.menu || []).find(x => x.id === it.id); return m && m.station === 'bar'; });
    if (barNodig) {
      const bf = (o.stations || {}).bar;
      rest.bar = bf === 'klaar' ? 0 : bf === 'bezig' ? Math.ceil(SECTIE_MIN.bar / 2) : SECTIE_MIN.bar;
    }
    const alle = Object.keys(rest);
    const doel = alle.length ? Math.max(...alle.map(k => rest[k])) : 0;
    const plan = {};
    for (const k of alle) {
      const f = faseVan(k);
      if (f === 'klaar') plan[k] = doel > 0 ? { doe: 'warm', min: doel } : { doe: 'pas', min: 0 };
      else if (f === 'bezig') plan[k] = { doe: 'bezig', min: rest[k] };
      else {
        const wacht = doel - rest[k];
        plan[k] = wacht >= 2 ? { doe: 'wacht', min: wacht } : { doe: 'nu', min: 0 };
      }
    }
    // spoed van de bediening: niets houdt nog in, alles start nu
    if (o.spoed) for (const k of alle) if (plan[k].doe === 'wacht') plan[k] = { doe: 'nu', min: 0 };
    return { doel, plan };
  }

  /* De keukenhulp: AI-coach die zegt wat er nu moet gebeuren. Kijkt naar alle
     open bonnen: voorrang voor oude bonnen, dezelfde gerechten in een keer
     maken, en per tafel alles tegelijk laten uitgaan. */
  function coachRules(s, open, lang) {
    const en = lang === 'en';
    const lines = [];
    const nu = Date.now();
    const age = o => Math.round((nu - new Date(o.at)) / 60000);
    const tafel = o => o.table ? o.table : null;
    // 0. spoed van de bediening: rustig, maar als eerste
    for (const o of open) if (o.spoed) {
      const wie = o.pickup + (tafel(o) ? ' (' + tafel(o) + ')' : '');
      lines.push(en ? '⚡ Ticket ' + wie + ': service asked for a rush' + (o.spoed.itemId ? ' on one dish' : '') + '; take it along first.'
                    : '⚡ Bon ' + wie + ': de bediening vraagt spoed' + (o.spoed.itemId ? ' op een gerecht' : '') + '; pak deze als eerste mee.');
    }
    // 1. voorrang: oudste onaangeroerde bon
    const vers = open.filter(o => !Object.keys(o.secties || {}).length && !Object.keys(o.stations || {}).length);
    if (vers.length) {
      const oudste = vers.reduce((a, b) => new Date(a.at) < new Date(b.at) ? a : b);
      const wie = oudste.pickup + (tafel(oudste) ? ' (' + tafel(oudste) + ')' : '');
      lines.push(en ? '▶ Pick up first: ticket ' + wie + ', waiting ' + age(oudste) + ' min.'
                    : '▶ Eerst oppakken: bon ' + wie + ', wacht ' + age(oudste) + ' min.');
    }
    // 2. te laat
    for (const o of open) if (age(o) >= 12 && o.status !== 'klaar') {
      const wie = o.pickup + (tafel(o) ? ' (' + tafel(o) + ')' : '');
      lines.push(en ? '⚠ Ticket ' + wie + ' has been waiting ' + age(o) + ' min, give it priority.'
                    : '⚠ Bon ' + wie + ' wacht al ' + age(o) + ' min, geef voorrang.');
    }
    // 2b. wat over is op de pas eerst gebruiken: te veel gemaakt is geen afval
    const over = (s.overschot || []).filter(x => nu - new Date(x.at) < 2 * 3600000);
    for (const ov of over) {
      const bon = open.find(o => (o.items || []).some(it => it.id === ov.itemId));
      if (bon) {
        const wie = bon.pickup + (tafel(bon) ? ' (' + tafel(bon) + ')' : '');
        lines.push(en ? '🥡 ' + ov.qty + 'x ' + ov.name + ' is left on the pass: use it for ticket ' + wie + ' instead of cooking new.'
                      : '🥡 Er ligt nog ' + ov.qty + 'x ' + ov.name + ' op de pas: gebruik die voor bon ' + wie + ' in plaats van nieuw te maken.');
      } else {
        lines.push(en ? '🥡 On the pass: ' + ov.qty + 'x ' + ov.name + ' left over; work it into the next ticket or write it off.'
                      : '🥡 Op de pas over: ' + ov.qty + 'x ' + ov.name + '; werk het weg in de eerstvolgende bon of schrijf af.');
      }
    }
    // 3. batchen: hetzelfde gerecht op meerdere bonnen tegelijk maken
    const per = {};
    for (const o of open) for (const it of (o.items || [])) {
      const m = (s.menu || []).find(x => x.id === it.id);
      if (!m || m.station === 'bar') continue;
      const sec = m.sectie || 'warm';
      if ((o.secties || {})[sec] === 'klaar') continue;
      per[it.id] = per[it.id] || { name: it.name, qty: 0, bonnen: [] };
      per[it.id].qty += it.qty; per[it.id].bonnen.push(o.pickup);
    }
    for (const p of Object.values(per)) if (p.bonnen.length >= 2)
      lines.push(en ? '🍳 Make ' + p.qty + '× ' + p.name + ' in one go (tickets ' + p.bonnen.join(', ') + ').'
                    : '🍳 Maak ' + p.qty + '× ' + p.name + ' in één keer (bonnen ' + p.bonnen.join(', ') + ').');
    // 4. het vuurplan: de kanten van een bon zo starten dat alles tegelijk
    //    warm op de pas ligt, met concrete minuten per kant
    for (const o of open) {
      const { doel, plan } = vuurplan(s, o);
      const wie = o.pickup + (tafel(o) ? ' (' + tafel(o) + ')' : '');
      const warm = Object.keys(plan).filter(k => plan[k].doe === 'warm');
      const nu2 = Object.keys(plan).filter(k => plan[k].doe === 'nu');
      const wacht = Object.keys(plan).filter(k => plan[k].doe === 'wacht');
      if (warm.length)
        lines.push(en ? '♨ Ticket ' + wie + ': ' + warm.join('/') + ' is done but the rest needs ~' + doel + ' min; keep it warm and close the gap.'
                      : '♨ Bon ' + wie + ': ' + warm.join('/') + ' ligt klaar maar de rest heeft nog ~' + doel + ' min; houd warm en trek de kanten gelijk.');
      else if (nu2.length && wacht.length)
        lines.push(en ? '⏱ Ticket ' + wie + ': fire ' + nu2.join(' and ') + ' now, ' + wacht.map(k => k + ' in ~' + plan[k].min + ' min').join(' and ') + ', so the whole table leaves hot at once.'
                      : '⏱ Bon ' + wie + ': start ' + nu2.join(' en ') + ' nu, ' + wacht.map(k => k + ' over ~' + plan[k].min + ' min').join(' en ') + ', dan gaat de hele tafel in een keer warm uit.');
    }
    // 5. tafels: meerdere bonnen voor dezelfde tafel gelijktrekken
    const perTafel = {};
    for (const o of open) if (o.table) { perTafel[o.table] = perTafel[o.table] || []; perTafel[o.table].push(o); }
    for (const [t, os] of Object.entries(perTafel)) if (os.length >= 2)
      lines.push(en ? '🪑 ' + t + ' has ' + os.length + ' tickets (' + os.map(o => o.pickup).join(', ') + '): line up the sections so the table leaves in one go.'
                    : '🪑 ' + t + ' heeft ' + os.length + ' bonnen (' + os.map(o => o.pickup).join(', ') + '): stem de kanten af zodat de tafel in één keer uitgaat.');
    // 6. de bezetting: veel open werk op een kant met weinig aangemelde koks
    const lijn = s.lijn || {};
    const perKant = {};
    for (const o of open) for (const sec of sectiesForOrder(s, o)) if ((o.secties || {})[sec] !== 'klaar') perKant[sec] = (perKant[sec] || 0) + 1;
    for (const [sec, n2] of Object.entries(perKant)) {
      const koks = (lijn[sec] || []).length;
      if (n2 >= 4 && koks <= 1)
        lines.push(en ? '👥 The ' + sec + ' side has ' + n2 + ' open tickets with ' + (koks || 'no') + ' cook(s) signed in: jump in or sign someone in.'
                      : '👥 De kant ' + sec + ' heeft ' + n2 + ' open bonnen met ' + (koks || 'geen') + ' aangemelde kok(s): spring bij of meld iemand aan.');
    }
    return lines.slice(0, 6);
  }
  return { sectieTijd, vuurplan, coachRules };
};
