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
   2b. EN EEN TWEEDE KANS OOK NIET. MAAK kijkt naar de STAART van het pad, en
      dat mist een hele klasse: een route die naar zijn OBJECT heet in plaats
      van naar zijn werkwoord. /api/festival/editie maakt een editie, en 54
      routes stranden op "Deze editie bestaat niet" omdat die deur nooit
      openging; zo ook /api/lab2/onderzoek (38) en /api/site (18). De
      voordehandliggende reparatie -- in elke LEGE tak elke overgebleven route
      een keer proberen en houden wat een verwijzing teruggeeft -- is gebouwd
      en gemeten, en hij deugt niet:

        1232 extra oproepen, 13 takken gevuld
        beoordeeld 1817 -> 1816 (dus niets)
        en 14 bank- en pay-routes gingen van `ongemeten` naar `onbeschermd`,
        omdat die extra oproepen toestand maakten die de herhaling verstoorde

      Dat laatste is het echte bezwaar: de oogst mag de meting niet vervuilen.
      Wie deze klasse alsnog wil vangen, doet dat met een GEMETEN koppeling
      tussen veld en route (welke route levert `editie`), niet met een sleepnet.

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
/* WELK VELD IS EEN VERWIJZING NAAR EEN DING. De eerste versie kende alleen de
   kale namen. De oogst meldt sinds kort waarom een maakroute niets opleverde,
   en toen bleek /api/bedrijf/lid/aanmeld keurig een `lidId` terug te geven --
   een verwijzing die niemand zag. Vandaar de voorvoegselvorm: `lidId`,
   `partnerCode`, `zaakRef`. Dat is een verwijzing DOOR ZIJN BOUW en geen
   gok op een woordenlijst.

   `token` staat er met opzet NIET bij. Een token is geen verwijzing naar een
   ding maar een sleutel tot een sessie, en die als object-id rondsturen zou
   de oogst vergiftigen met dingen die nergens naar wijzen. */
const IDVELD = /^(id|code|iban|sleutel|nummer|ref|handle|slug|[a-z]+(Id|Code|Ref))$/;
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
  /* WAAROM EEN MAAKROUTE NIETS OPLEVERDE. Deze lus meldde alleen "126 van de
     448" en zweeg over de 322. Dat getal is niet te bewerken: het kan een
     ontbrekende fixture zijn, een verkeerde rol, of een geslaagde route die
     geen id teruggaf -- drie verschillende reparaties. LAT.md regel 3: een
     meter die zijn eigen blinde vlek niet noemt, ziet er hetzelfde uit als
     een meter die niets te melden heeft. */
  const mislukt = [];
  for (const r of maakRoutes) {
    const lijf = Object.assign({}, lijfVoor ? lijfVoor(r) : {}, uitOogst(oogst, r.pad));
    let a = null;
    try { a = await post(r.pad, lijf, tokenVoor ? tokenVoor(r.rol) : '', koppenVoor ? koppenVoor(r) : null); }
    catch (e) { a = null; }
    if (!a || a.status < 200 || a.status >= 300 || !a.data) {
      mislukt.push({ pad: r.pad, rol: r.rol, status: a ? a.status : 0,
        waarom: (a && a.data && (a.data.error || a.data.melding)) || 'geen antwoord' });
      continue;
    }
    const voor = Object.keys(oogst).length;
    door++;
    bewaar(r.pad, a.data);
    /* Geslaagd EN toch niets geoogst is een eigen geval: de route deed haar
       werk maar gaf geen herkenbaar id terug. Dat vraagt geen fixture maar een
       veldnaam erbij, en het hoort dus niet op een hoop met de weigeringen. */
    if (Object.keys(oogst).length === voor && !uitOogst(oogst, r.pad).id) {
      /* De velden die er WEL in zaten, zodat de reparatie een veldnaam is en
         geen gok. Een niveau diep, net als pluk(). */
      const velden = new Set(Object.keys(a.data || {}));
      for (const v of Object.values(a.data || {})) {
        if (v && typeof v === 'object' && !Array.isArray(v)) for (const k of Object.keys(v)) velden.add(k);
      }
      /* Twee heel verschillende gevallen, en ze op een hoop gooien maakt de
         werkvoorraad onbruikbaar. Een route die een INSTELLING zet (/api/ik/zet,
         /api/klets/zet) maakt geen ding en hoort hier nooit iets op te leveren
         -- die staat alleen in de lijst omdat MAAK ook op `zet` matcht. Een
         route die wel iets maakt maar geen herkenbaar veld teruggaf, is echt
         werk: daar mist een veldnaam. Het verschil is te zien aan of het
         antwoord de invoer terugspiegelt of een nieuw ding aankondigt. */
      const maaktIets = /\/(maak|nieuw|aanmaak|start|open|aanmeld|inschrijf|registreer|voeg|boek)$/.test(r.pad);
      mislukt.push({ pad: r.pad, rol: r.rol, status: a.status, velden: [...velden].slice(0, 20),
        waarom: maaktIets
          ? 'geslaagd, maar geen herkenbaar id in het antwoord'
          : 'geslaagd; deze route zet een INSTELLING en maakt geen ding' });
    }
  }
  /* De redenen samengevat, grootste eerst -- dat is de werkvoorraad. */
  const perReden = {};
  for (const m of mislukt) {
    const k = m.status + ' ' + String(m.waarom).slice(0, 60);
    (perReden[k] = perReden[k] || []).push(m.pad);
  }
  const redenen = Object.entries(perReden)
    .map(([reden, paden]) => ({ reden, aantal: paden.length, voorbeeld: paden[0] }))
    .sort((a, b) => b.aantal - a.aantal);
  return { oogst, geprobeerd: maakRoutes.length, gelukt: door, mislukt, redenen,
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
