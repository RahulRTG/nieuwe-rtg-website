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
  'doodspoor.bronroutes': { bron: 'DOODSPOOR.json', veld: 'telling.bronroutes',
    wat: 'routes die in de proef werk deden en een collectie aanraakten' },
  'doodspoor.gesloten': { bron: 'DOODSPOOR.json', veld: 'telling.gesloten',
    wat: 'bronroutes waarvan een andere actorgroep gemeten een stand zet op dezelfde collectie' },
  'doodspoor.gezien': { bron: 'DOODSPOOR.json', veld: 'telling.gezien',
    wat: 'bronroutes waarvan een andere groep de collectie alleen leest (vermoed of aangewezen)' },
  'doodspoor.tussen': { bron: 'DOODSPOOR.json', veld: 'telling.tussen',
    wat: 'bronroutes waarvan de ontvanger een ander lid is -- dezelfde actorgroep, dus onzichtbaar voor het groepenmodel' },
  'doodspoor.terminaal': { bron: 'DOODSPOOR.json', veld: 'telling.terminaal',
    wat: 'bronroutes op een collectie die op niemand wacht: van een mens, van het huis, of een boeking' },
  'doodspoor.open': { bron: 'DOODSPOOR.json', veld: 'telling.open',
    wat: 'bronroutes zonder gemeten ontvanger, zonder gevonden lezer en zonder verklaring' },
  'doodspoor.openCollecties': { bron: 'DOODSPOOR.json', veld: 'telling.openCollecties',
    wat: 'collecties waarop minstens een bronroute open staat' },
  'tafel.schakels': { bron: 'TAFELPROEF.json', veld: 'telling.gesloten',
    wat: 'schakels van de horecaketen waar de ontvangende actor de verandering aantoonbaar ziet' },
  'tafel.storingen': { bron: 'TAFELPROEF.json', veld: 'telling.gehouden',
    wat: 'storingen in die keten waarbij het systeem zich aan zijn uitgeschreven belofte hield' },
  'rit.schakels': { bron: 'RITPROEF.json', veld: 'telling.gesloten',
    wat: 'schakels van de ritketen waar de ontvangende actor de verandering aantoonbaar ziet' },
  'rit.storingen': { bron: 'RITPROEF.json', veld: 'telling.gehouden',
    wat: 'storingen in de ritketen waarbij het systeem zich aan zijn uitgeschreven belofte hield' },
  'rit.bevindingen': { bron: 'RITPROEF.json', veld: 'telling.openBekend',
    wat: 'schakels in de ritketen die aantoonbaar niet sluiten, met een uitgeschreven reden' },
  'ketenvorm.actorenGedeeld': { bron: 'KETENVORM.json', veld: 'telling.actorenGedeeld',
    wat: 'actornamen die in beide gouden ketens voorkomen' },
  'ketenvorm.actorenTotaal': { bron: 'KETENVORM.json', veld: 'telling.actorenTotaal',
    wat: 'actornamen over de twee ketens samen' },
  'ketenvorm.themasGedeeld': { bron: 'KETENVORM.json', veld: 'telling.themasGedeeld',
    wat: 'soorten belofte die beide ketens afvangen' },
  'ketenvorm.themasTotaal': { bron: 'KETENVORM.json', veld: 'telling.themasTotaal',
    wat: 'soorten belofte over de twee ketens samen' },
  'ritmigratie.bestanden': { bron: 'RITMIGRATIE.json', veld: 'telling.bestanden',
    wat: 'bestanden die db.data.rides noemen' },
  'ritmigratie.stand': { bron: 'RITMIGRATIE.json', veld: 'telling.stand',
    wat: 'lezers van db.data.rides die de LOPENDE rit tonen' },
  'ritmigratie.historie': { bron: 'RITMIGRATIE.json', veld: 'telling.historie',
    wat: 'lezers die historie aftellen (omzet, fooi, fiscale grondslag)' },
  'ritmigratie.kanNu': { bron: 'RITMIGRATIE.json', veld: 'telling.kanNu',
    wat: 'lezers die vandaag naar de opdrachtwereld kunnen zonder dat er een rit uit beeld valt' },
  'ritmigratie.wacht': { bron: 'RITMIGRATIE.json', veld: 'telling.wachtOpBesluit',
    wat: 'lezers die wachten op het besluit over ritten zonder bestemming' },
  'doodspoor.nietGemeten': { bron: 'DOODSPOOR.json', veld: 'nietGezien.nietGemeten',
    wat: 'routes die in de idempotentieproef geen werk deden en dus buiten deze meting vallen' }
};

/* De documenten die merktekens mogen dragen. Bewust een lijst en geen glob over
   alles: een generator die elk .md-bestand mag herschrijven, herschrijft op een
   dag ook iets dat niemand had bedoeld. */
const DOCUMENTEN = ['CLAUDE.md', 'CREATE.md', 'EXECUTIE.md', 'OS.md', 'BEWIJSMACHINE.md', 'MAATSTAF.md'];

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
