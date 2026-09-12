#!/usr/bin/env node
/* ============================================================================
   MENSELIJKE_UITVOERING.json -- wat er per menselijke zin WERKELIJK gebeurde.

   DIT IS EEN PROJECTIE EN GEEN BRON, en dat is niet aan het bestand te zien --
   JSON ziet er hetzelfde uit of iemand hem heeft gegenereerd of met de hand heeft
   bijgewerkt. Daarom dezelfde drie handhavingen als EXECUTION_MAP.json
   (test/menselijkeuitvoering.test.js):

     1 het bestand is byte voor byte gelijk aan wat de bronnen NU opleveren, dus
       een handmatige wijziging EN een generator die iets anders doet zonder dat
       een bron veranderde, worden allebei rood;
     2 waar twee bronnen van DEZELFDE leeftijd elkaar tegenspreken, staat
       ONBEPAALD met beide waarden -- nooit stil een winnaar;
     3 elk veld waarvan we de waarde niet kennen staat er als `onbekend` MET
       REDEN. Een register dat een kolom invult omdat hij nu eenmaal bestaat,
       verzint hem.

   HIJ MEET NIETS. Er wordt geen server gestart, geen browser geopend en geen zin
   gesteld. Alles komt uit registers die hun eigen ronde al hebben gedraaid; dit
   bestand LEGT ZE NAAST ELKAAR. Zou hij zelf meten, dan was er een tweede meting
   van dezelfde keten en dan is de vraag welke van de twee geldt.

   GEEN TIJDSTEMPEL, WEL VINGERAFDRUKKEN. Een projectie die een klok draagt,
   verandert bij elke ronde en is dan niet meer byte voor byte te vergelijken --
   dezelfde keuze als in scripts/executionmap.js. Wat er wel in staat is de
   sha256 van elke bron EN de commit waarop die bron zichzelf heeft gemeten,
   zodat een lezer ziet of hij naar registers van verschillende leeftijd kijkt.

   EEN LEEFTIJDSVERSCHIL IS GEEN TEGENSPRAAK (CODE.md par. 0.9). Zeggen twee
   registers iets anders terwijl ze op verschillende commits zijn gemeten, dan is
   dat een verschil in leeftijd; die twee bij elkaar optellen maakt van een oude
   meting een fout. Ze staan daarom apart in `leeftijdsverschillen` en in
   `tegenspraken`, en die twee worden nooit opgeteld.

   WAAROM `bewijs` GEEN SPOOR-ID DRAAGT, en dat corrigeert de opzet. Het
   voorstel noemt `"bewijs": ["trace:...", "test:..."]`. Een spoor-id is
   verzoekgebonden en verdwijnt aan het eind van de aanroep (kern/stuur/spoor.js);
   ernaar verwijzen levert een bewijsstuk op dat niemand kan openen, en dat is
   erger dan geen bewijsstuk. Wat er wel staat is narekenbaar: welk register de
   uitkomst mat, op welke commit, en WELKE WACHT er aantoonbaar afgaat als die
   schakel wordt weggehaald -- dat laatste uit MENSMUTATIE.json, via het veld
   `bewaakt` dat de mutaties zelf dragen. Zo is "bewezen" hier niet een woord
   maar een verwijzing naar een mutatie die iemand heeft zien zakken.

   Draai:  node scripts/menselijkeuitvoering.js             schrijft het bestand
           node scripts/menselijkeuitvoering.js --controle   foutcode bij afwijking
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'MENSELIJKE_UITVOERING.json');

const BRONNEN = ['server/kern/stuur/menstaal.json', 'MENSTAALPROEF.json',
  'MENSMUTATIE.json', 'PAKTE.json', 'scripts/menselijkeuitvoering.js'];

function vingerafdruk(bestand) {
  try { return crypto.createHash('sha256').update(fs.readFileSync(path.join(WORTEL, bestand))).digest('hex').slice(0, 16); }
  catch (e) { return null; }
}
function lees(bestand) {
  try { return JSON.parse(fs.readFileSync(path.join(WORTEL, bestand), 'utf8')); }
  catch (e) { return null; }
}

/* TEGENSPRAAK OF LEEFTIJDSVERSCHIL -- een eigen functie, en dat is geen
   opsmuk. Zolang er vandaag toevallig geen enkel leeftijdsverschil is, kan een
   toets op de LIJSTEN dit onderscheid niet zien zakken: elke mutatie erop is een
   no-op. Als functie is hij wel te beproeven, met invoer die het geval afdwingt.
   Dat is precies de vorm waarin scripts/menstaalproef.js zijn ijking ook al
   moest vinden -- een mutatie die niets verandert, bewijst niets.

   DRIE UITKOMSTEN EN GEEN TWEE. Weet een van beide bronnen niet op welke commit
   hij is gemeten, dan is het verschil NIET in te delen: dat stil een tegenspraak
   noemen, maakt van een register zonder stempel een beschuldiging. */
function soortVerschil(commitA, commitB) {
  if (!commitA || !commitB) return 'onbekend';
  return commitA === commitB ? 'tegenspraak' : 'leeftijdsverschil';
}

/* Een onbekende draagt altijd een REDEN. Een kale lijst namen leest als een
   lijst gebreken; wat een lezer nodig heeft is waarom het er niet staat. */
const onb = (wat, waarom) => ({ wat, waarom });

function bouw() {
  const contract = lees('server/kern/stuur/menstaal.json');
  const proef = lees('MENSTAALPROEF.json');
  const mut = lees('MENSMUTATIE.json');
  const pakte = lees('PAKTE.json');
  if (!contract) return { fout: 'server/kern/stuur/menstaal.json ontbreekt' };
  if (!proef) return { fout: 'MENSTAALPROEF.json ontbreekt -- draai eerst: npm run menstaalproef' };
  if (!mut) return { fout: 'MENSMUTATIE.json ontbreekt -- draai eerst: npm run mensmutatie' };

  const commitVan = (j) => (j && j.stempel && j.stempel.commit) || null;
  const leeftijden = {
    'MENSTAALPROEF.json': commitVan(proef),
    'MENSMUTATIE.json': commitVan(mut),
    'PAKTE.json': pakte ? commitVan(pakte) : null
  };
  const commits = [...new Set(Object.values(leeftijden).filter(Boolean))];

  /* WELKE WACHT BEWIJST WELKE SCHAKEL. Uit MENSMUTATIE.json en niet uit een
     tabel hier: de mutaties dragen zelf `bewaakt`. Alleen mutaties die ECHT een
     wacht lieten zakken tellen -- een mutatie waar niets van afging bewijst
     juist het tegenovergestelde. */
  const bewijsPer = {};
  const zonderWacht = {};
  for (const m of (mut.mutaties || [])) {
    const k = m.bewaakt;
    if (!k) continue;
    if (m.staat === 'GEZAKT') {
      (bewijsPer[k] = bewijsPer[k] || []).push('mutatie ' + m.nr + ' -> ' +
        (m.beet || []).map((b) => b.wacht).join(', '));
    } else if (m.staat === 'GEEN_WACHT') {
      (zonderWacht[k] = zonderWacht[k] || []).push('mutatie ' + m.nr + ': ' + m.naam);
    }
  }

  const rijPakte = new Map((pakte && pakte.rijen ? pakte.rijen : []).map((r) => [r.id, r]));
  const perId = new Map((proef.rijen || []).map((r) => [r.id, r]));

  const scenarios = [];
  const tegenspraken = [];
  const leeftijdsverschillen = [];

  for (const g of (contract.gevallen || [])) {
    const r = perId.get(g.id);
    if (!r) continue;                    /* niet in deze ronde gemeten */
    const onbekend = [];

    if (r.uitslag === 'nietGemeten') {
      scenarios.push({ scenario: g.id, input: g.input, klasse: g.klasse, context: g.context,
        keten: 'ONBEPAALD', mandaat: 'ONBEPAALD',
        onbekend: [onb('de hele keten', r.reden || 'niet gemeten')] });
      continue;
    }

    const f = r.fasen || {};
    /* De capability zegt alleen of er EEN GEKOZEN is. Waarom er geen was, staat
       in het plan -- `nietGekozen` en `nietGevonden` zijn niet hetzelfde, en het
       spoor kent alleen die eerste. */
    const capability = f.CAPABILITY_SELECTED === 'PASS' ? 'gekozen' : 'nietGekozen';

    /* TEGENSPRAAK 1: het contract noemt dit geval ambigu, en dan hoort er niets
       te gebeuren. Komt de keten toch ergens, dan zeggen twee bronnen van
       DEZELFDE leeftijd iets anders over dezelfde zin. */
    if (g.ambigu && r.kwam && r.kwam !== 'geen')
      tegenspraken.push({ scenario: g.id, veld: 'ambigu',
        contract: 'ambigu, dus sideEffectMax `geen`', gemeten: 'kwam tot ' + r.kwam });

    /* LEEFTIJDSVERSCHIL: PAKTE.json is een andere ronde. Zegt hij dat de
       antwoordrail deze zin claimde terwijl er nu een stuurspoor is, dan is dat
       geen tegenspraak maar een oudere meting -- en dat staat er ook zo. */
    const p = rijPakte.get(g.id);
    if (p && p.uitslag === 'antwoordrail' && r.fasen) {
      const soort = soortVerschil(leeftijden['PAKTE.json'], leeftijden['MENSTAALPROEF.json']);
      const regel = { scenario: g.id, soort,
        veld: 'wie claimde de zin', pakte: 'antwoordrail', menstaalproef: 'het stuur (er is een spoor)',
        opgemetenOp: { 'PAKTE.json': leeftijden['PAKTE.json'], 'MENSTAALPROEF.json': leeftijden['MENSTAALPROEF.json'] } };
      (soort === 'tegenspraak' ? tegenspraken : leeftijdsverschillen).push(regel);
    }

    /* WAT WE VAN DEZE RIJ NIET WETEN, per stuk met de reden. */
    onbekend.push(onb('architectuurKeuzesMax',
      'niet gemeten: of een antwoord de mens een wereld of app laat kiezen is niet uit de tekst ' +
      'af te lezen zonder te raden (MENSTAALPROEF.json, veld architectuurKeuzes)'));
    onbekend.push(onb('de interpretatie zelf',
      'gemeten op de DETERMINISTISCHE rail: de uitleg van deze zin is gescript, dus hier staat ' +
      'wat de machine ONDER de interpretatie deed en niet dat een model hem zo zou uitleggen'));
    if (capability === 'nietGekozen' && !r.planReden)
      onbekend.push(onb('waarom er geen capability was',
        'het plan liet geen bezwaar achter; het spoor zegt alleen dat er niets is gekozen'));
    if (f.EXECUTED === 'OVERGESLAGEN')
      onbekend.push(onb('de terugweg',
        'er is niets uitgevoerd, dus er valt niets terug te draaien -- HERSTELPROEF.json zegt ' +
        'niets over een keten die niet tot uitvoering kwam'));

    scenarios.push({
      scenario: g.id, input: g.input, klasse: g.klasse, context: g.context,
      verwachtDoel: g.verwachtDoel, ambigu: !!g.ambigu,
      keten: {
        CONTEXT_SANITIZED: f.CONTEXT_SANITIZED, INTENT_RESOLVED: f.INTENT_RESOLVED,
        PLAN_COMPILED: f.PLAN_COMPILED, CONSEQUENCE_EVALUATED: f.CONSEQUENCE_EVALUATED,
        MANDATE_EVALUATED: f.MANDATE_EVALUATED, CAPABILITY_SELECTED: f.CAPABILITY_SELECTED,
        PROJECTED: f.PROJECTED, EXECUTED: f.EXECUTED
      },
      capability,
      waarom: r.planReden || undefined,
      mandaat: { mag: g.sideEffectMax, kwam: r.kwam, binnen: r.uitslag === 'binnen', uit: r.uit },
      vragen: { mag: r.magVragen, gesteld: r.vragen, binnen: !r.teVeelVragen },
      bewijs: bewijsVan(f, bewijsPer),
      onbekend
    });
  }

  const tel = (f) => scenarios.filter(f).length;
  return {
    wat: 'per menselijke zin: welke schakels van de uitvoeringsketen werkelijk liepen, hoe ver ' +
      'hij kwam, en welke wacht er aantoonbaar afgaat als een schakel wordt weggehaald',
    vorm: 'PROJECTIE -- afgeleid uit de registers hieronder, nooit met de hand bijgewerkt. ' +
      'test/menselijkeuitvoering.test.js hercompileert hem en vergelijkt byte voor byte.',
    bronnen: Object.fromEntries(BRONNEN.map((b) => [b, vingerafdruk(b)])),
    gemetenOp: leeftijden,
    /* EEN PROJECTIE OVER REGISTERS VAN VERSCHILLENDE LEEFTIJD IS GEEN FOUT, maar
       hij is ook geen momentopname -- en dat hoort een lezer te zien voordat hij
       twee getallen bij elkaar optelt. */
    eenLeeftijd: commits.length === 1,
    telling: { scenarios: scenarios.length,
      binnenContract: tel((s) => s.mandaat && s.mandaat.binnen === true),
      buitenContract: tel((s) => s.mandaat && s.mandaat.binnen === false),
      nietGemeten: tel((s) => s.keten === 'ONBEPAALD'),
      totUitvoering: tel((s) => s.keten !== 'ONBEPAALD' && s.keten.EXECUTED !== 'OVERGESLAGEN'),
      tegenspraken: tegenspraken.length, leeftijdsverschillen: leeftijdsverschillen.length },
    tegenspraken, leeftijdsverschillen,
    schakelsZonderWacht: zonderWacht,
    grens: 'DIT REGISTER MEET NIETS ZELF. Het legt registers naast elkaar die hun eigen ronde al ' +
      'hebben gedraaid; klopt een van die rondes niet, dan klopt dit ook niet. `bewijs` verwijst ' +
      'met opzet niet naar een spoor-id (die is verzoekgebonden en weg na de aanroep) maar naar ' +
      'een mutatie die iemand heeft zien zakken. Een schakel die in `schakelsZonderWacht` staat, ' +
      'liep wel maar wordt door niets bewaakt -- dat is een uitspraak over de toetsen en niet ' +
      'over de code. En alles hier is gemeten op de deterministische rail.',
    scenarios
  };
}

/* WELKE WACHT BEWIJST DEZE RIJ. Alleen voor schakels die in DEZE rij ook echt
   liepen: zeggen dat PLAN_COMPILED bewaakt wordt bij een zin die nooit een plan
   maakte, is bewijs lenen van een andere zin. */
function bewijsVan(fasen, bewijsPer) {
  const uit = [];
  for (const [fase, stand] of Object.entries(fasen || {})) {
    if (stand === 'OVERGESLAGEN' || !bewijsPer[fase]) continue;
    for (const b of bewijsPer[fase]) uit.push(fase + ': ' + b);
  }
  return uit;
}

function tekst(k) { return JSON.stringify(k, null, 1) + '\n'; }

if (require.main !== module) { module.exports = { bouw, tekst, BRONNEN, soortVerschil }; return; }

const controle = process.argv.includes('--controle');
const k = bouw();
if (k.fout) { console.error(k.fout); process.exit(2); }
const nieuw = tekst(k);
const oud = fs.existsSync(DOEL) ? fs.readFileSync(DOEL, 'utf8') : null;
if (controle) {
  if (oud !== nieuw) {
    console.error('MENSELIJKE_UITVOERING.json wijkt af van de hercompilatie -- met de hand ' +
      'gewijzigd, of een bron veranderde. Draai: npm run menselijkeuitvoering');
    process.exit(1);
  }
  console.log('MENSELIJKE_UITVOERING: gelijk aan de bronnen.');
} else {
  fs.writeFileSync(DOEL, nieuw);
  console.log('MENSELIJKE_UITVOERING: ' + k.telling.scenarios + ' scenario(s), ' +
    k.telling.binnenContract + ' binnen het contract, ' + k.telling.totUitvoering +
    ' tot in de uitvoeringsfase, ' + k.telling.tegenspraken + ' tegenspraak/tegenspraken, ' +
    k.telling.leeftijdsverschillen + ' leeftijdsverschil(len)' +
    (k.eenLeeftijd ? '' : ' -- LET OP: de bronnen zijn op verschillende commits gemeten (' +
      Object.entries(k.gemetenOp).map(([b, c]) => b + ' ' + c).join(', ') +
      '), dus dit is geen momentopname'));
}
