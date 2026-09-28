/* Bedrijfsmaten, deel BEHOUD: retentie en churn.
   Vorm en regels staan in ./index.js; dit bestand is alleen gegevens. */
'use strict';
const c = (bestand, citaat) => ({ bestand, citaat });
const CTR = 'server/kern/commercie/contract.js';
const DEF = 'server/kern/bedrijfsmaat/definities.js', PRJ = 'server/kern/bedrijfsmaat/projecties.js';
const STAND = 'server/kern/bedrijfsmaat/stand.js';
const PAS = c('server/kern/pasgeschiedenis.js', 'function noteerPasOvergang');
const BEWIJS = [c(STAND, 'peilmoment, maand: m'), c(STAND, 'dektNiet')];

module.exports = [
  { id: 'retentie.aanwezig', domein: 'retentie', wereld: 'consument', eenheid: 'aandeel van een cohort',
    betekenis: 'Het aandeel van een cohort waarvan de laatste bezoekdag op of na dag 30 na nieuw lid ligt.',
    berekening: 'laatste bezoekdag uit kern/aanwezigheid.js tegen het moment van nieuw lid; alleen cohorten van wie dag 30 voorbij is',
    actualiteit: 'live', privacy: 'leden', minGroep: 10, eigenaar: 'kern/bedrijfsmaat', graad: 'gemeten', afhankelijk: ['cohort.aanmeldweek'],
    bron: [c('server/kern/aanwezigheid.js', 'function raakAanwezig'), PAS], definitie: [c(DEF, 'retentieAanwezig: d(1')],
    projectie: [c(PRJ, 'function retentieAanwezig')], bewijs: BEWIJS,
    groepsgrens: [c(STAND, 'retentieAanwezig: verhouding(LEDEN')], waarom: {} },

  { id: 'retentie.waarde', domein: 'retentie', wereld: 'consument', eenheid: 'aandeel van een cohort',
    betekenis: 'Het aandeel van een cohort met een geslaagde uitkomst tussen dag 30 en dag 60 na nieuw lid.',
    berekening: 'dezelfde uitkomstenlijst als activatie, in het venster 30-60; alleen cohorten van wie dag 60 voorbij is',
    actualiteit: 'live', privacy: 'leden', minGroep: 10, eigenaar: 'kern/bedrijfsmaat', graad: 'gemeten',
    afhankelijk: ['cohort.aanmeldweek', 'activatie.eerste-waarde'],
    bron: [PAS, c(STAND, 'function uitkomsten')], definitie: [c(DEF, 'retentieWaarde: d(1')],
    projectie: [c(PRJ, 'function retentieWaarde')], bewijs: BEWIJS,
    groepsgrens: [c(STAND, 'retentieWaarde: verhouding(LEDEN')], waarom: {} },

  { id: 'retentie.contract-verlengd', domein: 'retentie', wereld: 'consument', eenheid: 'contracten per periode',
    betekenis: 'Hoeveel contractuele lidmaatschappen bij hun verlengmoment werden verlengd.', berekening: 'nog niet vastgesteld',
    actualiteit: 'live', privacy: 'leden', minGroep: 10, eigenaar: null, graad: 'onbekend', afhankelijk: [],
    bron: [c(CTR, 'function verleng')], definitie: null, projectie: null, bewijs: null, groepsgrens: null,
    waarom: { definitie: 'Niet besloten; en de meeste betalende leden hebben een pas zonder contract (AFSPRAAK.md), dus deze maat ziet alleen de contractuele treden.',
      projectie: 'Niet gebouwd.', bewijs: 'Volgt uit de projectie.', groepsgrens: 'Volgt uit de projectie.', eigenaar: 'Niemand.' } },

  { id: 'churn.pas-naar-gast', domein: 'churn', wereld: 'consument', eenheid: 'aandeel betalende leden per maand',
    betekenis: 'Leden wier pas in een maand naar gast gaat, gedeeld door de betalende leden aan het begin van die maand.',
    berekening: 'overgangen naar gast in de pasgeschiedenis; noemer uit de pas van ieder op de laatste milliseconde van de vorige maand',
    actualiteit: 'live', privacy: 'leden', minGroep: 10, eigenaar: 'kern/bedrijfsmaat', graad: 'gemeten', afhankelijk: [],
    bron: [PAS], definitie: [c(DEF, 'churn: d(1')], projectie: [c(PRJ, 'function churnEnAfwaardering')], bewijs: BEWIJS,
    groepsgrens: [c(STAND, "verhouding(LEDEN, { teller: ce.churn")], waarom: {} },

  { id: 'churn.afwaardering', domein: 'churn', wereld: 'consument', eenheid: 'aandeel betalende leden per maand',
    betekenis: 'Leden die in een maand naar een lagere betaalde pas gaan; geen churn, en daarom apart.',
    berekening: 'overgangen tussen betaalde passen naar een lagere rang, zelfde noemer als churn',
    actualiteit: 'live', privacy: 'leden', minGroep: 10, eigenaar: 'kern/bedrijfsmaat', graad: 'gemeten', afhankelijk: [],
    bron: [PAS], definitie: [c(DEF, 'afwaardering: d(1')], projectie: [c(PRJ, 'function churnEnAfwaardering')], bewijs: BEWIJS,
    groepsgrens: [c(STAND, 'teller: ce.afwaardering')], waarom: {} },

  { id: 'churn.contract-geeindigd', domein: 'churn', wereld: 'consument', eenheid: 'contracten per maand',
    betekenis: 'Contractuele lidmaatschappen die GEEINDIGD bereiken; volgens de definitie van churn tellen ze mee.',
    berekening: 'nog niet vastgesteld', actualiteit: 'live', privacy: 'leden', minGroep: 10, eigenaar: null, graad: 'onbekend', afhankelijk: [],
    bron: [c(CTR, 'function beeindig')], definitie: [c(DEF, 'churn: d(1')], projectie: null, bewijs: null, groepsgrens: null,
    waarom: { projectie: 'De projectie telt alleen de pasgeschiedenis. Een contract hangt aan een aanmelding en niet aan een codenaam, dus de koppeling contract -> lid moet eerst gelegd worden.',
      bewijs: 'Volgt uit de projectie.', groepsgrens: 'Volgt uit de projectie.', eigenaar: 'Niemand.' } }
];
