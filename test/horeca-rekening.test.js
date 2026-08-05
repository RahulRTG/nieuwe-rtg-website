/* RTG Horeca OS, deel 1: de rekening die blijft leven -- openen, regels,
   gangen, verplaatsen, samenvoegen, splitsen, fooi, betalen, bonnen en de
   offline-wachtrij.

   De zwaarste bewering staat in de eerste twee toetsen en gaat over geld:
   splitsen en samenvoegen zijn VERPLAATSINGEN. De som van de delen is exact
   het geheel, tot op de cent -- ook bij 10,00 door drie, waar de naieve
   berekening 9,99 oplevert. Verder: fooi wordt nooit voorgevuld, te veel
   betalen bestaat niet, een onbetaalde rekening verdwijnt niet maar wordt
   oninbaar MET een reden, en een offline bon die twee keer binnenkomt levert
   een keer omzet.
   Draai: node --experimental-sqlite --test test/horeca-rekening.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');

let BASE, child, tok;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-horeca-'));
const api = (pad, body, token) => fetch(BASE + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const H = (pad, body) => api('/api/supplier/horeca' + pad, body, tok);

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const roster = (await api('/api/supplier/roster', { code: 'KIKUNOI' })).body;
  const mgr = roster.staff.find(x => x.role === 'manager') || roster.staff[0];
  tok = (await api('/api/supplier/login', { code: 'KIKUNOI', staffId: mgr.id, pin: '1234' })).body.token;
  assert.ok(tok, 'de zaak-inlog werkt');
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

// een rekening met een paar regels; geeft de id terug
async function rekening(tafel, regels) {
  const r = (await H('/rekening/open', { kanaal: 'tafel', tafel, gasten: 2 })).body;
  for (const x of regels) await H('/rekening/regel', Object.assign({ rekeningId: r.rekening.id }, x));
  return (await H('/rekening', { rekeningId: r.rekening.id })).body.rekening;
}

test('een rekening blijft leven: openen, regels, en per tafel maar een', async () => {
  const r = await rekening('Tafel 24', [
    { naam: 'Tournedos', prijs: 34.5, aantal: 2, gang: 2, station: 'grill', allergie: 'noten' },
    { naam: 'Zeebaars', prijs: 29, gang: 2, station: 'warm', notitie: 'zonder zuivel' }
  ]);
  assert.equal(r.regels.length, 2);
  assert.equal(r.totalen.bruto, 34.5 * 2 * 100 + 2900);
  assert.equal(r.regels[0].allergie, 'noten', 'een allergie staat in een eigen veld, niet in de notitie');

  const dubbel = await H('/rekening/open', { kanaal: 'tafel', tafel: 'Tafel 24' });
  assert.equal(dubbel.status, 409, 'op een tafel staat hooguit een open rekening');
  assert.equal(dubbel.body.rekeningId, r.id, 'en hij wijst naar de bestaande');

  // een gang vrijgeven met een serveertijd
  const gang = (await H('/gang/vrij', { rekeningId: r.id, gang: 2, serveerOm: '19:42' })).body;
  assert.equal(gang.vrijgegeven, 2);
  assert.equal(gang.serveerOm, '19:42');
  assert.equal((await H('/gang/vrij', { rekeningId: r.id, gang: 2 })).status, 404, 'twee keer vrijgeven doet niets');
});

test('splitsen per persoon: 10,00 door drie is 3,34 + 3,33 + 3,33, niet 9,99', async () => {
  const r = await rekening('Tafel 3', [{ naam: 'Deelbaar', prijs: 10, aantal: 1 }]);
  assert.equal(r.totalen.netto, 1000);
  const uit = (await H('/rekening/splits', { rekeningId: r.id, perPersoon: 3 })).body;
  assert.equal(uit.somKlopt, true);
  assert.equal(uit.delen.length, 3);
  const som = uit.delen.reduce((t, d) => t + d.totalen.netto, 0);
  assert.equal(som, 1000, 'de som van de delen is exact het geheel');
  assert.deepEqual(uit.delen.map(d => d.totalen.netto).sort((a, b) => b - a), [334, 333, 333]);

  // de oorspronkelijke rekening is gesplitst en niet meer open
  const oud = (await H('/rekening', { rekeningId: r.id })).body.rekening;
  assert.equal(oud.status, 'gesplitst');
  assert.equal(oud.regels.length, 0);
});

test('splitsen per product: elke regel hoort bij precies een deel', async () => {
  const r = await rekening('Tafel 5', [
    { naam: 'Biertje', prijs: 5.5, aantal: 2 }, { naam: 'Wijn', prijs: 8 }, { naam: 'Bitterballen', prijs: 7.5 }
  ]);
  const ids = r.regels.map(x => x.id);

  const half = await H('/rekening/splits', { rekeningId: r.id, delen: [[ids[0]], [ids[1]]] });
  assert.equal(half.status, 400);
  assert.match(half.body.error, /geen enkel deel/, 'splitsen laat niets achter');

  const dubbel = await H('/rekening/splits', { rekeningId: r.id, delen: [[ids[0], ids[1]], [ids[1], ids[2]]] });
  assert.equal(dubbel.status, 400);
  assert.match(dubbel.body.error, /twee delen/);

  const uit = (await H('/rekening/splits', { rekeningId: r.id, delen: [[ids[0]], [ids[1], ids[2]]] })).body;
  assert.equal(uit.somKlopt, true);
  assert.equal(uit.delen[0].totalen.netto, 1100);
  assert.equal(uit.delen[1].totalen.netto, 1550);
  assert.equal(uit.delen[0].totalen.netto + uit.delen[1].totalen.netto, r.totalen.netto);
});

test('een percentagekorting overleeft het splitsen, tot op de cent', async () => {
  const r0 = (await H('/rekening/open', { kanaal: 'tafel', tafel: 'Tafel 7' })).body.rekening;
  await H('/rekening/regel', { rekeningId: r0.id, naam: 'Menu', prijs: 33.33, aantal: 3 });
  assert.equal((await H('/korting', { rekeningId: r0.id, procent: 10 })).status, 400, 'korting zonder reden bestaat niet');
  await H('/korting', { rekeningId: r0.id, procent: 10, reden: 'vaste gast' });
  const r = (await H('/rekening', { rekeningId: r0.id })).body.rekening;
  assert.equal(r.totalen.netto, 9999 - Math.round(9999 * 0.1));

  const uit = (await H('/rekening/splits', { rekeningId: r.id, perPersoon: 3 })).body;
  assert.equal(uit.delen.reduce((t, d) => t + d.totalen.netto, 0), r.totalen.netto,
    'de korting verdampt niet en wordt niet dubbel gegeven');
});

test('samenvoegen telt op, en schuiven kan niet meer als er is betaald', async () => {
  const a = await rekening('Tafel 10', [{ naam: 'Steak', prijs: 24 }]);
  const b = await rekening('Tafel 11', [{ naam: 'Vis', prijs: 26.5 }]);
  const samen = (await H('/rekening/voeg-samen', { rekeningId: a.id, metId: b.id })).body;
  assert.equal(samen.somKlopt, true);
  assert.equal(samen.rekening.totalen.netto, 2400 + 2650);
  const oud = (await H('/rekening', { rekeningId: b.id })).body.rekening;
  assert.equal(oud.status, 'samengevoegd');
  assert.equal(oud.samengevoegdIn, a.id);

  // verplaatsen naar een bezette tafel kan niet
  const c = await rekening('Tafel 12', [{ naam: 'Soep', prijs: 9 }]);
  const bezet = await H('/rekening/verplaats', { rekeningId: c.id, naarTafel: 'Tafel 10' });
  assert.equal(bezet.status, 409);
  assert.equal((await H('/rekening/verplaats', { rekeningId: c.id, naarTafel: 'Tafel 14' })).body.rekening.tafel, 'Tafel 14');

  // na een deelbetaling is schuiven dicht
  await H('/betaal', { rekeningId: c.id, wijze: 'pin', bedrag: 4 });
  const na = await H('/rekening/verplaats', { rekeningId: c.id, naarTafel: 'Tafel 15' });
  assert.equal(na.status, 409);
  assert.match(na.body.error, /betaald/);
});

test('betalen: deels, met meerdere methoden, en nooit meer dan er openstaat', async () => {
  const r = await rekening('Tafel 20', [{ naam: 'Diner', prijs: 50 }]);
  assert.equal((await H('/betaal', { rekeningId: r.id, wijze: 'bitcoin', bedrag: 50 })).status, 400);
  const teveel = await H('/betaal', { rekeningId: r.id, wijze: 'pin', bedrag: 60 });
  assert.equal(teveel.status, 400);
  assert.match(teveel.body.error, /meer dan er openstaat/);

  const deel = (await H('/betaal', { rekeningId: r.id, wijze: 'contant', bedrag: 20 })).body;
  assert.equal(deel.openstaand, 3000);
  assert.equal(deel.gesloten, false);
  const rest = (await H('/betaal', { rekeningId: r.id, wijze: 'pin' })).body;
  assert.equal(rest.openstaand, 0);
  assert.equal(rest.gesloten, true);
  assert.equal((await H('/betaal', { rekeningId: r.id, wijze: 'pin', bedrag: 1 })).status, 409);
});

test('fooi wordt nooit voorgevuld en telt niet mee in de omzet', async () => {
  const r = await rekening('Tafel 21', [{ naam: 'Lunch', prijs: 40 }]);
  assert.equal(r.totalen.fooi, 0, 'zonder gebaar geen fooi');
  const met = (await H('/fooi', { rekeningId: r.id, bedrag: 6 })).body;
  assert.equal(met.fooi, 600);
  assert.equal(met.rekening.totalen.netto, 4000, 'de omzet blijft 40,00');
  assert.equal(met.rekening.totalen.teBetalen, 4600);
  await H('/betaal', { rekeningId: r.id, wijze: 'pin' });
  const na = (await H('/rekening', { rekeningId: r.id })).body.rekening;
  assert.equal(na.status, 'betaald');
});

test('cadeaubon: saldo loopt af, kan niet onder nul, en de rest blijft openstaan', async () => {
  const bon = (await H('/bon/maak', { soort: 'cadeaubon', bedrag: 25, naam: 'Jubileum' })).body.bon;
  assert.equal(bon.saldo, 2500);
  const r = await rekening('Tafel 30', [{ naam: 'Proeverij', prijs: 60 }]);
  const b1 = (await H('/betaal', { rekeningId: r.id, wijze: 'bon', bonCode: bon.code, bedrag: 40 })).body;
  assert.equal(b1.betaling.centen, 2500, 'er wordt hooguit het saldo geboekt');
  assert.equal(b1.bonSaldo, 0);
  assert.equal(b1.openstaand, 3500);
  const b2 = await H('/betaal', { rekeningId: r.id, wijze: 'bon', bonCode: bon.code, bedrag: 10 });
  assert.equal(b2.status, 409, 'een lege bon betaalt niets meer');
  assert.equal((await H('/betaal', { rekeningId: r.id, wijze: 'pin' })).body.gesloten, true);
});

test('oninbaar verdwijnt niet: het krijgt een reden en blijft staan', async () => {
  const r = await rekening('Tafel 40', [{ naam: 'Weggelopen', prijs: 18 }]);
  assert.equal((await H('/oninbaar', { rekeningId: r.id })).status, 400, 'zonder reden niet');
  const uit = (await H('/oninbaar', { rekeningId: r.id, reden: 'gasten weggelopen zonder te betalen' })).body;
  assert.equal(uit.oninbaar.centen, 1800);
  const na = (await H('/rekening', { rekeningId: r.id })).body.rekening;
  assert.equal(na.status, 'oninbaar');
  assert.match(na.oninbaar.reden, /weggelopen/);
});

test('offline: dezelfde bon twee keer insturen levert een keer omzet, en dat wordt gezegd', async () => {
  const pakket = { bonnen: [
    { clientId: 'kassa-bar-1', kanaal: 'bar', at: '2026-08-04T22:14:00.000Z', betaald: true, wijze: 'contant',
      regels: [{ naam: 'Bier', aantal: 4, prijs: 5.5 }] },
    { clientId: 'kassa-bar-2', kanaal: 'bar', at: '2026-08-04T22:16:00.000Z', betaald: true, wijze: 'pin',
      regels: [{ naam: 'Wijn', aantal: 2, prijs: 8 }] }
  ] };
  const eerste = (await H('/offline/sync', pakket)).body;
  assert.equal(eerste.nieuw, 2);
  assert.equal(eerste.dubbel, 0);
  assert.equal(eerste.bonnen[0].centen, 2200);

  const nogeens = (await H('/offline/sync', pakket)).body;
  assert.equal(nogeens.nieuw, 0);
  assert.equal(nogeens.dubbel, 2, 'de tweede keer wordt geteld, niet stil genegeerd');
  assert.match(nogeens.let, /al binnen/);

  // de offline bon draagt zijn eigen tijdstip, niet dat van de synchronisatie
  const lijst = (await H('/rekeningen', { status: 'betaald', kanaal: 'bar' })).body;
  const offline = lijst.rekeningen.find(x => x.geopendAt === '2026-08-04T22:14:00.000Z');
  assert.ok(offline, 'het tijdstip van de storing blijft staan');
});

test('happy hour rekent op het moment van bestellen, niet bij het afrekenen', async () => {
  await H('/instel', { happy: [{ naam: 'Borreluur', van: '00:00', tot: '23:59', groepen: ['bier'], procent: 50 }] });
  const r = await rekening('Tafel 50', [
    { naam: 'Pils', prijs: 6, groep: 'bier' }, { naam: 'Kaasplank', prijs: 12, groep: 'keuken' }
  ]);
  assert.equal(r.regels[0].centen, 300, 'het biertje is gehalveerd');
  assert.match(r.regels[0].happy, /Borreluur/);
  assert.equal(r.regels[0].lijstprijs, 600, 'de lijstprijs blijft zichtbaar op de bon');
  assert.equal(r.regels[1].centen, 1200, 'de kaasplank valt buiten de groep');

  // het uur voorbij: de al bestelde regel verandert niet meer
  await H('/instel', { happy: [] });
  const na = (await H('/rekening', { rekeningId: r.id })).body.rekening;
  assert.equal(na.regels[0].centen, 300, 'een bestelde prijs verandert nooit meer');
});

test('een regel eraf kan zolang de keuken er niet aan begonnen is, en een bon is op te vragen', async () => {
  const r = await rekening('Tafel 61', [{ naam: 'Oesters', prijs: 3.5, aantal: 6, gang: 1 }, { naam: 'Brood', prijs: 4, gang: 1 }]);
  const brood = r.regels.find(x => x.naam === 'Brood');

  const raar = await H('/rekening/regel/weg', { rekeningId: r.id, regelId: 'bestaat-niet' });
  assert.equal(raar.status, 404);

  const weg = (await H('/rekening/regel/weg', { rekeningId: r.id, regelId: brood.id })).body;
  assert.equal(weg.rekening.regels.length, 1, 'het brood staat er niet meer op');
  assert.equal(weg.rekening.totalen.netto, 2100, 'en telt ook niet meer mee (6 x 3,50)');

  // zodra de zaal de gang vrijgeeft en de keuken begint, kan het niet meer stilletjes
  const oesters = weg.rekening.regels[0];
  await H('/gang/vrij', { rekeningId: r.id, gang: 1 });
  await H('/keuken/stand', { rekeningId: r.id, regelId: oesters.id, stand: 'gestart' });
  const laat = await H('/rekening/regel/weg', { rekeningId: r.id, regelId: oesters.id });
  assert.equal(laat.status, 409);
  assert.match(laat.body.error, /derving/, 'wat de keuken al maakt, verdwijnt alleen met een reden');
});

test('een cadeaubon is op te vragen zonder hem te verzilveren, en een onbekende code bestaat niet', async () => {
  const bon = (await H('/bon/maak', { soort: 'cadeaubon', bedrag: 50, naam: 'Voor Sanne' })).body.bon;
  assert.equal(bon.saldo, 5000);

  const leeg = await H('/bon/maak', { bedrag: 0 });
  assert.equal(leeg.status, 400, 'een bon zonder bedrag is geen bon');

  const gezien = (await H('/bon', { bonCode: bon.code.toLowerCase() })).body;
  assert.equal(gezien.bon.saldo, 5000, 'de code is hoofdletterongevoelig');
  assert.equal(gezien.bon.soort, 'cadeaubon');
  assert.ok(!('geheim' in gezien.bon), 'opvragen verzilvert niets en geeft niets extra prijs');

  const onbekend = await H('/bon', { bonCode: 'BESTAATNIET' });
  assert.equal(onbekend.status, 404);

  // opvragen verandert het saldo niet
  const nogmaals = (await H('/bon', { bonCode: bon.code })).body;
  assert.equal(nogmaals.bon.saldo, 5000);
});
