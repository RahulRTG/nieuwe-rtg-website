/* Magnaat: DE ROLLEN -- wat iemand in een concern KAN ZIJN.

   Afgesplitst van ./dienst.js op de naad die dat bestand zelf beschrijft: daar
   de MACHINERIE (de lijsten in de staat, het salaris, de opzegging, het
   verlopen van een vacature) en hier de TABEL. De machinerie is af zodra ze
   klopt; deze tabel groeide in fase D met drie rollen erbij en groeit weer bij
   de volgende laag. Twee dingen met zo'n verschillend tempo horen niet in een
   bestand, en de 10 kB-grens in scripts/check.js is precies die rem. */
'use strict';
const rond = (n) => Math.round(n);

/* DE ROLLEN. Elke rol is een ANDER antwoord op "wat mag deze persoon hier", en
   meer dan drie zou betekenen dat het verschil tussen twee rollen niet meer te
   zien is aan wat iemand doet. Ze lopen op, en dat is de hele carriere van
   hoofdstuk 1 en 2: afwasser, keuken, bedrijfsleider.

   WAT EEN ROL GEEFT IS EEN LIJST ACTIES en geen bevoegdheidsniveau. Een getal
   dat "meer mag" betekent, is niet te lezen op een scherm en niet te toetsen;
   een lijst wel. Zie de scope-gedachte in kern/concern/scope.js -- daar woont de
   echte versie hiervan, en die is straks de plek waar dit naartoe groeit. */
const ROLLEN = {
  hulp: {
    naam: 'Hulpkracht', deel: 0.6,
    uitleg: 'Werkt mee in de zaak. Beslist niets.',
    mag: []
  },
  vakkracht: {
    naam: 'Vakkracht', deel: 1.0,
    uitleg: 'Draagt de kwaliteit van de zaak. Zet het onderhoud.',
    mag: ['onderhoud']
  },
  bedrijfsleider: {
    naam: 'Bedrijfsleider', deel: 1.8,
    uitleg: 'Runt de zaak. Zet onderhoud, bezetting, prijs en marketing.',
    mag: ['onderhoud', 'personeel', 'prijs', 'marketing']
  },
  /* DE DRIE BESTUURSROLLEN (fase D) staan in DEZELFDE tabel, en dat is een
     besluit. Een bestuurder is geen tweede soort dienstverband maar hetzelfde
     dienstverband op een andere hoogte: hij werkt voor het CONCERN in plaats van
     voor EEN zaak, en dat staat in de vlag `concern` en in `vestiging: null` op
     zijn dienst. Een tweede tabel zou betekenen dat "welke rollen bestaan er"
     twee antwoorden heeft, en dat de salarisregel, de opzegging en de loopbaan
     de rol van de een niet kennen.

     WAT ZE MOGEN staat hier NIET -- dat zijn actienamen en geen veldnamen, en
     de wand eromheen (wat geen enkele rol ooit mag) hoort bij elkaar. Zie
     ./bestuur.js; die leest deze tabel en vult `mag` aan. */
  coo: { naam: 'Operationeel directeur', concern: true, deel: 0.5,
    uitleg: 'Runt alle zaken: opent, breidt uit en zet het beleid. Gaat niet over het geld.' },
  cfo: { naam: 'Financieel directeur', concern: true, deel: 0.5,
    uitleg: 'Gaat over het geld: krediet, polissen en onderzoek. Bouwt niets.' },
  ceo: { naam: 'Algemeen directeur', concern: true, deel: 1,
    uitleg: 'Bestuurt het hele concern, plus de contracten. Verkoopt niets.' }
};
const ROLLIJST = Object.keys(ROLLEN);

/* WAT EEN ROL WAARD IS, als deel van het sectorloon. Het loon van een sector
   staat in ./sectoren.js en is wat EEN paar handen daar kost; een rol is een
   veelvoud daarvan. Zo staat het loon van een mens op dezelfde schaal als de
   loonpost die er al is, en hoeft er geen tweede loontabel te bestaan.

   DE BAND is er omdat onderhandelen een keuze hoort te zijn en geen cadeau.
   Buiten deze band is een bedrag geen loon maar een overdracht met een andere
   naam -- precies de reden dat ./handel.js een prijsband kent, en dat die er
   kwam nadat de geldpompkeuring 193 miljoen op een tafel van 62 vond. */
const LOONBAND = [0.5, 2.5];

const loonband = (sectorLoon, rol) => {
  /* EEN BESTUURSROL HEEFT GEEN SECTOR, dus hier een antwoord geven zou een getal
     verzinnen. Luid stoppen in plaats van stil iets teruggeven: `undefined` is
     de gevaarlijkste uitkomst, en dat is de wet van ../opzet/domeingrens.js. */
  if ((ROLLEN[rol] || {}).concern)
    throw new Error('magnaat/dienst: ' + rol + ' is een bestuursrol; vraag ./bestuur.js om de band.');
  const basis = sectorLoon * (ROLLEN[rol] || ROLLEN.hulp).deel;
  return { basis: rond(basis), min: rond(basis * LOONBAND[0]), max: rond(basis * LOONBAND[1]) };
};

/* Wat een baan bij deze zaak in deze rol standaard betaalt. Dit is het getal dat
   op het scherm staat voordat er onderhandeld wordt; zonder dat getal is een
   loon een gok en gaat iedereen laag inzetten. */
const loonVoor = (sectorLoon, rol) => loonband(sectorLoon, rol).basis;

const magRol = (rol, wat) => ((ROLLEN[rol] || {}).mag || []).includes(wat);

module.exports = { ROLLEN, ROLLIJST, LOONBAND, loonband, loonVoor, magRol };
