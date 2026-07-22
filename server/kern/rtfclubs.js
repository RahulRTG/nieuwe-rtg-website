/* Clubs & steden (kern/rtfclubs): de speciale afdeling waarmee de RTFoundation
   met grote, bekende (sport)clubs in elke stad samenwerkt. Het RTF-kantoor
   beheert het clubregister (status: verkend > gesprek > actief), hangt er
   programma's aan (gezonde kantine, huiswerkklas, materiaal voor ieder kind),
   koppelt RTF-teamleden als vast gezicht, en legt afspraken vast. De club
   zelf krijgt een clubcode en daarmee een eigen licht portaal: alleen de
   eigen programma's, afspraken en het gedeelde samenwerkingslog, nooit de
   gegevens van een andere club. Opslag: db.data.rtfClubs. */

const STATUS = ['verkend', 'gesprek', 'actief'];
const PROGRAMMA_IDEEEN = ['Gezonde kantine', 'Huiswerkklas na training', 'Sportmateriaal voor ieder kind',
  'Contributiefonds', 'Trainersopleiding', 'Buurttoernooi', 'Ontbijt voor vroege teams'];

module.exports = ({ db, save, crypto }) => {
  const nu = () => new Date().toISOString();
  const schoon = (t, n) => String(t == null ? '' : t).replace(/[<>]/g, '').trim().slice(0, n || 120);
  const rid = () => crypto.randomBytes(4).toString('hex');
  const TEKENS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const codeMaak = () => 'CLUB-' + Array.from(crypto.randomBytes(6)).map(b => TEKENS[b % TEKENS.length]).join('');

  const C = () => { if (!Array.isArray(db.data.rtfClubs)) db.data.rtfClubs = []; return db.data.rtfClubs; };
  const vind = id => C().find(c => c.id === String(id || ''));
  const vindCode = code => C().find(c => c.code === String(code || '').trim().toUpperCase());

  // wat de club zelf ziet: alleen het eigen dossier, nooit een ander
  const clubBeeld = c => ({ naam: c.naam, stad: c.stad, sport: c.sport, status: c.status,
    team: c.team || [], programmas: c.programmas || [], afspraken: c.afspraken || [], log: (c.log || []).slice(0, 40) });
  const kantoorBeeld = c => Object.assign({ id: c.id, code: c.code, contact: c.contact, at: c.at }, clubBeeld(c));

  function overzicht() {
    const perStad = {};
    for (const c of C()) { (perStad[c.stad] = perStad[c.stad] || []).push(kantoorBeeld(c)); }
    return { ok: true, totaal: C().length, statussen: STATUS, ideeen: PROGRAMMA_IDEEEN,
      steden: Object.keys(perStad).sort().map(stad => ({ stad, clubs: perStad[stad] })) };
  }
  function clubMaak(b) {
    b = b || {};
    const naam = schoon(b.naam, 80), stad = schoon(b.stad, 60), sport = schoon(b.sport, 40);
    if (naam.length < 2) return { status: 400, error: 'Hoe heet de club?' };
    if (stad.length < 2) return { status: 400, error: 'In welke stad speelt de club?' };
    if (C().length >= 5000) return { status: 400, error: 'Het clubregister zit vol.' };
    const c = { id: rid(), code: codeMaak(), naam, stad, sport: sport || 'sport', contact: schoon(b.contact, 80),
      status: 'verkend', team: [], programmas: [], afspraken: [], log: [], at: nu() };
    C().unshift(c); save();
    return { ok: true, club: kantoorBeeld(c) };
  }
  function clubZet(id, b) {
    const c = vind(id); if (!c) return { status: 404, error: 'Deze club staat niet in het register.' };
    b = b || {};
    if (b.status !== undefined) {
      if (!STATUS.includes(b.status)) return { status: 400, error: 'Kies een geldige status (' + STATUS.join(', ') + ').' };
      c.status = b.status;
      c.log.unshift({ id: rid(), wie: 'rtf', naam: 'RTF-kantoor', tekst: 'De samenwerking staat nu op "' + b.status + '".', at: nu() });
    }
    if (b.contact !== undefined) c.contact = schoon(b.contact, 80);
    save();
    return { ok: true, club: kantoorBeeld(c) };
  }
  function teamZet(id, namen) {
    const c = vind(id); if (!c) return { status: 404, error: 'Deze club staat niet in het register.' };
    c.team = (Array.isArray(namen) ? namen : []).map(n => schoon(n, 60)).filter(Boolean).slice(0, 10);
    save();
    return { ok: true, club: kantoorBeeld(c) };
  }
  function programmaMaak(id, naam, doel) {
    const c = vind(id); if (!c) return { status: 404, error: 'Deze club staat niet in het register.' };
    const n = schoon(naam, 80); if (n.length < 2) return { status: 400, error: 'Geef het programma een naam.' };
    if ((c.programmas || []).length >= 30) return { status: 400, error: 'Deze club heeft al dertig programma\'s.' };
    c.programmas.unshift({ id: rid(), naam: n, doel: schoon(doel, 200), af: false, at: nu() });
    save();
    return { ok: true, club: kantoorBeeld(c) };
  }
  function programmaZet(id, pid, af) {
    const c = vind(id); if (!c) return { status: 404, error: 'Deze club staat niet in het register.' };
    const p = (c.programmas || []).find(x => x.id === String(pid || ''));
    if (!p) return { status: 404, error: 'Dit programma staat er niet meer.' };
    p.af = af === true; save();
    return { ok: true, club: kantoorBeeld(c) };
  }
  function afspraakMaak(id, tekst) {
    const c = vind(id); if (!c) return { status: 404, error: 'Deze club staat niet in het register.' };
    const t = schoon(tekst, 200); if (!t) return { status: 400, error: 'Wat spreken jullie af?' };
    c.afspraken.unshift({ id: rid(), tekst: t, af: false, at: nu() });
    if (c.afspraken.length > 60) c.afspraken.pop();
    save();
    return { ok: true, club: kantoorBeeld(c) };
  }
  function afspraakZet(id, aid, af) {
    const c = vind(id); if (!c) return { status: 404, error: 'Deze club staat niet in het register.' };
    const a = (c.afspraken || []).find(x => x.id === String(aid || ''));
    if (!a) return { status: 404, error: 'Deze afspraak staat er niet meer.' };
    a.af = af === true; save();
    return { ok: true, club: kantoorBeeld(c) };
  }
  // het samenwerkingslog: beide kanten schrijven in hetzelfde boek
  function logSchrijf(c, wie, naam, tekst) {
    const t = schoon(tekst, 300); if (!t) return { status: 400, error: 'Een leeg bericht heeft geen zin.' };
    c.log.unshift({ id: rid(), wie, naam: schoon(naam, 60) || (wie === 'club' ? 'de club' : 'RTF-kantoor'), tekst: t, at: nu() });
    if (c.log.length > 200) c.log.pop();
    save();
    return { ok: true };
  }
  function berichtRtf(id, naam, tekst) {
    const c = vind(id); if (!c) return { status: 404, error: 'Deze club staat niet in het register.' };
    const r = logSchrijf(c, 'rtf', naam, tekst);
    return r.ok ? { ok: true, club: kantoorBeeld(c) } : r;
  }

  /* ---- de clubkant: het portaal op clubcode, alleen het eigen dossier ---- */
  function portaal(code) {
    const c = vindCode(code);
    if (!c) return { status: 404, error: 'Deze clubcode kennen we niet. Vraag het RTF-kantoor om de code.' };
    return { ok: true, club: clubBeeld(c) };
  }
  function berichtClub(code, naam, tekst) {
    const c = vindCode(code);
    if (!c) return { status: 404, error: 'Deze clubcode kennen we niet. Vraag het RTF-kantoor om de code.' };
    const r = logSchrijf(c, 'club', naam, tekst);
    return r.ok ? { ok: true, club: clubBeeld(c) } : r;
  }

  return { rtfclubs: { overzicht, clubMaak, clubZet, teamZet, programmaMaak, programmaZet,
    afspraakMaak, afspraakZet, berichtRtf, portaal, berichtClub, STATUS } };
};
