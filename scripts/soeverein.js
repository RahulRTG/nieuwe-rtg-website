#!/usr/bin/env node
'use strict';
/* ============================================================================
   KAN EEN BUITENLANDSE CEL SOEVEREIN ZIJN? -- gemeten, niet ontworpen.

   WAAROM DIT SCRIPT BESTAAT. Het voorstel voor een Sovereign Operating Network
   rust op EEN dragende bewering: *een medewerker in Ibiza kan technisch niet
   eens VRAGEN om Nederlandse ledengegevens, want voor zijn identiteit bestaat
   die datawereld niet.* Dat is geen toegangsregel maar een isolatie-eigenschap,
   en dit huis heeft daar al machinerie voor (kern/isolatie/). De vraag is dus
   niet "hoe bouwen we dat" maar "hoe ver reikt wat er staat, en waar precies
   houdt het op".

   Die vraag met de hand beantwoorden is hier al een keer misgegaan: de
   isolatiemeter zelf las `bron` als `sleutelbron` en meldde "5 van 6 dragers
   met een bron", terwijl er bij een echt verzoek maar EEN drager een sleutel
   had (zie de kop van kern/isolatie/dragers.js). Een ladder die op papier zes
   sporten heeft en er in een verzoek een draagt, is precies de fout die een
   soevereiniteitsbelofte onzichtbaar hol maakt.

   WAT HIJ MEET, in drie delen die nooit worden opgeteld:

     1 DE DRAGERLADDER. Welke dragers bestaan, welke dragen bij een lopend
       verzoek werkelijk een sleutel, en welke sporten die het voorstel noemt
       (land, locatie) bestaan niet.
     2 HET BEREIK. Welke toegangswegen zetten `req.session`, want dat is wat
       kern/isolatie/sessiedragers.js leest. Een weg die hem niet zet, weegt
       GEEN ENKELE drager mee -- ook niet `huis`.
     3 DE NAAMRUIMTE. Voor elk begrip dat het voorstel introduceert: is de naam
       al bezet, waar, en met welke betekenis. Dit huis heeft 105 namen met meer
       dan een betekenis (SEMANTIEK.json); een laag die twintig nieuwe woorden
       meebrengt zonder te kijken, maakt er twintig bij.

   WAT HIJ NIET DOET. Oordelen of een land soeverein MOET kunnen draaien, en
   niet overdoen wat ISOLATIEPROEF.json al meet (welke effecten per stand
   bereikbaar blijven). Twee meters over hetzelfde zeggen op een dag iets
   anders; deze meet de DRAGERS en de WEGEN, die meet de EFFECTEN.

   Draaien:  npm run soeverein            (print)
             npm run soeverein:vast       (schrijft SOEVEREIN.json)
   ============================================================================ */
const fs = require('fs');
const path = require('path');
const { stempel } = require('./lib/stempel');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'SOEVEREIN.json');

const { DRAGERS } = require(path.join(WORTEL, 'server/kern/isolatie/dragers'));

/* De sporten die het voorstel aan de ladder wil toevoegen. Ze staan hier als
   VRAAG en niet als plan: het script zegt of ze bestaan, niet of ze moeten. */
const VOORGESTELDE_SPORTEN = [
  { naam: 'land', wat: 'een country realm: alles binnen een rechtsgebied',
    waarom: 'Zonder deze sport is "Nederlandse gegevens" geen afdwingbare verzameling maar een woord.' },
  { naam: 'locatie', wat: 'een location realm: een vestiging',
    waarom: 'Het voorstel begrenst capabilities op vestigingsniveau (scope: ES-IBIZA-004).' }
];

/* De begrippen die het voorstel introduceert. Per begrip het woord waarop
   geteld wordt; een woord dat nergens staat is vrij, een woord dat ergens staat
   draagt daar al een betekenis. */
const BEGRIPPEN = [
  { begrip: 'sovereign', woord: /\bsovereign\b/i },
  { begrip: 'realm', woord: /\brealm\b/i },
  { begrip: 'cel', woord: /\bcel\b/ },
  { begrip: 'territorium', woord: /\bterritorium\b/i },
  { begrip: 'twin', woord: /\btwin\b/i },
  { begrip: 'tweeling', woord: /\btweeling\b/i },
  { begrip: 'policy', woord: /\bpolicy\b/i },
  { begrip: 'capability', woord: /\bcapabilit(y|ies)\b/i },
  { begrip: 'mandaat', woord: /\bmandaat\b/i },
  { begrip: 'ledger', woord: /\bledger\b/i },
  { begrip: 'canary', woord: /\bcanary\b/i },
  { begrip: 'schaduw', woord: /\bschaduw/i },
  { begrip: 'blastradius', woord: /\bblast.?radius\b/i },
  { begrip: 'readiness', woord: /\breadiness\b/i },
  { begrip: 'soeverein', woord: /\bsoeverein/i }
];

/* De bouwstenen die het voorstel noemt, elk met het bestand dat hem zou
   dragen. Bestaat het bestand, dan is de steen er -- dat zegt NIET dat hij doet
   wat het voorstel wil, en die nuance staat in de uitslag. */
const BOUWSTENEN = [
  { steen: 'isolatie per drager', pad: 'server/kern/isolatie/dragers.js' },
  { steen: 'de join (strengste wint)', pad: 'server/kern/isolatie/ordening.js' },
  { steen: 'schaduwdraaien', pad: 'server/kern/commercie/schaduw.js' },
  { steen: 'digitale tweeling (huis)', pad: 'server/kern/command/simulatie.js' },
  { steen: 'gebeurtenisenvelop met oorzaakketen', pad: 'server/kern/envelop.js' },
  { steen: 'mandaat dat alleen versmalt', pad: 'server/kern/stuur/mandaat.js' },
  { steen: 'AI-beleid gesloten by default', pad: 'server/kern/stuur/beleid.js' },
  { steen: 'economische firewall', pad: 'server/kern/economie/firewall.js' },
  { steen: 'tijdgebonden regels (loon)', pad: 'server/kern/payroll/regelpakket.js' },
  { steen: 'tijdgebonden regels (fiscaal)', pad: 'server/kern/fiscaal/jaargangen.js' },
  { steen: 'valuta met eigen precisie', pad: 'server/kern/payroll/valuta.js' },
  { steen: 'verifieerbare claims', pad: 'server/kern/rtgid-claims.js' },
  { steen: 'passkeys', pad: 'server/webauthn/index.js' },
  { steen: 'getekende release', pad: 'scripts/release-bewijs.js' },
  { steen: 'herkomst van het image', pad: 'scripts/imageherkomst.js' },
  { steen: 'landdekking', pad: 'scripts/landdekking.js' },
  { steen: 'dubbel boekhouden', pad: 'server/pg/economische-boeking.js' },
  { steen: 'blast radius per verzoek', pad: 'server/opzet/handeling.js' },
  { steen: 'rijen voor en na per collectie', pad: 'server/opzet/verzoekketen.js' }
];

/* De poorten: waar een verzoek zijn identiteit krijgt. `req.session` is wat
   kern/isolatie/sessiedragers.js leest; wie hem niet zet, weegt geen enkele
   drager mee. Gemeten op de toekenning en niet op het woord, want een poort die
   `req.session` alleen LEEST zet hem niet. */
const POORTEN = [
  { poort: 'ledenpoort', pad: 'server/opzet/diensten2.js' },
  { poort: 'leverancierpoort', pad: 'server/opzet/leverancierpoort.js' },
  { poort: 'kantoorpoort', pad: 'server/kern/kantoor/kluispoort.js' }
];

function lees(rel) {
  try { return fs.readFileSync(path.join(WORTEL, rel), 'utf8'); } catch (_) { return null; }
}

function bronBestanden() {
  const uit = [];
  (function loop(dir) {
    let rij = [];
    try { rij = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
    for (const d of rij) {
      const vol = path.join(dir, d.name);
      if (d.isDirectory()) { if (d.name !== 'node_modules' && d.name !== 'data') loop(vol); }
      else if (d.name.endsWith('.js')) uit.push(vol);
    }
  })(path.join(WORTEL, 'server'));
  return uit.map(f => ({ pad: path.relative(WORTEL, f), tekst: fs.readFileSync(f, 'utf8') }));
}

function meet() {
  const bestanden = bronBestanden();

  /* ---------- 1. de dragerladder ---------- */
  const ladder = DRAGERS.map(d => ({
    naam: d.naam,
    wat: d.wat,
    heeftStandOpslag: !!d.bron,
    draagtSleutelBijVerzoek: !!d.sleutelbron,
    waaromGeenSleutel: d.sleutelbron ? null : (d.geenSleutel || null)
  }));
  const metSleutel = ladder.filter(d => d.draagtSleutelBijVerzoek);

  const ontbrekendeSporten = VOORGESTELDE_SPORTEN.map(s => ({
    naam: s.naam, wat: s.wat, waarom: s.waarom,
    bestaat: DRAGERS.some(d => d.naam === s.naam)
  }));

  /* ---------- 2. het bereik: wie zet req.session ---------- */
  const poorten = POORTEN.map(p => {
    const t = lees(p.pad);
    if (t == null) return { poort: p.poort, pad: p.pad, bestaat: false, zetSessie: null,
      let: 'bestand niet gevonden -- de meter weet hier niets, en dat is geen nee' };
    const zet = /req\.session\s*=/.test(t);
    return {
      poort: p.poort, pad: p.pad, bestaat: true, zetSessie: zet,
      isolatieWeegtMee: zet,
      let: zet ? null : 'deze weg zet req.session niet, dus kern/isolatie/sessiedragers.js krijgt ' +
        'niets -- er weegt GEEN ENKELE drager mee, ook `huis` niet'
    };
  });
  const poortenZonderIsolatie = poorten.filter(p => p.bestaat && !p.zetSessie).map(p => p.poort);

  /* ---------- 3. de naamruimte ---------- */
  const namen = BEGRIPPEN.map(b => {
    const raak = bestanden.filter(f => b.woord.test(f.tekst));
    return {
      begrip: b.begrip,
      bestanden: raak.length,
      vrij: raak.length === 0,
      voorbeelden: raak.slice(0, 4).map(f => f.pad)
    };
  }).sort((a, b) => b.bestanden - a.bestanden);

  /* ---------- 4. de bouwstenen ----------
     LET OP WAT DIT WEL EN NIET ZEGT. Gemeten wordt of het BESTAND er is. Dat een
     steen bestaat, zegt niet dat hij doet wat het voorstel van hem vraagt: de
     digitale tweeling bestaat en gaat over het HUIS, niet over een onderneming;
     schaduwdraaien bestaat en draait op beleidsregels, niet op een
     settlement-engine. Daarom draagt elke steen `dektVoorstel: 'onbepaald'` met
     de reden -- een dekkingsoordeel is hier statisch niet af te leiden, en een
     stilzwijgend `ja` zou van deze meter een geruststelling maken. */
  const stenen = BOUWSTENEN.map(s => ({
    steen: s.steen, pad: s.pad, bestaat: lees(s.pad) != null,
    dektVoorstel: 'onbepaald',
    waarom: 'gemeten is het bestaan van het bestand; of deze steen doet wat het voorstel vraagt ' +
      'is per steen een leesvraag en geen telling'
  }));
  const aanwezig = stenen.filter(s => s.bestaat).length;

  return {
    stempel: stempel(),
    graad: 'gemeten',
    grens: 'De vier delen mogen nooit tot een soevereiniteitscijfer worden opgeteld. Het BEREIK is lexicaal herkend en dus een ONDERgrens op \'weegt niet mee\': een poort die req.session via een helper zet, wordt gemist. De NAAMRUIMTE is een woordtelling, dus een begrip onder een andere naam wordt gemist. En dat een BOUWSTEEN bestaat zegt niet dat hij doet wat het voorstel vraagt -- elke steen draagt daarom dektVoorstel: onbepaald.',
    hoe: 'De ladder komt uit kern/isolatie/dragers.js, het bereik uit de toekenning van req.session ' +
      'in de poortbestanden, de naamruimte uit een woordtelling over alle .js in server/, en de ' +
      'bouwstenen uit het bestaan van hun bestand. Geen van vieren uit een lijst in dit script.',
    graadPerDeel: {
      ladder: 'gemeten -- gelezen uit de gegevensstructuur zelf, niet uit tekst',
      bereik: 'vermoed -- de toekenning wordt LEXICAAL herkend (/req\\.session\\s*=/). Een poort die ' +
        'hem via een helper zet, wordt gemist, en een poort die hem in commentaar noemt telt ten ' +
        'onrechte mee. Dit is dus een ONDERgrens op "weegt niet mee" en geen bewijs van het ' +
        'tegendeel; de e2e-weg om het hard te maken is een verzoek met een zaaksessie door ' +
        'kern/isolatie/sessiedragers.js halen en tellen wat eruit komt.',
      naamruimte: 'vermoed -- woordtelling, dus een begrip onder een andere naam wordt gemist',
      bouwstenen: 'gemeten voor BESTAAN, onbepaald voor DEKKING (zie per steen)'
    },
    geenSamengesteldCijfer: 'De vier delen worden NOOIT opgeteld tot een soevereiniteitscijfer. ' +
      'Een ladder met een gat, een weg zonder isolatie en een bezette naam zijn drie verschillende ' +
      'soorten probleem, en een gemiddelde ervan stuurt niemand ergens heen (INT-04).',
    ladder: {
      dragers: ladder,
      telling: { dragers: ladder.length, metSleutelBijVerzoek: metSleutel.length },
      ontbrekendeSporten
    },
    bereik: {
      poorten,
      poortenZonderIsolatie,
      let: poortenZonderIsolatie.length
        ? 'Een buitenlandse exploitant is een ZAAK. Draagt de zaakweg geen drager, dan is de ' +
          'soevereiniteitsbelofte voor precies de partij die hem nodig heeft vandaag niet ' +
          'afdwingbaar door deze laag.'
        : null
    },
    naamruimte: { begrippen: namen, vrij: namen.filter(n => n.vrij).map(n => n.begrip) },
    bouwstenen: { stenen, telling: { genoemd: stenen.length, aanwezig, ontbreekt: stenen.length - aanwezig } }
  };
}

function druk(u) {
  console.log('soeverein: ' + u.ladder.telling.dragers + ' dragers, waarvan ' +
    u.ladder.telling.metSleutelBijVerzoek + ' met een sleutel bij een lopend verzoek');
  console.log('\n  DE LADDER');
  for (const d of u.ladder.dragers) {
    console.log('    ' + d.naam.padEnd(13) + (d.draagtSleutelBijVerzoek ? 'sleutel' : 'GEEN SLEUTEL') +
      '   ' + d.wat);
  }
  console.log('\n  SPORTEN DIE HET VOORSTEL NOEMT');
  for (const s of u.ladder.ontbrekendeSporten) {
    console.log('    ' + s.naam.padEnd(13) + (s.bestaat ? 'bestaat' : 'BESTAAT NIET') + '   ' + s.wat);
  }
  console.log('\n  BEREIK -- wie zet req.session (en weegt dus mee)');
  for (const p of u.bereik.poorten) {
    console.log('    ' + p.poort.padEnd(18) + (!p.bestaat ? 'onbekend' : p.zetSessie ? 'weegt mee' : 'WEEGT NIET MEE'));
  }
  console.log('\n  NAAMRUIMTE');
  for (const n of u.naamruimte.begrippen) {
    console.log('    ' + n.begrip.padEnd(13) + String(n.bestanden).padStart(4) + ' bestanden' +
      (n.vrij ? '   VRIJ' : ''));
  }
  console.log('\n  BOUWSTENEN: ' + u.bouwstenen.telling.aanwezig + ' van ' +
    u.bouwstenen.telling.genoemd + ' BESTAAN al');
  console.log('    (bestaan is niet dekken: elke steen draagt dektVoorstel=onbepaald met de reden)');
  for (const s of u.bouwstenen.stenen) if (!s.bestaat) console.log('    ONTBREEKT: ' + s.steen + ' (' + s.pad + ')');
}

module.exports = { meet, DOEL, BEGRIPPEN, BOUWSTENEN, VOORGESTELDE_SPORTEN, POORTEN };

if (require.main === module) {
  const u = meet();
  /* GEEN process.exit() NA EEN GROTE console.log: naar een BESTAND schrijft node
     synchroon en gaat het goed, naar een PIPE wordt de uitvoer afgekapt --
     geldige tekst, kapotte JSON, exitcode 0. Dat is keuringsregel `pipe` in
     scripts/meetkeuring.js, en hij kostte dit huis ooit twee derde van een
     uitslag zonder enig signaal. process.exitCode laat de pipe leeglopen. */
  if (process.argv.includes('--json')) { console.log(JSON.stringify(u, null, 2)); process.exitCode = 0; return; }
  druk(u);
  if (process.argv.includes('--vastleggen')) {
    fs.writeFileSync(DOEL, JSON.stringify(u, null, 2) + '\n');
    console.log('\ngeschreven: SOEVEREIN.json');
  }
}
