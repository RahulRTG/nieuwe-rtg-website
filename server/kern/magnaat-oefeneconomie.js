/* De economie van het Oefenkantoor -- een CONSUMENT van de economische motor.

   Tot ronde A1 woonde de motor hier (server/kern/magnaat-economie.js) en wist
   hij van RTG en het Praktijkbedrijf, van missies en van het economenlab. Nu is
   hij losgemaakt (./magnaat-economische-motor/) en zegt dit bestand alleen wat
   het Oefenkantoor ervan wil:

     het OEFENPROFIEL   twee bedrijven met hun startwaarden en kredietruimte, de
                   beginkas van de sectoren, en de woorden op het scherm
     de HAKEN      het economenlab leeft naast de economie (hypotheses,
                   voorspellingen, rapport) en haakt in op de dag en het overzicht
     de VERTALING  een voltooide missie wordt een economisch commando: wie
                   verrichtte welke activiteit met welke kwaliteit. Welke
                   spelvorm welke activiteit is, is Oefenkantoor-taal en staat
                   daarom hier en niet in de motor.

   De buitenkant is dezelfde als die van de oude module, zodat magnaatwereld.js,
   de toetsen en de meters niets merken van de verhuizing -- en precies dat
   bewijst test/magnaat-economische-motor.test.js tegen de gouden referentie. */
'use strict';
const { maak, geheugenJournaal, collectieJournaal } = require('./magnaat-economische-motor');
const economenlab = require('./magnaat-economenlab');

const WERELD = 'oefenkantoor';

const OEFENPROFIEL = {
  bedrijven: {
    rtg: {
      kredietLimiet: 500000000, kasBuffer: 25000000,
      start: {
        naam: 'RTG', personeel: 42, personeelDoel: 42, loonMaand: 385000,
        prijs: 12900, kwaliteit: 82, reputatie: 79, voorraad: 1200,
        bestelling: 620, basisProductiviteit: 15.5, vasteCapaciteit: 240,
        trainingDag: 450000, impactBp: 180, cash: 250000000
      }
    },
    praktijk: {
      kredietLimiet: 150000000, kasBuffer: 10000000,
      start: {
        naam: 'Praktijkbedrijf', personeel: 18, personeelDoel: 18, loonMaand: 342500,
        prijs: 10900, kwaliteit: 68, reputatie: 61, voorraad: 520,
        bestelling: 280, basisProductiviteit: 14, vasteCapaciteit: 80,
        trainingDag: 125000, impactBp: 80, cash: 65000000
      }
    }
  },
  openingskas: { huishoudens: 900000000, leverancier: 120000000, bank: 1200000000, overheid: 800000000, rtf: 50000000 },
  teksten: {
    omgeving: 'synthetische trainingswereld',
    werk: { titel: 'RTG-werk veranderde de uitvoering', bron: 'Magnaat-kantoorprocessen' }
  }
};

/* Het bedrijf waarover de speler besluit. */
const SPELERBEDRIJF = 'praktijk';

/* Spelvorm van een missie -> economische activiteit, met de uitleg die de
   speler ziet. Dit is Oefenkantoor-taal; de motor kent alleen de activiteit.

   De zes sleutels zijn dezelfde spelvormen als SCENARIOS in ./magnaatwereld.js,
   en SEMANTIEK.json telt dat als een waarheid op twee plekken. Die dubbeling
   bestond al: in de oude motor stond deze tabel naamloos in registreerWerk en
   zag de meter hem niet. Importeren kan niet -- magnaatwereld.js laadt dit
   bestand, dus dat zou een kring zijn. Een spelvorm die hier ontbreekt valt
   terug op productiviteit, en dat is zichtbaar in de uitleg. */
const KOPPELING = {
  planning: ['productiviteit', 'Ketenplanning verhoogt de leverbare capaciteit.'],
  controle: ['controle', 'Controlewerk verlaagt fouten en beschermt kwaliteit.'],
  gesprek: ['service', 'Goede service versterkt kwaliteit en reputatie.'],
  impact: ['impact', 'Impactwerk vergroot het maatschappelijke rendement.'],
  operatie: ['productiviteit', 'Operationeel werk verlaagt verspilling.'],
  puzzel: ['innovatie', 'Procesinnovatie verhoogt de toekomstige productiviteit.']
};

const rond = n => Math.round(Number(n) || 0);
const begrens = (n, min, max) => Math.min(max, Math.max(min, Number(n) || 0));

module.exports = ({ wereldState, save = () => {}, motorklant = null, db = null, opslag = null }) => {
  if (typeof wereldState !== 'function') throw new Error('Magnaat Economie vereist wereldState().');
  const motor = maak({
    wereld: WERELD, profiel: OEFENPROFIEL, wereldState, save, motorklant,
    opslag: opslag || (db ? collectieJournaal({ db }) : geheugenJournaal()),
    haken: {
      zorgStaat: (e) => economenlab._zorgStaat(e),
      naDag: (e) => economenlab.verwerkDag(e),
      verrijk: (e, uit, actor, { publiekeBedrijf }) => {
        uit.strategie = publiekeBedrijf(e.bedrijven[SPELERBEDRIJF]);
        uit.economenlab = economenlab.rapport(e, actor);
      }
    }
  });

  function analyse(actor, invoer) {
    const uitkomst = motor.transactie(actor, (e, hulp) => {
      const a = economenlab.dienAnalyse(e, actor, invoer);
      if (a && a.error) return a;
      hulp.audit('economenanalyse', a.analyse.id + ' · voorspelling voor dag ' + a.analyse.doelDag);
      return a;
    });
    if (uitkomst && uitkomst.error) return uitkomst;
    return Object.assign({ ok: true, ingediend: uitkomst.analyse }, motor.overzicht(actor));
  }

  /* Een voltooide missie -> een economisch commando. De kwaliteit volgt uit
     de punten tegen het maximum van de stappen; de motor bepaalt de gevolgen. */
  function registreerWerk(actor, taak) {
    const max = (taak.stappen || []).reduce((t, s) => t + (s.soort === 'software' ? 75 : 100), 0) || 100;
    const kwaliteit = rond(begrens((taak.punten || 0) / max, .2, 1) * 100);
    const soort = taak.spelvorm || 'operatie';
    const [activiteit, uitleg] = KOPPELING[soort] || ['productiviteit', 'Het werk verbetert de uitvoering.'];
    const uit = motor.verricht(actor, {
      activiteit, kwaliteit, omschrijving: String(taak.functieId),
      context: { taakId: taak.id, functieId: taak.functieId, soort }
    });
    if (uit.status) return uit;
    return { soort: activiteit, kwaliteit, uitleg: uitleg + ' Het effect wordt bij de volgende economische dag doorgerekend.' };
  }

  return {
    overzicht: motor.overzicht,
    beslis: (actor, invoer) => motor.beslis(actor, SPELERBEDRIJF, invoer),
    analyse,
    volgendeDag: motor.volgendeDag,
    volgendeDagAsync: motor.volgendeDagAsync,
    kiesSchok: motor.kiesSchok,
    registreerWerk,
    verifieerJournaal: motor.verifieerJournaal,
    saldiNa: motor.saldiNa,
    _state: motor._state,
    _boek: motor._boek,
    _gebeurtenissen: motor.gebeurtenissen
  };
};

module.exports.WERELD = WERELD;
module.exports.OEFENPROFIEL = OEFENPROFIEL;
