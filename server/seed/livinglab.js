/* Startdata voor het RTF Living Lab: één lab in Haarlem, zijn tekenbevoegden,
   wat apparatuur en een paar vragen uit de buurt.

   WAT HIER MET OPZET NIET IN ZIT: verzonnen onderzoeksresultaten. Geen studies
   met conclusies, geen bewijsgraden, geen "aangetoond dat". Dat is geen
   voorzichtigheid maar de kern van dit hele domein -- een lab dat opstart met
   nepbevindingen leert zijn gebruikers precies het omgekeerde van wat de
   bewijsmotor probeert af te dwingen. De eerste echte conclusie hoort door een
   mens verdiend te worden.

   WAT ER WEL IN ZIT, is de STEIGER: de dingen die een leeg lab onbruikbaar maken
   en die niemand uit zichzelf verwacht.

   - TEKENBEVOEGDEN. Zonder register kan er niets ondertekend worden en komt geen
     enkel onderzoek voorbij de deelnemersstap. Wie een leeg lab opent, loopt
     daar tegenaan zonder te weten waarom.
   - APPARATUUR, waaronder één sensor die NOOIT IS GEKALIBREERD. Die staat er
     bewust bij: hij weigert een reservering, met de reden erbij, en dat is de
     snelste manier om te laten zien dat dit systeem meetgereedschap serieus
     neemt.
   - VRAGEN UIT DE BUURT. De trechter vóór het onderzoek; zonder die lijst lijkt
     het alsof onderzoek hier bij de professionals begint.
   - ÉÉN STUDIE, bij de eerste stap (`vraagstuk`) en verder helemaal leeg. Hij
     laat de vorm zien en beweert niets.

   Net als de rest van de startdata verschijnt dit alleen in de DEMOSTAND; in
   productie start het lab schoon (zie ./index.js). */
'use strict';

// vaste id's: de seed mag geen Math.random of Date.now gebruiken, en met vaste
// id's blijft een herstart reproduceerbaar
const LAB = 'seedlabhaarlem';
const NU = '2026-01-06T09:00:00.000Z';

module.exports = {
  livingLab: {
    labs: [{
      id: LAB, stad: 'Haarlem', naam: 'RTF Living Lab Haarlem', land: 'Nederland', actief: true,
      soorten: [], bewaarMaanden: 36, toegang: 'open', taal: 'nl',
      tekenaars: [
        { naam: 'Dr. E. Vermeer', rol: 'professional', onafhankelijk: false, at: NU },
        { naam: 'Prof. dr. N. Aziz', rol: 'reviewer', onafhankelijk: true, at: NU },
        { naam: 'M. de Wit', rol: 'toezichthouder', onafhankelijk: false, at: NU }
      ],
      budget: { toegekend: 0, besteed: 0, bron: '' },
      partners: [{ naam: 'Gemeente Haarlem', soort: 'gemeente', contract: '', at: NU }],
      at: NU
    }],

    /* Eén studie, bij de eerste stap. Leeg dossier: geen hypothese, geen plan,
       geen deelnemers, geen conclusies -- alleen de vraag. */
    studies: [{
      id: 'seedstudiewater', labId: LAB,
      titel: 'Water op straat bij zware regen',
      soort: 'leefomgeving',
      vraagstuk: 'Kan de Kerkstraat tijdens zware regen beter omgaan met water? Bewoners melden ' +
        'dat het water op de hoek blijft staan, maar niemand weet hoe vaak en hoe lang.',
      doel: '', stap: 'vraagstuk',
      dossier: {
        hypothese: { tekst: '', tegendeel: '', at: null },
        plan: { methoden: [], steekproef: 0, meetmomenten: 0, doel: '', rapportage: '', at: null },
        deelnemers: [],
        ethiek: { klasse: 'laag', vastgesteld: false, privacytoets: null, review: [], stopcriteria: [],
          toestemming: { regime: 'geen', ouderlijk: false, tekst: '' }, klachten: [], stilgelegd: null },
        observaties: [], datasets: [], bronnen: [], conclusies: [], reflectie: [],
        besluit: null, uitgangen: [], taken: [], documenten: [], besluitenlog: [],
        logboek: [{ id: 'seedlog1', tekst: 'Onderzoek gestart bij het vraagstuk.', wie: 'RTF Haarlem', at: NU }],
        reserveringen: []
      },
      besluit: null, uit: null, geveegd: null, punten: 0, door: 'RTF Haarlem', at: NU
    }],

    themas: [
      { id: 'seedthema1', labId: LAB, vraag: 'Kan deze straat tijdens zware regen beter omgaan met water?',
        soort: 'leefomgeving', door: 'bewoner', stemmen: ['gast-seed-a', 'gast-seed-b', 'gast-seed-c'],
        studieId: 'seedstudiewater', at: NU },
      { id: 'seedthema2', labId: LAB, vraag: 'Vermindert een gezamenlijke buurttuin de eenzaamheid in onze straat?',
        soort: 'cohesie', door: 'bewoner', stemmen: ['gast-seed-a', 'gast-seed-d'], studieId: null, at: NU },
      { id: 'seedthema3', labId: LAB, vraag: 'Wordt de speeltuin veiliger als het verkeer er langzamer rijdt?',
        soort: 'mobiliteit', door: 'bewoner', stemmen: ['gast-seed-b'], studieId: null, at: NU }
    ],

    apparatuur: [
      { id: 'seedsensor', labId: LAB, naam: 'Regensensor RS-4', soort: 'sensor', plek: 'Werkplaats',
        actief: true, instructie: 'Buiten monteren op minstens 1,5 m hoogte; niet onder een overhang.',
        // NOOIT gekalibreerd, met opzet: hij weigert een reservering en zegt waarom
        kalibratie: { op: null, door: null, geldigMaanden: 6, stand: '' },
        onderhoud: [], bevoegd: [], uit: null, reserveringen: [], at: NU },
      { id: 'seedwerkbank', labId: LAB, naam: 'Werkbank 1', soort: 'werkbank', plek: 'Werkplaats',
        actief: true, instructie: 'Veiligheidsbril verplicht bij zagen en boren.',
        // geldigMaanden 0 = kalibratie niet van toepassing; dat is iets anders dan verlopen
        kalibratie: { op: null, door: null, geldigMaanden: 0, stand: '' },
        onderhoud: [], bevoegd: [], uit: null, reserveringen: [], at: NU },
      { id: 'seedlaptop', labId: LAB, naam: 'Veldlaptop', soort: 'laptop', plek: 'Kast bij de ingang',
        actief: true, instructie: '', kalibratie: { op: null, door: null, geldigMaanden: 0, stand: '' },
        onderhoud: [], bevoegd: [], uit: null, reserveringen: [], at: NU }
    ],

    audit: [{ id: 'seedaudit1', labId: LAB, wat: 'lab.maak', wie: 'RTF', over: LAB,
      detail: 'Haarlem / RTF Living Lab Haarlem (startdata)', at: NU }],
    paspoorten: []
  }
};
