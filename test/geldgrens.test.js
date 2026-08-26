/* DE EIGEN GELDGRENS -- een regel die het lid over zichzelf stelt en die echt
   weigert.

   WAAROM DEZE TOETS ER IS

   kern/geldbeleid/regels.js kent vier regelsoorten en ze WAARSCHUWEN allemaal.
   Voor die vier is dat goed. Maar een lid dat zegt "meer dan 500 euro per maand
   aan horeca wil ik niet uitgeven", vraagt niet om een melding achteraf: een
   waarschuwing die je kunt wegklikken op het moment dat je hem het hardst nodig
   hebt, is geen grens maar een geheugensteun. Deze toets gaat dus over de vraag
   of de deur werkelijk dichtgaat.

   WAT HIER WORDT NAGETROKKEN

   1. DE GRENS WEIGERT, met een 403 en de mededeling dat het zijn eigen grens is.
   2. HIJ IS NIET TE OMZEILEN DOOR UIT EEN ANDER POTJE TE BETALEN. Een
      persoonlijke grens geldt over alles wat het lid heeft, niet per positie.
      Dit is de fout die het makkelijkst ongemerkt ontstaat.
   3. ONDER DE GRENS GAAT ALLES GEWOON DOOR.
   4. STRENGER WERKT METEEN, SOEPELER KAN WACHTEN. Met een bedenktijd erop is de
      versoepeling geparkeerd en geldt de oude grens onverkort -- ook als je de
      grens probeert weg te gooien in plaats van te verhogen.
   5. ZONDER GRENS VERANDERT ER NIETS.

   Draai los: node --experimental-sqlite --test test/geldgrens.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, lid, sup;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-grens-'));
const api = (pad, body, token) => fetch(base + '/api/' + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

const code = (max) => api('pay/kascode', { maxCenten: max }, lid.token).then(r => r.body.code);
const betaal = (centen, idem) => code(100000).then(c => api('supplier/pay/in', { code: c, centen, idem }, sup.token));
const zetGrens = (g) => api('geld/grens/zet', g, lid.token);

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const d = await (await fetch(base + '/api/login', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier: 'rtg' }) })).json();
  lid = { token: d.token, codenaam: (await api('pay/overzicht', {}, d.token)).body.codenaam };
  const s = await (await fetch(base + '/api/supplier/login', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'rahul', password: 'Imran' }) })).json();
  sup = { token: s.token, code: s.state.supplier.code, genre: s.state.supplier.type };
  await api('pay/oplaad', { centen: 40000, idem: 'gr-start' }, lid.token);
  /* De zaak moet zelf omzet hebben om later budget te kunnen uitdelen -- en die
     omzet komt van een ANDER lid. Zou het testlid de zaak zelf voeden, dan telt
     dat mee in zijn eigen dagteller en meet deze toets iets anders dan hij
     beweert te meten. */
  /* Let op de PAS: de demo-inlog geeft per pas dezelfde codenaam terug, dus twee
     keer 'rtg' inloggen levert twee sessies van hetzelfde lid. Dan telt de omzet
     van de zaak mee in de dagteller van het testlid en meet deze toets iets
     anders dan hij beweert. */
  const f = await (await fetch(base + '/api/login', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier: 'lifestyle' }) })).json();
  await api('pay/oplaad', { centen: 20000, idem: 'gr-f' }, f.token);
  const c0 = await api('pay/kascode', { maxCenten: 100000 }, f.token);
  await api('supplier/pay/in', { code: c0.body.code, centen: 15000, idem: 'gr-omzet' }, sup.token);
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

test('zonder grens verandert er niets', async () => {
  const r = await betaal(1000, 'g0');
  assert.equal(r.status, 200, 'gewoon betalen werkt');
  assert.deepEqual((await api('geld/grens', {}, lid.token)).body.grenzen, []);
});

test('de grens weigert echt, en zegt dat het je eigen grens is', async () => {
  const g = await zetGrens({ periode: 'dag', centen: 2000 });
  assert.equal(g.status, 200, 'het lid stelt een daggrens van 20 euro');

  // er is vandaag al 10 euro betaald, dus 5 mag nog wel
  const mag = await betaal(500, 'g1');
  assert.equal(mag.status, 200, 'binnen de grens gaat alles door');

  // en 10 erbij komt over de 20
  const niet = await betaal(1000, 'g2');
  assert.equal(niet.status, 403, 'over de eigen grens gaat de deur dicht');
});

test('de ZAAK hoort niet waarom, het LID wel', async () => {
  /* De reden van een weigering is een privégegeven van het lid: dat hij zichzelf
     een daglimiet oplegde, dat zijn wallet tegen het plafond zit, dat een andere
     zaak een borg heeft vastgezet. Een pinautomaat vertelt de winkelier ook niet
     waarom de bank nee zei. */
  const bijZaak = await betaal(1000, 'g2b');
  assert.equal(bijZaak.status, 403);
  assert.equal(bijZaak.body.reden, undefined, 'de kassa krijgt geen reden te zien');
  assert.equal(bijZaak.body.error, 'Deze betaling is geweigerd.', 'alleen een generiek antwoord');

  // hetzelfde bedrag, maar nu betaalt het LID zelf (aan een ander lid)
  const d2 = await (await fetch(base + '/api/login', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier: 'lifestyle' }) })).json();
  const ander = (await api('pay/overzicht', {}, d2.token)).body.codenaam;
  assert.notEqual(ander, lid.codenaam, 'een ander lid, en niet dezelfde met een tweede sessie');
  const bijLid = await api('pay/stuur', { aan: ander, centen: 1000, idem: 'g2c' }, lid.token);
  assert.equal(bijLid.status, 403);
  assert.equal(bijLid.body.reden, 'eigen', 'het lid leest dat het zijn eigen grens is');
  assert.equal(bijLid.body.opheffbaar, true, 'en dat hij hem zelf kan opheffen');
  assert.equal(bijLid.body.eigenGrens, 'dagmaximum', 'en wélke grens');
});

test('de grens is niet te omzeilen door uit een ander potje te betalen', async () => {
  /* Dit is de fout die het makkelijkst ongemerkt ontstaat: de grens hangt aan de
     wallet in plaats van aan de persoon, en dan betaal je gewoon uit je budget
     verder. */
  const b = await api('supplier/pay/budget', { aan: lid.codenaam, klasse: 'EMPLOYER_BUDGET',
    centen: 5000, oms: 'Budget', idem: 'gr-b' }, sup.token);
  assert.equal(b.status, 200, 'de zaak geeft het lid 50 euro budget');

  const p = await api('pay/portefeuille', {}, lid.token);
  assert.equal(p.body.posities.length, 2, 'het lid heeft nu twee potjes');

  const uitBudget = await betaal(1000, 'g3');
  assert.equal(uitBudget.status, 403, 'ook uit het budget gaat de deur dicht');
});

test('strenger werkt meteen; met bedenktijd wordt soepeler geparkeerd', async () => {
  const lijst = (await api('geld/grens', {}, lid.token)).body.grenzen;
  const id = lijst[0].id;

  // strenger: meteen
  const strak = await zetGrens({ id, centen: 1000, bedenktijdUren: 24 });
  assert.equal(strak.status, 200);
  assert.ok(!strak.body.geparkeerd, 'strenger gaat meteen in, ook met bedenktijd erop');

  // soepeler: geparkeerd
  const ruim = await zetGrens({ id, centen: 50000 });
  assert.equal(ruim.status, 200);
  assert.equal(ruim.body.geparkeerd, true, 'de versoepeling staat klaar maar geldt nog niet');
  assert.ok(ruim.body.grens.wachtTot > Date.now(), 'en het lid ziet wanneer hij ingaat');

  const nog = await betaal(1000, 'g4');
  assert.equal(nog.status, 403, 'tot dat moment geldt de oude grens onverkort');
});

test('een tweede versoepeling stapelt niet: de lopende bedenktijd geldt', async () => {
  /* De grens uit de vorige toets heeft al een versoepeling klaarstaan. Wie dan
     alsnog probeert hem wég te gooien, moet niet stilletjes vooraan in de rij
     komen -- anders is de bedenktijd te omzeilen door hem twee keer op een
     andere manier te vragen. */
  const id = (await api('geld/grens', {}, lid.token)).body.grenzen.find(g => g.wachtTot).id;
  const weg = await api('geld/grens/weg', { id }, lid.token);
  assert.equal(weg.status, 409, 'de lopende bedenktijd wint');
  assert.equal((await api('geld/grens', {}, lid.token)).body.grenzen.some(g => g.id === id), true, 'de grens staat er nog');
});

test('weggooien is de sterkste versoepeling en loopt langs dezelfde bedenktijd', async () => {
  /* Zonder deze regel is de bedenktijd te omzeilen door de grens niet te
     verhogen maar weg te gooien -- en dan is hij geen bedenktijd. Een VERSE
     grens, zodat er geen versoepeling van een eerdere toets in de weg staat. */
  const g = await zetGrens({ periode: 'maand', centen: 30000, bedenktijdUren: 48 });
  assert.equal(g.status, 200);
  const id = g.body.grens.id;

  const weg = await api('geld/grens/weg', { id }, lid.token);
  assert.equal(weg.status, 200);
  assert.equal(weg.body.geparkeerd, true, 'ook weggooien wacht');
  assert.ok(weg.body.wachtTot > Date.now());

  assert.equal((await api('geld/grens', {}, lid.token)).body.grenzen.some(x => x.id === id), true,
    'de grens staat er nog en blijft gelden tot de bedenktijd om is');
  const nogmaals = await api('geld/grens/weg', { id }, lid.token);
  assert.equal(nogmaals.status, 409, 'nog een keer proberen versnelt niets');
});

test('een grens zonder bedenktijd is meteen weg -- dat is de standaard', async () => {
  /* Met opzet de zwakkere stand. RTG is geen kansspelaanbieder, en een
     betaalgrens die iemand in het buitenland laat stranden is erger dan een
     impulsaankoop. Wie de sterkere versie wil, kiest hem. */
  const nieuw = await zetGrens({ periode: 'maand', centen: 100 });
  assert.equal(nieuw.status, 200);
  assert.equal(nieuw.body.grens.bedenktijdUren, 0, 'standaard geen bedenktijd');
  const weg = await api('geld/grens/weg', { id: nieuw.body.grens.id }, lid.token);
  assert.equal(weg.status, 200);
  assert.ok(!weg.body.geparkeerd, 'en dan is hij meteen weg');
});
