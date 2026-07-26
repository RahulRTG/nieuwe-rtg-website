/* RTG Galerij: alle eigen beelden op een plek, zonder dubbele opslag. De
   tijdlijn LEEST twee bronnen die er al zijn -- de eigen Salon-posts met
   beeld en de afbeeldingen in RTG Bestanden -- en legt daar een eigen,
   lichte laag overheen: albums en favorieten als verwijzingen ({bron, id}),
   nooit als kopie van de bytes. Geen gezichtsherkenning, geen datamining:
   de tijdlijn is gewoon de kalender.

   Snaps en verhalen horen hier bewust NIET in: die zijn vluchtig (24 uur,
   een keer kijken) en dat blijven ze. */

const MAX_ALBUMS = 50;
const MAX_PER_ALBUM = 500;
const BRONNEN = ['salon', 'bestand'];

function maakGalerij({ db, save, crypto, schoon }) {
  const nu = () => new Date().toISOString();

  function bord(key) {
    if (!db.data.galerij || typeof db.data.galerij !== 'object') db.data.galerij = {};
    const k = 'lid:' + key;
    if (!db.data.galerij[k]) db.data.galerij[k] = { albums: [], favoriet: [] };
    return db.data.galerij[k];
  }
  const zelfde = (a, b) => a.bron === b.bron && String(a.id) === String(b.id);
  function geldig(item) {
    return item && BRONNEN.includes(item.bron) && item.id != null && String(item.id).length < 80;
  }

  /* ---- de tijdlijn: lezen wat er al is ---- */
  function beelden(key) {
    const uit = [];
    // eigen Salon-posts met beeld: publieke /media/-verwijzingen
    for (const p of db.data.posts || []) {
      if (p.authorKey !== key) continue;
      const srcs = Array.isArray(p.media) && p.media.length ? p.media.map(b => b.src) : (p.photo ? [p.photo] : []);
      srcs.forEach((src, i) => {
        if (typeof src === 'string' && src.startsWith('/media/')) {
          uit.push({ bron: 'salon', id: p.id + (i ? ':' + i : ''), src, op: p.at || p.op || '', uit: 'De Salon' });
        }
      });
    }
    // afbeeldingen in RTG Bestanden: privaat, het scherm haalt ze via /api/bestanden/haal
    const kluis = (db.data.bestanden || {})['lid:' + key];
    for (const it of (kluis && kluis.items) || []) {
      if (it.weg || !/^image\//.test(String(it.mime || ''))) continue;
      uit.push({ bron: 'bestand', id: it.id, src: null, naam: it.naam, op: it.gewijzigd || it.op, uit: 'Bestanden' });
    }
    return uit.sort((a, b) => String(b.op).localeCompare(String(a.op)));
  }

  function galerijMijn(key) {
    const g = bord(key);
    const alles = beelden(key);
    const fav = g.favoriet;
    for (const b of alles) b.favoriet = fav.some(f => zelfde(f, b));
    // de albums geven hun verwijzingen terug; het scherm zoekt de beelden erbij
    const albums = g.albums.map(a => ({ id: a.id, naam: a.naam, items: a.items, op: a.op }));
    // herinnering: dezelfde maand, eerdere jaren -- een rustige terugblik, geen trucje
    const maand = new Date().toISOString().slice(5, 7);
    const ditJaar = new Date().toISOString().slice(0, 4);
    const terug = alles.filter(b => String(b.op).slice(5, 7) === maand && String(b.op).slice(0, 4) !== ditJaar).slice(0, 12);
    return { beelden: alles, albums, terugblik: terug };
  }

  /* ---- albums: verwijzingen, geen kopieen ---- */
  function galerijAlbum(key, { id, naam, weg }) {
    const g = bord(key);
    if (id && weg) {
      g.albums = g.albums.filter(a => a.id !== String(id)); save();
      return { ok: true };  // alleen het album weg; de beelden staan gewoon in hun bron
    }
    naam = schoon(String(naam || ''), 60).trim();
    if (!naam) return { status: 400, error: 'Geef het album een naam.' };
    if (id) {
      const a = g.albums.find(x => x.id === String(id));
      if (!a) return { status: 404, error: 'Dat album bestaat niet.' };
      a.naam = naam; save();
      return { id: a.id };
    }
    if (g.albums.length >= MAX_ALBUMS) return { status: 409, error: 'U heeft al ' + MAX_ALBUMS + ' albums.' };
    const a = { id: 'ga' + crypto.randomBytes(5).toString('hex'), naam, items: [], op: nu() };
    g.albums.push(a); save();
    return { id: a.id };
  }
  function galerijZet(key, { album, item, aan }) {
    const g = bord(key);
    const a = g.albums.find(x => x.id === String(album || ''));
    if (!a) return { status: 404, error: 'Dat album bestaat niet.' };
    if (!geldig(item)) return { status: 400, error: 'Dat beeld kent de galerij niet.' };
    a.items = a.items.filter(x => !zelfde(x, item));
    if (aan !== false) {
      if (a.items.length >= MAX_PER_ALBUM) return { status: 409, error: 'Dit album zit vol (' + MAX_PER_ALBUM + ').' };
      a.items.push({ bron: item.bron, id: String(item.id) });
    }
    save();
    return { ok: true, aantal: a.items.length };
  }
  function galerijFavoriet(key, { item, aan }) {
    const g = bord(key);
    if (!geldig(item)) return { status: 400, error: 'Dat beeld kent de galerij niet.' };
    g.favoriet = g.favoriet.filter(x => !zelfde(x, item));
    if (aan !== false) g.favoriet.push({ bron: item.bron, id: String(item.id) });
    save();
    return { ok: true, favorieten: g.favoriet.length };
  }

  return { galerijMijn, galerijAlbum, galerijZet, galerijFavoriet };
}

module.exports = { maakGalerij };
