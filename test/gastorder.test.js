/* RTG HOSPITALITY GUEST OS -- de gastkant van de horecatoren.

   WAT DIT BESTAND BEWAAKT, en waarom juist deze dingen. De gastkant zet regels
   op DEZELFDE rekening die de bediening ziet. Dat maakt drie soorten fouten
   mogelijk die geen enkele foutmelding geven, en die staan hier alle drie als
   toets:

   1. EEN TWEEDE ADMINISTRATIE. Als een gastbestelling in een eigen opslag zou
      landen, ziet de zaak hem niet en klopt de omzet niet. De toets bestelt als
      gast en leest hem terug via de LEVERANCIERSROUTE -- dezelfde rij of geen
      geslaagde toets.
   2. EEN PRIJS UIT DE TELEFOON. Wie het bedrag mag meesturen, mag zijn eigen
      korting verzinnen. De toets stuurt een eigen prijs mee en eist dat de
      kaartprijs wint.
   3. EEN BELOFTE ZONDER GRENDEL. "Een ernstige allergie gaat eerst langs een
      medewerker" is pas waar als de keuken er ook echt niet aan mag beginnen.
      De toets kijkt op het KEUKENBORD of de regel er weg blijft.

   Verder: de somdiscipline van het splitsen (10,00 door drie is 3,34+3,33+3,33)
   en de idempotentie (twee keer bestellen met dezelfde sleutel is een keer
   bestellen). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');

let BASE, child, ZAAK;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-gast-'));
const post = (pad, body, token) => fetch(BASE + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  ({ child, base: BASE } = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' } }));
  const roster = (await post('/api/supplier/roster', { code: 'KIKUNOI' })).body;
  const mgr = roster.staff.find(x => x.role === 'manager') || roster.staff[0];
  ZAAK = (await post('/api/supplier/login', { code: 'KIKUNOI', staffId: mgr.id, pin: '1234' })).body.token;
  assert.ok(ZAAK, 'de zaak-inlog werkt');
});
test.after(() => {
  if (child) try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

/* Elke toets krijgt zijn EIGEN tafel. Anders erven ze elkaars open rekening --
   per tafel is er hooguit een -- en dan slaagt een toets om de verkeerde reden
   of zakt hij door de buurman. */
let tafelTeller = 0;
async function opstelling() {
  const tafel = 'Tafel ' + (++tafelTeller);
  const qr = await post('/api/supplier/horeca/gast/qr', { tafel }, ZAAK);
  assert.equal(qr.status, 200, 'de zaak moet een QR voor een tafel kunnen uitgeven');
  return { zaak: ZAAK, token: qr.body.token, tafel };
}

test('de QR wijst een tafel aan, en een onbekende code doet dat niet', async () => {
  const { token, tafel } = await opstelling();
  const goed = await post('/api/gast/tafel', { token });
  assert.equal(goed.status, 200);
  assert.equal(goed.body.tafel, tafel);
  assert.ok(goed.body.kaart.length > 0, 'de kaart van de zaak hoort mee te komen');
  assert.ok(goed.body.kaart.every(k => typeof k.centen === 'number'), 'elke kaartregel draagt een prijs in centen');

  const fout = await post('/api/gast/tafel', { token: 'zomaarwatlettersxx' });
  assert.equal(fout.status, 404);
  assert.equal(fout.body.code, 'qr-onbekend');
});

test('een gastbestelling komt op dezelfde rekening die de zaak ziet, en de prijs komt van de kaart', async () => {
  const { zaak, token, tafel } = await opstelling();
  const zicht = await post('/api/gast/tafel', { token });
  const item = zicht.body.kaart.find(k => !k.alcohol && !k.uitverkocht);

  const aan = await post('/api/gast/aanschuiven', { token, naam: 'Sam' });
  assert.equal(aan.status, 200);
  const sleutel = aan.body.sleutel;
  assert.ok(sleutel && sleutel.length >= 24, 'aanschuiven levert een tafelsleutel');
  assert.equal(aan.body.ik.handle, 'Sam');

  /* De telefoon stuurt een eigen prijs mee. Die hoort genegeerd te worden:
       de kaart van de zaak bepaalt wat iets kost. */
  const best = await post('/api/gast/bestel', {
      sleutel, items: [{ itemId: item.id, aantal: 2, centen: 1 }] });
  assert.equal(best.status, 200, JSON.stringify(best.body).slice(0, 200));
  assert.equal(best.body.toegevoegd, 1);
  assert.equal(best.body.centen, item.centen * 2,
      'de prijs komt van de kaart en niet uit de telefoon');

  /* En nu het punt van deze hele laag: ziet de ZAAK dezelfde regel? */
  const lijst = await post('/api/supplier/horeca/rekeningen', { status: 'open' }, zaak);
  const opTafel = lijst.body.rekeningen.find(r => r.tafel === tafel);
  assert.ok(opTafel, 'de gastrekening hoort in de lijst van de zaak te staan');
  assert.equal(opTafel.regels, 1);
  assert.equal(opTafel.totalen.netto, item.centen * 2,
      'de zaak telt hetzelfde bedrag als de gast ziet');
});

test('twee keer bestellen met dezelfde sleutel is een keer bestellen', async () => {
  const { token, tafel } = await opstelling();
  const zicht = await post('/api/gast/tafel', { token });
  const item = zicht.body.kaart.find(k => !k.alcohol && !k.uitverkocht);
  const { body: aan } = await post('/api/gast/aanschuiven', { token, naam: 'Noor' });

  const een = await post('/api/gast/bestel', { sleutel: aan.sleutel, idem: 'abc-123',
      items: [{ itemId: item.id, aantal: 1 }] });
  const twee = await post('/api/gast/bestel', { sleutel: aan.sleutel, idem: 'abc-123',
      items: [{ itemId: item.id, aantal: 1 }] });
  assert.equal(een.status, 200);
  assert.equal(twee.status, 200);
  assert.equal(twee.body.herhaald, true, 'de tweede keer wordt herkend als dezelfde handeling');

  const rek = await post('/api/gast/rekening', { sleutel: aan.sleutel });
  assert.equal(rek.body.rekening.regels.length, 1,
      'er hoort een regel op de rekening te staan, niet twee');
});

test('een ernstige allergie gaat langs een medewerker, en de keuken mag er niet aan beginnen', async () => {
  const { zaak, token, tafel } = await opstelling();
  const zicht = await post('/api/gast/tafel', { token });
  const item = zicht.body.kaart.find(k => !k.alcohol && !k.uitverkocht);
  const { body: aan } = await post('/api/gast/aanschuiven', { token, naam: 'Rik' });

  const best = await post('/api/gast/bestel', { sleutel: aan.sleutel,
      allergie: 'ernstige notenallergie', items: [{ itemId: item.id, aantal: 1 }] });
  assert.equal(best.status, 200, 'de bestelling wordt niet geweigerd, hij wacht');
  assert.ok(best.body.bevestiging, 'er hoort een bevestiging gevraagd te worden');
  assert.equal(best.body.bevestiging.code, 'allergie-ernstig');

  // de zaal geeft de gang vrij; zonder de grendel zou de keuken nu beginnen
  const rekId = best.body.rekening.rekeningId;
  await post('/api/supplier/horeca/gang/vrij', { rekeningId: rekId, gang: 0 }, zaak);
  const bord1 = await post('/api/supplier/horeca/keuken/bord', {}, zaak);
  const opBord = (b) => (b.body.bonnen || []).filter(x => x.rekeningId === rekId);
  assert.equal(opBord(bord1).length, 0,
      'zolang niemand heeft bevestigd, hoort deze regel NIET op het keukenbord te staan');

  // de wachtrij van de zaak toont hem wel, met de reden erbij
  const wacht = await post('/api/supplier/horeca/gast/wachtrij', {}, zaak);
  assert.equal(wacht.body.aantal, 1);
  assert.equal(wacht.body.wachtrij[0].allergie, 'ernstige notenallergie');

  // na bevestiging staat hij er wel
  const regelId = wacht.body.wachtrij[0].regelId;
  const bev = await post('/api/supplier/horeca/gast/bevestig', { rekeningId: rekId, regelId, akkoord: true }, zaak);
  assert.equal(bev.status, 200);
  const bord2 = await post('/api/supplier/horeca/keuken/bord', {}, zaak);
  assert.equal(opBord(bord2).length, 1, 'na bevestiging hoort de keuken hem wel te zien');
});

test('afwijzen kan niet zonder reden, en de gast leest die reden', async () => {
  const { zaak, token, tafel } = await opstelling();
  const zicht = await post('/api/gast/tafel', { token });
  const item = zicht.body.kaart.find(k => !k.alcohol && !k.uitverkocht);
  const { body: aan } = await post('/api/gast/aanschuiven', { token, naam: 'Ines' });
  const best = await post('/api/gast/bestel', { sleutel: aan.sleutel,
      allergie: 'schaaldieren, ernstig', items: [{ itemId: item.id, aantal: 1 }] });
  const rekId = best.body.rekening.rekeningId;
  const wacht = await post('/api/supplier/horeca/gast/wachtrij', {}, zaak);
  const regelId = wacht.body.wachtrij[0].regelId;

  const zonder = await post('/api/supplier/horeca/gast/bevestig',
      { rekeningId: rekId, regelId, akkoord: false }, zaak);
  assert.equal(zonder.status, 400, 'afwijzen zonder reden hoort niet te kunnen');

  const met = await post('/api/supplier/horeca/gast/bevestig',
      { rekeningId: rekId, regelId, akkoord: false, reden: 'De saus bevat garnalenpasta.' }, zaak);
  assert.equal(met.status, 200);
  const rek = await post('/api/gast/rekening', { sleutel: aan.sleutel });
  assert.equal(rek.body.rekening.regels.length, 0, 'de afgewezen regel gaat van de rekening af');
});

test('uitverkocht is uitverkocht, en de gast krijgt te horen waarom', async () => {
  const { zaak, token, tafel } = await opstelling();
  const zicht = await post('/api/gast/tafel', { token });
  const item = zicht.body.kaart.find(k => !k.alcohol && !k.uitverkocht);
  const { body: aan } = await post('/api/gast/aanschuiven', { token, naam: 'Bo' });

  await post('/api/supplier/horeca/gast/uitverkocht', { itemId: item.id, uit: true }, zaak);
  const best = await post('/api/gast/bestel', { sleutel: aan.sleutel, items: [{ itemId: item.id, aantal: 1 }] });
  assert.equal(best.status, 409);
  assert.equal(best.body.code, 'uitverkocht');
  assert.match(best.body.error, /uitverkocht/i);

  const waarom = await post('/api/gast/waarom', { sleutel: aan.sleutel, itemId: item.id });
  const overDit = waarom.body.antwoorden.find(a => a.code === 'uitverkocht');
  assert.ok(overDit, 'de waarom-route hoort dezelfde reden te geven als de weigering');

  /* En weer terugzetten. De toetsen delen een zaak, en "uitverkocht" is een
     eigenschap van de ZAAK en niet van deze tafel -- laten staan liet de
     tijdlijn-toets hieronder zakken op een gerecht dat er niet meer was. Een
     toets die de wereld vuil achterlaat, laat de volgende om de verkeerde
     reden zakken. */
  await post('/api/supplier/horeca/gast/uitverkocht', { itemId: item.id, uit: false }, zaak);
});

test('alcohol kan een gast niet zelf openzetten door een leeftijd te beweren', async () => {
  const { token, tafel } = await opstelling();
  const zicht = await post('/api/gast/tafel', { token });
  const drank = zicht.body.kaart.find(k => k.alcohol);
  assert.ok(drank, 'de demozaak hoort iets met alcohol op de kaart te hebben');
  // de gast beweert dat hij 40 is
  const { body: aan } = await post('/api/gast/aanschuiven', { token, naam: 'Cas', leeftijd: 40 });
  const best = await post('/api/gast/bestel', { sleutel: aan.sleutel, items: [{ itemId: drank.id, aantal: 1 }] });
  assert.equal(best.status, 409);
  assert.equal(best.body.code, 'leeftijd',
      'een beweerde leeftijd hoort de alcoholdeur niet te openen; alleen een geverifieerde');
});

test('gelijk delen verliest geen cent: 10,00 door drie is 3,34 + 3,33 + 3,33', async () => {
  const { zaak, token, tafel } = await opstelling();
  const { body: a } = await post('/api/gast/aanschuiven', { token, naam: 'Een' });
  const { body: b } = await post('/api/gast/aanschuiven', { token, naam: 'Twee' });
  await post('/api/gast/aanschuiven', { token, naam: 'Drie' });

  /* Precies 10,00 op de rekening zetten doet de ZAAK, want de kaartprijzen
       zijn wat ze zijn. Dat mag: het gaat hier om de verdeling, niet om wie
       heeft besteld. */
  const rekId = (await post('/api/gast/rekening', { sleutel: a.sleutel })).body.rekening.rekeningId;
  await post('/api/supplier/horeca/rekening/regel',
      { rekeningId: rekId, naam: 'Tafelwater', centen: 1000, aantal: 1 }, zaak);

  const verd = await post('/api/gast/verdeel', { sleutel: a.sleutel, wijze: 'gelijk' });
  assert.equal(verd.status, 200, JSON.stringify(verd.body).slice(0, 200));
  const centen = verd.body.delen.map(d => d.centen).sort((x, y) => y - x);
  assert.deepEqual(centen, [334, 333, 333]);
  assert.equal(centen.reduce((t, x) => t + x, 0), 1000, 'de delen tellen exact op tot het geheel');
  assert.ok(verd.body.delen.some(d => d.ik), 'de gast ziet welk deel van hem is');

  // en met een fooi erbij klopt de som nog steeds
  await post('/api/gast/fooi', { sleutel: b.sleutel, centen: 500 });
  const verd2 = await post('/api/gast/verdeel', { sleutel: a.sleutel, wijze: 'gelijk' });
  assert.equal(verd2.body.delen.reduce((t, d) => t + d.centen, 0), 1500,
      'na een fooi van 5,00 verdelen we 15,00 en geen cent minder');
});

test('een verdeling die niet optelt wordt geweigerd in plaats van rechtgetrokken', async () => {
  const { zaak, token, tafel } = await opstelling();
  const { body: a } = await post('/api/gast/aanschuiven', { token, naam: 'Een' });
  const { body: b } = await post('/api/gast/aanschuiven', { token, naam: 'Twee' });
  const rekId = (await post('/api/gast/rekening', { sleutel: a.sleutel })).body.rekening.rekeningId;
  await post('/api/supplier/horeca/rekening/regel',
      { rekeningId: rekId, naam: 'Tafelwater', centen: 1000, aantal: 1 }, zaak);

  const scheef = await post('/api/gast/verdeel', { sleutel: a.sleutel, wijze: 'persoon',
      delen: [{ nr: 1, centen: 400 }, { nr: 2, centen: 400 }] });
  assert.equal(scheef.status, 409);
  assert.match(scheef.body.error, /8,00.*10,00|niets gewijzigd/);

  const perc = await post('/api/gast/verdeel', { sleutel: b.sleutel, wijze: 'percentage',
      delen: [{ nr: 1, procent: 60 }, { nr: 2, procent: 30 }] });
  assert.equal(perc.status, 400, 'percentages die niet op 100 uitkomen horen te worden geweigerd');
});

test('afrekenen doet alleen wat er echt kan, en zegt wat er niet kan', async () => {
  const { zaak, token, tafel } = await opstelling();
  const { body: a } = await post('/api/gast/aanschuiven', { token, naam: 'Sam' });
  const rekId = (await post('/api/gast/rekening', { sleutel: a.sleutel })).body.rekening.rekeningId;
  await post('/api/supplier/horeca/rekening/regel',
      { rekeningId: rekId, naam: 'Tafelwater', centen: 1000, aantal: 1 }, zaak);

  // kaart en online bestaan hier niet vanaf de telefoon: dat wordt gezegd
  const pin = await post('/api/gast/betaal', { sleutel: a.sleutel, wijze: 'pin' });
  assert.equal(pin.status, 501);
  assert.equal(pin.body.code, 'rail-ontbreekt');
  assert.deepEqual(pin.body.rails, ['bon', 'tegoed', 'kamer']);

  // met een echte cadeaubon van de zaak lukt het wel, en dan is hij ook echt betaald
  const bon = await post('/api/supplier/horeca/bon/maak', { soort: 'cadeaubon', centen: 1000 }, zaak);
  const bonCode = bon.body.bon.code;
  const betaal = await post('/api/gast/betaal', { sleutel: a.sleutel, wijze: 'bon', bonCode });
  assert.equal(betaal.status, 200, JSON.stringify(betaal.body).slice(0, 200));
  assert.equal(betaal.body.gesloten, true);
  assert.equal(betaal.body.openstaand, 0);

  // en de zaak ziet hem als betaald, niet als open
  const open = await post('/api/supplier/horeca/rekeningen', { status: 'open' }, zaak);
  assert.ok(!open.body.rekeningen.some(r => r.id === rekId), 'de rekening staat niet meer open bij de zaak');

  // de sessie is daarna niets meer waard
  const na = await post('/api/gast/rekening', { sleutel: a.sleutel });
  assert.equal(na.status, 401, 'een tafelsessie vervalt zodra de rekening voldaan is');
});

test('de tijdlijn van de gast volgt de keuken, zonder een tweede administratie', async () => {
  const { zaak, token, tafel } = await opstelling();
  const zicht = await post('/api/gast/tafel', { token });
  const item = zicht.body.kaart.find(k => !k.alcohol && !k.uitverkocht);
  const { body: aan } = await post('/api/gast/aanschuiven', { token, naam: 'Sam' });
  const best = await post('/api/gast/bestel', { sleutel: aan.sleutel, items: [{ itemId: item.id, aantal: 1 }] });
  const rekId = best.body.rekening.rekeningId;
  const regelId = best.body.rekening.regels[0].id;

  await post('/api/supplier/horeca/gang/vrij', { rekeningId: rekId, gang: 0 }, zaak);
  await post('/api/supplier/horeca/keuken/stand', { rekeningId: rekId, regelId, stand: 'gestart' }, zaak);
  await post('/api/supplier/horeca/keuken/stand', { rekeningId: rekId, regelId, stand: 'klaar' }, zaak);

  const log = await post('/api/gast/logboek', { sleutel: aan.sleutel });
  const watten = log.body.tijdlijn.map(t => t.wat);
  assert.ok(watten.includes('Bestelling ontvangen'));
  assert.ok(watten.includes('De keuken is begonnen'), 'wat de keuken doet, ziet de gast');
  assert.ok(watten.includes('Klaar in de keuken'));
  assert.ok(log.body.logboek.some(a => a.wat === 'regel-erop'), 'de audit legt de bestelling vast');
});

/* ---- HORECA.md grens 7, op de kant waar het het meest telt ----------------
   De servicebalk op de telefoon van de gast liep op vaste percentages
   (10 / 28 / 34 / 50 / 68 / 82 / 100) die uit een toestandslabel kwamen. Een
   gast kijkt naar die balk om te weten hoe ver zijn avond is, en hij zei niets.
   Nu draagt de stap een BREUK die de gast kan natellen aan zijn eigen tafel. */
test('de servicebalk van de gast draagt een breuk, geen verzonnen percentage', async () => {
  const { zaak, token } = await opstelling();
  const zicht = await post('/api/gast/tafel', { token });
  const item = zicht.body.kaart.find(k => !k.alcohol && !k.uitverkocht);
  const { body: aan } = await post('/api/gast/aanschuiven', { token, naam: 'Kim' });

  // nog niets besteld: geen breuk, en dus geen balk
  const leeg = await post('/api/gast/rekening', { sleutel: aan.sleutel });
  assert.equal(leeg.body.rekening.service.voortgang, undefined, 'geen percentage meer');
  assert.deepEqual(leeg.body.rekening.service.geserveerd, { uitgegeven: 0, besteld: 0 },
      'nul van nul: het scherm hoort hier geen balk te tekenen');

  const best = await post('/api/gast/bestel', { sleutel: aan.sleutel, items: [{ itemId: item.id, aantal: 2 }] });
  const rekId = best.body.rekening.rekeningId;
  const regelId = best.body.rekening.regels[0].id;

  const besteld = await post('/api/gast/rekening', { sleutel: aan.sleutel });
  assert.equal(besteld.body.rekening.service.geserveerd.besteld, 1, 'een regel op de rekening');
  assert.equal(besteld.body.rekening.service.geserveerd.uitgegeven, 0, 'en er staat nog niets');

  await post('/api/supplier/horeca/gang/vrij', { rekeningId: rekId, gang: 0 }, zaak);
  await post('/api/supplier/horeca/keuken/stand', { rekeningId: rekId, regelId, stand: 'klaar' }, zaak);
  await post('/api/supplier/horeca/keuken/stand', { rekeningId: rekId, regelId, stand: 'uitgegeven' }, zaak);

  const na = await post('/api/gast/rekening', { sleutel: aan.sleutel });
  assert.deepEqual(na.body.rekening.service.geserveerd, { uitgegeven: 1, besteld: 1 },
      'wat op tafel staat is te tellen, en het klopt met de keuken');
  assert.equal(na.body.rekening.service.stap, 'Genieten');

  /* En de harde vorm: nergens in het gastbeeld staat nog een getal waarvan de
     naam een schaal van nul tot honderd belooft. */
  const verdacht = [];
  (function loop(x, pad) {
    if (x && typeof x === 'object') { for (const k of Object.keys(x)) loop(x[k], pad + '.' + k); return; }
    if (typeof x === 'number' && /score|procent|percent|voortgang/i.test(pad)) verdacht.push(pad + ' = ' + x);
  })(na.body.rekening, 'rekening');
  assert.deepEqual(verdacht, [], 'score-achtig getal in het gastbeeld: ' + verdacht.join(', '));
});
