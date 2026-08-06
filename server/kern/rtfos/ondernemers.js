/* Foundation OS, deel "ondernemers": het lokale maatschappelijke
   ondernemersnetwerk.

   NIET ALLE STEUN IS GELD, EN GELD IS ZELDEN HET NUTTIGST. Een restaurant dat
   elke dinsdag vijftig maaltijden beschikbaar stelt, een garage die vervoer
   regelt, een kantoor dat een zaal leent, een bedrijf dat drie stageplekken
   opent: dat is de bijdrage die een lokale foundation draagt. Daarom is het
   AANBOD hier het object, met een soort, een aantal en een ritme -- en niet een
   bedrag met een opmerking erbij.

   EEN AANBOD DAT NIEMAND OPHAALT, IS GEEN AANBOD. Elk aanbod krijgt daarom een
   status en kan aan een project worden gekoppeld. Wat open blijft staan, staat
   in het stadsbeeld als openstaand -- zichtbaar, niet stilzwijgend vergeten.

   DE WAARDE IS EEN SCHATTING EN HEET OOK ZO. Vijftig maaltijden zijn geen
   vijftig keer de menuprijs; voor het jaarverslag telt een geschatte waarde
   mee, maar dan wel als `waardeGeschat` en niet als een bedrag dat zich als
   ontvangen geld voordoet. Een cijfer dat zich mooier voordoet dan het is,
   maakt het hele jaarverslag verdacht.

   HET PORTAAL TOONT ALLEEN HET EIGEN BEDRIJF. Zelfde familie als de partner- en
   gemeentecode: de code is de geloofsbrief, de remmen staan in de routelaag. */

const SOORTEN = ['geld', 'producten', 'diensten', 'personeel', 'vervoer', 'ruimte',
  'maaltijden', 'stageplekken', 'vacatures', 'kortingen', 'sponsoring'];
const RITME = ['eenmalig', 'wekelijks', 'maandelijks', 'doorlopend'];
const STATUS = ['open', 'gekoppeld', 'benut', 'vervallen'];

module.exports = (ctx) => {
  const { nu, rid, schoon, centen, euro, code, S, audit, wie, poort, stadVan, save } = ctx;

  const vind = id => S().ondernemers.find(o => o.id === String(id || '')) || null;
  const vindCode = c => S().ondernemers.find(o => o.code === String(c || '').trim().toUpperCase()) || null;
  const aanbodBeeld = a => ({ id: a.id, soort: a.soort, wat: a.wat, aantal: a.aantal, ritme: a.ritme,
    waardeGeschat: euro(a.waardeCenten), status: a.status, projectId: a.projectId || null, at: a.at });
  const beeld = o => ({ id: o.id, stad: o.stad, naam: o.naam, contact: o.contact, code: o.code,
    branche: o.branche, aanbod: (o.aanbod || []).map(aanbodBeeld), at: o.at });

  function lijst(req, stadId) {
    const w = wie(req);
    const g = poort(w, stadId, 'stad.lezen');
    if (!g.ok) return g;
    const rijen = S().ondernemers.filter(o => o.stad === g.stad.id);
    const alleAanbod = rijen.flatMap(o => (o.aanbod || []).map(a => ({ bedrijf: o.naam, ...aanbodBeeld(a) })));
    return { ok: true, soorten: SOORTEN, ritmes: RITME, statussen: STATUS,
      ondernemers: rijen.map(beeld),
      openstaand: alleAanbod.filter(a => a.status === 'open'),
      waardeGeschatTotaal: Math.round(alleAanbod.reduce((s, a) => s + a.waardeGeschat, 0) * 100) / 100 };
  }

  function maak(req, b) {
    b = b || {};
    const w = wie(req);
    const g = poort(w, b.stad, 'stad.beheren', 'business_sponsorships');
    if (!g.ok) return g;
    const naam = schoon(b.naam, 120);
    if (naam.length < 2) return { status: 400, error: 'Hoe heet het bedrijf?' };
    if (S().ondernemers.length >= 50000) return { status: 400, error: 'Het ondernemersregister zit vol.' };
    const o = { id: rid(), stad: g.stad.id, naam, branche: schoon(b.branche, 60),
      contact: schoon(b.contact, 120), code: code('RTFO'), aanbod: [], at: nu() };
    S().ondernemers.push(o);
    audit(w.key, 'ondernemer.maak', naam, 'stad ' + g.stad.naam);
    save();
    return { ok: true, ondernemer: beeld(o) };
  }

  function aanbodMaak(req, id, b) {
    b = b || {};
    const o = vind(id);
    if (!o) return { status: 404, error: 'Dit bedrijf staat niet in het register.' };
    const w = wie(req);
    const g = poort(w, o.stad, 'stad.beheren', 'business_sponsorships');
    if (!g.ok) return g;
    const soort = String(b.soort || '');
    if (!SOORTEN.includes(soort)) return { status: 400, error: 'Kies een soort (' + SOORTEN.join(', ') + ').' };
    const ritme = String(b.ritme || 'eenmalig');
    if (!RITME.includes(ritme)) return { status: 400, error: 'Ritme is eenmalig, wekelijks, maandelijks of doorlopend.' };
    const wat = schoon(b.wat, 200);
    if (wat.length < 3) return { status: 400, error: 'Wat biedt dit bedrijf aan?' };
    const waarde = centen(b.waarde === undefined ? 0 : b.waarde);
    if (waarde === null) return { status: 400, error: 'Wat is de geschatte waarde? Nul mag ook.' };
    const aantal = Math.max(0, Math.min(1000000, Math.round(Number(b.aantal) || 0)));
    if (!Array.isArray(o.aanbod)) o.aanbod = [];
    if (o.aanbod.length >= 200) return { status: 400, error: 'Dit bedrijf heeft al tweehonderd aanbiedingen.' };
    o.aanbod.unshift({ id: rid(), soort, wat, aantal, ritme, waardeCenten: waarde,
      status: 'open', projectId: null, at: nu() });
    audit(w.key, 'ondernemer.aanbod', o.naam, soort + ': ' + wat.slice(0, 40));
    save();
    return { ok: true, ondernemer: beeld(o) };
  }

  /* Aanbod aan een project koppelen. De stad moet kloppen: een maaltijdaanbod
     in Haarlem gaat niet naar een project in Amsterdam. Dat lijkt vanzelf te
     spreken tot het aanbod schaars wordt. */
  function koppel(req, id, aanbodId, projectId) {
    const o = vind(id);
    if (!o) return { status: 404, error: 'Dit bedrijf staat niet in het register.' };
    const w = wie(req);
    const g = poort(w, o.stad, 'stad.beheren', 'business_sponsorships');
    if (!g.ok) return g;
    const a = (o.aanbod || []).find(x => x.id === String(aanbodId || ''));
    if (!a) return { status: 404, error: 'Dit aanbod bestaat niet.' };
    if (!projectId) {
      a.projectId = null;
      a.status = 'open';
      save();
      return { ok: true, ondernemer: beeld(o) };
    }
    const p = S().projecten.find(x => x.id === String(projectId));
    if (!p) return { status: 404, error: 'Dit project bestaat niet.' };
    if (p.stad !== o.stad) return { status: 400, error: 'Dat project hoort bij een andere stad.' };
    a.projectId = p.id;
    a.status = 'gekoppeld';
    audit(w.key, 'ondernemer.koppel', o.naam, a.wat.slice(0, 40) + ' -> ' + p.naam);
    save();
    return { ok: true, ondernemer: beeld(o) };
  }

  function aanbodStatus(req, id, aanbodId, status) {
    const o = vind(id);
    if (!o) return { status: 404, error: 'Dit bedrijf staat niet in het register.' };
    const w = wie(req);
    const g = poort(w, o.stad, 'stad.beheren', 'business_sponsorships');
    if (!g.ok) return g;
    const a = (o.aanbod || []).find(x => x.id === String(aanbodId || ''));
    if (!a) return { status: 404, error: 'Dit aanbod bestaat niet.' };
    const st = String(status || '');
    if (!STATUS.includes(st)) return { status: 400, error: 'Status is open, gekoppeld, benut of vervallen.' };
    if (st === 'benut' && !a.projectId) {
      return { status: 400, error: 'Koppel dit aanbod eerst aan een project; anders is niet te zien waar het terecht is gekomen.' };
    }
    a.status = st;
    audit(w.key, 'ondernemer.aanbod-status', o.naam, a.wat.slice(0, 30) + ' -> ' + st);
    save();
    return { ok: true, ondernemer: beeld(o) };
  }

  /* Het ondernemersportaal: het eigen bedrijf, het eigen aanbod, en wat ermee
     is gebeurd. Dat laatste is het hele punt van dit portaal -- een bedrijf dat
     nooit hoort waar zijn vijftig maaltijden heen gingen, geeft er ooit vijftig
     en daarna geen meer. */
  function portaal(c) {
    const o = vindCode(c);
    if (!o) return { status: 404, error: 'Deze bedrijfscode kennen we niet. Vraag het RTF-kantoor om de code.' };
    const stad = stadVan(o.stad);
    const aanbod = (o.aanbod || []).map(a => {
      const p = a.projectId ? S().projecten.find(x => x.id === a.projectId) : null;
      return Object.assign(aanbodBeeld(a), { project: p ? { naam: p.naam, soort: p.soort, doelgroep: p.doelgroep } : null });
    });
    const benut = aanbod.filter(a => a.status === 'benut');
    return { ok: true, bedrijf: { naam: o.naam, branche: o.branche, stad: stad ? stad.naam : null },
      aanbod,
      impact: { aanbiedingen: aanbod.length, benut: benut.length,
        waardeGeschat: Math.round(benut.reduce((s, a) => s + a.waardeGeschat, 0) * 100) / 100,
        projecten: [...new Set(benut.map(a => a.project && a.project.naam).filter(Boolean))] } };
  }

  return { lijst, maak, aanbodMaak, koppel, aanbodStatus, portaal, vind, vindCode,
    SOORTEN, RITME, STATUS };
};
module.exports.SOORTEN = SOORTEN;
