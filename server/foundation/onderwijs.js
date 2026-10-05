/* RTFoundation-onderwijs: het gratis, open onderwijs voor elk gezin. Een live
   digitaal schoolbord voor de docent/begeleider en een eigen "schrift" voor elke
   leerling (schrijven, tekenen, typen, bordfoto's, opgaven, agenda) met een
   AI-bijleshulp, plus de reis-aanvraag/voordracht. Geen lidmaatschap of betaling
   nodig: je doet mee met een lescode. Gemount vanuit foundation.js op de
   gedeelde context (foundation/basis.js). */
module.exports = (ctx) => {
  /* teVaak/misluktePoging/goedePoging/ipVan komen uit ./rem via de gedeelde
     context (foundation/basis.js) -- dezelfde rem die gezin.js gebruikt, en
     geen tweede kopie. */
  const { router, F, save, nu, rid, schoon, crypto, anthropic, SYSTEM, DEMO, TIPS,
    teVaak, misluktePoging, goedePoging, ipVan } = ctx;

  /* DE LESCODE IS DE GELOOFSBRIEF VAN EEN LES, en sinds 29 september 2026 (B17)
     is hij er een: 128 bits uit kern/bearercode.js, op schijf alleen als hash,
     met issuer, doel, scope, onderwerp en verval (./onderwijs/toegang.js). Hij
     opent precies een ding: meedoen. Daarna draagt elke leerling en de leraar een
     EIGEN sleutel, en de les zelf staat op een niet-geheim les-id. Wie het id
     kent, heeft niets; wie de lescode kent, kan alleen meedoen.

     OUDE LESSEN OPENEN NIETS MEER. Een les van voor deze migratie heeft geen
     vermelding in de credentialcollectie, dus geen sleutel past er nog op; de
     begeleider maakt een nieuwe les. `ruimOudeLessen()` haalt bij de eerste
     schrijfhandeling de kale tokens van die oude lessen van schijf en hangt ze
     onder een afgeleide sleutel, zodat ook de oude code geen sleutel meer is. */
  const toegang = require('./onderwijs/toegang')({ db: ctx.db, crypto, bewerkCollectie: ctx.bewerkCollectie, nu });
  function ruimOudeLessen() {
    const lessen = F().lessen; let geruimd = false;
    for (const [k, les] of Object.entries(lessen)) {
      if (!les || typeof les !== 'object') { delete lessen[k]; geruimd = true; continue; }
      if (les.v === 2) continue;
      delete les.teacherToken; delete les.code;
      for (const l of Object.values(les.leerlingen || {})) if (l) delete l.token;
      les.v = 2; les.legacy_gesloten_at = les.legacy_gesloten_at || nu();
      const nieuw = 'legacy-' + crypto.createHash('sha256').update('rtf-les|' + k).digest('hex').slice(0, 32);
      if (nieuw !== k) { delete lessen[k]; lessen[nieuw] = les; }
      geruimd = true;
    }
    return geruimd;
  }

  /* ---------- live (SSE) ---------- */
  const sse = new Map(); // code -> Set van { res, role, studentId }
  function stuur(code, event, data, filter) {
    const set = sse.get(code); if (!set) return;
    const payload = 'event: ' + event + '\ndata: ' + JSON.stringify(data) + '\n\n';
    for (const c of set) if (!filter || filter(c)) { try { c.res.write(payload); } catch (e) {} }
  }
  function online(code) {
    const set = sse.get(code); const leerlingen = new Set(); let docent = false;
    if (set) for (const c of set) { if (c.role === 'docent') docent = true; else if (c.studentId) leerlingen.add(c.studentId); }
    return { docent, leerlingen: [...leerlingen] };
  }
  function presentie(code) {
    const les = F().lessen[code]; if (!les) return;
    const on = online(code);
    const lijst = Object.values(les.leerlingen).filter(l => !l.ingetrokken_at).map(l => ({
      studentId: l.studentId, naam: l.naam, online: on.leerlingen.includes(l.studentId),
      ingeleverd: (les.opgaven || []).filter(o => (o.inzendingen || {})[l.studentId]).length
    }));
    stuur(code, 'presentie', { leerlingen: lijst }, c => c.role === 'docent');
  }

  /* ---------- les + rechten ---------- */
  /* DE REM OP HET RADEN VAN EEN LESSLEUTEL.

     Deze functie is de enige plek waar een verzoek wordt omgezet in een les plus
     een rol (leraar of leerling), en dus de enige plek waar een FOUTE sleutel
     zichtbaar wordt; het meedoen met een lescode telt in dezelfde bak. Precies daar hoort de
     rem, en niet per route: dan telt hij mee voor `/les/:code`, `/bord/:code`,
     `/schrift/:code` en elke route die er later bijkomt, zonder dat iemand eraan
     hoeft te denken.

     Tot 2 september 2026 stond hier niets. De code was 29,7 bits en het raden
     onbegrensd -- en dat is de combinatie die telt, want entropie alleen maakt
     raden duur en niet traag. De machinerie lag er al (`./rem`), en `gezin.js`
     gebruikt hem sinds jaar en dag voor het aanmaken van een gezin.

     TWINTIG POGINGEN PER TIEN MINUTEN, per adres, en dat getal komt uit de
     gebruiker en niet uit een gevoel: een hele klas zit achter EEN schooladres.
     Dertig kinderen die allemaal een code overtypen leveren zo een handvol
     typefouten op, en met de acht van `/gezin/maak` sluiten ze elkaar buiten.
     Twintig per tien minuten laat dat door en begrenst een aanvaller op ongeveer
     2.900 pogingen per dag -- tegen 2^128 mogelijkheden is dat niets, maar een
     rem blijft staan: hij kost niets en telt ook de gestolen-sleutelproef.

     DE REM STAAT VOOR DE OPZOEKING, en dat is een keuze met een prijs. Andersom
     -- eerst kijken of de code klopt en alleen missers tellen -- zou vriendelijker
     zijn: een klas met de juiste code komt dan altijd binnen. Maar dan mag een
     aanvaller onbeperkt blijven raden, want een treffer levert hem gewoon een
     200 op en de 429 kost hem niets. Dan remt de rem niets meer.
     De prijs is dus dat een adres dat de grens raakt, tien minuten buiten staat
     -- ook met een goede code. Dat is de bedoeling en geen storing.

     Een GESLAAGDE code wist de teller (`goedePoging`), zodat een klas die na een
     paar typefouten binnenkomt niet met een halfvolle teller verder gaat.

     Het adres komt uit `ipVan()` en niet uit een kop die de aanroeper zelf
     vult -- zie de uitleg in ./rem.js, waar die fout een keer echt is gemaakt. */
  const rolVan = new WeakMap();
  /* DE SLEUTEL HOORT NIET IN HET ADRES (B25). Een URL belandt in serverlogs,
     proxylogs en de browsergeschiedenis; een ?token= wordt daarom overal
     geweigerd -- ook buiten productie, zodat geen scherm er stil op kan blijven
     leunen -- en wel VOOR de opzoeking, zodat de weigering niets verraadt. */
  function sleutelInAdres(req, res) {
    if (!req.query || req.query.token === undefined) return false;
    res.set('Cache-Control', 'no-store');
    res.status(400).json({ error: 'De lessleutel hoort niet in het adres.', reden: 'sleutel-in-adres',
      hoe: 'Stuur hem in de kop Authorization: Bearer of in het lijf; de live-stroom opent met een stroomticket.' });
    return true;
  }
  function lesVan(req, res) {
    if (sleutelInAdres(req, res)) return null;
    const bak = 'lescode:' + ipVan(req);
    if (teVaak(res, bak)) return null;
    const lesId = String((req.body && req.body.code) || req.params.code || '');
    const les = Object.prototype.hasOwnProperty.call(F().lessen, lesId) ? F().lessen[lesId] : null;
    const w = les ? toegang.vanVerzoek(lesId, req) : { reden: 'onbekend' };
    if (w.reden) {
      misluktePoging(bak, 20, 10);
      if (w.reden === 'onbekend') res.status(404).json({ error: 'Deze les kennen we niet.' });
      else res.status(403).json({ error: w.reden === 'sleutel' ? 'Doe eerst mee met de les.'
        : 'Deze toegang tot de les is verlopen of ingetrokken. Vraag je begeleider om een nieuwe lescode.' });
      return null;
    }
    goedePoging(bak);
    rolVan.set(req, w);
    return les;
  }
  function docentCheck(les, req, res) {
    const w = rolVan.get(req);
    if (!w || w.rol !== 'leraar' || w.lesId !== les.id) { res.status(403).json({ error: 'Alleen de begeleider kan dit doen.' }); return false; }
    return true;
  }
  function leerlingVan(les, req, res) {
    const w = rolVan.get(req);
    const l = w && w.rol === 'leerling' && w.lesId === les.id ? les.leerlingen[w.studentId] : null;
    if (!l) { res.status(403).json({ error: 'Doe eerst mee met de les.' }); return null; }
    return l;
  }
  const rolVanVerzoek = req => rolVan.get(req) || null;
  function lesPubliek(les) {
    return { id: les.id, vak: les.vak, docentNaam: les.docentNaam,
      opgaven: (les.opgaven || []).map(o => ({ id: o.id, tekst: o.tekst, at: o.at })), agenda: les.agenda || [] };
  }
  /* De les- en schriftlaag draaien als submodules op een gedeelde context,
     een keer opgebouwd bij het opstarten; de SSE-administratie (sse/stuur)
     blijft hier en gaat als referentie mee. */
  const octx = { router, F, save, nu, rid, schoon, crypto, anthropic, SYSTEM, DEMO, TIPS,
    teVaak, misluktePoging, goedePoging, ipVan, toegang, ruimOudeLessen, rolVanVerzoek,
    sse, stuur, online, presentie, lesVan, sleutelInAdres, docentCheck, leerlingVan, lesPubliek };
  require('./onderwijs/les')(octx);
  require('./onderwijs/lesbeheer')(octx);
  require('./onderwijs/schrift')(octx);
};
