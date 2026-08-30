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

   HET VELD HEET NAAR HET OBJECT, EN NIET `id`. Dat is de tweede meting, en hij
   verklaart waarom de eerste versie maar een op de tien haalde:

     /api/festival/bewijs     leest req.body.festival
     /api/concern/bulk/lees   leest req.body.entiteit
     /api/lab2/app/lijst      leest req.body.lab

   Het huis noemt zijn verwijzingen naar het DING, niet naar de vorm. Een
   geoogste `id` uit /api/festival/nieuw komt dus nooit aan bij
   /api/festival/bewijs, hoe goed de tak ook klopt.

   Daarom gaat elke geoogste waarde nu ook mee onder de naam van het PADSEGMENT
   waar hij vandaan komt -- `festival`, `entiteit`, `lab`. Gemeten: 1313 van de
   1450 geblokkeerde routes hebben een maakroute in hun tak, en dat is de vorm
   waarin die twee elkaar kunnen vinden.

   DE GRENS BLIJFT. Er wordt niets geraden over de BETEKENIS: als de route iets
   anders bedoelt met dat veld, komt er gewoon 404 terug. Dat is de eerlijke
   uitkomst, geen groen. En de naam uit het pad staat NAAST de oorspronkelijke,
   nooit eroverheen -- een route die wel `id` leest, blijft werken. */
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
          for (const d of DIEPTES) {
            const t = tak(pad, d);
            const bak = (oogst[t] = oogst[t] || {});
            bak[k] = w;
            /* En onder de naam van het object zelf. `/api/festival/nieuw` levert
               ook `festival`, `/api/concern/entiteit/nieuw` ook `entiteit`. Zie
               de kop: het huis noemt zijn verwijzingen naar het DING. */
            for (const naam of objectNamen(pad)) if (!bak[naam]) bak[naam] = w;

          }
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

/* De namen waaronder een route dit ding zou kunnen aanspreken: het tweede en
   derde padsegment. `/api/concern/entiteit/nieuw` geeft `concern` en
   `entiteit`; welke van de twee de route leest, hangt van de route af en het
   kost niets om ze allebei aan te bieden -- een route die geen van beide leest,
   negeert ze.

   Het WERKWOORD aan het eind gaat er niet in: `nieuw`, `maak` en `zet` zijn
   geen objecten. */
function objectNamen(pad) {
  const d = String(pad).split('/').filter(Boolean);   // api, <domein>, <sub>, <werkwoord>
  const uit = [];
  for (const i of [1, 2]) {
    const n = d[i];
    if (!n || MAAK.test('/' + n) || /^v\d+$/.test(n)) continue;
    if (n.length >= 3 && /^[a-z][a-z0-9-]*$/.test(n)) uit.push(n);
  }
  return uit;
}

/* De diepste tak wint: een oogst uit /api/supplier/festival is specifieker dan
   een uit /api/supplier. */
function uitOogst(oogst, pad) {
  const uit = {};
  for (const d of DIEPTES) Object.assign(uit, oogst[tak(pad, d)] || {});
  return uit;
}

module.exports = { oogstObjecten, uitOogst, MAAK, IDVELD };
