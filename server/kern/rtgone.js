/* RTG One: het gezamenlijke werkgeheugen voor RTG en RTF. De module bewaart
   niet alleen WAT er gebeurt, maar ook waarom, wie iets beloofde, waar werk
   schuurt en hoe een automatisering veilig kan worden teruggedraaid. */
module.exports = ({ db, save, crypto }) => {
  const ROLLEN = {
    executive: { naam: 'Executive', rechten: ['besluit:*', 'rollen:beheer', 'audit:lees'] },
    finance: { naam: 'Finance', rechten: ['besluit:finance'] }, legal: { naam: 'Juridisch', rechten: ['besluit:legal'] },
    privacy: { naam: 'Privacy', rechten: ['besluit:privacy'] }, security: { naam: 'Security', rechten: ['besluit:security'] },
    safeguarding: { naam: 'Safeguarding', rechten: ['besluit:safeguarding'] }, operations: { naam: 'Operations', rechten: ['besluit:operations'] },
    people: { naam: 'People & Culture', rechten: ['besluit:people'] }, ai: { naam: 'AI Governance', rechten: ['besluit:ai'] },
    auditor: { naam: 'Auditor', rechten: ['audit:lees'] }
  };
  const BESLUITTYPEN = ['finance', 'legal', 'privacy', 'security', 'safeguarding', 'operations', 'people', 'ai'];
  const nu = () => Date.now();
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
  function liveVandaag(huis, context) {
    const d = db.data, lijst = x => Array.isArray(x) ? x : [], persoonlijk = !!(context && context.key);
    const huisTaken = lijst((d.werkplekTaken || {})[huis]).filter(t => !t.af).slice(0, 8).map(t => ({ soort: 'taak', titel: t.tekst, at: t.at || null }));
    const rtfTaken = huis === 'rtf' ? Object.values(d.rtfKantoorTaken || {}).flatMap(x => lijst(x)).filter(t => !t.af).slice(0, 8).map(t => ({ soort: 'rtf', titel: t.tekst, at: t.at || null })) : [];
    const agenda = persoonlijk ? lijst((d.agendas || {})[context.key]).filter(x => !x.afgerond && !x.af).slice(0, 8).map(x => ({ soort: 'agenda', titel: x.titel || x.tekst || x.onderwerp || 'Agenda-item', at: x.start || x.at || x.datum || null })) : [];
    const adres = context && context.codename ? String(context.codename).trim().toLowerCase().replace(/[^a-z0-9._-]/g, '') + '@rtmail' : null;
    const mail = adres ? lijst((d.rtmail || {}).berichten).filter(m => m.naar === adres && !m.gearchiveerd).slice(0, 12).map(m => ({ id: m.id, soort: 'rtmail', titel: m.onderwerp, at: m.at, van: m.van, gelezen: !!m.gelezen, preview: String(m.tekst || '').slice(0, 180) })) : [];
    const goedkeuringen = huis === 'rtg'
      ? lijst(d.partnerApplications).filter(x => x.status !== 'afgerond' && x.status !== 'afgewezen').slice(0, 6).map(x => ({ soort: 'goedkeuring', titel: 'Partneraanvraag · ' + (x.naam || x.name || x.bedrijf || 'Nieuwe partner'), at: x.at || null }))
      : lijst(d.labProjecten).filter(x => (x.veiligheid || {}).status === 'open').slice(0, 6).map(x => ({ soort: 'veiligheid', titel: 'Veiligheidstoets · ' + (x.titel || 'RTF-project'), at: x.at || null }));
    const alles = [...mail, ...agenda, ...goedkeuringen, ...huisTaken, ...rtfTaken].slice(0, 24);
    return { persoonlijk, identiteit: context && context.label || 'Gedeelde kantoorcode', adres, items: alles,
      telling: { rtmail: mail.length, agenda: agenda.length, goedkeuringen: goedkeuringen.length, taken: huisTaken.length + rtfTaken.length } };
  }
  function rollenVoor(key, huis) { return S().rollen.filter(r => r.key === key && (r.huis === huis || r.huis === 'gedeeld')).map(r => r.rol); }
  function rechtenVoor(context, huis) {
    if (context && context.baas) return ['*'];
    return [...new Set(rollenVoor(context && context.key, huis).flatMap(r => (ROLLEN[r] || {}).rechten || []))];
  }
  const mag = (rechten, recht) => rechten.includes('*') || rechten.includes(recht) || rechten.includes(recht.split(':')[0] + ':*');
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
      governance: { rollen: rollenVoor(context && context.key, huis), rechten: rechtenVoor(context || {}, huis), baas: !!(context && context.baas), catalogus: ROLLEN },
      vandaag: liveVandaag(huis, context || {}) };
  }
  function projectVanMail(body, context) {
    if (!context || !context.key || !context.codename) return { status: 403, error: 'Een RTMAIL-project vraagt een persoonlijk personeelsaccount.' };
    const s = S(), huis = geldigHuis(body.huis), berichten = (((db.data.rtmail || {}).berichten) || []),
      adres = String(context.codename).trim().toLowerCase().replace(/[^a-z0-9._-]/g, '') + '@rtmail';
    const mail = berichten.find(m => m.id === String(body.mailId || '') && m.naar === adres);
    if (!mail) return { status: 404, error: 'Dit bericht staat niet in uw persoonlijke RTMAIL.' };
    if (s.projecten.some(p => p.bron && p.bron.mailId === mail.id)) return { status: 409, error: 'Van dit bericht bestaat al een project.' };
    const titel = tekst(body.titel, 160) || tekst(mail.onderwerp, 160), eigenaar = tekst(body.eigenaar, 100) || context.label,
      deadline = tekst(body.deadline, 16), bedoeling = tekst(body.bedoeling, 600) || 'De vraag uit RTMAIL zorgvuldig en aantoonbaar afhandelen.';
    const intentie = { id: id('int-'), huis, titel, waarom: bedoeling, voorWie: tekst(body.voorWie, 160), bewijs: tekst(body.bewijs, 240),
      herzieOp: deadline, status: 'actief', door: context.label, at: nu() };
    s.intenties.unshift(intentie);
    const project = { id: id('prj-'), huis, titel, eigenaar, deadline, status: 'intake', voortgang: 12, intentieId: intentie.id,
      bron: { soort: 'rtmail', mailId: mail.id, van: mail.van, onderwerp: tekst(mail.onderwerp, 160), at: mail.at },
      taken: [
        { id: id('tsk-'), tekst: 'Bronbericht en context controleren', af: false },
        { id: id('tsk-'), tekst: 'Eigenaar en gewenste uitkomst bevestigen', af: false },
        { id: id('tsk-'), tekst: 'Eerste uitvoeringsplan maken', af: false }
      ], documenten: { ruimte: '/apps/office.html?werk=werkplek&bedrijf=' + (huis === 'rtf' ? 'rtf' : 'rtg'), status: 'gereed' },
      route: [], tijdlijn: [{ at: nu(), soort: 'bron', tekst: 'Project ontstaan uit persoonlijk RTMAIL-bericht.' }, { at: nu(), soort: 'intentie', tekst: 'Bedoeling vastgelegd en aan het project verbonden.' }], at: nu() };
    if (body.goedkeuringType && BESLUITTYPEN.includes(body.goedkeuringType)) {
      const g = goedkeuringMaak({ huis, type: body.goedkeuringType, titel: 'Projectgoedkeuring · ' + titel, reden: bedoeling,
        bedrag: body.bedrag, impact: body.impact || 3, risico: body.risico || 3, omkeerbaar: body.omkeerbaar }, context);
      if (g.goedkeuring) { project.goedkeuringId = g.goedkeuring.id; project.route.push(body.goedkeuringType); project.tijdlijn.push({ at: nu(), soort: 'besluit', tekst: 'Goedkeuringsroute ' + body.goedkeuringType + ' gestart.' }); }
    }
    mail.gelezen = true; mail.vastgezet = true; if (!Array.isArray(mail.workflow)) mail.workflow = [];
    mail.workflow.push({ id: id('wf-'), soort: 'project', label: 'RTG One-project gestart', ref: project.id, at: new Date().toISOString() });
    s.projecten.unshift(project); log(context.label, 'project-uit-rtmail', project.id, huis); save(); return { ok: true, project, intentie };
  }
  function projectTaakZet(projectId, taakId, af, context) {
    const s = S(), p = vind(s.projecten, projectId); if (!p) return { status: 404, error: 'Project niet gevonden.' };
    const t = p.taken.find(x => x.id === String(taakId || '')); if (!t) return { status: 404, error: 'Projecttaak niet gevonden.' };
    t.af = af === true; const klaar = p.taken.filter(x => x.af).length; p.voortgang = Math.min(90, 12 + Math.round(klaar / Math.max(1, p.taken.length) * 60));
    p.status = klaar === p.taken.length ? (p.goedkeuringId ? 'besluit' : 'uitvoering') : 'in-voorbereiding';
    p.tijdlijn.push({ at: nu(), soort: 'taak', tekst: (t.af ? 'Afgerond: ' : 'Heropend: ') + t.tekst });
    log(context.label, 'projecttaak-' + (t.af ? 'af' : 'open'), p.id + ':' + t.id, p.huis); save(); return { ok: true, project: p };
  }
  function goedkeuringMaak(body, context) {
    const s = S(), huis = geldigHuis(body.huis), type = BESLUITTYPEN.includes(body.type) ? body.type : 'operations';
    const titel = tekst(body.titel, 160), reden = tekst(body.reden, 600); if (!titel || !reden) return { status: 400, error: 'Titel en onderbouwing zijn verplicht.' };
    const bedrag = Math.max(0, Math.min(100000000, Number(body.bedrag) || 0)), impact = Math.max(1, Math.min(5, Number(body.impact) || 1)),
      risico = Math.max(1, Math.min(5, Number(body.risico) || 1)), omkeerbaar = body.omkeerbaar === true || body.omkeerbaar === 'true';
    const vereist = (bedrag >= 10000 || impact >= 4 || risico >= 4 || !omkeerbaar) ? 2 : 1;
    const x = { id: id('dec-'), huis, type, titel, reden, bedrag, impact, risico, omkeerbaar, vereist, status: 'wacht',
      aanvrager: context.key || 'legacy:kantoor', aanvragerLabel: tekst(context.label, 100), stemmen: [], at: nu() };
    s.goedkeuringen.unshift(x); log(context.label, 'besluit-aangevraagd', x.id, huis); save(); return { ok: true, goedkeuring: x };
  }
  function goedkeuringBeslis(idRuw, besluit, context) {
    const s = S(), x = vind(s.goedkeuringen, idRuw); if (!x) return { status: 404, error: 'Besluit niet gevonden.' };
    if (x.status !== 'wacht') return { status: 400, error: 'Dit besluit is al gesloten.' };
    if (!context.key) return { status: 403, error: 'Een besluit vraagt een persoonlijk personeelsaccount.' };
    if (x.aanvrager === context.key) return { status: 403, error: 'De aanvrager kan de eigen aanvraag niet goedkeuren.' };
    const rechten = rechtenVoor(context, x.huis); if (!mag(rechten, 'besluit:' + x.type)) return { status: 403, error: 'Uw rol mag dit type besluit niet beoordelen.' };
    if (x.stemmen.some(v => v.key === context.key)) return { status: 400, error: 'U hebt dit besluit al beoordeeld.' };
    const keuze = besluit === 'afwijzen' ? 'afgewezen' : 'goedgekeurd';
    x.stemmen.push({ key: context.key, label: tekst(context.label, 100), besluit: keuze, at: nu() });
    if (keuze === 'afgewezen') x.status = 'afgewezen';
    else if (x.stemmen.filter(v => v.besluit === 'goedgekeurd').length >= x.vereist) { x.status = 'goedgekeurd'; x.beslotenAt = nu(); }
    log(context.label, 'besluit-' + keuze, x.id, x.huis); save(); return { ok: true, goedkeuring: x };
  }
  function rolGeef(body, context) {
    if (!context.baas) return { status: 403, error: 'Alleen de eigenaar beheert rollen.' };
    const s = S(), key = tekst(body.key, 100), huis = geldigHuis(body.huis), rol = String(body.rol || '');
    if (!key || !ROLLEN[rol]) return { status: 400, error: 'Kies een geldige medewerker en rol.' };
    if (!s.rollen.some(r => r.key === key && r.huis === huis && r.rol === rol)) s.rollen.push({ id: id('rol-'), key, naam: tekst(body.naam, 100), huis, rol, at: nu() });
    log(context.label, 'rol-gegeven', key + ':' + rol, huis); save(); return { ok: true, rollen: s.rollen.filter(r => r.huis === huis) };
  }
  function rolTrek(idRuw, context) {
    if (!context.baas) return { status: 403, error: 'Alleen de eigenaar beheert rollen.' };
    const s = S(), i = s.rollen.findIndex(r => r.id === String(idRuw || '')); if (i < 0) return { status: 404, error: 'Rol niet gevonden.' };
    const r = s.rollen.splice(i, 1)[0]; log(context.label, 'rol-ingetrokken', r.key + ':' + r.rol, r.huis); save(); return { ok: true };
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
  return { rtgone: { state, intentieMaak, belofteMaak, frictieMaak, overdrachtMaak, automatiseringVoorbereid, automatiseringVoer, automatiseringHerstel,
    goedkeuringMaak, goedkeuringBeslis, rolGeef, rolTrek, projectVanMail, projectTaakZet, ROLLEN } };
};
