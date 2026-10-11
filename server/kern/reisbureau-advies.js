/* HET LOKALE REISADVIES van het RTG-reisbureau (hoort bij kern/reisbureau.js).

   Het lid vertelt in vrije tekst wat het zoekt; een uitlegbare score wijst de
   best passende reis uit de BESTAANDE catalogus aan en toont de woorden waarop
   de overeenkomst berust. Geen model, geen sleutel, geen netwerk: dit is
   regelwerk, en het zegt dat ook (`bron: 'regel'`, `ai: false`).

   Waarom apart: dit is de enige laag van het reisbureau die niets aan een
   aanvraag verandert -- hij leest de catalogus en rangschikt hem. Hij draait op
   dezelfde `reizen()` als de rest, zodat er geen tweede projectie van de prijs
   ontstaat.

   EEN GENOEMDE BESTEMMING IS EEN EIS EN GEEN WOORD (romeproef schakel 13). Het
   advies rangschikte alle woorden even zwaar, dus "een weekend Rome" wees op
   het woord `weekend` een reis naar GSTAAD aan -- een verkeerd antwoord dat er
   goed uitzag. Daarom eerst: noemt de wens een plaats? Zo ja, dan wordt alleen
   onder de reizen NAAR die plaats gerangschikt, en is er geen, dan komt er GEEN
   andere stad terug maar de weg die er wel is (het reisbureau stelt hem samen).
   Een plaats herkennen gebeurt op hele woorden (`zelfdePlaats` uit
   kern/reizen-vorm.js, waar "Rome" geen "Romeinse Riviera" is), tegen de
   bestemmingen van de catalogus plus die van de eigen Reis-Bibliotheek -- een
   bestaande lijst, geen tweede plaatsnamenregister. Een plaats die in geen van
   beide staat wordt niet herkend; dan valt het advies terug op de woorden, en
   dat zegt `onderbouwing.bestemming: null`. */
const { zelfdePlaats } = require('./reizen-vorm');
const { BESTEMMINGEN: GIDSPLAATSEN } = require('./reisbieb');

function genoemdePlaats(wens, lijst) {
  const w = ' ' + String(wens || '').toLowerCase().replace(/[^a-z0-9à-ÿ]+/g, ' ') + ' ';
  const kandidaten = [...new Set([...lijst.map(r => r.bestemming), ...GIDSPLAATSEN].filter(Boolean))];
  // de langste naam eerst, zodat "Dubai Marina" voor "Dubai" gaat
  kandidaten.sort((a, b) => String(b).length - String(a).length);
  for (const k of kandidaten) {
    const kern = String(k).toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9à-ÿ]+/g, ' ').trim();
    if (kern && w.includes(' ' + kern + ' ')) return kern.replace(/(^|\s)\S/g, x => x.toUpperCase());
  }
  return null;
}

module.exports = ({ reizen }) => {
  function regelRangschik(wens, lijst) {
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
    const plaats = genoemdePlaats(wens, lijst);
    if (plaats) {
      const daar = lijst.filter(r => zelfdePlaats(r.bestemming, plaats));
      if (!daar.length) {
        return { ok: true, reis: null, ontbreekt: { bestemming: plaats },
          reden: 'Er staat geen reis naar ' + plaats + ' in de catalogus. Ik wijs u daarom geen andere stad aan; een reis naar ' + plaats + ' bestaat hier alleen als het reisbureau hem op maat samenstelt en voor u klaarzet. Er is niets aangevraagd of geboekt.',
          bron: 'regel', ai: false, onderbouwing: { score: 0, treffers: [], bestemming: plaats } };
      }
      const val = regelRangschik(wens, daar);
      const ook = val.treffers.filter(t => !zelfdePlaats(t, plaats));
      return { ok: true, reis: val.reis, reden: 'Deze reis gaat naar ' + plaats + (ook.length ? ' en sluit aan op ' + ook.join(', ') : '') + '.',
        bron: 'regel', ai: false, onderbouwing: { score: val.score, treffers: val.treffers, bestemming: plaats } };
    }
    const val = regelRangschik(wens, lijst);
    const reden = val.treffers.length
      ? 'Deze reis sluit aan op ' + val.treffers.join(', ') + '.'
      : 'Er is geen sterke inhoudelijke match; dit is het eerste beschikbare voorstel om mee te vergelijken.';
    return { ok: true, reis: val.reis, reden, bron: 'regel', ai: false,
      onderbouwing: { score: val.score, treffers: val.treffers, bestemming: null } };
  }

  return { advies };
};
