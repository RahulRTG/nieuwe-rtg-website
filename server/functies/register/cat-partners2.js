/* Vervolg van cat-partners: op de 10 kB-grens geknipt, op een rij-grens.
   Zelfde vorm; register/index.js voegt beide samen. De `categorie` bepaalt waar
   een functie op het bord staat, niet het bestand -- deze rij hoort dus gewoon
   bij "Betalen & verificatie", naast de identiteitsverificatie. */
'use strict';
const { LEDEN } = require('./doelgroepen');

module.exports = [
  /* De tenantlaag: welke organisatie een werkruimte draait. Eigen schakelaar en
     niet die van het Werk OS zelf (cat-partners.js, id 'bedrijf'), want de
     gevolgen van uitzetten verschillen: daar werkt geen enkele werkruimte meer,
     hier werken ze door onder de RTG-huisstijl en zonder de brug vanaf de
     identiteitsprovider. Twee verschillende gevolgen achter een knop maakt die
     knop onbruikbaar op het moment dat je hem nodig hebt.

     Het BEHEER (/api/techniek/tenant) staat er bewust buiten: dat is de
     bestuurslaag, en die achter een schakelaar zetten is een deur met het slot
     aan de binnenkant (zie kern/bestuursroutes.js). */
  { id: 'tenant', categorie: 'RTG-Backoffice', naam: 'Tenant Control Plane (white-label)', standaard: true,
    doelgroepen: ['intern', 'business'],
    uitleg: 'Welke organisatie een werkruimte draait, welk merk zij daar voert, en hoe een groep van haar ' +
      'identiteitsprovider een rol wordt. Uit = de werkruimtes werken door onder de RTG-huisstijl, en een ' +
      'inlog via een provider levert geen rollen meer op.',
    paden: ['/api/tenant'] },

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
