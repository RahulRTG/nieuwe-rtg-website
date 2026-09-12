#!/usr/bin/env node
/* ============================================================================
   DE NULMETING OP `pakte` -- wie claimt de vraag, de antwoordrail of het stuur?

   WAT ER GEMETEN WORDT, EN WAAROM DIT EERST KOMT. In
   server/routes/member/persoonlijk.js staat:

       const r = await fluisterZeg(...);
       if (stuurLus && !r.pakte) { ... }

   Die ene boolean is vandaag de ROUTER van de hele menselijke ingang, en hij
   draagt vier betekenissen tegelijk: het model had een antwoord, de vraag is
   beantwoord, er hoeft geen actie, en de resolver hoeft niet. Zolang de
   antwoordrail `pakte = true` zet op een vraag die OPERATIONEEL is, kan de
   operationele motor er nooit aan te pas komen -- hoe goed die ook werkt.

   Dit script VERANDERT NIETS. Het telt alleen hoe vaak dat gebeurt, per klasse
   uit het mensentaal-contract. Pas met dat getal is de routing een besluit in
   plaats van een gok.

   HOE DE SCHEIDSLIJN GETROKKEN WORDT. Met de deterministische rail aan geeft
   de route bij een stuur-antwoord het veld `plafond` mee (persoonlijk.js r.
   84) en bij een antwoordrail-antwoord niet. Dat is geen heuristiek maar een
   structureel verschil: alleen de stuurtak zet dat veld.

   TWEE DINGEN DIE DE METING ZOUDEN VERVUILEN, EN HOE ZE AFGEVANGEN ZIJN:

     1. GESPREKSGEHEUGEN. fluisterZeg bewaart de laatste vijf beurten per lid
        en geeft die mee als context. Eenenveertig zinnen achter elkaar van
        hetzelfde lid meet dus deels de vorige zin.
     2. DE SNELHEIDSREM. teSnel(key) geeft 429 na te veel berichten achter
        elkaar. Die zou als "niet geclaimd" kunnen worden gelezen.

   Allebei opgelost met EEN VERS LID PER GEVAL: eigen geheugen, eigen teller.
   Het kost eenenveertig registraties en dat is de goedkoopste eerlijkheid die
   hier te koop is. Een 429 die tóch valt wordt als `niet-gemeten` geteld met
   de reden erbij -- nooit stilzwijgend als een uitkomst.

   WAT DIT NIET MEET. Of de antwoordrail een GOED antwoord gaf. De vraag is
   uitsluitend wie hem claimde. Een claim kan volkomen terecht zijn -- bij
   INFORMATION hoort hij dat zelfs te zijn.

   DRAAIEN
     node scripts/pakte.js               meet, schrijft PAKTE.json
     node scripts/pakte.js --stil        alleen de eindregels
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { stempel } = require('./lib/stempel');
const { start } = require('./lib/wegwerpserver');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'PAKTE.json');
const CORPUS = require('../server/kern/stuur/menstaal.json');

/* Alleen de gevallen die vandaag te draaien zijn. FASE4 hangt aan context, en
   context bereikt de resolver nog niet -- die meenemen zou een uitkomst
   opleveren over een weg die niet bestaat. */
const GEVALLEN = CORPUS.gevallen.filter((g) => g.beproefbaar === 'NU');

async function post(basis, pad, lijf, token) {
  const koppen = { 'Content-Type': 'application/json' };
  if (token) koppen.Authorization = 'Bearer ' + token;
  const r = await fetch(basis + pad, { method: 'POST', headers: koppen, body: JSON.stringify(lijf || {}) })
    .catch((e) => ({ status: 0, fout: e && e.message }));
  if (!r || !r.status) return { status: 0, data: null };
  const data = await r.json().catch(() => null);
  return { status: r.status, data };
}

async function versLid(basis, n) {
  const u = String(Date.now()).slice(-7) + String(n).padStart(3, '0');
  const r = await post(basis, '/api/auth/register', {
    name: 'Pakte ' + n, email: 'pakte' + u + '@voorbeeld.nl', phone: '06' + u.slice(0, 8),
    password: 'geheim12345', geboortedatum: '1985-05-05', tier: 'rtg'
  });
  return r.data && r.data.token ? r.data.token : null;
}

/* DE WACHT VOOR HET REQUIREN. Zonder dit start een laadcontrole een
   wegwerpserver, registreert eenenveertig leden en overschrijft het register.
   scripts/meetkeuring.js regel `wacht` handhaaft hem; hij vond dat gat eerder
   vandaag al in scripts/eersteminuut.js. */
if (require.main !== module) { module.exports = { GEVALLEN }; return; }

(async () => {
  const stil = process.argv.includes('--stil');
  const srv = await start({ naam: 'pakte', gereed: 'ready',
    env: { RTG_INTENT_RAIL: 'deterministisch' } });
  const rijen = [];
  try {
    for (let i = 0; i < GEVALLEN.length; i++) {
      const g = GEVALLEN[i];
      const token = await versLid(srv.basis, i);
      if (!token) { rijen.push({ id: g.id, klasse: g.klasse, uitslag: 'niet-gemeten',
        reden: 'registratie mislukte; zonder eigen lid is de meting vervuild door het gespreksgeheugen' }); continue; }
      const r = await post(srv.basis, '/api/fluister', { q: g.input }, token);
      if (r.status === 429) { rijen.push({ id: g.id, klasse: g.klasse, uitslag: 'niet-gemeten',
        reden: 'de snelheidsrem sloeg aan (429); dat is geen uitkomst over wie de vraag claimde' }); continue; }
      if (r.status !== 200 || !r.data) { rijen.push({ id: g.id, klasse: g.klasse, uitslag: 'niet-gemeten',
        reden: 'de route gaf status ' + r.status }); continue; }
      /* DE SCHEIDSLIJN. Alleen de stuurtak zet `plafond` in het antwoord. */
      const stuur = Object.prototype.hasOwnProperty.call(r.data, 'plafond');
      rijen.push({ id: g.id, klasse: g.klasse, input: g.input,
        verwachteRoute: g.verwachteRoute,
        pakte: !stuur,
        uitslag: stuur ? 'stuur' : 'antwoordrail' });
    }
  } finally { await srv.klaar(); }

  const tel = (f) => rijen.filter(f).length;
  const perKlasse = {};
  for (const k of CORPUS.woordenlijsten.klasse) {
    const rij = rijen.filter((r) => r.klasse === k);
    if (!rij.length) continue;
    perKlasse[k] = { gevallen: rij.length,
      antwoordrail: rij.filter((r) => r.uitslag === 'antwoordrail').length,
      stuur: rij.filter((r) => r.uitslag === 'stuur').length,
      nietGemeten: rij.filter((r) => r.uitslag === 'niet-gemeten').length };
  }

  /* HET GETAL DAT ERTOE DOET: hoe vaak claimt de antwoordrail een vraag die
     OPERATIONEEL is? Dan krijgt de motor die vraag nooit te zien, hoe goed hij
     ook werkt.

     DIT WAS EERST `!== ANSWER`, EN DAT TELDE VERKEERD. "doe maar" wordt door
     de antwoordrail geclaimd (kern/fluister/bevestig.js `ja()`) en beantwoord
     met "Er staat niets open om te bevestigen" -- precies de CLARIFY die het
     contract verwacht, alleen door een andere laag geleverd. Dat als misgelopen
     tellen maakt van correct gedrag een defect, en dan is het getal niet meer
     te vertrouwen. Een CLARIFY is goed wie hem ook geeft; alleen een
     OPERATIONAL die nooit bij de motor komt, is een verlies. */
  const misgelopen = rijen.filter((r) => r.uitslag === 'antwoordrail' &&
    r.verwachteRoute === 'OPERATIONAL');

  /* DE OMGEKEERDE ZORG, en die is bij deze meting groter gebleken: een
     UITLEGvraag die de operationele motor binnenloopt. Vandaag onschadelijk --
     het plafond staat op tonen en het corpus scriptte ze zonder tool -- maar
     met een echte modelrail komt zo'n vraag in de toollus terecht. */
  const uitlegNaarStuur = rijen.filter((r) => r.uitslag === 'stuur' &&
    r.verwachteRoute === 'ANSWER');

  const uit = {
    stempel: stempel(),
    wat: 'wie claimt de vraag voordat de stuurketen hem ziet: de antwoordrail (pakte=true) of het stuur',
    meet: 'server/routes/member/persoonlijk.js `if (stuurLus && !r.pakte)`',
    verandertNiets: true,
    corpus: { bestand: 'server/kern/stuur/menstaal.json', gevallenNU: GEVALLEN.length },
    telling: { gemeten: tel((r) => r.uitslag !== 'niet-gemeten'),
      antwoordrail: tel((r) => r.uitslag === 'antwoordrail'),
      stuur: tel((r) => r.uitslag === 'stuur'),
      nietGemeten: tel((r) => r.uitslag === 'niet-gemeten'),
      misgelopen: misgelopen.length, uitlegNaarStuur: uitlegNaarStuur.length },
    perKlasse,
    misgelopen: misgelopen.map((r) => ({ id: r.id, input: r.input, verwachteRoute: r.verwachteRoute })),
    uitlegNaarStuur: uitlegNaarStuur.map((r) => ({ id: r.id, input: r.input })),
    watDitNietMeet: 'of de antwoordrail een GOED antwoord gaf. Alleen wie hem claimde.',
    rijen
  };
  fs.writeFileSync(DOEL, JSON.stringify(uit, null, 2) + '\n');

  if (!stil) {
    for (const k of Object.keys(perKlasse)) {
      const p = perKlasse[k];
      console.log('  ' + k.padEnd(22) + ' antwoordrail ' + String(p.antwoordrail).padStart(2) +
        '   stuur ' + String(p.stuur).padStart(2) +
        (p.nietGemeten ? '   niet gemeten ' + p.nietGemeten : ''));
    }
    console.log('');
    if (uitlegNaarStuur.length)
      console.log('  ' + uitlegNaarStuur.length + ' UITLEGvraag/vragen liepen de operationele motor binnen.\n');
    if (misgelopen.length) {
      console.log('  De antwoordrail claimde ' + misgelopen.length + ' OPERATIONELE vraag/vragen:');
      for (const m of misgelopen) console.log('    ' + m.verwachteRoute.padEnd(12) + '"' + m.input + '"');
      console.log('');
    }
  }
  console.log('PAKTE: ' + uit.telling.antwoordrail + ' antwoordrail, ' + uit.telling.stuur +
    ' stuur, ' + uit.telling.misgelopen + ' misgelopen, ' + uit.telling.uitlegNaarStuur + ' uitleg-naar-stuur' +
    (uit.telling.nietGemeten ? ', ' + uit.telling.nietGemeten + ' niet gemeten' : ''));
})().catch((e) => { console.error(e); process.exit(2); });
