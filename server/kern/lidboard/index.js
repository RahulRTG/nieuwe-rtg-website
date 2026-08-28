/* Kern-module "lidboard": de eigen boardroom van elk lid. Net als een zaak zijn
   eigen mini-boardroom heeft (kern/zaak.js), krijgt elk lid hier een
   professioneel schakelbord waarop het zijn eigen functies aan- en uitzet,
   netjes geordend in vier groepen: app-onderdelen, privacy & sociaal, AI &
   meldingen, en verbindingen (toestel).

   Eén generieke sleutel per boardroom: voor een RTG-lid is dat de sessiesleutel
   (req.session.key), voor een beschermd kind de RTF-handle. Zo kan een ouder/
   beheerder via dezelfde motor de boardroom van zijn minderjarige kind
   bijsturen (de route bewaakt dat het echt zijn kind is).

   Privacy by design: de gevoelige deel-functies (locatie, GPS, paspoort delen,
   Bluetooth) staan STANDAARD UIT; de rest staat aan zodat de app draait zoals
   altijd tot iemand bewust iets omzet. De stand staat in de collectie ledenBoard:
     { <sleutel>: { <functie-id>: true|false, _v: <versie>, _at: <iso> } }
   Wat er niet in staat volgt de standaard van de functie.

   Dit is de orkestrator. Hij bouwt de gedeelde context (opslag, standen,
   journaal) en mount de delen:
     ./catalogus   wat er op het bord staat, de pad-kaart, de platform-brug
     ./talen       de labels in de taal van de lezer (de server levert ze, dus
                   de pagina kan ze niet zelf vertalen)
     ./bord        de leeskant: het bord samenstellen, inclusief wie welke knop
                   vasthoudt -- RTG, je werkgever, of de basis van het toestel
     ./werkbeleid  wat een werkgever mag dichtzetten (en nooit openzetten)
     ./schakel     de schrijfkant: omzetten, in bulk, en terug naar standaard,
                   met versie-bescherming tussen twee toestellen
     ./journaal    het audit-spoor: wie zette wat om, wanneer, waarvandaan */

const { CAPS, OP_ID, standaardAan, padFunctie } = require('./catalogus');
const { maakJournaal } = require('./journaal');
const { maakWerkbeleid } = require('./werkbeleid');

function maakLidboard({ db, save }) {
  const journaal = maakJournaal({ db, save });
  const werk = maakWerkbeleid({ db, save });

  const eigenC = require('../eigencollectie')({ db, domein: 'kern/lidboard/index', bezit: { ledenBoard: 'kaart' } });
  function store() { return eigenC.bak('ledenBoard'); }
  function eigen(sleutel) { const s = store(); return (s[sleutel] && typeof s[sleutel] === 'object') ? s[sleutel] : {}; }
  function versie(sleutel) { const v = Number(eigen(sleutel)._v); return Number.isFinite(v) && v > 0 ? v : 0; }

  // Staat functie <id> aan voor deze boardroom? (voor handhaving elders)
  function aan(sleutel, id) {
    const c = OP_ID[id]; if (!c) return true;
    const eig = eigen(sleutel);
    return Object.prototype.hasOwnProperty.call(eig, id) ? eig[id] !== false : standaardAan(c);
  }

  /* Blokkeert deze functie de API voor dit lid? Twee redenen, en allebei tellen:

     1. het lid heeft hem BEWUST uitgezet (opgeslagen false). Een functie die
        enkel op zijn standaard-uit staat (bv. paspoort/locatie, met een eigen
        toestemmingsflow) blokkeren we hier niet;
     2. de werkgever heeft hem dichtgezet. Anders zou het beleid alleen een
        grijze knop in de app zijn en zou de API er gewoon omheen werken -- dan
        is het geen beleid maar een suggestie. */
  function bewustUit(sleutel, id) {
    const eig = eigen(sleutel);
    if (Object.prototype.hasOwnProperty.call(eig, id) && eig[id] === false) return true;
    return !!werk.werkbeleidDicht(sleutel, id);
  }

  const ctx = { db, save, store, eigen, versie, aan, standaardAan, journaal,
    werkbeleidDicht: werk.werkbeleidDicht };
  const lees = require('./bord')(ctx);
  Object.assign(ctx, lees);
  const schrijf = require('./schakel')(ctx);

  return {
    LIDBOARD_CAPS: CAPS,
    lidBoard: lees.bord,
    lidBoardZet: schrijf.zet,
    lidBoardZetVeel: schrijf.zetVeel,
    lidBoardHerstel: schrijf.herstel,
    lidBoardAan: aan,
    lidBoardVersie: versie,
    lidPadFunctie: padFunctie,
    lidBoardUit: bewustUit,
    lidBoardLog: journaal.lijst,
    lidBoardLogWis: journaal.wis,
    lidBoardLogKeten: journaal.keten,
    // het werkgeversbeleid (kan alleen dichtzetten, nooit openzetten)
    werkbeleid: werk.werkbeleid,
    werkbeleidZet: werk.werkbeleidZet,
    werkbeleidOverzicht: werk.werkbeleidOverzicht,
    werkbeleidPauzeStand: werk.werkbeleidPauzeStand,
    WERKBELEID_PAUZE_MINUTEN: werk.WERKBELEID_PAUZE_MINUTEN,
    werkgeversVan: werk.werkgeversVan
  };
}

module.exports = { maakLidboard };
