#!/usr/bin/env node
/* ============================================================================
   DE HERSTELPROEF -- doet de tegenhanger werkelijk ongedaan wat de heenweg deed?

   WAAROM DIT ER IS. HERSTEL.json leidt tegenhangers af uit NAMEN: naast
   /api/agenda/toevoegen staat /api/agenda/verwijder, dus dat zal wel de
   omkering zijn. De hoogste graad die zo'n afleiding kan halen is `vermoed`, en
   dat stond er eerlijk bij: 74 vermoed, 0 bevestigd. Zolang `bevestigd` leeg is
   mag geen scherm en geen bon een terugweg beloven -- en compenserend handelen
   in een AI-keten is daarmee onbewezen.

   Dit is het instrument dat in BEWIJSSCHULD.json onder `herstel-onbevestigd`
   als ontbrekend stond. Het VOERT het paar uit: heen, kijken, terug, kijken.

   DE MEETLAT: TWEE BEELDEN, NIET EEN. De droogloop telt het versienummer van
   elke collectie, want die beantwoordt "is er iets gebeurd". Voor "staat het er
   weer zoals het stond" is dat de verkeerde vraag: `ver` loopt alleen maar op.
   Daarom leest deze proef de INHOUD (een hash per collectie), en gebruikt hij
   het versiebeeld alleen om te zien of een stap uberhaupt werk deed. Beide
   komen uit scripts/droogloop.js -- er komt geen tweede lezer van de opslag bij.

   VIER UITSLAGEN, EN DRIE ERVAN ZIJN GEEN BEWIJS:

     exact         na de terugweg is de inhoud van elke geraakte collectie
                   letterlijk terug op wat zij voor de heenweg was.
     compensatie   de terugweg deed werk in dezelfde collecties, maar de inhoud
                   is niet dezelfde. Dat is een geldige vorm van herstel (een
                   creditnota wist geen factuur) en het is GEEN exact herstel;
                   wie die twee gelijkstelt, belooft een terugweg die er niet is.
     geen-herstel  de terugweg draaide en veranderde niets. Dan is de naam een
                   belofte en de handeling niet.
     nietBeproefd  de heenweg deed geen werk (geen geldig lijf, geen rechten,
                   404). Dan valt er niets om te draaien -- en dit is met opzet
                   een eigen uitslag en geen `geen-herstel`: niet gemeten mag
                   nooit als een oordeel langskomen.

   WAT DEZE PROEF NIET KAN. Zij weet niet WELK ding de terugweg moet aanwijzen.
   Zij probeert de identificerende velden uit het antwoord van de heenweg door
   te geven; lukt dat niet, dan is de uitslag `nietBeproefd` en niet
   `geen-herstel`. Zij toetst een paar dus in het gunstigste geval -- een
   bevestiging hier is geen bewijs dat het paar ONDER ALLE OMSTANDIGHEDEN
   omkeert.

   Draaien: npm run herstelproef        (alle vermoede paren)
            npm run herstelproef -- --pad /api/agenda/toevoegen
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { start } = require('./lib/wegwerpserver');
const { plausibelLijf } = require('./lib/rolproef');
const { opslagBeeld, inhoudsBeeld, verschil, isSpoor } = require('./droogloop');

const WORTEL = path.join(__dirname, '..');

/* De velden waarmee een terugweg zijn doelwit aanwijst. Uit het antwoord van de
   heenweg gehaald, en niet verzonnen: een terugweg die een id wil en er geen
   krijgt, geeft 404 en dat zou hier ten onrechte "herstelt niet" heten. */
const SLEUTELVELDEN = ['id', 'code', 'nummer', 'ref', 'sleutel', 'uuid'];

function sleutelsUit(antwoord) {
  const uit = {};
  const kijk = (o, diepte) => {
    if (!o || typeof o !== 'object' || diepte > 3) return;
    for (const [k, v] of Object.entries(o)) {
      if (SLEUTELVELDEN.includes(k) && (typeof v === 'string' || typeof v === 'number')) {
        if (uit[k] === undefined) uit[k] = v;
      } else if (Array.isArray(v)) { if (v.length) kijk(v[v.length - 1], diepte + 1); }
      else if (v && typeof v === 'object') kijk(v, diepte + 1);
    }
  };
  kijk(antwoord, 0);
  return uit;
}

function parenUit(register) {
  const uit = [];
  for (const [pad, v] of Object.entries((register || {}).per || {}))
    if (v && v.graad === 'vermoed' && v.tegenhanger) uit.push({ heen: pad, terug: v.tegenhanger });
  return uit;
}

async function roep(basis, pad, token, lijf) {
  try {
    const r = await fetch(basis + pad, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(lijf)
    });
    return { status: r.status, data: await r.json().catch(() => null) };
  } catch (e) { return { status: 0, data: null }; }
}

/* Alleen de collecties die er werkelijk toe doen: de huishouding (apiSpoor,
   handelingLog) verandert bij ELKE oproep en zou elk paar op "niet hersteld"
   zetten. Dat is dezelfde scheiding als in de droogloop, uit hetzelfde bestand. */
const domein = (lijst) => (lijst || []).filter(n => !isSpoor(n));

async function beproefPaar(srv, token, paar) {
  /* EEN OPWARMRONDE, EN DIE IS GEEN FORMALITEIT. In een verse database BESTAAT
     de collectie `agendas` nog niet. Voegt de heenweg het eerste item toe en
     haalt de terugweg het weer weg, dan is de collectie daarna leeg maar
     AANWEZIG -- en dat is per definitie een andere inhoud dan "er was niets".
     Zonder deze ronde heette elk paar `compensatie` en was `exact` structureel
     onbereikbaar: een hoogste graad die niemand ooit kan halen, is geen graad.
     De opwarmronde laat de collectie ontstaan; pas daarna begint de meting. */
  await roep(srv.basis, paar.heen, token, plausibelLijf(paar.heen));
  await new Promise(r => setTimeout(r, 200));

  const s0i = inhoudsBeeld(srv.datamap), s0v = opslagBeeld(srv.datamap);
  const heen = await roep(srv.basis, paar.heen, token, plausibelLijf(paar.heen));
  await new Promise(r => setTimeout(r, 200));
  const s1i = inhoudsBeeld(srv.datamap), s1v = opslagBeeld(srv.datamap);

  const heenRaakte = domein(verschil(s0v, s1v));
  if (heen.status < 200 || heen.status >= 300 || !heenRaakte.length)
    return { ...paar, uitslag: 'nietBeproefd', heenStatus: heen.status, geraakt: heenRaakte,
      reden: heen.status < 200 || heen.status >= 300
        ? 'de heenweg gaf status ' + heen.status + ': er is niets gebeurd om terug te draaien'
        : 'de heenweg draaide maar raakte geen enkele domeincollectie aan; er valt niets om te keren' };

  const lijf = Object.assign(plausibelLijf(paar.terug), sleutelsUit(heen.data));
  const terug = await roep(srv.basis, paar.terug, token, lijf);
  await new Promise(r => setTimeout(r, 200));
  const s2i = inhoudsBeeld(srv.datamap), s2v = opslagBeeld(srv.datamap);

  /* Alleen wat de HEENWEG aanraakte telt mee voor de vraag of de terugweg werk
     deed. Raakt de terugweg iets heel anders aan (een teller, een logboek van
     een ander domein), dan is dat geen herstel van dit paar -- en het zou een
     paar dat niets terugdraait ten onrechte `compensatie` noemen. */
  const terugRaakte = domein(verschil(s1v, s2v)).filter(n => heenRaakte.includes(n));
  if (terug.status < 200 || terug.status >= 300)
    return { ...paar, uitslag: 'nietBeproefd', heenStatus: heen.status, terugStatus: terug.status,
      geraakt: heenRaakte,
      reden: 'de terugweg gaf status ' + terug.status + '; waarschijnlijk wees het lijf niet het ' +
        'ding aan dat de heenweg maakte. Dat is een tekort van deze proef en geen oordeel over het paar' };

  /* Terug op de oude inhoud? Alleen kijken naar wat de heenweg aanraakte: dat
     een andere collectie ondertussen bewoog, zegt niets over dit paar. */
  const nietTerug = heenRaakte.filter(n => s2i[n] !== s0i[n]);
  if (!nietTerug.length)
    return { ...paar, uitslag: 'exact', heenStatus: heen.status, terugStatus: terug.status,
      geraakt: heenRaakte,
      reden: 'na de terugweg is de inhoud van elke geraakte collectie letterlijk terug op de oude waarde' };
  if (terugRaakte.length)
    return { ...paar, uitslag: 'compensatie', heenStatus: heen.status, terugStatus: terug.status,
      geraakt: heenRaakte, nietTerug,
      reden: 'de terugweg deed werk, maar ' + nietTerug.length + ' collectie(s) staan niet terug op ' +
        'de oude inhoud. Een geldige vorm van herstel, en geen exacte omkering' };
  return { ...paar, uitslag: 'geen-herstel', heenStatus: heen.status, terugStatus: terug.status,
    geraakt: heenRaakte, nietTerug,
    reden: 'de terugweg gaf ' + terug.status + ' en veranderde niets; de naam belooft een omkering ' +
      'die de handeling niet uitvoert' };
}

async function main() {
  const register = JSON.parse(fs.readFileSync(path.join(WORTEL, 'HERSTEL.json'), 'utf8'));
  let paren = parenUit(register);
  const i = process.argv.indexOf('--pad');
  if (i >= 0 && process.argv[i + 1]) paren = paren.filter(p => p.heen === process.argv[i + 1]);
  console.log('DE HERSTELPROEF\n');
  console.log('  ' + paren.length + ' vermoed(e) paren, uitgevoerd tegen een wegwerpserver\n');

  const srv = await start({ naam: 'herstelproef', gereed: 'ready', env: { NODE_ENV: 'test', RTG_DEMO: '1' } });
  const uitslagen = [];
  try {
    const login = await fetch(srv.basis + '/api/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier: 'rtg' })
    }).then(async r => ({ status: r.status, data: await r.json().catch(() => null) })).catch(() => ({ status: 0, data: null }));
    const token = login.data && login.data.token;
    if (!token) throw new Error('geen sessie op de wegwerpserver (status ' + login.status + '): zonder inlog meet deze proef niets');

    for (const paar of paren) {
      const u = await beproefPaar(srv, token, paar);
      uitslagen.push(u);
      console.log('  ' + u.uitslag.padEnd(13) + paar.heen + '  ->  ' + paar.terug);
    }
  } finally { try { srv.klaar(); } catch (e) {} }

  const tel = (n) => uitslagen.filter(u => u.uitslag === n).length;
  const uit = {
    uitleg: 'Vermoede tegenhangers uit HERSTEL.json, werkelijk uitgevoerd: heen, kijken, terug, kijken. ' +
      'Alleen `exact` en `compensatie` zijn een uitspraak over het paar; de rest is een tekort van de proef.',
    gemeten: { paren: paren.length, exact: tel('exact'), compensatie: tel('compensatie'),
      geenHerstel: tel('geen-herstel'), nietBeproefd: tel('nietBeproefd') },
    per: uitslagen,
    grenzen: [
      'de proef weet niet WELK ding de terugweg moet aanwijzen; zij geeft de identificerende velden uit ' +
        'het antwoord van de heenweg door, en faalt dat, dan is de uitslag nietBeproefd en geen oordeel',
      'een paar wordt in het gunstigste geval beproefd: meteen erna, door dezelfde gebruiker, met een ' +
        'vers gemaakt ding. Een bevestiging hier zegt niets over een terugweg een week later',
      'exact en compensatie zijn niet hetzelfde, en worden nooit samengeteld: een creditnota wist geen factuur',
      'de huishouding (apiSpoor, handelingLog) blijft buiten het oordeel; die verandert bij elke oproep'
    ]
  };
  fs.writeFileSync(path.join(WORTEL, 'HERSTELPROEF.json'), JSON.stringify(uit, null, 1) + '\n');
  console.log('\n  exact ' + tel('exact') + ' | compensatie ' + tel('compensatie') +
    ' | geen-herstel ' + tel('geen-herstel') + ' | niet beproefd ' + tel('nietBeproefd'));
  console.log('\nHERSTELPROEF.json geschreven.');
}

if (require.main === module) main().catch(e => { console.error('herstelproef: ' + e.message); process.exit(1); });
module.exports = { parenUit, sleutelsUit, beproefPaar };
