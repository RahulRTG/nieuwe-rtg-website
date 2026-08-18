/* Vervolg van cat-partners: op de 10 kB-grens geknipt, op een rij-grens.
   Zelfde vorm; register/index.js voegt beide samen. De `categorie` bepaalt waar
   een functie op het bord staat, niet het bestand -- deze rij hoort dus gewoon
   bij "Betalen & verificatie", naast de identiteitsverificatie. */
'use strict';
const { LEDEN } = require('./doelgroepen');

module.exports = [
  /* Het vakbewijs staat NAAST de verificatie en niet erin: dit is het stuk dat
     bij een BEROEP hoort (VOG, BIG-registratie, legitimatiebewijs beveiliger),
     niet bij een identiteit.

     WAT DEZE SCHAKELAAR WEL EN NIET DOET. Uit betekent: leden kunnen geen stuk
     meer INDIENEN. De poorten die op die stukken steunen (kern/persoonseis.js)
     blijven onverkort staan. Dat verschil is de hele zin van deze regel -- een
     schakelaar in de boardroom hoort nooit een kinderopvang open te kunnen
     zetten voor personeel zonder VOG. */
  { id: 'vakbewijs', categorie: 'Betalen & verificatie', naam: 'Vakbewijs indienen', standaard: true, doelgroepen: LEDEN,
    uitleg: 'Leden leggen de stukken vast die hun werk vraagt (VOG, BIG-registratie, legitimatiebewijs); ' +
      'RTG tekent af dat het stuk is gezien en beoordeelt de inhoud niet.',
    paden: ['/api/vakbewijs'] }
];
