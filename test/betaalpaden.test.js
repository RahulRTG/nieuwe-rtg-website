/* DE VIER BETAALPADEN -- een bankweigering is geen vals alarm.

   Eigenaarsbesluit (via de integrator, 19 oktober 2026): een weigering, een
   vertraging en een crash tijdens de betaling zijn geldige bedrijfssituaties,
   geen ruis die je wegfiltert. Een proef die betaalt, beproeft daarom vier
   paden, elk met een uitdrukkelijk gevraagde afloop:

     succes      betaald, afgerond, alle schakels sluiten
     weigering   geen afschrijving, geen boeking, niet leverbaar, een melding
                 met woorden, en opnieuw betalen lukt en schrijft EEN keer af
     vertraging  eerlijk "in behandeling", nooit "betaald", geen dubbele
                 afschrijving bij herhaling, en een latere bevestiging komt aan
     crash       de server sterft tussen het bankverzoek en de bevestiging; na
                 herstel eerst de echte stand, geen tweede afschrijving, geen
                 verweesde "betaald"

   scripts/lib/betaalpaden.js is het instrument; deze toets houdt het eerlijk op
   een nagemaakte wereld. Een goede wereld sluit alles. Een wereld met een fout
   laat precies die stap stuk staan. En een wereld die iets niet KAN (geen
   haak om later te bevestigen, geen crash), staat open met de reden -- nooit
   gesloten. Het afschrift telt wat de BANK deed, niet wat RTG zegt: twee
   uitslagen met dezelfde sleutel zijn een betaling, zoals bij een echte bank.

   Los: node --test test/betaalpaden.test.js */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const BP = require('../scripts/lib/betaalpaden');

/* Een nagemaakte wereld: een bank met een afschrift, objecten om te betalen,
   een grootboek. `fout` zet een bekende fout aan. */
function wereld(fout = {}) {
  const afschrift = [];
  const obj = {};
  let n = 0;
  const bank = (sleutel, afloop) => {
    const status = afloop === 'betaald' ? 'betaald' : afloop === 'traag' ? 'open' : 'geweigerd';
    afschrift.push({ soort: 'maak', sleutel, id: 'b' + afschrift.length, status });
    return status;
  };
  function vestig(o) {
    o.betaald = true; o.wacht = false; o.boekingen++;
  }
  const a = {
    async nieuw(afloop) { const ref = 'R' + (++n); obj[ref] = { afloop, poging: 0, betaald: false, wacht: false, boekingen: 0 }; return { ref }; },
    async betaal(ref) {
      const o = obj[ref];
      if (o.betaald) return { status: 200, data: { ok: true } };
      if (o.wacht) {
        if (fout.traagDubbel) bank(ref + ':' + (++o.poging), 'traag');
        if (o.bevestigd) { vestig(o); return { status: 200, data: { ok: true } }; }
        return { status: 402, data: { error: 'De betaling wacht op bevestiging.' } };
      }
      if (o.geweigerd && !fout.geenHerstel) { o.poging++; o.afloop = 'betaald'; }
      const st = bank(ref + ':' + o.poging, o.afloop);
      if (st === 'betaald') { vestig(o); if (fout.dubbeleBoeking) o.boekingen++; return { status: 200, data: { ok: true } }; }
      if (st === 'open') { o.wacht = true; if (fout.traagBetaald) o.betaald = true; return { status: 402, data: { error: 'De betaling wacht op bevestiging.' } }; }
      o.geweigerd = true;
      if (fout.weigerBoekt) o.boekingen++;
      return { status: 402, data: fout.zwijgend ? {} : { error: 'De betaling is niet gelukt. Er is niets afgeschreven.' } };
    },
    async stand(ref) { const o = obj[ref]; return { betaald: o.betaald, wacht: o.wacht, bekend: !(o.naCrash && fout.vergeten) }; },
    async lever(ref) { return { status: obj[ref].betaald || fout.leverAltijd ? 200 : 409 }; },
    async afschrift() { return afschrift.slice(); },
    async boekingen(ref) { return obj[ref].boekingen; },
    async bevestigLater(ref) { obj[ref].bevestigd = true; afschrift.push({ soort: 'haal', sleutel: ref + ':0', id: 'later', status: 'betaald' }); },
    async betaalEnCrash(ref) {
      const o = obj[ref];
      bank(ref + ':0', 'betaald');
      if (fout.weesBetaald) { o.betaald = true; return { gevraagd: true }; }
      if (fout.crashDubbel) { o.poging = 1; }
      o.naCrash = true;
      return { gevraagd: true };
    }
  };
  return { a, obj, afschrift };
}

const standen = (uit, pad) => uit.paden[pad].stappen.map((s) => s.stand);
const stap = (uit, pad, nr) => uit.paden[pad].stappen.find((s) => s.nr === nr);

test('een goede wereld sluit alle vier de paden, elke stap', async () => {
  const uit = await BP.vierPaden(wereld().a);
  for (const p of BP.PADEN) assert.ok(standen(uit, p).every((s) => s === 'gesloten'), p + ': ' + JSON.stringify(uit.paden[p].stappen, null, 1));
  assert.deepEqual(BP.PADEN, ['succes', 'weigering', 'vertraging', 'crash']);
  assert.equal(uit.paden.weigering.afloop, 'geweigerd', 'elk pad noemt de afloop die het VROEG');
  assert.equal(uit.paden.vertraging.afloop, 'traag');
  assert.equal(uit.stuk, 0); assert.equal(uit.open, 0);
});

test('weigering: geen herstelpad is stuk, en zegt het', async () => {
  const uit = await BP.vierPaden(wereld({ geenHerstel: true }).a);
  const h = stap(uit, 'weigering', 6);
  assert.equal(h.stand, 'stuk');
  assert.match(h.reden, /nieuwe poging/);
  assert.ok(standen(uit, 'weigering').slice(0, 5).every((s) => s === 'gesloten'), 'de weigering zelf is wel netjes');
  assert.ok(standen(uit, 'succes').every((s) => s === 'gesloten'), 'een fout op een pad besmet de andere niet');
});

test('weigering: een melding zonder woorden, een boeking of leverbaar zijn elk stuk', async () => {
  assert.equal(stap(await BP.vierPaden(wereld({ zwijgend: true }).a), 'weigering', 1).stand, 'stuk');
  assert.equal(stap(await BP.vierPaden(wereld({ weigerBoekt: true }).a), 'weigering', 3).stand, 'stuk');
  assert.equal(stap(await BP.vierPaden(wereld({ leverAltijd: true }).a), 'weigering', 5).stand, 'stuk');
});

test('vertraging: "betaald" terwijl de bank nog wacht, of dubbel afschrijven bij herhaling, is stuk', async () => {
  assert.equal(stap(await BP.vierPaden(wereld({ traagBetaald: true }).a), 'vertraging', 1).stand, 'stuk');
  const d = await BP.vierPaden(wereld({ traagDubbel: true }).a);
  assert.equal(stap(d, 'vertraging', 2).stand, 'gesloten', 'een tweede vraag met een open uitslag is nog geen afschrijving');
});

test('succes: een dubbele boeking is stuk', async () => {
  assert.equal(stap(await BP.vierPaden(wereld({ dubbeleBoeking: true }).a), 'succes', 4).stand, 'stuk');
});

test('crash: een verweesde "betaald", of een tweede afschrijving na herstel, is stuk', async () => {
  const wees = await BP.vierPaden(wereld({ weesBetaald: true }).a);
  assert.equal(stap(wees, 'crash', 2).stand, 'stuk', JSON.stringify(wees.paden.crash.stappen));
  const dub = await BP.vierPaden(wereld({ crashDubbel: true }).a);
  assert.equal(stap(dub, 'crash', 3).stand, 'stuk', JSON.stringify(dub.paden.crash.stappen));
  assert.match(stap(dub, 'crash', 3).reden, /2 afschrijvingen/);
  /* De bank schreef af, en RTG weet na de herstart van geen gestarte betaling:
     dat het lid toevallig opnieuw betaalt en dezelfde sleutel het redt, maakt
     het niet goed. Wie nooit terugkomt, is zijn geld kwijt zonder dat iemand
     het ziet. */
  const verg = await BP.vierPaden(wereld({ vergeten: true }).a);
  assert.equal(stap(verg, 'crash', 2).stand, 'stuk', JSON.stringify(verg.paden.crash.stappen));
  assert.match(stap(verg, 'crash', 2).reden, /kent na herstel geen gestarte betaling/);
  assert.equal(stap(verg, 'crash', 3).stand, 'gesloten', 'het herstel zelf kan intussen wel lukken');
});

test('wat de wereld niet KAN, staat open met de reden -- nooit gesloten', async () => {
  const w = wereld().a;
  delete w.bevestigLater; delete w.betaalEnCrash;
  const uit = await BP.vierPaden(w);
  assert.equal(stap(uit, 'vertraging', 4).stand, 'open');
  assert.match(stap(uit, 'vertraging', 4).reden, /later bevestigen/);
  assert.ok(standen(uit, 'crash').every((s) => s === 'open'), JSON.stringify(uit.paden.crash.stappen));
  assert.ok(uit.open >= 2);
});

test('een afloop die niet te krijgen is, zet het hele pad open en niet groen', async () => {
  const w = wereld().a;
  const echt = w.nieuw;
  w.nieuw = async (afloop) => (afloop === 'geweigerd' ? null : echt(afloop));
  const uit = await BP.vierPaden(w);
  assert.ok(standen(uit, 'weigering').every((s) => s === 'open'));
  assert.match(uit.paden.weigering.stappen[0].reden, /geweigerd/);
});

test('het afschrift: twee uitslagen met dezelfde sleutel zijn EEN betaling', () => {
  const r = [{ soort: 'maak', sleutel: 'k1', id: 'a', status: 'betaald' }, { soort: 'maak', sleutel: 'k1', id: 'b', status: 'betaald' },
    { soort: 'haal', sleutel: 'k1', id: 'a', status: 'betaald' }, { soort: 'maak', sleutel: 'k2', id: 'c', status: 'open' },
    { soort: 'maak', sleutel: 'k3', id: 'd', status: 'geweigerd' }];
  assert.equal(BP.afschrijvingen(r), 1);
  assert.equal(BP.afschrijvingen(r.concat([{ soort: 'haal', sleutel: 'k2', id: 'c', status: 'betaald' }])), 2, 'een trage die later betaald blijkt, telt');
});

/* DE BANKHAAK (scripts/lib/betaalhaak.js): het afschrift van de bank, het
   bevriezen tussen bankantwoord en verwerking, en de latere bevestiging. In
   het proces getoetst met een nagemaakte simulatiebank. */
test('de bankhaak schrijft het afschrift, bevriest een keer, en bevestigt later', () => {
  const fs = require('fs'); const os = require('os'); const path = require('path');
  const H = require('../scripts/lib/betaalhaak');
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'betaalhaak-'));
  const nep = () => ({ maak: (o) => ({ id: 'sim_' + o.simulatie + '_x_1', status: o.simulatie === 'traag' ? 'open' : 'betaald', sleutel: o.idempotentieSleutel }),
    haal: (id) => ({ id, status: id.split('_')[1] === 'traag' ? 'open' : 'betaald' }) });
  let bevroren = 0;
  const bank = H.omwikkel(nep, { map, bevries: () => { bevroren++; } })();
  bank.maak({ idempotentieSleutel: 'k1', simulatie: 'betaald' });
  H.zet(map, 'hang');
  bank.maak({ idempotentieSleutel: 'k2', simulatie: 'betaald' });
  assert.equal(bevroren, 1, 'bevroren na het bankantwoord');
  assert.ok(!fs.existsSync(path.join(map, 'hang')), 'een keer: na een herstart loopt hij door');
  assert.ok(fs.existsSync(path.join(map, 'gevraagd')));
  const t = bank.maak({ idempotentieSleutel: 'k3', simulatie: 'traag' });
  assert.equal(bank.haal(t.id).status, 'open');
  H.zet(map, 'bevestig', t.id);
  assert.equal(bank.haal(t.id).status, 'betaald', 'de bank bevestigt alsnog');
  const r = H.afschrift(map);
  assert.deepEqual(r.map((x) => [x.soort, x.sleutel, x.status]), [['maak', 'k1', 'betaald'], ['maak', 'k2', 'betaald'],
    ['maak', 'k3', 'open'], ['haal', 'k3', 'open'], ['haal', 'k3', 'betaald']]);
  assert.equal(BP.afschrijvingen(r), 3);
  fs.rmSync(map, { recursive: true, force: true });
});

test('de bankhaak is inert buiten een testserver met de simulatiebank', () => {
  const H = require('../scripts/lib/betaalhaak');
  assert.equal(H.actief({ NODE_ENV: 'production', RTG_SIMULATIEBANK: '1', RTG_BETAALHAAK: '/tmp/x' }), false);
  assert.equal(H.actief({ NODE_ENV: 'test', RTG_BETAALHAAK: '/tmp/x' }), false);
  assert.equal(H.actief({ NODE_ENV: 'test', RTG_SIMULATIEBANK: '1' }), false);
  assert.equal(H.actief({ NODE_ENV: 'test', RTG_SIMULATIEBANK: '1', RTG_BETAALHAAK: '/tmp/x' }), true);
});
