#!/usr/bin/env node
/* TEKST NAAR VECTOR, GEMETEN IN EEN ECHTE BROWSER. TOESTEL.md par. 12.

   Zelfde vorm als scripts/spraakproef.js, en om dezelfde reden een meetscript
   en geen toets: model en runtime staan met opzet niet in de repo. Zonder die
   bestanden zegt dit script hardop dat het NIET GEMETEN heeft (exitcode 2).

     RTG_ORT_DIR=<onnxruntime-web/dist>            de runtime
     RTG_MINILM_DIR=<map met onnx/ en tokenizer.json>  all-MiniLM-L6-v2 (q8)
     RTG_VECTOR_REF=<json met zinnen en vectoren>  een referentie van BUITEN
                                                   deze code (optioneel)
     node scripts/vectorproef.js

   Of een ZOEKPROEFSET (par. 13):
     RTG_VECTOR_SET=test/fixtures/proefset-zoeken-nl.json
   Dan worden notities en vragen in de browser vectoren, en telt de uitslag
   treffer@1, treffer@3 en MRR per soort vraag -- naast dezelfde maat voor een
   woordtelling zonder model (BM25, scripts/lib/zoekmaat.js). Die twee worden
   nooit opgeteld tot een cijfer: het verschil tussen hen IS de uitslag. De
   derde kolom `samen` is een GECOMBINEERDE rangorde (reciprocal rank fusion),
   een zoekmethode en geen gemiddelde van de twee maten.

   De weg is die van een lid: artefacten naar OPFS, grendel (met een
   wegwerpsleutel), tokens in de pagina, rekenen in de afgesloten cel met de
   ALGEMENE uitvoerder `onnx`, middelen in de pagina. De uitslag noemt per zin de
   cosinus met de referentie en de laagste; en hij meet de eigenschap waar par.
   12 om draait: dezelfde tekst geeft dezelfde vector, los of tussen andere. */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser } = require('../test/helper');
const { nieuweSleutel, teken, sha256 } = require('./lib/toestelteken');

const ORT = process.env.RTG_ORT_DIR, ML = process.env.RTG_MINILM_DIR, REF = process.env.RTG_VECTOR_REF;
function nietGemeten(reden) { console.log('NIET GEMETEN: ' + reden); process.exit(2); }
const BESTANDEN = {
  runtime: ORT && path.join(ORT, 'ort.wasm.bundle.min.mjs'), runtimeWasm: ORT && path.join(ORT, 'ort-wasm-simd-threaded.wasm'),
  model: ML && path.join(ML, 'onnx', 'model_quantized.onnx'), tokenizer: ML && path.join(ML, 'tokenizer.json')
};
const mist = Object.entries(BESTANDEN).filter(([, p]) => !p || !fs.existsSync(p)).map(([r]) => r);
if (mist.length) nietGemeten('ontbreekt: ' + mist.join(', ') + ' (zet RTG_ORT_DIR en RTG_MINILM_DIR).');
const pw = laadPlaywright();
if (geenBrowser(pw)) nietGemeten(geenBrowser(pw));
const ref = REF ? JSON.parse(fs.readFileSync(REF, 'utf8')) : null;
const SET = process.env.RTG_VECTOR_SET ? JSON.parse(fs.readFileSync(process.env.RTG_VECTOR_SET, 'utf8')) : null;
const ZINNEN = SET ? SET.notities.map((n) => n.tekst).concat(SET.vragen.map((v) => v.vraag))
  : ref ? ref.zinnen : ['De hond rent door het park.', 'A dog is running through the park.', 'Mijn vlucht is verzet.'];

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vectorproef-'));
  const dir = path.join(tmp, 'toestel');
  fs.mkdirSync(path.join(dir, 'artefacten'), { recursive: true });
  const s = nieuweSleutel('vectorproef');
  const regels = {};
  for (const [rol, p] of Object.entries(BESTANDEN)) {
    const buf = fs.readFileSync(p), ortDeel = rol.startsWith('runtime');
    fs.writeFileSync(path.join(dir, 'artefacten', sha256(buf)), buf);
    regels[rol] = teken({ id: 'vectorproef-' + rol, versie: '1', soort: ortDeel ? 'uitvoerder' : 'model',
      sha256: sha256(buf), grootte: buf.length, licentie: ortDeel ? 'MIT' : 'Apache-2.0',
      bron: ortDeel ? 'ONNX Runtime Web (Microsoft)' : 'all-MiniLM-L6-v2 (sentence-transformers), ONNX-export via ' + ML,
      naamsvermelding: ortDeel ? 'ONNX Runtime Web (Microsoft)' : 'sentence-transformers/all-MiniLM-L6-v2', contracten: ['tekst.vector'] },
    { id: s.id, stand: 'actief' }, s.privateKey);
  }
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ versie: 1, artefacten: Object.values(regels) }));
  const srv = await startServer({ env: { RTG_DATA_DIR: tmp, RTG_TOESTEL_DIR: dir, SMTP_URL: '' } });
  const browser = await pw.chromium.launch(browserOpties(pw));
  try {
    const page = await browser.newPage();
    await page.goto(srv.base + '/site/404.html');
    for (const m of ['licenties', 'manifest', 'poorten', 'meting', 'opslag', 'rekenaar', 'vector', 'vectorvoer'])
      await page.addScriptTag({ url: '/shared/toestel/' + m + '.js' });
    const uit = await page.evaluate(async ({ regels, sleutels, zinnen }) => {
      const O = window.RTGToestelOpslag, art = {};
      for (const rol of Object.keys(regels)) {
        const h = await O.haal(regels[rol], { doorLid: true, mobielBevestigd: true });
        if (!h.ok) return { ok: false, stap: 'opslag', reden: rol + ': ' + h.reden };
        art[rol] = { regel: regels[rol], bytes: h.bytes };
      }
      const feiten = await window.RTGToestelMeting.feiten();
      const c = { taak: 'tekst.vector', plaatsen: ['toestel'], technieken: ['model'],
        kwaliteit: { maat: 'cosinus', min: 0, graad: 'vermoed' }, last: { rekenMaxMs: 60000 } };
      const keus = window.RTGToestelPoorten.kies(c, [{ id: 'minilm-wasm', plaats: 'toestel', techniek: 'model',
        uitvoerder: 'onnx', beschikbaar: feiten.wasm, kwaliteit: { cosinus: { waarde: 1, graad: 'vermoed' } }, kosten: 0 }],
      { beleid: { 'tekst.vector': true } });
      if (!keus.gekozen) return { ok: false, stap: 'poorten', reden: keus.reden };
      const VV = window.RTGToestelVectorVoer, t0 = performance.now();
      const r = await VV.naarVectoren({ contract: c, kandidaat: keus.gekozen, artefacten: art, sleutels, teksten: zinnen });
      r.totaalMs = Math.round(performance.now() - t0);
      if (!r.ok) return r;
      const los = await VV.naarVectoren({ contract: c, kandidaat: keus.gekozen, artefacten: art, sleutels, teksten: [zinnen[0]] });
      r.losGelijk = los.ok && window.RTGToestelVector.cosinus(los.vectoren[0], r.vectoren[0]);
      r.losVingerafdrukGelijk = los.vingerafdruk === r.vingerafdruk;
      r.vectoren = r.vectoren.map((v) => Array.from(v));
      r.feiten = { webgpu: feiten.webgpu, wasmSimd: feiten.wasmSimd };
      return r;
    }, { regels, sleutels: [{ id: s.id, publiek: s.publiek, stand: 'actief' }], zinnen: ZINNEN });
    const cos = (a, b) => a.reduce((t, x, i) => t + x * b[i], 0);
    if (SET && uit.ok) {
      const Z = require('./lib/zoekmaat');
      const N = SET.notities.length, notV = uit.vectoren.slice(0, N), vraagV = uit.vectoren.slice(N);
      const rv = vraagV.map((q) => Z.rangorde(SET.notities, (i) => cos(q, notV[i])));
      const s25 = Z.bm25(SET.notities);
      const rb = SET.vragen.map((v) => Z.rangorde(SET.notities, (i) => s25(v.vraag, i)));
      const vec = Z.maat(SET.vragen, rv), bm = Z.maat(SET.vragen, rb);
      const samen = Z.maat(SET.vragen, rv.map((r, i) => Z.samen([r, rb[i]])));
      console.log(JSON.stringify({ gemeten: new Date().toISOString(), ok: true, taal: SET.taal,
        notities: N, vragen: SET.vragen.length, model: 'vectoren via ' + ML, vingerafdruk: uit.vingerafdruk,
        vector: vec, basislijnZonderModel: bm, samen: samen, rekenMs: uit.herkomst.rekenMs,
        voorbehoud: 'de relevantie-oordelen zijn van de bouwer en niet van leden; achttien vragen zijn een richting, geen maat met een foutmarge' }, null, 2));
      return;
    }
    const tegenRef = uit.ok && ref ? uit.vectoren.map((v, i) => +cos(v, ref.vectoren[i]).toFixed(5)) : null;
    const laagste = tegenRef ? Math.min(...tegenRef) : null;
    console.log(JSON.stringify({ gemeten: new Date().toISOString(), ok: uit.ok, stap: uit.stap || null, reden: uit.reden || null,
      teksten: ZINNEN.length, dimensie: uit.ok ? uit.vectoren[0].length : null, afgekapt: uit.afgekapt,
      rekenMs: uit.herkomst ? uit.herkomst.rekenMs : null, totaalMs: uit.totaalMs,
      losGelijkAanInReeks: uit.losGelijk, zelfdeVingerafdruk: uit.losVingerafdrukGelijk,
      tegenReferentie: tegenRef, laagsteCosinus: laagste, referentie: ref ? ref.bron : 'geen (zet RTG_VECTOR_REF)',
      vingerafdruk: uit.vingerafdruk, feiten: uit.feiten,
      herkomst: uit.herkomst && { plaats: uit.herkomst.plaats, uitvoerder: uit.herkomst.uitvoerder,
        artefacten: uit.herkomst.artefacten.map((a) => a.rol + '=' + a.sha256.slice(0, 12)) },
      voorbehoud: 'overeenkomst met een referentie is geen kwaliteitsmaat; zoekkwaliteit vraagt een proefset met relevantie-oordelen' }, null, 2));
    process.exitCode = uit.ok && uit.losGelijk > 0.99999 && (laagste === null || laagste >= 0.99) ? 0 : 1;
  } finally {
    await browser.close(); await stop(srv); fs.rmSync(tmp, { recursive: true, force: true });
  }
})().catch((e) => { console.error(e); process.exit(1); });
