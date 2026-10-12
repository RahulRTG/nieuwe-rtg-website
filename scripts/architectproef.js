#!/usr/bin/env node
/* ============================================================================
   DE ARCHITECTPROEF -- twintig echte vragen aan de Architect
   (ARCHITECTOPDRACHT.md fase 5)

   De vragen staan in test/fixtures/architectproef.json: tien over RTG Pay en
   tien over de tafelketen. Per vraag zegt dit script welke van drie uitslagen
   de Architect gaf:

     beantwoord   een waarde met herkomst, en die herkomst leidt in het
                  register naar dezelfde waarde (of is als samengesteld
                  verklaard, met reden)
     onbekend     geen waarde, wel de reden waarom niet
     mislukt      de Architect kent het veld niet; de vraag draagt een
                  sluitweg als bevinding

   En een vierde die niet mag voorkomen: `zonderHerkomst`, een waarde die niet
   terug te volgen is. Daar draait de stop/go om: een go betekent niet dat alles
   beantwoord is, maar dat geen enkel antwoord zonder herkomst kwam.

   Dit script schrijft nergens heen (R1); het print de verdeling.
   Draai:  node scripts/architectproef.js [--json]
   ========================================================================== */
'use strict';
const path = require('path');
const { isDeepStrictEqual } = require('util');
const A = require('./lib/codearchitect');

const VRAGEN = path.join(__dirname, '..', 'test', 'fixtures', 'architectproef.json');

/* De regels die de Architect op een vraag teruggeeft. `architect` is een
   parameter zodat de toets een kapotte Architect kan inprikken (de mutatie). */
function regelsVoor(lezer, vraag, architect) {
  const a = architect || A;
  if (vraag.opdracht === 'impact') {
    const i = a.impact(lezer, vraag.onderwerp);
    return { gevonden: true, regels: i[vraag.blok] || [] };
  }
  const u = a.uitleg(lezer, vraag.onderwerp);
  return { gevonden: u.gevonden, regels: u.regels || [], reden: u.reden };
}

function uitslag(lezer, vraag, architect) {
  const r = regelsVoor(lezer, vraag, architect);
  if (!r.gevonden) return { uitslag: 'mislukt', reden: 'de Architect vond het onderwerp niet: ' + r.reden };
  if (vraag.veld == null) return { uitslag: 'mislukt', reden: 'de Architect heeft geen veld dat deze vraag beantwoordt' };
  const regel = r.regels.find((x) => x.veld === vraag.veld);
  if (!regel) return { uitslag: 'mislukt', reden: 'het veld "' + vraag.veld + '" kwam niet terug' };
  const assen = { graad: regel.graad, versheid: regel.versheid, tegenspraak: regel.tegenspraak };
  const h = regel.herkomst;
  if (regel.waarde === null) {
    return regel.reden && h && h.register
      ? { uitslag: 'onbekend', reden: regel.reden, ...assen, herkomst: h }
      : { uitslag: 'zonderHerkomst', reden: 'leeg zonder reden of zonder register', regel };
  }
  if (!h || !h.register) return { uitslag: 'zonderHerkomst', reden: 'geen register', regel };
  if (h.navolgbaar === false) {
    return h.reden
      ? { uitslag: 'beantwoord', samengesteld: true, waarde: regel.waarde, ...assen, herkomst: h }
      : { uitslag: 'zonderHerkomst', reden: 'samengesteld zonder reden', regel };
  }
  const l = lezer.laad(h.register);
  const terug = l.data === undefined ? undefined : A.volg(l.data, h.pad, h.kies);
  if (!isDeepStrictEqual(terug, regel.waarde)) {
    return { uitslag: 'zonderHerkomst', reden: 'de herkomst ' + h.register + ' ' + h.pad + ' leidt naar een andere waarde', regel };
  }
  return { uitslag: 'beantwoord', waarde: regel.waarde, ...assen, herkomst: h };
}

function proef(opties) {
  const o = opties || {};
  const lezer = o.lezer || A.maakLezer();
  const vragen = o.vragen || require(VRAGEN).vragen;
  const per = vragen.map((v) => ({ id: v.id, domein: v.domein, vraag: v.vraag, verwacht: v.verwacht, ...(v.sluitweg ? { sluitweg: v.sluitweg } : {}), ...uitslag(lezer, v, o.architect) }));
  const verdeling = { beantwoord: 0, onbekend: 0, mislukt: 0, zonderHerkomst: 0 };
  for (const p of per) verdeling[p.uitslag]++;
  return { verdeling, per };
}

function main() {
  const p = proef();
  if (process.argv.includes('--json')) { console.log(JSON.stringify(p, null, 1)); return p.verdeling.zonderHerkomst ? 1 : 0; }
  console.log('\nARCHITECTPROEF  (ARCHITECTOPDRACHT.md fase 5)\n');
  const kort = (w) => (Array.isArray(w) ? w.length + ' stuk(s)' : JSON.stringify(w)).slice(0, 48);
  for (const x of p.per) {
    const assen = x.graad ? ' [' + x.graad + ' · ' + x.versheid + ' · ' + x.tegenspraak + ']' : '';
    const wat = x.uitslag === 'beantwoord' ? kort(x.waarde) + (x.samengesteld ? ' (samengesteld)' : '') : x.reden;
    console.log('  ' + x.id.padEnd(9) + ' ' + x.uitslag.padEnd(14) + assen);
    console.log('  ' + ''.padEnd(9) + ' ' + x.vraag + ' -- ' + String(wat).slice(0, 110));
  }
  const v = p.verdeling;
  console.log('\n  beantwoord ' + v.beantwoord + ', onbekend ' + v.onbekend + ', mislukt ' + v.mislukt + ', zonder herkomst ' + v.zonderHerkomst);
  console.log('  Een go vraagt geen volle score maar nul antwoorden zonder herkomst.\n');
  return v.zonderHerkomst ? 1 : 0;
}

if (require.main === module) process.exitCode = main();
module.exports = { proef, uitslag, VRAGEN };
