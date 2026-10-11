/* DE CONCIERGEPROEF EN ZIJN REGISTER -- een ketenproef over de concierge-lus en
   de tafeluitzondering. Ronde 1 liet hem voltooibaar leveren voor het hele
   Privékantoor (link:rechterhand); de tegenlezing wees erop dat hij alleen de
   lus loopt, en sindsdien staat hij in ZONDER_APP (toets 5).

   scripts/conciergeproef.js loopt de concierge-lus af (CONCIERGE.md) tegen een
   wegwerpserver en schrijft met `npm run conciergeproef:vast` CONCIERGEPROEF.json.
   Dit bestand bewaakt het INSTRUMENT en het REGISTER, in de vorm van
   test/lusproef.test.js; de keten zelf duurt te lang voor een gewone toets.

   Draai los: node --test test/conciergeproef.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const bron = fs.readFileSync(path.join(WORTEL, 'scripts', 'conciergeproef.js'), 'utf8');
const REGISTER = 'CONCIERGEPROEF.json';

test('1. de proef draait op een wegwerpserver, zakt op een breuk, en deelt geen ketenmodule', () => {
  assert.match(bron, /require\('\.\/lib\/wegwerpserver'\)/);
  assert.doesNotMatch(bron, /localhost:3000|127\.0\.0\.1:3000/);
  assert.match(bron, /process\.exit\(stuk \? 1 : 0\)/, 'zonder foutcode op een breuk is dit een meting en geen proef');
  assert.doesNotMatch(bron, /require\(.*(lib\/keten|lib\/ketenvorm|lib\/proefvorm)/,
    'een gedeelde ketenmodule zou scripts/ketenvorm.js zijn eigen aanname laten meten');
});

test('2. het register spreekt het woordgebruik van de andere ketenregisters', () => {
  assert.match(bron, /sluit: 'gesloten'/);
  assert.match(bron, /houdt: 'gehouden'/);
  assert.match(bron, /stempel: huisStempel\(\)/, 'zonder huisstempel kan versheid() niets over dit register zeggen');
  assert.match(bron, /reg\.sluit = reg\.sluitMetBevinding && t\.openBekend === 0/);
});

test('3. het echte register is bruikbaar als bewijs en spreekt zichzelf niet tegen', () => {
  const reg = JSON.parse(fs.readFileSync(path.join(WORTEL, REGISTER), 'utf8'));
  assert.ok(reg.stempel && typeof reg.stempel === 'object' && reg.stempel.commit, REGISTER + ' draagt geen stempel met commit');
  assert.ok(Array.isArray(reg.schakels) && reg.schakels.length >= 10, REGISTER + ' draagt te weinig schakels om iets te bewijzen');
  assert.ok(Array.isArray(reg.storingen) && reg.storingen.length >= 5, REGISTER + ' draagt te weinig storingen');
  for (const s of reg.schakels) assert.ok(['gesloten', 'openBekend', 'stuk'].includes(s.stand), 'schakel ' + s.nr + ': ' + s.stand);
  for (const s of reg.storingen) assert.ok(['gehouden', 'gebroken'].includes(s.stand), 'storing ' + s.nr + ': ' + s.stand);
  const tel = (lijst, stand) => lijst.filter((s) => s.stand === stand).length;
  assert.equal(reg.telling.gesloten, tel(reg.schakels, 'gesloten'), 'de telling overstemt de schakels');
  assert.equal(reg.telling.gebroken, tel(reg.storingen, 'gebroken'), 'de telling overstemt de storingen');
  const heel = tel(reg.schakels, 'stuk') === 0 && tel(reg.storingen, 'gebroken') === 0 && tel(reg.schakels, 'openBekend') === 0;
  assert.equal(reg.sluit, heel, '`sluit` zegt iets anders dan de rijen');
  /* De grens hoort in het register zelf te staan: wat de proef NIET loopt,
     leest anders als iets wat hij wel bewees. */
  assert.match(reg.grens, /geen browser/);
  assert.match(reg.grens, /NIET de rest van het Privekantoor/);
});

test('4. de lezer van APPWERKT leest het echte register als een gesloten keten', () => {
  const { ketenUitslag } = require('../scripts/lib/bewijsbron');
  const u = ketenUitslag(REGISTER, { versheid: () => ({ vers: true, reden: 'vers gezet in de toets' }) });
  assert.equal(u.status, 'BEWEZEN', REGISTER + ' leest als ' + u.status + ': ' + u.reden);
});

test('5. het contract beweert alleen wat gelopen is: geen voltooibaar voor het hele Privékantoor', () => {
  const { CONTRACT, ZONDER_APP } = require('../scripts/lib/appcontract');
  /* De proef loopt de lus en de tafeluitzondering, niet woning, kring, bezit of
     mandaat. Een keten die een deelbelofte bewijst levert geen voltooibaar voor
     de hele app (dezelfde grond als MOMENTPROEF). Wie link:rechterhand weer aan
     dit register hangt, laat deze toets zakken. */
  for (const [functie, c] of Object.entries(CONTRACT)) {
    for (const [naam, b] of Object.entries(c)) {
      if (naam === 'belofte') continue;
      assert.notEqual(b.register, REGISTER, functie + ' leest ' + REGISTER + ' als ' + naam + ', maar de proef loopt alleen de lus');
    }
  }
  const z = ZONDER_APP.find(x => x.register === REGISTER);
  assert.ok(z && /deelbelofte/.test(z.reden) && z.nodig, REGISTER + ' staat niet met reden in ZONDER_APP');
  /* Wat hij WEL loopt, moet ook echt in de bron staan: de lid-routes van het
     tabblad Zaken, de verrassing, de zaakroutes en de tafeluitzondering. */
  const scherm = fs.readFileSync(path.join(WORTEL, 'public', 'apps', 'lifestyle-lus.js'), 'utf8');
  for (const pad of ['lus/intake', 'lus/zaak', 'lus/beslis', 'lus/toelichting', 'lus/verrassing']) {
    assert.ok(scherm.includes("'" + pad + "'"), 'het scherm roept ' + pad + ' niet aan');
    assert.ok(bron.includes('/api/member/bureau/' + pad), 'de proef loopt ' + pad + ' niet');
  }
  for (const pad of ['/api/supplier/concierge/opdrachten', '/api/supplier/concierge/bevestig',
    '/api/supplier/reservering/doorzetten', '/api/supplier/reservering/tegenvoorstel', '/api/reservering/tegenvoorstel']) {
    assert.ok(bron.includes("'" + pad + "'"), 'de proef loopt ' + pad + ' niet');
  }
});
