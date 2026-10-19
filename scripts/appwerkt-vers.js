#!/usr/bin/env node
/* ============================================================================
   APPWERKT:VERS -- welk bewijs in APPWERKT.json is sinds de meting vervallen,
   en door welk bestand?

   WAAROM DIT ER IS. Een bewijs moet opnieuw ongeldig worden zodra een relevante
   codewijziging de betrouwbaarheid ervan kan aantasten (de eis van de eigenaar,
   19 oktober 2026). APPWERKT.json is een meting van een moment; zonder dit
   commando blijft een 8/8 op het scherm staan terwijl de handler eronder al is
   herschreven. Dit leest het register, rekent per rij per bewijs het raakvlak
   van NU (scripts/lib/bewijsraakvlak.js) en legt het naast wat bij de meting is
   vastgelegd. Zonder browser en zonder server: een minuut, geen tien.

   STANDEN PER BEWIJS
     VERS        geen bestand in het raakvlak veranderde sinds de meetcommit
     VERVALLEN   wel; de eerste bestanden staan erbij
     ONGELDIG    de bewaarde hashes kloppen niet met de meetcommit: er is aan
                 het register gezeten. Telt als vervallen, nooit als vers.
     GROF        het raakvlak was niet vast te stellen; de grove regel van
                 versheid() besliste (vers of niet staat erbij)
   Een bewijs dat niets meette (GEEN_FIXTURE, of NIET_GETEST zonder bron) heeft
   niets om te laten vervallen en staat er niet in.

   DE POORT (--controle): zakt zodra een rij die als 8/8 geldt (status BEWEZEN)
   een bewijs heeft dat niet VERS is (of GROF en niet vers). Een 8/8 waarvan een
   bewijs vervallen is, is geen 8/8 meer; dat hoort de bouw te laten zakken en
   niet in een rapport te blijven staan.

   Gebruik: node scripts/appwerkt-vers.js [--controle] [--json] [--alle]
            --alle   ook de verse bewijzen tonen
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const R = require('./lib/bewijsraakvlak');
const { versheid } = require('./lib/stempel');

const WORTEL = path.join(__dirname, '..');
const BEWIJZEN = require('./lib/appcontract').BEWIJZEN;

/* Een bewijs zonder vastgelegd raakvlak (een register van voor deze regel):
   de grove regel op het stempel waarop het gemeten is. */
function grofStempel(register, b) {
  if (b.bewijs && typeof b.bewijs === 'object' && b.bewijs.commit) {
    return { op: b.bewijs.op || 'onbekend', commit: b.bewijs.commit, instrument: b.bewijs.instrument || null, boomVuil: false };
  }
  return register.stempel || null;
}

function beoordeel(register, opties = {}) {
  const w = opties.wereld || R.maakWereld({ wortel: opties.wortel });
  const grof = opties.grof || versheid;
  const gekoppeld = R.hashesVoor(register, opties.raakvlakRegister);
  const H = gekoppeld.hashes;
  const rijen = [];
  for (const r of register.regels || []) {
    const per = {};
    for (const naam of BEWIJZEN) {
      const b = r.bewijzen && r.bewijzen[naam];
      if (!b || b.status === 'GEEN_FIXTURE') continue;
      const recs = Array.isArray(b.raakvlak) ? b.raakvlak : null;
      if (!recs || !recs.length) {
        if (b.status === 'NIET_GETEST' && !b.bron) continue;   // niets gemeten, niets te laten vervallen
        const st = grofStempel(register, b);
        const v = st ? grof(st) : { vers: false, reden: 'geen stempel' };
        per[naam] = { stand: 'GROF', vers: !!v.vers, reden: 'geen raakvlak vastgelegd; de grove regel: ' + v.reden, oorzaak: [] };
        continue;
      }
      /* Alle helften moeten vers zijn; de zwakste beslist. */
      let uit = null;
      for (const rec of recs) {
        const c = R.controleer(w, rec, H, r.ingang, grof);
        if (!uit || (uit.vers && !c.vers) || (c.stand === 'ONGELDIG')) uit = c;
        if (c.stand === 'ONGELDIG') break;
      }
      per[naam] = uit;
    }
    rijen.push({ app: r.app, functie: r.functie, ingang: r.ingang, status: r.status, bewijzen: per });
  }
  const achtOpAcht = rijen.filter((r) => r.status === 'BEWEZEN');
  const gezakt = achtOpAcht.filter((r) => Object.values(r.bewijzen).some((b) => !b.vers));
  const telling = {};
  for (const r of rijen) for (const b of Object.values(r.bewijzen)) {
    const k = b.stand === 'GROF' ? (b.vers ? 'GROF_VERS' : 'GROF_OUD') : b.stand;
    telling[k] = (telling[k] || 0) + 1;
  }
  return { rijen, telling, achtOpAcht: achtOpAcht.length, gezakt, hashesReden: gekoppeld.reden };
}

if (require.main === module) {
  const arg = new Set(process.argv.slice(2));
  /* --register PAD (en --raakvlak PAD): een ander register beoordelen, voor de
     toets van de poort. Standaard het register in de wortel. */
  const waarde = (naam) => { const i = process.argv.indexOf(naam); return i > 0 ? process.argv[i + 1] : null; };
  const pad = waarde('--register') || path.join(WORTEL, 'APPWERKT.json');
  const rvPad = waarde('--raakvlak') || (waarde('--register') ? null : R.REGISTER_PAD);
  const reg = JSON.parse(fs.readFileSync(pad, 'utf8'));
  let rv = null;
  try { rv = rvPad ? JSON.parse(fs.readFileSync(rvPad, 'utf8')) : null; } catch (e) { rv = null; }
  const u = beoordeel(reg, { raakvlakRegister: rv });
  if (arg.has('--json')) {
    process.stdout.write(JSON.stringify({ telling: u.telling, achtOpAcht: u.achtOpAcht, gezakt: u.gezakt.map((r) => r.app), rijen: u.rijen }, null, 1) + '\n');
  } else {
    console.log('APPWERKT:VERS -- register gemeten op ' + (reg.stempel && reg.stempel.commit) + ' (' + (reg.stempel && reg.stempel.op) + ')');
    if (!reg.raakvlak) console.log('  het register draagt nog geen raakvlak; elk bewijs valt terug op de grove regel tot de volgende meting');
    else if (u.hashesReden) console.log('  LET OP: ' + u.hashesReden + '; elk bewijs met een raakvlak telt daardoor als ONGELDIG');
    for (const r of u.rijen) {
      const regels = Object.entries(r.bewijzen).filter(([, b]) => arg.has('--alle') || !b.vers);
      if (!regels.length) continue;
      console.log('\n' + r.app + '  (' + r.ingang + ', ' + r.status + ')');
      for (const [naam, b] of regels) {
        console.log('  ' + (b.vers ? '·' : '✗') + ' ' + naam.padEnd(17) + b.stand.padEnd(10) + b.reden);
        for (const o of (b.oorzaak || []).slice(1, 4)) console.log('      ook ' + o);
        if ((b.oorzaak || []).length > 4) console.log('      en nog ' + (b.oorzaak.length - 4));
      }
    }
    console.log('\nBewijzen: ' + JSON.stringify(u.telling) + '. Rijen die als 8/8 gelden: ' + u.achtOpAcht +
      ', waarvan met een bewijs dat niet vers is: ' + u.gezakt.length + '.');
  }
  if (arg.has('--controle') && u.gezakt.length) {
    for (const r of u.gezakt) {
      const [naam, b] = Object.entries(r.bewijzen).find(([, x]) => !x.vers);
      console.error('NIET OK: ' + r.app + ' geldt als 8/8, maar ' + naam + ' is ' + b.stand + ': ' + b.reden);
    }
    process.exit(1);
  }
}

module.exports = { beoordeel };
