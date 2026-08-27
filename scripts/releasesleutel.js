#!/usr/bin/env node
/* ============================================================================
   DE RELEASESLEUTEL AANMAKEN -- eenmalig, door een mens.

   Dit script maakt GEEN sleutel aan die het ergens neerzet. Het schrijft de
   PUBLIEKE helft naar RELEASE.pub (die hoort in de repository, want wie een
   release controleert heeft hem nodig) en drukt de PRIVEsleutel af op het
   scherm, met de instructie waar hij heen moet.

   WAAROM HET DE PRIVESLEUTEL NIET WEGSCHRIJFT. Een script dat een privesleutel
   in de werkmap zet, zet hem vroeg of laat in een commit. Dit huis heeft die
   les al een keer betaald (server/data/ staat niet voor niets in .gitignore).
   Hij verschijnt dus een keer, en dan is het aan een mens.

   WAT DEZE SLEUTEL WEL EN NIET IS. Hij bewijst dat een verklaring van RTG komt.
   Hij bewijst niet dat GitHub iets heeft gebouwd. Lekt hij, dan kan iemand
   anders verklaringen namens RTG afgeven -- dan hoort er een nieuwe sleutel te
   komen en moet RELEASE.pub mee. Dat is de prijs van zelf ondertekenen, en die
   staat in SBOM.md.

   Draai:  node scripts/releasesleutel.js
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const WORTEL = path.join(__dirname, '..');
const PUB = path.join(WORTEL, 'RELEASE.pub');

if (fs.existsSync(PUB) && !process.argv.includes('--vervang')) {
  console.error('Er staat al een RELEASE.pub. Een nieuwe sleutel maakt elke eerdere handtekening');
  console.error('ONCONTROLEERBAAR. Weet u het zeker, draai dan met --vervang.');
  process.exit(1);
}

const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
fs.writeFileSync(PUB, publicKey.export({ type: 'spki', format: 'pem' }));

console.log('RELEASE.pub geschreven. Commit dat bestand: zonder hem kan niemand een release controleren.');
console.log('');
console.log('Zet de regels hieronder als GEHEIM in de pijplijn onder de naam RTG_RELEASE_SLEUTEL,');
console.log('en bewaar er een kopie van op een plek waar u hem terugvindt als de pijplijn omvalt.');
console.log('Schrijf hem NERGENS in deze map: dan staat hij morgen in een commit.');
console.log('');
console.log(privateKey.export({ type: 'pkcs8', format: 'pem' }).toString().trim());
