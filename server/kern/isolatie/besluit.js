/* HET VERKLAARDE BESLUIT -- niet of het mag, maar waarom niet.

   WAAROM DIT GEEN BOOLEAN IS. kern/beschermstand.js geeft vandaag `null` of een
   reden terug, en dat was genoeg zolang er één stand was en één plek die hem
   las. Met zes dragers is dat niet meer genoeg: "u mag dit niet" is onbruikbaar
   voor de vier lezers die het antwoord nodig hebben. Het audit wil weten welke
   REGEL sloeg, het incidentonderzoek welke DRAGER hem droeg, het scherm wat de
   mens er nu aan kan doen, en de toets of het besluit klopt met wat er zou
   moeten gebeuren. Een boolean bedient geen van de vier, en dan schrijft elk van
   de vier zijn eigen afleiding -- vier plekken die op een dag iets anders zeggen
   over dezelfde weigering.

   DE IDENTITEITSKENNIS BLIJFT IN DE CONTEXT. Deze module krijgt standen mee,
   geen leden. Wie hier `lid` of een codenaam naar binnen brengt, heeft de
   drager-kennis de hele codebasis in gelekt; ./context.js is de enige plek waar
   hij wordt samengesteld.

   TWEE OORDELEN, EN MAAR EEN DAARVAN HANDHAAFT. Het besluit is dat van de
   BESCHERMSTAND -- gebouwd, beproefd, in gebruik. Daarnaast rekent het
   effectmodel (./effecten.js) mee in de SCHADUW, en waar de twee het oneens zijn
   staat dat in het antwoord als `onenigheid`. Dat is geen dubbele boekhouding
   maar de enige eerlijke weg naar handhaving: CONTROLPLANE.md zegt dat een
   nieuwe regel eerst zonder te blokkeren moet hebben gelopen, en dat kan alleen
   als hij ondertussen ergens zichtbaar meedraait. */
'use strict';

const ordening = require('./ordening');
const effecten = require('./effecten');
const leesset = require('./leesset');
const { NAMEN: DRAGERNAMEN } = require('./dragers');

/* WELKE DRAGER HET BESLUIT DROEG. Niet "de fijnste" en ook niet "iedereen met
   dezelfde trede": een drager droeg dit besluit als de stand ZONDER hem zwakker
   zou zijn geweest. Dat is de definitie, en hij is hier uitgerekend en niet
   benaderd.

   DE BENADERING DIE HIER EERST STOND, EN WAAROM HIJ SCHADELIJK WAS. Versie een
   noemde elke drager mee wiens trede gelijk was aan de samengevoegde trede.
   Voor `normaal` is dat altijd waar, dus een lid in de beschermstand kreeg te
   lezen: "er staat een beveiligingsstand aan op huis en identiteit" -- terwijl
   het huis gewoon draaide. Een mens die dat leest, gaat de verkeerde kant op
   zoeken, en bij een incident is dat het duurste wat een scherm kan doen. */
function dragersVanStand(standen, samen) {
  const aanwezig = DRAGERNAMEN.filter(n => standen[n] !== null && standen[n] !== undefined);
  const raak = [];
  for (const naam of aanwezig) {
    const zonder = ordening.strengste(aanwezig.filter(n => n !== naam).map(n => standen[n]));
    /* Zou het zonder deze drager zwakker zijn geweest, dan droeg hij mee. Twee
       dragers die allebei isolatie zeggen, dragen dus geen van beiden alleen --
       daarom is er een tweede ronde die dat opvangt. */
    if (ordening.vergelijk(zonder, samen) === 'zwakker') raak.push({ drager: naam, stand: standen[naam] });
  }
  if (raak.length) return raak;
  /* Niemand droeg hem ALLEEN: meer dragers zeggen hetzelfde. Dan dragen ze hem
     samen, en noemen we ze samen -- behalve de dragers die niets sluiten, want
     die noemen zou weer de fout van versie een zijn. */
  return aanwezig
    .filter(n => ordening.vergelijk(standen[n], 'normaal') === 'strenger')
    .map(n => ({ drager: n, stand: standen[n] }));
}

function maakBesluitlaag({ functies, beschermstand }) {

  /* De effectieve stand over alle dragers. Een join, geen keuze -- zie
     ./dragers.js voor waarom "de fijnste wint" hier een achterdeur is. */
  function effectieveStand(standen) {
    const s = standen || {};
    const aanwezig = DRAGERNAMEN.map(n => s[n]).filter(v => v !== null && v !== undefined);
    const samen = ordening.strengste(aanwezig);
    return Object.assign(samen, { dragers: dragersVanStand(s, samen) });
  }

  /* Het besluit zelf. */
  function besluit({ pad, methode, context }) {
    const standen = (context && context.standen) || {};
    const samen = effectieveStand(standen);
    const functie = functies.functieVoorPad(pad) || null;

    /* 1. HET HANDHAVENDE OORDEEL. De beschermstand kent maar een vraag: geldt de
          beschermde stand, en houdt hij dit pad tegen. Hij wordt alleen gesteld
          als die stand ook werkelijk geldt. */
    /* HET HANDHAVENDE OORDEEL, IN TWEE TRAPPEN.

       Trap 1 is de beschermstand: zes bevroren categorieën, gebouwd en in
       gebruik. Hij geldt zodra de eigenschap `beschermd` aanstaat, en isolatie
       draagt die eigenschap ook (./ordening.js) -- dus alles wat beschermd
       sluit, blijft onder isolatie dicht.

       Trap 2 geldt ALLEEN onder isolatie en is het verschil dat de naam belooft:
       niets mag, behalve wat zijn lezerschap heeft BEWEZEN. Waarom dat een
       gemeten verzameling is en geen methodecontrole staat in ./leesset.js -- in
       het kort: het lezen loopt hier grotendeels over POST, dus "alleen GET" zou
       een lid uitloggen in plaats van beschermen. */
    let tegen = null;
    if (samen.beschermd === true) tegen = beschermstand.houdtTegen(pad, methode);

    let leesbesluit = null;
    if (!tegen && samen.trede === 'isolatie' && !/^(GET|HEAD|OPTIONS)$/i.test(String(methode || ''))) {
      leesbesluit = leesset.magOnderIsolatie(pad, functie);
      if (!leesbesluit.mag) {
        tegen = { functie: functie ? functie.id : null, naam: functie ? functie.naam : null,
          categorie: leesbesluit.grond, waarom: leesbesluit.waarom, uitLeesset: true };
      }
    }

    /* 2. HET SCHADUWOORDEEL, dat vandaag niets doet behalve zichtbaar zijn. */
    const schaduw = effecten.schaduwOordeel({ pad, methode, functie, stand: samen });

    /* 3. DE ONENIGHEID. Drie soorten, en ze vragen om iets verschillends:
          `strenger` wil dat de beschermstand iets erbij neemt, `losser` wil dat
          het effectmodel wordt bijgesteld, en `onbekend` wil dat iemand het pad
          een effectprofiel geeft. Ze bij elkaar optellen tot een getal zou de
          enige bruikbare informatie weggooien. */
    let onenigheid = null;
    if (samen.beschermd === true || samen.trede === 'isolatie') {
      if (schaduw.oordeel === 'onbekend') {
        onenigheid = { soort: 'onbekend', waarom: 'dit pad heeft geen effectprofiel; ' +
          'de beschermstand ' + (tegen ? 'houdt het tegen' : 'laat het door') + ' op grond van zijn categorie' };
      } else if (schaduw.oordeel === 'tegenhouden' && !tegen) {
        onenigheid = { soort: 'strenger', waarom: 'het effectmodel zou dit tegenhouden (' +
          schaduw.geraakt.join(', ') + ') en de beschermstand laat het door' };
      } else if (schaduw.oordeel === 'doorlaten' && tegen) {
        onenigheid = { soort: 'losser', waarom: 'de beschermstand houdt dit tegen en het effectmodel ' +
          'ziet er geen gesloten effect in' };
      }
    }

    const uit = {
      toegestaan: !tegen,
      pad, methode: String(methode || 'POST').toUpperCase(),
      stand: { trede: samen.trede, beschermd: samen.beschermd, tredeOnbepaald: samen.tredeOnbepaald },
      /* WELKE DRAGERS DEZE STAND DROEGEN. Leeg betekent dat er geen enkele
         drager een stand had, en dat is iets anders dan "iedereen op normaal". */
      dragers: samen.dragers,
      functie: functie ? { id: functie.id, naam: functie.naam, categorie: functie.categorie } : null,
      schaduw,
      onenigheid
    };

    if (tegen) {
      uit.reden = tegen.uitLeesset ? 'ISOLATIE_LEESSET' : 'BESCHERMSTAND_CATEGORIE';
      uit.regel = tegen.categorie;
      uit.uitleg = tegen.waarom;
      uit.bewijs = tegen.uitLeesset
        ? ['kern/isolatie/leesset.js: ' + tegen.categorie,
           'IDEMPROEF.json: de gemeten kale oproep achter dit pad',
           'kern/isolatie/ordening.js: de effectieve stand over ' + samen.dragers.length + ' drager(s)']
        : ['kern/beschermstand-lijst.js: de categorie "' + tegen.categorie + '" is bevroren',
           'kern/isolatie/ordening.js: de effectieve stand over ' + samen.dragers.length + ' drager(s)'];
      return uit;
    }

    /* GEEN FUNCTIE ACHTER DIT PAD IS GEEN GOEDKEURING. De beschermstand laat
       zo'n pad met opzet door -- tegenhouden op grond van niets is raden -- maar
       het antwoord zegt dat, in plaats van te doen alsof er is nagedacht. */
    if (!functie) {
      uit.reden = 'GEEN_PROFIEL';
      uit.uitleg = 'er hangt geen functie uit de catalogus achter dit pad, dus er valt niets in te delen; ' +
        'het besluit is doorlaten omdat er niets is om op te weigeren, en niet omdat het veilig is';
      uit.bewijs = ['ISOLATIEPROEF.json: noemers.httpPaden.blindeVlek'];
      return uit;
    }

    uit.reden = samen.beschermd || samen.trede === 'isolatie' ? 'CATEGORIE_LOOPT_DOOR' : 'GEEN_STAND_ACTIEF';
    uit.uitleg = samen.trede === 'isolatie' && leesbesluit
      ? leesbesluit.waarom
      : (samen.beschermd
        ? 'de categorie "' + functie.categorie + '" loopt door in deze stand'
        : 'er staat geen drager in een stand die iets sluit');
    uit.bewijs = samen.trede === 'isolatie' && leesbesluit
      ? ['kern/isolatie/leesset.js: ' + leesbesluit.grond]
      : ['kern/beschermstand-lijst.js: LOOPT_DOOR'];
    return uit;
  }

  return { besluit, effectieveStand };
}

module.exports = { maakBesluitlaag, dragersVanStand };
