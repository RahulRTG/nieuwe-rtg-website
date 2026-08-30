/* ============================================================================
   HET OBJECT MAKEN VOOR JE ERAAN KOMT -- de oogst per tak.

   HET PROBLEEM. 1635 mutatieroutes stranden op 404: het ding waar ze over gaan
   bestaat niet. Een proef die met een verzonnen id aanklopt, meet niets -- hij
   krijgt 404 en dat zegt alleen dat er niets is.

   WAT DIT DOET. Voor elke tak van het huis eerst de MAAKroutes aanroepen, het
   teruggegeven id oogsten, en dat meegeven aan de zusterroutes in diezelfde
   tak. De maakroutes zijn de deuren van het product zelf; er wordt niets in de
   database gezet wat de applicatie niet zelf heeft gemaakt.

   WAT HET OPLEVERT, gemeten en niet geschat (scripts/objectoogst.js):
     121 van de 1635 komen daarmee op 2xx
      53 komen voorbij de 404 en stranden verderop
     546 liggen in een tak waar geen enkele maakroute doorkomt
   Ongeveer een op de tien. Dat is geen vervanging voor domeinwerk en het is
   evenveel als drie families uit de sleutelronde opleverden.

   TWEE AANNAMES DIE SNEUVELDEN, en ze staan hier omdat ze er weer in geslopen
   zouden worden:

   1. EEN GLOBALE ZAK MET ID'S WERKT NIET. De eerste versie hield een enkele
      `id`-plek bij; elk nieuw object overschreef het vorige. Een `id` uit de
      kluis van een lid is zinloos voor een festival van een zaak. Vandaar de
      oogst PER TAK, op twee en drie segmenten diep, met de diepste die wint.
   2. HERHALEN WIKKELT DE KETEN NIET AF. Ik verwachtte dat een tweede ronde meer
      maakroutes zou laten slagen omdat er dan meer ouders bestaan. Gemeten
      wordt het er niet meer maar MINDER (71 -> 68): wat in ronde een lukte,
      botst in ronde twee op een bestaand ding. Een ronde is dus genoeg, en een
      tweede kost alleen tijd.

   DE GRENS. Deze module raadt niet welk VELD een route verwacht; hij geeft mee
   wat de maakroute in dezelfde tak teruggaf, onder dezelfde naam. Past dat niet,
   dan blijft het 404 -- en dat is de eerlijke uitkomst, geen groen. */
'use strict';

/* Wat is een maakroute? Aan de STAART van het pad te zien, en dat is een
   heuristiek: hij mist een route die anders heet en pakt er een die niets
   maakt. Allebei is ongevaarlijk -- een gemiste maakroute levert geen oogst en
   een overbodige levert niets bruikbaars. */
const MAAK = /\/(maak|nieuw|open|start|aanmaak|toevoeg|voeg|uitgeven|koppel|boek|aanvraag|maken|aanmeld|inschrijf|uitnodig|registreer|zet)$/;
/* Welke veldnamen dragen een verwijzing naar een zojuist gemaakt ding? Gemeten
   over de 68 maakroutes die doorkomen: id, code, iban, sleutel, nummer. De
   andere twee staan erbij omdat ze in dezelfde vorm voorkomen. */
const IDVELD = /^(id|code|iban|sleutel|nummer|ref|handle|slug)$/i;
const DIEPTES = [2, 3];
const tak = (pad, d) => String(pad).split('/').slice(0, d + 1).join('/');

async function oogstObjecten({ post, routes, tokenVoor, lijfVoor, koppenVoor }) {
  const oogst = {};       // tak -> { veld: waarde }
  const bewaar = (pad, data) => {
    const pluk = (obj) => {
      if (!obj || typeof obj !== 'object') return;
      for (const [k, v] of Object.entries(obj)) {
        const w = typeof v === 'number' ? String(v) : v;
        if (typeof w === 'string' && w.length >= 3 && w.length <= 64 && IDVELD.test(k)) {
          for (const d of DIEPTES) { const t = tak(pad, d); (oogst[t] = oogst[t] || {})[k] = w; }
        }
      }
    };
    pluk(data);
    /* Een niveau diep, want een maakroute geeft zijn ding vaak in een omhulsel
       terug ({ ok: true, ontwerp: { id } }). Twee niveaus niet: dan komen er
       id's van geneste dingen mee die bij een ANDER object horen. */
    for (const v of Object.values(data || {})) {
      if (v && typeof v === 'object' && !Array.isArray(v)) pluk(v);
    }
  };

  const maakRoutes = routes.filter(r => MAAK.test(r.pad));
  let door = 0;
  for (const r of maakRoutes) {
    const lijf = Object.assign({}, lijfVoor ? lijfVoor(r) : {}, uitOogst(oogst, r.pad));
    let a = null;
    try { a = await post(r.pad, lijf, tokenVoor ? tokenVoor(r.rol) : '', koppenVoor ? koppenVoor(r) : null); }
    catch (e) { a = null; }
    if (!a || a.status < 200 || a.status >= 300 || !a.data) continue;
    door++;
    bewaar(r.pad, a.data);
  }
  return { oogst, geprobeerd: maakRoutes.length, gelukt: door,
    takken: Object.keys(oogst).length, voor: (pad) => uitOogst(oogst, pad) };
}

/* De diepste tak wint: een oogst uit /api/supplier/festival is specifieker dan
   een uit /api/supplier. */
function uitOogst(oogst, pad) {
  const uit = {};
  for (const d of DIEPTES) Object.assign(uit, oogst[tak(pad, d)] || {});
  return uit;
}

module.exports = { oogstObjecten, uitOogst, MAAK, IDVELD };
