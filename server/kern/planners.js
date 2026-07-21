/* RTG Planners & Advies: drie genres waar de mens het laatste woord houdt.
   Weddings en prive-events (draaiboeken over de keten heen: locatie,
   catering, vervoer, styling; een dag is pas gedraaid als alle taken
   klaar zijn), professionele diensten (advocaat, notaris en fiscalist
   als boekbare partner met dossiers en een agenda per adviseur; de AI
   plant alleen en adviseert nooit inhoudelijk) en verzekeringen
   (uitsluitend adviserend: reis, annulering en pleziervaart; hier wordt
   nooit een polis afgesloten, de klant beslist zelf na menselijk advies).
   Opslag in db.data.weddings[code], db.data.advies[code], db.data.polis[code]. */

const MAX_LIJST = 200;
const TIJD = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATUM = /^\d{4}-\d{2}-\d{2}$/;

module.exports = ({ db, save, crypto, schoon }) => {
  const nu = () => new Date().toISOString();
  const id = p => p + crypto.randomBytes(3).toString('hex');
  const cap = (lijst, max) => { if (lijst.length > max) lijst.length = max; };
  const bak = (naam, maker) => (code) => {
    if (!db.data[naam]) db.data[naam] = {};
    if (!db.data[naam][code]) { db.data[naam][code] = maker(); save(); }
    return db.data[naam][code];
  };

  /* ---- weddings en prive-events: het draaiboek over de keten ---- */
  const WED_SOORTEN = ['bruiloft', 'prive-event'];
  const KETEN = ['Chef Fuego (catering)', 'Festa Ibiza Events (productie)', 'Ibiza Executive Cars (vervoer)',
    'Velvet & Blade (styling)', 'Serena Spa (bruidsarrangement)', 'Galeria Lienzo (locatiekunst)'];
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

  /* ---- professionele diensten: advocaat, notaris, fiscalist ---- */
  function demoPraktijk() {
    return {
      naam: 'LexNova Advocaten & Notarissen',
      adviseurs: [
        { id: 'a1', naam: 'Mr. Ilse Verbeek', vak: 'advocaat', uurtarief: 285 },
        { id: 'a2', naam: 'Mr. Joan Ferrer', vak: 'notaris', uurtarief: 240 },
        { id: 'a3', naam: 'Drs. Karim El Amrani', vak: 'fiscalist', uurtarief: 210 }
      ],
      dossiers: [], afspraken: [],
      regel: 'De AI plant alleen afspraken en dossiers; inhoudelijk advies komt altijd van de adviseur zelf.'
    };
  }
  const advVan = bak('advies', demoPraktijk);

  function advOverzicht(code) {
    const a = advVan(code);
    return {
      naam: a.naam, adviseurs: a.adviseurs, regel: a.regel,
      dossiers: a.dossiers.slice(0, 30), afspraken: a.afspraken.slice(0, 30),
      kpi: {
        dossiers: a.dossiers.length,
        lopend: a.dossiers.filter(d => d.status === 'lopend').length,
        afspraken: a.afspraken.length
      }
    };
  }
  function dossierMaak(code, b) {
    const a = advVan(code);
    const klant = schoon(b.klant, 60), omschrijving = schoon(b.omschrijving, 160);
    const vak = ['advocaat', 'notaris', 'fiscalist'].includes(b.vak) ? b.vak : null;
    if (!klant || !omschrijving) return { status: 400, error: 'Voor wie is het dossier, en waar gaat het over?' };
    if (!vak) return { status: 400, error: 'Kies advocaat, notaris of fiscalist.' };
    const d = { id: 'D-' + crypto.randomBytes(2).toString('hex').toUpperCase(), klant, vak, omschrijving, status: 'intake', gemaakt: nu() };
    a.dossiers.unshift(d); cap(a.dossiers, MAX_LIJST); save();
    return { ok: true, dossier: d };
  }
  function dossierStatus(code, dId, statusWens) {
    const a = advVan(code);
    const d = a.dossiers.find(x => x.id === String(dId || ''));
    if (!d) return { status: 404, error: 'Dossier niet gevonden.' };
    if (!['lopend', 'afgerond'].includes(statusWens)) return { status: 400, error: 'Kies lopend of afgerond.' };
    d.status = statusWens; save();
    return { ok: true, dossier: d };
  }
  function afspraakBoek(code, b) {
    const a = advVan(code);
    const adviseur = a.adviseurs.find(x => x.id === String(b.adviseurId || ''));
    if (!adviseur) return { status: 404, error: 'Deze adviseur werkt hier niet.' };
    const dossier = a.dossiers.find(x => x.id === String(b.dossierId || ''));
    if (!dossier) return { status: 404, error: 'Koppel de afspraak aan een dossier.' };
    const datum = String(b.datum || '').slice(0, 10), tijd = String(b.tijd || '');
    if (!DATUM.test(datum) || !TIJD.test(tijd)) return { status: 400, error: 'Kies een datum en tijd.' };
    const bezet = a.afspraken.find(x => x.adviseurId === adviseur.id && x.datum === datum && x.tijd === tijd);
    if (bezet) return { status: 409, error: adviseur.naam + ' zit dan al met een client.' };
    const f = { id: id('f'), adviseurId: adviseur.id, adviseur: adviseur.naam, vak: adviseur.vak,
      dossier: dossier.id, klant: dossier.klant, datum, tijd, uurtarief: adviseur.uurtarief, gemaakt: nu() };
    a.afspraken.unshift(f); cap(a.afspraken, MAX_LIJST); save();
    if (dossier.status === 'intake') dossier.status = 'lopend';
    save();
    return { ok: true, afspraak: f };
  }

  /* ---- verzekeringen: uitsluitend adviserend, de klant beslist zelf ---- */
  function demoPolis() {
    return {
      naam: 'Segur Advies',
      producten: [
        { id: 'p1', naam: 'Reisverzekering', indicatie: 'indicatie vanaf 12 per maand' },
        { id: 'p2', naam: 'Annuleringsdekking', indicatie: 'indicatie 5 procent van de reissom' },
        { id: 'p3', naam: 'Jacht en pleziervaart', indicatie: 'indicatie op aanvraag' }
      ],
      aanvragen: [],
      regel: 'Wij adviseren alleen. Een polis sluit u altijd zelf af bij de verzekeraar, na het advies van een mens; hier wordt nooit iets automatisch afgesloten.'
    };
  }
  const polVan = bak('polis', demoPolis);

  function polOverzicht(code) {
    const p = polVan(code);
    return {
      naam: p.naam, producten: p.producten, regel: p.regel,
      aanvragen: p.aanvragen.slice(0, 30),
      kpi: {
        open: p.aanvragen.filter(x => x.status === 'aangevraagd').length,
        geadviseerd: p.aanvragen.filter(x => x.status === 'advies-klaar').length,
        doorverwezen: p.aanvragen.filter(x => x.status === 'doorverwezen').length
      }
    };
  }
  function adviesVraag(code, b) {
    const p = polVan(code);
    const product = p.producten.find(x => x.id === String(b.productId || ''));
    const klant = schoon(b.klant, 60), situatie = schoon(b.situatie, 200);
    if (!product) return { status: 404, error: 'Kies een van onze adviesproducten.' };
    if (!klant || !situatie) return { status: 400, error: 'Voor wie is het advies, en wat is de situatie?' };
    const a = { id: id('v'), klant, product: product.naam, situatie, advies: '', status: 'aangevraagd', gemaakt: nu() };
    p.aanvragen.unshift(a); cap(p.aanvragen, MAX_LIJST); save();
    return { ok: true, aanvraag: a };
  }
  function adviesZet(code, b) {
    const p = polVan(code);
    const a = p.aanvragen.find(x => x.id === String(b.id || ''));
    if (!a) return { status: 404, error: 'Aanvraag niet gevonden.' };
    if (b.status === 'advies-klaar') {
      const advies = schoon(b.advies, 240);
      if (!advies) return { status: 400, error: 'Schrijf het advies; dat komt van een mens, niet van het systeem.' };
      a.advies = advies; a.status = 'advies-klaar';
    } else if (b.status === 'doorverwezen') {
      if (a.status !== 'advies-klaar') return { status: 409, error: 'Eerst het advies, dan pas de doorverwijzing.' };
      a.status = 'doorverwezen';
    } else return { status: 400, error: 'Hier wordt niets afgesloten; kies advies-klaar of doorverwezen.' };
    save(); return { ok: true, aanvraag: a };
  }

  return {
    weddings: { overzicht: wedOverzicht, eventMaak, taakMaak, taakKlaar, eventStatus },
    advies: { overzicht: advOverzicht, dossierMaak, dossierStatus, afspraakBoek },
    polis: { overzicht: polOverzicht, adviesVraag, adviesZet }
  };
};
