#!/usr/bin/env node
/* ============================================================================
   DE MENSTAALPROEF -- komt een vraag verder dan het contract toestaat?

   WAT DIT BEANTWOORDT, EN WAAROM DAT DE VRAAG VAN FASE 3B IS. Het
   mensentaal-contract (server/kern/stuur/menstaal.json) zegt per zin hoe ver
   hij MAG komen: `sideEffectMax`. Over de zesentwintig zinnen die vandaag te
   draaien zijn staat daar veertien keer `geen` en twaalf keer `tonen` -- en
   geen enkele keer `klaarzetten` of `uitvoeren`. Dat is een harde, falsifieerbare
   bewering over de hele menselijke ingang, en tot nu toe werd hij niet getoetst
   maar aangenomen.

   PAKTE.json meet iets ANDERS en dat verschil doet ertoe: dat register zegt WIE
   de vraag claimde (de antwoordrail of het stuur). Deze proef zegt HOE VER hij
   daarna kwam. Acht uitlegvragen lopen vandaag de operationele motor binnen; of
   dat erg is, hangt volledig af van wat ze daar dan doen -- en dat is precies
   wat hier gemeten wordt in plaats van beredeneerd.

   WAAROM ER GEEN CLASSIFICATIE BIJ KOMT. De verleiding is een tweede laag die
   INFORMATION van ACTION scheidt en de eerste tegenhoudt. Dat zou een tweede
   intentieregister zijn naast het contract dat er al is, en het zou bovendien de
   verkeerde grens trekken: "wat staat er morgen in mijn agenda" is een
   uitlegvraag in de omgangstaal en een LEESactie in de machine. De scheidslijn
   is niet informatie tegenover handeling maar: heeft het antwoord de GEGEVENS
   van dit huis nodig, of alleen zijn kennis. Het contract trekt die lijn al per
   zin; deze proef dwingt hem af.

   HOE DE UITSLAG WORDT BEPAALD -- uit het stuurspoor en niet uit de tekst.
   kern/stuur/spoor.js schrijft per beurt welke fasen liepen. Daaruit volgt de
   BEREIKTE trede:

     niets geselecteerd                        -> geen
     een pad gekozen, niveau `lezen`           -> tonen
     uitgevoerd met bevestigNodig (428)        -> klaarzetten
     uitgevoerd, niveau `voorstel` of `klein`  -> klaarzetten / uitvoeren

   De niveaus komen uit kern/stuur/beleid.js -- dezelfde bron die het plafond
   gebruikt. Een eigen tabel hier zou binnen een maand iets anders zeggen.

   WAT DEZE PROEF NIET KAN, en dat staat er even groot bij. Een antwoord dat de
   ANTWOORDRAIL claimde draagt geen spoor: die laag (kern/fluister/) heeft zijn
   eigen handelingen -- reserveren, betalen -- en die lopen niet langs het stuur.
   Voor zo'n zin is de uitslag daarom `nietGemeten` met de reden, en niet `geen`.
   "Ik kon niet kijken" is geen "er gebeurde niets"; dat verschil weglaten zou
   van deze proef een geruststelling maken.

   EN TWEE CONTRACTVELDEN WORDEN HIER NIET GEMETEN: `blockingVraagMax` en
   `architectuurKeuzesMax`. Die gaan over de TEKST van het antwoord (hoeveel
   vragen stelt het, hoeveel keuzes legt het bij de mens), en dat is met een
   regex niet vast te stellen zonder te gaan raden. Ze staan in de uitslag als
   `nietGemeten` met de reden, want een bewijs dat je weglaat leest als een
   bewijs dat je haalt (BETROUWBAARHEID.md).

   DRAAIEN
     node scripts/menstaalproef.js            meet, schrijft MENSTAALPROEF.json
     node scripts/menstaalproef.js --controle zakt zodra een zin te ver komt
     node scripts/menstaalproef.js --stil     alleen de eindregels
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { stempel } = require('./lib/stempel');
const { start } = require('./lib/wegwerpserver');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'MENSTAALPROEF.json');
const CORPUS = require('../server/kern/stuur/menstaal.json');
const { beleidVoor } = require('../server/kern/stuur/beleid');
const { TREDEN } = require('../server/kern/stuur/plafond');

const GEVALLEN = CORPUS.gevallen.filter((g) => g.beproefbaar === 'NU');

/* Van een beleidsniveau naar de trede waarop dat pad uitkomt. Dezelfde
   afbeelding als kern/stuur/plafond.js NIVEAUS_BIJ_TREDE, alleen andersom
   gelezen -- en met opzet uit dat bestand afgeleid in plaats van overgetypt. */
const TREDE_VAN_NIVEAU = { lezen: 'tonen', voorstel: 'klaarzetten', klein: 'uitvoeren' };

function hoger(a, b) {
  return TREDEN.indexOf(a) >= TREDEN.indexOf(b) ? a : b;
}

/* DE BEREIKTE TREDE UIT HET SPOOR. Geeft altijd een trede EN waaruit hij volgt;
   een kaal woord is bij een overtreding niet na te trekken. */
function bereikteTrede(spoor) {
  if (!spoor || !spoor.perFase) return { trede: null, uit: 'geen spoor' };
  const merken = spoor.merken || [];
  let trede = 'geen';
  const uit = [];
  for (const m of merken) {
    if (m.fase === 'CAPABILITY_SELECTED' && m.stand === 'PASS') {
      const pad = (m.detail && m.detail.pad) || '';
      const niveau = pad ? beleidVoor(pad, 'member').niveau : null;
      const t = TREDE_VAN_NIVEAU[niveau] || 'uitvoeren';
      trede = hoger(trede, t);
      uit.push('pad ' + pad + ' (' + niveau + ') -> ' + t);
    }
    if (m.fase === 'EXECUTED' && m.stand === 'PASS') {
      uit.push('EXECUTED status ' + ((m.detail && m.detail.status) || '?'));
    }
    if (m.fase === 'EXECUTED' && m.stand === 'NOT_RUN') {
      /* Een 428 betekent dat de server een VOORSTEL teruggaf: er is niets
         uitgevoerd, maar er staat wel iets klaar. Dat is `klaarzetten` en niet
         `tonen` -- die twee samenvoegen laat een voorstel eruitzien als kijken. */
      trede = hoger(trede, 'klaarzetten');
      uit.push('een voorstel gezet (bevestigNodig)');
    }
  }
  return { trede, uit };
}

async function post(basis, pad, lijf, token) {
  const koppen = { 'Content-Type': 'application/json' };
  if (token) koppen.Authorization = 'Bearer ' + token;
  const r = await fetch(basis + pad, { method: 'POST', headers: koppen, body: JSON.stringify(lijf || {}) })
    .catch((e) => ({ status: 0, fout: e && e.message }));
  if (!r || !r.status) return { status: 0, data: null };
  return { status: r.status, data: await r.json().catch(() => null) };
}

/* EEN VERS LID PER GEVAL, om dezelfde reden als in scripts/pakte.js: het
   gespreksgeheugen van fluisterZeg en de snelheidsrem zouden anders van de
   zesentwintig zinnen een keten maken in plaats van zesentwintig metingen. */
async function versLid(basis, n) {
  const u = String(Date.now()).slice(-7) + String(n).padStart(3, '0');
  const r = await post(basis, '/api/auth/register', {
    name: 'Menstaal ' + n, email: 'menstaal' + u + '@voorbeeld.nl', phone: '06' + u.slice(0, 8),
    password: 'geheim12345', geboortedatum: '1985-05-05', tier: 'rtg'
  });
  return r.data && r.data.token ? r.data.token : null;
}

/* DE WACHT VOOR HET REQUIREN (scripts/meetkeuring.js regel `wacht`). Zonder dit
   start een laadcontrole een wegwerpserver en overschrijft het register. */
if (require.main !== module) { module.exports = { GEVALLEN, bereikteTrede }; return; }

(async () => {
  const stil = process.argv.includes('--stil');
  const controle = process.argv.includes('--controle');
  const srv = await start({ naam: 'menstaalproef', gereed: 'ready',
    env: { RTG_INTENT_RAIL: 'deterministisch' } });
  const rijen = [];
  try {
    for (let i = 0; i < GEVALLEN.length; i++) {
      const g = GEVALLEN[i];
      const token = await versLid(srv.basis, i);
      if (!token) {
        rijen.push({ id: g.id, uitslag: 'nietGemeten',
          reden: 'registratie mislukte; zonder eigen lid is de meting vervuild door het gespreksgeheugen' });
        continue;
      }
      const lijf = { q: g.input };
      if (g.contextGeval) lijf.context = g.contextGeval;
      const r = await post(srv.basis, '/api/fluister', lijf, token);
      if (r.status !== 200 || !r.data) {
        rijen.push({ id: g.id, uitslag: 'nietGemeten', reden: 'de route gaf status ' + r.status });
        continue;
      }
      const spoor = r.data.spoor;
      if (!spoor) {
        /* De antwoordrail claimde hem. Die heeft eigen handelingen en die lopen
           niet langs het stuur, dus hier is NIET te zien hoe ver hij kwam.
           `gedaan` is wat die laag er zelf over zegt -- een aanwijzing en geen
           spoor, en het wordt hier ook niet als een spoor geteld. */
        rijen.push({ id: g.id, input: g.input, mag: g.sideEffectMax, uitslag: 'nietGemeten',
          gedaanVolgensAntwoordrail: !!r.data.gedaan,
          reden: 'de antwoordrail claimde deze zin (geen stuurspoor). Die laag heeft eigen ' +
            'handelingen die niet langs het stuur lopen; hoe ver deze zin kwam is hier niet vast te stellen.' });
        continue;
      }
      const b = bereikteTrede(spoor);
      const teVer = TREDEN.indexOf(b.trede) > TREDEN.indexOf(g.sideEffectMax);
      rijen.push({ id: g.id, input: g.input, klasse: g.klasse, verwachteRoute: g.verwachteRoute,
        mag: g.sideEffectMax, kwam: b.trede, uit: b.uit,
        uitslag: teVer ? 'TE_VER' : 'binnen',
        fasen: Object.fromEntries(Object.entries(spoor.perFase).map(([k, v]) => [k, v.stand])) });
    }
  } finally { await srv.klaar(); }

  const tel = (f) => rijen.filter(f).length;
  const teVer = rijen.filter((r) => r.uitslag === 'TE_VER');
  const perTrede = {};
  for (const r of rijen) if (r.kwam) perTrede[r.kwam] = (perTrede[r.kwam] || 0) + 1;

  /* HOEVEEL UITLEGVRAGEN RAAKTEN WERKELIJK IETS? Dit is het getal waar fase 3b
     om draait. PAKTE.json telt er acht die de motor BINNENLOPEN; pas hier is te
     zien of dat iets kost. */
  const uitleg = rijen.filter((r) => r.verwachteRoute === 'ANSWER');
  const uitlegRaakteIets = uitleg.filter((r) => r.kwam && r.kwam !== 'geen');

  const uit = {
    stempel: stempel(),
    wat: 'hoe ver elke menselijke zin werkelijk komt, gemeten uit het stuurspoor, ' +
      'afgezet tegen de `sideEffectMax` die het contract voor die zin noemt',
    meet: 'server/kern/stuur/menstaal.json tegen server/kern/stuur/spoor.js',
    corpus: { bestand: 'server/kern/stuur/menstaal.json', gevallenNU: GEVALLEN.length },
    telling: { gemeten: tel((r) => r.uitslag !== 'nietGemeten'),
      binnen: tel((r) => r.uitslag === 'binnen'), teVer: teVer.length,
      nietGemeten: tel((r) => r.uitslag === 'nietGemeten'),
      uitlegvragen: uitleg.length, uitlegRaakteIets: uitlegRaakteIets.length },
    perBereikteTrede: perTrede,
    /* DE EERLIJKHEID BIJ DEZE UITSLAG, en zonder deze alinea is hij te mooi.
       Elke gemeten zin komt tot `geen` -- ook de twaalf die tot `tonen` MOGEN
       komen. Dat komt doordat het corpus van de deterministische rail nergens
       `doe` aanroept: hij haalt de kaart op en laat het plan wegen, en verder
       niets. "Nul keer te ver" zegt hier dus vooral dat er nergens geprobeerd
       wordt -- het is een regressiewacht en geen uithoudingsproef.

       Daarom is de meter geijkt in plaats van geloofd: met een corpusregel die
       WEL `doe` aanroept op een schrijfpad slaat hij uit, en dat is hieronder
       uitgeschreven. */
    ijking: {
      op: '2026-09-12',
      wat: 'een corpusregel voor "toon mijn documenten" die /api/agenda/toevoegen aanroept',
      uitslag: 'de proef meldde TE_VER: kwam tot klaarzetten terwijl tonen mag, met de reden ' +
        '"pad /api/agenda/toevoegen (voorstel) -> klaarzetten; een voorstel gezet (bevestigNodig)"',
      envondstOnderweg: 'de eerste poging sloeg NIET uit, en dat was geen fout van de meter maar ' +
        'van de mutatie: `begrepen: true` haalt de twijfelpoort niet (kern/rahul/twijfel.js eist ' +
        'een zin van minstens acht tekens). De poort weigerde dus voordat er iets geselecteerd was. ' +
        'Een mutatie die door een andere poort wordt tegengehouden dan de bedoelde, bewijst niets.',
      watRTGDAARBIJDEED: 'het schrijfpad werd NIET uitgevoerd maar gaf 428 terug -- een voorstel ' +
        'dat een mens moet bevestigen. De keten deed dus precies wat hij belooft; het is de ZIN ' +
        'die verder kwam dan zijn contract toestond.'
    },
    teVer: teVer.map((r) => ({ id: r.id, input: r.input, mag: r.mag, kwam: r.kwam, uit: r.uit })),
    uitlegRaakteIets: uitlegRaakteIets.map((r) => ({ id: r.id, input: r.input, kwam: r.kwam, uit: r.uit })),
    grens: 'NUL KEER TE VER IS HIER GEEN UITHOUDINGSPROEF. Alle gemeten zinnen komen tot `geen`, ' +
      'ook de twaalf die tot `tonen` mogen komen, want het corpus van de deterministische rail ' +
      'roept nergens `doe` aan. Deze proef bewaakt dus een REGRESSIE (zie `ijking`) en bewijst ' +
      'niet dat het plafond standhoudt onder druk. ' +
      'Verder zegt hij NIET of het antwoord goed was; alleen hoe ver de machine kwam. Een zin die ' +
      'de ANTWOORDRAIL claimde draagt geen spoor en telt als nietGemeten -- die laag heeft eigen ' +
      'handelingen buiten het stuur om, en "ik kon niet kijken" is geen "er gebeurde niets". ' +
      'Twee contractvelden worden hier NIET gemeten: `blockingVraagMax` en ' +
      '`architectuurKeuzesMax` gaan over de tekst van het antwoord, en die met een regex ' +
      'beoordelen is raden. Gemeten met de DETERMINISTISCHE rail: een modelrail kan andere ' +
      'tools kiezen, en dan zegt deze uitslag niets over die rail.',
    rijen
  };
  fs.writeFileSync(DOEL, JSON.stringify(uit, null, 2) + '\n');

  if (!stil) {
    for (const r of rijen.filter((x) => x.uitslag !== 'nietGemeten'))
      console.log('  ' + String(r.kwam).padEnd(12) + ' (mag ' + String(r.mag).padEnd(11) + ') ' + r.id);
    if (teVer.length) {
      console.log('\n  TE VER:');
      for (const r of teVer) console.log('    ' + r.id + ': kwam tot ' + r.kwam + ' terwijl ' +
        r.mag + ' mag -- ' + r.uit.join('; '));
    }
    console.log('');
  }
  console.log('MENSTAALPROEF: ' + uit.telling.binnen + ' binnen het contract, ' + uit.telling.teVer +
    ' te ver, ' + uit.telling.nietGemeten + ' niet gemeten; ' + uit.telling.uitlegRaakteIets +
    ' van ' + uit.telling.uitlegvragen + ' uitlegvragen raakten iets aan');
  if (controle && teVer.length) process.exit(1);
})().catch((e) => { console.error(e); process.exit(2); });
