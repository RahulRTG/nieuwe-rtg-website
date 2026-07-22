/* Het RTF-kantoor (kern/rtfkantoor): het eigen kantoor van de RTFoundation,
   gebouwd als een een-op-een spiegel van de RTG-kantoorstructuur: dezelfde
   kamer-ids en dezelfde vorm (kamers, kamer, taken per kamer, een overzicht
   dat alles in een oogopslag toont), maar met de invulling van de stichting.
   Het kamerregister zelf staat in ./rtfkantoor-data.js; de clubs-samenwerking
   in ./rtfclubs.js en het lab in ./onderzoekslab.js vullen twee eigen kamers.
   Opslag: db.data.rtfKantoorTaken (taken per kamer). */
module.exports = ({ db, save, crypto }) => {
  const nu = () => Date.now();
  const d = () => db.data;
  const lijst = x => Array.isArray(x) ? x : (x && typeof x === 'object' ? Object.values(x) : []);
  const tel = x => lijst(x).length;
  const recent = (x, veld, dagen) => lijst(x).filter(i => i && i[veld] && (nu() - new Date(i[veld]).getTime()) < dagen * 86400000).length;

  const AFDELINGEN = require('./rtfkantoor-data')({ d, lijst, tel, recent });
  const KAMER_IDS = Object.keys(AFDELINGEN);

  function taken(afd) {
    if (!d().rtfKantoorTaken) d().rtfKantoorTaken = {};
    if (!Array.isArray(d().rtfKantoorTaken[afd])) d().rtfKantoorTaken[afd] = [];
    return d().rtfKantoorTaken[afd];
  }
  function taakMaak(afd, tekst) {
    if (!AFDELINGEN[afd]) return { status: 404, error: 'Deze kamer bestaat niet.' };
    const t = String(tekst || '').replace(/[<>]/g, '').trim().slice(0, 200);
    if (!t) return { status: 400, error: 'Wat moet er gebeuren?' };
    const rij = taken(afd);
    rij.unshift({ id: crypto.randomBytes(4).toString('hex'), tekst: t, af: false, at: nu() });
    if (rij.length > 100) rij.pop();
    save();
    return { ok: true, taken: rij.slice(0, 30) };
  }
  function taakZet(afd, id, af) {
    const t = taken(afd).find(x => x.id === id);
    if (!t) return { status: 404, error: 'Deze taak staat er niet meer.' };
    t.af = af === true;
    save();
    return { ok: true };
  }

  function kamer(id) {
    const a = AFDELINGEN[id];
    if (!a) return { status: 404, error: 'Deze kamer bestaat niet.' };
    return {
      ok: true, id, naam: a.naam, emoji: a.emoji, missie: a.missie,
      kpis: a.kpis().map(([label, waarde]) => ({ label, waarde })),
      lijsten: a.lijsten(), taken: taken(id).slice(0, 30)
    };
  }
  function kamers() {
    return { ok: true, kamers: KAMER_IDS.map(id => {
      const a = AFDELINGEN[id];
      return { id, naam: a.naam, emoji: a.emoji, missie: a.missie, kpi: a.kpis()[0], takenOpen: taken(id).filter(t => !t.af).length };
    }) };
  }

  /* Het overzicht: het RTF-huis in een oogopslag, met de rode draden die de
     stichting dragen: de 30%-stroom, de clubs en het lab. */
  function overzicht() {
    const clubs = lijst(d().rtfClubs);
    const lab = lijst(d().labProjecten);
    const afdr = lijst(d().fondsAfdrachten);
    return { ok: true,
      kamers: KAMER_IDS.length,
      takenOpen: KAMER_IDS.reduce((s, id) => s + taken(id).filter(t => !t.af).length, 0),
      afdrachten: afdr.length,
      opgehaald: Math.round(afdr.reduce((s, a) => s + (Number(a.bedrag) || 0), 0) / 100),
      clubs: { totaal: clubs.length, actief: clubs.filter(c => c.status === 'actief').length, steden: new Set(clubs.map(c => c.stad)).size },
      lab: { projecten: lab.length, inProef: lab.filter(p => p.fase === 'proef' || p.fase === 'uitrol').length, toetsOpen: lab.filter(p => (p.veiligheid || {}).status === 'open').length } };
  }

  return { rtfkantoor: { kamers, kamer, taakMaak, taakZet, overzicht, KAMER_IDS } };
};
