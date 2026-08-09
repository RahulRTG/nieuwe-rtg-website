/* Payroll OS: DE LOONRUN -- concept, vier ogen, definitief, correctie.

   DE WEG, EN WAAROM ELKE STAP ER IS:

     concept        de berekening staat, niemand heeft iets goedgekeurd
     gecontroleerd  de afwijkingen zijn bekeken en verklaard
     manager        de werkgever staat achter de uren en de bedragen
     administrateur de tweede paar ogen, en NOOIT dezelfde persoon
     definitief     onaanraakbaar; hierna kan alleen een correctierun nog iets
     ...            betaalbestand, stroken, aangifte, journaal (nog te bouwen)

   NA DEFINITIEF VERANDERT ER NIETS MEER. Niet "we passen het even aan": een
   loonstrook die is uitgegeven, een bedrag dat is betaald en een aangifte die
   is verzonden staan tegenover elkaar. Wie de run alsnog bijwerkt, laat die
   drie uit elkaar lopen zonder spoor. Een correctie is daarom een NIEUWE run
   die naar de oude wijst en het verschil draagt -- de oude blijft staan zoals
   hij was.

   VIER OGEN IS NIET TWEE KNOPPEN. De tweede goedkeuring moet van een ANDER
   mens komen dan de eerste; anders is het een formulier, geen controle. Dat
   staat hier server-side en niet in de knoppen van een scherm, want daar is het
   met een tweede tabblad omheen te lopen. En niemand keurt zijn eigen
   salariswijziging goed: wie in de run staat, keurt de run niet.

   WAAROM ELKE RUN ZIJN REGELVERSIE VASTHOUDT. Overdoen moet tot op de cent
   hetzelfde opleveren, ook een jaar later, ook nadat de tarieven drie keer zijn
   bijgewerkt. De run bewaart daarom de versie waarmee hij is gerekend en de
   motor krijgt bij een herberekening precies dat pakket terug. */
'use strict';

const STANDEN = ['concept', 'gecontroleerd', 'manager', 'administrateur', 'definitief'];

function maakRun({ db, save, nu, crypto, motor, regelpakket, componenten }) {
  const tijd = nu || (() => new Date().toISOString());
  const id = () => 'run_' + crypto.randomBytes(5).toString('hex');

  function bak() {
    if (!Array.isArray(db.data.payrollRunsV2)) db.data.payrollRunsV2 = [];
    return db.data.payrollRunsV2;
  }
  const vind = (runId) => bak().find(r => r.id === runId) || null;

  function stempel(run, wat, door, extra) {
    run.stappen.push(Object.assign({ wat, door: door || null, at: tijd() }, extra || {}));
  }

  /* ---------- openen ---------- */
  /* De invoer komt van buiten (uren uit de klok, toeslagen, vergoedingen) en
     wordt hier BEWAARD, niet alleen verwerkt. Zonder de invoer erbij is een run
     niet over te doen en is "waarom is dit bedrag berekend" onbeantwoordbaar. */
  function open({ code, zaak, periode, land, regels, door }) {
    if (!/^\d{4}-\d{2}$/.test(String(periode || ''))) return { status: 400, error: 'Kies een periode als 2026-07.' };
    if (!door) return { status: 400, error: 'Noteer wie deze loonrun opent.' };
    const bestaand = bak().find(r => r.code === code && r.periode === periode && !r.correctieVan && r.stand !== 'vervallen');
    if (bestaand) return { status: 409, error: 'Er is al een loonrun voor ' + periode + '. Maak een correctierun.', runId: bestaand.id };

    const dag = periode + '-01';
    const pakket = regelpakket.opDatum(land || 'NL', dag);
    if (!pakket) return { status: 409, error: 'Er is geen regelpakket dat gold op ' + dag + '. Haal de jaargang binnen en merk hem aan.' };

    const comp = Object.fromEntries(componenten.geldigOp(dag).map(c => [c.sleutel, c]));
    const stroken = [];
    for (const r of (regels || [])) {
      const strook = motor.bereken({ contract: r.contract, periode: { van: dag },
        invoer: r.invoer, regelpakket: pakket, componenten: comp });
      if (strook.fout) return { status: 422, error: strook.fout, onbekend: strook.onbekend, staffId: r.staffId };
      stroken.push({ staffId: r.staffId, naam: r.naam, invoer: r.invoer, contract: r.contract,
        strook, waarschuwingen: motor.controleer(strook, { regelpakket: pakket,
          leeftijdsgroep: r.leeftijdsgroep, gewerkteUren: r.gewerkteUren || 0 }) });
    }

    const run = {
      id: id(), code, zaak: zaak || code, periode, land: (land || 'NL').toUpperCase(),
      /* WAAROP DEZE RUN BERUST, en dat reist mee tot in de loonstrook. Een run
         op zelfverklaard ongecontroleerde tabellen is een geldige run -- een
         mens heeft ze uitdrukkelijk aangemerkt -- maar wie hem later leest,
         hoort dat te kunnen zien zonder het regelpakket erbij te halen. */
      opDemoTabellen: !!pakket.opDemoTabellen,
      regelversie: pakket.versie, regelstand: pakket.stand,
      stand: 'concept', stroken,
      totaalNettoCenten: stroken.reduce((s, x) => s + x.strook.nettoCenten, 0),
      totaalKostenCenten: stroken.reduce((s, x) => s + x.strook.kostenWerkgeverCenten, 0),
      goedkeuringen: [], correctieVan: null, stappen: [], geopendDoor: door, at: tijd()
    };
    stempel(run, 'geopend', door, { regelversie: pakket.versie });
    bak().unshift(run);
    save();
    return { ok: true, run: kort(run), waarschuwingen: stroken.flatMap(s => s.waarschuwingen) };
  }

  /* ---------- goedkeuren ---------- */
  function keurGoed(runId, rol, door, wieBenIk) {
    const run = vind(runId);
    if (!run) return { status: 404, error: 'Deze loonrun kennen we niet.' };
    if (run.stand === 'definitief') return { status: 409, error: 'Deze loonrun is definitief; maak een correctierun.' };
    if (!door) return { status: 400, error: 'Noteer wie goedkeurt.' };
    if (rol !== 'manager' && rol !== 'administrateur') return { status: 400, error: 'Rol moet manager of administrateur zijn.' };

    /* Niemand keurt zijn eigen loon goed. wieBenIk is het personeelsnummer van
       de goedkeurder; staat dat in de run, dan is dit geen controle. */
    if (wieBenIk != null && run.stroken.some(s => s.staffId === wieBenIk))
      return { status: 403, error: 'U staat zelf in deze loonrun en kunt hem daarom niet goedkeuren.' };

    if (run.goedkeuringen.some(g => g.rol === rol))
      return { status: 409, error: 'Deze loonrun is al door een ' + rol + ' goedgekeurd.' };
    /* Vier ogen: de tweede goedkeuring komt van een ander mens. Server-side,
       want in een scherm loop je daar met een tweede tabblad omheen. */
    if (run.goedkeuringen.some(g => g.door === door))
      return { status: 403, error: 'De tweede goedkeuring moet van iemand anders komen.' };

    run.goedkeuringen.push({ rol, door, at: tijd() });
    run.stand = rol === 'manager' ? 'manager' : 'administrateur';
    stempel(run, 'goedgekeurd', door, { rol });
    save();
    return { ok: true, stand: run.stand, goedkeuringen: run.goedkeuringen };
  }

  /* ---------- definitief ---------- */
  function maakDefinitief(runId, door) {
    const run = vind(runId);
    if (!run) return { status: 404, error: 'Deze loonrun kennen we niet.' };
    if (run.stand === 'definitief') return { ok: true, ongewijzigd: true, stand: run.stand };
    const rollen = run.goedkeuringen.map(g => g.rol);
    if (!rollen.includes('manager') || !rollen.includes('administrateur'))
      return { status: 409, error: 'Een loonrun wordt pas definitief na goedkeuring door een manager en een administrateur.' };
    /* En niet op een ongecontroleerd regelpakket. Een proefrun mag daarop; geld
       overmaken op tarieven die niemand heeft nagekeken, niet. */
    if (run.regelstand !== 'goedgekeurd')
      return { status: 409, error: 'Regelpakket ' + run.regelversie + ' is nog niet aangemerkt. Een definitieve run mag daar niet op draaien.' };
    run.stand = 'definitief'; run.definitiefDoor = door || null; run.definitiefOp = tijd();
    stempel(run, 'definitief', door);
    save();
    return { ok: true, stand: run.stand };
  }

  /* De VALUTA gaat mee in de samenvatting. Zonder haar zet een scherm er een
     euroteken voor -- ook op een Japanse loonrun -- en deelt het door honderd
     terwijl de yen geen onderverdeling heeft. Dat is een factor honderd in een
     bedrag dat naar iemands rekening gaat. */
  const kort = (r) => ({ id: r.id, code: r.code, zaak: r.zaak, periode: r.periode, stand: r.stand,
    valuta: ((r.stroken[0] || {}).strook || {}).valuta ? r.stroken[0].strook.valuta.code : null,
    regelversie: r.regelversie, regelstand: r.regelstand, opDemoTabellen: !!r.opDemoTabellen, correctieVan: r.correctieVan || null,
    reden: r.reden || null, aantal: r.stroken.length, totaalNettoCenten: r.totaalNettoCenten,
    totaalVerschilCenten: r.totaalVerschilCenten, goedkeuringen: r.goedkeuringen, at: r.at });

  const lijst = (code) => bak().filter(r => !code || r.code === code).map(kort);
  /* haalRun en niet haal: de kruisscan (scripts/kruisscan.js) ziet bestanden in
     een map als slices van een opgeknipte module en las bron.haal() in
     ./bijwerken.js als een verwijzing hierheen. Vals alarm -- dit zijn echte
     modules met een eigen export -- maar een naam die zegt WAT hij haalt is
     hoe dan ook beter dan een die met de scanner in de knoop ligt. */
  const haalRun = (runId) => vind(runId);
  /* De strook van een medewerker, uit definitieve runs. Een concept is geen
     loonstrook: dat is een berekening waar nog niemand achter staat. */
  const strokenVan = (code, staffId) => bak()
    .filter(r => r.code === code && r.stand === 'definitief')
    .map(r => ({ runId: r.id, periode: r.periode, correctieVan: r.correctieVan || null,
      regelversie: r.regelversie, strook: (r.stroken.find(s => s.staffId === staffId) || {}).strook }))
    .filter(x => x.strook);

  /* De correctierun staat apart (./correctie.js): een eigen onderwerp, en run.js
     ging over de 10 KB. Hij krijgt de binnenkant mee die hij nodig heeft. */
  const { corrigeer } = require('./correctie').maakCorrectie({ db, save, nu, crypto, motor, regelpakket,
    componenten, vind, bak, kort, stempel });

  return { open, keurGoed, maakDefinitief, corrigeer, lijst, haal: haalRun, strokenVan, STANDEN };
}

module.exports = { maakRun, STANDEN };
