/* HET LOKALE REISADVIES van het RTG-reisbureau (hoort bij kern/reisbureau.js).

   Het lid vertelt in vrije tekst wat het zoekt; een uitlegbare score wijst de
   best passende reis uit de BESTAANDE catalogus aan en toont de woorden waarop
   de overeenkomst berust. Geen model, geen sleutel, geen netwerk: dit is
   regelwerk, en het zegt dat ook (`bron: 'regel'`, `ai: false`).

   Waarom apart: dit is de enige laag van het reisbureau die niets aan een
   aanvraag verandert -- hij leest de catalogus en rangschikt hem. Hij draait op
   dezelfde `reizen()` als de rest, zodat er geen tweede projectie van de prijs
   ontstaat. */
module.exports = ({ reizen }) => {
  function regelRangschik(wens) {
    const lijst = reizen();
    if (!lijst.length) return null;
    const w = String(wens || '').toLowerCase();
    const woorden = [...new Set(w.split(/[^a-z0-9à-ÿ]+/).filter(x => x.length > 2))];
    const stop = new Set(['een', 'het', 'die', 'dat', 'met', 'voor', 'naar', 'van', 'zoek', 'willen', 'graag', 'reis']);
    const intenties = [
      ['rust', ['rust', 'stilte', 'rustig', 'natuur', 'wandelen', 'bergen']],
      ['zon', ['zon', 'strand', 'zee', 'warm', 'zwemmen', 'kust']],
      ['cultuur', ['cultuur', 'kunst', 'museum', 'historie', 'stad', 'architectuur']],
      ['culinair', ['culinair', 'eten', 'restaurant', 'wijn', 'keuken', 'proeven']],
      ['avontuur', ['avontuur', 'actief', 'hiken', 'surfen', 'safari', 'duiken']]
    ];
    const uitgebreid = new Set(woorden.filter(x => !stop.has(x)));
    for (const [, groep] of intenties) if (groep.some(x => uitgebreid.has(x))) for (const x of groep) uitgebreid.add(x);
    let beste = lijst[0], score = -1, treffers = [];
    for (const r of lijst) {
      const hooi = ((r.bestemming || '') + ' ' + (r.titel || '') + ' ' + (r.omschrijving || '') + ' ' + (r.inbegrepen || []).join(' ')).toLowerCase();
      const raak = [...uitgebreid].filter(woord => hooi.includes(woord));
      const s = raak.length;
      if (s > score) { score = s; beste = r; treffers = raak; }
    }
    return { reis: beste, score, treffers: treffers.slice(0, 4) };
  }
  async function advies(wens) {
    const lijst = reizen();
    if (!lijst.length) return { status: 404, error: 'Er staan nu geen reizen klaar.' };
    const val = regelRangschik(wens);
    const reden = val.treffers.length
      ? 'Deze reis sluit aan op ' + val.treffers.join(', ') + '.'
      : 'Er is geen sterke inhoudelijke match; dit is het eerste beschikbare voorstel om mee te vergelijken.';
    return { ok: true, reis: val.reis, reden, bron: 'regel', ai: false,
      onderbouwing: { score: val.score, treffers: val.treffers } };
  }

  return { advies };
};
