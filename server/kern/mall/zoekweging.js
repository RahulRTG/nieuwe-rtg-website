/* RTG Mall, deelbestand "zoekweging": WAT EEN ZOEKOPDRACHT BETEKENT.

   Twee dingen, allebei puur (geen database, geen ctx), zodat ze los te lezen
   en los te toetsen zijn:

     lees()        haalt uit een zoekzin de intentie ("huren", "boeken"), de
                   plek ("ibiza") en wat er overblijft aan echte zoekwoorden.
     relevantie()  bepaalt of een aanbod een TREFFER is, en hoe sterk.

   De scheiding tussen relevantie en boost is met opzet hard. RELEVANTIE
   bepaalt of iets een antwoord is op de vraag; BOOST bepaalt alleen de
   volgorde tussen antwoorden. Toen dat een som was, gaf "scooter huren ibiza"
   negen resultaten -- vier ringen, drie potten honing en twee villa's -- puur
   omdat die op voorraad stonden. Beschikbaarheid hoort in boost en nergens
   anders.

   Wat hier NIET in staat en er ook niet in komt: de partnerstatus van de
   aanbieder. Een RTG Partner komt niet hoger omdat hij partner is.
   Zoekkwaliteit die te koop is, is binnen een week niets meer waard, en dan
   is de hele Mall niets meer waard. Partners krijgen hun voordeel in
   integratie (realtime voorraad, agenda, checkout), niet in ranking.
   test/mall-vindlaag.test.js houdt dat vast door deze weging te lezen. */

/* Intentiewoorden. "huren", "boeken", "nu" zeggen iets over wat de gebruiker
   wil DOEN, en dat is een sterker signaal dan welk woord dan ook in een
   productomschrijving. De lijst is klein en handmatig; hij hoort klein te
   blijven, want een intentietabel die niemand meer overziet gaat raden. */
const INTENTIE = [
  { woorden: ['huren', 'huur', 'verhuur'], typen: ['huur'] },
  { woorden: ['kopen', 'koop', 'bestellen'], typen: ['product', 'marktplaats'] },
  { woorden: ['tweedehands', 'gebruikt', 'occasion'], typen: ['marktplaats'] },
  { woorden: ['boeken', 'overnachten', 'slapen', 'hotel'], typen: ['verblijf'] },
  { woorden: ['eten', 'dineren', 'restaurant', 'tafel', 'lunch'], typen: ['eten'] },
  { woorden: ['reis', 'reizen', 'vakantie'], typen: ['reis'] },
  { woorden: ['vervoer', 'rijden', 'taxi', 'vlucht', 'vliegen'], typen: ['vervoer'] },
  { woorden: ['afspraak', 'behandeling', 'massage', 'knippen'], typen: ['dienst'] },
  { woorden: ['offerte', 'aanvraag', 'klus'], typen: ['offerte'] },
  { woorden: ['ticket', 'tickets', 'kaartjes'], typen: ['ticket'] }
];

const woorden = (q) => String(q == null ? '' : q).toLowerCase()
  .split(/[^a-z0-9À-ɏ]+/).filter(w => w.length > 1).slice(0, 12);

/* Wat de zoekopdracht bedoelt. "scooter huren ibiza" -> typen ['huur'], plek
   ibiza, resterende woorden ['scooter']. De plekken komen mee als lijst omdat
   alleen de Mall weet waar werkelijk iets staat. */
function lees(q, plekken, slugVan) {
  const alle = woorden(q);
  const typen = new Set();
  const rest = [];
  let plekSlug = null;
  for (const w of alle) {
    const i = INTENTIE.find(x => x.woorden.includes(w));
    if (i) { i.typen.forEach(t => typen.add(t)); continue; }
    const p = plekken.find(x => x.slug === slugVan(w) || (x.stad || '').toLowerCase() === w);
    if (p && !plekSlug) { plekSlug = p.slug; continue; }
    rest.push(w);
  }
  return { typen: [...typen], woorden: rest, alle, plekSlug };
}

/* Een woord raakt een tekst als het aan het BEGIN van een woord staat, niet
   zomaar ergens erin. Dat scheelt onzin ("ring" vond eerst de "katoenen
   voering" van een weekendtas) en houdt tegelijk de Nederlandse samenstelling
   heel: "boot" hoort "bootverhuur" gewoon te vinden. */
function raakt(tekst, w) {
  for (let k = tekst.indexOf(w); k >= 0; k = tekst.indexOf(w, k + 1)) {
    if (k === 0 || !/[a-z0-9]/.test(tekst[k - 1])) return true;
  }
  return false;
}

/* De relevantie. Titel weegt het zwaarst, dan wie het aanbiedt, dan genre en
   kenmerken, dan de omschrijving. Een intentie die klopt telt zwaar mee, want
   die zegt wat iemand wil doen. */
function relevantie(a, gelezen) {
  let s = 0;
  const titel = a.titel.toLowerCase();
  const aanbieder = a.aanbieder.naam.toLowerCase();
  const genre = ((a.genreLabel || '') + ' ' + (a.genre || '')).toLowerCase();
  const kenmerk = a.kenmerken.join(' ').toLowerCase();
  const uitleg = (a.uitleg || '').toLowerCase();
  for (const w of gelezen.woorden) {
    if (titel === w) s += 12;
    else if (raakt(titel, w)) s += 8;
    if (raakt(aanbieder, w)) s += 5;
    if (raakt(genre, w)) s += 4;
    if (raakt(kenmerk, w)) s += 3;
    if (raakt(uitleg, w)) s += 2;
  }
  if (gelezen.typen.length && gelezen.typen.includes(a.type)) s += 6;
  return s;
}

// alleen de volgorde tussen treffers: iets dat vandaag kan is bruikbaarder
const boost = (a) => (a.beschikbaar && a.beschikbaar.hard ? 2 : 0);

module.exports = { INTENTIE, woorden, lees, raakt, relevantie, boost };
