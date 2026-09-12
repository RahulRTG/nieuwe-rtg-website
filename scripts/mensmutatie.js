#!/usr/bin/env node
/* ============================================================================
   DE TIEN MUTATIES -- bijt de menselijke uitvoeringsketen eigenlijk wel?

   WAT DIT BEANTWOORDT. MENSTAALPROEF.json staat groen, de vier tanden staan op
   nul en `npm test` is heel. Dat zegt alleen dat er niets zakt; het zegt niet
   dat er IETS KAN zakken. Deze motor haalt een voor een een GARANTIE weg uit de
   echte bron en kijkt welke wacht dan afgaat. Blijft alles groen, dan hing die
   garantie nergens aan -- en dat is een gat dat geen enkele groene suite laat
   zien. LAT.md regel 2: een toets die je niet hebt zien zakken is geen toets.

   WAAROM DIT scripts/mutatie.js NIET OVERDOET, en dat verschil is de hele reden
   dat dit bestand bestaat. Die motor is MECHANISCH en vraagt PER TOETSBESTAND:
   kan dit bestand zakken als ik ergens een `true` in `false` verander? Deze
   motor is SEMANTISCH en vraagt PER GARANTIE: als de resolver wordt
   overgeslagen, als het plafond wordt opgetild, als een dubbelzinnige
   verwijzing toch wordt gekozen -- welke wacht bijt dan? Die twee vragen
   overlappen niet: een mechanische operator vindt de resolver-bypass nooit,
   want die is geen operator maar een besluit.

   DE TIEN KOMEN NIET VAN MIJ. Ze staan letterlijk in de opdracht van de
   eigenaar ("Als alle tien aantoonbaar een relevante test rood maken, krijg je
   een veel sterker bewijs dan 120 tests groen"), en ze zijn hier een op een
   overgenomen in plaats van herschreven. Twee ervan (9 en 10) blijken TWEE
   mutaties te zijn en geen een -- zie de tabel.

   DE NULMETING GAAT VOOR. Elke wacht draait eerst op de SCHONE boom. Is hij
   daar al rood, dan bewijst een rode wacht na de mutatie niets, en zegt de
   uitslag dat ook (`nulmetingRood`). Zonder die ronde is "hij zakte" een
   bewering over de mutatie waar hij misschien niets mee te maken had.

   DE BRON KOMT BYTE VOOR BYTE TERUG. Voor en na elke mutatie wordt een sha256
   van elk aangeraakt bestand genomen; wijkt hij af, dan stopt de motor met een
   foutcode in plaats van door te gaan op een boom die hij zelf heeft verbouwd.
   En de proef draait met `--niet-schrijven`: een uitslag uit gemuteerde code
   hoort niet in MENSTAALPROEF.json. Dat is hier een keer echt misgegaan met
   APPWERKT.json, en het viel pas op in de commit.

   WAT DEZE MOTOR NIET BEWEERT:
   - Een wacht die zakt is bewezen GEVOELIG, niet bewezen GOED. Hij kan op de
     verkeerde reden zakken; daarom staat per mutatie de MELDING in de uitslag
     en niet alleen een vinkje.
   - Een mutatie waar niets van zakt is geen bewijs dat het gedrag verkeerd is.
     Hij bewijst dat NIEMAND HET MERKT, en dat is een uitspraak over de wachten.
   - Alles hier draait op de DETERMINISTISCHE rail. Een modelrail kan andere
     gereedschappen kiezen; wat hier zakt zegt niets over die rail.

   Draai:  node scripts/mensmutatie.js            alles, schrijft MENSMUTATIE.json
           node scripts/mensmutatie.js --controle  foutcode zodra er een gat bij komt
           node scripts/mensmutatie.js 7           alleen mutatie 7
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { stempel } = require('./lib/stempel');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'MENSMUTATIE.json');

/* DE WACHTEN, en ze draaien alle zeven bij ELKE mutatie.

   De verleiding is om per mutatie alleen de wacht te draaien die hoort te
   zakken. Dat is precies het verkeerde om: dan zie je nooit dat een mutatie
   iets ANDERS sloopt dan bedoeld, en je kunt niet bewijzen dat er NIETS bijt
   -- en dat laatste is bij drie van deze mutaties de uitkomst. Zeven wachten
   van samen tien seconden is die zekerheid waard. */
const WACHTEN = [
  { naam: 'menstaal', cmd: ['node', '--test', 'test/menstaal.test.js'] },
  { naam: 'menscontext', cmd: ['node', '--test', 'test/menscontext.test.js'] },
  { naam: 'stuurspoor', cmd: ['node', '--test', 'test/stuurspoor.test.js'] },
  { naam: 'stuurrail', cmd: ['node', '--test', 'test/stuurrail.test.js'] },
  { naam: 'stuurplafond', cmd: ['node', '--test', 'test/stuurplafond.test.js'] },
  { naam: 'stuur-aanval', cmd: ['node', '--test', 'test/stuur-aanval.test.js'] },
  { naam: 'menstaalproef',
    cmd: ['node', 'scripts/menstaalproef.js', '--controle', '--stil', '--niet-schrijven'] }
];

/* WAT ELKE MUTATIE BEWAAKT, in EEN woord, zodat een andere laag erop kan
   joinen zonder een tweede tabel aan te leggen. Is het een FASE uit
   kern/stuur/spoor.js, dan staat die naam er letterlijk -- dan kan
   scripts/menselijkeuitvoering.js per fase zeggen welke wacht hem bewijst. Is
   het geen fase (de trede, een referent, een onbekende zin, het aantal vragen,
   een architectuurkeuze), dan staat er een eigen woord. test/mensmutatie.test.js
   houdt vast dat een fasenaam ook echt in FASEN staat: een typefout zou de join
   stil leeg maken, en dan zou een fase eruitzien alsof niemand hem bewaakt. */
const L = 'server/kern/stuur/lus.js';
const LS = 'server/kern/stuur/lusstap.js';
const PL = 'server/kern/stuur/plafond.js';
const RC = 'server/kern/stuur/rail-corpus.js';
const RCC = 'server/kern/stuur/rail-corpus-context.js';
const CON = 'server/kern/stuur/menstaal.json';

/* De projectie van geval B ("die andere" met EEN alternatief). Drie mutaties
   grijpen hem aan, en met opzet dezelfde: hij is de enige gescriptte zin die
   een mens werkelijk te lezen krijgt EN waar test/menscontext.test.js alleen op
   "14:00" en "niet 16:00" toetst. Wie er een tweede vraag of een wereldkeuze in
   zet, verandert dus het GEDRAG zonder een tekstwacht te raken -- en dat is
   precies wat mutatie 9b en 10b moeten kunnen meten. */
const B_PROJECTIE = "projectie: 'Je bedoelt de afspraak van 14:00. Dit is wat daarover bekend is; ' +\n" +
  "        'zeg het maar als er iets moet veranderen.' }";

const MUTATIES = [
  { nr: '1', naam: 'context verwijderd',
    bewaakt: 'CONTEXT_SANITIZED',
    weg: 'de gesaneerde schermcontext bereikt de lus niet meer',
    hoortTeZakken: 'de gesprekssamenhang: dezelfde zin met een ander scherm geeft dan dezelfde uitkomst',
    tekst: [{ bestand: L,
      van: 'menscontext.saneer(opties && opties.context)',
      naar: 'menscontext.saneer(null)' }] },

  { nr: '2', naam: 'resolver bypass',
    bewaakt: 'INTENT_RESOLVED',
    weg: 'de echte resolver draait niet en INTENT_RESOLVED wordt niet gemerkt',
    hoortTeZakken: 'het spoor is incompleet',
    tekst: [
      { bestand: LS, van: ': resolveer(kaartVraag, toegestaan);',
        naar: ": { paden: toegestaan, versmald: false, reden: 'BYPASS' };" },
      { bestand: LS, van: "spoor && spoor.mark('INTENT_RESOLVED', 'PASS',",
        naar: "false && spoor.mark('INTENT_RESOLVED', 'PASS'," }] },

  { nr: '3', naam: 'plan bypass',
    bewaakt: 'PLAN_COMPILED',
    weg: 'de echte compileer() draait niet en PLAN_COMPILED wordt niet gemerkt',
    hoortTeZakken: 'het spoor is incompleet',
    tekst: [
      { bestand: LS, van: 'const gewogen = compileer(t.input || {}, wereld);',
        naar: 'const gewogen = { uitvoerbaar: true, bezwaren: [], stappen: [] };' },
      { bestand: LS, van: "spoor && spoor.mark('PLAN_COMPILED', 'PASS',",
        naar: "false && spoor.mark('PLAN_COMPILED', 'PASS'," }] },

  { nr: '4', naam: 'gevolg bypass',
    bewaakt: 'CONSEQUENCE_EVALUATED',
    weg: 'de echte voorspel() draait niet en CONSEQUENCE_EVALUATED wordt niet gemerkt',
    hoortTeZakken: 'het spoor is incompleet',
    tekst: [
      { bestand: LS, van: 'const gevolg = voorspel(gewogen);', naar: 'const gevolg = null;' },
      { bestand: LS,
        van: "spoor && spoor.mark('CONSEQUENCE_EVALUATED', 'PASS', { graad: gevolg && gevolg.graad });",
        naar: "false && spoor.mark('CONSEQUENCE_EVALUATED', 'PASS', { graad: gevolg && gevolg.graad });" }] },

  { nr: '5', naam: 'mandaat bypass',
    bewaakt: 'MANDATE_EVALUATED',
    weg: 'de padenlijst wordt niet meer gefilterd: de wereldgrens en de plafondgrendel vallen weg',
    hoortTeZakken: 'de veiligheidspoort',
    tekst: [{ bestand: L, van: 'const over = alle.filter(opties.filter || (() => true));',
      naar: 'const over = alle;' }] },

  { nr: '6', naam: 'mandaat omhoog geforceerd',
    bewaakt: 'trede',
    weg: 'zonder mandaat staat het plafond op `uitvoeren` in plaats van `tonen`',
    hoortTeZakken: 'de plafondtoets',
    tekst: [{ bestand: PL, van: "const STANDAARD = 'tonen';", naar: "const STANDAARD = 'uitvoeren';" }] },

  { nr: '7', naam: 'ambigue referent gekozen',
    bewaakt: 'referent',
    weg: 'met TWEE gelijkwaardige alternatieven kiest de keten er toch een',
    hoortTeZakken: 'de referentveiligheid',
    tekst: [{ bestand: RCC,
      van: "verhelder('Er staan er twee naast die van 10:00: die van 14:00 en die van 16:00. ' +\n" +
        "      'Welke bedoel je?')",
      naar: "{ stappen: [{ tools: [{ name: 'kaart', input: {} }] },\n" +
        "      { tools: [{ name: 'doe', input: { pad: '/api/agenda/mijn', zeker: true,\n" +
        "        begrepen: 'de agenda van dit lid lezen om de afspraak van 14:00 te tonen',\n" +
        "        body: {} } }] }],\n" +
        "      projectie: 'Je bedoelt de afspraak van 14:00.' }" }] },

  { nr: '8', naam: 'UNKNOWN behandeld als READ_ONLY',
    bewaakt: 'onbekendeZin',
    weg: 'een zin die de rail NIET kent levert toch een leesactie op in plaats van niets',
    hoortTeZakken: 'de zijeffecttoets van de rail',
    tekst: [{ bestand: RC, van: 'if (!regel) return tekstbeurt(NIET_HERKEND);',
      naar: "if (!regel) return toolbeurt([{ name: 'kaart', input: {} }], aantalBeurten(messages));" }] },

  { nr: '9a', naam: '2 vragen tegelijk -- in het CONTRACT',
    bewaakt: 'blokkerendeVragen',
    weg: 'het contract staat een geval toe dat twee blokkerende vragen tegelijk stelt',
    hoortTeZakken: 'de menselijke-inspanningstoets',
    contract: [{ bestand: CON, geval: 'amb-die-andere-2', veld: 'blockingVraagMax', naar: 2 }] },

  { nr: '9b', naam: '2 vragen tegelijk -- in het ANTWOORD',
    bewaakt: 'blokkerendeVragen',
    weg: 'het antwoord dat een mens leest stelt er werkelijk twee, terwijl het contract er 1 toestaat',
    hoortTeZakken: 'dezelfde toets, maar dan op het gedrag in plaats van op het contract',
    tekst: [{ bestand: RCC, van: B_PROJECTIE,
      naar: "projectie: 'Je bedoelt de afspraak van 14:00. Wil je hem zien? ' +\n" +
        "        'En moet ik er meteen iets aan veranderen?' }" }] },

  { nr: '10a', naam: 'wereldkeuze verplicht -- in het CONTRACT',
    bewaakt: 'architectuurkeuze',
    weg: 'het contract staat een geval toe waarin de mens zelf een wereld of app kiest',
    hoortTeZakken: 'de architectuurkeuzetoets',
    contract: [{ bestand: CON, geval: 'amb-die-andere-2', veld: 'architectuurKeuzesMax', naar: 1 }] },

  /* GEEN VRAAGTEKEN IN DEZE MUTATIE, en dat is geen stijlkwestie.

     De eerste versie luidde "Zal ik dit in RTG Agenda of in RTG Reizen
     regelen?" en die LIET EEN WACHT ZAKKEN -- de vragenteller van mutatie 9b,
     want dit geval mag er nul stellen. Daarmee stond er `gezakt` bij een
     mutatie die over iets heel anders gaat, en was het gat van 10b weggepoetst
     door een wacht die er niets mee te maken heeft. Een wacht die om de
     VERKEERDE reden zakt, bewijst niets (dezelfde fout als in de ijking van
     scripts/menstaalproef.js). De zin dwingt nu dezelfde keuze af zonder iets
     te vragen, zodat alleen een echte architectuurwacht hem kan zien. */
  { nr: '10b', naam: 'wereldkeuze verplicht -- in het ANTWOORD',
    bewaakt: 'architectuurkeuze',
    weg: 'het antwoord laat de mens werkelijk kiezen tussen twee RTG-werelden',
    hoortTeZakken: 'dezelfde toets, maar dan op het gedrag in plaats van op het contract',
    tekst: [{ bestand: RCC, van: B_PROJECTIE,
      naar: "projectie: 'Je bedoelt de afspraak van 14:00. Zeg maar of ik dit in RTG Agenda ' +\n" +
        "        'regel of in RTG Reizen.' }" }] }
];

function hash(p) { return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'); }

function draai(w) {
  const r = spawnSync(w.cmd[0], w.cmd.slice(1), { cwd: WORTEL, encoding: 'utf8', timeout: 300000 });
  const uit = String(r.stdout || '') + String(r.stderr || '');
  return { groen: r.status === 0, code: r.status, uit };
}

/* DE EERSTE REGEL DIE ERTOE DOET. Een wacht die zakt geeft honderden regels
   terug; wat een mens moet zien is WAAROM. Bij node --test is dat de eerste
   `not ok` met de melding eronder, bij de proef de eerste gebrekregel. */
function melding(uit) {
  const regels = String(uit).split('\n');
  const nok = regels.findIndex((r) => /^not ok /.test(r.trim()));
  if (nok >= 0) {
    const stuk = regels.slice(nok, nok + 14);
    const err = stuk.find((r) => /error:/i.test(r));
    return (regels[nok].trim() + (err ? ' -- ' + err.trim() : '')).slice(0, 300);
  }
  const gebrek = regels.find((r) => /^\s+- /.test(r) && r.length > 12);
  if (gebrek) return gebrek.trim().slice(0, 300);
  /* De bevindingsregels van de proef staan onder een kop en beginnen niet met
     een streepje; zonder deze regel valt de melding terug op de SAMENVATTING,
     en dan staat er bij elke gezakte proef dezelfde zin. */
  const bevinding = regels.find((r) => /vragen terwijl er|kwam tot .* terwijl/.test(r));
  if (bevinding) return bevinding.trim().slice(0, 300);
  const ander = regels.find((r) => /NIET heel|TE VER|Error/i.test(r));
  return ander ? ander.trim().slice(0, 300) : '(geen leesbare melding)';
}

function pasToe(m) {
  const raak = new Set();
  for (const t of (m.tekst || [])) {
    const p = path.join(WORTEL, t.bestand);
    const s = fs.readFileSync(p, 'utf8');
    const n = s.split(t.van).length - 1;
    if (n !== 1) return { ok: false, reden: 'het ankerpunt staat ' + n + ' keer in ' + t.bestand +
      ' -- een mutatie die niet precies past, bewijst niets' };
    fs.writeFileSync(p, s.replace(t.van, t.naar));
    raak.add(t.bestand);
  }
  for (const c of (m.contract || [])) {
    const p = path.join(WORTEL, c.bestand);
    const d = JSON.parse(fs.readFileSync(p, 'utf8'));
    const g = (d.gevallen || []).find((x) => x.id === c.geval);
    if (!g) return { ok: false, reden: 'het geval ' + c.geval + ' staat niet in ' + c.bestand };
    if (g[c.veld] === c.naar) return { ok: false, reden: c.geval + '.' + c.veld +
      ' stond al op ' + c.naar + '; dan verandert deze mutatie niets' };
    g[c.veld] = c.naar;
    fs.writeFileSync(p, JSON.stringify(d, null, 2) + '\n');
    raak.add(c.bestand);
  }
  return { ok: true, bestanden: [...raak] };
}

if (require.main !== module) { module.exports = { MUTATIES, WACHTEN }; return; }

(async () => {
  const controle = process.argv.includes('--controle');
  const alleen = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const lijst = alleen.length ? MUTATIES.filter((m) => alleen.includes(m.nr)) : MUTATIES;
  if (!lijst.length) { console.error('geen mutatie met dat nummer'); process.exit(2); }

  /* Elk bestand dat straks wordt aangeraakt, eerst vastleggen. Komt het niet
     byte voor byte terug, dan stopt de motor -- doorgaan op een boom die je
     zelf hebt verbouwd, levert uitslagen op waar niemand iets aan heeft. */
  const betrokken = [...new Set(MUTATIES.flatMap((m) =>
    [...(m.tekst || []).map((t) => t.bestand), ...(m.contract || []).map((c) => c.bestand)]))];
  const voor = Object.fromEntries(betrokken.map((b) => [b, hash(path.join(WORTEL, b))]));

  /* GEEN ONGECOMMIT WERK IN DE BETROKKEN BESTANDEN. De motor zet terug met
     `git checkout --`, en dat gooit niet alleen de mutatie weg maar ook alles
     wat er nog niet in de historie stond. Liever hier stoppen dan iemands
     halve middag opruimen. */
  const vuil = String(spawnSync('git', ['status', '--porcelain', '--', ...betrokken],
    { cwd: WORTEL, encoding: 'utf8' }).stdout || '').trim();
  if (vuil) {
    console.error('ONGECOMMIT WERK in een bestand dat deze motor muteert en met git terugzet:\n' +
      vuil + '\n\nCommit of stash dat eerst -- anders gooit het terugzetten het weg.');
    process.exit(2);
  }

  console.log('DE NULMETING -- elke wacht op de schone boom:');
  const nul = {};
  for (const w of WACHTEN) {
    const r = draai(w);
    nul[w.naam] = r.groen;
    console.log('  ' + (r.groen ? 'groen ' : 'ROOD  ') + w.naam + (r.groen ? '' : ' -- ' + melding(r.uit)));
  }
  const nulRood = WACHTEN.filter((w) => !nul[w.naam]).map((w) => w.naam);
  console.log('');

  const rijen = [];
  for (const m of lijst) {
    const toe = pasToe(m);
    if (!toe.ok) {
      rijen.push({ nr: m.nr, naam: m.naam, staat: 'NIET_TOEGEPAST', reden: toe.reden });
      console.log('  ' + m.nr.padEnd(4) + ' NIET TOEGEPAST -- ' + toe.reden);
      continue;
    }
    const beet = [], bleefGroen = [], alRood = [];
    for (const w of WACHTEN) {
      const r = draai(w);
      if (r.groen) bleefGroen.push(w.naam);
      else if (!nul[w.naam]) alRood.push(w.naam);
      else beet.push({ wacht: w.naam, melding: melding(r.uit) });
    }
    /* Terugzetten gebeurt met git en niet met een bewaarde tekst: die tweede
       kopie zou zelf kunnen afwijken, en dan repareert de motor de boom naar
       iets wat er nooit stond. */
    spawnSync('git', ['checkout', '--', ...toe.bestanden], { cwd: WORTEL });
    for (const b of toe.bestanden) {
      if (hash(path.join(WORTEL, b)) !== voor[b]) {
        console.error('\nDE BRON KWAM NIET TERUG: ' + b + ' wijkt af na mutatie ' + m.nr +
          '. Gestopt; zet hem met de hand terug voor je verder gaat.');
        process.exit(2);
      }
    }
    const staat = beet.length ? 'GEZAKT' : 'GEEN_WACHT';
    rijen.push({ nr: m.nr, naam: m.naam, bewaakt: m.bewaakt, weg: m.weg, hoortTeZakken: m.hoortTeZakken,
      bestanden: toe.bestanden, staat, beet, bleefGroen, alRood: alRood.length ? alRood : undefined });
    console.log('  ' + m.nr.padEnd(4) + (staat === 'GEZAKT' ? 'gezakt     ' : 'GEEN WACHT ') +
      m.naam + (beet.length ? '  <- ' + beet.map((b) => b.wacht).join(', ') : ''));
    if (beet.length) console.log('       ' + beet[0].melding.slice(0, 160));
  }

  const gaten = rijen.filter((r) => r.staat === 'GEEN_WACHT');
  const uit = {
    stempel: stempel(),
    wat: 'de tien mutaties uit de opdracht, een voor een aangebracht in de ECHTE bron van de ' +
      'menselijke uitvoeringsketen; per mutatie welke wacht afging en met welke melding',
    meet: 'server/kern/stuur/ tegen ' + WACHTEN.length + ' wachten',
    hoe: 'nulmeting op de schone boom, dan per mutatie alle wachten, dan git checkout en een ' +
      'sha256-controle dat de bron byte voor byte terug is',
    nulmeting: { wachten: WACHTEN.map((w) => w.naam), rood: nulRood },
    telling: { mutaties: rijen.length, gezakt: rijen.filter((r) => r.staat === 'GEZAKT').length,
      geenWacht: gaten.length, nietToegepast: rijen.filter((r) => r.staat === 'NIET_TOEGEPAST').length },
    zonderWacht: gaten.map((r) => ({ nr: r.nr, naam: r.naam, weg: r.weg })),
    grens: 'EEN WACHT DIE ZAKT IS BEWEZEN GEVOELIG, NIET BEWEZEN GOED -- hij kan op de verkeerde ' +
      'reden zakken, en daarom staat de melding erbij in plaats van een vinkje. Omgekeerd is ' +
      '`GEEN_WACHT` geen oordeel over het gedrag: hij zegt dat NIEMAND HET MERKT, en dat is een ' +
      'uitspraak over de wachten en niet over de code. Alles is gemeten op de DETERMINISTISCHE ' +
      'rail; een modelrail kiest andere gereedschappen en dan zegt deze uitslag niets over die rail.',
    mutaties: rijen
  };
  fs.writeFileSync(DOEL, JSON.stringify(uit, null, 2) + '\n');

  console.log('\nMENSMUTATIE: ' + uit.telling.gezakt + ' van ' + rijen.length +
    ' mutaties lieten een wacht zakken, ' + gaten.length + ' zonder wacht' +
    (nulRood.length ? ', LET OP: ' + nulRood.length + ' wacht(en) stonden al rood in de nulmeting' : ''));
  if (gaten.length) {
    console.log('\n  ZONDER WACHT -- deze garanties hangen vandaag nergens aan:');
    for (const g of gaten) console.log('    ' + g.nr + ' ' + g.naam + ': ' + g.weg);
    console.log('');
  }
  if (controle && (nulRood.length || uit.telling.nietToegepast)) process.exit(1);
})().catch((e) => { console.error(e); process.exit(2); });
