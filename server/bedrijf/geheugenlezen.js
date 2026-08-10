/* RTG Werk OS (deellaag): het geheugen van een besluit -- DE LEESKANT.

   De schrijfkant staat in ./geheugen.js (koppelen, intrekken, evalueren) en
   draagt de doctrine; dit bestand beantwoordt de twee vragen die eruit volgen:

     "Waarom hebben we dit gedaan?"          -> /api/bedrijf/besluit/geheugen
     "Welke besluiten raken DIT object?"     -> besluitenOver(), voor het dossier

   DE REGEL DIE DIT BESTAND DRAAGT: iedere lezer lost de gekoppelde objecten op
   met ZIJN EIGEN register. Drie standen, en geen ervan is stilte -- het object
   staat er (met de titel van nu naast die van toen), het is weg (dan blijft de
   titel van toen), of de lezer mag die soort niet zien. Dat laatste wordt
   GETELD en niet benoemd: een lijst die de titel wel toont is de afscherming
   kwijt. Dezelfde vorm die de kennisbank al gebruikt met `verborgen: n`. */
'use strict';

const { maakWerkRegister } = require('../kern/werkcommand/register');

module.exports = (sctx) => {
  const { app, db, dag, werkPoort, eigenVeld } = sctx;
  const B = (w) => sctx.BESLUITEN(w);

  const besluitVan = (req, res, g) => {
    const b = eigenVeld(B(g.w), String((req.body || {}).besluitId || ''));
    if (!b) { res.status(404).json({ error: 'Dat besluit kennen we niet.' }); return null; }
    return b;
  };

  /* De objecten van een besluit, opgelost met het register van de LEZER.
     Drie standen, en geen ervan is stilte: hij staat er, hij is weg (met de
     titel van toen), of u mag die soort niet zien (geteld, niet benoemd). */
  function objectenVoor(register, db, b) {
    const uit = [], verborgen = {};
    for (const k of sctx.RAAKT(b)) {
      const soort = register.OP_TYPE.get(k.type);
      if (!soort) { verborgen[k.type] = (verborgen[k.type] || 0) + 1; continue; }
      const rij = register.vindRij(db, k.type, k.id);
      uit.push({ koppelId: k.koppelId, type: k.type, id: k.id,
        titelToen: k.titelToen, subToen: k.subToen, door: k.door, at: k.at, terug: k.terug || null,
        stand: rij ? 'bestaat' : 'verdwenen',
        titelNu: rij ? register.kort(soort, rij).titel : null,
        hernoemd: !!(rij && register.kort(soort, rij).titel !== k.titelToen) });
    }
    return { objecten: uit, verborgen };
  }

  /* ---------- het geheugen van één besluit, in één antwoord ---------- */
  app.post('/api/bedrijf/besluit/geheugen', (req, res) => {
    const g = werkPoort(req, res, 'besluit'); if (!g) return;
    const b = besluitVan(req, res, g); if (!b) return;
    const register = maakWerkRegister(g.w.code, g.rechten);
    const { objecten, verborgen } = objectenVoor(register, db, b);
    const verborgenTotaal = Object.values(verborgen).reduce((n, x) => n + x, 0);
    res.json({ ok: true,
      besluit: { id: b.id, titel: b.titel, soort: b.soort, status: b.status, eigenaar: b.eigenaar,
        onderbouwing: b.onderbouwing, alternatieven: b.alternatieven || [],
        at: b.at, door: b.door, geslotenAt: b.geslotenAt || null, geslotenDoor: b.geslotenDoor || null,
        telling: b.telling || null, evalueerOp: b.evalueerOp || null },
      adviezen: b.adviezen || [], bezwaren: b.bezwaren || [],
      stemmen: (b.stemmen || []).map(s => ({ naam: s.naam, stem: s.stem, toelichting: s.toelichting, at: s.at })),
      evaluaties: b.evaluaties || [],
      raakt: objecten, verborgen: verborgenTotaal,
      let: [
        b.bezwaren && b.bezwaren.length ? 'De ' + b.bezwaren.length + ' bezwaar/bezwaren staan er nog; dat is het eerste wat je bij een evaluatie wilt lezen.' : null,
        verborgenTotaal ? verborgenTotaal + ' gekoppeld(e) object(en) vallen onder een soort waar u geen recht op heeft. Ze worden geteld en niet benoemd.' : null,
        objecten.some(o => o.stand === 'verdwenen') ? 'Een verdwenen object staat er met de titel die het TOEN had; het besluit ging er wel degelijk over.' : null,
        b.status === 'aangenomen' && !(b.evaluaties || []).length && b.evalueerOp && b.evalueerOp <= dag()
          ? 'De evaluatiedatum is verstreken en er staat nog geen uitkomst. Een datum zonder uitkomst is een agendapunt.' : null
      ].filter(Boolean).join(' ') || null });
  });

  /* De omgekeerde vraag, voor het objectdossier: welke besluiten raken DIT
     object? Eén implementatie, hier, want inzicht.js zou er anders een tweede
     naast zetten (LAT-regel 4). De aanroeper poort het recht 'besluit'. */
  function besluitenOver(w, type, id) {
    return Object.values(B(w))
      .map(b => {
        const k = (Array.isArray(b.raakt) ? b.raakt : []).find(x => x.type === type && x.id === String(id));
        return k ? { id: b.id, titel: b.titel, soort: b.soort, status: b.status,
          at: b.at, geslotenAt: b.geslotenAt || null,
          bezwaren: (b.bezwaren || []).length, evaluaties: (b.evaluaties || []).length,
          gekoppeldDoor: k.door, gekoppeldAt: k.at, ingetrokken: k.terug || null } : null;
      })
      .filter(Boolean)
      .sort((a, b2) => String(b2.at).localeCompare(String(a.at)));
  }

  /* ---------- welke besluiten gaan nergens over ----------
     Het besluitgeheugen begint op de dag dat het gebouwd is: alles van daarvoor
     draagt geen koppelingen. Die schuld hoort ZICHTBAAR te zijn in het product
     en niet alleen in een takenlijst, want daar kijkt niemand die aan het werk
     is. Wat hier NIET gebeurt is raden: er is geen tekstzoeker die de
     onderbouwing afspeurt naar namen van klanten en contracten. Dan koppelt de
     machine een besluit aan een klant omdat de naam toevallig in een zin staat,
     en dat bederft een geheugen in plaats van het te vullen. Een koppeling is
     een uitspraak van een mens die erbij was. */
  app.post('/api/bedrijf/besluiten/zonder-koppeling', (req, res) => {
    const g = werkPoort(req, res, 'besluit'); if (!g) return;
    const rijen = Object.values(B(g.w))
      .filter(b => !(Array.isArray(b.raakt) ? b.raakt : []).some(k => !k.terug))
      .map(b => ({ id: b.id, titel: b.titel, soort: b.soort, status: b.status,
        eigenaar: b.eigenaar, at: b.at,
        ingetrokkenKoppelingen: (Array.isArray(b.raakt) ? b.raakt : []).filter(k => k.terug).length }))
      .sort((a, b2) => String(b2.at).localeCompare(String(a.at)));
    res.json({ ok: true, aantal: rijen.length, besluiten: rijen,
      let: rijen.length
        ? 'Deze besluiten gaan volgens de administratie nergens over. Voor alles van voor het besluitgeheugen is dat geen fout maar een gat -- leg de koppeling met /api/bedrijf/besluit/raakt, maar alleen als u weet waar het over ging. Er wordt hier niets geraden: een besluit dat de machine aan een klant koppelt omdat de naam in een zin staat, bederft dit geheugen.'
        : 'Elk besluit is aan minstens een object gekoppeld.' });
  });

  return { besluitenOver };
};
