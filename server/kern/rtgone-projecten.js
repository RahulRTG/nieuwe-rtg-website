/* De projectlevensloop van RTG One. Deze kamer houdt bron, uitvoering, bewijs
   en menselijke oplevering bij elkaar, zonder de gezamenlijke kern te laten
   uitgroeien tot een tweede router. */
module.exports = function projectenMaak(h) {
  const { db, save, S, id, geldigHuis, tekst, vind, log, nu, klokDatum, besluittypen, goedkeuringMaak } = h;

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
    const project = { id: id('prj-'), huis, titel, eigenaar, eigenaarKey: context.key, deadline, status: 'intake', voortgang: 12, intentieId: intentie.id,
      bron: { soort: 'rtmail', mailId: mail.id, van: mail.van, onderwerp: tekst(mail.onderwerp, 160), at: mail.at },
      taken: [
        { id: id('tsk-'), tekst: 'Bronbericht en context controleren', af: false },
        { id: id('tsk-'), tekst: 'Eigenaar en gewenste uitkomst bevestigen', af: false },
        { id: id('tsk-'), tekst: 'Eerste uitvoeringsplan maken', af: false }
      ], bewijs: [], documenten: { ruimte: '/apps/office.html?werk=werkplek&bedrijf=' + (huis === 'rtf' ? 'rtf' : 'rtg'), status: 'gereed' },
      route: [], tijdlijn: [{ at: nu(), soort: 'bron', tekst: 'Project ontstaan uit persoonlijk RTMAIL-bericht.' }, { at: nu(), soort: 'intentie', tekst: 'Bedoeling vastgelegd en aan het project verbonden.' }], at: nu() };
    if (body.goedkeuringType && besluittypen.includes(body.goedkeuringType)) {
      const g = goedkeuringMaak({ huis, type: body.goedkeuringType, titel: 'Projectgoedkeuring · ' + titel, reden: bedoeling,
        waaromNu: body.waaromNu, alternatief: body.alternatief, beheersing: body.beheersing, deadline,
        projectId: project.id, bronMailId: mail.id, bedrag: body.bedrag, impact: body.impact || 3,
        risico: body.risico || 3, omkeerbaar: body.omkeerbaar }, context);
      if (g.goedkeuring) { project.goedkeuringId = g.goedkeuring.id; project.route.push(body.goedkeuringType); project.tijdlijn.push({ at: nu(), soort: 'besluit', tekst: 'Goedkeuringsroute ' + body.goedkeuringType + ' gestart.' }); }
    }
    mail.gelezen = true; mail.vastgezet = true; if (!Array.isArray(mail.workflow)) mail.workflow = [];
    mail.workflow.push({ id: id('wf-'), soort: 'project', label: 'RTG One-project gestart', ref: project.id, at: klokDatum().toISOString() });
    s.projecten.unshift(project); log(context.label, 'project-uit-rtmail', project.id, huis); save(); return { ok: true, project, intentie };
  }

  function projectTaakZet(projectId, taakId, af, context) {
    const s = S(), p = vind(s.projecten, projectId); if (!p) return { status: 404, error: 'Project niet gevonden.' };
    if (!context || !context.key) return { status: 403, error: 'Projectuitvoering vraagt een persoonlijk personeelsaccount.' };
    if (p.eigenaarKey && p.eigenaarKey !== context.key && !context.baas) return { status: 403, error: 'Alleen de projecteigenaar kan deze uitvoering wijzigen.' };
    const t = p.taken.find(x => x.id === String(taakId || '')); if (!t) return { status: 404, error: 'Projecttaak niet gevonden.' };
    t.af = af === true; const klaar = p.taken.filter(x => x.af).length, besluit = p.goedkeuringId && vind(s.goedkeuringen, p.goedkeuringId);
    p.voortgang = Math.min(90, 12 + Math.round(klaar / Math.max(1, p.taken.length) * 60));
    p.status = klaar === p.taken.length ? (besluit && besluit.status !== 'goedgekeurd' ? 'besluit' : 'oplevering') : 'in-voorbereiding';
    p.tijdlijn.push({ at: nu(), soort: 'taak', tekst: (t.af ? 'Afgerond: ' : 'Heropend: ') + t.tekst });
    log(context.label, 'projecttaak-' + (t.af ? 'af' : 'open'), p.id + ':' + t.id, p.huis); save(); return { ok: true, project: p };
  }

  function projectBewijs(body, context) {
    const s = S(), p = vind(s.projecten, body.projectId); if (!p) return { status: 404, error: 'Project niet gevonden.' };
    if (!context || !context.key) return { status: 403, error: 'Bewijs vastleggen vraagt een persoonlijk personeelsaccount.' };
    if (p.eigenaarKey && p.eigenaarKey !== context.key && !context.baas) return { status: 403, error: 'Alleen de projecteigenaar kan bewijs toevoegen.' };
    if (p.status === 'afgerond') return { status: 400, error: 'Dit project is al menselijk opgeleverd.' };
    const titel = tekst(body.titel, 160), uitleg = tekst(body.uitleg, 600);
    if (!titel || !uitleg) return { status: 400, error: 'Noem het bewijs en leg uit wat het aantoont.' };
    if (!Array.isArray(p.bewijs)) p.bewijs = [];
    const bestaand = p.bewijs.find(x => x.key === context.key && x.titel === titel && x.uitleg === uitleg &&
      x.bron === tekst(body.bron, 160) && x.documentId === tekst(body.documentId, 80) && x.taakId === tekst(body.taakId, 80));
    if (bestaand) return { ok: true, project: p, bewijs: bestaand, herhaald: true };
    const x = { id: id('prf-'), titel, uitleg, soort: tekst(body.soort, 60) || 'uitvoering', bron: tekst(body.bron, 160),
      documentId: tekst(body.documentId, 80), taakId: tekst(body.taakId, 80), door: tekst(context.label, 100), key: context.key, status: 'vastgelegd', at: nu() };
    if (!Array.isArray(p.tijdlijn)) p.tijdlijn = [];
    p.bewijs.push(x); p.tijdlijn.push({ at: nu(), soort: 'bewijs', tekst: 'Bewijs vastgelegd: ' + titel });
    log(context.label, 'projectbewijs-vastgelegd', p.id + ':' + x.id, p.huis); save(); return { ok: true, project: p, bewijs: x };
  }

  function projectOplever(body, context) {
    const s = S(), p = vind(s.projecten, body.projectId); if (!p) return { status: 404, error: 'Project niet gevonden.' };
    if (!context || !context.key) return { status: 403, error: 'Opleveren vraagt een persoonlijk personeelsaccount.' };
    if (p.eigenaarKey && p.eigenaarKey !== context.key && !context.baas) return { status: 403, error: 'Alleen de projecteigenaar kan dit project opleveren.' };
    if (p.status === 'afgerond') return { status: 400, error: 'Dit project is al opgeleverd.' };
    const besluit = p.goedkeuringId && vind(s.goedkeuringen, p.goedkeuringId);
    if (besluit && besluit.status !== 'goedgekeurd') return { status: 409, error: 'De vereiste besluitroute is nog niet goedgekeurd.' };
    if ((p.taken || []).some(t => !t.af)) return { status: 409, error: 'Rond eerst alle uitvoeringstaken af.' };
    if (!Array.isArray(p.bewijs) || !p.bewijs.length) return { status: 409, error: 'Leg eerst bewijs van het resultaat vast.' };
    const uitkomst = tekst(body.uitkomst, 600), leren = tekst(body.leren, 600);
    if (!uitkomst) return { status: 400, error: 'Beschrijf welk resultaat aantoonbaar is bereikt.' };
    if (!Array.isArray(p.tijdlijn)) p.tijdlijn = [];
    p.oplevering = { uitkomst, leren, door: tekst(context.label, 100), key: context.key, at: nu() };
    p.status = 'afgerond'; p.voortgang = 100; p.tijdlijn.push({ at: nu(), soort: 'oplevering', tekst: 'Project menselijk opgeleverd: ' + uitkomst });
    log(context.label, 'project-opgeleverd', p.id, p.huis); save(); return { ok: true, project: p };
  }

  return { projectVanMail, projectTaakZet, projectBewijs, projectOplever };
};
