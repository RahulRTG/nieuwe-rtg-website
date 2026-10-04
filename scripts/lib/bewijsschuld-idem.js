/* De CLASSIFICATIE van herhaalgedrag, niet het bewijs dat het werkt.
   Het oude register IDEMBESLUIT is opgevolgd door de expliciete contracten in
   server/lib/mutatiecontracten. Alleen het oude bestand lezen telde bestaande
   besluiten als ontbrekend. We lezen de bron, geen afgeleide PASS-teller.
   Fixtureblokkades, vermoedens en onbekende semantiek blijven open. */
'use strict';
const { keur } = require('../../server/kern/mutatiecontract');
const LEGACY = new Set(['code-maker', 'creatie', 'berekening', 'instelling', 'beschermd', 'teller']);
const BESLIST = new Set(['PROTECTED', 'NOT_APPLICABLE', 'INTENTIONALLY_NON_IDEMPOTENT']);

function idemClassificatie(rijen, besluiten, contracten) {
  if (!Array.isArray(rijen) || !besluiten || !contracten) return null;
  const uit = { legacy: 0, contract: 0, open: [] };
  for (const r of rijen) {
    if (/geen werk/.test(r.reden || '')) continue;
    const methode = String(r.methode || 'POST').toUpperCase();
    const route = methode + ' ' + r.pad;
    const c = contracten[route];
    if (c) {
      // Een actueel expliciet contract wint van een ouder besluit. Hetzelfde
      // pad met een ander HTTP-werkwoord is nooit hetzelfde contract.
      const fouten = keur({ ...c, route });
      if (!fouten.length && BESLIST.has(c.stand) && c.semantiek.klasse !== 'onbekend') {
        uit.contract++;
        continue;
      }
      uit.open.push({ route, reden: fouten.length ? fouten.join('; ') : 'contract laat semantiek of bewijsopstelling open' });
      continue;
    }
    const oud = methode === 'POST' && besluiten[r.pad];
    if (oud && LEGACY.has(oud.klasse)) uit.legacy++;
    else uit.open.push({ route, reden: 'geen expliciet geldig herhaalbesluit' });
  }
  return uit;
}

module.exports = { idemClassificatie };
