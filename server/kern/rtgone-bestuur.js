/* RTG One, deel "bestuur": WIE MAG WELK BESLUIT NEMEN, EN HET BESLUIT ZELF.

   Afgesplitst uit ./rtgone.js (18 oktober 2026). Daar staat het werkgeheugen
   -- intenties, beloften, fricties, overdrachten, automatiseringen -- en hier
   de bevoegdheid erboven: de rollencatalogus, wie welke rol in welk huis heeft,
   welke rechten daaruit volgen, en de goedkeuring met haar vier-ogenregel (een
   aanvrager keurt zijn eigen aanvraag nooit goed; boven een drempel van bedrag,
   impact, risico of onomkeerbaarheid zijn er twee stemmen nodig). Dat is een
   andere vraag dan "wat gebeurt er", en wie hem wijzigt hoort alleen deze regels
   te hoeven lezen.

   Krijgt de opslag (S, save, log) en de kleine helpers van ./rtgone.js mee; de
   collecties blijven daar, in db.data.rtgOne. */
'use strict';

module.exports = ({ S, save, id, tekst, geldigHuis, vind, log, nu }) => {
  const ROLLEN = {
    executive: { naam: 'Executive', rechten: ['besluit:*', 'rollen:beheer', 'audit:lees'] },
    finance: { naam: 'Finance', rechten: ['besluit:finance'] }, legal: { naam: 'Juridisch', rechten: ['besluit:legal'] },
    privacy: { naam: 'Privacy', rechten: ['besluit:privacy'] }, security: { naam: 'Security', rechten: ['besluit:security'] },
    safeguarding: { naam: 'Safeguarding', rechten: ['besluit:safeguarding'] }, operations: { naam: 'Operations', rechten: ['besluit:operations'] },
    people: { naam: 'People & Culture', rechten: ['besluit:people'] }, ai: { naam: 'AI Governance', rechten: ['besluit:ai'] },
    auditor: { naam: 'Auditor', rechten: ['audit:lees'] }
  };
  const BESLUITTYPEN = ['finance', 'legal', 'privacy', 'security', 'safeguarding', 'operations', 'people', 'ai'];
  function rollenVoor(key, huis) { return S().rollen.filter(r => r.key === key && (r.huis === huis || r.huis === 'gedeeld')).map(r => r.rol); }
  function rechtenVoor(context, huis) {
    if (context && context.baas) return ['*'];
    return [...new Set(rollenVoor(context && context.key, huis).flatMap(r => (ROLLEN[r] || {}).rechten || []))];
  }
  const mag = (rechten, recht) => rechten.includes('*') || rechten.includes(recht) || rechten.includes(recht.split(':')[0] + ':*');
  function goedkeuringMaak(body, context) {
    const s = S(), huis = geldigHuis(body.huis), type = BESLUITTYPEN.includes(body.type) ? body.type : 'operations';
    const titel = tekst(body.titel, 160), reden = tekst(body.reden, 600); if (!titel || !reden) return { status: 400, error: 'Titel en onderbouwing zijn verplicht.' };
    const bedrag = Math.max(0, Math.min(100000000, Number(body.bedrag) || 0)), impact = Math.max(1, Math.min(5, Number(body.impact) || 1)),
      risico = Math.max(1, Math.min(5, Number(body.risico) || 1)), omkeerbaar = body.omkeerbaar === true || body.omkeerbaar === 'true';
    const vereist = (bedrag >= 10000 || impact >= 4 || risico >= 4 || !omkeerbaar) ? 2 : 1;
    const x = { id: id('dec-'), huis, type, titel, reden, waaromNu: tekst(body.waaromNu, 600), alternatief: tekst(body.alternatief, 600),
      beheersing: tekst(body.beheersing, 600), deadline: tekst(body.deadline, 16), bedrag, impact, risico, omkeerbaar, vereist, status: 'wacht',
      projectId: tekst(body.projectId, 80), documentId: tekst(body.documentId, 80), documentTitel: tekst(body.documentTitel, 160),
      bronMailId: tekst(body.bronMailId, 80), aanvrager: context.key || 'legacy:kantoor', aanvragerLabel: tekst(context.label, 100), stemmen: [], at: nu() };
    s.goedkeuringen.unshift(x); log(context.label, 'besluit-aangevraagd', x.id, huis); save(); return { ok: true, goedkeuring: x };
  }
  function goedkeuringBeslis(idRuw, besluit, context, details) {
    const s = S(), x = vind(s.goedkeuringen, idRuw); if (!x) return { status: 404, error: 'Besluit niet gevonden.' };
    if (x.status !== 'wacht') return { status: 400, error: 'Dit besluit is al gesloten.' };
    if (!context.key) return { status: 403, error: 'Een besluit vraagt een persoonlijk personeelsaccount.' };
    if (x.aanvrager === context.key) return { status: 403, error: 'De aanvrager kan de eigen aanvraag niet goedkeuren.' };
    if (!['goedkeuren', 'afwijzen', 'terug'].includes(besluit)) return { status: 400, error: 'Kies akkoord, terug voor aanpassing of niet uitvoeren.' };
    const rechten = rechtenVoor(context, x.huis); if (!mag(rechten, 'besluit:' + x.type)) return { status: 403, error: 'Uw rol mag dit type besluit niet beoordelen.' };
    if (x.stemmen.some(v => v.key === context.key)) return { status: 400, error: 'U hebt dit besluit al beoordeeld.' };
    details = details || {};
    const keuze = besluit === 'afwijzen' ? 'afgewezen' : besluit === 'terug' ? 'aanpassen' : 'goedgekeurd';
    const stem = { key: context.key, label: tekst(context.label, 100), besluit: keuze,
      reden: tekst(details.reden, 600), voorwaarde: tekst(details.voorwaarde, 600), at: nu() };
    x.stemmen.push(stem);
    if (keuze === 'afgewezen' || keuze === 'aanpassen') { x.status = keuze; x.beslotenAt = nu(); x.besluit = stem; }
    else if (x.stemmen.filter(v => v.besluit === 'goedgekeurd').length >= x.vereist) {
      x.status = 'goedgekeurd'; x.beslotenAt = nu(); x.besluit = stem;
      const project = vind(s.projecten, x.projectId);
      if (project) {
        project.status = 'uitvoering'; project.voortgang = Math.max(25, Number(project.voortgang) || 0);
        if (!project.taken.some(t => t.besluitId === x.id)) project.taken.push({ id: id('tsk-'), tekst: 'Besluit uitvoeren: ' + x.titel, af: false, besluitId: x.id });
        project.tijdlijn.push({ at: nu(), soort: 'besluit', tekst: 'Besluit goedgekeurd; uitvoering vrijgegeven.' });
      }
    }
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

  return { ROLLEN, BESLUITTYPEN, rollenVoor, rechtenVoor, goedkeuringMaak, goedkeuringBeslis, rolGeef, rolTrek };
};
