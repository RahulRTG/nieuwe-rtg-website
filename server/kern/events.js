/* De event- en keukenlaag: draaiboeken (runsheet), catering, de MEP-fallback,
   de vervangende-gerechten-tabel en de keukencoach.

   RUN_STATIONS en ALT_IDEE zijn pure data en worden rechtstreeks geexporteerd.
   coachCache is een gedeelde in-memory cache (per bedrijfscode). De functies
   dragen state (crypto voor id's, sectiesForOrder voor de coach) en komen uit
   maakEvents(state), zodat server.js dun blijft en de logica los te testen is. */

// draaiboek-posten horen bij de keuken, bar, bediening of de party manager (Events)
const RUN_STATIONS = ['keuken', 'bar', 'bediening', 'party', 'alle'];

// vervangend gerecht per allergeen (Claude verzint anders, dit is de vakkundige fallback)
const ALT_IDEE = {
  noten: ['krokant van geroosterde pompoen- en zonnebloempitten', 'zonder noten, met dezelfde textuur'],
  pinda: ['sesam-soja dressing in plaats van satesaus', 'vrij van pinda'],
  gluten: ['glutenvrije variant met rijstbloem en boekweit', 'volledig glutenvrij bereid'],
  lactose: ['romige basis van kokosmelk en cashewcreme', 'zonder zuivel'],
  melk: ['romige basis van kokosmelk', 'zonder zuivel'],
  vis: ['gegrilde groente met dashi van kombu', 'zonder vis, zelfde umami'],
  schaaldieren: ['knapperige tofu met yuzu-glaze', 'vrij van schaal- en schelpdieren'],
  soja: ['dressing op basis van miso-vrije bouillon en citrus', 'sojavrij'],
  ei: ['binding met aquafaba', 'zonder ei'],
  sesam: ['topping van geroosterde quinoa', 'sesamvrij']
};

// gedeelde keukencoach-cache: code -> { hash, lines, at }
const coachCache = new Map();

// nominale bereidingstijd per kant in minuten; prepMin op het gerecht wint.
// De bar telt als eigen kant mee, zodat drankjes en eten samen uitgaan.
const SECTIE_MIN = { warm: 12, koud: 6, snack: 8, dessert: 5, bar: 4 };

function maakEvents({ crypto, sectiesForOrder }) {
  function runItem(time, station, text, daysBefore, mep) {
    return {
      id: crypto.randomBytes(3).toString('hex'),
      time: /^\d{2}:\d{2}$/.test(time) ? time : '00:00',
      station: RUN_STATIONS.includes(station) ? station : 'alle',
      text: String(text || '').trim().slice(0, 160),
      daysBefore: Math.min(14, Math.max(0, parseInt(daysBefore, 10) || 0)),
      mep: !!mep,
      done: false, doneBy: null
    };
  }
  // draaiboeken lopen vaak over middernacht heen: 01:00 afbouw hoort NA 23:00,
  // dus alles voor 06:00 telt als "die nacht" en sorteert achteraan
  function runKey(t) { const [h, m] = String(t).split(':').map(Number); return ((h < 6 ? h + 24 : h) * 60 + (m || 0)); }
  function sortRunsheet(e) { e.runsheet.sort((a, b) => ((b.daysBefore || 0) - (a.daysBefore || 0)) || (runKey(a.time) - runKey(b.time))); }

  // AI-hulp: een draaiboek voorstellen, of geplakte/geuploade tekst omzetten
  function fallbackRunsheet(e) {
    // zonder Claude-sleutel: een gedegen standaard-draaiboek rond de starttijd
    const start = /^\d{2}:\d{2}$/.test(e.time || '') ? e.time : '20:00';
    const [h, m] = start.split(':').map(Number);
    const at = min => { const t = h * 60 + m + min; const hh = Math.floor(((t % 1440) + 1440) % 1440 / 60), mm = ((t % 1440) + 1440) % 1440 % 60; return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'); };
    return [
      runItem(at(-180), 'keuken', 'Mise en place voor ' + e.name + ', voorraad controleren'),
      runItem(at(-120), 'bar', 'Bar bevoorraden, koeling vullen, ijs en garnering klaar'),
      runItem(at(-90), 'bediening', 'Zaal en tafels inrichten volgens de indeling'),
      runItem(at(-60), 'party', 'Techniek en muziek testen, licht instellen'),
      runItem(at(-30), 'alle', 'Briefing met het hele team: verloop, allergieen, vips'),
      runItem(at(-15), 'party', 'Gastenlijst openen op het Events-scherm, deurpost bemannen'),
      runItem(at(0), 'party', 'Deuren open, welkom door de party manager'),
      runItem(at(30), 'bediening', 'Eerste ronde langs alle tafels'),
      runItem(at(90), 'keuken', 'Bijvullen en tweede uitgifte voorbereiden'),
      runItem(at(150), 'bar', 'Voorraad peilen, bijbestellen indien nodig'),
      runItem(at(240), 'party', 'Laatste ronde aankondigen, afrekenen voorbereiden'),
      runItem(at(270), 'alle', 'Afbouw: zaal, bar en keuken volgens sluitlijst')
    ];
  }
  function parseRunsheetText(text) {
    // geplakte regels zoals "18:00 keuken mise en place" of "18.00 - Bar - koeling"
    const items = [];
    for (const line of String(text || '').split('\n')) {
      const l = line.trim(); if (!l) continue;
      const tm = l.match(/(\d{1,2})[:.](\d{2})/);
      const time = tm ? String(tm[1]).padStart(2, '0') + ':' + tm[2] : '00:00';
      const lower = l.toLowerCase();
      const station = /keuken|kitchen|chef/.test(lower) ? 'keuken'
        : /\bbar\b|dranken/.test(lower) ? 'bar'
        : /bediening|service|zaal|tafel/.test(lower) ? 'bediening'
        : /party|deur|dj|muziek|licht|host/.test(lower) ? 'party' : 'alle';
      let txt = l.replace(/(\d{1,2})[:.](\d{2})/, '').replace(/^[\s\-·:,]+/, '').trim();
      txt = txt.replace(/^(keuken|bar|bediening|party|alle|service)\b[\s\-·:,]*/i, '').trim();
      if (txt) items.push(runItem(time, station, txt));
      if (items.length >= 40) break;
    }
    return items;
  }

  // gerechten die het event serveert (vast menu, of de hele keukenkaart bij a la carte)
  function cateringDishes(s, e) {
    const menu = s.menu || [];
    if (e.catering && e.catering.mode === 'menu')
      return e.catering.itemIds.map(id => menu.find(m => m.id === id)).filter(Boolean);
    if (e.catering && e.catering.mode === 'alacarte')
      return menu.filter(m => m.station !== 'bar');
    return [];
  }
  function eventCovers(e) {
    const aangemeld = (e.guests || []).reduce((n, g) => n + g.qty, 0);
    return Math.max(aangemeld, Math.ceil(e.capacity * 0.6));
  }

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
    return lines.slice(0, 6);
  }

  return { runItem, runKey, sortRunsheet, fallbackRunsheet, parseRunsheetText, cateringDishes, eventCovers, coachRules, vuurplan, sectieTijd };
}

module.exports = { RUN_STATIONS, ALT_IDEE, coachCache, SECTIE_MIN, maakEvents };
