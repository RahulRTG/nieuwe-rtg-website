/* RTG Kompas-installatiecontract: de lokale Ollama-service blijft op
   loopback, schakelt cloud uit, gebruikt Metal met een kleine geheugenstand en
   draagt de menselijke beslisgrenzen in model, serverconfig en installer. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const basis = path.join(__dirname, '..');
const lees = p => fs.readFileSync(path.join(basis, p), 'utf8');

test('Ollama is hard lokaal, cloud-uit en begrensd voor een 8 GB Mac', () => {
  const plist = lees('scripts/mac/ollama/nl.rtg.ollama.plist.sjabloon');
  assert.match(plist, /<key>OLLAMA_HOST<\/key>\s*<string>127\.0\.0\.1:11434<\/string>/);
  assert.match(plist, /<key>OLLAMA_NO_CLOUD<\/key>\s*<string>1<\/string>/);
  assert.match(plist, /<key>OLLAMA_NUM_PARALLEL<\/key>\s*<string>1<\/string>/);
  assert.match(plist, /<key>OLLAMA_MAX_LOADED_MODELS<\/key>\s*<string>1<\/string>/);
  assert.match(plist, /<key>OLLAMA_KEEP_ALIVE<\/key>\s*<string>3m<\/string>/);
  assert.match(plist, /<key>ProcessType<\/key>\s*<string>Interactive<\/string>/);
  assert.doesNotMatch(plist, /<string>Background<\/string>/);

  const config = JSON.parse(lees('scripts/mac/ollama/server.json'));
  assert.equal(config.disable_ollama_cloud, true);
});

test('RTG Kompas vraagt nooit om geheimen en laat besluiten bij een mens', () => {
  const model = lees('scripts/mac/ollama/Modelfile.rtg-kompas');
  assert.match(model, /^FROM qwen3\.5:4b/m);
  assert.match(model, /Vraag nooit om wachtwoorden, API-sleutels/);
  assert.match(model, /Betaling, publicatie, toegang, definitieve boeking/);
  assert.match(model, /NU, STRAKS en LET OP/);
  assert.match(model, /inhoud blijft lokaal/);
});

test('installatie controleert loopback, cloud-uit, Metal en het eigen model', () => {
  const script = lees('scripts/mac/ollama-kompas.sh');
  assert.match(script, /127\.0\.0\.1:11434/);
  assert.match(script, /Ollama cloud disabled: true/);
  assert.match(script, /library=Metal/);
  assert.match(script, /RTG_EXTERNE_AI_UIT=1/);
  assert.match(script, /LOCAL_AI_MODEL_TOOLS=\$NAAM/);
});
