/* DE MANDAATPROEF -- komt er een effect voorbij de autoriteitslaag, of niet?

   DE INVARIANT DIE HIJ BEPROEFT: geen muterend effect vanuit een intentie
   zonder aantoonbaar gezag. Dat gezag is OF een mens die zojuist bevestigde,
   OF een mandaat dat de handeling dekt. Nooit niets.

   WAAROM DIT EEN PROEF IS EN GEEN TOETS. Hij loopt tegen een ECHTE server over
   de gewone HTTP-weg (/api/member/doe), meet het effect aan de opslag en niet
   aan wat de route zegt, en eindigt met een foutcode. Een unittoets bewijst het
   gedrag van een functie; dit bewijst dat de grens op het pad ligt dat een mens
   werkelijk aflegt -- en dat is precies het verschil dat KETENBEREIK.json
   blootlegde.

   TWEE TAKKEN, EN ZE ZIJN NIET INWISSELBAAR. Dat is de vondst die deze proef
   vormgaf: de agenda-zin ("zet mijn afspraak om") loopt over /api/agenda/bewaar,
   en dat is beleidsniveau `voorstel`. Een mandaat hoogt per eigen regel NOOIT
   een niveau op, dus die handeling kan zelfstandig niet -- met of zonder
   mandaat. Zij bewijst de MENStak. De MANDAATtak heeft een `klein`-pad nodig,
   en dat zijn er vier voor een lid.

   WAT DEZE PROEF NIET KAN, en dat staat als `openBekend` in de uitslag en niet
   als een stille nul: er is vandaag geen enkele manier om een mandaat te
   VERLENEN. Niemand kent er een toe -- kern/stuur/plafond.js heet de eerste
   productie-lezer van de mandaatlaag en wordt vanuit de route nooit met een
   mandaat aangeroepen. Wie dat bouwt, neemt vier besluiten (wie verleent, voor
   welke capabilities, hoe lang, met welk plafond) en dat is een productvraag.
   Zolang die openstaat, is de mandaattak in proces beproefd en niet over de
   lijn -- en dat verschil wordt hier niet weggepoetst.

   Draai: npm run mandaatproef        (meet en rapporteert)
          npm run mandaatproef:vast   (schrijft MANDAATPROEF.json) */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const W = require('./lib/ketenwereld');
const R = require('./lib/pakteronde');
const { stempel } = require('./lib/stempel');

const DOEL = path.join(W.WORTEL, 'MANDAATPROEF.json');

/* Het `klein`-pad van de mandaattak. leerstof/oefen schrijft de oefenstand van
   dit lid: een echte mutatie, alleen bij de gebruiker zelf, omkeerbaar -- exact
   waarvoor `klein` bestaat. */
const KLEIN_PAD = '/api/leerstof/oefen';
const DOEL_ID = 'rekenen.g1.tellen-tot-10';
const VOORSTEL_PAD = '/api/agenda/bewaar';

async function doe(basis, token, pad, lijf) {
  const r = await fetch(basis + '/api/member/doe', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
    body: JSON.stringify({ pad, body: lijf || {} })
  });
  const tekst = await r.text();
  let d = null; try { d = JSON.parse(tekst); } catch (e) {}
  const koppen = {}; r.headers.forEach((v, k) => { koppen[k.toLowerCase()] = v; });
  return { status: r.status, lijf: d || {}, staat: R.ontleedStaat(koppen['x-rtg-staat']) };
}

module.exports = { KLEIN_PAD, VOORSTEL_PAD, DOEL_ID, doe, DOEL };

/* ------------------------------------------------------------------------- */

const poort = require('../server/kern/stuur/mandaatpoort');

/* Een schakel sluit, staat open, of staat open MET een uitgeschreven reden.
   Die derde stand komt uit scripts/ritproef.js en bestaat omdat een proef die
   iets echts vindt anders maar twee uitgangen heeft: altijd zakken, of de
   bevinding wegpoetsen. */
const sluit = (id, wat, ok, gemeten) => ({ id, wat, stand: ok ? 'gesloten' : 'open', gemeten });
const bekend = (id, wat, gemeten, waarom) => ({ id, wat, stand: 'openBekend', gemeten, waarom });

async function ronde(afdwingen) {
  const werkmap = fs.mkdtempSync(path.join(os.tmpdir(), 'mandaatproef-'));
  const spoorPad = path.join(werkmap, 'spoor.jsonl');
  fs.writeFileSync(spoorPad, '');
  const dataDir = path.join(werkmap, 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  const srv = await W.startServer({
    spoorPad, dataDir,
    extra: Object.assign({ RTG_STAATLOG: '2', RTG_AI_UIT: '1' },
      afdwingen ? { RTG_MANDAAT_AFDWINGEN: '1' } : {})
  });
  try {
    const token = await W.logIn(srv.basis);
    const nul = await doe(srv.basis, token, '/api/agenda/mijn', {});   // lezen: zet de beginstand
    /* EEN GELDIG LEERDOEL, en dat is niet cosmetisch. De eerste versie stuurde
       een verzonnen body; de route gaf dan 404 en de schakel stond `ok: false`.
       Dan meet de proef zijn eigen typefout in plaats van de poort -- en dat
       ziet er precies zo uit als een poort die dichtzit. */
    const klein = await doe(srv.basis, token, KLEIN_PAD, { doel: DOEL_ID });
    const voorstel = await doe(srv.basis, token, VOORSTEL_PAD, { titel: 'proef', start: '2026-10-01T10:00:00Z' });
    return { afdwingen, nul, klein, voorstel };
  } finally { await srv.stop(); }
}

/* Veranderde er iets BUITEN de collecties die elk verzoek al aanraakt? Zelfde
   afleiding als scripts/paktebetekenis.js, en om dezelfde reden: het antwoord
   van de route is wat de route ZEGT, de opslag is wat er GEBEURDE. */
function effect(voor, na) {
  if (!voor || !na) return null;
  return R.verschil(voor, na).filter(c => !['apiSpoor', 'handelingLog', 'routerschaduw', 'fluister'].includes(c));
}

async function main() {
  const mee = await ronde(false);
  const hard = await ronde(true);

  const schakels = [];

  /* 1. De agenda-zin gaat naar een MENS en niet naar het mandaat. */
  schakels.push(sluit('agenda-vraagt-mens',
    'de agenda-handeling (`voorstel`) komt terug als bevestiging en wordt niet zelfstandig uitgevoerd',
    hard.voorstel.status === 428 && hard.voorstel.lijf.bevestigNodig === true,
    { status: hard.voorstel.status, bevestigNodig: !!hard.voorstel.lijf.bevestigNodig }));

  /* 2. En het mandaat komt daar niet eens aan te pas -- de poort zegt `nvt`. */
  const oordeelVoorstel = poort.beoordeel(VOORSTEL_PAD, 'member', {});
  schakels.push(sluit('mens-tak-raakt-poort-niet',
    'bij een handeling die een mens bevestigt gaat de mandaatpoort er niet over',
    oordeelVoorstel.soort === 'nvt',
    { soort: oordeelVoorstel.soort, reden: oordeelVoorstel.reden }));

  /* 3. MEELOPEND: een zelfstandige mutatie zonder mandaat gaat door. Dat HOORT
        zo -- CONTROLPLANE.md wil dat een nieuwe regel eerst meeloopt. */
  const meeEffect = effect(mee.nul.staat, mee.klein.staat);
  schakels.push(sluit('meelopend-laat-door',
    'zonder RTG_MANDAAT_AFDWINGEN houdt de poort niets tegen',
    mee.klein.status === 200 && mee.klein.lijf.ok === true,
    { status: mee.klein.status, ok: mee.klein.lijf.ok, effect: meeEffect }));

  /* 4. AFDWINGEND: dezelfde handeling wordt geweigerd, en de weigering NOEMT
        het mandaat. Een weigering zonder reden is een grijze knop. */
  const hardLijf = hard.klein.lijf || {};
  const geweigerd = hard.klein.status >= 400 || hardLijf.ok === false ||
    (hardLijf.antwoord && hardLijf.antwoord.geweigerd === 'MANDAAT');
  schakels.push(sluit('afdwingend-weigert',
    'met RTG_MANDAAT_AFDWINGEN=1 wordt een zelfstandige mutatie zonder mandaat geweigerd',
    !!geweigerd,
    { status: hard.klein.status, lijf: hardLijf }));

  /* 5. EN ER GEBEURDE NIETS. Dit is de eigenlijke invariant: niet dat de route
        nee zei, maar dat de opslag onaangeraakt bleef. */
  const hardEffect = effect(hard.nul.staat, hard.klein.staat);
  schakels.push(sluit('afdwingend-geen-effect',
    'de geweigerde handeling liet geen spoor in de opslag achter',
    hardEffect !== null && hardEffect.length === 0,
    { veranderd: hardEffect }));

  /* 6. De mandaattak zelf: de poort laat hem door MET een dekkend mandaat.
        In proces, want er is niets dat een mandaat over de lijn draagt. */
  const metMandaat = poort.beoordeel(KLEIN_PAD, 'member', { mandaat: { capabilities: [KLEIN_PAD] } });
  const zonder = poort.beoordeel(KLEIN_PAD, 'member', {});
  schakels.push(bekend('mandaat-tak',
    'met een dekkend mandaat laat de poort dezelfde handeling door',
    { metMandaat: metMandaat.soort, zonderMandaat: zonder.soort },
    'IN PROCES beproefd en niet over de lijn: er is vandaag geen enkele manier om een mandaat te ' +
    'VERLENEN. Niemand kent er een toe, en kern/stuur/plafond.js -- die zichzelf de eerste ' +
    'productie-lezer van de mandaatlaag noemt -- wordt vanuit de route nooit met een mandaat ' +
    'aangeroepen. Wie dat bouwt neemt vier besluiten (wie verleent, welke capabilities, hoe lang, ' +
    'welk plafond) en dat is een productvraag en geen bouwtaak.'));

  const open = schakels.filter(s => s.stand === 'open');
  const openBekend = schakels.filter(s => s.stand === 'openBekend');
  return {
    soort: 'proef',
    uitleg: 'Komt er een muterend effect voorbij de autoriteitslaag zonder gezag? Gemeten tegen een echte server over /api/member/doe, met het effect afgelezen aan de opslag (X-RTG-Staat) en niet aan wat de route zegt.',
    grens: 'Drie dingen die dit NIET zegt. (1) De mandaattak is in PROCES beproefd, want een mandaat is vandaag niet te verlenen -- schakel 6 draagt die reden. (2) Het effect wordt gemeten op COLLECTIENIVEAU, min de vier collecties die elk verzoek al aanraakt; een mutatie binnen precies die vier zou onzichtbaar zijn. (3) Dit is EEN wereld (member) en EEN ingang (/api/member/doe); over /api/fluister, /api/ai en /api/chat/send zegt deze proef niets -- dat doet KETENBEREIK.json.',
    schakels,
    telling: { schakels: schakels.length, gesloten: schakels.length - open.length - openBekend.length,
      open: open.length, openBekend: openBekend.length },
    sluit: open.length === 0,
    sluitMetBevinding: open.length === 0 && openBekend.length > 0
  };
}

if (require.main === module) {
  main().then((u) => {
    const vast = process.argv.includes('--vastleggen');
    if (vast) fs.writeFileSync(DOEL, JSON.stringify(Object.assign({ stempel: stempel() }, u), null, 2) + '\n');
    console.log(vast ? '\nMANDAATPROEF.json geschreven.\n' : '\nGEMETEN, NIET GESCHREVEN (npm run mandaatproef:vast legt vast).\n');
    for (const s of u.schakels) {
      const merk = s.stand === 'gesloten' ? '  OK  ' : s.stand === 'openBekend' ? ' OPEN*' : ' OPEN ';
      console.log(merk + ' ' + s.id.padEnd(26) + s.wat);
      console.log('       ' + JSON.stringify(s.gemeten).slice(0, 150));
      if (s.waarom) console.log('       REDEN: ' + s.waarom.slice(0, 200) + '...');
    }
    const t = u.telling;
    console.log('\n  ' + t.gesloten + ' gesloten, ' + t.open + ' open, ' + t.openBekend + ' open met reden (*)\n');
    process.exit(u.sluit ? 0 : 1);
  }).catch((e) => { console.error('mandaatproef: ' + (e && e.stack || e)); process.exit(1); });
}
