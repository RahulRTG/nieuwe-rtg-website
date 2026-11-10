/* ============================================================================
   CIVILIS-OPVANG -- de ontbrekende naad tussen een beschermzaak en een plek.

   Dit is GEEN tweede hulpvraag en GEEN universele ketenmotor. De beschermzaak
   blijft eigenaar van veiligheid en toestemming; het partnerregister blijft
   eigenaar van de organisatie; deze module bezit alleen voorziening,
   reservering, acceptatie, aankomst en vervolg.

   Vier grenzen:
   - capaciteit is pas bruikbaar als de aanbieder haar zelf actueel maakte;
   - een plek heet pas bevestigd na expliciete acceptatie door die aanbieder;
   - een noodplaats wacht niet op regulier budget, maar die uitzondering draagt
     een reden en wordt nooit als budgetbesluit voorgesteld;
   - intrekken stopt iedere open reservering en wist de geschiedenis niet.
   ========================================================================== */
'use strict';

const OPEN = ['aangevraagd', 'geaccepteerd'];
const FINANCIERING = ['niet_vereist', 'besluit_bevestigd', 'nood_voor_besluit'];

module.exports = (ctx, eigen) => {
  const { nu, rid, schoon, S, audit, wie, poort, save } = ctx;
  const { beschermzaak, partners } = eigen;
  const tijd = () => Date.now();
  const voorzieningen = () => S().opvangvoorzieningen;
  const reserveringen = () => S().opvangreserveringen;
  const voorzieningVan = id => voorzieningen().find(v => v.id === String(id || '')) || null;
  const reserveringVan = id => reserveringen().find(r => r.id === String(id || '')) || null;

  const capaciteitVers = v => !!v.capaciteit && Date.parse(v.capaciteit.geldigTot) > tijd();
  const reserveBeeld = r => ({ id: r.id, zaakId: r.zaakId, codenaam: r.codenaam,
    voorzieningId: r.voorzieningId, partnerId: r.partnerId, status: r.status,
    verantwoordelijke: r.verantwoordelijke, financiering: r.financiering,
    noodreden: r.noodreden || null, aangevraagdOp: r.aangevraagdOp,
    geaccepteerdOp: r.geaccepteerdOp || null, geldigTot: r.geldigTot || null,
    aankomst: r.aankomst || null, vervolgplan: r.vervolgplan || null,
    weigering: r.weigering || null, stop: r.stop || null });
  const voorzieningBeeld = v => ({ id: v.id, stad: v.stad, partnerId: v.partnerId,
    naam: v.naam, soort: v.soort, actief: v.actief,
    capaciteit: v.capaciteit ? { beschikbaar: v.capaciteit.beschikbaar,
      geldigTot: v.capaciteit.geldigTot, at: v.capaciteit.at } : null,
    capaciteitVers: capaciteitVers(v) });

  function verval(r) {
    if (r.status === 'geaccepteerd' && r.geldigTot && Date.parse(r.geldigTot) <= tijd()) {
      r.status = 'vervallen';
      r.stop = { reden: 'acceptatie verlopen voor aankomst', at: nu() };
      audit('systeem', 'opvang.vervallen', r.codenaam, r.id);
      save();
    }
    return r;
  }

  function kantoor(req, stad) {
    const w = wie(req);
    const g = poort(w, stad, 'casus.beheren', 'individual_cases');
    return g.ok ? { ok: true, w, stad: g.stad } : g;
  }

  function partnerOpCode(code) {
    const p = partners.vindCode(code);
    if (!p) return { status: 404, error: 'Deze partnercode kennen we niet.' };
    const erkend = partners.erkend({ id: p.id });
    if (!erkend.ok) return erkend;
    if (!(p.bevoegdheden || []).includes('opvang')) {
      return { status: 403, error: 'In de samenwerking staat opvang niet als bevoegdheid.' };
    }
    return { ok: true, p };
  }

  function voorzieningMaak(req, b) {
    b = b || {};
    const p = partners.vind(b.partnerId);
    if (!p) return { status: 404, error: 'Deze partner staat niet in het register.' };
    const g = kantoor(req, p.stad); if (!g.ok) return g;
    if (p.status !== 'actief' || !(p.bevoegdheden || []).includes('opvang')) {
      return { status: 403, error: 'Alleen een actieve partner met de bevoegdheid opvang kan een voorziening dragen.' };
    }
    const naam = schoon(b.naam, 120);
    if (naam.length < 2) return { status: 400, error: 'Hoe heet de voorziening?' };
    const soort = ['nachtopvang', 'crisisopvang', 'begeleid_wonen'].includes(String(b.soort))
      ? String(b.soort) : null;
    if (!soort) return { status: 400, error: 'Kies nachtopvang, crisisopvang of begeleid_wonen.' };
    const v = { id: rid(), stad: p.stad, partnerId: p.id, naam, soort,
      actief: true, capaciteit: null, at: nu() };
    voorzieningen().push(v);
    audit(g.w.key, 'opvang.voorziening', v.id, p.naam);
    save();
    return { ok: true, voorziening: voorzieningBeeld(v) };
  }

  function lijst(req, stad) {
    const g = kantoor(req, stad); if (!g.ok) return g;
    const rijen = reserveringen().filter(r => r.stad === g.stad.id).map(verval);
    return { ok: true,
      voorzieningen: voorzieningen().filter(v => v.stad === g.stad.id).map(voorzieningBeeld),
      reserveringen: rijen.map(reserveBeeld) };
  }

  function aanvraag(req, b) {
    b = b || {};
    const z = beschermzaak.vind(b.zaakId);
    if (!z) return { status: 404, error: 'Deze beschermzaak bestaat niet.' };
    const g = kantoor(req, z.stad); if (!g.ok) return g;
    if (z.aanleiding !== 'dakloos') return { status: 400, error: 'Deze opvangroute hoort bij een zaak met aanleiding dakloos.' };
    if (!['stabilisatie', 'overdracht'].includes(z.stand) || !z.toestemming || z.ingetrokken || z.deurIngetrokken) {
      return { status: 403, error: 'Voor een opvangaanvraag moet de veiligheidsintake zijn gedaan en de toestemming voor deze ontvanger staan.' };
    }
    const v = voorzieningVan(b.voorzieningId);
    if (!v || !v.actief || v.stad !== z.stad) return { status: 404, error: 'Deze actieve opvangvoorziening bestaat hier niet.' };
    const p = partners.vind(v.partnerId);
    if (!p || String(z.toestemming.ontvanger).toLowerCase() !== String(p.naam).toLowerCase()) {
      return { status: 403, error: 'De toestemming noemt niet de aanbieder van deze voorziening. Vraag gericht toestemming.' };
    }
    const idem = schoon(b.idempotentie, 80);
    if (!idem) return { status: 400, error: 'Geef een idempotentiesleutel mee, zodat herhalen geen tweede aanvraag maakt.' };
    const bestaand = reserveringen().find(r => r.zaakId === z.id && r.idempotentie === idem);
    if (bestaand) return { ok: true, herhaald: true, reservering: reserveBeeld(verval(bestaand)) };
    if (reserveringen().some(r => r.zaakId === z.id && OPEN.includes(verval(r).status))) {
      return { status: 409, error: 'Voor deze zaak loopt al een opvangaanvraag. Sluit of herstel die eerst.' };
    }
    const financiering = String(b.financiering || '');
    if (!FINANCIERING.includes(financiering)) {
      return { status: 400, error: 'Leg vast: niet_vereist, besluit_bevestigd of nood_voor_besluit.' };
    }
    const noodreden = schoon(b.noodreden, 240);
    if (financiering === 'nood_voor_besluit' && noodreden.length < 5) {
      return { status: 400, error: 'Waarom kan deze noodplaats niet op een regulier besluit wachten?' };
    }
    const r = { id: rid(), zaakId: z.id, stad: z.stad, codenaam: z.codenaam,
      voorzieningId: v.id, partnerId: p.id, status: 'aangevraagd',
      verantwoordelijke: g.w.key, financiering, noodreden: noodreden || null,
      idempotentie: idem, aangevraagdOp: nu(), geaccepteerdOp: null,
      geldigTot: null, aankomst: null, vervolgplan: null, weigering: null, stop: null };
    reserveringen().push(r);
    z.civilisRoute = { fase: 'plek_aangevraagd', bijgewerkt: nu() };
    (z.stappen = z.stappen || []).push({ stand: z.stand,
      tekst: 'Opvangplek aangevraagd; nog niet bevestigd.', door: g.w.key, at: nu() });
    audit(g.w.key, 'opvang.aangevraagd', z.codenaam, r.id);
    save();
    return { ok: true, reservering: reserveBeeld(r),
      melding: 'Aangevraagd. Dit is nog geen bevestigde plek; alleen de aanbieder kan accepteren.' };
  }

  const partnerDeel = require('./opvang-partner')(ctx, { beschermzaak,
    voorzieningen, reserveringen, voorzieningVan, reserveringVan, capaciteitVers,
    reserveBeeld, voorzieningBeeld, verval, partnerOpCode, stopVoorZaak, tijd });

  function vervolgplan(req, b) {
    b = b || {};
    const r = reserveringVan(b.id);
    if (!r) return { status: 404, error: 'Deze reservering bestaat niet.' };
    const g = kantoor(req, r.stad); if (!g.ok) return g;
    if (r.status !== 'aangekomen' && r.status !== 'vervolg') {
      return { status: 409, error: 'Een vervolgplan volgt op een bevestigde aankomst.' };
    }
    if (r.verantwoordelijke !== g.w.key && !g.w.landelijk) {
      return { status: 403, error: 'Alleen de zaakverantwoordelijke of het landelijke bestuur legt het vervolg vast.' };
    }
    const doel = schoon(b.doel, 240), actie = schoon(b.volgendeActie, 240);
    const op = schoon(b.op, 10);
    if (doel.length < 5 || actie.length < 5 || !/^\d{4}-\d{2}-\d{2}$/.test(op)) {
      return { status: 400, error: 'Vervolg vraagt een begrijpelijk doel, een volgende actie en een datum.' };
    }
    r.status = 'vervolg'; r.vervolgplan = { doel, volgendeActie: actie, op, door: g.w.key, at: nu() };
    const z = beschermzaak.vind(r.zaakId);
    if (z) z.civilisRoute = { fase: 'vervolg_gepland', bijgewerkt: nu() };
    audit(g.w.key, 'opvang.vervolgplan', r.codenaam, op);
    save();
    return { ok: true, reservering: reserveBeeld(r) };
  }

  function stopVoorZaak(zaakId, reden) {
    let aantal = 0;
    for (const r of reserveringen().filter(x => x.zaakId === String(zaakId || '') && OPEN.includes(x.status))) {
      r.status = 'ingetrokken'; r.stop = { reden: schoon(reden, 240) || 'ingetrokken', at: nu() };
      const v = voorzieningVan(r.voorzieningId);
      if (v && r.geaccepteerdOp && v.capaciteit && capaciteitVers(v)) v.capaciteit.beschikbaar += 1;
      audit('systeem', 'opvang.ingetrokken', r.codenaam, r.stop.reden); aantal++;
    }
    if (aantal) save();
    return aantal;
  }

  return { voorzieningMaak, lijst, aanvraag, partnerLijst: partnerDeel.partnerLijst,
    capaciteit: partnerDeel.capaciteit, besluit: partnerDeel.besluit,
    aankomst: partnerDeel.aankomst, vervolgplan, stopVoorZaak, voorzieningVan, reserveringVan,
    FINANCIERING, OPEN };
};
module.exports.FINANCIERING = FINANCIERING;
module.exports.OPEN = OPEN;
