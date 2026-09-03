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
  const { router, F, save, nu, rid, schoon, crypto, anthropic, LETTERS, SYSTEM, DEMO, TIPS,
    teVaak, misluktePoging, goedePoging, ipVan } = ctx;

  /* DE LESCODE IS DE GELOOFSBRIEF VAN EEN LES, en dus telt zijn sterkte.

     Wie de code heeft, ziet de leerlingnamen, de schriften en het bord
     (`/les/:code`, `/bord/:code`, `/schrift/:code`). Dat is een bewuste keuze --
     een leerling zonder RTG-account moet kunnen meedoen -- maar dan hoort de
     code wel te dragen wat er aan hangt.

     ZES TEKENS WAS 29,7 BITS. `LETTERS` telt 31 tekens (de leesbare, zonder I,
     L, O en 0/1), dus 31^6 = 887.503.681. Met acht tekens is dat
     31^8 = 852.891.037.441, ongeveer 39,6 bits -- tienduizend keer zo veel werk
     voor wie raadt. `crypto.randomInt` was al goed en blijft.

     OUDE CODES BLIJVEN GELDIG. Dit verandert alleen wat er NIEUW wordt
     uitgedeeld; `lesVan()` zoekt op de sleutel en trekt zich van de lengte
     niets aan. Een klas die vanochtend een zescijferige code kreeg, kan gewoon
     doorwerken.

     EN LENGTE ALLEEN IS NIET DE REPARATIE. Zonder rem is ook 39,6 bits te
     bestoken; de rem staat in `lesVan()` hieronder. Entropie maakt raden duur,
     een rem maakt het traag, en je hebt ze allebei nodig. */
  const CODELENGTE = 8;
  function nieuweCode() {
    let c;
    do { c = Array.from({ length: CODELENGTE }, () => LETTERS[crypto.randomInt(LETTERS.length)]).join(''); }
    while (F().lessen[c]);
    return c;
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
    const lijst = Object.values(les.leerlingen).map(l => ({
      studentId: l.studentId, naam: l.naam, online: on.leerlingen.includes(l.studentId),
      ingeleverd: (les.opgaven || []).filter(o => (o.inzendingen || {})[l.studentId]).length
    }));
    stuur(code, 'presentie', { leerlingen: lijst }, c => c.role === 'docent');
  }

  /* ---------- les + rechten ---------- */
  /* DE REM OP HET RADEN VAN EEN LESCODE.

     Deze functie is de enige plek waar een lescode wordt omgezet in een les, en
     dus de enige plek waar een FOUTE code zichtbaar wordt. Precies daar hoort de
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
     2.900 pogingen per dag -- tegen 852 miljard mogelijkheden is dat niets.

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
  function lesVan(req, res) {
    const bak = 'lescode:' + ipVan(req);
    if (teVaak(res, bak)) return null;
    const code = String((req.body && req.body.code) || req.params.code || '').toUpperCase();
    const les = F().lessen[code];
    if (!les) {
      misluktePoging(bak, 20, 10);
      res.status(404).json({ error: 'Deze lescode kennen we niet. Klopt hij?' });
      return null;
    }
    goedePoging(bak);
    return les;
  }
  function docentCheck(les, req, res) {
    const t = ctx.tokenUit(req);
    if (!t || t !== les.teacherToken) { res.status(403).json({ error: 'Alleen de begeleider kan dit doen.' }); return false; }
    return true;
  }
  function leerlingVan(les, req, res) {
    const t = ctx.tokenUit(req);
    const l = Object.values(les.leerlingen).find(x => x.token === t);
    if (!l) { res.status(403).json({ error: 'Doe eerst mee met de les.' }); return null; }
    return l;
  }
  function lesPubliek(les) {
    return { code: les.code, vak: les.vak, docentNaam: les.docentNaam,
      opgaven: (les.opgaven || []).map(o => ({ id: o.id, tekst: o.tekst, at: o.at })), agenda: les.agenda || [] };
  }
  /* De les- en schriftlaag draaien als submodules op een gedeelde context,
     een keer opgebouwd bij het opstarten; de SSE-administratie (sse/stuur)
     blijft hier en gaat als referentie mee. */
  const octx = { router, F, save, nu, rid, schoon, crypto, anthropic, LETTERS, SYSTEM, DEMO, TIPS,
    teVaak, misluktePoging, ipVan,
    nieuweCode, sse, stuur, online, presentie, lesVan, docentCheck, leerlingVan, lesPubliek };
  require('./onderwijs/les')(octx);
  require('./onderwijs/schrift')(octx);
};
