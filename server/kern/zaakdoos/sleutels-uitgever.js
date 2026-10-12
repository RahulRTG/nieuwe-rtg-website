/* WIE GAF DEZE DOOSSLEUTEL UIT, EN WERKT HIJ HIER NOG? (N53, V1-audit ronde 9)

   Een manager van een zaak geeft een doossleutel uit op zijn PLEK:
   `uitgegeven_door` is dan 'zaak:CODE#staffId' (routes/supplier/doossleutels.js).
   Een sleutel van het kantoor of de eigenaar hangt niet aan een personeelsplek
   en valt hier buiten. Twee lagen, zoals bij de personeelsuitnodiging (N52):
   - trekInVanPlek: wie uit het team gaat, neemt geen doossleutel mee
     (routes/supplier/werving/personeel.js, vóór de plek uitgaat);
   - uitgeverWeg: een sleutel waarvan de uitgever geen actieve plek bij die zaak
     meer heeft, opent niets (welke() in ./sleutels.js). Dat vangt een uitgifte
     die tegelijk met de verwijdering liep, en houdt geen stand bij: de plek zelf
     is de waarheid, en wie roteert wordt de nieuwe uitgever. */
'use strict';

const PLEK = /^zaak:([A-Z0-9][A-Z0-9_-]{1,39})#(\d+)$/;

function doosUitgeverPlek(door) {
  const m = PLEK.exec(String(door || ''));
  return m ? { zaak: m[1], staffId: Number(m[2]) } : null;
}

// de plek EN het account erachter (N54): accounts.plekWerkt, het oordeel van de werksessie
function uitgeverWeg(rij, accounts) {
  const p = doosUitgeverPlek(rij && rij.uitgegeven_door);
  if (!p) return false;
  return !(p.zaak === rij.zaak && accounts.plekWerkt(p.staffId, p.zaak));
}

async function trekInVanPlek(register, zaak, staffId, door) {
  const z = String(zaak || '').toUpperCase();
  const wie = 'zaak:' + z + '#' + Number(staffId);
  let n = 0;
  for (const d of register.dozen(z)) {
    if (d.uitgegeven_door !== wie || !d.geldig) continue;
    const r = await register.trekIn({ doos: d.doos, zaak: z, door, reden: 'uitgever uit het team gehaald' });
    if (r && r.ingetrokken) n++;
  }
  return n;
}

module.exports = { doosUitgeverPlek, uitgeverWeg, trekInVanPlek };
