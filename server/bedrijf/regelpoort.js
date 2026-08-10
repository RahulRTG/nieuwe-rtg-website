/* RTG Werk OS (deellaag): de HANDHAVING van de bedrijfsregels.

   ./regels.js draagt wat er is afgesproken; dit bestand is de plek waar het
   iets tegenhoudt. Dat is geen indeling voor de netheid maar de kern van de
   ontwerpregel van deze laag: een regel bestaat pas als er code is die hem
   afdwingt, en die code is dit.

   EEN GOEDKEURROUTE VOOR ALLE SOORTEN. /api/bedrijf/keur werkt op een contract
   en op een besluit, en straks op wat er bij komt. Twee routes die hetzelfde
   doen, lopen uiteen zodra er een grendel bij komt -- en juist bij een
   goedkeuring is dat de grendel die je kwijtraakt (LAT-regel 4).

   TWEE AANGRIJPINGSPUNTEN, DIE VERSCHILLEND TEGENHOUDEN:

     contract -> `herzie` is de ENIGE plek in dit huis die de status van een
                 contract op actief zet of terugzet. contract.js deed dat
                 vroeger zelf, maar er is een tweede voorwaarde bij gekomen.
     besluit  -> `magSluiten` weigert het sluiten van de stemronde. Er wordt
                 hier niets aan de status van een besluit gedraaid: een besluit
                 dat blijft staan waar het stond, is eerlijker dan een besluit
                 dat een eigen wachtstand krijgt die de rest van de laag niet
                 kent.

   DRIE GRENDELS, en ze komen alle drie uit de vraag "hoe zou ik hier onderuit
   komen?":

   1. EEN MENS KEURT EEN KEER GOED PER OBJECT. Wie 'recht' en 'geld.goedkeuren'
      allebei draagt, kan niet in zijn eentje een vier-ogen-regel afvinken.
   2. HET BEHEER-TOKEN KEURT NIET -- dezelfde regel als bij het stemmen over een
      besluit: anders staat er een goedkeuring zonder gezicht.
   3. EEN GOEDKEURING GELDT VOOR HET BEDRAG WAAROP HIJ IS GEGEVEN. Gaat de
      waarde van een contract omhoog, dan vervalt hij. Zonder die grendel is de
      hele laag te omzeilen met een contract van een euro dat je achteraf
      ophoogt, en dat is niet theoretisch maar de makkelijkste weg eromheen. */
'use strict';

const WACHT = 'wacht op goedkeuring';

module.exports = (sctx) => {
  const { app, save, nu, rid, werkPoort, log, eigenVeld } = sctx;

  /* Waar een soort woont. Eén tabel, zodat de goedkeurroute niet per soort een
     eigen tak krijgt -- dezelfde reden waarom kern/command/register.js bestaat. */
  const BAK = {
    contract: (w) => sctx.CONTRACTEN(w),
    besluit: (w) => sctx.BESLUITEN(w)
  };
  const vind = (w, soort, id) => (BAK[soort] ? eigenVeld(BAK[soort](w), String(id || '')) : null);

  /* De stand van een object tegenover de regels: wat eisen ze samen, wie heeft
     er goedgekeurd, en wat ontbreekt er nog. Eén functie, want het tekenen, het
     goedkeuren, het wijzigen van een bedrag en het sluiten van een stemronde
     stellen dezelfde vraag -- en vier antwoorden op één vraag lopen uiteen. */
  function stand(w, soort, obj) {
    const regels = sctx.regelsVoor(w, soort, obj);
    const eist = [...new Set(regels.flatMap(r => r.eist))];
    const geldig = (obj.goedkeuringen || []).filter(k => !k.vervallen);
    const gedekt = new Set(geldig.map(k => k.recht));
    const ontbreekt = eist.filter(x => !gedekt.has(x));
    const beide = soort !== 'contract' ||
      ['wij', 'wederpartij'].every(p => (obj.handtekeningen || []).some(h => h.partij === p));
    return { regels, eist, goedkeuringen: geldig, ontbreekt, handtekeningenCompleet: beide,
      mag: beide && !ontbreekt.length };
  }

  /* De ENIGE plek die de status van een contract op actief zet of terugzet.
     Raakt nooit een contract dat is opgezegd of verlopen: dat zijn eindstanden
     en geen wachtkamer. */
  function herzie(w, c) {
    const s = stand(w, 'contract', c);
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

  /* De poort van het besluit. Geen eigen wachtstand: hij zegt ja of nee, en de
     aanroeper (bedrijf/besluit.js) weigert met de reden erbij. */
  const magSluiten = (w, b) => stand(w, 'besluit', b);

  /* ---------- goedkeuren ---------- */
  app.post('/api/bedrijf/keur', (req, res) => {
    /* Geen recht in de poort: WELK recht u claimt is hier juist de vraag. De
       jurist heeft 'recht' en niet 'geld', de CFO andersom -- porten op een van
       de twee zou de ander buitensluiten. */
    const g = werkPoort(req, res); if (!g) return;
    if (g.directie) return res.status(403).json({
      error: 'Goedkeuren doet een lid met een eigen sleutel, niet het beheer-token. Anders staat er straks een goedkeuring zonder gezicht.' });
    const soort = String(req.body.soort || '');
    if (!BAK[soort]) return res.status(400).json({ error: 'Goedkeuren kan bij: ' + Object.keys(BAK).join(', ') + '.' });
    const obj = vind(g.w, soort, req.body.id);
    if (!obj) return res.status(404).json({ error: 'Dat ' + soort + ' kennen we niet.' });
    const recht = String(req.body.recht || '');
    if (!g.rechten.includes(recht)) return res.status(403).json({
      error: 'U draagt het recht "' + recht + '" niet, dus u kunt daar niet namens goedkeuren.' });

    const s = stand(g.w, soort, obj);
    if (!s.eist.includes(recht)) return res.status(409).json({
      error: 'Geen enkele regel vraagt bij dit ' + soort + ' om een goedkeuring namens "' + recht + '".',
      eist: s.eist,
      let: s.eist.length ? null
        : 'Dit ' + soort + ' valt onder geen enkele regel' + (soort === 'contract'
          ? '; het heeft alleen de twee handtekeningen nodig.' : '.') });
    if (!Array.isArray(obj.goedkeuringen)) obj.goedkeuringen = [];
    if (obj.goedkeuringen.some(k => k.lidId === g.l.id && !k.vervallen)) return res.status(409).json({
      error: 'U heeft dit ' + soort + ' al goedgekeurd. Eén mens keurt één keer goed -- anders vinkt iemand met twee rechten een vier-ogen-regel in zijn eentje af.' });

    obj.goedkeuringen.push({ id: rid(3), lidId: g.l.id, naam: g.l.naam, recht,
      bijWaardeCenten: Number(obj.waardeCenten || 0), at: nu(), vervallen: null });
    const na = soort === 'contract' ? herzie(g.w, obj) : stand(g.w, soort, obj);
    log(g.w, g.l, soort + '-goedgekeurd', obj.id, recht);
    save();
    res.json({ ok: true, soort, status: obj.status, ontbreekt: na.ontbreekt,
      let: na.ontbreekt.length ? 'Nog nodig: goedkeuring namens ' + na.ontbreekt.join(' en ') + '.'
        : soort === 'contract'
          ? (na.mag ? 'Alles rond: het contract staat op actief.' : 'De goedkeuringen zijn rond; er ontbreekt nog een handtekening.')
          : 'De goedkeuringen zijn rond; de stemronde kan gesloten worden.' });
  });

  app.post('/api/bedrijf/keuring', (req, res) => {
    const g = werkPoort(req, res); if (!g) return;
    const soort = String(req.body.soort || '');
    if (!BAK[soort]) return res.status(400).json({ error: 'Keuring bestaat voor: ' + Object.keys(BAK).join(', ') + '.' });
    /* Het recht van de MODULE zelf blijft gelden: wie geen contracten mag zien,
       leest hier ook geen contractstand. */
    const nodig = soort === 'contract' ? 'recht' : 'besluit';
    if (!g.rechten.includes(nodig)) return res.status(403).json({ error: 'Daarvoor mist u het recht "' + nodig + '".' });
    const obj = vind(g.w, soort, req.body.id);
    if (!obj) return res.status(404).json({ error: 'Dat ' + soort + ' kennen we niet.' });
    const s = stand(g.w, soort, obj);
    res.json({ ok: true, soort, status: obj.status, eist: s.eist, ontbreekt: s.ontbreekt,
      handtekeningenCompleet: s.handtekeningenCompleet,
      goedkeuringen: s.goedkeuringen.map(k => ({ naam: k.naam, recht: k.recht, at: k.at,
        bijEuro: soort === 'contract' ? k.bijWaardeCenten / 100 : null })),
      vervallen: (obj.goedkeuringen || []).filter(k => k.vervallen)
        .map(k => ({ naam: k.naam, recht: k.recht, reden: k.vervallen.reden })),
      regels: s.regels.map(r => ({ id: r.id, bovenEuro: r.bovenCenten == null ? null : r.bovenCenten / 100,
        besluitSoort: r.besluitSoort || null, eist: r.eist })),
      let: s.regels.length ? null : 'Dit ' + soort + ' valt onder geen enkele regel.' });
  });

  return { regelHerzie: herzie, regelHerwaardeer: herwaardeer, regelStand: stand, regelMagSluiten: magSluiten };
};
