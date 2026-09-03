/* MAG DIT PAD, GEGEVEN WAT ER AAN DIT GESPREK HEEFT BIJGEDRAGEN?

   Afgesplitst uit ./isolatiefilter.js toen dat door de 10 KB van keuringsregel
   13 ging, en de naad is echt: dat bestand versmalt een LIJST op grond van een
   beveiligingsSTAND, dit velt een oordeel over EEN pad op grond van de HERKOMST
   van de invoer. Twee vragen die om verschillende redenen schuiven -- de eerste
   als er een drager bij komt, de tweede als er een kanaal of een effect bij komt.

   EEN WAARHEID, TWEE LEZERS, en dat is de reden dat dit een genoemde functie is
   en geen stuk lus. De kaart versmalt de lijst, maar de uitvoerpoort in
   ./lusstap.js moet bij `doe` HETZELFDE zeggen -- en het model heeft de bredere
   lijst dan al gezien, want de kaart komt bij stap n en `doe` bij stap n+3.
   Alleen de lijst versmallen sluit dus niets. Zou de poort dit oordeel nabouwen,
   dan lopen de twee binnen een jaar uiteen zonder dat iemand het merkt: ze
   'werken' allebei. */
'use strict';

const herkomst = require('../isolatie/herkomst');

module.exports = function maakHerkomstpoort({ isolatie, beleid, functieVoor, methodeVoor }) {

  /* Wat dit pad DOET komt uit het effectmodel; een pad zonder profiel valt onder
     `onbekend` en gaat dan DICHT, want bij onvertrouwde invoer is "we weten het
     niet" geen grond om door te laten. Dat is strenger dan de isolatiekant, en
     met reden: daar beschermt de stand een account, hier verdedigt hij tegen een
     tekst die actief probeert iets te laten gebeuren.

     LEZEN VERGROOT GEEN VERMOGEN, en dat is geen uitzondering op de regel maar
     de regel zelf gelezen. De invariant zegt dat onvertrouwde inhoud de
     beschikbare capabilities nooit VERGROOT; een pad waarvan gemeten is dat het
     werk doet zonder iets te veranderen, vergroot niets. Zonder deze regel viel
     /api/agenda/mijn dicht zodra Rahul een mail had gelezen -- en dan is de
     verdediging in de praktijk een uitknop voor de assistent, wat betekent dat
     iemand hem uitzet.

     MAAR DIE VRIJSTELLING IS AANGESCHERPT, en dat is een reparatie. `magOnderIsolatie`
     zegt ja op grond van een METING: een kale oproep gaf 2xx en bewoog geen
     collectie. Tien 'voorstel'-paden haalden die meting omdat de proef toevallig
     hun niets-te-doen-tak raakte -- waaronder /api/supplier/rtmail/btw-herinner,
     dat post verstuurt. Onder onvertrouwde invoer vervalt de vrijstelling daarom
     zodra het BELEID het pad een SCHRIJVER noemt (`voorstel` of `klein`): een
     oordeel dat een mens al velde, en geen tweede lijst.

     DE VOORWAARDE HANGT AAN "SCHRIJFT" EN NIET AAN "LEEST", en dat verschil is
     een reparatie op de reparatie. De eerste versie eiste `niveau === 'lezen'`,
     en daarmee viel ook `verboden` af -- terwijl `verboden` niets zegt over
     lezen maar over of de AI dit pad uberhaupt mag kiezen. Dat is een andere
     vraag, die eerder in de keten al is beantwoord, en hem hier nog eens stellen
     sluit paden om een reden die er niet staat.

     Onder isolatie blijft de meting leidend -- daar beschermt de stand een
     account en is een bewezen lezer geen risico. */
  const SCHRIJFNIVEAUS = ['voorstel', 'klein'];
  function magMetHerkomst(pad, wereld, bronnen) {
    const dicht = herkomst.sluitDoorHerkomst(bronnen || []);
    if (!dicht.length) return { mag: true, reden: 'geen onvertrouwde bron droeg bij' };
    const functie = functieVoor(pad);
    const leest = isolatie ? isolatie.leesset.magOnderIsolatie(pad, functie) : { mag: false };
    const beleidsniveau = (() => {
      if (!beleid || !wereld) return null;
      try { return beleid.beleidVoor(pad, wereld).niveau; } catch (e) { return null; }
    })();
    if (leest.mag && !SCHRIJFNIVEAUS.includes(beleidsniveau)) {
      return { mag: true, reden: 'bewezen lezer, en het beleid noemt hem geen schrijver' };
    }
    const prof = isolatie
      ? isolatie.effecten.effectenVan(pad, methodeVoor(pad, wereld), functie)
      : { effecten: null, graad: 'onbekend' };
    const oordeel = herkomst.oordeel({ effecten: prof.effecten, bronnen });
    if (oordeel.toegestaan === true) return { mag: true, reden: 'geen gesloten effect geraakt' };
    return { mag: false, reden: 'HERKOMST', uitleg: oordeel.waarom,
      weg: { pad, reden: 'HERKOMST', regel: oordeel.geraakt.join(', ') || 'geen effectprofiel',
        uitleg: oordeel.waarom, dragers: [] } };
  }

  return { magMetHerkomst, SCHRIJFNIVEAUS };
};
