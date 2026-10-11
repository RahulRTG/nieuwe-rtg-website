#!/usr/bin/env node
/* ============================================================================
   HET VERVAL -- een verlaging van de lat mag, maar niet voor altijd en niet
   in stilte.

   NORM.json kan alleen strakker worden gezet door scripts/norm.js. Losser
   kan alleen met de hand, en dat is met opzet zo: een poort zonder uitweg
   wordt uitgezet, en dan is er geen poort meer. De uitweg staat in de kop van
   norm.js beschreven als "dan staat het als bewuste keuze in de historie in
   plaats van als sluipende erosie".

   Er zaten twee gaten in die zin, en dit script sluit ze allebei.

   GAT EEN: DE NOTITIE WAS EEN GEWOONTE, GEEN EIS. NORM.json draagt 62 notities
   waarin elke handmatige verzetting is verantwoord -- een ongewoon nauwkeurig
   register. Maar niets hield tegen dat de 63e er niet kwam. Wie een getal in
   NORM.json verlaagt en verder niets doet, komt gewoon door de poort: norm.js
   vergelijkt de METING met de NORM en heeft geen idee dat de norm zelf net is
   opgeschoven. De ratel bewaakt de code en niemand bewaakte de ratel.

   GAT TWEE: EEN REDEN HAD GEEN EINDE. Een verlaging met een goede reden blijft
   staan tot iemand er toevallig over struikelt. Een excuus dat nooit verloopt
   is na een half jaar geen uitzondering meer maar een tweede norm, en die staat
   nergens opgeschreven.

   TWEE SOORTEN VERLAGING, EN HET VERSCHIL IS ECHT.

     STRUCTUREEL -- het gemetene is van vorm veranderd. Elf schermtoetsen
     verdwenen omdat de schermen verdwenen (notitie van 17 augustus). Daar valt
     niets terug te halen, dus een vervaldatum is zinloos. Wat er wel hoort te
     staan is WAARHEEN de belofte is gegaan: welke toets draagt nu wat die elf
     droegen? Zonder dat antwoord is het geen vormverandering maar verlies.

     SCHULD -- we konden het even niet. Dat mag, en dan hoort er een datum bij
     waarop het weer terug is. Na die datum zakt dit script tot de meter terug
     is op de waarde van voor de verlaging, of tot een latere verbetering de
     omvang van precies die tranche aantoonbaar heeft afgelost. Nieuwe schuld
     blijft een nieuwe notitie met een eigen reden en datum; zij kan de oude
     niet verlengen. Zo wordt een schuld geind in plaats van vergeten.

     ONTDEKT -- de meter ziet nu bestaande schuld die hij eerst miste. Geen
     regressie maar een betere waarheid; daarom geen rood, wel een notitie met
     het meetscript, de nieuwe stand, een afbouwdoel en een datum (ZERO.md par. 3).

   WAAROM DE REGEL EEN BEGINDATUM HEEFT. De 62 bestaande notities zijn het
   register van dit huis en niet mijn werk om achteraf in te delen; ze zijn
   geschreven voordat deze twee velden bestonden. `vervalregel.vanaf` in
   NORM.json zegt vanaf wanneer de eis geldt. Dat is geen achterdeur maar het
   tegenovergestelde: zonder die datum zou de regel over de hele historie
   struikelen en binnen een dag zijn uitgezet.

   WAT DEZE BEWAKER NIET VANGT:

     - Een meter die met de hand wordt TOEGEVOEGD met een te losse waarde. Hij
       stond niet in de basis, dus er is geen verlaging te zien. Wat dat
       begrenst: een nieuwe meter moet in de METERS-lijst staan en geijkt zijn
       (check.js regel 35), en zodra de echte meting beter uitvalt trekt
       norm.js hem bij de eerste --vastleggen alsnog strak.
     - Of een `structureel` terecht structureel is. Dat de notitie zegt waarheen
       de belofte ging, is te zien; of die belofte daar ook echt is aangekomen,
       is mensenwerk. Dit is de plek waar dit script op mensen vertrouwt.
     - De DREMPEL van een vervaldatum. Een schuld tot het jaar 2099 voldoet aan
       de vorm. Wat daartegen staat is niet een machine maar de leesbaarheid:
       de datum staat in NORM.json en valt op.

   Draai:  node scripts/normverval.js
           node scripts/normverval.js --basis origin/main
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const WORTEL = process.env.RTG_VERVAL_WORTEL ? path.resolve(process.env.RTG_VERVAL_WORTEL) : path.join(__dirname, '..');
const K = { rood: '\x1b[31m', groen: '\x1b[32m', geel: '\x1b[33m', grijs: '\x1b[2m', blauw: '\x1b[36m', reset: '\x1b[0m', vet: '\x1b[1m' };
const { bepaalBasis, versieBij } = require('./lib/basis');
const arg = (naam, std) => { const i = process.argv.indexOf(naam); return i > 0 ? process.argv[i + 1] : std; };

/* VANDAAG KOMT VAN BUITEN. Zou dit script new Date() gebruiken, dan is er geen
   manier om te BEWIJZEN dat een verlopen schuld hem laat zakken zonder de klok
   van de machine te verzetten -- en een proef die de systeemklok verzet, laat
   rommel achter zodra hij halverwege sneuvelt. */
const VANDAAG = process.env.RTG_VERVAL_VANDAAG || new Date().toISOString().slice(0, 10);

/* ------------------------------------------------------- de richting per meter */

/* Zonder richting is "slechter" niet te bepalen, en dan hoort dit script te
   zakken in plaats van te gokken (LAT.md regel 3). De richting staat bij de
   meter zelf: in de METERS-lijst van norm.js, of naast de METER-constante van
   het script dat hem meet. Een tabel op een derde plek zou uiteenlopen. */
function richtingen() {
  const uit = new Map();
  const norm = require('./norm.js');
  for (const m of norm.METERS.concat(norm.PRESTATIEMETERS)) uit.set(m.sleutel, m.richting);
  const map = path.join(WORTEL, 'scripts');
  for (const bestand of fs.existsSync(map) ? fs.readdirSync(map).filter(f => f.endsWith('.js') && f !== 'norm.js') : []) {
    const bron = fs.readFileSync(path.join(map, bestand), 'utf8');
    /* METER en RICHTING horen bij elkaar via hun achtervoegsel: METER bij
       RICHTING, METER_N bij RICHTING_N. Zo kan een script meer dan een meter
       dragen zonder dat de richtingen door elkaar lopen. */
    for (const m of bron.matchAll(/^const METER([A-Z_]*)\s*=\s*'([a-zA-Z0-9]+)'/gm)) {
      const r = new RegExp("^const RICHTING" + m[1] + "\\s*=\\s*'(omhoog|omlaag)'", 'm').exec(bron);
      if (r) uit.set(m[2], r[1]);
    }
  }
  return uit;
}

const slechter = (richting, nu, toen) => richting === 'omlaag' ? nu > toen : nu < toen;

/* De ratel heeft twee vakken met exact dezelfde betekenis: gewone meters en
   prestatiemeters. De eerste vervalbewaker keek alleen in `meters`, waardoor
   een verlopen p99-schuld niet als 233 ms maar als "meter verdwenen" werd
   gemeld. Dat is niet alleen een slechte melding: hij kon daardoor ook nooit
   vaststellen of de schuld werkelijk was afbetaald. Dubbel voorkomen is een
   fout in plaats van een stil gekozen winnaar. */
function meterstand(norm, sleutel) {
  const gevonden = [];
  if (norm && norm.meters && Object.prototype.hasOwnProperty.call(norm.meters, sleutel)) gevonden.push(norm.meters[sleutel]);
  if (norm && norm.prestatie && Object.prototype.hasOwnProperty.call(norm.prestatie, sleutel)) gevonden.push(norm.prestatie[sleutel]);
  if (gevonden.length > 1) throw new Error('meter ' + sleutel + ' staat zowel onder meters als prestatie');
  return gevonden.length ? gevonden[0] : undefined;
}

const verslechtering = (richting, van, naar) => richting === 'omlaag' ? naar - van : van - naar;
const verbetering = (richting, van, naar) => richting === 'omlaag' ? van - naar : naar - van;

function overgang(notitie, sleutel) {
  const veilig = String(sleutel).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp('(?:^|[^a-zA-Z0-9])' + veilig + '\\s+(-?\\d+(?:[.,]\\d+)?)\\s*->\\s*(-?\\d+(?:[.,]\\d+)?)').exec(String(notitie && notitie.meter || ''));
  if (!m) return null;
  return { van: Number(m[1].replace(',', '.')), naar: Number(m[2].replace(',', '.')) };
}

/* SCHULD IS EEN TRANCHE, GEEN EEUWIG SLOT OP HET TOTAAL.

   Een meter kan na een tijdelijke +4 eerst met 31 verbeteren en daarna door
   een NIEUWE, afzonderlijk genoteerde noemerwijziging honderden punten hoger
   staan. De oude implementatie vergeleek het huidige totaal dan eeuwig met de
   historische `van`: alle latere notities werden betekenisloos en een echte
   aflossing was niet meer uit te drukken.

   `aflossingsbewijs` repareert dat zonder een datum te verlengen of een norm te
   verruimen. Het is een klein bewijsrecord: de schuld noemt gestructureerd zijn
   `naar`, en de aflossing noemt een latere gemeten verbetering plus de plek
   waar die stand is terug te vinden. De bewaker rekent zelf na dat richting en
   omvang voldoende zijn. Een tekst "afgelost" of een te kleine verbetering
   opent dus niets. Nieuwe schulden blijven hun eigen vervaldatum houden. */
function oordeelAflossing(n, richting, context = {}) {
  if (n.aflossingsbewijs === undefined) return { aanwezig: false, geldig: false };
  const a = n.aflossingsbewijs;
  if (!a || typeof a !== 'object') return { aanwezig: true, geldig: false, reden: '`aflossingsbewijs` is geen bewijsobject' };
  if (typeof n.naar !== 'number') return { aanwezig: true, geldig: false, reden: 'de schuld mist `naar`, dus haar omvang is niet na te rekenen' };
  if (typeof a.van !== 'number' || typeof a.naar !== 'number') return { aanwezig: true, geldig: false, reden: 'de aflossing mist numerieke `van` en `naar`' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(a.datum || ''))) return { aanwezig: true, geldig: false, reden: 'de aflossing mist een datum' };
  if (String(a.datum) < String(n.datum || '')) return { aanwezig: true, geldig: false, reden: 'de aflossing ligt voor het ontstaan van de schuld' };
  if (!String(a.bewijs || '').trim()) return { aanwezig: true, geldig: false, reden: 'de aflossing noemt geen bewijs' };
  if (!String(a.bronVan || '').trim() || !String(a.bronNaar || '').trim())
    return { aanwezig: true, geldig: false, reden: 'de aflossing mist machineleesbare bronVan of bronNaar' };
  const alle = (context.notities || []).filter(x => x && typeof x === 'object');
  const zoek = tekst => alle.find(x => x.meter === tekst);
  const vanNotitie = zoek(a.bronVan);
  const vanOvergang = overgang(vanNotitie, n.sleutel);
  if (!vanOvergang || vanOvergang.naar !== a.van)
    return { aanwezig: true, geldig: false, reden: 'bronVan bewijst de opgegeven beginstand niet' };
  if (String((vanNotitie && vanNotitie.datum) || '') > String(a.datum))
    return { aanwezig: true, geldig: false, reden: 'bronVan ligt na de aflossingsdatum' };
  if (a.bronNaar === 'huidige meter') {
    if (context.nu !== a.naar) return { aanwezig: true, geldig: false, reden: 'de huidige meter bewijst de opgegeven eindstand niet' };
  } else {
    const naarNotitie = zoek(a.bronNaar);
    const naarOvergang = overgang(naarNotitie, n.sleutel);
    if (!naarOvergang || naarOvergang.van !== a.naar)
      return { aanwezig: true, geldig: false, reden: 'bronNaar bewijst de opgegeven eindstand niet' };
    if (String((naarNotitie && naarNotitie.datum) || '') > String(a.datum))
      return { aanwezig: true, geldig: false, reden: 'bronNaar ligt na de aflossingsdatum' };
  }
  const schuld = verslechtering(richting, n.van, n.naar);
  const betaald = verbetering(richting, a.van, a.naar);
  if (!(schuld > 0)) return { aanwezig: true, geldig: false, reden: '`van` -> `naar` is geen verslechtering in de richting van deze meter' };
  if (!(betaald >= schuld)) return { aanwezig: true, geldig: false,
    reden: 'de aflossing verbetert ' + betaald + ', maar de schuld is ' + schuld };
  return { aanwezig: true, geldig: true, schuld, betaald };
}

/* --------------------------------------------------------------- het inlezen */

function leesNorm(tekst, waar) {
  try { return JSON.parse(tekst); }
  catch (e) { throw new Error('NORM.json (' + waar + ') is onleesbaar: ' + e.message); }
}

/* Welke metersleutels noemt een notitie? Het veld is vrije tekst ("kernBreedte
   1394 -> 1395; kernGedeeld 187 -> 188") en dat blijft zo -- het is voor een
   lezer geschreven. We zoeken er de bekende sleutels in op. */
function genoemdeMeters(notitie, bekend) {
  const tekst = String(notitie.meter || '') + ' ' + String(notitie.sleutel || '');
  return [...bekend].filter(s => new RegExp('(^|[^a-zA-Z0-9])' + s + '($|[^a-zA-Z0-9])').test(tekst));
}

/* ------------------------------------------------------------------ de ronde */

function main() {
  const fouten = [];
  const meldingen = [];
  const normPad = path.join(WORTEL, 'NORM.json');

  console.log('\n' + K.vet + 'HET VERVAL' + K.reset + K.grijs + ' -- een verlaging van de lat heeft een reden en een einde' + K.reset + '\n');

  if (!fs.existsSync(normPad)) {
    console.error('  ' + K.rood + 'NORM.json ontbreekt; er is geen lat om te bewaken.' + K.reset + '\n');
    return 2;
  }
  const norm = leesNorm(fs.readFileSync(normPad, 'utf8'), 'werkmap');
  const richting = richtingen();
  const vanaf = (norm.vervalregel && norm.vervalregel.vanaf) || null;
  if (!vanaf) {
    console.error('  ' + K.rood + 'NORM.json heeft geen vervalregel.vanaf.' + K.reset);
    console.error('  Zonder begindatum weet dit script niet welke notities onder de eis vallen,');
    console.error('  en dan keurt hij of alles of niets -- allebei fout.\n');
    return 2;
  }
  console.log('  ' + K.grijs + 'de eis geldt voor notities vanaf ' + vanaf + '; vandaag is ' + VANDAAG + K.reset);

  /* ---------- 1. de vorm van de notities die onder de eis vallen ---------- */
  const notities = Array.isArray(norm.notities) ? norm.notities : [];
  const onderEis = notities.filter(n => n && String(n.datum || '') >= vanaf);
  console.log('  ' + K.grijs + notities.length + ' notitie(s), waarvan ' + onderEis.length + ' onder de eis' + K.reset + '\n');

  for (const n of onderEis) {
    const naam = (n.datum || '?') + ' "' + String(n.meter || '?').slice(0, 60) + '"';
    if (n.soort !== 'structureel' && n.soort !== 'schuld' && n.soort !== 'ontdekt') {
      fouten.push({ wat: naam, bericht: 'heeft geen soort ("structureel", "schuld" of "ontdekt")',
        hulp: 'structureel = het gemetene veranderde van vorm; schuld = we konden het even niet; ' +
          'ontdekt = de meter ziet nu bestaande schuld die hij eerst miste' });
      continue;
    }
    if (n.soort === 'structureel' && !String(n.waarheen || '').trim()) {
      fouten.push({ wat: naam, bericht: 'is structureel maar zegt niet WAARHEEN de belofte is gegaan',
        hulp: 'noem de toets, het bestand of de meter die nu draagt wat hier wegviel -- anders is het verlies en geen vormverandering' });
    }
    if (n.soort === 'schuld') {
      if (!n.sleutel || !richting.has(n.sleutel))
        fouten.push({ wat: naam, bericht: 'is een schuld zonder bekende meter in het veld "sleutel"',
          hulp: 'een schuld die niet zegt op welke meter hij staat, is niet te innen' });
      if (typeof n.van !== 'number')
        fouten.push({ wat: naam, bericht: 'is een schuld zonder "van" (de waarde van voor de verlaging)',
          hulp: 'zonder die waarde is niet vast te stellen wanneer de schuld is afbetaald' });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(n.vervalt || '')))
        fouten.push({ wat: naam, bericht: 'is een schuld zonder vervaldatum',
          hulp: 'een reden zonder einde is na een half jaar een tweede norm' });
      const aflossing = richting.has(n.sleutel) ? oordeelAflossing(n, richting.get(n.sleutel),
        { notities, nu: meterstand(norm, n.sleutel) }) : { aanwezig: false };
      if (aflossing.aanwezig && !aflossing.geldig)
        fouten.push({ wat: naam, bericht: 'beweert aflossing maar die is niet geldig: ' + aflossing.reden,
          hulp: 'leg de gemeten verbetering vast; een verklaring zonder voldoende getal betaalt geen schuld' });
    }
  }

  /* ---------- 1b. ONTDEKT: een betere meter, geen slechtere code (ZERO.md par. 3) ----------

     Een meter die meer gaat zien, laat zijn getal stijgen terwijl de code niet
     slechter werd. Wie dat tegenhoudt, maakt beter meten duur -- en dan wordt er
     niet beter gemeten. Wie het stil opneemt, laat de nieuw zichtbare schuld
     staan alsof ze er altijd mocht zijn. Daarom een eigen soort, en die is NIET
     losser dan `schuld`: hij vraagt WAT de meter beter maakte (een meetscript dat
     bestaat, zodat de bewering naar een instrument wijst en niet naar een gevoel),
     waar de nieuwe stand ligt, waar de afbouw naartoe gaat, en wanneer.

     Wat dit NIET vangt: of de stijging echt uit de meter komt en niet uit nieuwe
     code. Dat oordeel blijft bij een mens; deze vorm dwingt alleen dat het
     oordeel is opgeschreven met een instrument en een einddatum erbij. */
  for (const n of onderEis) {
    if (n.soort !== 'ontdekt') continue;
    const naam = (n.datum || '?') + ' "' + String(n.meter || '?').slice(0, 60) + '"';
    if (!n.sleutel || !richting.has(n.sleutel))
      fouten.push({ wat: naam, bericht: 'is ontdekte schuld zonder bekende meter in het veld "sleutel"' });
    for (const veld of ['van', 'naar', 'doel'])
      if (typeof n[veld] !== 'number')
        fouten.push({ wat: naam, bericht: 'is ontdekte schuld zonder getal in "' + veld + '"',
          hulp: 'van = de stand van de blinde meter, naar = wat hij nu ziet, doel = waar de afbouw eindigt' });
    const instrument = String(n.meterwijziging || '').match(/scripts\/[\w./-]+\.js/);
    if (!instrument)
      fouten.push({ wat: naam, bericht: 'zegt niet welk meetscript beter ging kijken (veld "meterwijziging")',
        hulp: 'noem het script, bijvoorbeeld scripts/stilspoor.js, en wat het nu ziet dat het eerst miste' });
    else if (!fs.existsSync(path.join(WORTEL, instrument[0])))
      fouten.push({ wat: naam, bericht: 'noemt ' + instrument[0] + ' als meter, en dat bestand bestaat niet' });
    if (!String(n.afbouw || '').trim())
      fouten.push({ wat: naam, bericht: 'is ontdekte schuld zonder afbouwplan (veld "afbouw")',
        hulp: 'ontdekken zonder plan is de schuld alsnog stil opnemen' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(n.vervalt || '')))
      fouten.push({ wat: naam, bericht: 'is ontdekte schuld zonder vervaldatum voor de afbouw' });
    else if (String(n.vervalt) < VANDAAG && richting.has(n.sleutel) && typeof n.doel === 'number') {
      const nu = meterstand(norm, n.sleutel);
      if (nu === undefined || slechter(richting.get(n.sleutel), nu, n.doel))
        fouten.push({ wat: n.sleutel, bericht: 'de afbouw van ontdekte schuld is verlopen op ' + n.vervalt +
          ': de meter staat op ' + nu + ' en hoort op ' + n.doel + ' te staan',
          hulp: 'bouw af, of neem een nieuw besluit met een nieuwe reden en een nieuwe datum' });
      else meldingen.push('ontdekte schuld op ' + n.sleutel + ' is afgebouwd (' + nu + ', doel ' + n.doel + '); de notitie mag weg');
    } else if (typeof n.doel === 'number') {
      meldingen.push('ontdekte schuld op ' + n.sleutel + ': afbouw naar ' + n.doel + ' tot ' + n.vervalt);
    }
  }

  /* ---------- 2. de schulden die over hun datum zijn ---------- */
  for (const n of onderEis) {
    if (n.soort !== 'schuld' || !n.vervalt || typeof n.van !== 'number' || !richting.has(n.sleutel)) continue;
    if (String(n.vervalt) >= VANDAAG) {
      meldingen.push('schuld op ' + n.sleutel + ' loopt tot ' + n.vervalt + ' (terug naar ' + n.van + ')');
      continue;
    }
    const nu = meterstand(norm, n.sleutel);
    if (nu === undefined) {
      fouten.push({ wat: n.sleutel, bericht: 'de schuld is verlopen op ' + n.vervalt + ' en de meter staat niet meer in NORM.json (niet onder meters en niet onder prestatie)' });
      continue;
    }
    if (slechter(richting.get(n.sleutel), nu, n.van)) {
      const aflossing = oordeelAflossing(n, richting.get(n.sleutel), { notities, nu });
      if (aflossing.geldig) {
        meldingen.push('schuld op ' + n.sleutel + ' is als tranche afbetaald (' + aflossing.betaald +
          ' verbetering voor ' + aflossing.schuld + ' schuld; ' + n.aflossingsbewijs.bewijs + ')');
        continue;
      }
      fouten.push({ wat: n.sleutel, bericht: 'de schuld is verlopen op ' + n.vervalt + ': de meter staat op ' + nu + ' en hoort terug naar ' + n.van,
        hulp: 'herstel hem, of neem opnieuw een besluit met een nieuwe reden en een nieuwe datum -- stil laten staan is de erosie die deze regel tegenhoudt' });
    } else {
      meldingen.push('schuld op ' + n.sleutel + ' is afbetaald (' + nu + ' tegenover ' + n.van + '); de notitie mag weg');
    }
  }

  /* ---------- 3. de uitzonderingen van de deltapoort ---------- */
  for (const u of Array.isArray(norm.uitzonderingen) ? norm.uitzonderingen : []) {
    const naam = 'uitzondering ' + (u.regel || '?') + ' op ' + (u.pad || '?');
    if (!u.regel || !u.pad || !String(u.reden || '').trim())
      fouten.push({ wat: naam, bericht: 'mist regel, pad of reden' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(u.vervalt || '')))
      fouten.push({ wat: naam, bericht: 'heeft geen vervaldatum',
        hulp: 'een uitzondering zonder einde is geen uitzondering maar een tweede norm' });
    else if (String(u.vervalt) < VANDAAG)
      fouten.push({ wat: naam, bericht: 'is verlopen op ' + u.vervalt,
        hulp: 'de deltapoort telt hem niet meer mee; haal hem weg of verantwoord hem opnieuw' });
    /* EEN UITZONDERING OP EEN BESTAND DAT ER NIET IS, BELOOFT DEKKING DIE ER
       NIET IS. Er stonden er twee (test/foundation-lesstroom.pg.test.js en
       test/gezinsdeur.pg.test.js) en geen enkele poort zag het: de deltapoort
       kijkt alleen naar bestanden in de wijziging, en een bestand dat niet
       bestaat zit daar nooit in. check.js regel 13 telt zulke spoken al in zijn
       eigen lijsten; dit is dezelfde controle voor deze lijst. */
    if (u.pad && !fs.existsSync(path.join(WORTEL, u.pad)))
      fouten.push({ wat: naam, bericht: 'het bestand bestaat niet',
        hulp: 'haal de uitzondering weg; hij dekt niets af en houdt zijn reden levend alsof hij ergens over gaat' });
  }

  /* ---------- 4. is de lat sinds de basis met de hand verlaagd? ---------- */
  const basis = bepaalBasis(WORTEL, arg('--basis', process.env.RTG_BASIS));
  if (basis.fout) {
    console.error('  ' + K.rood + 'GEEN BASIS: ' + basis.fout + K.reset);
    console.error('\n  De vorm van de notities is hierboven wel gekeurd, maar of er een lat is');
    console.error('  VERLAAGD is zonder vergelijkingspunt niet vast te stellen. Dat is niet');
    console.error('  "in orde" maar "niet gemeten" (LAT.md regel 3).\n');
    return 2;
  }
  const toenTekst = versieBij(WORTEL, basis.ref, 'NORM.json');
  if (toenTekst === null) {
    meldingen.push('NORM.json bestond bij de basis nog niet; er valt geen verlaging vast te stellen');
  } else {
    const toen = leesNorm(toenTekst, basis.ref.slice(0, 12));
    const paren = [['meters', norm.meters || {}, toen.meters || {}], ['prestatie', norm.prestatie || {}, toen.prestatie || {}]];
    const bekend = new Set(richting.keys());
    for (const [waar, nu, vroeger] of paren) {
      for (const [sleutel, waarde] of Object.entries(vroeger)) {
        if (!(sleutel in nu)) {
          fouten.push({ wat: sleutel, bericht: 'stond in ' + waar + ' van NORM.json en is weg',
            hulp: 'een meter weghalen is de stilste manier om een lat te verliezen; verantwoord hem als notitie' });
          continue;
        }
        if (!richting.has(sleutel)) {
          fouten.push({ wat: sleutel, bericht: 'staat in NORM.json maar heeft nergens een richting',
            hulp: 'zet RICHTING naast de METER-constante in het script dat hem meet, of zet hem in de METERS-lijst van norm.js' });
          continue;
        }
        if (!slechter(richting.get(sleutel), nu[sleutel], waarde)) continue;
        const gedekt = onderEis.some(n => genoemdeMeters(n, bekend).includes(sleutel));
        if (gedekt) { meldingen.push('lat op ' + sleutel + ' verzet van ' + waarde + ' naar ' + nu[sleutel] + ', met notitie'); continue; }
        fouten.push({ wat: sleutel, bericht: 'de lat is met de hand verlaagd van ' + waarde + ' naar ' + nu[sleutel] + ' zonder notitie',
          hulp: 'zet er een notitie bij met datum, meter, reden en soort ("structureel" met waarheen, "schuld" met sleutel, van en vervalt, ' +
            'of "ontdekt" met sleutel, van, naar, doel, meterwijziging, afbouw en vervalt)' });
      }
    }
  }

  /* ------------------------------------------------------------- de uitslag */
  for (const m of meldingen) console.log('  ' + K.grijs + '- ' + m + K.reset);
  if (meldingen.length) console.log('');

  if (!fouten.length) {
    console.log('  ' + K.groen + 'Geen verlaging zonder reden, en geen reden zonder einde.' + K.reset + '\n');
    return 0;
  }
  console.log('  ' + K.rood + K.vet + 'HET VERVAL IS NIET IN ORDE.' + K.reset + '\n');
  for (const f of fouten) {
    console.log('    ' + K.rood + '✗' + K.reset + ' ' + f.wat);
    console.log('      ' + f.bericht);
    if (f.hulp) console.log('      ' + K.grijs + f.hulp + K.reset);
  }
  console.log('');
  return 1;
}

if (require.main === module) {
  try { process.exit(main()); }
  catch (e) { console.error('\n  ' + K.rood + String(e.message || e) + K.reset + '\n'); process.exit(2); }
}
module.exports = { richtingen, genoemdeMeters, slechter, meterstand, overgang, oordeelAflossing };
