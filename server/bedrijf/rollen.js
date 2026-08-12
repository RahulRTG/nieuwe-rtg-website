/* RTG Werk OS (deellaag): rollen, rechten en het journaal.

   De drie keuzes die deze laag dragen -- rechten zijn werkwoorden en geen
   afdelingen, de zwaarste inzage vraagt een reden, en een externe ziet niets
   tenzij het gedeeld is -- staan bij de tabel waar ze in te zien zijn:
   ./rollen-register.js. Hier staat wat er met die tabel gebeurt: de poort,
   het journaal en de rollenkaart.

   Tijdelijke toegang staat hier ook: een rol met een einddatum vervalt vanzelf.
   Een tijdelijk recht dat je zelf moet intrekken, is een permanent recht. */
'use strict';

const { werkVeld } = require('./gebeurtenis');

/* De tabellen staan in ./rollen-register.js: wie een rol of een recht bijzet
   wil ze in een blik zien, en hier zouden ze de werking overwoekeren. */
const { REDEN_NODIG, RECHTEN, ROLLEN } = require('./rollen-register');

module.exports = (sctx) => {
  const { app, save, schoon, nu, rid, dag, beheerVan, lidVan, eigenVeld } = sctx;

  /* De geldige rollen van een lid. Een rol kan een venster hebben: `van` voor
     wie vooruit wordt klaargezet (de nieuwe collega van maandag mag vandaag
     nog niets) en `tot` voor tijdelijke toegang. Buiten het venster telt hij
     niet mee -- niet als "bijna" en niet als "nog even". */
  function rollenVan(l) {
    const vandaag = dag();
    return (l.rollen || [])
      .filter(r => (!r.van || r.van <= vandaag) && (!r.tot || r.tot >= vandaag))
      .map(r => r.id);
  }
  function rechtenVan(l) {
    const uit = new Set();
    for (const id of rollenVan(l)) {
      const r = ROLLEN.find(x => x.id === id);
      for (const recht of (r ? r.rechten : [])) uit.add(recht);
    }
    return [...uit];
  }
  const mag = (l, recht) => rechtenVan(l).includes(recht);
  const leest = (l) => rollenVan(l).some(id => (ROLLEN.find(x => x.id === id) || {}).alleenLezen);

  function log(w, wie, wat, waarover, reden) {
    w.journaal = (w.journaal || []);
    w.journaal.unshift({ id: rid(4), wie: wie && wie.naam ? wie.naam : 'beheer', wieId: wie ? wie.id : null,
      wat, waarover: waarover || null, reden: reden || null, at: nu() });
    w.journaal = w.journaal.slice(0, 20000);
  }

  /* De poort van de hele laag. Beheer-token = directie (alles), lid-token =
     de rechten van zijn rollen. Staat het recht in REDEN_NODIG, dan hoort er
     een reden bij, en die gaat het journaal in. */
  function werkPoort(req, res, recht) {
    const tok = String((req.body || {}).beheerToken || '');
    if (tok) {
      const w = beheerVan(req, res); if (!w) return null;
      return { w, l: { id: null, naam: 'beheer' }, directie: true, rechten: RECHTEN };
    }
    const s = lidVan(req, res); if (!s) return null;
    const rechten = rechtenVan(s.l);
    if (recht && !rechten.includes(recht)) {
      res.status(403).json({ error: 'Daar heeft u het recht "' + recht + '" voor nodig.', recht });
      return null;
    }
    if (recht && REDEN_NODIG.includes(recht)) {
      const reden = schoon(req.body.reden, 160);
      if (!reden) {
        res.status(400).json({ error: 'Deze inzage vraagt een reden; die komt in het journaal te staan (de inhoud niet).', redenNodig: true });
        return null;
      }
      log(s.w, s.l, 'inzage:' + recht, schoon(req.body.waarover, 60) || null, reden);
      save();
    }
    return { w: s.w, l: s.l, directie: false, rechten, alleenLezen: leest(s.l) };
  }

  /* ---------- de rollenkaart ---------- */
  app.post('/api/bedrijf/rollen', (req, res) => {
    const g = werkPoort(req, res); if (!g) return;
    res.json({ ok: true, rollen: ROLLEN, rechten: RECHTEN,
      mijn: { rollen: g.directie ? ['directie'] : rollenVan(g.l), rechten: g.rechten, alleenLezen: !!g.alleenLezen },
      let: 'Een rol is een bundel rechten. Een afdeling geeft op zichzelf geen inzage; dat scheelt de meeste stille toegang.' });
  });

  app.post('/api/bedrijf/lid/rollen', (req, res) => {
    const w = beheerVan(req, res); if (!w) return;
    const l = eigenVeld(w.leden, String(req.body.lidId || ''));
    if (!l) return res.status(404).json({ error: 'Dat lid kennen we niet.' });
    const gevraagd = Array.isArray(req.body.rollen) ? req.body.rollen : [];
    const onbekend = gevraagd.filter(r => !ROLLEN.some(x => x.id === String(r && r.id ? r.id : r)));
    if (onbekend.length) return res.status(400).json({ error: 'Onbekende rol: ' + onbekend.map(String).join(', ') + '.' });
    const tot = schoon(req.body.tot, 10) || null;
    const van = schoon(req.body.van, 10) || null;
    const had = new Set((l.rollen || []).map(r => r.id));
    const nieuw = [];
    for (const r of gevraagd) {
      const id = String(r && r.id ? r.id : r);
      const eind = (r && r.tot ? schoon(r.tot, 10) : tot) || null;
      const start = (r && r.van ? schoon(r.van, 10) : van) || null;
      if (start && eind && start > eind)
        return res.status(400).json({ error: 'Bij rol ' + id + ' ligt de begindatum na de einddatum.' });
      /* Een NIEUWE rol met een einddatum in het verleden is een typefout (2025
         in plaats van 2026) en geeft nooit toegang; die weigeren we. Een
         BESTAANDE rol met terugwerkende kracht beeindigen mag wel: dat is een
         gewone personeelshandeling, en hij komt in het journaal. */
      if (eind && eind < dag() && !had.has(id))
        return res.status(400).json({ error: 'Rol ' + id + ' zou al verlopen zijn voordat hij ingaat. Laat de einddatum weg of kies een datum vanaf vandaag.' });
      if (eind && eind < dag()) log(w, null, 'rol-beeindigd', l.id, id + ' per ' + eind);
      nieuw.push({ id, van: start, tot: eind, at: nu() });
    }
    // Een toegangswijziging gaat door de gebeurtenislaag: wie, wanneer, en de
    // reden als de aanroeper er een geeft. Zie ./gebeurtenis.js.
    const gm = werkVeld(w, 'lid', l, { rollen: nieuw },
      { actor: (req.body && req.body.door) || 'beheer', reden: schoon(req.body.reden, 500), bron: 'werk/rollen' });
    if (!gm.ok) return res.status(gm.status).json(gm);
    log(w, null, 'rollen-gezet', l.id, l.rollen.map(r => r.id + (r.tot ? ' tot ' + r.tot : '')).join(', '));
    save();
    res.json({ ok: true, lid: { id: l.id, naam: l.naam, rollen: l.rollen, rechten: rechtenVan(l) },
      let: tot ? 'Tijdelijke toegang vervalt vanzelf op ' + tot + '. Een tijdelijk recht dat je zelf moet intrekken, is een permanent recht.' : null });
  });

  app.post('/api/bedrijf/mijn-rechten', (req, res) => {
    const s = lidVan(req, res); if (!s) return;
    res.json({ ok: true, naam: s.l.naam, functie: s.l.functie, afdeling: s.l.afdeling,
      extern: !!s.l.extern, rollen: rollenVan(s.l), rechten: rechtenVan(s.l),
      verlopen: (s.l.rollen || []).filter(r => r.tot && r.tot < dag()).map(r => ({ id: r.id, tot: r.tot })),
      nogNiet: (s.l.rollen || []).filter(r => r.van && r.van > dag()).map(r => ({ id: r.id, van: r.van })) });
  });

  /* ---------- het journaal ----------
     Wie het journaal leest, staat er zelf in. Anders is een auditspoor een
     spiegel waar de kijker niet in voorkomt. */
  app.post('/api/bedrijf/journaal', (req, res) => {
    const g = werkPoort(req, res, 'journaal'); if (!g) return;
    const rijen = (g.w.journaal || []).filter(r => !req.body.wat || r.wat === String(req.body.wat));
    res.json({ ok: true, aantal: rijen.length, regels: rijen.slice(0, 500),
      let: 'Uw inzage staat zelf ook in dit journaal. Een auditspoor waar de kijker niet in voorkomt, is een spiegel met een gat erin.' });
  });

  return { ROLLEN, RECHTEN, REDEN_NODIG, werkPoort, log, mag, rollenVan, rechtenVan };
};

/* De tabellen ook los, naast de factory. Ze zijn pure data en er zijn lezers
   buiten deze laag -- kern/onderneming/toegang.js legt de twee rechtenmodellen
   van dit huis naast elkaar. Overtypen daar zou een tweede waarheid geven over
   welke inzage een reden vraagt. */
module.exports.ROLLEN = ROLLEN;
module.exports.RECHTEN = RECHTEN;
module.exports.REDEN_NODIG = REDEN_NODIG;
