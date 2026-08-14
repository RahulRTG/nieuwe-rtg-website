'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const bron=fs.readFileSync(path.join(__dirname,'../public/apps/werkruimte.html'),'utf8');

test('RTG Work OS opent de echte kantoorsoftware als zelfstandige surfaces',()=>{
  for(const url of ['/apps/kantoor.html','/apps/kantoren.html','/apps/personeel.html?kantoor=1',
    '/apps/office.html?werk=kantoor','/apps/agenda.html','/apps/rtmail.html',
    '/apps/bestanden.html','/apps/backoffice.html','/apps/command.html'])assert.ok(bron.includes(url),url);
  assert.match(bron,/gebied.*kantoor/);
  assert.match(bron,/id: 'vandaag'[\s\S]*id: 'afdelingen'/);
});

test('de kantoorstand blijft een meubelplan en maakt AI niet verplicht',()=>{
  assert.match(bron,/alle[\s\S]*handelingen blijven zonder AI volledig bruikbaar/);
  assert.doesNotMatch(bron,/anthropic|openai|claude/i);
  assert.match(bron,/RTGSchil\.open/);
});
