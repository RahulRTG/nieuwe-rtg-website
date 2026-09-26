#!/usr/bin/env node
'use strict';
/* ============================================================================
   DE OFFICEVORM -- is er een `RTGObject` onder document, taak en betaling?

   DE VRAAG DIE HIJ BEANTWOORDT. Het voorstel voor RTG Office Next (OFFICE.md)
   vraagt een Universal RTG Object Model: document, tabel, taak, persoon,
   bedrijf, goedkeuring, handtekening, betaling, boeking, afspraak en workflow
   worden subtypen van EEN `RTGObject`, met een gedeelde kop van vijftien
   kenmerken (id, tenant, eigenaar, rechten, classificatie, schema, inhoud,
   relaties, versie, historie, audit, workflowstand, AI-context, bewaring,
   versleuteling). Dan kan een tabel uit een blad in een document staan zonder
   kopie: een object, meerdere views.

   DAT IS EXACT DE VORM WAARIN `Asset` SNEUVELDE, en daarna `Koopbaar`,
   `Career`, `Moment`, `Ontdekking`, `Manier` en de planningsgrond.
   DEVELOPERCLOUD.md par. 2: *een universeel objectmodel moet worden GEVONDEN in
   de domeinen, niet eroverheen verklaard.* Dus wordt deze eerst gemeten.

   DEZELFDE LEZER, EN DAT IS GEEN GEMAK MAAR EEN EIS. Hij leent
   ./objectmodel.js, precies zoals planvorm, stagevorm en carrierevorm: een
   getal dat je niet naast het vorige kunt leggen, stuurt niets.

   TWEE ASSEN, EN ZE MOGEN NOOIT WORDEN OPGETELD.

     A. DE VORM  delen de domeinen VELDEN buiten de envelop? Dat is de
                 Asset-vraag, en daar hangt de conclusie aan.
     B. DE KOP   welke van de vijftien voorgestelde kenmerken draagt een domein
                 VANDAAG al, onder welke naam dan ook? Die as leest de envelop
                 juist WEL mee (`door` is de eigenaar, `status` de stand), want
                 hij vraagt of de kop ontdekt kan worden of verklaard moet worden.
                 Lexicaal op veldnamen, dus graad `vermoed` -- hij mag een
                 conclusie kleuren en nooit dragen.

   Een gedeelde kop zonder gedeelde vorm is geen objecttype maar een ENVELOP:
   dat is precies de scheidslijn die kern/envelop.js al trekt (die zegt met
   opzet nooit WAT). Een samengesteld cijfer over beide assen zou verbergen welke
   van de twee beweegt -- INT-04.

   TWEE DOMEINLIJSTEN EN NIET EEN, om de reden die in scripts/carrierevorm.js
   staat: die sloeg op een versmalling om van 0 naar 8 gedeelde velden.

     RUIM   alles wat in dat domein het object draagt. Een module die er ten
            onrechte bij staat verlaagt hooguit de gedeeldheid; een module die
            ONTBREEKT verbergt juist een gedeelde vorm.
     SMAL   precies de module die het object DRAAGT.

   WAT HIJ MET OPZET NIET MEET. Of een document een tabel uit een blad kan
   TONEN -- dat is een VIEW op een verwijzing en vraagt geen gedeeld type. Wie
   een nul hier leest als "live blokken kunnen niet", leest hem verkeerd: hij
   zegt dat een blok een verwijzing moet zijn en geen subtype.

   Draaien: npm run officevorm   (vastleggen: npm run officevorm:vast)
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const om = require('./objectmodel.js');
const { stempel } = require('./lib/stempel');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'OFFICEVORM.json');

/* De elf subtypen uit het voorstel, elk op de plek waar dit huis dat object
   vandaag bewaart. Een `dataset` (het blad) staat er niet apart in: het woont in
   dezelfde opslag als het document (kern/office/docs.js, `soort: 'blad'`), en
   een domein dubbel tellen verhoogt de gedeeldheid kunstmatig. */
const RUIM = {
  document:     /^server\/kern\/office(\.js$|\/)/,
  taak:         /^server\/bedrijf\/(taak|project)\.js$/,
  persoon:      /^server\/kern\/concern\/employment/,
  bedrijf:      /^server\/kern\/concern\/(entiteit|vestiging|scope)\.js$/,
  besluit:      /^server\/bedrijf\/besluit/,
  handtekening: /^server\/kern\/kantoor\/tweedehandtekening\.js$/,
  betaling:     /^server\/kern\/pay\//,
  boeking:      /^server\/kern\/reisbureau/,
  afspraak:     /^server\/kern\/agenda/,
  contract:     /^server\/kern\/commercie\/contract/,
  workflow:     /^server\/kern\/commercie\/voornemen/
};

const SMAL = {
  document:     /^server\/kern\/office\/docs\.js$/,
  taak:         /^server\/bedrijf\/taak\.js$/,
  persoon:      /^server\/kern\/concern\/employment\.js$/,
  bedrijf:      /^server\/kern\/concern\/entiteit\.js$/,
  besluit:      /^server\/bedrijf\/besluit\.js$/,
  handtekening: /^server\/kern\/kantoor\/tweedehandtekening\.js$/,
  betaling:     /^server\/kern\/pay\/boeking\.js$/,
  boeking:      /^server\/kern\/reisbureau\.js$/,
  afspraak:     /^server\/kern\/agenda\.js$/,
  contract:     /^server\/kern\/commercie\/contract\.js$/,
  workflow:     /^server\/kern\/commercie\/voornemen\.js$/
};

/* ---------------------------------------------------------------------------
   B. DE KOP -- de vijftien kenmerken die het voorstel op elk object zet.
   Per kenmerk de veldnamen die hier hetzelfde BEDOELEN. Ruim gekozen, en dat
   is de veilige kant: een te ruim patroon maakt de kop gedeelder dan hij is,
   en de uitspraak die ertoe doet is juist "dit kenmerk bestaat nergens".
   ------------------------------------------------------------------------ */
const KOP = {
  id:             /^id$/,
  tenant:         /^(org|orgid|tenant|zaak|zaakcode|bedrijf|concern|entiteit|werkruimte|huis)$/,
  eigenaar:       /^(eigenaar|owner|door|maker|key|vanmij|aangevraagddoor|houder)$/,
  rechten:        /(recht|^rol|bewerker|gedeeld|deelmet|^mag)/,
  classificatie:  /(classific|klasse|gevoelig|vertrouwelijk)/,
  schema:         /^(soort|type|schema|kind)$/,
  inhoud:         /^(inhoud|tekst|body|data|content|cellen|dias)$/,
  relaties:       /(^ref$|[a-z]id$|koppel|verwijz|relatie|^ouder)/,
  versie:         /(versie|^rev$|^v$)/,
  historie:       /(histor|geschiedenis|wijzigingen)/,
  audit:          /(audit|journaal|spoor)/,
  workflowstand:  /^(status|stand|fase|kolom)$/,
  aiContext:      /(^ai|context)/,
  bewaring:       /(bewaar|bewaring|retentie|retention)/,
  /* Niet `sleutel`: dat is in dit huis vrijwel altijd een idempotentie- of
     opzoeksleutel (kern/commercie/voornemen.js), en dat is een valse treffer
     die op de eerste draai ook echt viel. */
  versleuteling:  /(versleut|encrypt|cipher)/
};
const KENMERKEN = Object.keys(KOP);

function domeinVan(lijst, module) {
  for (const d of Object.keys(lijst)) if (lijst[d].test(module)) return d;
  return null;
}

function kop(g, lijst) {
  const per = new Map(Object.keys(lijst).map(d => [d, new Set()]));
  for (const v of g.vormen) {
    const d = domeinVan(lijst, v.module);
    if (!d) continue;
    for (const f of v.velden) {
      const l = f.toLowerCase();
      for (const k of KENMERKEN) if (KOP[k].test(l)) per.get(d).add(k);
    }
  }
  const gevuld = [...per.keys()].filter(d => per.get(d).size > 0);
  const perKenmerk = KENMERKEN.map(k => ({
    kenmerk: k,
    domeinen: gevuld.filter(d => per.get(d).has(k)).length
  }));
  return {
    domeinen: gevuld.length,
    perKenmerk,
    inAlleDomeinen: perKenmerk.filter(r => gevuld.length > 0 && r.domeinen === gevuld.length).map(r => r.kenmerk),
    nergens: perKenmerk.filter(r => r.domeinen === 0).map(r => r.kenmerk),
    alleenIn: Object.fromEntries(perKenmerk.filter(r => r.domeinen === 1)
      .map(r => [r.kenmerk, gevuld.find(d => per.get(d).has(r.kenmerk))])),
    perDomein: Object.fromEntries(gevuld.map(d => [d, [...per.get(d)].sort()]))
  };
}

/* ---------------------------------------------------------------------------
   A. DE VORM -- delen de objectdomeinen velden? (de Asset-vraag)
   Dezelfde rekenwijze als scripts/planvorm.js, zodat de getallen naast elkaar
   liggen.
   ------------------------------------------------------------------------ */
function vorm(g, envelop, lijst) {
  const NAMEN = Object.keys(lijst);
  const perDomein = new Map(NAMEN.map(d => [d, new Set()]));
  const modulesPer = new Map(NAMEN.map(d => [d, new Set()]));
  let vormen = 0;
  for (const v of g.vormen) {
    const d = domeinVan(lijst, v.module);
    if (!d) continue;
    vormen++;
    modulesPer.get(d).add(v.module);
    for (const f of v.velden) if (!envelop.has(f)) perDomein.get(d).add(f);
  }

  /* Een domein zonder enkele vorm doet NIET mee aan de noemer, en dat staat
     erbij: een leeg domein meetellen garandeert "0 in alle", en dan veroorzaakt
     de meter zijn eigen uitslag. */
  const gevuld = NAMEN.filter(d => perDomein.get(d).size > 0);
  const leeg = NAMEN.filter(d => perDomein.get(d).size === 0)
    .map(d => ({ domein: d, reden: 'geen enkele objectvorm buiten de envelop onder ' + String(lijst[d]) }));

  const veldDomein = new Map();
  for (const d of gevuld) for (const f of perDomein.get(d)) {
    if (!veldDomein.has(f)) veldDomein.set(f, []);
    veldDomein.get(f).push(d);
  }
  const n = gevuld.length;
  const inAlle = [...veldDomein].filter(([, ds]) => ds.length === n).map(([f]) => f).sort();
  const inHelft = [...veldDomein].filter(([, ds]) => ds.length * 2 >= n).map(([f]) => f).sort();
  const inEen = [...veldDomein].filter(([, ds]) => ds.length === 1).map(([f]) => f);
  const velden = veldDomein.size;

  const paren = [];
  for (let i = 0; i < gevuld.length; i++) for (let j = i + 1; j < gevuld.length; j++) {
    const a = perDomein.get(gevuld[i]), b = perDomein.get(gevuld[j]);
    const samen = [...a].filter(f => b.has(f));
    const unie = new Set([...a, ...b]).size;
    paren.push({ paar: [gevuld[i], gevuld[j]], gedeeld: samen.length,
      overlap: unie ? Number((samen.length / unie).toFixed(3)) : 0, velden: samen.sort().slice(0, 12) });
  }
  paren.sort((x, y) => y.overlap - x.overlap || x.paar.join().localeCompare(y.paar.join()));

  return {
    domeinen: gevuld, domeinenLeeg: leeg, vormen, velden,
    perDomein: Object.fromEntries(gevuld.map(d => [d,
      { velden: perDomein.get(d).size, modules: [...modulesPer.get(d)].sort() }])),
    inAlleDomeinen: inAlle, inMinstensHelft: inHelft,
    inEenDomeinPct: velden ? Number(((inEen.length / velden) * 100).toFixed(1)) : 0,
    paren: paren.slice(0, 10)
  };
}

function meet(opties) {
  const lijsten = (opties && opties.lijsten) || { ruim: RUIM, smal: SMAL };
  const g = om.lees();
  /* De envelop wordt uit OBJECTMODEL.json GELEZEN en niet overgetypt: twee
     lijsten die hetzelfde horen te zijn, lopen uiteen. */
  const envelop = new Set(JSON.parse(fs.readFileSync(path.join(WORTEL, 'OBJECTMODEL.json'), 'utf8')).envelop);

  const uit = {};
  for (const naam of Object.keys(lijsten)) {
    uit[naam] = { vorm: vorm(g, envelop, lijsten[naam]), kop: kop(g, lijsten[naam]) };
  }

  /* DE CONCLUSIE WORDT AFGELEID EN NIET OPGESCHREVEN, en hangt aan de VORM-as.
     Zij houdt alleen stand als BEIDE lijsten hem dragen. */
  const namen = Object.keys(uit);
  const geenGedeeldeVorm = namen.every(n => uit[n].vorm.inAlleDomeinen.length === 0);
  const eensgezind = new Set(namen.map(n => uit[n].vorm.inAlleDomeinen.length === 0)).size === 1;
  const conclusie = !eensgezind
    ? 'VERDEELD: de domeinlijsten geven een ander antwoord, dus de uitslag drijft op de lijst en niet ' +
      'op de code. Er is hier geen conclusie te trekken zonder eerst de lijst te verantwoorden.'
    : geenGedeeldeVorm
      ? 'GEEN GEDEELDE VORM: geen enkel veld buiten de envelop staat in alle gemeten objectdomeinen, onder ' +
        'geen van beide lijsten. Een `RTGObject` met document, taak, betaling en boeking als SUBTYPEN is ' +
        'daarmee niet gerechtvaardigd -- de `Asset`-uitslag, voor de achtste keer. Wat overleeft is een ' +
        'VERWIJZING met een view (een live blok wijst naar het object van zijn eigen domein en kopieert ' +
        'niets) en een gedeelde KOP die een envelop is en geen type: lees daarvoor as B.'
      : 'GEDEELDE VORM GEVONDEN: er staan velden in alle gemeten objectdomeinen, onder beide lijsten. ' +
        'Lees `inAlleDomeinen` voordat er iets op gebouwd wordt: een veld als `datum` is verpakking die ' +
        'de envelop niet ving.';

  return {
    stempel: stempel(),
    uitleg: 'Is er een `RTGObject` onder de elf subtypen die het voorstel voor RTG Office Next noemt ' +
      '(document, taak, persoon, bedrijf, besluit, handtekening, betaling, boeking, afspraak, contract, ' +
      'workflow)? Twee assen: DE VORM (delen ze velden -- de Asset-vraag) en DE KOP (welke van de vijftien ' +
      'voorgestelde kenmerken dragen ze vandaag al). Gemeten met de lezer van scripts/objectmodel.js.',
    grens: 'DE TWEE ASSEN WORDEN NOOIT OPGETELD: de vorm zegt of de GEGEVENS gedeeld zijn, de kop of de ' +
      'VERPAKKING dat is, en een gedeelde verpakking is een envelop en geen type. De kop is LEXICAAL op ' +
      'veldnamen en dus graad `vermoed`; de conclusie hangt aan de vorm-as. Envelopvelden vallen uit de ' +
      'vorm-as en tellen juist WEL mee in de kop-as. De lezer kijkt alleen in server/kern, server/bedrijf, ' +
      'server/school en server/papieren -- een object dat in een ROUTE woont is hier onzichtbaar, en dat ' +
      'is geen nul maar een blinde vlek. En de kop-as ziet een GENEST object niet als eigen vorm: het ' +
      '`beheer`-blok van kern/office/docs.js draagt `bewaartermijn` en het document draagt `audit[]`, en ' +
      'geen van beide telt hier mee. Een kop-getal is dus een ONDERgrens, nooit een afwezigheidsbewijs.',
    conclusie, geenGedeeldeVorm, eensgezind,
    kenmerken: KENMERKEN,
    rondes: uit
  };
}

function drukRonde(naam, r) {
  console.log('\n  ' + naam);
  console.log('    A. DE VORM -- ' + r.vorm.vormen + ' objectvormen over ' + r.vorm.domeinen.length + ' domein(en)');
  for (const d of r.vorm.domeinen)
    console.log('       ' + d.padEnd(14) + String(r.vorm.perDomein[d].velden).padStart(4) + ' velden  (' +
      r.vorm.perDomein[d].modules.length + ' module(s))');
  for (const l of r.vorm.domeinenLeeg) console.log('       \x1b[33m' + l.domein.padEnd(14) + ' -- niets gevonden\x1b[0m');
  console.log('       ' + 'velden totaal'.padEnd(26) + String(r.vorm.velden).padStart(5));
  console.log('       ' + 'in ALLE domeinen'.padEnd(26) + String(r.vorm.inAlleDomeinen.length).padStart(5) +
    (r.vorm.inAlleDomeinen.length ? '  (' + r.vorm.inAlleDomeinen.join(', ') + ')' : ''));
  console.log('       ' + 'in minstens de helft'.padEnd(26) + String(r.vorm.inMinstensHelft.length).padStart(5));
  console.log('       ' + 'in precies EEN domein'.padEnd(26) + String(r.vorm.inEenDomeinPct).padStart(5) + '%');
  if (r.vorm.paren.length) {
    const p = r.vorm.paren[0];
    console.log('       meest verwante paar        ' + (p.paar[0] + ' <-> ' + p.paar[1]) + ': ' + p.gedeeld +
      ' gedeeld, overlap ' + p.overlap);
  }
  console.log('    B. DE KOP -- vijftien kenmerken over ' + r.kop.domeinen + ' domein(en), graad vermoed');
  for (const k of r.kop.perKenmerk)
    console.log('       ' + k.kenmerk.padEnd(16) + String(k.domeinen).padStart(3) + ' domein(en)' +
      (r.kop.alleenIn[k.kenmerk] ? '  (alleen ' + r.kop.alleenIn[k.kenmerk] + ')' : ''));
}

function druk(u) {
  console.log('\nDE OFFICEVORM -- is er een RTGObject onder document, taak en betaling?');
  for (const naam of Object.keys(u.rondes)) drukRonde(naam.toUpperCase(), u.rondes[naam]);
  console.log('\n' + (u.geenGedeeldeVorm ? '\x1b[32m' : '\x1b[33m') + u.conclusie + '\x1b[0m');
}

module.exports = { meet, druk, DOEL, RUIM, SMAL, KOP, KENMERKEN };

if (require.main === module) {
  const u = meet();
  /* GEEN process.exit() NA EEN GROTE UITVOER: zie de pipe-regel in
     scripts/meetkeuring.js. */
  if (process.argv.includes('--json')) { console.log(JSON.stringify(u)); return; }
  druk(u);
  if (process.argv.includes('--vastleggen')) {
    fs.writeFileSync(DOEL, JSON.stringify(u, null, 2) + '\n');
    console.log('\ngeschreven: OFFICEVORM.json');
  }
}
