#!/usr/bin/env node
'use strict';
/* ============================================================================
   De bediening van het auditboek (server/kern/auditboek, AUDITBOEK.md).

     init                 schema aanmaken (idempotent) en de eerste regel
     anker                nu een ondertekend anker naar alle bestemmingen
     verifieer [--strikt] keten + verankering controleren; exit 1 bij elke
                          fatale of onbekende bevinding
     bewaar               verjaarde regels (730 dagen) achter een checkpoint
     dienst               herhaal anker + verifieer elke RTG_AUDIT_DIENST_MS
                          (standaard 15 min); de dienst is de ENIGE plek met de
                          private ankersleutel (RTG_AUDIT_ANKER_SIGN_KEY)

   Exitcodes: 0 in orde; 1 fout of niet in orde; 2 niet vast te stellen (een sink
   of de database was niet bereikbaar). "Niet vast te stellen" is nooit groen.
   Uitvoer is JSON zonder geheimen: alleen codes, tellers en nummers.
   ========================================================================== */
const boekMod = require('../server/kern/auditboek');

const wacht = ms => new Promise(r => setTimeout(r, ms));
const uit = o => console.log(JSON.stringify(o));

async function eenmaal(boek, cmd, vlaggen) {
  switch (cmd) {
    case 'init': {
      const id = await boek.klaar();
      const eerste = Number((await boek.verifieer({ strikt: false })).stats.regels) === 0;
      if (eerste) await boek.noteer({ type: 'auditboek.init', uitkomst: 'vastgelegd', actor: { soort: 'systeem', ref: 'auditboek-cli' }, context: { schema: 1 } });
      return { code: 0, uit: { actie: 'init', boekId: id, eersteRegel: eerste } };
    }
    case 'anker': { const r = await boek.anker({ force: vlaggen.has('--force') }); return { code: 0, uit: { actie: 'anker', ankerNr: r.ankerNr || null, overgeslagen: r.overgeslagen || null, gelukt: r.gelukt || 0 } }; }
    case 'verifieer': {
      const u = await boek.verifieer({ strikt: vlaggen.has('--strikt') });
      const code = u.ok ? 0 : (u.fataal ? 1 : 2);
      try { if (!vlaggen.has('--zonder-regel') && u.stats) await boek.noteer({ type: 'auditboek.verificatie', uitkomst: 'vastgelegd', actor: { soort: 'systeem', ref: 'auditboek-cli' },
        context: { uitslag: u.uitslag, fataal: u.fataal, waarschuwingen: u.waarschuwingen } }); } catch (e) { /* een kapot boek mag zijn eigen verificatie niet verbergen */ }
      return { code, uit: { actie: 'verifieer', uitslag: u.uitslag, fataal: u.fataal, onbekend: u.onbekend, waarschuwingen: u.waarschuwingen,
        bevindingen: u.bevindingen.map(b => ({ code: b.code, ernst: b.ernst })), stats: u.stats } };
    }
    case 'bewaar': { const r = await boek.snoei({}); return { code: 0, uit: { actie: 'bewaar', ...r } }; }
    default: throw Object.assign(new Error('onbekend commando: ' + cmd), { code: 'ARGUMENT' });
  }
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const vlaggen = new Set(rest);
  const boek = boekMod.maak();
  try {
    if (cmd === 'dienst') {
      const ms = Math.max(1000, Number(process.env.RTG_AUDIT_DIENST_MS) || 15 * 60 * 1000);
      for (;;) {
        for (const stap of ['anker', 'verifieer']) {
          try { const r = await eenmaal(boek, stap, new Set(['--strikt'])); uit({ tijd: new Date().toISOString(), ...r.uit, exit: r.code }); }
          catch (e) { uit({ tijd: new Date().toISOString(), actie: stap, fout: e.code || 'FOUT', exit: 1 }); }
        }
        await wacht(ms);
      }
    }
    const r = await eenmaal(boek, cmd, vlaggen);
    uit(r.uit);
    process.exitCode = r.code;
  } catch (e) {
    uit({ actie: cmd, fout: e.code || 'FOUT', bericht: String(e.message || e).slice(0, 200) });
    process.exitCode = 1;
  } finally { if (cmd !== 'dienst') await boek.sluit().catch(() => {}); }
}
main();
