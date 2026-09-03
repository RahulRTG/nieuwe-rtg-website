#!/usr/bin/env node
/* DE LEVENDE GETALLEN IN DE DOCUMENTEN -- een meetgetal in proza dat niet kan
   verouderen.

   HET PROBLEEM, en het is hier echt gebeurd. CLAUDE.md en CREATE.md par. 10
   noemden "van 3074 routes met een rol zijn er 115 beproefd en 2959 ongemeten".
   Dat klopte op de dag dat iemand het opschreef. Toen de idempotentieproef
   opnieuw draaide werd het 3092 / 845 / 2247, en stonden er twee documenten met
   een getal dat niemand meer nakeek. Een verkeerd getal in een document is erger
   dan geen getal: er wordt op besloten.

   ARCHITECTUUR.md en BEWIJS.md hebben dit al opgelost door HELEMAAL gegenereerd
   te zijn. Dat kan niet met CLAUDE.md: dat is proza met een redenering eromheen,
   en een generator die de redenering herschrijft maakt er onzin van. Vandaar
   deze tussenvorm: het VERHAAL blijft handwerk, het GETAL komt uit het register.

     ...zijn er <!--getal:idem.beoordeeld-->845<!--/getal--> beproefd...

   `npm run getallen` schrijft de verse waarde tussen de merktekens.
   `npm run getallen:controle` (en test/getallen.test.js) zakt zodra een document
   iets anders beweert dan het register. Zo is een verouderd getal geen kwestie
   van oplettendheid meer.

   WAT DIT NIET DOET, en dat hoort erbij: een getal ZONDER merktekens ziet dit
   script niet. Het lost dus niet op dat iemand morgen een nieuw cijfer intypt --
   het lost op dat de cijfers die we KENNEN vanzelf meelopen. De uitslag zegt
   daarom altijd hoeveel merktekens er zijn gevonden, zodat "nul" niet als "in
   orde" leest.

   EN DE BRON IS ALTIJD EEN REGISTER, nooit een berekening in dit bestand. Een
   tweede plek die zelf telt, zegt op een dag iets anders dan de meter waar hij
   over gaat (dezelfde reden als kern/command/vermogens.js). */
'use strict';
const fs = require('fs');
const path = require('path');
const WORTEL = path.join(__dirname, '..');

/* Per levend getal: uit welk register, welk veld, en wat het BETEKENT -- die
   laatste staat erbij zodat iemand die een merkteken tegenkomt weet wat hij
   leest zonder het register te openen. */
const GETALLEN = {
  'idem.routesMetRol': { bron: 'IDEMPROEF.json', veld: 'gemeten.routesMetRol',
    wat: 'routes met een rol die de idempotentieproef kon zien' },
  'idem.beoordeeld': { bron: 'IDEMPROEF.json', veld: 'gemeten.beoordeeld',
    wat: 'routes waarover de proef een uitspraak deed' },
  'idem.beschermd': { bron: 'IDEMPROEF.json', veld: 'gemeten.beschermd',
    wat: 'beoordeelde routes die een herhaling zelf opmerken' },
  'idem.onbeschermd': { bron: 'IDEMPROEF.json', veld: 'gemeten.onbeschermd',
    wat: 'beoordeelde routes die een herhaling niet opmerken' },
  'idem.ongemeten': { bron: 'IDEMPROEF.json', veld: 'gemeten.ongemeten',
    wat: 'routes waar de proef niet bij kon' },
  'vertrouwen.routes': { bron: 'VERTROUWEN.json', veld: 'telling.verzwakt',
    wat: 'routes met de vervalstaat verzwakt' },
  'vertrouwen.bewezen': { bron: 'VERTROUWEN.json', veld: 'telling.bewezen',
    wat: 'routes met de vervalstaat bewezen' },
  'vertrouwen.geschorst': { bron: 'VERTROUWEN.json', veld: 'telling.geschorst',
    wat: 'routes met de vervalstaat geschorst' },
  'capabiliteit.lijsten': { bron: 'CAPABILITEIT.json', veld: 'woordenlijsten',
    wat: 'losse capability-woordenlijsten in de code' },
  'capabiliteit.leden': { bron: 'CAPABILITEIT.json', veld: 'leden',
    wat: 'leden over al die lijsten samen' },
  'semantiek.namen': { bron: 'SEMANTIEK.json', veld: 'namenInMeerDomeinen',
    wat: 'namen die in meer dan een domein voorkomen' },
  'semantiek.betekenissen': { bron: 'SEMANTIEK.json', veld: 'woordenMetMeerBetekenissen',
    wat: 'namen die meer dan een betekenis dragen' },
  'codewereld.registers': { bron: 'CODEWERELD.json', veld: 'registers.geteld',
    wat: 'registers in de wortel die iets over deze code beweren' },
  'codewereld.paden': { bron: 'CODEWERELD.json', veld: 'ruggengraat.paden',
    wat: 'losse paden die de registers samen kennen' },
  'codewereld.ruggengraat': { bron: 'CODEWERELD.json', veld: 'ruggengraat.inMeerDanEenRegister',
    wat: 'paden die in meer dan een register staan -- de ruggengraat van een Codewereld' },
  'codewereld.ruggengraatPct': { bron: 'CODEWERELD.json', veld: 'ruggengraat.pct',
    wat: 'diezelfde ruggengraat als percentage' },
  'codewereld.brugPaden': { bron: 'CODEWERELD.json', veld: 'brug.paden',
    wat: 'paden waarvoor een register een bestand noemt' },
  'codewereld.brugToetsbaar': { bron: 'CODEWERELD.json', veld: 'brug.verschilToetsbaar',
    wat: 'paden waar TWEE registers een bestand noemen -- alleen daar valt een verschil vast te stellen' },
  'codewereld.brugDekkingPct': { bron: 'CODEWERELD.json', veld: 'brug.verschilDekkingPct',
    wat: 'die toetsbare paden als percentage van de brug' },
  'routebron.vergeleken': { bron: 'ROUTEBRON.json', veld: 'gemeten.beideKennen',
    wat: 'routes die de router-afleiding en de bronwandeling allebei kennen' },
  'routebron.gelijk': { bron: 'ROUTEBRON.json', veld: 'gemeten.gelijk',
    wat: 'daarvan met hetzelfde bestand' },
  'routebron.verouderd': { bron: 'ROUTEBRON.json', veld: 'gemeten.waarvanVerouderd',
    wat: 'verschillen die een leeftijdsverschil zijn en geen meningsverschil' },
  'routebron.tegenspraak': { bron: 'ROUTEBRON.json', veld: 'gemeten.waarvanTegenspraak',
    wat: 'echte tegenspraken: beide bestanden staan stil en toch verschillen de wegen' },
  'routebron.routerRoutes': { bron: 'ROUTEBRON.json', veld: 'gemeten.routerRoutes',
    wat: 'routes die de router werkelijk aanbiedt' },
  'routebron.zonderBestand': { bron: 'ROUTEBRON.json', veld: 'gemeten.routerRoutesZonderBestand',
    wat: 'daarvan zonder vindbare plek in de bron -- bestaan is iets anders dan vindbaar zijn' },
  'schermroutes.schermen': { bron: 'SCHERMROUTES.json', veld: 'gemeten.schermenMetPad',
    wat: 'bestanden in public/ die minstens een API-pad noemen' },
  'schermroutes.paden': { bron: 'SCHERMROUTES.json', veld: 'gemeten.exactePaden',
    wat: 'exacte API-paden die de schermen noemen' },
  'schermroutes.verwijzingen': { bron: 'SCHERMROUTES.json', veld: 'gemeten.verwijzingen',
    wat: 'verwijzingen naar die paden, over alle schermen' },
  'schermroutes.voorvoegsels': { bron: 'SCHERMROUTES.json', veld: 'gemeten.voorvoegsels',
    wat: 'paden die verdergaan (sjabloon, optelling of vraagteken) en dus geen route zijn' },
  'schermroutes.dood': { bron: 'SCHERMROUTES.json', veld: 'gemeten.doodPad',
    wat: 'exacte paden die geen bestaande route zijn en ook geen stam ervan' },
  'codewereld.relatie': { bron: 'CODEWERELD.json', veld: 'bronbereik.relatie',
    wat: 'bronbestanden waarover een RELATIEregister iets zegt (waar woont het, wat roept het aan, welk scherm gebruikt het)' },
  'graaf.kanten': { bron: 'AANROEPGRAAF.json', veld: 'gemeten.kanten',
    wat: 'afgeleide aanroepkanten tussen symbolen' },
  'graaf.aanroepen': { bron: 'AANROEPGRAAF.json', veld: 'gemeten.aanroepen',
    wat: 'aanroepen die de parser in server/ zag' },
  'graaf.opgelostPct': { bron: 'AANROEPGRAAF.json', veld: 'gemeten.opgelostPct',
    wat: 'deel daarvan dat naar een symbool te herleiden was' },
  'graaf.contextobject': { bron: 'AANROEPGRAAF.json', veld: 'gemeten.onopgelostNaarSoort.contextobject',
    wat: 'aanroepen die via het contextobject lopen en daarom structureel niet te herleiden zijn' },
  'graaf.overig': { bron: 'AANROEPGRAAF.json', veld: 'gemeten.onopgelostNaarSoort.overig',
    wat: 'onopgeloste aanroepen die GEEN van de verklaarde soorten zijn -- de echte restbak' },
  'graaf.doelOnbekend': { bron: 'AANROEPGRAAF.json', veld: 'gemeten.doelOnbekend',
    wat: 'ingevoerde namen die het doelbestand niet kent -- elke andere waarde dan nul is een bevinding' },
  'graaf.aanroepers': { bron: 'AANROEPGRAAF.json', veld: 'gemeten.symbolenMetAanroeper',
    wat: 'symbolen waarvan bekend is wie ze aanroept' },
  'graaf.routesMetSymbool': { bron: 'AANROEPGRAAF.json', veld: 'gemeten.routesMetSymbool',
    wat: 'routes waarvan minstens een afgehandeld symbool bekend is' },
  'schermgedrag.schermen': { bron: 'SCHERMGEDRAG.json', veld: 'gemeten.schermen',
    wat: 'schermen waarover een gedragsuitspraak is samengesteld of geprobeerd' },
  'schermgedrag.metGrond': { bron: 'SCHERMGEDRAG.json', veld: 'gemeten.metGrond',
    wat: 'daarvan met een echte uitspraak, want ze raken een bestaande route' },
  'schermgedrag.zonderGrond': { bron: 'SCHERMGEDRAG.json', veld: 'gemeten.zonderGrond',
    wat: 'daarvan zonder uitspraak, elk met een reden -- tellen niet als dekking' },
  'schermgedrag.schrijftJa': { bron: 'SCHERMGEDRAG.json', veld: 'gemeten.schrijftJa',
    wat: 'schermen die via de API iets kunnen veranderen' },
  'schermgedrag.bewezen': { bron: 'SCHERMGEDRAG.json', veld: 'gemeten.bewijsBewezen',
    wat: 'schermen waarvan de zwakste geraakte route bewezen is' },
  'schermgedrag.verzwakt': { bron: 'SCHERMGEDRAG.json', veld: 'gemeten.bewijsVerzwakt',
    wat: 'schermen waarvan de zwakste geraakte route verzwakt bewijs draagt' },
  'context.gereden': { bron: 'CONTEXTPROEF.json', veld: 'gemeten.routesGereden',
    wat: 'routes die de runtime-contextproef heeft aangeroepen' },
  'context.aanHetWerk': { bron: 'CONTEXTPROEF.json', veld: 'gemeten.routesAanHetWerk',
    wat: 'daarvan die werkelijk werk deden (geen 401/404/405)' },
  'context.metSpoor': { bron: 'CONTEXTPROEF.json', veld: 'gemeten.routesMetSpoor',
    wat: 'routes die TIJDENS het verzoek naar het contextobject reiken' },
  'context.zonderSpoor': { bron: 'CONTEXTPROEF.json', veld: 'gemeten.routesZonderSpoorMaarWelAanHetWerk',
    wat: 'routes die werk deden zonder tijdens het verzoek naar de kern te reiken' },
  'context.namen': { bron: 'CONTEXTPROEF.json', veld: 'gemeten.losseNamen',
    wat: 'losse kernnamen die tijdens een verzoek zijn opgehaald' },
  'context.bedrading': { bron: 'CONTEXTPROEF.json', veld: 'gemeten.buitenEenVerzoek',
    wat: 'kernnamen die bij het BEDRADEN worden opgehaald, buiten elk verzoek om' },
  'kern.namen': { bron: 'KERNHERKOMST.json', veld: 'gemeten.namen',
    wat: 'namen op het contextobject waarvan bekend is wie ze erin heeft gezet' },
  'kern.vulplekken': { bron: 'KERNHERKOMST.json', veld: 'gemeten.vulplekken',
    wat: 'plekken in de code die de zak vullen' },
  'kern.onopgelost': { bron: 'KERNHERKOMST.json', veld: 'gemeten.onopgelost',
    wat: 'vulplekken die niet te volgen zijn -- elk met een reden, nooit geraden' },
  'graaf.viaKern': { bron: 'AANROEPGRAAF.json', veld: 'gemeten.kantenViaKern',
    wat: 'aanroepkanten die dankzij de herkomst van de zak konden ontstaan' },
  'graaf.viaKernZonderSymbool': { bron: 'AANROEPGRAAF.json', veld: 'gemeten.kantenViaKernZonderSymbool',
    wat: 'daarvan die alleen het BESTAND aanwijzen, omdat de zaknaam niet de symboolnaam is' },
  'graaf.uitgepaktObject': { bron: 'AANROEPGRAAF.json', veld: 'gemeten.onopgelostNaarSoort.uitgepaktObject',
    wat: 'aanroepen op een naam die uit een eigen zak van een domein komt -- dezelfde vorm als het contextobject, maar niet de kern' },
  'graaf.externeModule': { bron: 'AANROEPGRAAF.json', veld: 'gemeten.onopgelostNaarSoort.externeModule',
    wat: 'aanroepen op een module van buiten dit huis (path, fs, crypto)' },
  'graaf.uitFabriek': { bron: 'AANROEPGRAAF.json', veld: 'gemeten.kantenUitFabriek',
    wat: 'kanten uit een naam die uit een fabriek-aanroep is uitgepakt' },
  'graaf.moduleAlsFunctie': { bron: 'AANROEPGRAAF.json', veld: 'gemeten.kantenModuleAlsFunctie',
    wat: 'kanten naar een module die zelf een functie is (require(...)() )' },
  'graaf.lidOpInvoer': { bron: 'AANROEPGRAAF.json', veld: 'gemeten.kantenLidOpInvoer',
    wat: 'kanten van een methode op iets dat uit ons eigen bestand is ingevoerd -- bestand bekend, functie niet' },
  'codewereld.bronBestanden': { bron: 'CODEWERELD.json', veld: 'bronbereik.bestanden',
    wat: 'bronbestanden die er echt staan' },
  'codewereld.bronGenoemd': { bron: 'CODEWERELD.json', veld: 'bronbereik.genoemd',
    wat: 'daarvan genoemd door enig register' },
  'codewereld.bronPct': { bron: 'CODEWERELD.json', veld: 'bronbereik.pct',
    wat: 'bronbereik STRUCTUUR: bestanden die enig register noemt (de symboolindex noemt alles)' },
  'codewereld.bronGedragPct': { bron: 'CODEWERELD.json', veld: 'bronbereik.gedragPct',
    wat: 'bronbereik GEDRAG: bestanden waarover een register buiten de symboolindex iets zegt -- de bovengrens voor een vraag over gedrag' },
  'codewereld.bronGedrag': { bron: 'CODEWERELD.json', veld: 'bronbereik.gedrag',
    wat: 'datzelfde als aantal' },
  'codewereld.symboolSleutels': { bron: 'CODEWERELD.json', veld: 'assen.symbool.sleutels',
    wat: 'symbolen met een plaats die de registers samen kennen' },
  'symbolen.gelezen': { bron: 'SYMBOLEN.json', veld: 'gemeten.gelezen',
    wat: 'bronbestanden die de symboolas heeft kunnen lezen' },
  'symbolen.nietGelezen': { bron: 'SYMBOLEN.json', veld: 'gemeten.nietGelezen',
    wat: 'bronbestanden die hij niet kon lezen -- allemaal met een reden' },
  'symbolen.bundeldeel': { bron: 'SYMBOLEN.json', veld: 'gemeten.waarvanBundeldeel',
    wat: 'daarvan bundeldelen: fragmenten die pas samengevoegd een programma vormen' },
  'symbolen.parsefout': { bron: 'SYMBOLEN.json', veld: 'gemeten.waarvanParsefout',
    wat: 'daarvan echte parsefouten -- elke andere dan nul is een bevinding' },
  'symbolen.totaal': { bron: 'SYMBOLEN.json', veld: 'gemeten.symbolen',
    wat: 'benoemde functies, klassen en methoden met een regelnummer' },
  'symbolen.kanten': { bron: 'SYMBOLEN.json', veld: 'gemeten.requireKanten',
    wat: 'require-kanten tussen bestanden -- de graaf heen en terug' },
  'symbolen.uitvoerZonderNamen': { bron: 'SYMBOLEN.json', veld: 'gemeten.uitvoerZonderNamen',
    wat: 'bestanden die iets exporteren zonder afleidbare namen (module.exports = functie)' },
  'codewereld.symbolen': { bron: 'CODEWERELD.json', veld: 'assen.symbool.proef.symbolen',
    wat: 'benoemde symbolen die de eigen parser in server/ vindt' },
  'codewereld.geparsed': { bron: 'CODEWERELD.json', veld: 'assen.symbool.proef.geparsed',
    wat: 'serverbestanden die de eigen parser aankon' },
  'codewereld.parseFout': { bron: 'CODEWERELD.json', veld: 'assen.symbool.proef.gefaald',
    wat: 'serverbestanden waarop die parser stukliep' },
  'codewereld.bronServerPct': { bron: 'CODEWERELD.json', veld: 'bronbereik.serverPct',
    wat: 'bronbereik binnen server/ -- daar kijken de meters' },
  'codewereld.bronPublicPct': { bron: 'CODEWERELD.json', veld: 'bronbereik.publicPct',
    wat: 'bronbereik binnen public/ -- daar hebben de meters vrijwel niets' },
  /* De duur van die parseronde staat MET OPZET niet in deze lijst. Een levend
     getal moet uit een register komen dat bij gelijke code hetzelfde zegt; een
     tijdmeting doet dat niet (4,6 of 4,8 op dezelfde commit), en een controle
     die willekeurig zakt leert mensen hem te negeren. Hij staat in
     CODEWERELD.json en in CODE.md als orde van grootte. */
};

/* De documenten die merktekens mogen dragen. Bewust een lijst en geen glob over
   alles: een generator die elk .md-bestand mag herschrijven, herschrijft op een
   dag ook iets dat niemand had bedoeld. */
const DOCUMENTEN = ['CLAUDE.md', 'CREATE.md', 'EXECUTIE.md', 'OS.md', 'BEWIJSMACHINE.md', 'CODE.md'];

const MERK = /<!--getal:([a-zA-Z0-9._-]+)-->([\s\S]*?)<!--\/getal-->/g;

function leesVeld(bron, veld) {
  let data;
  try { data = JSON.parse(fs.readFileSync(path.join(WORTEL, bron), 'utf8')); }
  catch (e) { return { fout: 'register ' + bron + ' niet leesbaar' }; }
  let v = data;
  for (const stuk of veld.split('.')) {
    if (v == null || typeof v !== 'object') return { fout: 'veld ' + veld + ' ontbreekt in ' + bron };
    v = v[stuk];
  }
  if (v == null) return { fout: 'veld ' + veld + ' is leeg in ' + bron };
  return { waarde: String(v) };
}

function ronde({ schrijf }) {
  const bevindingen = [];
  let merktekens = 0, bijgewerkt = 0;
  for (const doc of DOCUMENTEN) {
    const pad = path.join(WORTEL, doc);
    let tekst;
    try { tekst = fs.readFileSync(pad, 'utf8'); } catch (e) { continue; }
    /* EERST TELLEN OF DE MERKTEKENS IN BALANS ZIJN. Zonder deze controle is een
       sluittag met een typefout (`<!--/getal>` in plaats van `<!--/getal-->`)
       onzichtbaar: de reguliere uitdrukking loopt dan door tot de VOLGENDE
       sluittag en slikt het getal ertussen op. Dat is hier twee keer gebeurd,
       en beide keren viel het alleen op omdat de opgeslokte waarde toevallig
       verschilde van zijn register. Een merkteken dat zijn sluittag mist, hoort
       de controle te laten zakken en niet af te hangen van toeval. */
    const openers = (tekst.match(/<!--getal:[a-zA-Z0-9._-]+-->/g) || []).length;
    const sluiters = (tekst.match(/<!--\/getal-->/g) || []).length;
    if (openers !== sluiters) {
      bevindingen.push({ doc, id: '(document)', soort: 'onbalans',
        wat: openers + ' openende merktekens tegenover ' + sluiters + ' sluitende. Een sluittag ontbreekt of is verkeerd geschreven; ' +
          'de eerstvolgende waarde wordt dan opgeslokt.' });
    }
    let nieuw = tekst;
    nieuw = tekst.replace(MERK, (heel, id, staat) => {
      merktekens++;
      const reg = GETALLEN[id];
      if (!reg) { bevindingen.push({ doc, id, soort: 'onbekend', wat: 'geen register-ingang voor dit merkteken' }); return heel; }
      const uit = leesVeld(reg.bron, reg.veld);
      if (uit.fout) { bevindingen.push({ doc, id, soort: 'bronstuk', wat: uit.fout }); return heel; }
      if (staat !== uit.waarde) {
        bevindingen.push({ doc, id, soort: 'verouderd', wat: 'document zegt ' + staat + ', register zegt ' + uit.waarde });
        bijgewerkt++;
        return '<!--getal:' + id + '-->' + uit.waarde + '<!--/getal-->';
      }
      return heel;
    });
    if (schrijf && nieuw !== tekst) fs.writeFileSync(pad, nieuw);
  }
  const ongebruikt = Object.keys(GETALLEN).filter(id =>
    !DOCUMENTEN.some(doc => {
      try { return fs.readFileSync(path.join(WORTEL, doc), 'utf8').includes('<!--getal:' + id + '-->'); }
      catch (e) { return false; }
    }));
  return { merktekens, bijgewerkt, bevindingen, ongebruikt };
}

function main() {
  const controle = process.argv.includes('--controle');
  const r = ronde({ schrijf: !controle });
  console.log('LEVENDE GETALLEN IN DE DOCUMENTEN\n');
  console.log('  ' + r.merktekens + ' merkteken(s) in ' + DOCUMENTEN.length + ' document(en)');
  if (!r.merktekens) console.log('  LET OP: nul merktekens is niet "in orde" -- dan bewaakt dit script niets.');
  for (const b of r.bevindingen) console.log('  [' + b.soort + '] ' + b.doc + ' :: ' + b.id + ' -- ' + b.wat);
  if (r.ongebruikt.length) console.log('\n  register-ingangen die nergens staan: ' + r.ongebruikt.join(', '));
  const stuk = r.bevindingen.filter(b => b.soort !== 'verouderd');
  if (controle) {
    if (r.bevindingen.length) { console.error('\nNIET OK: ' + r.bevindingen.length + ' getal(len) lopen achter of zijn stuk. Draai: npm run getallen'); process.exit(1); }
    console.log('\nAlle getallen zijn gelijk aan hun register.');
  } else {
    console.log('\n' + r.bijgewerkt + ' getal(len) bijgewerkt.');
    if (stuk.length) { console.error('NIET OK: ' + stuk.length + ' merkteken(s) hebben geen bruikbare bron.'); process.exit(1); }
  }
}

if (require.main === module) main();
module.exports = { ronde, GETALLEN, DOCUMENTEN, MERK };
