#!/usr/bin/env node
/* ============================================================================
   RAAKT ELKE VERRAADSMODUS ZIJN EIGEN CRASHGRENS?

   scripts/lib/crashtaxonomie.js kent drie INTERNE crashgrenzen. Twee ervan
   hebben een verraadsmodus; de derde niet, en dat is een uitslag van juist dit
   script:

     voor-eerste-mutatie       sterf-voor-mutatie    db/bijeen.js, voor fn()
     in-de-opslag              sterf-in-de-opslag    NIET GEBOUWD -- de opslag is
                                                     transactioneel, dus er is
                                                     geen middelpunt
     na-commit-voor-antwoord   sterf-na-commit       db/duurzaam.js, na de
                                                     bevestiging

   DIE MIDDELSTE IS HIER GEVONDEN EN NIET BEDACHT. Er stond eerst wel een
   injectie, tussen de schrijfopdracht en de checkpoint, en deze proef gaf drie
   keer dezelfde uitkomst: de betaling stond na de herstart gewoon vast. De
   oorzaak staat in db/sqlite.js -- `BEGIN IMMEDIATE ... COMMIT` maakt de save
   EEN transactie, dus duurzaamheid valt op de commit en niet op de checkpoint.
   Die regel was een tweede sterf-na-commit met een andere naam, en is eruit.

   DE VRAAG DIE DIT SCRIPT STELT is niet of die modi bestaan -- dat zegt de
   catalogus -- maar of ze WERKELIJK OP VERSCHILLENDE MOMENTEN toeslaan. Drie
   modi die alle drie hetzelfde moment raken, zijn een dekkingscijfer van drie
   waar er een hoort te staan, en dat is erger dan een eerlijke een.

   HOE HIJ DAT MEET, en waarom dit de enige eerlijke manier is: niet door de
   bron te lezen (dan meet je waar de regel STAAT) maar door hetzelfde geldpad
   drie keer te lopen, elke keer met een andere modus scherp, en na de HERSTART
   te kijken wat er van de betaling is overgebleven. Het moment bepaalt de
   uitkomst:

     voor de mutatie       de factuur staat nog open en het saldo is heel
     in de opslag          de schrijfactie was onderweg; wat er staat is NIET
                           als bevestigd afgegeven
     na de commit          de betaling staat vast (dit is de bekende PROVEN)

   Zijn die drie uitkomsten niet van elkaar te onderscheiden, dan zakt dit
   script -- en dan is er een modus die iets anders raakt dan zijn naam zegt.

   ER KOMT GEEN TWEEDE WERELDBOUWER BIJ. De opstelling, het economisch beeld en
   het bakverschil komen uit scripts/factuurproef.js; dit script stelt er een
   andere vraag mee. Twee wereldbouwers naast elkaar lopen binnen een maand uit
   elkaar en dan meten twee proeven iets anders zonder dat iemand het ziet.

   Draaien:  npm run crashgrenzen
             npm run crashgrenzen -- --json
   ========================================================================== */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const W = require('./lib/wegwerpserver.js');
const tax = require('./lib/crashtaxonomie.js');
const fp = require('./factuurproef.js');

const jsonUit = process.argv.includes('--json');

/* De koppeling grens -> modus staat OOK in scripts/crashas.js, en dat is geen
   dubbeling maar een andere vraag: daar wordt hij gebruikt om te zeggen of een
   grens te beproeven is, hier om te beproeven of hij klopt. Zou dit script hem
   uit crashas.js lezen, dan bewijst hij de aanname met de aanname. */
const MODI = [
  { grens: 'voor-eerste-mutatie', modus: 'sterf-voor-mutatie',
    verwacht: 'de factuur staat nog open en het saldo is onaangeroerd' },
  { grens: 'in-de-opslag', modus: 'sterf-in-de-opslag',
    verwacht: 'de schrijfactie was onderweg; er is geen bevestigde betaling' },
  { grens: 'na-commit-voor-antwoord', modus: 'sterf-na-commit',
    verwacht: 'de betaling staat duurzaam vast' }
];

/* WELKE MODI ZIJN ER ECHT? De catalogus zegt het met `waar`, en een modus met
   `waar: null` is ontworpen en niet gebouwd. Die wordt hier NIET gedraaid en
   ook niet als fout geteld -- hij staat er met zijn reden, want een proef die
   een niet-gebouwde modus stilzwijgend weglaat, verbergt dat de dekking kleiner
   is dan de taxonomie suggereert.

   Zo bleef `sterf-in-de-opslag` zichtbaar nadat deze proef had aangetoond dat
   hij op een transactionele opslag geen eigen moment heeft. */
const verraad = require('../server/lib/verraad.js');
const ingebouwd = new Map(verraad.CATALOGUS.map(v => [v.naam, v.waar || null]));

const OPLADING = 20000;

/* Een ronde: wereld opzetten, saldo vullen, server doden en herstarten MET de
   modus scherp, betalen, en na de herstart kijken wat er staat. */
async function ronde(modus) {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-crashgrens-'));
  let srv = null;
  try {
    const a = await fp.opstelling(map, null, { echtAccount: true });
    srv = a.srv;
    if (!a.tokLid || !a.tokEig) return { stand: 'BLOCKED', reden: 'geen sessie in de opstelling' };

    const ex = await fp.post(srv.basis, '/api/privacy/export', {}, a.tokLid);
    const open = (((ex.body && ex.body.invoices) || []).filter(i => i && i.status === 'open'));
    const fac = open[0] || null;
    if (!fac) return { stand: 'BLOCKED', reden: 'geen open factuur in de opstelling' };
    const centen = Math.round((Number(fac.bijdrage) || 0) * 100);

    await fp.post(srv.basis, '/api/pay/oplaad', { centen: OPLADING, idem: 'crashgrens-oplaad' }, a.tokLid);
    const voor = await fp.beeld(srv.basis, a.tokLid, a.tokEig, fac.id);

    /* De opstelling schrijft zelf duurzaam, dus het verraad gaat pas AAN bij de
       tweede start -- anders sterft de server tijdens het inloggen en meet de
       ronde de opstelling in plaats van het geldpad. Dezelfde truc als in de
       crashpad van factuurproef.js. */
    try { srv.kind.kill('SIGKILL'); } catch (e) {}
    srv = await W.start({ datamap: map, magSterven: true, wachtMs: 30000,
      env: { RTG_DEMO: '1', RTG_VERRAAD: modus, RTG_VERRAAD_SEED: '20260913' } });

    const betaal = await fp.post(srv.basis, '/api/pay/saldo', { invoiceId: fac.id }, a.tokLid);

    /* STIERF HIJ ECHT? Status 0 betekent "de verbinding brak en de klant kreeg
       nooit antwoord" -- precies de toestand die elke crashgrens nabootst. Een
       modus die aanstond en NIET toesloeg, levert hier een gewone 200 op, en
       dat is een blinde injectie: een groene ronde die niets heeft gemeten. */
    const gestorven = betaal.status === 0;

    try { srv.kind.kill('SIGKILL'); } catch (e) {}
    srv = await W.start({ datamap: map, env: { RTG_DEMO: '1' } });
    const eig3 = await fp.post(srv.basis, '/api/auth/login',
      { login: process.env.RTG_OWNER_EMAIL || 'roellie.i@gmail.com', password: process.env.DEMO_PASS || 'Imran' });
    const na = await fp.beeld(srv.basis, a.tokLid, eig3.body && eig3.body.token, fac.id);

    return { stand: gestorven ? 'GEMETEN' : 'BLINDE_INJECTIE',
      reden: gestorven ? null : 'de modus stond aan maar sloeg niet toe (status ' + betaal.status + ')',
      bedragCenten: centen, statusVanDeAanroep: betaal.status,
      voor: { saldoCenten: voor.saldoCenten, factuurStand: voor.factuurStand },
      na: { saldoCenten: na.saldoCenten, factuurStand: na.factuurStand,
        factuurBoekingen: na.factuurBoekingen } };
  } finally {
    try { if (srv && srv.kind) srv.kind.kill('SIGKILL'); } catch (e) {}
    fs.rmSync(map, { recursive: true, force: true });
  }
}

/* De VINGERAFDRUK van een uitkomst: waaraan je deze grens herkent. Twee modi
   met dezelfde vingerafdruk raken hetzelfde moment, hoe ze ook heten. */
const afdruk = (r) => !r || !r.na ? 'geen-meting'
  : r.na.factuurStand + '/' + (r.na.saldoCenten === r.voor.saldoCenten ? 'saldo-heel' : 'saldo-af');

async function meet() {
  const per = [];
  for (const m of MODI) {
    const waar = ingebouwd.get(m.modus);
    if (!waar) {
      per.push({ grens: m.grens, modus: m.modus, verwacht: m.verwacht, afdruk: 'niet-gedraaid',
        stand: 'NIET_INGEBOUWD',
        reden: (verraad.CATALOGUS.find(v => v.naam === m.modus) || {}).raakt || 'geen injectiepunt' });
      continue;
    }
    const r = await ronde(m.modus);
    per.push(Object.assign({ grens: m.grens, modus: m.modus, verwacht: m.verwacht, waar, afdruk: afdruk(r) }, r));
  }
  const gedraaid = per.filter(p => p.stand !== 'NIET_INGEBOUWD');
  const afdrukken = gedraaid.map(p => p.afdruk);
  const uniek = new Set(afdrukken);
  const blind = gedraaid.filter(p => p.stand === 'BLINDE_INJECTIE').map(p => p.modus);
  return {
    soort: 'proef', instrument: 'scripts/crashgrenzen.js',
    uitleg: 'Raakt elke verraadsmodus werkelijk zijn eigen crashgrens? Gemeten door hetzelfde ' +
      'geldpad drie keer te lopen en na de herstart te kijken wat er van de betaling over is.',
    grenzen: tax.GRENZEN, gemetenOp: new Date().toISOString(), per,
    telling: { modi: per.length, gedraaid: gedraaid.length,
      nietIngebouwd: per.length - gedraaid.length,
      gemeten: gedraaid.filter(p => p.stand === 'GEMETEN').length,
      blindeInjecties: blind.length, verschillendeMomenten: uniek.size },
    /* DE UITSLAG. Drie modi horen drie verschillende vingerafdrukken te geven.
       Zijn er minder, dan raken er twee hetzelfde moment. */
    gezakt: blind.length > 0 || uniek.size < gedraaid.length,
    reden: blind.length ? 'blinde injectie: ' + blind.join(', ')
      : uniek.size < gedraaid.length ? 'twee modi geven dezelfde uitkomst: ' + afdrukken.join(' | ') : null
  };
}

function toon(u) {
  console.log('\n\x1b[1mRAAKT ELKE VERRAADSMODUS ZIJN EIGEN CRASHGRENS?\x1b[0m\n');
  for (const p of u.per) {
    const kop = p.stand === 'GEMETEN' ? '\x1b[32m' + p.stand + '\x1b[0m' : '\x1b[31m' + p.stand + '\x1b[0m';
    console.log('  ' + p.grens.padEnd(26) + p.modus.padEnd(22) + kop);
    console.log('    verwacht : ' + p.verwacht);
    if (p.na) console.log('    gemeten  : factuur ' + p.na.factuurStand + ', saldo ' +
      p.voor.saldoCenten + ' -> ' + p.na.saldoCenten + '  \x1b[2m[' + p.afdruk + ']\x1b[0m');
    if (p.reden) console.log('    \x1b[31m' + p.reden + '\x1b[0m');
  }
  console.log('\n  gedraaid: ' + u.telling.gedraaid + ' van ' + u.telling.modi +
    ' (' + u.telling.nietIngebouwd + ' niet ingebouwd)');
  console.log('  verschillende momenten: ' + u.telling.verschillendeMomenten + ' van ' + u.telling.gedraaid);
  console.log(u.gezakt ? '\n  \x1b[31mDE PROEF ZAKT: ' + u.reden + '\x1b[0m\n'
    : '\n  \x1b[32mElke modus raakt een eigen moment.\x1b[0m\n');
}

if (require.main === module) {
  meet().then(u => {
    if (jsonUit) console.log(JSON.stringify(u, null, 2)); else toon(u);
    process.exitCode = u.gezakt ? 1 : 0;
  }).catch(e => { console.error(e); process.exitCode = 2; });
}

module.exports = { MODI, ronde, meet, afdruk };
