/* Events (deelmodule): het draaiboek: runsheet-posten maken en sorteren
   (over middernacht heen), de MEP-fallback, geplakte tekst omzetten en de
   catering-helpers. Krijgt de gedeelde context een keer bij het opstarten
   vanuit kern/events.js. */
module.exports = (ctx) => {
  const { crypto, sectiesForOrder, RUN_STATIONS, ALT_IDEE, coachCache, SECTIE_MIN } = ctx;
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
  return { runItem, runKey, sortRunsheet, fallbackRunsheet, parseRunsheetText, cateringDishes, eventCovers };
};
