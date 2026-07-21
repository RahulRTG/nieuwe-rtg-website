/* De RTG Home Kit: alle elektronica van het lid op EEN plek, per kamer,
   plus scenes die je met een tik start. De AI (Rahul) bouwt een scene uit
   een wens ("filmavond", "rustige ochtend"); zonder API-sleutel maakt een
   nette demo-motor het voorstel.

   Veiligheidsregels, bewust hard in de code:
   - de AI stelt voor, het lid beslist: een AI-voorstel wordt pas een scene
     als het lid hem bewaart, en doet pas iets als het lid hem start
   - SLOTEN gaan nooit mee in een scene en nooit via de AI: een deur van
     het slot halen is altijd een eigen, losse tik van het lid zelf
   Elke woning start met een nette demo-inrichting; alles per lid bewaard. */

const KAMERS = ['Woonkamer', 'Keuken', 'Slaapkamer', 'Badkamer', 'Werkkamer', 'Hal', 'Terras'];

// de standaard-inrichting van een nieuwe woning (id's blijven stabiel)
const BASIS = [
  { id: 'lamp-woon', kamer: 'Woonkamer', naam: 'Plafondlamp', soort: 'lamp', icon: '💡', stand: { aan: false, dim: 80 } },
  { id: 'lamp-sfeer', kamer: 'Woonkamer', naam: 'Sfeerlampen', soort: 'lamp', icon: '🕯️', stand: { aan: false, dim: 40 } },
  { id: 'tv-woon', kamer: 'Woonkamer', naam: 'Televisie', soort: 'tv', icon: '📺', stand: { aan: false } },
  { id: 'speaker-woon', kamer: 'Woonkamer', naam: 'Speakers', soort: 'audio', icon: '🔊', stand: { aan: false, volume: 30 } },
  { id: 'gordijn-woon', kamer: 'Woonkamer', naam: 'Gordijnen', soort: 'gordijn', icon: '🪟', stand: { open: true } },
  { id: 'thermostaat', kamer: 'Woonkamer', naam: 'Thermostaat', soort: 'klimaat', icon: '🌡️', stand: { aan: true, temp: 20 } },
  { id: 'lamp-keuken', kamer: 'Keuken', naam: 'Keukenlamp', soort: 'lamp', icon: '💡', stand: { aan: false, dim: 100 } },
  { id: 'koffie', kamer: 'Keuken', naam: 'Koffiezetter', soort: 'stekker', icon: '☕', stand: { aan: false } },
  { id: 'vaatwasser', kamer: 'Keuken', naam: 'Vaatwasser', soort: 'stekker', icon: '🫧', stand: { aan: false } },
  { id: 'lamp-slaap', kamer: 'Slaapkamer', naam: 'Bedlampjes', soort: 'lamp', icon: '🛏️', stand: { aan: false, dim: 30 } },
  { id: 'gordijn-slaap', kamer: 'Slaapkamer', naam: 'Gordijnen', soort: 'gordijn', icon: '🪟', stand: { open: true } },
  { id: 'wekker', kamer: 'Slaapkamer', naam: 'Wekkerlicht', soort: 'lamp', icon: '⏰', stand: { aan: false, dim: 50 } },
  { id: 'lamp-bad', kamer: 'Badkamer', naam: 'Spiegellamp', soort: 'lamp', icon: '🪞', stand: { aan: false, dim: 100 } },
  { id: 'vloer-bad', kamer: 'Badkamer', naam: 'Vloerverwarming', soort: 'klimaat', icon: '🦶', stand: { aan: false, temp: 22 } },
  { id: 'lamp-werk', kamer: 'Werkkamer', naam: 'Bureaulamp', soort: 'lamp', icon: '💡', stand: { aan: false, dim: 90 } },
  { id: 'monitor', kamer: 'Werkkamer', naam: 'Beeldschermen', soort: 'stekker', icon: '🖥️', stand: { aan: false } },
  { id: 'slot-voordeur', kamer: 'Hal', naam: 'Voordeurslot', soort: 'slot', icon: '🔒', stand: { opSlot: true } },
  { id: 'lamp-hal', kamer: 'Hal', naam: 'Hallamp', soort: 'lamp', icon: '💡', stand: { aan: false, dim: 60 } },
  { id: 'lamp-terras', kamer: 'Terras', naam: 'Terrasverlichting', soort: 'lamp', icon: '🌿', stand: { aan: false, dim: 50 } },
  { id: 'laadpaal', kamer: 'Terras', naam: 'Laadpaal', soort: 'stekker', icon: '🔌', stand: { aan: true } }
];

// de demo-scenemotor: herkenbare wensen krijgen een doordacht voorstel
const DEMO_SCENES = [
  { als: /film|serie|bios/i, naam: 'Filmavond', uitleg: 'Licht gedimd, tv en speakers aan, gordijnen dicht en de verwarming behaaglijk.',
    standen: { 'lamp-woon': { aan: false }, 'lamp-sfeer': { aan: true, dim: 20 }, 'tv-woon': { aan: true }, 'speaker-woon': { aan: true, volume: 45 }, 'gordijn-woon': { open: false }, 'thermostaat': { aan: true, temp: 21 } } },
  { als: /slaap|nacht|welterusten|bed/i, naam: 'Welterusten', uitleg: 'Alles beneden uit, bedlampjes zacht aan, gordijnen dicht en de verwarming een graad lager.',
    standen: { 'lamp-woon': { aan: false }, 'lamp-sfeer': { aan: false }, 'tv-woon': { aan: false }, 'speaker-woon': { aan: false }, 'lamp-keuken': { aan: false }, 'lamp-hal': { aan: false }, 'lamp-terras': { aan: false }, 'lamp-slaap': { aan: true, dim: 20 }, 'gordijn-slaap': { open: false }, 'thermostaat': { aan: true, temp: 18 } } },
  { als: /ochtend|opstaan|wakker|goedemorgen/i, naam: 'Rustige ochtend', uitleg: 'Wekkerlicht en keuken aan, koffie gezet, gordijnen open en de badkamervloer warm.',
    standen: { 'wekker': { aan: true, dim: 60 }, 'gordijn-slaap': { open: true }, 'gordijn-woon': { open: true }, 'lamp-keuken': { aan: true, dim: 100 }, 'koffie': { aan: true }, 'vloer-bad': { aan: true, temp: 23 }, 'thermostaat': { aan: true, temp: 20 } } },
  { als: /werk|focus|concentr|thuiswerken/i, naam: 'Aan het werk', uitleg: 'Werkkamer helder verlicht, beeldschermen aan en de rest van het huis rustig.',
    standen: { 'lamp-werk': { aan: true, dim: 100 }, 'monitor': { aan: true }, 'speaker-woon': { aan: false }, 'tv-woon': { aan: false }, 'thermostaat': { aan: true, temp: 20 } } },
  { als: /weg|vertrek|uit huis|vakantie/i, naam: 'Iedereen weg', uitleg: 'Alle lampen en apparaten uit en de verwarming zuinig. Het slot doet u zelf; dat hoort zo.',
    standen: { 'lamp-woon': { aan: false }, 'lamp-sfeer': { aan: false }, 'lamp-keuken': { aan: false }, 'lamp-slaap': { aan: false }, 'lamp-bad': { aan: false }, 'lamp-werk': { aan: false }, 'lamp-hal': { aan: false }, 'lamp-terras': { aan: false }, 'tv-woon': { aan: false }, 'speaker-woon': { aan: false }, 'koffie': { aan: false }, 'monitor': { aan: false }, 'thermostaat': { aan: true, temp: 16 } } },
  { als: /romant|diner|date|kaars/i, naam: 'Romantisch diner', uitleg: 'Zachte sfeerverlichting, rustige muziek en de gordijnen dicht.',
    standen: { 'lamp-woon': { aan: false }, 'lamp-sfeer': { aan: true, dim: 15 }, 'lamp-keuken': { aan: true, dim: 40 }, 'speaker-woon': { aan: true, volume: 25 }, 'gordijn-woon': { open: false }, 'thermostaat': { aan: true, temp: 21 } } }
];

module.exports = ({ db, save, crypto, schoon, anthropic }) => {
  const H = () => { if (!db.data.homekit) db.data.homekit = {}; return db.data.homekit; };
  const woningVan = (key) => {
    const h = H();
    if (!h[key]) { h[key] = { apparaten: JSON.parse(JSON.stringify(BASIS)), scenes: [] }; save(); }
    return h[key];
  };

  function overzicht(key) {
    const w = woningVan(key);
    return { kamers: KAMERS.map(k => ({ kamer: k, apparaten: w.apparaten.filter(a => a.kamer === k) })).filter(k => k.apparaten.length),
      scenes: w.scenes.map(s => ({ id: s.id, naam: s.naam, uitleg: s.uitleg, aantal: Object.keys(s.standen).length })) };
  }

  // een apparaat bedienen; standen worden per soort begrensd
  function zet(key, id, stand) {
    const w = woningVan(key);
    const a = w.apparaten.find(x => x.id === String(id || ''));
    if (!a) return { status: 404, error: 'Dit apparaat staat niet in uw woning.' };
    const s = stand || {};
    if (a.soort === 'slot') { if (typeof s.opSlot === 'boolean') a.stand.opSlot = s.opSlot; }
    else {
      if (typeof s.aan === 'boolean') a.stand.aan = s.aan;
      if (typeof s.open === 'boolean' && 'open' in a.stand) a.stand.open = s.open;
      if (s.dim != null && 'dim' in a.stand) a.stand.dim = Math.max(1, Math.min(100, Number(s.dim) || 0));
      if (s.volume != null && 'volume' in a.stand) a.stand.volume = Math.max(0, Math.min(100, Number(s.volume) || 0));
      if (s.temp != null && 'temp' in a.stand) a.stand.temp = Math.max(5, Math.min(30, Number(s.temp) || 0));
    }
    save();
    return { status: 200, ok: true, apparaat: a };
  }

  // alles uit met een tik; sloten en de laadpaal blijven met rust
  function allesUit(key) {
    const w = woningVan(key);
    let n = 0;
    for (const a of w.apparaten) {
      if (a.soort === 'slot' || a.id === 'laadpaal') continue;
      if ('aan' in a.stand && a.stand.aan) { a.stand.aan = false; n++; }
    }
    save();
    return { status: 200, ok: true, uitgezet: n };
  }

  // standen schonen voor een scene: sloten er hard uit, waarden begrensd
  function schoonStanden(w, standen) {
    const uit = {};
    for (const [id, s] of Object.entries(standen || {})) {
      const a = w.apparaten.find(x => x.id === id);
      if (!a || a.soort === 'slot' || !s || typeof s !== 'object') continue;
      const z = {};
      if (typeof s.aan === 'boolean') z.aan = s.aan;
      if (typeof s.open === 'boolean' && 'open' in a.stand) z.open = s.open;
      if (s.dim != null && 'dim' in a.stand) z.dim = Math.max(1, Math.min(100, Number(s.dim) || 0));
      if (s.volume != null && 'volume' in a.stand) z.volume = Math.max(0, Math.min(100, Number(s.volume) || 0));
      if (s.temp != null && 'temp' in a.stand) z.temp = Math.max(5, Math.min(30, Number(s.temp) || 0));
      if (Object.keys(z).length) uit[id] = z;
    }
    return uit;
  }

  /* de AI-scenemaker: een wens wordt een VOORSTEL (naam, uitleg, standen);
     het lid bekijkt het, bewaart en start het zelf. */
  async function sceneVoorstel(key, wens) {
    const w = woningVan(key);
    const q = schoon(String(wens || ''), 200);
    if (!q || q.length < 3) return { status: 400, error: 'Vertel eerst wat voor moment het moet worden (bijv. filmavond).' };
    if (anthropic) {
      try {
        const lijst = w.apparaten.filter(a => a.soort !== 'slot')
          .map(a => a.id + ' (' + a.naam + ', ' + a.kamer + ', velden: ' + Object.keys(a.stand).join('/') + ')').join('\n');
        const r = await anthropic.messages.create({ model: 'claude-opus-4-8', max_tokens: 700,
          system: 'Je bent de scenemaker van een smart home. Antwoord UITSLUITEND met geldige JSON: {"naam":"korte naam","uitleg":"een zin","standen":{"apparaat-id":{...}}}. ' +
            'Gebruik alleen de opgegeven apparaat-ids en velden (aan:boolean, open:boolean, dim:1-100, volume:0-100, temp:5-30). Sloten bestaan voor jou niet.',
          messages: [{ role: 'user', content: 'De wens: ' + q + '\n\nDe apparaten:\n' + lijst }] });
        const uit = (r.content || []).map(b => b.text || '').join('');
        const j = JSON.parse(uit.slice(uit.indexOf('{'), uit.lastIndexOf('}') + 1));
        const standen = schoonStanden(w, j.standen);
        if (j.naam && Object.keys(standen).length)
          return { status: 200, voorstel: { naam: schoon(j.naam, 60), uitleg: schoon(j.uitleg || '', 240), standen } };
      } catch (e) { /* val terug op de demo-motor */ }
    }
    const d = DEMO_SCENES.find(x => x.als.test(q)) || { naam: 'Scene: ' + q.slice(0, 40), uitleg: 'Een rustige basisstand: zachte verlichting en de rest uit.',
      standen: { 'lamp-sfeer': { aan: true, dim: 35 }, 'lamp-woon': { aan: false }, 'tv-woon': { aan: false }, 'speaker-woon': { aan: false } } };
    return { status: 200, demo: true, voorstel: { naam: d.naam, uitleg: d.uitleg, standen: schoonStanden(w, d.standen) } };
  }

  function sceneBewaar(key, { naam, uitleg, standen } = {}) {
    const w = woningVan(key);
    const n = schoon(String(naam || ''), 60).trim();
    if (!n) return { status: 400, error: 'Geef de scene eerst een naam.' };
    const s = schoonStanden(w, standen);
    if (!Object.keys(s).length) return { status: 400, error: 'Een scene heeft minstens een apparaatstand nodig.' };
    if (w.scenes.length >= 30) return { status: 400, error: 'Het maximum van dertig scenes is bereikt; ruim eerst op.' };
    const id = 'sc-' + crypto.randomInt(100000, 999999);
    w.scenes.push({ id, naam: n, uitleg: schoon(String(uitleg || ''), 240), standen: s });
    save();
    return { status: 200, ok: true, id };
  }

  function sceneStart(key, id) {
    const w = woningVan(key);
    const s = w.scenes.find(x => x.id === String(id || ''));
    if (!s) return { status: 404, error: 'Deze scene bestaat niet (meer).' };
    let n = 0;
    for (const [aid, stand] of Object.entries(s.standen)) { const r = zet(key, aid, stand); if (r.ok) n++; }
    return { status: 200, ok: true, naam: s.naam, gezet: n };
  }

  function sceneWeg(key, id) {
    const w = woningVan(key);
    const ix = w.scenes.findIndex(x => x.id === String(id || ''));
    if (ix < 0) return { status: 404, error: 'Deze scene bestaat niet (meer).' };
    w.scenes.splice(ix, 1); save();
    return { status: 200, ok: true };
  }

  return { homekit: { overzicht, zet, allesUit, sceneVoorstel, sceneBewaar, sceneStart, sceneWeg } };
};
