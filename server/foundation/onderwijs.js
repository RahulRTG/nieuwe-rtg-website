/* RTFoundation-onderwijs: het gratis, open onderwijs voor elk gezin. Een live
   digitaal schoolbord voor de docent/begeleider en een eigen "schrift" voor elke
   leerling (schrijven, tekenen, typen, bordfoto's, opgaven, agenda) met een
   AI-bijleshulp, plus de reis-aanvraag/voordracht. Geen lidmaatschap of betaling
   nodig: je doet mee met een lescode. Gemount vanuit foundation.js op de
   gedeelde context (foundation/basis.js). */
module.exports = (ctx) => {
  const { router, F, save, nu, rid, schoon, crypto, anthropic, LETTERS, SYSTEM, DEMO, TIPS } = ctx;

  function nieuweCode() {
    let c; do { c = Array.from({ length: 6 }, () => LETTERS[crypto.randomInt(LETTERS.length)]).join(''); } while (F().lessen[c]);
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
  function lesVan(req, res) {
    const code = String((req.body && req.body.code) || req.params.code || '').toUpperCase();
    const les = F().lessen[code];
    if (!les) { res.status(404).json({ error: 'Deze lescode kennen we niet. Klopt hij?' }); return null; }
    return les;
  }
  function docentCheck(les, req, res) {
    const t = (req.body && req.body.token) || req.query.token;
    if (!t || t !== les.teacherToken) { res.status(403).json({ error: 'Alleen de begeleider kan dit doen.' }); return false; }
    return true;
  }
  function leerlingVan(les, req, res) {
    const t = (req.body && req.body.token) || req.query.token;
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
    nieuweCode, sse, stuur, online, presentie, lesVan, docentCheck, leerlingVan, lesPubliek };
  require('./onderwijs/les')(octx);
  require('./onderwijs/schrift')(octx);
};
