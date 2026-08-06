/* Foundation OS, deel "vrijwilligers-inzet": koppelen, uren en evalueren.

   DE VOG-GRENDEL HANGT AAN HET PROJECT, NIET AAN DE PERSOON. Dat is LAT.md
   regel 7: een grendel hoort bij het ding dat beschermd wordt. Of iemand een
   VOG nodig heeft, hangt af van het werk -- kinderen, huiswerk, sport,
   ouderenbezoek -- en niet van hoe lang hij al meeloopt of wie hem kent. Zo
   kan een nieuwe projectsoort de eis niet per ongeluk ontlopen: hij komt in
   VOG_VERPLICHT of hij komt er niet in, en dat is een zichtbare keuze.

   DRIE VOORWAARDEN, DRIE ZINNEN. Geen VOG, geen gedragscode en niet-actief
   zijn drie verschillende dingen met drie verschillende vervolgstappen. Een
   gedeelde "deze vrijwilliger kan niet worden gekoppeld" laat de planner raden
   op de avond dat hij mensen tekort komt.

   UREN ZIJN GEEN DETAIL. Ze dragen het jaarverslag, de subsidieverantwoording
   en het enige eerlijke kostengetal dat een foundation heeft: kosten per
   geholpen persoon. Ze horen daarom aan een project te hangen -- uren zonder
   project tellen wel mee in het totaal, maar nergens in een rapportage. */

module.exports = (ctx, eigen) => {
  const { nu, rid, schoon, S, audit, wie, poort, save } = ctx;
  // VOG_VERPLICHT komt mee uit het register in plaats van uit een eigen
  // require: twee modules die elkaar over en weer laden is een kring die
  // alleen werkt zolang niemand de volgorde aanraakt. En een tweede kopie van
  // de lijst zou LAT.md regel 4 zijn (twee plekken, een waarheid).
  const { vind, vogGeldig, beeld, VOG_VERPLICHT } = eigen;

  // Dezelfde poort voor alle drie: de stad van de vrijwilliger, het recht om
  // vrijwilligers te beheren, en de module die aan moet staan.
  function open(req, id) {
    const v = vind(id);
    if (!v) return { status: 404, error: 'Deze vrijwilliger staat niet in het register.' };
    const w = wie(req);
    const g = poort(w, v.stad, 'vrijwilliger.beheren', 'volunteer_management');
    if (!g.ok) return g;
    return { ok: true, v, w };
  }

  function koppel(req, id, projectId, los) {
    const o = open(req, id);
    if (!o.ok) return o;
    const v = o.v;
    const p = S().projecten.find(x => x.id === String(projectId || ''));
    if (!p) return { status: 404, error: 'Dit project bestaat niet.' };
    if (p.stad !== v.stad) return { status: 400, error: 'Deze vrijwilliger hoort bij een andere stad.' };
    if (!Array.isArray(v.projecten)) v.projecten = [];
    if (los === true) {
      v.projecten = v.projecten.filter(x => x !== p.id);
      if (Array.isArray(p.vrijwilligers)) p.vrijwilligers = p.vrijwilligers.filter(x => x !== v.id);
      audit(o.w.key, 'vrijwilliger.los', v.naam, p.naam);
      save();
      return { ok: true, vrijwilliger: beeld(v) };
    }
    if (VOG_VERPLICHT.includes(p.soort) && !vogGeldig(v)) {
      return { status: 403, error: 'Voor "' + p.naam + '" (' + p.soort + ') is een geldige VOG verplicht. ' +
        (v.vogGeldigTot ? 'De VOG van ' + v.naam + ' is verlopen op ' + v.vogGeldigTot + '.'
          : 'Er staat geen VOG in het dossier van ' + v.naam + '.') };
    }
    if (!v.gedragscode) {
      return { status: 403, error: v.naam + ' heeft de gedragscode nog niet ondertekend. Dat gaat vooraf aan het eerste project.' };
    }
    if (v.status !== 'actief') {
      return { status: 400, error: v.naam + ' staat op "' + v.status + '" en kan pas mee als de status "actief" is.' };
    }
    if (!v.projecten.includes(p.id)) v.projecten.push(p.id);
    if (!Array.isArray(p.vrijwilligers)) p.vrijwilligers = [];
    if (!p.vrijwilligers.includes(v.id)) p.vrijwilligers.push(v.id);
    audit(o.w.key, 'vrijwilliger.koppel', v.naam, p.naam);
    save();
    return { ok: true, vrijwilliger: beeld(v) };
  }

  function urenBoek(req, id, b) {
    const o = open(req, id);
    if (!o.ok) return o;
    const v = o.v;
    b = b || {};
    const n = Number(b.uren);
    if (!Number.isFinite(n) || n <= 0 || n > 24) {
      return { status: 400, error: 'Hoeveel uren? Meer dan nul, hoogstens 24 op een dag.' };
    }
    const pid = schoon(b.projectId, 20);
    if (pid && !(v.projecten || []).includes(pid)) {
      return { status: 400, error: v.naam + ' staat niet op dat project. Koppel hem er eerst aan.' };
    }
    if (!Array.isArray(v.uren)) v.uren = [];
    if (v.uren.length >= 5000) v.uren.shift();
    v.uren.push({ id: rid(), projectId: pid || null, uren: Math.round(n * 100) / 100,
      datum: schoon(b.datum, 10) || nu().slice(0, 10),
      km: Math.max(0, Math.min(2000, Math.round(Number(b.km) || 0))) });
    save();
    return { ok: true, vrijwilliger: beeld(v) };
  }

  function evaluatie(req, id, tekst) {
    const o = open(req, id);
    if (!o.ok) return o;
    const t = schoon(tekst, 400);
    if (!t) return { status: 400, error: 'Wat is de evaluatie?' };
    if (!Array.isArray(o.v.evaluaties)) o.v.evaluaties = [];
    o.v.evaluaties.unshift({ id: rid(), tekst: t, door: o.w.key, at: nu() });
    if (o.v.evaluaties.length > 50) o.v.evaluaties.pop();
    audit(o.w.key, 'vrijwilliger.evaluatie', o.v.naam, '');
    save();
    return { ok: true, vrijwilliger: beeld(o.v) };
  }

  return { koppel, urenBoek, evaluatie };
};
