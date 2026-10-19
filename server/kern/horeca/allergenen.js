/* De veertien wettelijke allergenen (EU-verordening 1169/2011, bijlage II),
   met de namen zoals een keuken ze in de praktijk intypt.

   Tot 19 oktober 2026 knipte de menukaart de allergenen van een gerecht af op
   twaalf, en nam hij elke vrije tekst aan. Een gerecht met alle veertien
   verloor er stil twee. Een allergeen dat stil verdwijnt is erger dan een
   foutmelding, dus: een bekend synoniem wordt de wettelijke naam, en een
   onbekende term wordt teruggegeven zodat de route kan weigeren. */
'use strict';

const ALLERGENEN = ['gluten', 'schaaldieren', 'eieren', 'vis', 'pinda', 'noten', 'soja', 'melk',
  'selderij', 'mosterd', 'sesam', 'sulfiet', 'lupine', 'weekdieren'];

const SYNONIEMEN = {
  tarwe: 'gluten', rogge: 'gluten', gerst: 'gluten', haver: 'gluten', spelt: 'gluten', glutenbevattende: 'gluten',
  schaaldier: 'schaaldieren', kreeftachtigen: 'schaaldieren', crustaceans: 'schaaldieren',
  ei: 'eieren', eiren: 'eieren', egg: 'eieren', eggs: 'eieren',
  fish: 'vis',
  pindas: 'pinda', "pinda's": 'pinda', 'pinda’s': 'pinda', peanut: 'pinda', peanuts: 'pinda', aardnoot: 'pinda',
  noot: 'noten', notenmix: 'noten', nuts: 'noten', schaalvruchten: 'noten',
  soya: 'soja', soy: 'soja',
  lactose: 'melk', zuivel: 'melk', milk: 'melk', dairy: 'melk',
  selder: 'selderij', selderie: 'selderij', celery: 'selderij',
  mustard: 'mosterd',
  sesamzaad: 'sesam', sesame: 'sesam',
  sulfieten: 'sulfiet', zwaveldioxide: 'sulfiet', sulfites: 'sulfiet', sulphites: 'sulfiet',
  lupine: 'lupine', lupin: 'lupine',
  weekdier: 'weekdieren', molluscs: 'weekdieren', mollusken: 'weekdieren'
};

/* Geeft { lijst, onbekend }: de wettelijke namen (uniek, in de vaste volgorde)
   en wat niet te herkennen was. */
function normaliseer(ruw) {
  const gevonden = new Set();
  const onbekend = [];
  for (const x of (Array.isArray(ruw) ? ruw : [])) {
    const t = String(x == null ? '' : x).trim().toLowerCase().slice(0, 40);
    if (!t) continue;
    const naam = ALLERGENEN.includes(t) ? t : SYNONIEMEN[t];
    if (naam) gevonden.add(naam); else if (!onbekend.includes(t)) onbekend.push(t);
  }
  return { lijst: ALLERGENEN.filter((a) => gevonden.has(a)), onbekend };
}

module.exports = { ALLERGENEN, SYNONIEMEN, normaliseer };
