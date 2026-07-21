/* "Werkt met RTG Home Kit": de open koppelstandaard waarmee ALLE merken op
   de Home Kit kunnen aansluiten. Twee kanten:
   - het lid: verbindt een aangesloten merk; de apparaten van dat merk komen
     in de eigen woning en doen mee met scenes en Alles-uit. Ontkoppelen
     haalt ze weer weg, ook uit bewaarde scenes.
   - het merk: ELK RTG-partnermerk kan zich aanmelden via de leverancier-API
     (naam + apparaten) en staat dan meteen tussen de merken; RTG kan een
     merk altijd pauzeren via de regie.
   De demo-merken zijn eigen, fictieve namen (merkregel: nooit echte merken
   als bevestigde partners opvoeren). Sloten van welk merk dan ook volgen
   dezelfde vaste regel: nooit in een scene, nooit via de AI. */

// de aangesloten demo-merken: samen dekken ze alle elektronica in huis
const MERKEN_SEED = [
  { id: 'lumo', naam: 'LUMO', soort: 'Verlichting', icon: '💡', uitleg: 'Slimme lampen en strips voor elke kamer.',
    apparaten: [{ naam: 'Lichtstrip', kamer: 'Woonkamer', soort: 'lamp', icon: '🌈', stand: { aan: false, dim: 50 } },
      { naam: 'Buitenspot', kamer: 'Terras', soort: 'lamp', icon: '🔦', stand: { aan: false, dim: 70 } }] },
  { id: 'therma', naam: 'THERMA', soort: 'Klimaat', icon: '🌡️', uitleg: 'Radiatorknoppen en koeling, per kamer geregeld.',
    apparaten: [{ naam: 'Radiatorknop slaapkamer', kamer: 'Slaapkamer', soort: 'klimaat', icon: '♨️', stand: { aan: true, temp: 18 } },
      { naam: 'Airco werkkamer', kamer: 'Werkkamer', soort: 'klimaat', icon: '❄️', stand: { aan: false, temp: 21 } }] },
  { id: 'klank', naam: 'KLANK', soort: 'Audio', icon: '🔊', uitleg: 'Speakers die in elke scene meedoen.',
    apparaten: [{ naam: 'Soundbar', kamer: 'Woonkamer', soort: 'audio', icon: '🎵', stand: { aan: false, volume: 35 } },
      { naam: 'Keukenspeaker', kamer: 'Keuken', soort: 'audio', icon: '🎶', stand: { aan: false, volume: 25 } }] },
  { id: 'helder', naam: 'HELDER', soort: 'Zonwering', icon: '🪟', uitleg: 'Rolluiken en zonwering, ook op zonstand.',
    apparaten: [{ naam: 'Rolluiken slaapkamer', kamer: 'Slaapkamer', soort: 'gordijn', icon: '🎚️', stand: { open: true } },
      { naam: 'Zonwering terras', kamer: 'Terras', soort: 'gordijn', icon: '⛱️', stand: { open: false } }] },
  { id: 'groenvolt', naam: 'GROENVOLT', soort: 'Energie', icon: '⚡', uitleg: 'Slimme meter en thuisbatterij; zien en sturen.',
    apparaten: [{ naam: 'Thuisbatterij', kamer: 'Hal', soort: 'stekker', icon: '🔋', stand: { aan: true } },
      { naam: 'Slimme meter', kamer: 'Hal', soort: 'stekker', icon: '📈', stand: { aan: true } }] },
  { id: 'slotwerk', naam: 'SLOTWERK', soort: 'Toegang', icon: '🔐', uitleg: 'Sloten en de deurbel. Sloten blijven altijd handwerk.',
    apparaten: [{ naam: 'Achterdeurslot', kamer: 'Hal', soort: 'slot', icon: '🔒', stand: { opSlot: true } },
      { naam: 'Videodeurbel', kamer: 'Hal', soort: 'stekker', icon: '🔔', stand: { aan: true } }] },
  { id: 'friswit', naam: 'FRISWIT', soort: 'Witgoed', icon: '🧺', uitleg: 'Wasmachine en droger, klaar-seintjes incluis.',
    apparaten: [{ naam: 'Wasmachine', kamer: 'Badkamer', soort: 'stekker', icon: '🧺', stand: { aan: false } },
      { naam: 'Droger', kamer: 'Badkamer', soort: 'stekker', icon: '🌀', stand: { aan: false } }] },
  { id: 'kokka', naam: 'KOKKA', soort: 'Keuken', icon: '🍳', uitleg: 'Oven en afzuigkap die met het koken meedenken.',
    apparaten: [{ naam: 'Oven', kamer: 'Keuken', soort: 'stekker', icon: '🍞', stand: { aan: false } },
      { naam: 'Afzuigkap', kamer: 'Keuken', soort: 'stekker', icon: '💨', stand: { aan: false } }] },
  { id: 'tuinrijk', naam: 'TUINRIJK', soort: 'Tuin', icon: '🌿', uitleg: 'Beregening en de robotmaaier, op schema.',
    apparaten: [{ naam: 'Beregening', kamer: 'Terras', soort: 'stekker', icon: '💦', stand: { aan: false } },
      { naam: 'Robotmaaier', kamer: 'Terras', soort: 'stekker', icon: '🤖', stand: { aan: false } }] },
  { id: 'zuiver', naam: 'ZUIVER', soort: 'Luchtkwaliteit', icon: '🍃', uitleg: 'Luchtreinigers voor een fris huis.',
    apparaten: [{ naam: 'Luchtreiniger', kamer: 'Slaapkamer', soort: 'stekker', icon: '🍃', stand: { aan: false } },
      { naam: 'Luchtreiniger woonkamer', kamer: 'Woonkamer', soort: 'stekker', icon: '🍃', stand: { aan: false } }] }
];

const KAMERS_OK = ['Woonkamer', 'Keuken', 'Slaapkamer', 'Badkamer', 'Werkkamer', 'Hal', 'Terras'];
const SOORTEN_OK = ['lamp', 'klimaat', 'audio', 'gordijn', 'stekker', 'tv', 'slot'];

module.exports = ({ db, save, schoon }) => {
  const M = () => {
    if (!db.data.homeMerken) { db.data.homeMerken = JSON.parse(JSON.stringify(MERKEN_SEED)); save(); }
    return db.data.homeMerken;
  };
  const woning = (key) => (db.data.homekit || {})[key] || null;

  function merken(key) {
    const w = woning(key);
    const verbonden = (w && w.merken) || [];
    return { merken: M().filter(m => m.status !== 'pauze').map(m => ({ id: m.id, naam: m.naam, soort: m.soort, icon: m.icon,
      uitleg: m.uitleg, aantal: m.apparaten.length, partner: !!m.partner, verbonden: verbonden.includes(m.id) })) };
  }

  // het lid verbindt een merk: de apparaten stromen de woning in
  function verbind(key, id) {
    const w = woning(key);
    if (!w) return { status: 400, error: 'Open eerst de Home Kit; dan staat uw woning klaar.' };
    const m = M().find(x => x.id === String(id || '') && x.status !== 'pauze');
    if (!m) return { status: 404, error: 'Dit merk is (nog) niet aangesloten op de Home Kit.' };
    if (!w.merken) w.merken = [];
    if (w.merken.includes(m.id)) return { status: 200, ok: true, alVerbonden: true, merk: m.naam };
    m.apparaten.forEach((a, ix) => {
      w.apparaten.push({ id: m.id + '-' + ix, kamer: a.kamer, naam: m.naam + ' ' + a.naam, soort: a.soort,
        icon: a.icon, merk: m.id, stand: JSON.parse(JSON.stringify(a.stand)) });
    });
    w.merken.push(m.id); save();
    return { status: 200, ok: true, merk: m.naam, apparaten: m.apparaten.length };
  }

  // ontkoppelen haalt de merk-apparaten weg, ook uit bewaarde scenes
  function ontkoppel(key, id) {
    const w = woning(key);
    const mid = String(id || '');
    if (!w || !w.merken || !w.merken.includes(mid)) return { status: 404, error: 'Dit merk is niet verbonden.' };
    w.apparaten = w.apparaten.filter(a => a.merk !== mid);
    for (const s of w.scenes) for (const aid of Object.keys(s.standen)) if (aid.startsWith(mid + '-')) delete s.standen[aid];
    w.scenes = w.scenes.filter(s => Object.keys(s.standen).length);
    w.merken = w.merken.filter(x => x !== mid); save();
    return { status: 200, ok: true };
  }

  /* de open kant: ELK partnermerk meldt zich aan met naam + apparaten en
     staat meteen tussen de merken (RTG kan pauzeren via de regie) */
  function meldAan(supplier, { naam, soort, uitleg, apparaten } = {}) {
    const n = schoon(String(naam || supplier.name || ''), 40).trim();
    if (!n) return { status: 400, error: 'Geef het merk een naam.' };
    const id = 'p-' + String(supplier.code || '').toLowerCase();
    const lijst = (Array.isArray(apparaten) ? apparaten : []).slice(0, 12).map(a => ({
      naam: schoon(String(a.naam || ''), 60), kamer: KAMERS_OK.includes(a.kamer) ? a.kamer : 'Woonkamer',
      soort: SOORTEN_OK.includes(a.soort) ? a.soort : 'stekker', icon: schoon(String(a.icon || '🔌'), 4),
      stand: a.soort === 'slot' ? { opSlot: true } : a.soort === 'klimaat' ? { aan: false, temp: 20 }
        : a.soort === 'audio' ? { aan: false, volume: 30 } : a.soort === 'gordijn' ? { open: false }
        : a.soort === 'lamp' ? { aan: false, dim: 60 } : { aan: false }
    })).filter(a => a.naam);
    if (!lijst.length) return { status: 400, error: 'Meld minstens een apparaat aan (naam + soort).' };
    const alle = M();
    const bestaand = alle.find(x => x.id === id);
    const merk = { id, naam: n, soort: schoon(String(soort || 'Elektronica'), 30), icon: '🔗',
      uitleg: schoon(String(uitleg || 'Aangesloten via de open RTG-koppelstandaard.'), 160), apparaten: lijst, partner: true };
    if (bestaand) Object.assign(bestaand, merk); else alle.push(merk);
    save();
    return { status: 200, ok: true, id, apparaten: lijst.length };
  }

  return { homeMerken: { merken, verbind, ontkoppel, meldAan } };
};
