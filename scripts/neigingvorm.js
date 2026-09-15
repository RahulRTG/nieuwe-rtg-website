#!/usr/bin/env node
/* ============================================================================
   DE ADAPTIEFVORM -- mag er een persoonlijke contextlaag bij, en in welke vorm?

   DE VRAAG KOMT UIT NEIGING.md par. 0. Het voorstel voor Adaptive RTG rust
   op een bewering die aantrekkelijk klinkt:

     "Bouw geen profiel. Bouw een Personal Context Graph."

   Dat KAN waar zijn. Of het waar IS, is een meting, en dit huis heeft die vraag
   al vier keer verkeerd zien beantwoorden: `Asset` klonk net zo vanzelfsprekend
   over tafel, kamer, podium en leaseauto (OBJECTMODEL.json), de carrierelus over
   vijftien talentdomeinen (CARRIEREVORM.json), `Moment` over acht publieke
   domeinen (STAGEVORM.json) en `Manier` over vijf terreinen (AANVOERVORM.json).
   Alle vier sneuvelden ze toen iemand ze tegen de code hield.

   DAAROM DEZELFDE METHODE EN NIET EEN TWEEDE. Dit bestand leest niet zelf; het
   hergebruikt `lees()`, `wring()` en `domeinVan()` uit scripts/objectmodel.js.
   Twee meters met elk een eigen parser geven binnen een maand twee getallen over
   dezelfde vraag, en dan is de vergelijking met de vier metingen hierboven
   waardeloos.

   MAAR DE VERWACHTE UITSLAG IS HIER ANDERS, EN DAT HOORT VOORAF UITGESPROKEN.

   Bij `Asset`, `Moment` en `Manier` was de vraag: bestaat deze waarheid al in de
   domeinen, en probeert iemand er een type overheen te leggen? Het antwoord was
   vier keer ja, en de uitweg vier keer dezelfde -- een PROJECTIE in de vorm van
   kern/levensgraaf/graaf.js.

   Hier is de vraag het spiegelbeeld. "Dit lid houdt van Japans eten" is geen
   waarheid die een domein bezit en die iemand wil dupliceren; het is informatie
   die vandaag NERGENS staat. Een projectie van niets is leeg. Als de meting dat
   bevestigt, dan is de conclusie niet "geen nieuw type" maar iets preciezers:
   een deel van de laag is nieuw en moet dus worden OPGESLAGEN, en een ander deel
   bestaat al en mag dus niet worden overgeschreven. Dat onderscheid is de hele
   winst van deze meting, en het is precies wat een enkel "wel/geen nieuw type"
   zou verbergen.

   HOE ER GEMETEN WORDT -- DRIE METINGEN DIE NIET HETZELFDE ZEGGEN

   A. DE NAAM. Het voorstel introduceert een stuk of tien begrippen. Dit huis
      heeft er acht keer eerder een naam voor gekozen die al bezet was --
      `capability`, `wallet`, `moment`, `manier`, `Pulse`, `Kanaal`, `envelop`,
      `doel` -- en de duurste daarvan (`moment` in kern/socialegraaf/bronnen.js
      naast een publiek moment) zette een PRIVATE levensgebeurtenis onder de naam
      van een publieke. Meting A telt per begrip in hoeveel bestanden en hoeveel
      domeinen het woord al voorkomt, en of het al als VELDNAAM in gebruik is.
      Lexicaal, dus een ONDERgrens.

   B. DE VOORKEURSLAAG. Bestaat er vandaag al een plek die vastlegt wat een mens
      LEUK VINDT -- en zo ja, draagt die de drie etiketten zonder welke zo'n
      gegeven niet eerlijk te gebruiken is?

        grond      waar weten we dit vandaan (gezegd, gekozen, afgeleid)
        zekerheid  hoe hard is het
        verval     wanneer houdt het op te gelden

      Dit is de dragende meting. Vindt hij voorkeuren ZONDER die drie, dan is de
      conclusie niet "er is niets" maar iets ongemakkelijkers: er wordt al op
      voorkeuren gestuurd, en niemand kan zeggen hoe hard ze zijn.

   C. HET VOORSTEL TEGEN DE CODE. Vijftien punten, en de ervaring van HDI.md par.
      1 (vijf van acht lagen bestonden al onder een andere naam) en STAGE.md par.
      3 (de momentmotor bestond al) zegt dat het meeste er staat. Elk punt draagt
      hier een VERWIJZING naar bestaande code, en die verwijzing wordt
      NAGETROKKEN: bestaat het bestand, en staat het genoemde symbool erin? Een
      punt waarvan de verwijzing rot, zakt naar `verwijzing-rot` en telt niet
      meer als "staat al". Zo is dit geen lijst beweringen maar een register met
      een handhaver, in de vorm die BEWIJSMACHINE.md eist.

   WAT DEZE METER NIET BEWIJST, en dat hoort er hard bij te staan:

   - Meting A wijst naambotsingen aan en bewijst niet dat twee gelijknamige
     dingen hetzelfde BETEKENEN. Dat beslist een mens die beide bestanden opent.
   - Meting B kijkt naar bewaarde VORMEN en naar veldnamen in de bron. Een
     domein dat voorkeuren in een vrije tekst bewaart, of ze onder een woord zet
     dat hier niet in de lijst staat, ontsnapt eraan. Het is een ONDERgrens.

     EN ER ZIT EEN BLINDE VLEK IN DIE ERUITZIET ALS SUCCES, gevonden met de
     mutatie die deze meter hoorde te laten uitslaan. `vormenVan()` leest alleen
     velden met een expliciete `naam:`; een verkorte eigenschap (`{ boot, soort,
     wens }`) is voor hem onzichtbaar. De eerste mutatie zette grond, zekerheid
     en verval bij zo'n verkorte vorm, en de meter bewoog niet -- niet omdat er
     niets gebeurde, maar omdat hij niet keek. Op een expliciete vorm sloeg hij
     wel uit (0 -> 1 op alle vier de tellers).

     Dat is GEEN fout van dit bestand en wordt hier ook niet gerepareerd: de
     lezer komt uit scripts/objectmodel.js, en een eigen parser ernaast maakt de
     vergelijking met OBJECTMODEL/CARRIEREVORM/STAGEVORM/AANVOERVORM waardeloos
     -- precies de reden dat hij gedeeld is. Het betekent wel dat de 14 hieronder
     een ONDERGRENS is die harder onderschat dan je zou denken: shorthand is in
     dit huis de gewone schrijfwijze zodra een waarde uit een variabele komt, en
     dat is juist bij GESCHREVEN rijen het geval. De seed-achtige rijen, waar
     alles is uitgeschreven, zijn oververtegenwoordigd in de uitslag. Wie dit
     getal scherper wil, repareert `vormenVan()` in objectmodel.js en hermeet
     alle vijf de vormmetingen -- niet deze ene.
   - Meting C toont aan dat een verwijzing KLOPT, niet dat het genoemde bestand
     doet wat het punt vraagt. `staat` betekent hier "er is bestaande code die
     dit punt draagt", en of die code volstaat blijft een oordeel van een mens.
     Daarom draagt elk punt een `dekt` met de eerlijke helft die ontbreekt.
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const WORTEL = path.join(__dirname, '..');
const om = require('./objectmodel.js');
const { stempel } = require('./lib/stempel');

/* ---------------------------------------------------------------- meting A */

/* De begrippen die het voorstel introduceert, plus de naam die er uiteindelijk
   is gekozen. Bewust ook de woorden waarvan we al VERMOEDEN dat ze bezet zijn:
   een meter die alleen de vrije namen telt, bevestigt zichzelf.

   `neiging` staat er met opzet in en niet buiten de meting. Hij is de enige die
   laag scoort, en dat hoort NA te rekenen te zijn in plaats van geloofd -- zeker
   omdat de vorige ronde van deze meter met een te smalle zeef precies zo een
   naam vrijgaf die het niet was. Wat er van hem overblijft zijn plekken waar het
   woord gewone Nederlandse tekst is ("de neiging om toch maar iets te doen"),
   nergens een module, een scherm of een veldnaam. */
const BEGRIPPEN = ['context', 'signaal', 'voorkeur', 'interesse', 'profiel',
  'situatie', 'intent', 'moment', 'groep', 'projectie', 'relevantie', 'geheugen',
  'zekerheid', 'verval', 'adaptief', 'neiging'];

function namen() {
  /* DE HELE BOOM EN NIET ALLEEN server/kern -- en dat is een REPARATIE, met een
     prijs die echt betaald is.

     Deze meting las eerst alleen `om.BRONNEN` (server/kern, server/bedrijf,
     server/school, server/papieren), want die lijst hoort bij de VORMmeting van
     objectmodel.js: daar gaat het over domeinvormen, en een scherm heeft er niets
     te zoeken. Voor een NAAM klopt die zeef niet, en het verschil is niet
     theoretisch: `adaptief` kwam er als enige vrije naam uit, en op grond daarvan
     is de hele laag zo gedoopt. In werkelijkheid draagt `ADAPTIEF.md` een
     bestaande laag van 97 bestanden -- `public/shared/adaptief/` met elf modules,
     `public/shared/adaptief.css`, en test/adaptief.test.js plus .e2e.js, die bij
     het bouwen dan ook prompt zijn overschreven.

     Dat is de fout waar BEWIJSMACHINE.md par. 6a over gaat: een proef kan een
     geldige uitslag geven en toch het verkeerde experiment zijn geweest. De
     uitslag "0 bestanden" was waar binnen zijn eigen zeef en onwaar over het huis.

     Een naam is bezet zodra IEMAND hem draagt, waar dan ook: een scherm, een
     stylesheet, een toets, een document. Vandaar de hele boom, met alleen de
     dingen eruit die geen naam kunnen bezetten (node_modules, git, bouwuitvoer). */
  const paden = [];
  const GEEN = /(^|\/)(node_modules|\.git|public\/dist|server\/data|coverage)(\/|$)/;
  (function loop(map) {
    for (const naam of fs.readdirSync(path.join(WORTEL, map), { withFileTypes: true })) {
      const rel = (map ? map + '/' : '') + naam.name;
      if (GEEN.test(rel)) continue;
      if (naam.isDirectory()) loop(rel);
      else if (/\.(js|json|md|html|css)$/.test(naam.name)) paden.push(rel);
    }
  })('');

  const uit = [];
  for (const begrip of BEGRIPPEN) {
    const woord = new RegExp(begrip, 'i');
    const veld = new RegExp('(?:^|[,{\\s])' + begrip + '[A-Za-z]*\\s*:', 'i');
    const plekken = [], velden = [], domeinen = new Set();
    for (const p of paden) {
      let bron;
      try { bron = fs.readFileSync(path.join(WORTEL, p), 'utf8'); } catch (e) { continue; }
      /* Commentaar wordt NIET weggeknipt, en dat is hier juist: in een document
         of een kop is het woord even goed bezet. Bij de vormmeting hieronder
         gebeurt dat wel, want daar gaat het om echte velden. */
      if (!woord.test(bron)) continue;
      plekken.push(p);
      domeinen.add(p.startsWith('server/') ? om.domeinVan(p) : p.split('/')[0]);
      if (/\.(js|json)$/.test(p) && veld.test(bron)) velden.push(p);
    }
    uit.push({
      naam: begrip, plekken: plekken.length, domeinen: domeinen.size,
      alsVeld: velden.length,
      /* Vrij betekent: NERGENS genoemd. Geen marge van twee bestanden meer -- die
         marge was precies groot genoeg om een bestaande laag te missen. */
      vrij: plekken.length === 0,
      voorbeeldDomeinen: [...domeinen].sort().slice(0, 6)
    });
  }
  return uit.sort((a, b) => b.plekken - a.plekken);
}

/* ---------------------------------------------------------------- meting B */

/* Wat telt als "dit vindt iemand leuk". Gegrond in wat er staat en niet
   verzonnen: deze woorden komen uit kern/vonk/wensen.js, kern/gastzorg.js,
   kern/aanmeldgesprek-hulp.js en kern/mall/zoekweging.js. */
const AFFINITEIT = ['voorkeur', 'voorkeuren', 'interesse', 'interesses', 'wens',
  'wensen', 'houdtVan', 'smaak', 'favoriet', 'favorieten', 'leuk', 'affiniteit'];
/* De drie etiketten, elk met de schrijfwijzen die in dit huis voorkomen. */
const GROND = ['grond', 'herkomst', 'bron', 'gezegd', 'expliciet'];
const ZEKERHEID = ['zekerheid', 'confidence', 'graad', 'sterkte', 'gewicht'];
const VERVAL = ['vervalt', 'verval', 'verloopt', 'geldigTot', 'tot', 'termijn'];

const heeft = (velden, lijst) => velden.some(v => lijst.some(w => v.toLowerCase() === w.toLowerCase()));

function voorkeurslaag() {
  const { vormen } = om.lees();
  const metAffiniteit = vormen.filter(v => heeft(v.velden, AFFINITEIT));
  const scoor = v => ({
    module: v.module, domein: om.domeinVan(v.module),
    grond: heeft(v.velden, GROND), zekerheid: heeft(v.velden, ZEKERHEID),
    verval: heeft(v.velden, VERVAL), velden: v.velden
  });
  const rijen = metAffiniteit.map(scoor);
  const compleet = rijen.filter(r => r.grond && r.zekerheid && r.verval);
  const domeinen = [...new Set(rijen.map(r => r.domein))].sort();
  return {
    vormenTotaal: vormen.length,
    metAffiniteit: rijen.length,
    domeinen,
    metGrond: rijen.filter(r => r.grond).length,
    metZekerheid: rijen.filter(r => r.zekerheid).length,
    metVerval: rijen.filter(r => r.verval).length,
    metAlledrie: compleet.length,
    waar: rijen.map(r => ({ module: r.module, domein: r.domein,
      grond: r.grond, zekerheid: r.zekerheid, verval: r.verval }))
  };
}

/* ---------------------------------------------------------------- meting C */

/* Elk punt uit het voorstel, met de code die het vandaag draagt. `bestand` en
   `symbool` worden NAGETROKKEN; `dekt` is de eerlijke helft die ontbreekt en is
   een oordeel, geen meting -- vandaar dat het apart staat. */
const VOORSTEL = [
  { nr: 1, punt: 'Geen klassiek registratieformulier; passkey als eerste route',
    bestand: 'server/webauthn/index.js', symbool: 'module.exports',
    dekt: 'De passkey-route staat en public/shared/passkey.js bedient hem. Wat ontbreekt is dat de VOORDEUR hem als eerste route toont in plaats van als instelling achteraf.' },
  { nr: 2, punt: 'Adaptieve onboarding: de volgende vraag hangt af van het vorige antwoord',
    bestand: 'server/kern/onboarding.js', symbool: 'standaardVelden',
    dekt: 'De intake staat en is per scope instelbaar, maar de veldenlijst is VAST: iedereen krijgt dezelfde vragen in dezelfde volgorde. Er is geen motor die de volgende vraag kiest.' },
  { nr: 3, punt: 'Progressive profiling: de onboarding is nooit af',
    bestand: 'server/kern/gegevenspoort.js', symbool: 'VELDEN',
    dekt: 'Uitgesteld uitvragen bestaat al en is streng (een veld wordt pas gevraagd als een handeling het nodig heeft, met een waarom). Dat gaat over NOODZAKELIJKE gegevens; voor voorkeuren is er geen equivalent.' },
  { nr: 4, punt: 'Personal Context Graph in plaats van een plat profiel',
    bestand: 'server/kern/levensgraaf/graaf.js', symbool: 'function knoop',
    dekt: 'De graafVORM bestaat en is bewezen als PROJECTIE met vijf etiketten. Hij projecteert bezittingen en termijnen, niet voorkeuren -- die staan nergens.' },
  { nr: 5, punt: 'Tijd als dimensie: identity, preference, situation, intent, moment, group',
    bestand: 'server/kern/experience/contexts.js', symbool: 'function basis',
    dekt: 'De SITUATIE is first-class en server-afgeleid (welke reis, welke werkruimte). De andere vijf assen bestaan niet; `context` betekent hier uitsluitend situatie.' },
  { nr: 6, punt: 'Adaptive content, stable controls',
    bestand: 'server/kern/experience/projections.js', symbool: 'function living',
    dekt: 'De projectie per wereld staat en levert items met bron en versheid. Er is geen weging: de volgorde is de volgorde waarin de domeinen toevallig antwoorden.' },
  { nr: 7, punt: 'De interface anticipeert',
    bestand: 'server/kern/experience/attention.js', symbool: 'function severity',
    dekt: 'Aandacht wordt al gekwalificeerd uit domeinsignalen, met een reden per item. Hij reageert op wat er IS (een incident, een deadline) en voorspelt niets.' },
  { nr: 8, punt: 'Rahul als menselijke ingang naar personalisatie',
    bestand: 'server/kern/stuur/beleid.js', symbool: 'toegestanePaden',
    dekt: 'De keten taal -> intent -> toegestaan pad staat, met een bewijspoort ervoor. Er is geen intent die een VOORKEUR wijzigt, want er is geen voorkeur om te wijzigen.' },
  { nr: 9, punt: 'AI-geheugen zichtbaar maken (wijzigen, vergeten, niet hiervoor gebruiken)',
    bestand: 'server/kern/consent-register.js', symbool: 'module.exports',
    dekt: 'Het toestemmingsregister kent lagen, termijnen en relaties. Het gaat over gegevens die een DERDE krijgt; er is geen scherm waarop een lid ziet wat RTG zelf van hem denkt te weten.' },
  { nr: 10, punt: 'Privacy-enhancing: doelbinding, dataminimalisatie, pseudonimisering',
    bestand: 'server/kern/gastzorg-profiel.js', symbool: 'zorgMee',
    dekt: 'Doelbinding op een voorkeur bestaat AL en is streng: zonder zaak en reden geeft zorgMee niets terug. Het is gebouwd voor een domein (zorg) en niet als platformvorm.' },
  { nr: 11, punt: 'Zero-knowledge-achtige bewijzen waar ze waarde hebben',
    bestand: 'server/kern/volwassen.js', symbool: 'volwassen',
    dekt: 'De 18+-poort geeft al een eigenschap door in plaats van een geboortedatum. Dat is de vorm die het punt vraagt; er is geen uitgiftepad naar een BUITENstaande partij.' },
  { nr: 12, punt: 'Edge + realtime: niet elke personalisatie langs een groot model',
    bestand: 'server/kern/ai/router.js', symbool: 'TECHNIEKEN',
    dekt: 'De techniekkeuze (regels voor model) is gemeten en staat in de schaduw. Hij beslist nog niets, en er is geen relevantiemotor om naartoe te routeren.' },
  { nr: 13, punt: 'Confidence-model met decay',
    bestand: 'server/kern/levensgraaf/termijnen.js', symbool: 'module.exports',
    dekt: 'Verval op een TERMIJN bestaat (een paspoort verloopt op een datum). Verval als AFNEMEND GEWICHT bestaat nergens, en op voorkeuren al helemaal niet.' },
  { nr: 14, punt: 'Groepspersonalisatie zonder profielen aan elkaar bloot te geven',
    bestand: 'server/kern/levensband/inzage.js', symbool: 'function mag',
    dekt: 'De band tussen twee mensen bestaat, is wederzijds bevestigd, en bepaalt per STUK wat de ander mag zien. Dat is de goede onderbouw. Er is geen berekening die uit meerdere mensen EEN gezamenlijke uitkomst geeft zonder ieders voorkeuren aan de anderen te tonen.' },
  { nr: 15, punt: 'Het onboarding-einde laat het resultaat zien',
    bestand: 'public/apps/app-main.js', symbool: 'MAPPEN',
    dekt: 'De werelden en hun apps staan in een afgeleide lijst. De overgang bestaat; er is niets persoonlijks om erin te tonen.' }
];

function voorstel() {
  const rijen = VOORSTEL.map(v => {
    const vol = path.join(WORTEL, v.bestand);
    if (!fs.existsSync(vol)) return { ...v, stand: 'verwijzing-rot', reden: 'bestand bestaat niet' };
    const bron = fs.readFileSync(vol, 'utf8');
    if (!bron.includes(v.symbool)) return { ...v, stand: 'verwijzing-rot', reden: 'symbool niet gevonden' };
    return { ...v, stand: 'draagt' };
  });
  return {
    punten: rijen.length,
    draagt: rijen.filter(r => r.stand === 'draagt').length,
    rot: rijen.filter(r => r.stand === 'verwijzing-rot').length,
    rijen
  };
}

function meet() {
  return { gemeten: { naam: namen(), voorkeur: voorkeurslaag(), voorstel: voorstel() } };
}

module.exports = { meet, BEGRIPPEN, AFFINITEIT, VOORSTEL };

if (require.main === module) {
  const r = meet();
  const { naam, voorkeur: b, voorstel: c } = r.gemeten;
  /* GEEN process.exit() NA GROTE UITVOER. Node sluit dan af terwijl de pipe nog
     leegloopt: geldige tekst, kapotte JSON, exitcode 0. */
  if (process.argv.includes('--json')) { console.log(JSON.stringify(r)); process.exitCode = 0; return; }
  if (process.argv.includes('--vastleggen')) {
    fs.writeFileSync(path.join(WORTEL, 'NEIGINGVORM.json'), JSON.stringify(Object.assign({
      stempel: stempel({ instrument: 'scripts/neigingvorm.js' }),
      uitleg: 'Gemeten met scripts/neigingvorm.js, op de lezer van scripts/objectmodel.js. De vraag staat in NEIGING.md par. 0. Drie metingen die niet hetzelfde zeggen: A de namen die het voorstel introduceert, B of er al een voorkeurslaag is en of die zijn etiketten draagt, C het voorstel tegen bestaande code met een nagetrokken verwijzing.',
      grens: 'LET OP BIJ METING A, TWEE KEER. (1) Deze meter telt zijn EIGEN laag mee: `neiging` scoort hier niet nul omdat server/kern/neiging/ inmiddels bestaat. Gemeten op de commit VOOR deze tak stond `neiging` in 4 bestanden, alle vier als gewone Nederlandse tekst in een toelichting, en 0 keer als veldnaam -- na te rekenen met `git grep -lIi neiging <commit>`. (2) De eerste versie van deze meting las alleen server/kern en drie broers, en gaf daarmee `adaptief` vrij terwijl ADAPTIEF.md een laag van 95 bestanden draagt, inclusief test/adaptief.test.js die bij het bouwen prompt is overschreven. Die zeef is gerepareerd (de hele boom) en `vrij` betekent nu NERGENS genoemd, zonder marge. Wat deze meter NIET aantoont. A is lexicaal en dus een ONDERgrens; een gedeelde naam is geen gedeelde betekenis, dat beslist een mens die beide bestanden opent. B leest bewaarde vormen en veldnamen: voorkeuren in vrije tekst of onder een woord buiten de lijst ontsnappen eraan. B heeft daarbovenop een gemeten blinde vlek die eruitziet als succes -- de gedeelde lezer vormenVan() ziet alleen expliciete velden (naam:) en geen verkorte eigenschappen ({ wens }), dus juist geschreven rijen tellen vaak niet mee en seed-achtige rijen wel; dat is niet hier gerepareerd omdat een tweede parser de vergelijking met de vier eerdere vormmetingen waardeloos maakt. C trekt na dat een verwijzing KLOPT, niet dat de genoemde code volstaat -- `draagt` betekent "er is bestaande code die dit punt raakt", en het veld `dekt` zegt per punt welke helft ontbreekt; dat is een oordeel en geen meting.',
      vastgelegd: new Date().toISOString().slice(0, 10)
    }, r), null, 2) + '\n');
    console.log('NEIGINGVORM.json geschreven.');
  }
  console.log('A. DE NAAM -- welke begrippen uit het voorstel zijn al bezet?');
  for (const k of naam) {
    console.log('   ' + k.naam.padEnd(11) + String(k.plekken).padStart(4) + ' bestanden, ' +
      String(k.domeinen).padStart(3) + ' domeinen, ' + String(k.alsVeld).padStart(3) + ' als veld  ' +
      (k.vrij ? 'VRIJ' : ''));
  }
  console.log('\nB. DE VOORKEURSLAAG -- bestaat hij, en draagt hij zijn etiketten?');
  console.log('   vormen gelezen                  : ' + b.vormenTotaal);
  console.log('   met een affiniteitsveld         : ' + b.metAffiniteit + '  (' + b.domeinen.join(' ') + ')');
  console.log('   daarvan met een GROND           : ' + b.metGrond);
  console.log('   daarvan met een ZEKERHEID       : ' + b.metZekerheid);
  console.log('   daarvan met een VERVAL          : ' + b.metVerval);
  console.log('   met alle drie                   : ' + b.metAlledrie);
  console.log('\nC. HET VOORSTEL TEGEN DE CODE -- ' + c.punten + ' punten');
  console.log('   met bestaande code die het draagt : ' + c.draagt);
  console.log('   verwijzing rot                    : ' + c.rot);
  for (const x of c.rijen.filter(y => y.stand === 'verwijzing-rot'))
    console.log('     ! ' + x.nr + '. ' + x.bestand + ' -- ' + x.reden);
}
