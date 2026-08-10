/* RTG Werk OS (deellaag): de HANDHAVING van de bedrijfsregels.

   ./regels.js draagt wat er is afgesproken; dit bestand is de plek waar het
   iets tegenhoudt. Dat is geen indeling voor de netheid maar de kern van de
   ontwerpregel van deze laag: een regel bestaat pas als er code is die hem
   afdwingt, en die code is dit.

   HET AANGRIJPINGSPUNT is het activeren van een contract. `herzie` is de ENIGE
   plek in dit huis die de status van een contract op actief zet of terugzet;
   contract.js deed dat vroeger zelf, maar er is een tweede voorwaarde bij
   gekomen (de goedkeuringen die een regel eist) en twee plekken die bepalen
   wanneer een contract actief is, lopen uiteen (LAT-regel 4).

   DRIE GRENDELS, en ze komen alle drie uit de vraag "hoe zou ik hier onderuit
   komen?":

   1. EEN MENS KEURT EEN KEER GOED. Wie 'recht' en 'geld.goedkeuren' allebei
      draagt, kan niet in zijn eentje een vier-ogen-regel afvinken.
   2. HET BEHEER-TOKEN KEURT NIET -- dezelfde regel als bij het stemmen over een
      besluit: anders staat er een goedkeuring zonder gezicht.
   3. EEN GOEDKEURING GELDT VOOR HET BEDRAG WAAROP HIJ IS GEGEVEN. Gaat de
      waarde omhoog, dan vervalt hij. Zonder die grendel is de hele laag te
      omzeilen met een contract van een euro dat je achteraf ophoogt, en dat is
      niet theoretisch maar de makkelijkste weg eromheen. */
'use strict';

const WACHT = 'wacht op goedkeuring';

module.exports = (sctx) => {
  const { app, save, nu, rid, werkPoort, log, eigenVeld } = sctx;

  /* De stand van een contract tegenover de regels: wat eisen ze samen, wie
     heeft er getekend, en wat ontbreekt er nog. Eén functie, want zowel het
     tekenen, het goedkeuren als het wijzigen van het bedrag stelt dezelfde
     vraag -- en drie antwoorden op één vraag lopen uiteen. */
  function stand(w, c) {
    const regels = sctx.regelsVoor(w, c);
    const eist = [...new Set(regels.flatMap(r => r.eist))];
    const geldig = (c.goedkeuringen || []).filter(k => !k.vervallen);
    const gedekt = new Set(geldig.map(k => k.recht));
    const ontbreekt = eist.filter(x => !gedekt.has(x));
    const beide = ['wij', 'wederpartij'].every(p => (c.handtekeningen || []).some(h => h.partij === p));
    return { regels, eist, goedkeuringen: geldig, ontbreekt, handtekeningenCompleet: beide,
      mag: beide && !ontbreekt.length };
  }

  /* De ENIGE plek die de status van een contract op actief zet of terugzet.
     Raakt nooit een contract dat is opgezegd of verlopen: dat zijn eindstanden
     en geen wachtkamer. */
  function herzie(w, c) {
    const s = stand(w, c);
    if (c.status === 'opgezegd' || c.status === 'verlopen') return s;
    if (s.mag) { if (c.status !== 'actief') { c.status = 'actief'; c.actiefAt = nu(); } }
    else if (s.handtekeningenCompleet) { c.status = WACHT; }
    else if (c.status === 'actief' || c.status === WACHT) { c.status = 'concept'; }
    return s;
  }

  /* Een goedkeuring geldt voor het bedrag waarop hij is gegeven. Gaat de waarde
     omhoog, dan vervalt hij -- met het bedrag van toen erbij, zodat achteraf te
     lezen is waar iemand ja tegen zei. */
  function herwaardeer(w, c, oudCenten) {
    if (Number(c.waardeCenten || 0) <= Number(oudCenten || 0)) return herzie(w, c);
    for (const k of c.goedkeuringen || []) {
      if (!k.vervallen && Number(c.waardeCenten || 0) > Number(k.bijWaardeCenten || 0)) {
        k.vervallen = { reden: 'de waarde ging omhoog van ' + (k.bijWaardeCenten / 100) + ' naar ' + (c.waardeCenten / 100), at: nu() };
      }
    }
    return herzie(w, c);
  }

  /* ---------- goedkeuren ---------- */
  app.post('/api/bedrijf/contract/keur', (req, res) => {
    /* Geen recht in de poort: WELK recht u claimt is hier juist de vraag. De
       jurist heeft 'recht' en niet 'geld', de CFO andersom -- porten op één van
       de twee zou de ander buitensluiten. */
    const g = werkPoort(req, res); if (!g) return;
    if (g.directie) return res.status(403).json({
      error: 'Goedkeuren doet een lid met een eigen sleutel, niet het beheer-token. Anders staat er straks een goedkeuring zonder gezicht.' });
    const c = eigenVeld(sctx.CONTRACTEN(g.w), String(req.body.contractId || ''));
    if (!c) return res.status(404).json({ error: 'Dat contract kennen we niet.' });
    const recht = String(req.body.recht || '');
    if (!g.rechten.includes(recht)) return res.status(403).json({
      error: 'U draagt het recht "' + recht + '" niet, dus u kunt daar niet namens goedkeuren.' });

    const s = stand(g.w, c);
    if (!s.eist.includes(recht)) return res.status(409).json({
      error: 'Geen enkele regel vraagt bij dit contract om een goedkeuring namens "' + recht + '".',
      eist: s.eist,
      let: s.eist.length ? null : 'Dit contract valt onder geen enkele regel; het heeft alleen de twee handtekeningen nodig.' });
    if (!Array.isArray(c.goedkeuringen)) c.goedkeuringen = [];
    if (c.goedkeuringen.some(k => k.lidId === g.l.id && !k.vervallen)) return res.status(409).json({
      error: 'U heeft dit contract al goedgekeurd. Eén mens keurt één keer goed -- anders vinkt iemand met twee rechten een vier-ogen-regel in zijn eentje af.' });

    c.goedkeuringen.push({ id: rid(3), lidId: g.l.id, naam: g.l.naam, recht,
      bijWaardeCenten: Number(c.waardeCenten || 0), at: nu(), vervallen: null });
    const na = herzie(g.w, c);
    log(g.w, g.l, 'contract-goedgekeurd', c.id, recht);
    save();
    res.json({ ok: true, status: c.status, ontbreekt: na.ontbreekt,
      let: na.mag ? 'Alles rond: het contract staat op actief.'
        : na.ontbreekt.length ? 'Nog nodig: goedkeuring namens ' + na.ontbreekt.join(' en ') + '.'
          : 'De goedkeuringen zijn rond; er ontbreekt nog een handtekening.' });
  });

  app.post('/api/bedrijf/contract/keuring', (req, res) => {
    const g = werkPoort(req, res, 'recht'); if (!g) return;
    const c = eigenVeld(sctx.CONTRACTEN(g.w), String(req.body.contractId || ''));
    if (!c) return res.status(404).json({ error: 'Dat contract kennen we niet.' });
    const s = stand(g.w, c);
    res.json({ ok: true, status: c.status, eist: s.eist, ontbreekt: s.ontbreekt,
      handtekeningenCompleet: s.handtekeningenCompleet,
      goedkeuringen: s.goedkeuringen.map(k => ({ naam: k.naam, recht: k.recht, at: k.at, bijEuro: k.bijWaardeCenten / 100 })),
      vervallen: (c.goedkeuringen || []).filter(k => k.vervallen)
        .map(k => ({ naam: k.naam, recht: k.recht, reden: k.vervallen.reden })),
      regels: s.regels.map(r => ({ id: r.id, bovenEuro: r.bovenCenten / 100, eist: r.eist })),
      let: s.regels.length ? null : 'Dit contract valt onder geen enkele regel: alleen de twee handtekeningen.' });
  });

  return { regelHerzie: herzie, regelHerwaardeer: herwaardeer, regelStand: stand };
};
