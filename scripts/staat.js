#!/usr/bin/env node
/* HET TOESTANDSREGISTER -- welke muteerbare toestand bestaat er, en wie is ervan?

   Fase A van de verificatie-runtime: de runtime zichtbaar maken. Nog niets
   versnellen. De aanleiding staat in een getal: 647 serverstarts kosten 35% van
   alle toetstijd. Dat wordt pas minder als een server hergebruikt kan worden, en
   hergebruik mag alleen als van ELKE muteerbare wortel bekend is wie hem bezit
   en of hij aantoonbaar terug kan naar zijn beginstand.

   Een enkele onbekende singleton kan honderd keurig geisoleerde toetsen
   waardeloos maken -- en dat merk je niet, want een gedeelde server die lekt
   geeft geen fout maar een verkeerd antwoord. Daarom is dit register er eerder
   dan het hergebruik.

   WAT DIT REGISTER WEL EN NIET BEWEERT. Het beweert NIET dat de 143 wortels
   veilig te delen zijn. De meeste staan op `onbekend`, en dat is het eerlijke
   antwoord: niemand heeft ze geclassificeerd. Wat het wel doet is die
   onzekerheid ZICHTBAAR en BEGRENSD maken:

     - een wortel die de scan vindt en die hier niet staat: dat is een fout
       (staatOngeregistreerd moet 0 blijven)
     - een wortel op `onbekend` telt mee in staatOnbekend, en die meter mag
       alleen omlaag

   DE KLOKSCHULD HOORT HIER NIET. Die staat in KLOK.json en wordt door
   scripts/klok.js bewaakt -- sinds vandaag met dezelfde scanner als hieronder,
   maar met een eigen vrijstellingslijst. Het getal in dit overzicht is context,
   geen tweede ratel; twee ratels op een schuld lopen uiteen (LAT-regel 4).

   Zo kan er geen nieuwe onbekende toestand bijkomen zonder dat iemand er een
   besluit over neemt, en wordt het gat kleiner in plaats van vergeten.

   DE VIER LEVENSDUURKLASSEN. Elke wortel hoort er uiteindelijk een te krijgen:

     bootvast        afgeleid uit code of config, verandert nooit tijdens de rit
     toetsgebonden   mag binnen een toets muteren en moet daarna weg
     herstelbaar     mag tussen toetsen bestaan, maar moet terug naar de
                     beginstand kunnen -- en dat moet BEWEZEN zijn, niet beloofd
     procesgebonden  kan of mag niet veilig terug; een vers proces is verplicht

   Zolang een wortel op `onbekend` staat, telt hij als procesgebonden: dat is de
   veilige aanname, en hij kost dus een serverstart.

   Draai:
     node scripts/staat.js               het beeld, en exitcode 1 bij iets nieuws
     node scripts/staat.js --vastleggen  nieuwe wortels als 'onbekend' bijzetten
     node scripts/staat.js --json        machineleesbaar
*/
'use strict';
const fs = require('fs');
const path = require('path');
const { scan, eigenaarVan, schrijversIn } = require('./lib/staatscan.js');

const WORTEL = path.join(__dirname, '..');
const REGISTER = path.join(WORTEL, 'STATE.json');
const KLASSEN = ['bootvast', 'toetsgebonden', 'herstelbaar', 'procesgebonden', 'onbekend'];

/* WAAROM HET REGISTER OOK EEN VORM BIJHOUDT.

   Honderdtien wortels die een vers proces afdwingen is een muur. Diezelfde
   honderdtien zijn, als je ze op vorm sorteert, een werklijst met acht regels --
   en per vorm is er EEN reparatie in plaats van honderdtien. Dat is het hele
   nut van dit veld: niet netjes willen zijn, maar van "onbekend gebied" een
   geordende hoeveelheid werk maken.

   De vormen komen uit de bron en zijn niet bedacht: dit is wat er in server/db,
   server/accounts en server/kern werkelijk staat.

     verbinding   een greep op iets buiten dit proces (pg, sqlite, redis, pool,
                  een voorbereide statement). Deelbaar zodra een toets een
                  bestaande verbinding kan overnemen in plaats van openen.
     timer        een wachtende setTimeout/setInterval. De gevaarlijkste vorm:
                  een timer loopt DOOR terwijl de volgende toets draait en
                  schrijft dan gegevens van de vorige weg. Fix: stopAlles().
     vlucht       een vlag over werk dat loopt of nog moet (vuil, bezig).
                  Deelbaar zodra er een punt is waarop alles stil is.
     spiegel      cache of memo van gegevens die ergens anders wonen. Bijna
                  altijd herstelbaar: leegmaken is genoeg, alleen bestaat die
                  aanroep vaak nog niet.
     merk         een tijdmerk over de laatste keer dat iets gebeurde: wanneer,
                  of hoe lang het duurde. Stuurt geen uitkomst aan, wel wanneer
                  iets weer mag.
     voortgang    teller of generatie die echte voortgang draagt.
     bedrading    een callback of venster dat bij het opzetten wordt neergezet
                  en daarna staat.
     afleiding    luie of eenmalige berekening van iets dat vaststaat.

   EN EEN KLASSE DIE ER BEWUST NIET BIJ KWAM. Ik wilde hier `afgeleid` naast
   `bootvast` zetten: lui berekend, maar het antwoord ligt vast, dus deelbaar.
   Toen ik de kandidaten naliep bleef er geen enkele over die het eerlijk kon
   dragen -- de sleutel in db/geheugen-kluis.js lijkt zuiver, maar een toets die
   server/data leegmaakt houdt in een gedeeld proces de oude sleutel vast, en
   dat is precies wat de klasse zou ontkennen. Een klasse zonder lid is een
   ratel die nooit is zien vuren (LAT-regel 10), dus hij is er niet. De VORM
   `afleiding` blijft, want die is er wel. Komt er een echt lid, dan is dit de
   plek om hem alsnog toe te voegen.

   Het veld is verplicht zodra een mens een klasse invult (test/staatregister),
   want een classificatie zonder vorm is een mening zonder plaats in de lijst. */
const PATRONEN = ['verbinding', 'timer', 'vlucht', 'spiegel', 'merk', 'voortgang', 'bedrading', 'afleiding'];

function leesRegister() {
  try {
    const r = JSON.parse(fs.readFileSync(REGISTER, 'utf8'));
    return (r && typeof r === 'object' && r.wortels && typeof r.wortels === 'object') ? r : null;
  } catch (e) { return null; }
}

/* Het beeld: wat de scan vindt, naast wat het register zegt. Geen van beide is
   de waarheid op zichzelf -- de scan weet niet wat iets betekent, en het
   register weet niet wat er vandaag in de code staat. */
function vergelijk(uitslag, register) {
  const bekend = register ? register.wortels : {};
  const gevonden = new Map(uitslag.wortels.map(w => [w.id, w]));
  const ongeregistreerd = uitslag.wortels.filter(w => !bekend[w.id]);
  const verdwenen = Object.keys(bekend).filter(id => !gevonden.has(id) && bekend[id].bron !== 'hand');
  const perKlasse = {};
  for (const k of KLASSEN) perKlasse[k] = 0;
  for (const [id, r] of Object.entries(bekend)) {
    if (!gevonden.has(id) && r.bron !== 'hand') continue;
    perKlasse[KLASSEN.includes(r.levensduur) ? r.levensduur : 'onbekend']++;
  }
  return { ongeregistreerd, verdwenen, perKlasse };
}

/* IS DE BELOOFDE RESET OOK EEN ECHTE RESET?

   `levensduur: "herstelbaar"` met `reset: "log.foutenReset()"` is tot hier een
   ZIN. Wie die zin gelooft, hergebruikt straks een server op grond van een
   belofte -- en een gedeelde server die lekt geeft geen fout maar een verkeerd
   antwoord. LAT-regel 6: een belofte in tekst hoort een belofte in code te zijn.

   Deze controle leest de genoemde functie uit de BRON en kijkt of die de wortel
   ook echt aanraakt. Dat is geen luxe. Ik schreef een resetcontract voor
   server/log.js dat beweerde de volgteller mee te nemen; toen ik `foutVolg = 0`
   uit foutenReset() sloopte bleef die toets groen, want foutVolg bepaalt alleen
   de volgorde van foutgroepen en komt nergens naar buiten. Aan de buitenkant is
   een doorlopende teller niet waarneembaar; in de bron is hij dat wel.

   Twee soorten gebrek, want ze hebben twee verschillende reparaties:
     ontbreekt  de genoemde functie staat niet in dat bestand -- verkeerde naam,
                of de reset woont elders (zet dan `resetIn` op dat bestand)
     raaktNiet  de functie bestaat maar schrijft deze wortel niet

   Een reset zonder haakjes ("na een herstart") is geen reset maar een
   omschrijving; die telt als `ontbreekt`, want er valt niets aan te roepen.

   Het `bewijs`-veld gaat door dezelfde molen: het noemt een toetsbestand, en dat
   bestand hoort te bestaan. Een bewijs dat naar een verwijderde toets wijst is
   dezelfde leugen, alleen een verdieping hoger. */
function functieUitReset(tekst) {
  const treffers = String(tekst || '').match(/([A-Za-z_$][\w$]*)\s*\(/g);
  if (!treffers) return null;
  return treffers[treffers.length - 1].replace(/\s*\($/, '');
}

function dekking(register, wortel) {
  const uit = [];
  if (!register || !register.wortels) return uit;
  const gelezen = new Map();
  const lees = (rel) => {
    if (gelezen.has(rel)) return gelezen.get(rel);
    let r = null;
    try { r = schrijversIn(fs.readFileSync(path.join(wortel, rel), 'utf8'), rel); } catch (e) { r = null; }
    gelezen.set(rel, r);
    return r;
  };
  for (const [id, r] of Object.entries(register.wortels)) {
    if (r.levensduur !== 'herstelbaar') continue;
    const naam = id.split('#')[1];
    const bestand = r.resetIn || id.split('#')[0];
    const fn = functieUitReset(r.reset);
    if (!fn) { uit.push({ id, bestand, reset: r.reset, gebrek: 'ontbreekt', reden: 'de reset noemt geen aanroepbare functie' }); continue; }
    const bron = lees(bestand);
    if (!bron) { uit.push({ id, bestand, reset: r.reset, functie: fn, gebrek: 'ontbreekt', reden: bestand + ' is niet te lezen' }); continue; }
    if (!bron.functies.has(fn)) {
      uit.push({ id, bestand, reset: r.reset, functie: fn, gebrek: 'ontbreekt', reden: fn + ' bestaat niet in ' + bestand });
      continue;
    }
    const wie = bron.schrijvers.get(naam);
    if (!wie || !wie.has(fn)) {
      uit.push({ id, bestand, reset: r.reset, functie: fn, gebrek: 'raaktNiet', reden: fn + ' schrijft niet in ' + naam });
      continue;
    }
    const bewijspad = (String(r.bewijs || '').match(/[\w./-]+\.(?:test\.js|js)/) || [])[0];
    if (!bewijspad || !fs.existsSync(path.join(wortel, bewijspad))) {
      uit.push({ id, bestand, reset: r.reset, functie: fn, gebrek: 'bewijsWeg',
        reden: bewijspad ? 'het bewijs wijst naar ' + bewijspad + ', en dat bestand bestaat niet'
                         : 'het bewijs noemt geen toetsbestand' });
    }
  }
  return uit;
}

function meet() {
  const uitslag = scan({ wortel: WORTEL });
  const register = leesRegister();
  return { uitslag, register, ongedekt: dekking(register, WORTEL), ...vergelijk(uitslag, register) };
}

function schrijfRegister(uitslag, register) {
  const bekend = (register && register.wortels) || {};
  const nieuw = {};
  for (const w of uitslag.wortels) {
    /* AFGELEID, NIET GEGOKT. Een wortel die alleen tijdens het laden wordt
       geschreven staat na de boot vast; dat leest de scanner uit de code en
       niet uit een mening (zie `naLaden` in lib/staatscan.js). Zulke wortels
       krijgen `bootvast` vanzelf, want er valt niets aan te classificeren.
       Alles wat ook NA de boot beweegt blijft `onbekend` tot een mens zegt
       wat het betekent -- en telt tot die tijd als procesgebonden, want dat is
       de veilige aanname. */
    const afgeleid = w.naLaden ? 'onbekend' : 'bootvast';
    nieuw[w.id] = bekend[w.id] || {
      eigenaar: eigenaarVan(w.bestand),
      levensduur: afgeleid,
      reset: w.naLaden ? 'onbekend' : 'niet nodig (staat vast na het laden)',
      soort: w.soort,
      bron: 'scan'
    };
    nieuw[w.id].soort = w.soort;                 // de vorm komt altijd uit de scan
    /* Ging een wortel van vast naar bewegend, dan is de oude classificatie niet
       meer waar. Stil laten staan zou het register een leugen maken. */
    if (w.naLaden && nieuw[w.id].levensduur === 'bootvast' && nieuw[w.id].bron === 'scan') {
      nieuw[w.id].levensduur = 'onbekend';
      nieuw[w.id].reset = 'onbekend';
    }
  }
  /* Met de hand toegevoegde wortels (toestand buiten dit proces: Postgres,
     Redis, de schijf) blijven staan; de scan kan die per definitie niet zien. */
  for (const [id, r] of Object.entries(bekend)) if (r.bron === 'hand') nieuw[id] = r;
  const uit = {
    vastgelegd: new Date().toISOString().slice(0, 10),
    uitleg: 'Muteerbare toestandswortels in server/. Geschreven door scripts/staat.js; ' +
      'levensduur en reset vult een MENS in. Een wortel die de scan vindt en hier niet staat, is een fout.',
    klassen: KLASSEN,
    wortels: Object.fromEntries(Object.keys(nieuw).sort().map(k => [k, nieuw[k]]))
  };
  fs.writeFileSync(REGISTER, JSON.stringify(uit, null, 2) + '\n');
  return uit;
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const beeld = meet();
  const { uitslag, register, ongeregistreerd, verdwenen, perKlasse, ongedekt } = beeld;

  if (argv.includes('--json')) {
    console.log(JSON.stringify({
      wortels: uitslag.wortels.length, klokLezingen: uitslag.klokLezingen,
      ongeregistreerd: ongeregistreerd.map(w => w.id), verdwenen, perKlasse,
      ongedekt: ongedekt.map(g => ({ id: g.id, gebrek: g.gebrek, reden: g.reden })),
      willekeur: uitslag.willekeur, timers: uitslag.timers, listeners: uitslag.listeners
    }));
    process.exit(ongeregistreerd.length || ongedekt.length ? 1 : 0);
  }

  if (argv.includes('--vastleggen')) {
    schrijfRegister(uitslag, register);
    console.log('STATE.json geschreven: ' + uitslag.wortels.length + ' wortels' +
      (ongeregistreerd.length ? ' (' + ongeregistreerd.length + ' nieuw, als onbekend)' : '') +
      (verdwenen.length ? ', ' + verdwenen.length + ' verdwenen weggehaald' : ''));
    process.exit(0);
  }

  console.log('\nTOESTANDSREGISTER  (' + uitslag.bestanden + ' bestanden in server/)\n');
  console.log('  muteerbare wortels      ' + String(uitslag.wortels.length).padStart(6));
  for (const k of KLASSEN) {
    const merk = k === 'onbekend' && perKlasse[k] ? '   <- deze kosten een serverstart' : '';
    console.log('    ' + k.padEnd(20) + String(perKlasse[k]).padStart(6) + merk);
  }
  /* DE WERKLIJST. Honderdzeven wortels die een vers proces afdwingen is een
     muur; dezelfde honderdzeven op vorm gesorteerd is een lijst van acht
     regels, met per regel EEN reparatie. Daarom staat hij hier en niet in een
     notitie. */
  const perVorm = {};
  for (const [id, r] of Object.entries(register ? register.wortels : {})) {
    if (!r.patroon) continue;
    if (r.levensduur === 'herstelbaar' || r.levensduur === 'bootvast') continue;
    perVorm[r.patroon] = (perVorm[r.patroon] || 0) + 1;
  }
  const vormen = Object.entries(perVorm).sort((a, b) => b[1] - a[1]);
  if (vormen.length) {
    console.log('\n  wat het hergebruik tegenhoudt, op vorm:');
    for (const [v, n] of vormen) console.log('    ' + v.padEnd(20) + String(n).padStart(6));
    const rest = Object.values(register.wortels).filter(r => r.levensduur === 'onbekend' && !r.patroon).length;
    if (rest) console.log('    ' + '(nog geen vorm)'.padEnd(20) + String(rest).padStart(6));
  }
  console.log('');
  /* De klokschuld staat hier ALS CONTEXT en niet als tweede ratel: KLOK.json is
     daar de eigenaar van, en scripts/klok.js telt hem met dezelfde scanner. Het
     getal hier is de RUWE stand (zonder de drie vrijgestelde bestanden), dus het
     mag een paar hoger zijn dan wat KLOK.json noemt. Wie hem wil bewaken draait
     `node scripts/klok.js`. */
  console.log('  kloklezingen (ruw)      ' + String(uitslag.klokLezingen).padStart(6) +
    '   new Date() ' + uitslag.klok.datumLezing + ', Date.now ' + uitslag.klok.dateNow +
    '  -- de ratel staat in KLOK.json');
  console.log('  new Date(x) constructie ' + String(uitslag.klok.datumBouw).padStart(6) + '   (leest de klok NIET)');
  console.log('  Math.random             ' + String(uitslag.willekeur.math).padStart(6));
  console.log('  crypto-willekeur        ' + String(uitslag.willekeur.crypto).padStart(6));
  console.log('  timers op moduleniveau  ' + String(uitslag.timers).padStart(6));
  console.log('  listeners idem          ' + String(uitslag.listeners).padStart(6));
  if (uitslag.onleesbaar.length) {
    console.log('\n  NIET TE LEZEN door de eigen parser: ' + uitslag.onleesbaar.length +
      ' (' + uitslag.onleesbaar.slice(0, 3).join(', ') + ')');
  }

  if (!register) {
    console.error('\n  STATE.json ontbreekt. Leg hem aan met: node scripts/staat.js --vastleggen\n');
    process.exit(1);
  }
  if (verdwenen.length) {
    console.log('\n  weg uit de code, nog in het register (' + verdwenen.length + '):');
    for (const id of verdwenen.slice(0, 8)) console.log('    ' + id);
    console.log('    ruim op met: node scripts/staat.js --vastleggen');
  }
  /* Een reset die zijn wortel niet aanraakt is erger dan geen reset: op grond
     van die belofte wordt straks een server hergebruikt. */
  if (ongedekt.length) {
    console.error('\n  BELOOFDE RESET DIE DE WORTEL NIET AANRAAKT (' + ongedekt.length + '):');
    for (const g of ongedekt) console.error('    ' + g.id + '\n        ' + g.reden + '  (reset: ' + g.reset + ')');
    console.error('\n  Repareer de reset, of zet de wortel op procesgebonden.\n');
  }
  if (ongeregistreerd.length) {
    console.error('\n  NIEUWE MUTEERBARE TOESTAND ZONDER REGISTRATIE (' + ongeregistreerd.length + '):');
    for (const w of ongeregistreerd.slice(0, 12)) console.error('    ' + w.soort.padEnd(14) + w.id + '  (regel ' + w.lijn + ')');
    if (ongeregistreerd.length > 12) console.error('    ... en nog ' + (ongeregistreerd.length - 12));
    console.error('\n  Toestand die niemand bezit maakt elke gedeelde server onbetrouwbaar.');
    console.error('  Zet hem in STATE.json (node scripts/staat.js --vastleggen) en geef hem');
    console.error('  daarna een eigenaar en een levensduur.\n');
    process.exit(1);
  }
  if (ongedekt.length) process.exit(1);
  console.log('\n  Alle muteerbare toestand staat in het register' +
    (perKlasse.herstelbaar ? ', en elke beloofde reset raakt zijn wortel echt aan' : '') + '.\n');
}

module.exports = { meet, schrijfRegister, leesRegister, dekking, functieUitReset, KLASSEN, PATRONEN };
