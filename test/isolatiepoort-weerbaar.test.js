/* DE ISOLATIEPOORT BIJ ONZEKERHEID -- twijfel sluit, en een handhaver valt niet stil terug.

   server/middleware/isolatiepoort-stand.js houdt bij of de poort gemonteerd is
   en bijt; -drager.js weegt een mutatie tegen de standen van het account;
   -realtime.js keurt live-verbindingen; techniek-isolatiepoort.js laat het
   techniekdeel langs dezelfde weging lopen. Een nep-laag maakt de randen raakbaar.

   Wat hier niet mag sneuvelen:
   1. Een bijtende handhaver mag niet stil naar schaduw; productie zonder de
      afdwingvlag start niet.
   2. Ontbreekt de laag terwijl handhaven moet, of gooit het besluit: dicht met
      ISOLATIE_ONBEPAALD (in de schaduw alleen geteld). Standen die allemaal
      normaal zijn of een toegestaan besluit laten door.
   3. Een live-verbinding met een ingetrokken sessie krijgt 401 met de eigen zin;
      zonder laag onder handhaving 503; een stand op isolatie sluit in de
      schaduw niet maar telt wel.
   4. sluitDrager zonder sleutel sluit niemand (een lege sleutel is geen
      jokerteken); een kapotte socket breekt het sluiten niet af.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - isolatiepoort-stand.js zetLaag(): de "niet stil naar schaduw"-weigering weg -> toets 1 zakt.
   - isolatiepoort-drager.js weeg(): `if (!laag) return moetDicht() ? onzeker(...) : null` -> `return null` -> toets 2 zakt.
   - isolatiepoort-realtime.js sluitDrager(): `if (!sleutel) return 0;` weg -> toets 4 zakt.

   Draai los: node --test test/isolatiepoort-weerbaar.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const poortstand = require('../server/middleware/isolatiepoort-stand');
const drager = require('../server/middleware/isolatiepoort-drager');
const realtime = require('../server/middleware/isolatiepoort-realtime');
const techniek = require('../server/middleware/techniek-isolatiepoort');
const sessies = require('../server/kern/isolatie/sessiedragers');

const ENV = ['NODE_ENV', 'RTG_ISOLATIE_AFDWINGEN', 'REDIS_URL'];
const oudEnv = Object.fromEntries(ENV.map(k => [k, process.env[k]]));
function herstel() {
  poortstand.zetLaag(null); poortstand._wisTelling(); realtime._wis(); sessies.zetSessieOplosser(null);
  for (const k of ENV) { if (oudEnv[k] === undefined) delete process.env[k]; else process.env[k] = oudEnv[k]; }
}
test.afterEach(herstel);

function nepLaag({ standen = { identiteit: 'isolatie' }, besluit, trede = 'isolatie' } = {}) {
  return { context: () => ({ standen }), besluit: besluit || (() => ({ toegestaan: false, reden: 'DICHT' })),
    effectieveStand: () => ({ trede }) };
}
const verzoek = (o = {}) => Object.assign({ method: 'POST', path: '/api/member/iets', session: { key: 'c-1', sid: 's1' } }, o);

test('1. een bijtende handhaver valt niet stil naar schaduw; productie eist de vlag', () => {
  const l = nepLaag();
  poortstand.zetLaag(l, { afdwingen: true });
  assert.throws(() => poortstand.zetLaag(l, { afdwingen: false }), /niet stil naar schaduw/);
  assert.equal(poortstand.bijtHij(), true);
  assert.equal(poortstand.zetLaag(nepLaag(), { afdwingen: false }).bijt, false, 'een ANDERE laag mag wel in schaduw');
  assert.throws(() => poortstand.eisProductieGereed({ NODE_ENV: 'production' }), /RTG_ISOLATIE_AFDWINGEN/);
  assert.deepEqual(poortstand.eisProductieGereed({ NODE_ENV: 'test' }), { nodig: false });
});

test('2. twijfel sluit, normaal en toegestaan laten door', () => {
  process.env.NODE_ENV = 'production';
  process.env.RTG_ISOLATIE_AFDWINGEN = '1';
  const zonderLaag = drager.weeg(verzoek());
  assert.equal(zonderLaag.antwoord.reden, 'ISOLATIE_ONBEPAALD', 'geen laag in productie = dicht');
  delete process.env.NODE_ENV;
  assert.equal(drager.weeg(verzoek()), null, 'buiten productie en zonder bijten: alleen geteld');

  poortstand.zetLaag(nepLaag({ standen: { identiteit: 'normaal', sessie: null } }), { afdwingen: true });
  assert.equal(drager.weeg(verzoek()), null, 'alles normaal: niets te wegen');
  poortstand.zetLaag(null);
  poortstand.zetLaag(nepLaag({ besluit: () => ({ toegestaan: true }) }), { afdwingen: true });
  assert.equal(drager.weeg(verzoek({ get: () => '' })), null);
  poortstand.zetLaag(null);
  poortstand.zetLaag(nepLaag({ besluit: () => { throw 'kapot'; } }), { afdwingen: true });   // eslint-disable-line no-throw-literal
  assert.equal(drager.weeg(verzoek()).antwoord.reden, 'ISOLATIE_ONBEPAALD');
  poortstand.zetLaag(null);
  poortstand.zetLaag(nepLaag(), { afdwingen: true });
  const dicht = drager.weeg(verzoek());
  assert.deepEqual(dicht.antwoord.dragers, [], 'een besluit zonder dragerlijst levert een lege lijst, geen crash');
  assert.equal(dicht.antwoord.regel, null);
  const st = poortstand.stand();
  assert.ok(st.onzeker >= 2);
  assert.ok(st.fouten.some(f => /kapot$/.test(f)));
  poortstand.noteerOnzeker(null);
  assert.equal(poortstand.stand().fouten.pop(), 'onbekende fout');

  /* Het techniekdeel loopt langs dezelfde weging, zonder het huis-been. */
  let door = 0;
  const res = { code: 0, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
  assert.equal(techniek.behandel(verzoek({ path: '/api/member/x' }), res, () => door++, {}), false);
  assert.equal(techniek.behandel(verzoek({ path: '/api/techniek/stand' }), res, () => door++, {}), true);
  assert.equal(res.code, 503);
  assert.equal(door, 0);
});

test('3. live-verbindingen: ingetrokken is 401, geen laag onder handhaving 503, schaduw telt', () => {
  sessies.zetSessieOplosser(() => null);
  const weg = realtime.registreer({ res: {}, token: 'tok-weg' });
  assert.equal(weg.status, 401);
  assert.equal(weg.antwoord.error, 'Deze live-sessie is niet meer geldig.');

  const s = { key: 'c-2', sid: 's2' };
  assert.equal(realtime._keur({ sessie: s }).toegestaan, true, 'zonder laag en zonder handhaving open');
  process.env.NODE_ENV = 'production';
  process.env.RTG_ISOLATIE_AFDWINGEN = '1';
  const onbepaald = realtime.registreer({ res: {}, sessie: s });
  assert.equal(onbepaald.status, 503);
  assert.equal(onbepaald.antwoord.reden, 'ISOLATIE_ONBEPAALD');
  delete process.env.NODE_ENV;
  delete process.env.RTG_ISOLATIE_AFDWINGEN;
  poortstand.zetLaag(nepLaag(), { afdwingen: false });
  const voor = poortstand.stand().zouSluiten;
  const schaduw = realtime._keur({ sessie: s });
  assert.equal(schaduw.toegestaan, true);
  assert.equal(schaduw.schaduw, true);
  assert.equal(poortstand.stand().zouSluiten, voor + 1);
});

test('4. sluitDrager zonder sleutel sluit niemand; sluitAlles sluit ook na een kapotte socket', () => {
  sessies.zetSessieOplosser((t) => ({ key: 'c-' + t, sid: 'sid-' + t }));
  const kapot = { writableEnded: false, end() { throw new Error('socket weg'); } };
  const heel = { writableEnded: false, ended: 0, end() { this.ended++; this.writableEnded = true; } };
  realtime.registreer({ res: kapot, token: 'a' });
  realtime.registreer({ res: heel, token: 'b' });
  assert.equal(realtime.sluitDrager('apparaat', null), 0, 'wachtwoordsessies zonder apparaatsleutel blijven open');
  assert.equal(realtime.sluitDrager('apparaat', ''), 0);
  assert.equal(realtime.sluitDrager('identiteit', 'c-a'), 1, 'een kapotte socket breekt het sluiten niet af');
  assert.equal(realtime.magSchrijven(kapot), true, 'eenmaal gesloten is hij niet meer geregistreerd');
  assert.equal(realtime.sluitAlles(), 1);
  assert.equal(heel.ended, 1);
});
