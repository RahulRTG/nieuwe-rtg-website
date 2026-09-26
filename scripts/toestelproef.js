#!/usr/bin/env node
/* DE TWEEDE UITVOERDER: echte ONNX Runtime Web in de afgesloten toestelcel.
   TOESTEL.md par. 10.

   Waarom een meetscript en geen toets: de runtime staat met opzet NIET in de
   repo (nul afhankelijkheden; hij is een ondertekend artefact zoals een model),
   dus in de gewone CI is hij er niet. Een toets die zichzelf dan overslaat,
   keurt de deltapoort terecht af. Dit script zegt daarom hardop dat het niet
   gemeten heeft als de runtime ontbreekt (exitcode 2), en nooit "in orde".

     RTG_ORT_DIR=<map met onnxruntime-web/dist> node scripts/toestelproef.js

   Wat het doet: een wegwerpsleutel, drie ondertekende artefacten (runtime-JS,
   runtime-wasm, het proefmodel van scripts/lib/onnxproef.js), een echte server
   en een echte Chromium, en dan precies dezelfde weg als test/toestel.e2e.js:
   OPFS, poorten, grendel, cel, herkomst. De rekenaar en de cel zijn niet
   aangepast voor ONNX -- dat is het punt: een nieuwe techniek is een nieuwe
   uitvoerder, geen nieuwe architectuur. */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser } = require('../test/helper');
const { nieuweSleutel, teken, sha256 } = require('./lib/toestelteken');
const { vermenigvuldigModel } = require('./lib/onnxproef');

const ORT = process.env.RTG_ORT_DIR;
const JS = ORT && path.join(ORT, 'ort.wasm.bundle.min.mjs');
const WASM = ORT && path.join(ORT, 'ort-wasm-simd-threaded.wasm');
function nietGemeten(reden) { console.log('NIET GEMETEN: ' + reden); process.exit(2); }
if (!ORT || !fs.existsSync(JS) || !fs.existsSync(WASM))
  nietGemeten('zet RTG_ORT_DIR op de dist-map van onnxruntime-web (ort.wasm.bundle.min.mjs en ort-wasm-simd-threaded.wasm).');
const pw = laadPlaywright();
if (geenBrowser(pw)) nietGemeten(geenBrowser(pw));

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-toestelproef-'));
  const dir = path.join(tmp, 'toestel');
  fs.mkdirSync(path.join(dir, 'artefacten'), { recursive: true });
  const s = nieuweSleutel('toestelproef');
  const versie = JSON.parse(fs.readFileSync(path.join(ORT, '..', 'package.json'), 'utf8')).version;
  const contract = 'proef.onnx-vermenigvuldig';
  const zet = (id, soort, buf, licentie, bron) => {
    fs.writeFileSync(path.join(dir, 'artefacten', sha256(buf)), buf);
    return teken({ id, versie, soort, sha256: sha256(buf), grootte: buf.length, licentie, bron,
      naamsvermelding: bron, contracten: [contract] }, { id: s.id, stand: 'actief' }, s.privateKey);
  };
  const regels = {
    runtime: zet('onnxruntime-web-js', 'uitvoerder', fs.readFileSync(JS), 'MIT', 'ONNX Runtime Web (Microsoft)'),
    runtimeWasm: zet('onnxruntime-web-wasm', 'uitvoerder', fs.readFileSync(WASM), 'MIT', 'ONNX Runtime Web (Microsoft)'),
    model: zet('proef-vermenigvuldig', 'model', vermenigvuldigModel(), 'MIT', 'RTG, scripts/lib/onnxproef.js')
  };
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ versie: 1, artefacten: Object.values(regels) }));
  const srv = await startServer({ env: { RTG_DATA_DIR: tmp, RTG_TOESTEL_DIR: dir, SMTP_URL: '' } });
  const browser = await pw.chromium.launch(browserOpties(pw));
  try {
    const page = await browser.newPage();
    await page.goto(srv.base + '/site/404.html');
    for (const m of ['licenties', 'manifest', 'poorten', 'meting', 'opslag', 'rekenaar'])
      await page.addScriptTag({ url: '/shared/toestel/' + m + '.js' });
    const uit = await page.evaluate(async ({ regels, sleutels, contract }) => {
      const O = window.RTGToestelOpslag, art = {};
      for (const rol of Object.keys(regels)) {
        const h = await O.haal(regels[rol], { doorLid: true, mobielBevestigd: true });
        if (!h.ok) return { ok: false, stap: 'opslag', reden: rol + ': ' + h.reden };
        art[rol] = { regel: regels[rol], bytes: h.bytes };
      }
      const feiten = await window.RTGToestelMeting.feiten();
      const c = { taak: contract, plaatsen: ['toestel'], technieken: ['model'],
        kwaliteit: { maat: 'exact', min: 1, graad: 'gemeten' }, last: { rekenMaxMs: 60000 } };
      const keus = window.RTGToestelPoorten.kies(c, [{ id: 'onnx-wasm', plaats: 'toestel', techniek: 'model',
        uitvoerder: 'onnx', beschikbaar: feiten.wasm, kwaliteit: { exact: { waarde: 1, graad: 'gemeten' } }, kosten: 0 }],
        { beleid: { [contract]: true } });
      if (!keus.gekozen) return { ok: false, stap: 'poorten', reden: keus.reden };
      const t0 = performance.now();
      const r = await window.RTGToestelRekenaar.voer({ contract: c, kandidaat: keus.gekozen, artefacten: art, sleutels,
        invoer: { feeds: { a: { type: 'float32', data: [1, 2, 3], dims: [3] }, b: { type: 'float32', data: [4, 5, 6], dims: [3] } } } });
      r.totaalMs = Math.round(performance.now() - t0);
      r.feiten = { webgpu: feiten.webgpu, wasmSimd: feiten.wasmSimd, wasmThreads: feiten.wasmThreads };
      return r;
    }, { regels, sleutels: [{ id: s.id, publiek: s.publiek, stand: 'actief' }], contract });
    const data = uit.ok && uit.uitkomst.tensors.c.data;
    const klopt = !!data && JSON.stringify(data) === '[4,10,18]';
    console.log(JSON.stringify({ gemeten: new Date().toISOString(), onnxruntimeWeb: versie, ok: uit.ok, klopt,
      uitkomst: data || null, reden: uit.reden || null, rekenMs: uit.herkomst ? uit.herkomst.rekenMs : null, totaalMs: uit.totaalMs,
      herkomst: uit.herkomst && { plaats: uit.herkomst.plaats, uitvoerder: uit.herkomst.uitvoerder,
        artefacten: uit.herkomst.artefacten.map(a => a.id + '@' + a.sha256.slice(0, 12)) }, feiten: uit.feiten }, null, 2));
    process.exitCode = klopt ? 0 : 1;
  } finally {
    await browser.close(); await stop(srv); fs.rmSync(tmp, { recursive: true, force: true });
  }
})().catch((e) => { console.error(e); process.exit(1); });
