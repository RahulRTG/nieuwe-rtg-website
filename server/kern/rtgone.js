/* RTG One: het gezamenlijke werkgeheugen voor RTG en RTF: wat er gebeurt,
   waarom, wie iets beloofde, waar werk schuurt en hoe het terug kan. */
const { nu: klokNu, datum: klokDatum } = require('../lib/klok');
const projectenMaak = require('./rtgone-projecten');
/* Twee delen staan apart, langs twee echte naden: het BESTUUR (wie mag welk
   besluit nemen, de rollen, en de goedkeuringen zelf) in ./rtgone-bestuur.js,
   en VANDAAG (wat er uit andere domeinen op tafel ligt: taken, agenda, mail,
   aanvragen) in ./rtgone-vandaag.js -- een projectie die alleen leest. */
const bestuurMaak = require('./rtgone-bestuur');
const vandaagMaak = require('./rtgone-vandaag');

module.exports = ({ db, save, crypto }) => {
  const nu = klokNu;
  const geldigHuis = h => ['rtg', 'rtf', 'gedeeld'].includes(h) ? h : 'rtg';
  const tekst = (v, n = 240) => String(v || '').replace(/[<>]/g, '').trim().slice(0, n);
  const id = p => p + crypto.randomBytes(5).toString('hex');
  function S() {
    if (!db.data.rtgOne || typeof db.data.rtgOne !== 'object') db.data.rtgOne = {};
    const s = db.data.rtgOne;
    for (const k of ['intenties', 'beloften', 'fricties', 'overdrachten', 'automatiseringen', 'goedkeuringen', 'projecten', 'rollen', 'audit']) if (!Array.isArray(s[k])) s[k] = [];
    return s;
  }
  const vind = (lijst, key) => lijst.find(x => x.id === String(key || ''));
  function log(actor, actie, object, huis) {
    const s = S(); s.audit.unshift({ id: id('log-'), at: nu(), actor: tekst(actor, 80) || 'kantoor', actie, object, huis: geldigHuis(huis) });
    if (s.audit.length > 500) s.audit.length = 500;
  }
  const { ROLLEN, BESLUITTYPEN, rollenVoor, rechtenVoor, goedkeuringMaak, goedkeuringBeslis, rolGeef, rolTrek } =
    bestuurMaak({ S, save, id, tekst, geldigHuis, vind, log, nu });
  const { liveVandaag, rtmailBerichten } = vandaagMaak({ data: () => db.data });
  function state(huisRuw, context) {
    const huis = geldigHuis(huisRuw), s = S(), inHuis = x => x.huis === huis || x.huis === 'gedeeld';
    const fr = s.fricties.filter(inHuis), jaarCenten = fr.reduce((n, f) => n + f.jaarCenten, 0);
    return { ok: true, huis,
      stats: { beloftenOpen: s.beloften.filter(x => inHuis(x) && x.status === 'open').length,
        intentiesActief: s.intenties.filter(x => inHuis(x) && x.status === 'actief').length,
        frictieUren: Math.round(fr.reduce((n, f) => n + f.jaarMinuten, 0) / 60), frictieEuro: Math.round(jaarCenten / 100),
        overdrachten: s.overdrachten.filter(inHuis).length },
      intenties: s.intenties.filter(inHuis).slice(0, 60), beloften: s.beloften.filter(inHuis).slice(0, 80),
      fricties: fr.slice(0, 60), overdrachten: s.overdrachten.filter(inHuis).slice(0, 30),
      automatiseringen: s.automatiseringen.filter(inHuis).slice(0, 30), goedkeuringen: s.goedkeuringen.filter(inHuis).slice(0, 80), projecten: s.projecten.filter(inHuis).slice(0, 80),
      rollen: (context && context.baas) ? s.rollen.filter(inHuis).slice(0, 100) : [], audit: s.audit.filter(inHuis).slice(0, 40),
      governance: { rollen: rollenVoor(context && context.key, huis), rechten: rechtenVoor(context || {}, huis), baas: !!(context && context.baas), identiteit: context && context.label || null, catalogus: ROLLEN },
      vandaag: liveVandaag(huis, context || {}) };
  }
  function intentieMaak(body, actor) {
    const s = S(), waarom = tekst(body.waarom, 500), titel = tekst(body.titel, 120);
    if (!titel || !waarom) return { status: 400, error: 'Titel en bedoeling zijn verplicht.' };
    const x = { id: id('int-'), huis: geldigHuis(body.huis), titel, waarom, voorWie: tekst(body.voorWie, 160),
      bewijs: tekst(body.bewijs, 240), herzieOp: tekst(body.herzieOp, 10), status: 'actief', door: tekst(actor, 80), at: nu() };
    s.intenties.unshift(x); log(actor, 'intentie-gemaakt', x.id, x.huis); save(); return { ok: true, intentie: x };
  }
  function belofteMaak(body, actor) {
    const s = S(), belofte = tekst(body.belofte, 300); if (!belofte) return { status: 400, error: 'Welke belofte is gedaan?' };
    const x = { id: id('bel-'), huis: geldigHuis(body.huis), belofte, aan: tekst(body.aan, 100), eigenaar: tekst(body.eigenaar, 100) || tekst(actor, 80),
      deadline: tekst(body.deadline, 16), intentieId: tekst(body.intentieId, 40), status: 'open', at: nu() };
    s.beloften.unshift(x); log(actor, 'belofte-vastgelegd', x.id, x.huis); save(); return { ok: true, belofte: x };
  }
  function frictieMaak(body, actor) {
    const s = S(), naam = tekst(body.naam, 140), minuten = Math.max(1, Math.min(480, Number(body.minuten) || 0)),
      frequentie = Math.max(1, Math.min(1000, Number(body.frequentie) || 0)), uurloon = Math.max(0, Math.min(1000, Number(body.uurloon) || 0));
    if (!naam) return { status: 400, error: 'Beschrijf de onnodige handeling.' };
    const jaarMinuten = Math.round(minuten * frequentie * 52), jaarCenten = Math.round(jaarMinuten / 60 * uurloon * 100);
    const x = { id: id('fri-'), huis: geldigHuis(body.huis), naam, minuten, frequentie, uurloon, jaarMinuten, jaarCenten, door: tekst(actor, 80), at: nu() };
    s.fricties.unshift(x); log(actor, 'frictie-berekend', x.id, x.huis); save(); return { ok: true, frictie: x };
  }
  function overdrachtMaak(body, actor) {
    const s = S(), huis = geldigHuis(body.huis), eigenaar = tekst(body.eigenaar, 100), naar = tekst(body.naar, 100);
    if (!eigenaar || !naar) return { status: 400, error: 'Van wie en voor wie is de overdracht?' };
    const open = s.beloften.filter(x => (x.huis === huis || x.huis === 'gedeeld') && x.status === 'open' && (!body.eigenaar || x.eigenaar.toLowerCase().includes(eigenaar.toLowerCase()))).slice(0, 20);
    const x = { id: id('ovr-'), huis, eigenaar, naar, geldigTot: tekst(body.geldigTot, 16), context: tekst(body.context, 600),
      beloften: open.map(b => ({ id: b.id, belofte: b.belofte, deadline: b.deadline })), status: 'actief', door: tekst(actor, 80), at: nu() };
    s.overdrachten.unshift(x); log(actor, 'overdracht-gemaakt', x.id, huis); save(); return { ok: true, overdracht: x };
  }
  function automatiseringVoorbereid(body, actor) {
    const s = S(), huis = geldigHuis(body.huis), doel = vind(s.beloften, body.belofteId);
    if (!doel || !(doel.huis === huis || doel.huis === 'gedeeld')) return { status: 404, error: 'Belofte niet gevonden.' };
    if (doel.status !== 'open') return { status: 400, error: 'Alleen een open belofte kan veilig worden afgerond.' };
    const x = { id: id('aut-'), huis, soort: 'belofte-afronden', objectId: doel.id, status: 'voorbereid',
      voor: { status: doel.status }, na: { status: 'afgerond' }, herstelTot: nu() + 72 * 3600000, door: tekst(actor, 80), at: nu() };
    s.automatiseringen.unshift(x); log(actor, 'automatisering-voorbereid', x.id, huis); save(); return { ok: true, automatisering: x };
  }
  function automatiseringVoer(idRuw, actor) {
    const s = S(), a = vind(s.automatiseringen, idRuw); if (!a) return { status: 404, error: 'Automatisering niet gevonden.' };
    if (a.status !== 'voorbereid') return { status: 400, error: 'Deze automatisering kan niet worden uitgevoerd.' };
    const doel = vind(s.beloften, a.objectId); if (!doel) return { status: 404, error: 'Doel bestaat niet meer.' };
    doel.status = a.na.status; doel.afgerondAt = nu(); a.status = 'uitgevoerd'; a.uitgevoerdAt = nu();
    log(actor, 'automatisering-uitgevoerd', a.id, a.huis); save(); return { ok: true, automatisering: a, belofte: doel };
  }
  function automatiseringHerstel(idRuw, actor) {
    const s = S(), a = vind(s.automatiseringen, idRuw); if (!a) return { status: 404, error: 'Automatisering niet gevonden.' };
    if (a.status !== 'uitgevoerd' || nu() > a.herstelTot) return { status: 400, error: 'Deze wijziging kan niet meer worden teruggedraaid.' };
    const doel = vind(s.beloften, a.objectId); if (!doel) return { status: 404, error: 'Doel bestaat niet meer.' };
    doel.status = a.voor.status; delete doel.afgerondAt; a.status = 'teruggedraaid'; a.terugAt = nu();
    log(actor, 'automatisering-teruggedraaid', a.id, a.huis); save(); return { ok: true, automatisering: a, belofte: doel };
  }
  const { projectVanMail, projectTaakZet, projectBewijs, projectOplever } = projectenMaak({
    rtmailBerichten,
    save, S, id, geldigHuis, tekst, vind, log, nu, klokDatum, besluittypen: BESLUITTYPEN, goedkeuringMaak
  });
  return { rtgone: { state, intentieMaak, belofteMaak, frictieMaak, overdrachtMaak, automatiseringVoorbereid, automatiseringVoer, automatiseringHerstel,
    goedkeuringMaak, goedkeuringBeslis, rolGeef, rolTrek, projectVanMail, projectTaakZet, projectBewijs, projectOplever, ROLLEN } };
};
