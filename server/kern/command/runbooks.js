/* RUNBOOKS -- vooraf goedgekeurd herstel, en het enige pad waarlangs Command
   iets aan de gegevens verandert.

   WAAROM ÉÉN PAD. Een commandolaag die overal een eigen schrijfactie heeft,
   heeft geen terugdraaiknop: bij elke schrijfplek moet iemand dan apart hebben
   bedacht hoe je hem ongedaan maakt, en één plek waar dat vergeten is, is
   genoeg. Hier is elke wijziging dezelfde vorm -- een veld op een object van
   een bekende soort krijgt een nieuwe waarde -- en die vorm draagt zijn oude
   waarde mee. Terugdraaien is daarmee geen extra code maar hetzelfde mechanisme
   omgekeerd (`draaiTerug`).

   DROOG DRAAIEN IS DE STANDAARD. `voer(id, {droog:true})` raakt niets aan en
   vertelt precies wat er zou gebeuren. Dat is niet beleefdheid maar de
   veilige-wijziging-keten: eerst zien, dan doen. Een runbook dat nooit droog
   gedraaid is, is een runbook waarvan niemand weet wat hij doet.

   WAT EEN RUNBOOK NIET MAG. Geen veld dat een identiteit, een bedrag of een
   toegangsrecht draagt (BEVROREN). Die horen bij handelingen die per definitie
   een mens vragen, en een runbook is juist het pad dat zónder mens kan lopen.
   Deze lijst is een grendel en geen advies: hij wordt bij het uitvoeren
   gecontroleerd, niet bij het opschrijven. */
'use strict';

const { OP_TYPE, rijen, kort, s } = require('./register');
/* De recepten zelf staan in ./runbookcatalogus.js: gegevens, geen werking. */
const { RUNBOOKS, OP_ID, BEVROREN } = require('./runbookcatalogus');

function maakRunbooks({ db, save, crypto, journaal, risico, beleid }) {
  function draaien() {
    if (!Array.isArray(db.data.commandRuns)) db.data.commandRuns = [];
    return db.data.commandRuns;
  }

  /* Welke objecten past dit runbook nu? Begrensd, en het echte aantal staat
     erbij -- een herstelronde die "39 gevallen" zegt terwijl er 400 zijn, is
     een leugen met een geruststellend gezicht. */
  function kandidaten(rb, max) {
    const soort = OP_TYPE.get(rb.type);
    if (!soort) return { rijen: [], totaal: 0 };
    const alle = rijen(db, soort).filter(r => r && rb.past(r));
    const grens = Number(max || beleid.getal('herstel.maxPerRonde', 50));
    return { rijen: alle.slice(0, grens), totaal: alle.length, soort };
  }

  /* HET VENSTER MOET GROOT GENOEG ZIJN OM DE GEVRAAGDE GEVALLEN TE BEVATTEN.

     Waarom dit een eigen functie is en geen `slice` ergens: `alleen` komt van de
     operator, en die kijkt met een RUIMER venster dan de rondegrens (hij wil
     ook zien wat er buiten de ronde valt). Zocht `voer` daarna alleen in de
     eerste maxPerRonde kandidaten, dan verdwenen precies de veilige gevallen
     die verderop in de lijst stonden -- stil, met "0 hersteld" als uitkomst en
     geen enkele fout. Dus: met een `alleen`-lijst kijken we ruim, en pas NA het
     filteren geldt de rondegrens. */
  function doelenVoor(rb, alleen, max) {
    const grens = Number(max || beleid.getal('herstel.maxPerRonde', 50));
    if (!alleen) { const k = kandidaten(rb, grens); return { k, doelen: k.rijen }; }
    const k = kandidaten(rb, Number.MAX_SAFE_INTEGER);
    const soort = k.soort;
    const wil = new Set(alleen.map(String));
    return { k, doelen: k.rijen.filter(r => wil.has(s(r[soort.sleutel]))).slice(0, grens) };
  }

  function oordeel(rb, aantal) {
    return risico.beoordeel(rb.actie, { aantal, klantImpact: rb.klantImpact, onomkeerbaar: !rb.terugDraaibaar });
  }

  function lijst() {
    return RUNBOOKS.map(rb => {
      const k = kandidaten(rb);
      const o = oordeel(rb, k.totaal || 1);
      return { id: rb.id, naam: rb.naam, wat: rb.wat, type: rb.type, veld: rb.veld, naar: rb.naar,
        oorzaak: rb.oorzaak, terugDraaibaar: rb.terugDraaibaar, klantImpact: rb.klantImpact,
        kandidaten: k.totaal, oordeel: o };
    });
  }

  /* Uitvoeren. Droog: alleen vertellen. Echt: schrijven, met de oude waarde per
     object in de run, zodat draaiTerug() geen gok is. */
  function voer(id, opties) {
    const rb = OP_ID.get(String(id));
    if (!rb) return { error: 'Dat runbook bestaat niet: ' + id, status: 404 };
    if (BEVROREN.has(rb.veld)) return { error: 'Dat veld mag een runbook niet aanraken: ' + rb.veld, status: 403 };
    const o = opties || {};
    const droog = o.droog !== false;
    const door = String(o.door || '');
    if (!droog && !door) return { error: 'Zonder herleidbare actor draait er geen runbook.', status: 403 };

    const alleen = Array.isArray(o.alleen) && o.alleen.length ? o.alleen : null;
    const { k, doelen } = doelenVoor(rb, alleen, o.max);
    const soort = k.soort;
    const ord = oordeel(rb, doelen.length || 1);

    /* De grendel: boven de mensgrens draait hij niet vanzelf, ook niet als de
       beller "echt" vroeg. Dat oordeel hoort hier en niet in het scherm. */
    if (!droog && ord.niveau === 'hand' && !o.menselijkAkkoord) {
      return { error: 'Dit herstel vraagt een menselijk besluit (risico ' + ord.score + ').', status: 403, oordeel: ord };
    }

    const run = { id: crypto.randomUUID(), at: new Date().toISOString(), runbook: rb.id, naam: rb.naam,
      droog, door: door || 'droogloop', reden: String(o.reden || ''), niveau: droog ? 'assist' : ord.niveau,
      oordeel: ord, geraakt: [], totaalKandidaten: k.totaal, teruggedraaid: false };

    for (const r of doelen) {
      const was = s(r[rb.veld]);
      run.geraakt.push({ type: rb.type, id: s(r[soort.sleutel]), titel: kort(soort, r).titel, veld: rb.veld, van: was, naar: rb.naar });
      if (!droog) r[rb.veld] = rb.naar;
    }
    /* Ook een droogloop wordt bewaard: hij is het bewijs dat iemand heeft
       gekeken vóór hij drukte, en hij hoort dus in dezelfde lijst als de echte
       rondes te staan. */
    draaien().push(run);
    if (save) save();

    journaal.noteer({ actor: door || 'command (droog)', actie: droog ? 'herstel droog' : 'herstel uitvoeren',
      objectType: 'runbook', objectId: rb.id, niveau: run.niveau, risico: ord.score,
      reden: run.reden || rb.oorzaak, beleid: 'herstel.autoAan',
      voor: { kandidaten: k.totaal }, na: { geraakt: run.geraakt.length, droog } });

    return { run: samenvatting(run), oordeel: ord, overgeslagen: Math.max(0, k.totaal - doelen.length) };
  }

  /* Terugdraaien: elk geraakt object terug naar de waarde die de run opschreef.
     Alleen als de waarde nog is wat de run ervan maakte -- anders heeft iemand
     anders er sindsdien aan gezeten en zou terugdraaien diens werk wissen. */
  function draaiTerug(runId, door, reden) {
    const run = draaien().find(r => r.id === String(runId));
    if (!run) return { error: 'Die herstelronde bestaat niet.', status: 404 };
    if (run.droog) return { error: 'Een droogloop heeft niets veranderd; er valt niets terug te draaien.', status: 409 };
    if (run.teruggedraaid) return { error: 'Die ronde is al teruggedraaid.', status: 409 };
    if (!door) return { error: 'Zonder herleidbare actor wordt er niets teruggedraaid.', status: 403 };
    const rb = OP_ID.get(run.runbook);
    const soort = OP_TYPE.get(rb ? rb.type : '');
    if (!soort) return { error: 'De soort van die ronde bestaat niet meer.', status: 409 };
    let terug = 0, overgeslagen = 0;
    for (const g of run.geraakt) {
      const r = rijen(db, soort).find(x => x && s(x[soort.sleutel]) === g.id);
      if (!r) { overgeslagen++; continue; }
      if (s(r[g.veld]) !== g.naar) { overgeslagen++; continue; }
      r[g.veld] = g.van; terug++;
    }
    run.teruggedraaid = true; run.terugDoor = String(door); run.terugAt = new Date().toISOString();
    if (save) save();
    journaal.noteer({ actor: door, actie: 'herstel terugdraaien', objectType: 'runbook', objectId: run.runbook,
      niveau: 'hand', reden: String(reden || 'terug naar de vorige toestand'),
      voor: { geraakt: run.geraakt.length }, na: { teruggezet: terug, overgeslagen } });
    return { teruggezet: terug, overgeslagen, run: samenvatting(run) };
  }

  function samenvatting(run) {
    return { id: run.id, at: run.at, runbook: run.runbook, naam: run.naam, droog: run.droog,
      door: run.door, reden: run.reden, niveau: run.niveau, score: run.oordeel ? run.oordeel.score : null,
      geraakt: run.geraakt.length, totaalKandidaten: run.totaalKandidaten,
      teruggedraaid: run.teruggedraaid, terugDoor: run.terugDoor || null,
      voorbeelden: run.geraakt.slice(0, 8) };
  }

  const runs = (n) => draaien().slice().reverse().slice(0, n || 25).map(samenvatting);
  const run = (id) => { const r = draaien().find(x => x.id === String(id)); return r ? Object.assign(samenvatting(r), { geraaktVolledig: r.geraakt }) : null; };

  return { lijst, voer, draaiTerug, runs, run, kandidaten, RUNBOOKS, OP_ID, BEVROREN };
}

module.exports = { maakRunbooks, RUNBOOKS, BEVROREN };
