#!/usr/bin/env node
/* ============================================================================
   HET GEZAG -- hoeveel plekken beslissen hier of de machine iets zelf mag?

   WAAROM DIT ER IS. RTG stelt op vijf plekken dezelfde vraag, met vijf
   verschillende antwoorden-schalen:

     server/kern/stuur/beleid.js          lezen / klein / voorstel / verboden
     server/kern/frictie/motor.js         hand / assist / auto
     server/kern/geldbeleid/regels.js     kijken / voorstellen / klaarzetten / automatisch
     server/kern/stadsweefsel/ainiveau.js waarnemen / adviseren / voorbereiden / begrensd / verboden
     server/kern/bureau/delegatie.js      informeren / aanbevelen / voorbereiden / uitvoeren / autonoom

   Vijf schalen, drie tot vijf treden, en geen enkele plek waar ze elkaar kunnen
   tegenspreken. Dat is LAT.md regel 4 in het hart van de veiligheid: zodra
   dezelfde waarheid op twee plekken staat lopen ze uiteen, niet misschien maar
   zeker, en meestal zonder dat iets klaagt.

   Dat is hier al gebeurd, en het staat als `tegenspraken` in GEZAG.json:
   ainiveau.js zet 'een vergunning of aanvraag afwijzen' op niveau 4 ("nooit
   zonder een expliciete menselijke beslissing", en in de kop: "hier komt geen
   machine aan, met of zonder sleutel"), terwijl stuur/beleid.js precies die
   handeling als `voorstel` toelaat -- en `magAutomatisch()`, dat in zijn eigen
   commentaar "de enige plek die daar antwoord op geeft" heet, wordt op die weg
   nooit aangeroepen.

   EN DE TWEEDE VORM, die harder telt omdat hij groeit: modules die een
   niveaunaam OVERSCHRIJVEN als kale tekenreeks zonder de schaal te importeren.
   `niveau: 'hand'` staat zo in achttien Command-modules. Hernoem 'hand' in
   risico.js en die achttien blijven het oude woord schrijven -- geen fout, geen
   log, alleen een tak die nooit meer vuurt. Dat is de stilste vorm die er is
   (LAT.md regel 5).

   WAT DEZE METER WEL DOET
     1 hij controleert of elke geregistreerde schaal nog letterlijk in zijn
       bestand staat -- een belofte in tekst is een belofte in code (regel 6);
     2 hij telt de losse niveaunamen: een vergelijking of toekenning op een veld
       dat letterlijk `niveau` heet, met een woord uit een schaal die het bestand
       niet importeert;
     3 hij ijkt zichzelf: vindt hij de schalen niet eens in hun EIGEN bestand,
       dan is de meter stuk en zakt hij, in plaats van 0 te melden (regel 3).

   WAT DEZE METER NIET DOET, en dat hoort erbij:

   - Hij ziet alleen wat in het register staat. Een ZESDE vocabulaire met
     helemaal eigen woorden is hier onzichtbaar, precies zoals WETTEN.json alleen
     bevat wat iemand heeft opgeschreven. Wie er een bijbouwt met bestaande
     woorden valt wel op (dan stijgt het aantal losse niveaunamen).
   - Hij oordeelt niet of vijf schalen FOUT zijn. Vier van de vijf zijn los van
     elkaar zorgvuldig gebouwd. Het bezwaar is niet hun kwaliteit maar dat geen
     mens en geen machine ze naast elkaar kan leggen.
   - `niveau` is in dit huis een overladen woord: het betekent ook gezondheid
     ('rust'/'aandacht') en rang. Daarom telt alleen een woord dat IN een
     geregistreerde gezagsschaal staat, en nooit het veld op zichzelf.

   WAAROM HET AAN EEN RATEL HANGT. Een zesde schaal erbij is een middag werk en
   voelt lokaal als de nette keuze. Pas als het getal een kant op mag, wordt het
   een besluit in plaats van erosie -- dezelfde afspraak als NORM.json en
   KLOK.json.

   Draai:  node scripts/gezag.js
           node scripts/gezag.js --lijst          (alle losse niveaunamen)
           node scripts/gezag.js --vastleggen
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { zonderCommentaar } = require('./lib/bron');

const WORTEL = path.join(__dirname, '..');
const UITSLAG = path.join(WORTEL, 'GEZAG.json');
const argv = process.argv.slice(2);
const VASTLEGGEN = argv.includes('--vastleggen');
const LIJST = argv.includes('--lijst');

/* HET REGISTER. Per vocabulaire: waar de schaal woont, de treden in volgorde
   van "de mens doet het" naar "de machine doet het", en wie hij bestuurt.
   De volgorde is niet decoratief: hij laat zien dat de vijf schalen niet eens
   even lang zijn, en dus niet op elkaar af te beelden zonder een besluit. */
const REGISTER = [
  { bestand: 'server/kern/stuur/beleid.js',
    schaal: ['verboden', 'lezen', 'voorstel', 'klein'],
    beslisser: 'beleidVoor',
    bestuurt: 'de AI over HTTP-routes, per rol (member/supplier/staff)' },
  /* Verhuisd uit server/kern/command/ naar server/kern/frictie/ (met ./bodem.js
     ernaast), omdat het AI-stuur hem daar niet aanriep en daarom zijn eigen,
     armere model bouwde. De schaal is niet veranderd, de plek wel -- en dat is
     precies wat deze meter hoort te merken. */
  { bestand: 'server/kern/frictie/motor.js',
    schaal: ['hand', 'assist', 'auto'],
    beslisser: 'beoordeel',
    bestuurt: 'handelingen die de machine kan raken, met een frictiescore per geval en een bodem eronder' },
  { bestand: 'server/kern/geldbeleid/regels.js',
    schaal: ['kijken', 'voorstellen', 'klaarzetten', 'automatisch'],
    beslisser: 'regelZet',
    bestuurt: 'geldregels van een lid (GELD.md par. 3/4)' },
  { bestand: 'server/kern/stadsweefsel/ainiveau.js',
    schaal: ['waarnemen', 'adviseren', 'voorbereiden', 'begrensd', 'verboden'],
    beslisser: 'magAutomatisch',
    bestuurt: 'handelingen van het stadsweefsel' },
  { bestand: 'server/kern/bureau/delegatie.js',
    schaal: ['informeren', 'aanbevelen', 'voorbereiden', 'uitvoeren', 'autonoom'],
    beslisser: 'DOMEINEN',
    bestuurt: 'wat het concierge-bureau namens een lid uit handen krijgt' }
];

/* DE OPGELOSTE TEGENSPRAKEN, met dezelfde tand als de openstaande.

   Een bevinding die verdwijnt zodra hij gerepareerd is, laat niets achter dat
   de reparatie vasthoudt: de volgende ronde haalt iemand de koppeling weg en
   niemand merkt het, want er staat geen tegenspraak meer om na te trekken. Dus
   blijft hij staan, met de zinnen die BEWIJZEN dat de reparatie er is. Valt er
   een weg, dan meldt deze meter 'veranderd' en hoort er iemand te kijken.

   'vergunning-of-aanvraag-afwijzen' stond hier als openstaande tegenspraak:
   ainiveau.js verbood de machine een aanvraag af te wijzen (niveau 4) terwijl
   het AI-stuur precies dat als voorstel liet samenstellen, en magAutomatisch()
   -- "de enige plek die daar antwoord op geeft" -- werd op die weg nooit
   aangeroepen. Opgelost op 3 september 2026 (TAKEN.md 4.56) langs de weg die
   geen van beide documenten hoefde te verzwakken: ambtenaar.js ROEPT
   magAutomatisch() aan en kiest geen dossier meer uit. Wie de referentie noemt
   krijgt nog steeds een voorstel -- dat is niveau 2, "een mens keurt goed" --
   maar de machine kiest nooit meer OVER WIE het gaat. */
const OPGELOST = [
  {
    naam: 'vergunning-of-aanvraag-afwijzen',
    wat: 'De machine stelde een afwijzing samen EN koos zonder referentie zelf het dossier ' +
         '(arr[0] uit de lijst), terwijl ainiveau.js dat op niveau 4 zet.',
    hoe: 'ambtenaar.js roept magAutomatisch() aan, geeft zijn reden door aan de mens die bevestigt, ' +
         'en weigert een dossier te kiezen zodra er geen referentie in de vraag staat.',
    kanten: [
      { bestand: 'server/kern/stadsweefsel/ainiveau.js', zin: "'vergunning-weigeren': { niveau: 4" },
      { bestand: 'server/routes/supplier/ai/ambtenaar.js', zin: 'magAutomatisch(AANVRAAG_BESLUIT)' },
      { bestand: 'server/routes/supplier/ai/ambtenaar.js', zin: 'Ik kies geen ' }
    ]
  }
];

/* DE TEGENSPRAKEN die met de hand zijn vastgesteld en die deze meter bij elke
   ronde opnieuw natrekt. Elk stuk is een LETTERLIJKE zin uit de bron -- geen
   regex, want een patroon met ontsnapte schuine strepen erin is bij het lezen
   niet meer na te vertellen en matcht bij de eerste tikfout stilzwijgend niets.
   Verdwijnt de zin, dan is de tegenspraak opgelost of verplaatst en moet dit
   register bij. Zo kan een bevinding niet stilletjes verdampen, en ook niet
   blijven staan als hij al gerepareerd is. */
const TEGENSPRAKEN = [];

/* De bestanden waar een niveaunaam GEEN gezag betekent. Elk met een reden --
   staat er geen reden, dan hoort het hier niet; dezelfde afspraak als de
   MAG-lijst in scripts/klok.js en de PUBLIEK-lijst van de poortwacht. */
const GEEN_GEZAG = new Map([
  ['server/kern/levenslijn/cockpit.js',
   "De levenscockpit draagt een EIGEN tweetrapsschaal -- 'kijken' en 'openen' -- " +
   'en die deelt alleen het woord `kijken` met de geldbeleidschaal. De kop van dat ' +
   'bestand schrijft het uit: deze wereld voert niets uit, en zelfs `openen` wijst ' +
   'alleen een deur aan. Hem de geldbeleidschaal laten importeren zou een ' +
   'afhankelijkheid maken die er inhoudelijk niet is, en hem als zesde vocabulaire ' +
   'registreren zou de ratel omhoog duwen voor twee treden die niets besturen.']
]);

function loopJs(map, uit) {
  let namen;
  try { namen = fs.readdirSync(map, { withFileTypes: true }); } catch (e) { return uit; }
  for (const e of namen) {
    const p = path.join(map, e.name);
    if (e.isDirectory()) loopJs(p, uit);
    else if (e.name.endsWith('.js')) uit.push(p);
  }
  return uit;
}

function lees(vol) {
  let ruw;
  try { ruw = fs.readFileSync(vol, 'utf8'); } catch (e) { return null; }
  // een binair bestand met een .js-naam (server/kern/schild.js) bevat geen code
  // die gezag verdeelt; stil overslaan is hier juist, meetellen zou vervuilen
  if (ruw.indexOf('\u0000') >= 0) return null;
  try { return zonderCommentaar(ruw); } catch (e) { return ruw; }
}

/* Het woord moet AAN HET BEGRIP hangen. Zonder de eis dat het veld letterlijk
   `niveau` heet, telt "auto" (het voertuig) en "hand" (het lichaamsdeel) mee --
   de eerste versie van deze meter vond zo 36 gevallen waarvan de meeste
   Nederlands waren en geen gezag. Een census die je moet wegstrepen wordt binnen
   een week genegeerd (LAT.md, over scripts/samenhang.js). */
function vorm(w) {
  const q = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    "niveau\\s*[=!]==\\s*'" + q + "'" +
    "|'" + q + "'\\s*[=!]==\\s*[\\w.]*niveau" +
    "|niveau\\s*:\\s*'" + q + "'" +
    "|niveau\\s*=\\s*'" + q + "'");
}

function meet() {
  const bestanden = loopJs(path.join(WORTEL, 'server'), []);
  const bron = new Map();          // relpad -> code zonder commentaar
  for (const f of bestanden) {
    const code = lees(f);
    if (code != null) bron.set(path.relative(WORTEL, f).replace(/\\/g, '/'), code);
  }

  /* DE ZELFIJKING (LAT.md regel 3 en 10). Elke geregistreerde schaal moet in
     zijn EIGEN bestand terug te vinden zijn. Lukt dat niet, dan is de schaal
     hernoemd of verplaatst en meet alles hieronder niets meer -- dan hoort deze
     meter te zakken en niet netjes 0 te melden. */
  const stuk = [];
  for (const v of REGISTER) {
    const code = bron.get(v.bestand);
    if (code == null) { stuk.push(v.bestand + ': bestaat niet meer'); continue; }
    const mist = v.schaal.filter(w => !new RegExp("'" + w + "'").test(code));
    if (mist.length) stuk.push(v.bestand + ': schaal mist ' + mist.join('/'));
    /* DE BESLISSER MOET ER ALS DECLARATIE STAAN, niet alleen als naam. Hier
       stond eerst `\bnaam\b`, en die controle kon niet zakken: haal
       `function magAutomatisch` weg en de naam staat nog in de export-regel, dus
       de meter bleef groen terwijl de beslisser verdwenen was. Precies de vorm
       uit LAT.md regel 9, gevonden doordat de mutatie in test/gezag.test.js werd
       AFGESLAGEN in plaats van raak was. */
    const declaratie = new RegExp(
      '(?:function|const|let|var)\\s+' + v.beslisser + '\\b' +
      '|' + v.beslisser + '\\s*[:=]\\s*(?:function|\\()');
    if (v.beslisser && !declaratie.test(code))
      stuk.push(v.bestand + ': beslisser ' + v.beslisser + ' is niet meer gedeclareerd');
  }

  /* DE LOSSE NIVEAUNAMEN. Een bestand dat een woord uit schaal S gebruikt op een
     `niveau`-veld, maar geen enkele schaal importeert waar dat woord in staat,
     houdt een kopie van die waarheid vast.

     DE TOETS GAAT PER WOORD EN NIET PER SCHAAL, en dat is geen detail: 'verboden'
     en 'voorbereiden' staan elk in TWEE schalen. De eerste versie hiervan keek
     per schaal en beschuldigde daardoor server/kern/stuur.js -- dat netjes
     server/kern/stuur/beleid.js binnenhaalt en `beleid.niveau === 'verboden'`
     leest -- van een kopie uit ainiveau.js, waar het niets mee te maken heeft.
     Een meter die een correct bestand aanwijst, wordt weggeklikt en daarna
     genegeerd. */
  const importeert = new Map();
  for (const [rel, code] of bron) {
    const set = new Set();
    for (const v of REGISTER) {
      if (rel === v.bestand) { set.add(v.bestand); continue; }
      /* TWEE MANIEREN OM DEZELFDE SCHAAL BINNEN TE HALEN, en de meter kende er
         eerst maar een. Hij zocht naar de BESTANDSNAAM in een require, wat
         klopt zolang een schaal in een los bestand woont. Toen de frictieschaal
         naar een map verhuisde (kern/frictie/motor.js, met een index ernaast
         die hem doorgeeft), werd elke roeper van `require('../frictie')`
         opeens als losse niveaunaam geteld -- twaalf bestanden die niets
         verkeerd deden. Een meter die correcte code beschuldigt, wordt
         weggeklikt; zie de kop hierboven, dat is hier al eens gebeurd.

         Woont het geregistreerde bestand in een map met een index.js, dan telt
         een require op die MAP dus ook als importeren. */
      const mod = path.basename(v.bestand, '.js');
      const map = path.basename(path.dirname(v.bestand));
      const viaMap = fs.existsSync(path.join(WORTEL, path.dirname(v.bestand), 'index.js'));
      const namen = viaMap ? [mod, map] : [mod];
      if (namen.some(n => new RegExp("require\\([^)]*\\b" + n + "\\b[^)]*\\)").test(code)))
        set.add(v.bestand);
    }
    importeert.set(rel, set);
  }
  const los = [];
  for (const [rel, code] of bron) {
    if (GEEN_GEZAG.has(rel)) continue;
    const heeft = importeert.get(rel);
    const woorden = [];
    for (const v of REGISTER) {
      if (rel === v.bestand) continue;
      for (const w of v.schaal) {
        if (woorden.some(x => x.woord === w)) continue;
        if (!vorm(w).test(code)) continue;
        /* HIER STOND EEN VRIJSTELLING, EN DIE MAAKTE DE NUL ZACHT. Een bestand
           dat de schaal ophaalde werd niet meer geteld -- ook niet als het de
           trede DAARNAAST nog steeds als kale tekenreeks schreef. Dat is precies
           de drift die deze meter hoort te vinden: `const { NIVEAUS } =
           require(...)` erboven en `niveau: 'hand'` eronder overleeft een
           hernoeming even stil als een bestand dat niets importeert. Gemeten op
           2 september 2026: tien van die plekken, over vijf bestanden die alle
           vijf keurig importeerden. Ze zijn omgezet, en de vrijstelling is weg.

           Wat de vrijstelling ooit moest voorkomen (een correct bestand
           beschuldigen) doet de regel eronder al: de toets gaat PER WOORD, dus
           een bestand dat zijn trede uit de bron ophaalt schrijft het woord
           niet meer en valt hier vanzelf buiten.

           De schaal die erbij gemeld wordt is die van het bestand zelf als het
           er een ophaalt -- 'verboden' en 'voorbereiden' staan in twee schalen,
           en dan wijst een willekeurige de lezer de verkeerde kant op. */
        const eigen = REGISTER.find(a => a.schaal.includes(w) && heeft.has(a.bestand));
        woorden.push({ woord: w, schaal: (eigen || v).bestand });
      }
    }
    for (const w of woorden) los.push({ bestand: rel, schaal: w.schaal, woorden: [w.woord] });
  }

  /* DE OPGELOSTE natrekken met DEZELFDE tand: staan de zinnen die de reparatie
     bewijzen er nog letterlijk? Valt er een weg, dan is de reparatie eruit
     gehaald en hoort dat op te vallen -- anders laat een opgeloste bevinding
     niets achter dat hem vasthoudt. */
  const opgelost = OPGELOST.map(t => {
    const kwijt = t.kanten.filter(k => {
      const code = bron.get(k.bestand);
      if (code == null) return true;
      return !code.includes(k.zin);
    }).map(k => k.bestand + ': ' + k.zin);
    return { naam: t.naam, wat: t.wat, hoe: t.hoe,
      staat: kwijt.length ? 'REPARATIE WEG' : 'blijft staan', kwijt };
  });

  /* DE TEGENSPRAKEN natrekken: staan beide kanten er nog letterlijk? */
  const tegenspraken = TEGENSPRAKEN.map(t => {
    const kwijt = t.kanten.filter(k => {
      const code = bron.get(k.bestand);
      if (code == null) return true;
      return !code.includes(k.zin);
    }).map(k => k.bestand);
    return { naam: t.naam, wat: t.wat, ernst: t.ernst, staat: kwijt.length ? 'veranderd' : 'staat nog', kwijt };
  });

  // per bestand de woorden bij hun schaal groeperen: vijf losse regels voor een
  // bestand leest als vijf bevindingen terwijl het er een is
  const perBestand = new Map();
  for (const l of los) {
    const perSchaal = perBestand.get(l.bestand) || new Map();
    const naam = l.schaal.replace('server/kern/', '');
    perSchaal.set(naam, (perSchaal.get(naam) || []).concat(l.woorden));
    perBestand.set(l.bestand, perSchaal);
  }

  return { stuk, los, perBestand, tegenspraken, opgelost,
    vocabulaires: REGISTER.length, losseNiveaunamen: perBestand.size };
}

/* De uitslag als JSON, los van het scherm. Dit is wat GEZAG.json wordt en wat
   een toets kan lezen zonder de uitvoer te moeten ontleden. */
function stand(nu) {
  return {
    uitleg: 'Hoeveel losse schalen beantwoorden in RTG de vraag "mag de machine dit zelf". ' +
      'MAG ALLEEN KRIMPEN. Vijf vocabulaires voor een vraag is LAT.md regel 4 in het hart van ' +
      'de veiligheid: twee plekken die dezelfde waarheid vasthouden lopen uiteen, en meestal ' +
      'zonder dat iets klaagt. Er is geen gedeelde noemer: geen van de vijf drukt zijn ' +
      'handelingen uit in een namespace die een van de andere vier kan lezen, dus geen mens ' +
      'en geen machine kan ze naast elkaar leggen.',
    hoe: 'node scripts/gezag.js --lijst',
    gemeten: { vocabulaires: nu.vocabulaires, losseNiveaunamen: nu.losseNiveaunamen },
    vocabulaires: REGISTER.map(v => ({ bestand: v.bestand, schaal: v.schaal, beslisser: v.beslisser, bestuurt: v.bestuurt })),
    tegenspraken: nu.tegenspraken.map(t => ({ naam: t.naam, wat: t.wat, ernst: t.ernst })),
    opgelost: nu.opgelost.map(t => ({ naam: t.naam, wat: t.wat, hoe: t.hoe }))
  };
}

function leesVastgelegd() {
  try { return JSON.parse(fs.readFileSync(UITSLAG, 'utf8')); } catch (e) { return null; }
}

/* GEEFT EEN EXITCODE TERUG IN PLAATS VAN process.exit() TE DOEN, zodat een toets
   hem in hetzelfde proces kan draaien en de mutatiemotor deze module echt kan
   muteren. Een script dat zijn werk bij het laden doet, is voor allebei
   onbereikbaar -- en dan telt hij als "niet gemeten" terwijl er een toets op staat. */
function main() {
  const nu = meet();
  const oud = leesVastgelegd();

  console.log('\n=== HET GEZAG ===\n');

  if (nu.stuk.length) {
    console.log('  DE METER IS STUK -- een geregistreerde schaal is niet meer te vinden:\n');
    for (const s of nu.stuk) console.log('    - ' + s);
    console.log('\n  Zolang dit staat meet niets hieronder iets. Werk het REGISTER in');
    console.log('  scripts/gezag.js bij, of zet de schaal terug.');
    return 2;
  }

  console.log('  gezagsvocabulaires  : ' + nu.vocabulaires);
  for (const v of REGISTER) {
    console.log('      ' + v.schaal.join(' < ').padEnd(64) + v.bestand.replace('server/kern/', ''));
  }
  console.log('\n  losse niveaunamen   : ' + nu.losseNiveaunamen +
    '  (bestanden die een trede overschrijven zonder de schaal te importeren)');

  if (LIJST) {
    console.log();
    for (const [b, perSchaal] of [...nu.perBestand].sort()) {
      const tekst = [...perSchaal].map(([s, w]) => s + ':' + w.join('/')).join(' | ');
      console.log('    ' + b.padEnd(46) + tekst);
    }
  }

  console.log('\n  tegenspraken        : ' + nu.tegenspraken.length);
  for (const t of nu.tegenspraken) {
    console.log('    [' + t.staat + '] ' + t.naam);
    if (t.staat === 'veranderd') console.log('      veranderd in: ' + t.kwijt.join(', ') + ' -- werk GEZAG.json bij');
  }
  console.log('  opgelost, bewaakt   : ' + nu.opgelost.length);
  for (const t of nu.opgelost) {
    console.log('    [' + t.staat + '] ' + t.naam);
    if (t.staat !== 'blijft staan') console.log('      de reparatie is weg uit: ' + t.kwijt.join(', '));
  }

  /* EEN WEGGEVALLEN REPARATIE IS EEN GEZAKTE METER, en niet een regel die
     stiller wordt. Zonder deze tak zou OPGELOST een lijst mooie woorden zijn:
     je haalt de koppeling weg, de meter meldt het in het klein en gaat groen
     verder. Dan is een opgeloste bevinding erger dan een openstaande. */
  const reparatieWeg = nu.opgelost.filter(t => t.staat !== 'blijft staan');
  if (reparatieWeg.length) {
    console.log('\n  ZAKT: de reparatie van ' + reparatieWeg.map(t => t.naam).join(', ') +
      ' is niet meer in de bron te vinden.');
    console.log('  Een opgeloste tegenspraak blijft hier staan om precies deze reden: hij houdt');
    console.log('  vast dat de koppeling er nog is. Zet hem terug, of verklaar in scripts/gezag.js');
    console.log('  waarom hij anders is gerepareerd -- met de nieuwe zinnen erbij.');
    return 1;
  }

  if (VASTLEGGEN) {
    if (oud && (nu.vocabulaires > oud.gemeten.vocabulaires || nu.losseNiveaunamen > oud.gemeten.losseNiveaunamen)) {
      console.log('\n  GEWEIGERD: de ratel legt geen verslechtering vast (' +
        oud.gemeten.vocabulaires + '/' + oud.gemeten.losseNiveaunamen + ' -> ' +
        nu.vocabulaires + '/' + nu.losseNiveaunamen + ').');
      return 1;
    }
    fs.writeFileSync(UITSLAG, JSON.stringify(stand(nu), null, 2) + '\n');
    console.log('\n  vastgelegd in GEZAG.json');
    return 0;
  }

  if (!oud) { console.log('\n  Nog geen GEZAG.json. Leg de stand vast met --vastleggen.'); return 0; }

  const slechter = [];
  if (nu.vocabulaires > oud.gemeten.vocabulaires)
    slechter.push('vocabulaires ' + oud.gemeten.vocabulaires + ' -> ' + nu.vocabulaires);
  if (nu.losseNiveaunamen > oud.gemeten.losseNiveaunamen)
    slechter.push('losse niveaunamen ' + oud.gemeten.losseNiveaunamen + ' -> ' + nu.losseNiveaunamen);

  if (slechter.length) {
    console.log('\n  ZAKT: ' + slechter.join('; ') + '.');
    console.log('  Er is gezag bijgekomen op een plek die de andere vier niet kan lezen.');
    console.log('  Laat de nieuwe code een BESTAANDE schaal importeren in plaats van de');
    console.log('  treden als tekenreeks over te schrijven -- node scripts/gezag.js --lijst');
    console.log('  laat zien waar het al gebeurt.');
    return 1;
  }
  if (nu.vocabulaires < oud.gemeten.vocabulaires || nu.losseNiveaunamen < oud.gemeten.losseNiveaunamen) {
    console.log('\n  BETER dan GEZAG.json (' + oud.gemeten.vocabulaires + '/' + oud.gemeten.losseNiveaunamen +
      ' -> ' + nu.vocabulaires + '/' + nu.losseNiveaunamen + '). Zet de ratel strakker met --vastleggen.');
    return 0;
  }
  console.log('\n  De stand is gelijk aan GEZAG.json.');
  return 0;
}

module.exports = { meet, stand, main, REGISTER, TEGENSPRAKEN };

if (require.main === module) process.exit(main());
