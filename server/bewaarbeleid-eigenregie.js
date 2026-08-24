/* HET BEWAARBELEID, deel twee: de takken met EIGEN REGIE.

   Apart van ./bewaarbeleid.js om twee redenen, en de tweede is de echte. De
   eerste is de bekende: dat bestand ging met deze twee regels erbij over de
   10 kB van keuringsregel 13.

   De tweede is dat dit een ANDER SOORT regel is. De rest van het beleid zegt
   "deze tak verloopt na zoveel dagen, en de veger ruimt hem op". Deze twee
   zeggen "deze tak heeft een termijn, maar de klok loopt ergens anders en de
   veger blijft eraf". Ze tussen de gewone regels zetten nodigt uit om ze te
   lezen als een gewone termijn -- en dat is precies de vergissing die hier
   voorkomen moet worden.

   WAAROM ZE NIET DOOR DE VEGER MOGEN. De klok van een werkruimte begint bij de
   OPZEGGING en niet bij het aanmaken. Een gewone regel `dagen: 90` op het veld
   `at` laat de veger elke klant wissen die langer dan negentig dagen bestaat --
   de soort stille ramp waar dit hele beleid tegen bestaat. Er hoort bovendien
   een bewaringsplicht overheen te kunnen (een lopende zaak) en een
   vernietigingsbewijs achteraf. Dat is een levensloop en geen termijn.

   `vorm: 'eigenRegie'` betekent voor de motor (./bewaartermijnen.js): tel hem in
   het rapport, houd hem uit de gatenlijst, en kom er met veeg() niet langs. Het
   veld `regie` wijst aan waar de klok dan wel woont.

   De grond 'contract' is voor deze twee ingevoerd: wij bewaren dit niet omdat de
   wet het eist en niet omdat wij het nodig hebben, maar omdat de
   klantovereenkomst een uitlooptijd geeft waarin de klant zijn uitvoer nog kan
   ophalen. Zie TENANT.md. */
'use strict';

const EIGEN_REGIE = [
  { tak: 'werkruimtes', label: 'werkruimtes van klanten (Werk OS)', dagen: 90, grond: 'contract',
    vorm: 'eigenRegie', datum: 'at', regie: 'server/kern/tenant/levensloop.js',
    waarom: 'de termijn loopt vanaf de opzegging, kan onder een bewaringsplicht stilstaan, en eindigt met een vernietigingsbewijs' },
  { tak: 'tenants', label: 'tenants (contract, merk en groepsafbeelding)', dagen: 90, grond: 'contract',
    vorm: 'eigenRegie', datum: 'bij', regie: 'server/kern/tenant/levensloop.js',
    waarom: 'de tenant blijft na vernietiging bestaan met alleen zijn bewijs erin; dat bewijs hoort juist niet weg te vallen' }
];

module.exports = { EIGEN_REGIE };
