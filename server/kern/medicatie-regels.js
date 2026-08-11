/* De rekenregels van het medicatieschema, los van de database.

   Ze staan apart omdat ze puur zijn: er gaat iets in, er komt iets uit, en er
   is geen opslag bij betrokken. Dat maakt ze los na te rekenen -- en het is
   precies het stuk waar de eerlijkheid van dit onderdeel in zit: wat "niet
   ingevuld" betekent, hoe er geteld wordt, en wat er gebeurt met een tijd die
   geen tijd is. De deuren en de opslag staan in ./medicatie.js. */

/* Het bordje aan de muur. Staat er altijd, ook als er niets aan de hand is: bij
   een gesprek is de grens een alarm, bij een schema een bordje. */
const GRENS = {
  kop: 'RTG gaat niet over uw medicijnen',
  tekst: 'Dit is uw eigen lijst en uw eigen wekker. Over dosering, afbouwen, '
    + 'combinaties en bijwerkingen zegt RTG niets, ook niet voorzichtig.',
  wegen: [
    { naam: 'Uw arts of behandelaar', hoe: 'Die kent uw dossier en schrijft voor' },
    { naam: 'Uw apotheek', hoe: 'Voor innemen, combinaties en bijwerkingen' }
  ]
};

const dag = d => new Date(d).toISOString().slice(0, 10);
const TIJD = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
const MAX_MOMENTEN = 12;

/* Momenten zijn kloktijden die het lid zelf zet. Wat geen kloktijd is, valt weg
   -- en niet stilletjes: de aanroeper krijgt te horen hoeveel er weg zijn
   gevallen, zodat een vertypte tijd niet als "ingevuld" op het scherm komt.

   Alleen wat GEEN kloktijd was telt als afgevallen. Een dubbele tijd is geen
   vergissing om over te melden, en de bovengrens krijgt zijn eigen zin --
   anders leest "08:00, 08:00" als een vertypte tijd. */
function momentenVan(in_) {
  const ruw = (Array.isArray(in_) ? in_ : String(in_ || '').split(','))
    .map(x => String(x || '').trim()).filter(Boolean);
  const geldig = ruw.filter(t => TIJD.test(t));
  const uniek = [...new Set(geldig)].sort();
  return { goed: uniek.slice(0, MAX_MOMENTEN), weg: ruw.length - geldig.length,
    teveel: Math.max(0, uniek.length - MAX_MOMENTEN) };
}

/* Hoeveel innames er zijn afgetekend sinds de voorraad is bijgewerkt. Dit is de
   ENIGE telling die er is, en het scherm zegt er ook bij dat het zo werkt: wie
   niet aftekent, ziet een voorraad die te hoog staat. Liever een eerlijk
   onvolledige telling dan een verzonnen volledige. */
function genomenSinds(m, id, sinds) {
  let n = 0;
  for (const d of Object.keys(m.afgetekend || {})) {
    if (sinds && d < dag(sinds)) continue;
    for (const sleutel of Object.keys(m.afgetekend[d])) {
      if (sleutel.split('@')[0] === id) n++;
    }
  }
  return n;
}

/* De voorraad is een METING en geen aanname. Heeft het lid niet ingevuld hoeveel
   er in huis is, dan staat er niet nul en ook geen schatting, maar "niet
   ingevuld" -- met de reden erbij (LAT.md regel 3). */
function voorraadVan(m, mid) {
  if (mid.voorraad == null) {
    return { bekend: false, reden: 'U heeft niet ingevuld hoeveel er in huis is.' };
  }
  const op = Math.max(0, mid.voorraad - genomenSinds(m, mid.id, mid.voorraadOp));
  const perDag = mid.momenten.length;
  return {
    bekend: true, over: op, perDag,
    dagenNog: perDag ? Math.floor(op / perDag) : null,
    dagenReden: perDag ? null
      : 'Er staan geen tijden bij dit middel, dus er valt niet uit te rekenen hoe lang het nog duurt.',
    geteldVanaf: mid.voorraadOp || null,
    hoe: 'Geteld vanaf wat u zelf heeft afgetekend. Tekent u niet af, dan staat deze voorraad te hoog.'
  };
}

/* Wat er is afgevallen, in woorden. Leeg als er niets is afgevallen: een lege
   melding is erger dan geen melding. */
function waarschuwing(mom) {
  const woorden = [];
  if (mom.weg) woorden.push(mom.weg + ' tijd(en) vielen af: een moment moet een kloktijd zijn, zoals 08:00.');
  if (mom.teveel) woorden.push(mom.teveel + ' tijd(en) vielen af: er passen er twaalf op een middel.');
  return woorden.join(' ');
}

module.exports = { GRENS, dag, momentenVan, genomenSinds, voorraadVan, waarschuwing, MAX_MOMENTEN };
