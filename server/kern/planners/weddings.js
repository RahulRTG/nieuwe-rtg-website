/* Weddings en prive-events: draaiboeken over de keten heen (locatie,
   catering, vervoer, styling); een dag is pas gedraaid als alle taken
   klaar zijn. Opslag in db.data.weddings[code]. */

const { MAX_LIJST, DATUM, maakHulp } = require('../genrehulp');
const WED_SOORTEN = ['bruiloft', 'prive-event'];
const KETEN = ['Chef Fuego (catering)', 'Festa Ibiza Events (productie)', 'Ibiza Executive Cars (vervoer)',
  'Velvet & Blade (styling)', 'Serena Spa (bruidsarrangement)', 'Galeria Lienzo (locatiekunst)'];

module.exports = ({ db, save, crypto, schoon }) => {
  const { nu, id, cap, bak } = maakHulp({ db, save, crypto });

  function demoWeddings() {
    const over30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    return {
      naam: 'Aurelia Weddings & Events',
      locaties: ['Finca Vella', 'Cala Blanca (strand)', 'Dalt Vila (terras)'],
      keten: KETEN,
      events: [
        { id: 'e1', klant: 'Sophie & Milan', soort: 'bruiloft', datum: over30, locatie: 'Finca Vella',
          gasten: 80, budget: 45000, status: 'intake', gemaakt: nu(),
          taken: [
            { id: 't1', tekst: 'Proeverij menu, drie gangen.', partner: 'Chef Fuego (catering)', status: 'open' },
            { id: 't2', tekst: 'Pendel voor tachtig gasten.', partner: 'Ibiza Executive Cars (vervoer)', status: 'open' }
          ] }
      ]
    };
  }
  const wedVan = bak('weddings', demoWeddings);

  function wedOverzicht(code) {
    const w = wedVan(code);
    return {
      naam: w.naam, locaties: w.locaties, keten: w.keten,
      events: w.events.slice(0, 30),
      kpi: {
        events: w.events.length,
        gepland: w.events.filter(e => e.status === 'gepland').length,
        takenOpen: w.events.reduce((s, e) => s + e.taken.filter(t => t.status === 'open').length, 0),
        gedraaid: w.events.filter(e => e.status === 'gedraaid').length
      }
    };
  }
  function eventMaak(code, b) {
    const w = wedVan(code);
    const klant = schoon(b.klant, 60);
    const soort = WED_SOORTEN.includes(b.soort) ? b.soort : null;
    const datum = String(b.datum || '').slice(0, 10);
    const locatie = w.locaties.includes(b.locatie) ? b.locatie : null;
    const gasten = Math.round(Number(b.gasten));
    if (!klant) return { status: 400, error: 'Voor wie is de dag?' };
    if (!soort) return { status: 400, error: 'Kies bruiloft of prive-event.' };
    if (!DATUM.test(datum)) return { status: 400, error: 'Kies een datum.' };
    if (!locatie) return { status: 400, error: 'Kies een van onze locaties.' };
    if (!(gasten >= 2 && gasten <= 1000)) return { status: 400, error: 'Hoeveel gasten (2 tot 1000)?' };
    const bezet = w.events.find(e => e.locatie === locatie && e.datum === datum && e.status !== 'gedraaid');
    if (bezet) return { status: 409, error: locatie + ' is die dag al van ' + bezet.klant + '.' };
    const budget = Math.round(Number(b.budget)) || 0;
    const e = { id: id('e'), klant, soort, datum, locatie, gasten, budget, status: 'intake', taken: [], gemaakt: nu() };
    w.events.unshift(e); cap(w.events, MAX_LIJST); save();
    return { ok: true, event: e };
  }
  function taakMaak(code, b) {
    const w = wedVan(code);
    const e = w.events.find(x => x.id === String(b.eventId || ''));
    if (!e) return { status: 404, error: 'Dit draaiboek bestaat niet.' };
    const tekst = schoon(b.tekst, 160);
    if (!tekst) return { status: 400, error: 'Wat moet er geregeld worden?' };
    const partner = w.keten.includes(b.partner) ? b.partner : schoon(b.partner, 60) || 'eigen team';
    const t = { id: id('t'), tekst, partner, status: 'open' };
    e.taken.push(t); cap(e.taken, 60); save();
    return { ok: true, taak: t, event: e };
  }
  function taakKlaar(code, eventId, taakId) {
    const w = wedVan(code);
    const e = w.events.find(x => x.id === String(eventId || ''));
    if (!e) return { status: 404, error: 'Dit draaiboek bestaat niet.' };
    const t = e.taken.find(x => x.id === String(taakId || ''));
    if (!t) return { status: 404, error: 'Taak niet gevonden.' };
    t.status = 'klaar'; save();
    return { ok: true, event: e };
  }
  function eventStatus(code, eventId, statusWens) {
    const w = wedVan(code);
    const e = w.events.find(x => x.id === String(eventId || ''));
    if (!e) return { status: 404, error: 'Dit draaiboek bestaat niet.' };
    if (statusWens === 'gepland') e.status = 'gepland';
    else if (statusWens === 'gedraaid') {
      const open = e.taken.filter(t => t.status === 'open').length;
      if (open) return { status: 409, error: 'Nog ' + open + ' taken open; een dag is pas gedraaid als alles klaar is.' };
      e.status = 'gedraaid';
    } else return { status: 400, error: 'Kies gepland of gedraaid.' };
    save(); return { ok: true, event: e };
  }

  return { weddings: { overzicht: wedOverzicht, eventMaak, taakMaak, taakKlaar, eventStatus } };
};
