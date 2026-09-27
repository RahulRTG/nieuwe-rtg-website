#!/usr/bin/env node
/* SPRAAK NAAR TEKST, GEMETEN IN EEN ECHTE BROWSER. TOESTEL.md par. 11.

   Zelfde vorm als scripts/toestelproef.js, en om dezelfde reden een meetscript
   en geen toets: het model en de runtime staan met opzet niet in de repo. Zonder
   die bestanden zegt dit script hardop dat het NIET GEMETEN heeft (exitcode 2).

     RTG_ORT_DIR=<onnxruntime-web/dist>          de runtime
     RTG_WHISPER_DIR=<map met onnx/ en de json>  een Whisper-export in de vorm
                                                  van transformers.js (q8)
     RTG_SPRAAK_WAV=<16-bit PCM WAV>             de opname
     RTG_SPRAAK_VERWACHT="<tekst>"               wat erin gezegd wordt
     RTG_SPRAAK_TAAL=en                          (standaard en)
     node scripts/spraakproef.js

   Of een hele SET in plaats van een opname (par. 13):
     RTG_SPRAAK_SET=<set.json van scripts/spraakset.js>
   Dan telt de uitslag de woordfout per zin en over de hele set (alle fouten
   gedeeld door alle woorden, niet het gemiddelde van de zinnen), en zegt hij of
   de stem synthetisch was. Getallen worden NIET genormaliseerd: "tien" tegen
   "10" telt als fout, en dat staat erbij.

   De weg is die van een lid: artefacten naar OPFS, grendel (met een
   wegwerpsleutel), spectrogram in de pagina, rekenen in de afgesloten cel,
   tekst terug in de pagina. De uitslag noemt de woordfoutratio tegen de
   verwachte tekst -- op EEN opname is dat een rookproef, geen kwaliteitsmaat
   (daarvoor is een proefset nodig, par. 9.2), en het script zegt dat erbij. */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser } = require('../test/helper');
const { nieuweSleutel, teken, sha256 } = require('./lib/toestelteken');

const ORT = process.env.RTG_ORT_DIR, WH = process.env.RTG_WHISPER_DIR, WAV = process.env.RTG_SPRAAK_WAV;
function nietGemeten(reden) { console.log('NIET GEMETEN: ' + reden); process.exit(2); }
const BESTANDEN = {
  runtime: ORT && path.join(ORT, 'ort.wasm.bundle.min.mjs'), runtimeWasm: ORT && path.join(ORT, 'ort-wasm-simd-threaded.wasm'),
  encoder: WH && path.join(WH, 'onnx', 'encoder_model_quantized.onnx'), decoder: WH && path.join(WH, 'onnx', 'decoder_model_merged_quantized.onnx'),
  vocab: WH && path.join(WH, 'vocab.json'), speciaal: WH && path.join(WH, 'added_tokens.json'),
  config: WH && path.join(WH, 'config.json'), generatie: WH && path.join(WH, 'generation_config.json')
};
const mist = Object.entries(BESTANDEN).filter(([, p]) => !p || !fs.existsSync(p)).map(([r]) => r);
if (mist.length) nietGemeten('ontbreekt: ' + mist.join(', ') + ' (zet RTG_ORT_DIR en RTG_WHISPER_DIR).');
const SET = process.env.RTG_SPRAAK_SET ? JSON.parse(fs.readFileSync(process.env.RTG_SPRAAK_SET, 'utf8')) : null;
if (!SET && (!WAV || !fs.existsSync(WAV))) nietGemeten('zet RTG_SPRAAK_WAV op een 16-bit PCM WAV-opname, of RTG_SPRAAK_SET op een set.');
const OPNAMEN = SET ? SET.items.map((it) => ({ wav: it.wav, tekst: it.tekst }))
  : [{ wav: WAV, tekst: process.env.RTG_SPRAAK_VERWACHT || null }];
const pw = laadPlaywright();
if (geenBrowser(pw)) nietGemeten(geenBrowser(pw));

const woorden = (t) => String(t || '').toLowerCase().replace(/[^\p{L}\p{N}' ]+/gu, ' ').split(/\s+/).filter(Boolean);
function fouten(verwacht, gehoord) {
  const a = woorden(verwacht), b = woorden(gehoord);
  let vorig = b.map((_, j) => j + 1); vorig.unshift(0);
  for (let i = 1; i <= a.length; i++) {
    const rij = [i];
    for (let j = 1; j <= b.length; j++) rij[j] = Math.min(vorig[j] + 1, rij[j - 1] + 1, vorig[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    vorig = rij;
  }
  return { fouten: vorig[b.length], woorden: a.length };
}
function woordfout(verwacht, gehoord) { const f = fouten(verwacht, gehoord); return f.woorden ? f.fouten / f.woorden : null; }

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-spraakproef-'));
  const dir = path.join(tmp, 'toestel');
  fs.mkdirSync(path.join(dir, 'artefacten'), { recursive: true });
  const s = nieuweSleutel('spraakproef');
  const regels = {};
  for (const [rol, p] of Object.entries(BESTANDEN)) {
    const buf = fs.readFileSync(p), ortDeel = rol.startsWith('runtime');
    fs.writeFileSync(path.join(dir, 'artefacten', sha256(buf)), buf);
    regels[rol] = teken({ id: 'spraakproef-' + rol, versie: '1', soort: ortDeel ? 'uitvoerder' : 'model',
      sha256: sha256(buf), grootte: buf.length, licentie: 'MIT', // runtime en Whisper-gewichten allebei MIT
      bron: ortDeel ? 'ONNX Runtime Web (Microsoft)' : 'Whisper (OpenAI), ONNX-export via ' + WH,
      naamsvermelding: ortDeel ? 'ONNX Runtime Web (Microsoft)' : 'Whisper (OpenAI)', contracten: ['spraak.naartekst'] },
    { id: s.id, stand: 'actief' }, s.privateKey);
  }
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ versie: 1, artefacten: Object.values(regels) }));
  const srv = await startServer({ env: { RTG_DATA_DIR: tmp, RTG_TOESTEL_DIR: dir, SMTP_URL: '' } });
  const browser = await pw.chromium.launch(browserOpties(pw));
  try {
    const page = await browser.newPage();
    await page.goto(srv.base + '/site/404.html');
    for (const m of ['licenties', 'manifest', 'poorten', 'meting', 'opslag', 'rekenaar', 'spraak', 'spraakvoer'])
      await page.addScriptTag({ url: '/shared/toestel/' + m + '.js' });
    const uit = await page.evaluate(async ({ regels, sleutels, wavs, taal }) => {
      const O = window.RTGToestelOpslag, art = {};
      for (const rol of Object.keys(regels)) {
        const h = await O.haal(regels[rol], { doorLid: true, mobielBevestigd: true });
        if (!h.ok) return { ok: false, stap: 'opslag', reden: rol + ': ' + h.reden };
        art[rol] = { regel: regels[rol], bytes: h.bytes };
      }
      const feiten = await window.RTGToestelMeting.feiten();
      const c = { taak: 'spraak.naartekst', plaatsen: ['toestel'], technieken: ['model'],
        kwaliteit: { maat: 'woordfout', min: 0, graad: 'vermoed' }, last: { rekenMaxMs: 120000 } };
      const keus = window.RTGToestelPoorten.kies(c, [{ id: 'whisper-wasm', plaats: 'toestel', techniek: 'model',
        uitvoerder: 'whisper', beschikbaar: feiten.wasm, kwaliteit: { woordfout: { waarde: 0, graad: 'vermoed' } }, kosten: 0 }],
      { beleid: { 'spraak.naartekst': true } });
      if (!keus.gekozen) return { ok: false, stap: 'poorten', reden: keus.reden };
      const S = window.RTGToestelSpraak, rs = [];
      for (const wav of wavs) {
        const geluid = S.wav(Uint8Array.from(atob(wav), (x) => x.charCodeAt(0)));
        const t0 = performance.now();
        const r = await window.RTGToestelSpraakVoer.naarTekst({ contract: c, kandidaat: keus.gekozen, artefacten: art,
          sleutels, monsters: geluid.monsters, hz: geluid.hz, taal });
        if (!r.ok) return r;
        rs.push({ tekst: r.tekst, herhaling: r.herhaling, rekenMs: r.herkomst.rekenMs, totaalMs: Math.round(performance.now() - t0),
          seconden: geluid.monsters.length / geluid.hz, herkomst: r.herkomst });
      }
      return { ok: true, rs, feiten: { webgpu: feiten.webgpu, wasmSimd: feiten.wasmSimd, geheugenGb: feiten.geheugenGb } };
    }, { regels, sleutels: [{ id: s.id, publiek: s.publiek, stand: 'actief' }],
      wavs: OPNAMEN.map((o) => fs.readFileSync(o.wav).toString('base64')),
      taal: (SET && SET.taal) || process.env.RTG_SPRAAK_TAAL || 'en' });
    if (!uit.ok) {
      console.log(JSON.stringify({ gemeten: new Date().toISOString(), ok: false, stap: uit.stap || null, reden: uit.reden || null }, null, 2));
      process.exitCode = 1; return;
    }
    const per = uit.rs.map((r, i) => Object.assign({ verwacht: OPNAMEN[i].tekst, tekst: r.tekst,
      woordfout: OPNAMEN[i].tekst ? +woordfout(OPNAMEN[i].tekst, r.tekst).toFixed(3) : null,
      opnameSeconden: +r.seconden.toFixed(2), rekenMs: r.rekenMs, herhaling: !!r.herhaling }));
    const som = OPNAMEN.reduce((t, o, i) => { if (!o.tekst) return t; const f = fouten(o.tekst, uit.rs[i].tekst);
      return { fouten: t.fouten + f.fouten, woorden: t.woorden + f.woorden }; }, { fouten: 0, woorden: 0 });
    const wer = som.woorden ? som.fouten / som.woorden : null;
    const h = uit.rs[0].herkomst;
    console.log(JSON.stringify({ gemeten: new Date().toISOString(), ok: true,
      taal: (SET && SET.taal) || process.env.RTG_SPRAAK_TAAL || 'en', opnamen: per.length,
      stem: SET ? SET.stem + (SET.synthetisch ? ' (synthetisch)' : '') : 'opname',
      woordfoutSet: wer === null ? null : +wer.toFixed(3), fouten: som.fouten, woorden: som.woorden,
      opnameSeconden: +uit.rs.reduce((t, r) => t + r.seconden, 0).toFixed(1),
      rekenMs: uit.rs.reduce((t, r) => t + r.rekenMs, 0), lussen: per.filter((p) => p.herhaling).length, per, feiten: uit.feiten,
      herkomst: { plaats: h.plaats, uitvoerder: h.uitvoerder, artefacten: h.artefacten.map((a) => a.rol + '=' + a.sha256.slice(0, 12)) },
      voorbehoud: SET && SET.synthetisch ? 'een synthetische stem is geen mens: dit meet model en keten, niet hoe goed een lid wordt verstaan; getallen zijn niet genormaliseerd'
        : 'een opname is een rookproef en geen kwaliteitsmaat; de woordfout geldt alleen voor deze opname' }, null, 2));
    /* Een set is een METING en geen poort: de uitslag is het getal. Een losse
       opname is een rookproef, en die zakt boven 20% woordfout. */
    process.exitCode = SET ? 0 : (wer === null || wer <= 0.2 ? 0 : 1);
  } finally {
    await browser.close(); await stop(srv); fs.rmSync(tmp, { recursive: true, force: true });
  }
})().catch((e) => { console.error(e); process.exit(1); });
