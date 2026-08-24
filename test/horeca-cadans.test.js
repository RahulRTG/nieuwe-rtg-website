/* RTG Horeca: de cadans -- terugrekenen vanaf het serveermoment.

   Wat hier bewezen wordt, en waarom juist dat:

   1. HET LANGZAAMSTE GERECHT BEGINT HET EERST. Dat is de hele reden dat deze
      laag bestaat: een gang komt alleen samen de deur uit als de starttijden
      uit elkaar lopen. Loopt die volgorde niet, dan is het een gewone lijst.
   2. EEN AFSPRAAK WINT VAN EEN AFLEIDING, EN ZEGT DAT. Gaf de zaal een
      serveertijd door, dan is dat de tijd. Anders leiden we hem af -- en het
      scherm hoort te weten welke van de twee het was, want een afgeleide tijd
      is geen belofte aan een gast.
   3. DE VIER BANEN VOLGEN UIT DE GETALLEN. Niet uit een label, niet uit een
      kleur: uit het startmoment en de norm.
   4. EEN GANG DIE OM 02:15 MOET, IS NIET VIJFTIEN UUR TE LAAT. Een club
      serveert 's nachts; een naieve tijdrekening zet zo'n bon meteen op rood.
   5. HET BORD DRAAGT DE CADANS ZONDER EEN BESTAAND VELD TE VERANDEREN.

   Draai: node --experimental-sqlite --test test/horeca-cadans.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { startServer } = require('./helper');
const cadans = require('../server/kern/horeca/cadans');

const MIN = 60000;
// een zaak zonder eigen bereidingstijden: de standaarden van keukenlaag.js gelden
const ZAAK = () => ({ instel: {}, rekeningen: {} });
const hhmm = (iso) => { const d = new Date(iso); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };

/* Een rekening met een gang eraan. `vrij` is het moment van vrijgeven; de
   standaardtijden zijn grill 12, warm 14, koud 6 (keukenlaag.js). */
function rekening(regels, vrijMs, serveerOm) {
  return { id: 'r1', status: 'open', tafel: 'T12', kanaal: 'tafel', gasten: 4,
    regels: regels.map((r, i) => Object.assign({
      id: 'g' + i, gang: 1, aantal: 1, stand: 'besteld',
      vrijAt: new Date(vrijMs).toISOString(), serveerOm: serveerOm || null
    }, r)) };
}

test('het langzaamste gerecht begint het eerst, zodat de gang samen landt', () => {
  const nu = Date.now();
  const h = ZAAK();
  h.rekeningen.r1 = rekening([
    { naam: 'Entrecote', station: 'grill' },   // 12 min
    { naam: 'Risotto', station: 'warm' },      // 14 min
    { naam: 'Oesters', station: 'koud' }       // 6 min
  ], nu, '19:42');
  const [gang] = cadans.cadansVanRekening(h, h.rekeningen.r1, nu);

  assert.equal(gang.regels.length, 3);
  assert.equal(gang.regels[0].naam, 'Risotto', 'de langzaamste staat vooraan');
  assert.equal(gang.regels[2].naam, 'Oesters', 'de snelste achteraan');

  // pas = doel - 2 min marge; start = pas - norm
  assert.equal(hhmm(gang.passOm), '19:40');
  assert.equal(hhmm(gang.regels.find(r => r.naam === 'Risotto').startOm), '19:26');
  assert.equal(hhmm(gang.regels.find(r => r.naam === 'Entrecote').startOm), '19:28');
  assert.equal(hhmm(gang.regels.find(r => r.naam === 'Oesters').startOm), '19:34');

  // en de som staat er in gewone woorden bij, want anders gelooft niemand hem
  assert.match(gang.regels[0].rekensom, /Klaar bij de pas om 19:40, 14 min bereiding, dus aanzetten om 19:26\./);
});

test('een afgesproken serveertijd wint van een afgeleide, en het scherm weet welke', () => {
  const nu = Date.now();
  const h = ZAAK();
  h.rekeningen.r1 = rekening([{ naam: 'Zeebaars', station: 'warm' }], nu, '20:15');
  const [met] = cadans.cadansVanRekening(h, h.rekeningen.r1, nu);
  assert.equal(met.bron, 'afspraak');
  assert.equal(hhmm(met.doelOm), '20:15');
  assert.match(met.rekensom, /De zaal gaf 20:15 door/);

  const h2 = ZAAK();
  h2.rekeningen.r1 = rekening([{ naam: 'Zeebaars', station: 'warm' }], nu);
  const [zonder] = cadans.cadansVanRekening(h2, h2.rekeningen.r1, nu);
  assert.equal(zonder.bron, 'afgeleid');
  assert.equal(Date.parse(zonder.doelOm), nu + 16 * MIN, 'vrijgave plus het langzaamste gerecht plus de pasmarge');
  assert.match(zonder.rekensom, /Geen afgesproken tijd; vrijgegeven plus 14 min .* plus 2 min bij de pas\./);

  /* En de reden dat die pasmarge er staat: zonder hem begint het langzaamste
     gerecht van een afgeleide gang VOOR het moment dat de zaal hem vrijgaf, en
     komt elke gang zonder afspraak meteen als achterstand binnen. */
  const [regel] = zonder.regels;
  assert.equal(Date.parse(regel.startOm), nu, 'het langzaamste gerecht begint precies bij de vrijgave');
  assert.equal(regel.baan, 'nu', 'en dus niet als risico');
});

test('de vier banen volgen uit de getallen, niet uit een label', () => {
  const nu = Date.now();
  const h = ZAAK();
  /* Vier gangen met een eigen doel, zodat elke baan een keer voorkomt:
     - gang 1 moest twintig minuten geleden al aan  -> risico
     - gang 2 moet nu aan                            -> nu
     - gang 3 pas over een uur                       -> hierna
     - gang 4 is klaar maar de gang is niet compleet -> wacht */
  h.rekeningen.r1 = { id: 'r1', status: 'open', tafel: 'T1', kanaal: 'tafel', gasten: 2, regels: [
    { id: 'a', gang: 1, naam: 'Laat', station: 'warm', aantal: 1, stand: 'besteld',
      vrijAt: new Date(nu - 40 * MIN).toISOString(), serveerOm: null },
    { id: 'b', gang: 2, naam: 'Nu', station: 'warm', aantal: 1, stand: 'besteld',
      vrijAt: new Date(nu - 2 * MIN).toISOString(), serveerOm: null },
    { id: 'c', gang: 3, naam: 'Later', station: 'warm', aantal: 1, stand: 'besteld',
      vrijAt: new Date(nu + 60 * MIN).toISOString(), serveerOm: null },
    { id: 'd', gang: 4, naam: 'Klaar', station: 'koud', aantal: 1, stand: 'klaar',
      vrijAt: new Date(nu - 5 * MIN).toISOString(), serveerOm: null },
    { id: 'e', gang: 4, naam: 'Nog bezig', station: 'grill', aantal: 1, stand: 'gestart',
      vrijAt: new Date(nu - 5 * MIN).toISOString(), serveerOm: null }
  ] };
  const plat = cadans.cadansVanZaak(h, nu);
  const baan = (id) => plat.find(r => r.regelId === id).baan;

  assert.equal(baan('a'), 'risico', 'het startmoment is voorbij en er staat niets aan');
  assert.equal(baan('b'), 'nu');
  assert.equal(baan('c'), 'hierna');
  assert.equal(baan('d'), 'wacht', 'klaar, maar de gang is nog niet compleet');
  assert.equal(baan('e'), 'nu', 'staat aan en loopt binnen zijn norm');

  const t = cadans.banen(plat);
  assert.deepEqual(t, { nu: 2, hierna: 1, wacht: 1, risico: 1 });
});

test('een gerecht dat over zijn eigen norm heen loopt, staat in risico', () => {
  const nu = Date.now();
  const h = ZAAK();
  h.rekeningen.r1 = { id: 'r1', status: 'open', tafel: 'T2', kanaal: 'tafel', gasten: 2, regels: [
    { id: 'x', gang: 1, naam: 'Entrecote', station: 'grill', aantal: 1, stand: 'gestart',
      startAt: new Date(nu - 20 * MIN).toISOString(), vrijAt: new Date(nu - 20 * MIN).toISOString() }
  ] };
  const [r] = cadans.cadansVanZaak(h, nu);
  assert.equal(r.loopt, 20);
  assert.equal(r.norm, 12);
  assert.equal(r.baan, 'risico', '20 van 12 minuten is te laat, ook al staat het aan');
});

test('een gang die om 02:15 moet, is niet vijftien uur te laat', () => {
  // vrijgegeven om 23:50; de serveertijd 02:15 hoort bij de nacht erna
  const avond = new Date(); avond.setHours(23, 50, 0, 0);
  const h = ZAAK();
  h.rekeningen.r1 = rekening([{ naam: 'Bittergarnituur', station: 'frituur' }], avond.getTime(), '02:15');
  const [gang] = cadans.cadansVanRekening(h, h.rekeningen.r1, avond.getTime());
  assert.equal(gang.doelOver, 145, 'twee uur en 25 minuten vooruit, niet ruim twintig uur terug');
  assert.ok(gang.doelOver > 0, 'een nachtdienst rekent vooruit');
});

test('gerechten die tegelijk moeten landen, weten van elkaar', () => {
  const nu = Date.now();
  const h = ZAAK();
  h.rekeningen.r1 = rekening([
    { naam: 'Entrecote', station: 'grill' }, { naam: 'Risotto', station: 'warm' }
  ], nu, '19:42');
  const plat = cadans.cadansVanZaak(h, nu);
  const risotto = plat.find(r => r.naam === 'Risotto');
  assert.deepEqual(risotto.samenMet, ['Entrecote'], 'de kok ziet waar zijn bord op wacht');
  assert.equal(risotto.tafel, 'T12');
});

/* ---- en dan door de echte poort, want een kloppende kern met een bord dat
   hem niet doorgeeft, is precies het gat waar deze suite eerder in liep ---- */
let BASE, child, tok;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-cadans-'));
const api = (pad, body, token) => fetch(BASE + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
const H = (pad, body) => api(pad, body, tok);

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

test('het keukenbord draagt de cadans, en verandert geen bestaand veld', async () => {
  const r = (await H('/api/supplier/horeca/rekening/open', { kanaal: 'tafel', tafel: 'C1', gasten: 2 })).body;
  await H('/api/supplier/horeca/rekening/regel', { rekeningId: r.rekening.id, naam: 'Risotto', prijs: 24, aantal: 1, gang: 1, station: 'warm' });
  await H('/api/supplier/horeca/rekening/regel', { rekeningId: r.rekening.id, naam: 'Oesters', prijs: 18, aantal: 1, gang: 1, station: 'koud' });
  await H('/api/supplier/horeca/gang/vrij', { rekeningId: r.rekening.id, gang: 1, serveerOm: '19:42' });

  const bord = (await H('/api/supplier/horeca/keuken/bord', {})).body;
  const risotto = bord.bonnen.find(b => b.naam === 'Risotto');
  const oesters = bord.bonnen.find(b => b.naam === 'Oesters');
  assert.ok(risotto && oesters, 'beide bonnen staan op het bord');

  // de oude velden staan er nog precies zo bij
  assert.equal(risotto.norm, 14);
  assert.equal(risotto.urgentie, 'op tijd');
  assert.equal(risotto.station, 'warm');
  assert.ok(Array.isArray(bord.standen) && bord.standen.includes('uitgegeven'));

  // en de cadans staat erbij
  assert.equal(hhmm(risotto.startOm), '19:26');
  assert.equal(hhmm(oesters.startOm), '19:34');
  assert.equal(hhmm(risotto.doelOm), '19:42');
  assert.deepEqual(risotto.samenMet, ['Oesters']);
  assert.ok(['nu', 'hierna', 'wacht', 'risico'].includes(risotto.baan));
  assert.ok(bord.banen && typeof bord.banen.nu === 'number', 'de kop kan de banen tellen');

  // wat het eerst aan moet, staat bovenaan
  const volgorde = bord.bonnen.filter(b => b.rekeningId === r.rekening.id).map(b => b.naam);
  assert.deepEqual(volgorde, ['Risotto', 'Oesters'], 'op startmoment gesorteerd, niet op prijs');
});
