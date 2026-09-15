#!/usr/bin/env node
'use strict';
/* ============================================================================
   KAN RTG ZIJN EIGEN DOORBELASTING METEN? -- de vraag onder de bijdragebasis.

   WAAROM DIT SCRIPT BESTAAT, EN WAAROM HET VOOR DE VERGOEDING KOMT. Een
   franchisevergoeding over een BIJDRAGEBASIS (bruto min rechtstreeks
   doorbelaste derden) is alleen een eerlijk getal als die basis een
   REPRODUCEERBARE functie van bronregels is. Anders is het een commercieel
   bedacht getal met een formule eromheen, en is de eerste onenigheid met een
   exploitant meteen principieel.

   Dus eerst meten of de werkelijkheid te meten IS. Deze meter zet geen enkele
   economische waarheid in de code; hij stelt vast wat er vandaag aantoonbaar
   te classificeren valt.

   TWEE HELFTEN, EN ZE WORDEN NOOIT OPGETELD.

     A. DE VORM.   Over alle objectvormen in server/: welke dragen een BEDRAG,
                   en hoeveel daarvan dragen ook een aantoonbare HERKOMST?
                   Dit is de structurele vraag -- kan herkomst uberhaupt tot de
                   euro gevolgd worden? Gelezen met de lezer van
                   scripts/objectmodel.js, zodat het getal naast OBJECTMODEL.json
                   en STAGEVORM.json te leggen is; een tweede parser zou die
                   vergelijking waardeloos maken.
     B. DE EURO'S. Over de werkelijke opslag: elk bedrag ingedeeld in zes
                   klassen. Dit is de feitelijke vraag. Is er geen financiele
                   data, dan is de NOEMER nul en staat dat er -- een meter die
                   bij een lege noemer "100% geclassificeerd" meldt, liegt.

   DE ZES KLASSEN, en de zesde is de belangrijkste:

     rtgEigen        waarde die RTG zelf levert
     derdePartij     rechtstreeks doorbelast aan een hotel, vervoerder, leverancier
     belasting       btw en andere heffingen
     fee             kosten van een betaalprovider of tussenpersoon
     kortingRefund   korting, creditering, terugbetaling
     onbekend        niet aantoonbaar in te delen

   `onbekend` IS EEN ECHTE UITKOMST EN NOOIT EEN AANNAME. Dat is de regel waar
   deze hele meter op staat. Wie een bedrag zonder bewijs op `derdePartij` zet,
   verlaagt de bijdragebasis en dus de vergoeding; wie hem op `rtgEigen` zet,
   verhoogt hem. Beide kanten zijn een fout in het voordeel van iemand, en
   allebei onzichtbaar. Van honderdduizend euro waarvan zeventienduizend niet te
   volgen is, meldt deze meter zeventienduizend `onbekend` -- geen percentage
   van het restant, geen "waarschijnlijk derden".

   WAT DIT SCRIPT MET OPZET NIET DOET: een bijdragebasis BEREKENEN. Dat is stap
   3 en hij komt pas als deze meter laat zien dat de invoer er is. Een basis
   uitrekenen over een noemer die grotendeels `onbekend` is, levert een getal op
   dat er precies zo uitziet als een getal dat klopt.

   Draaien:  npm run doorbelasting            (print)
             npm run doorbelasting:vast       (schrijft DOORBELASTING.json)
   ============================================================================ */
const fs = require('fs');
const path = require('path');
const om = require('./objectmodel.js');
const { stempel } = require('./lib/stempel');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'DOORBELASTING.json');

/* ---------- de woordenlijsten, en waarom ze smal zijn ----------
   Een brede lijst vindt overal iets en meet dan zichzelf. Deze twee zijn met
   opzet krap: een veld telt alleen als het ZONDER context een bedrag of een
   herkomst aanduidt. `btw` staat bij de bedragen omdat een btw-veld altijd een
   geldbedrag is; `soort` en `type` staan NIET bij de herkomsten, want die
   dragen in dit huis tientallen betekenissen (SEMANTIEK.json). */
const BEDRAG = /^(centen|bedrag|prijs|stuk|totaal|subtotaal|bruto|netto|saldo|amount|btwBedrag|btwCenten|[a-z]+Centen)$/;
const HERKOMST = /^(herkomst|bron|leverancier|supplier|partner|provider|aanbieder)$/;

const KLASSEN = ['rtgEigen', 'derdePartij', 'belasting', 'fee', 'kortingRefund', 'onbekend'];

/* ---------- de indeler ----------
   Een PURE functie van de rij: dezelfde invoer geeft altijd dezelfde klasse.
   Dat is de voorwaarde onder stap 3 (de bijdragebasis als reproduceerbare
   functie), en daarom staat hij hier los en niet verweven met het lopen door
   de opslag. Elke tak geeft een REDEN terug, want een indeling zonder reden is
   bij een geschil niets waard. */
function deelIn(rij) {
  if (!rij || typeof rij !== 'object') return { klasse: 'onbekend', reden: 'geen object' };

  const veld = (re) => Object.keys(rij).find(k => re.test(k));
  const bedragVeld = veld(BEDRAG);
  if (!bedragVeld) return { klasse: 'onbekend', reden: 'geen bedrag op deze rij' };

  const waarde = Number(rij[bedragVeld]);
  if (!Number.isFinite(waarde)) return { klasse: 'onbekend', reden: 'bedrag is geen getal' };

  /* Een negatief bedrag is een correctie. Dat is de enige tak die op de WAARDE
     beslist en niet op een veld, en hij is veilig: een teruggave is nooit
     geleverde waarde, van wie de levering ook kwam. */
  if (waarde < 0) return { klasse: 'kortingRefund', reden: 'negatief bedrag', bedrag: waarde };

  /* Belasting: alleen als het VELD zelf de heffing noemt. Een rij met een
     btw-PERCENTAGE ernaast is geen belastingrij -- dan is de belasting een
     eigenschap van een verkoop en geen eigen post. */
  if (/^btw/i.test(bedragVeld) || /belastingCenten|heffingCenten/.test(bedragVeld)) {
    return { klasse: 'belasting', reden: 'het bedragveld noemt de heffing zelf: ' + bedragVeld, bedrag: waarde };
  }

  const hVeld = veld(HERKOMST);
  if (!hVeld) {
    return { klasse: 'onbekend', bedrag: waarde,
      reden: 'wel een bedrag (' + bedragVeld + '), geen herkomstveld -- niet te volgen' };
  }

  const h = String(rij[hVeld] || '').toLowerCase();
  if (!h) {
    return { klasse: 'onbekend', bedrag: waarde,
      reden: 'herkomstveld ' + hVeld + ' bestaat maar is leeg' };
  }
  if (h === 'rtg' || h === 'eigen') return { klasse: 'rtgEigen', reden: hVeld + '=' + h, bedrag: waarde };
  if (h === 'partner' || h === 'leverancier' || h === 'extern' || h === 'derde') {
    return { klasse: 'derdePartij', reden: hVeld + '=' + h, bedrag: waarde };
  }
  if (h === 'provider' || h === 'psp' || h === 'stripe') {
    return { klasse: 'fee', reden: hVeld + '=' + h, bedrag: waarde };
  }
  /* EEN HERKOMST DIE WE NIET KENNEN IS ONBEKEND EN GEEN DERDE. `handmatig` is
     de vaakst voorkomende waarde in dit huis, en die zegt wie het INVOERDE en
     niet wie het LEVERDE. Hem op derden zetten zou de bijdragebasis stil
     verlagen. */
  return { klasse: 'onbekend', bedrag: waarde,
    reden: 'herkomst "' + h + '" zegt niet wie de waarde leverde' };
}

/* ---------- A. de vorm ---------- */
function vorm() {
  const g = om.lees();
  const geldvormen = [];
  for (const v of g.vormen) {
    const bedragVelden = v.velden.filter(x => BEDRAG.test(x));
    if (!bedragVelden.length) continue;
    const herkomstVelden = v.velden.filter(x => HERKOMST.test(x));
    geldvormen.push({
      module: v.module, bedragVelden, herkomstVelden,
      volgbaar: herkomstVelden.length > 0
    });
  }
  const volgbaar = geldvormen.filter(v => v.volgbaar);
  const perModule = {};
  for (const v of geldvormen) {
    const m = v.module.split('/').slice(0, 3).join('/');
    perModule[m] = perModule[m] || { geldvormen: 0, volgbaar: 0 };
    perModule[m].geldvormen++;
    if (v.volgbaar) perModule[m].volgbaar++;
  }
  return {
    vormenTotaal: g.vormen.length,
    geldvormen: geldvormen.length,
    volgbaar: volgbaar.length,
    nietVolgbaar: geldvormen.length - volgbaar.length,
    volgbareModules: volgbaar.map(v => v.module).sort(),
    perModule,
    grens: 'Dit telt of een VORM een bedrag en een herkomst naast elkaar draagt. Het zegt niet ' +
      'dat die herkomst juist is ingevuld, en het volgt geen verwijzing: een rij die via een id ' +
      'naar een andere rij met een herkomst wijst, telt hier als NIET volgbaar. Dat is een ' +
      'ondergrens en met opzet -- een keten die je niet in een rij ziet, kun je bij een geschil ' +
      'ook niet in een rij tonen.'
  };
}

/* ---------- B1. de norm: de gezaaide wereld ---------- */
function norm() {
  const { wereld, VERWACHT } = require('./lib/economiewereld.js');
  const { volgbaar, waaromNietVolgbaar } = require(
    path.join(WORTEL, 'server/kern/waarde/economischeherkomst.js'));
  const { naarEigenaar } = require(path.join(WORTEL, 'server/kern/waarde/herkomstsplitsing.js'));

  const rijen = wereld();
  const nietVolgbaar = rijen.filter(r => !volgbaar(r));
  const s = naarEigenaar(rijen);

  return {
    rijen: rijen.length,
    volgbaar: rijen.length - nietVolgbaar.length,
    nietVolgbaar: nietVolgbaar.length,
    /* Elke niet-volgbare rij draagt zijn REDEN mee naar buiten. Een telling
       zonder redenen leest als een restpost; met redenen is het een werklijst. */
    gaten: nietVolgbaar.map(r => ({
      bedragCenten: r.bedragCenten, valuta: r.valuta,
      grond: r.grond, waarom: waaromNietVolgbaar(r)
    })),
    splitsing: s,
    verwacht: VERWACHT,
    klopt: rijen.length === VERWACHT.rijen && nietVolgbaar.length === VERWACHT.nietVolgbaar,
    grens: 'Dit is de NORM en geen waarneming: deze wereld is verzonnen en deterministisch. ' +
      'Hij bewijst dat de machine niet gaat raden, en zegt NIETS over wat RTG werkelijk verdient. ' +
      'Dat staat in B2, en die twee worden nooit opgeteld.'
  };
}

/* ---------- B2. de werkelijkheid ---------- */
function euros() {
  const bron = path.join(WORTEL, 'server/data/store.db');
  if (!fs.existsSync(bron)) {
    return { noemerCenten: 0, rijen: 0, perKlasse: null,
      waaromGeen: 'er is geen server/data/store.db -- deze meter verzint geen bedragen' };
  }
  let kv;
  try {
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(bron, { readOnly: true });
    kv = db.prepare('select key, val from kv').all();
    db.close();
  } catch (e) {
    return { noemerCenten: 0, rijen: 0, perKlasse: null,
      waaromGeen: 'de opslag was niet te lezen: ' + e.message };
  }

  const perKlasse = {};
  for (const k of KLASSEN) perKlasse[k] = { rijen: 0, centen: 0 };
  const redenen = {};
  let rijen = 0;

  const loop = (waarde, collectie) => {
    if (Array.isArray(waarde)) { for (const r of waarde) loop(r, collectie); return; }
    if (!waarde || typeof waarde !== 'object') return;
    const u = deelIn(waarde);
    if (u.bedrag != null) {
      rijen++;
      perKlasse[u.klasse].rijen++;
      perKlasse[u.klasse].centen += u.bedrag;
      const sleutel = u.klasse + ': ' + u.reden;
      redenen[sleutel] = (redenen[sleutel] || 0) + 1;
    }
    for (const v of Object.values(waarde)) if (v && typeof v === 'object') loop(v, collectie);
  };

  for (const rij of kv) {
    let v;
    try { v = JSON.parse(rij.val); } catch (_) { continue; }
    loop(v, rij.key);
  }

  const noemer = KLASSEN.reduce((a, k) => a + perKlasse[k].centen, 0);
  return {
    noemerCenten: noemer, rijen, perKlasse,
    redenen: Object.entries(redenen).sort((a, b) => b[1] - a[1]).slice(0, 12)
      .map(([reden, n]) => ({ reden, rijen: n })),
    waaromGeen: rijen === 0
      ? 'de opslag draagt geen enkele rij met een bedrag. server/seed/index.js zet `invoices: []` ' +
        'met opzet, dus dit is geen storing maar een lege noemer -- en een lege noemer is geen 100%.'
      : null
  };
}

function meet() {
  const a = vorm();
  const b = euros();
  return {
    stempel: stempel(),
    graad: 'gemeten',
    wat: 'of de doorbelasting van RTG aantoonbaar te classificeren is: per vorm en per euro',
    hoe: 'npm run doorbelasting -- deel A leest de vormen met de lezer van scripts/objectmodel.js, ' +
      'deel B leest server/data/store.db en deelt elk bedrag in met dezelfde pure functie',
    grens: 'De twee helften worden NOOIT opgeteld: een vorm die een herkomst KAN dragen zegt niets ' +
      'over of hij hem DRAAGT, en een euro die is ingedeeld zegt niets over de vormen eromheen. ' +
      'Deel A volgt geen verwijzingen en is daarom een ONDERgrens. Deel B verzint geen bedragen: ' +
      'is de opslag leeg, dan is de noemer nul en niet 100%. En deze meter BEREKENT GEEN ' +
      'BIJDRAGEBASIS -- dat is de volgende stap, en hij mag pas als het aandeel `onbekend` klein ' +
      'genoeg is dat een mens het kan verantwoorden.',
    klassen: KLASSEN,
    regel: 'onbekend is een uitkomst en nooit een aanname: een bedrag zonder aantoonbare herkomst ' +
      'wordt niet naar rtgEigen of derdePartij geduwd, want beide fouten zijn onzichtbaar en ' +
      'komen allebei iemand goed uit',
    vorm: a,
    norm: norm(),
    euros: b
  };
}

function druk(u) {
  const a = u.vorm, b = u.euros;
  console.log('doorbelasting: ' + a.geldvormen + ' geldvormen van ' + a.vormenTotaal + ' vormen');
  console.log('\n  A. DE VORM -- draagt een rij met een bedrag ook een herkomst?');
  console.log('    geldvormen            ' + String(a.geldvormen).padStart(5));
  console.log('    met herkomst ernaast  ' + String(a.volgbaar).padStart(5) +
    '   (' + (100 * a.volgbaar / (a.geldvormen || 1)).toFixed(1) + '%)');
  console.log('    NIET te volgen        ' + String(a.nietVolgbaar).padStart(5));
  if (a.volgbareModules.length) {
    console.log('\n    de vormen die het WEL kunnen:');
    for (const m of a.volgbareModules.slice(0, 12)) console.log('      ' + m);
  }
  const n = u.norm;
  console.log('\n  B1. DE NORM -- de gezaaide wereld (deterministisch, in de keuring)');
  console.log('    rijen            ' + String(n.rijen).padStart(5) +
    (n.klopt ? '' : '   WERELD WIJKT AF VAN WAT ZIJ ZELF VERKLAART'));
  console.log('    volgbaar         ' + String(n.volgbaar).padStart(5));
  console.log('    NIET volgbaar    ' + String(n.nietVolgbaar).padStart(5) + '   (met opzet -- ziet de meter het gat?)');
  for (const g of n.gaten) {
    console.log('      ' + String((g.bedragCenten / 100).toFixed(2)).padStart(10) + ' ' + (g.valuta || '???') +
      '  ' + String(g.grond || '').slice(0, 58));
  }
  const pe = n.splitsing.perEigenaar;
  console.log('    splitsing (centen, NIET opgeteld over valuta):');
  for (const [k, v] of Object.entries(pe)) console.log('      ' + k.padEnd(12) + String(v).padStart(10));
  if (n.splitsing.waaromGeenTotaal) console.log('    geen totaal: ' + n.splitsing.waaromGeenTotaal);

  console.log('\n  B2. DE WERKELIJKHEID -- elk bedrag in de echte opslag');
  if (b.waaromGeen) {
    console.log('    NOEMER NUL. ' + b.waaromGeen);
  } else {
    for (const k of u.klassen) {
      const r = b.perKlasse[k];
      console.log('    ' + k.padEnd(15) + String(r.rijen).padStart(6) + ' rijen   ' +
        (r.centen / 100).toFixed(2).padStart(14) + '   ' +
        (100 * r.centen / (b.noemerCenten || 1)).toFixed(1) + '%');
    }
  }
  if (b.redenen && b.redenen.length) {
    console.log('\n    waarom een rij zo is ingedeeld (top):');
    for (const r of b.redenen) console.log('      ' + String(r.rijen).padStart(5) + '  ' + r.reden);
  }
}

module.exports = { meet, deelIn, KLASSEN, BEDRAG, HERKOMST, DOEL };

if (require.main === module) {
  const u = meet();
  /* Geen process.exit() na een grote console.log: naar een pipe kapt dat de
     uitvoer af (keuringsregel `pipe` in scripts/meetkeuring.js). */
  if (process.argv.includes('--json')) { console.log(JSON.stringify(u, null, 2)); process.exitCode = 0; return; }
  druk(u);
  if (process.argv.includes('--vastleggen')) {
    fs.writeFileSync(DOEL, JSON.stringify(u, null, 2) + '\n');
    console.log('\ngeschreven: DOORBELASTING.json');
  }
}
