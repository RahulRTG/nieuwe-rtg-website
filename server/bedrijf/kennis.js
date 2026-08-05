/* RTG Werk OS (deellaag): de kennisbank -- een intranet dat je kunt vertrouwen.

   Een wiki wordt niet waardeloos doordat er te weinig in staat, maar doordat
   er te veel in staat dat NIET MEER KLOPT en er niets aan te zien is. Daarom
   draagt elk artikel hier vier dingen die de meeste kennisbanken missen:

   1. EEN EIGENAAR MET EEN NAAM. Geen "team X"; een mens die je kunt vragen.
   2. EEN HOUDBAARHEIDSDATUM. Wie een artikel schrijft, zegt erbij hoe lang het
      geldig blijft. Daarna staat het als CONTROLE NODIG -- uitgerekend uit de
      datum en niet uit een vinkje dat iemand moet zetten.
   3. EEN VERSIE DIE GELDT. Een nieuwe versie laat de oude staan, maar die
      wordt "vervallen": leesbaar voor wie een oud besluit reconstrueert,
      nooit meer het antwoord op een zoekvraag.
   4. WIE HET MAG ZIEN. Een artikel kan aan rechten hangen; wie dat recht niet
      heeft, ziet het niet in de lijst en niet in de zoekresultaten. Een
      kennisbank die alleen bij het OPENEN afschermt, lekt via zijn eigen index.

   Wat hier NIET gebeurt: automatisch verouderde artikelen verwijderen. Kennis
   weggooien omdat een datum is verstreken, is precies hoe een organisatie haar
   geheugen verliest. */
'use strict';

const SOORTEN = ['procedure', 'handleiding', 'beleid', 'onboarding', 'architectuurbesluit',
  'verkoop', 'product', 'faq', 'lessons learned', 'nieuws'];

module.exports = (sctx) => {
  const { app, save, schoon, nu, rid, dag, werkPoort, log, eigenVeld } = sctx;

  const K = (w) => { if (!w.kennis) w.kennis = {}; return w.kennis; };
  const dagenTot = (d) => Math.round((Date.parse(d) - Date.parse(dag())) / 86400000);

  // de stand van een artikel: uitgerekend, nooit ingevuld
  function stand(a) {
    if (a.vervallen) return { stand: 'vervallen', reden: 'opgevolgd door versie ' + a.opgevolgdDoorVersie };
    if (!a.geldigTot) return { stand: 'geldig', reden: 'zonder houdbaarheidsdatum' };
    const dagen = dagenTot(a.geldigTot);
    if (dagen < 0) return { stand: 'controle nodig', reden: Math.abs(dagen) + ' dag(en) over de houdbaarheidsdatum', dagenTeGaan: dagen };
    if (dagen <= 30) return { stand: 'bijna toe aan controle', reden: 'nog ' + dagen + ' dag(en) geldig', dagenTeGaan: dagen };
    return { stand: 'geldig', reden: 'nog ' + dagen + ' dag(en) geldig', dagenTeGaan: dagen };
  }
  const mag = (g, a) => !a.recht || g.rechten.includes(a.recht);
  const kort = (g, a) => Object.assign({ id: a.id, titel: a.titel, soort: a.soort, eigenaar: a.eigenaar,
    versie: a.versie, geldigTot: a.geldigTot, laatstGecontroleerd: a.laatstGecontroleerd,
    recht: a.recht || null }, stand(a));

  app.post('/api/bedrijf/kennis/schrijf', (req, res) => {
    const g = werkPoort(req, res, 'kennis'); if (!g) return;
    const titel = schoon(req.body.titel, 120);
    const tekst = schoon(req.body.tekst, 20000);
    if (!titel || !tekst) return res.status(400).json({ error: 'Een artikel heeft een titel en een tekst.' });
    const soort = String(req.body.soort || 'procedure');
    if (!SOORTEN.includes(soort)) return res.status(400).json({ error: 'Kies een soort: ' + SOORTEN.join(', ') + '.' });
    const eigenaar = schoon(req.body.eigenaar, 60) || g.l.naam;
    if (!eigenaar) return res.status(400).json({ error: 'Wie is de eigenaar van dit artikel? Zonder mens om te vragen veroudert het ongemerkt.' });
    const recht = schoon(req.body.recht, 20) || null;
    if (recht && !sctx.RECHTEN.includes(recht)) return res.status(400).json({ error: 'Onbekend recht: ' + recht + '.' });

    /* Een nieuwe versie van een bestaand artikel: de oude blijft staan en
       wordt vervallen. Zo is een oud besluit nog te lezen, maar nooit meer
       het antwoord op een zoekvraag. */
    const opvolgVan = String(req.body.vervangtId || '');
    let versie = 1;
    if (opvolgVan) {
      const oud = eigenVeld(K(g.w), opvolgVan);
      if (!oud) return res.status(404).json({ error: 'Dat artikel kennen we niet.' });
      if (oud.vervallen) return res.status(409).json({ error: 'Die versie is zelf al vervallen; werk de geldige versie bij.' });
      versie = oud.versie + 1;
      oud.vervallen = true; oud.vervallenAt = nu(); oud.opgevolgdDoorVersie = versie;
    }
    const a = { id: rid(5), titel, tekst, soort, eigenaar, versie, recht,
      vorigeId: opvolgVan || null, vervallen: false,
      geldigTot: schoon(req.body.geldigTot, 10) || null,
      laatstGecontroleerd: dag(), at: nu(), door: g.l.naam };
    K(g.w)[a.id] = a;
    if (opvolgVan) eigenVeld(K(g.w), opvolgVan).opgevolgdDoorId = a.id;
    log(g.w, g.l, 'kennis-geschreven', a.id, titel + ' (versie ' + versie + ')');
    save();
    res.json({ ok: true, artikel: kort(g, a),
      let: a.geldigTot ? null : 'Zonder houdbaarheidsdatum blijft dit artikel eeuwig "geldig". Zet er een datum op; dat is het enige wat een kennisbank eerlijk houdt.' });
  });

  /* Nagekeken: de eigenaar zegt dat het nog klopt. Dat verschuift de
     houdbaarheid, en het is een handeling met een naam eronder -- geen knop
     die de datum stilletjes opschuift. */
  app.post('/api/bedrijf/kennis/nagekeken', (req, res) => {
    const g = werkPoort(req, res, 'kennis'); if (!g) return;
    const a = eigenVeld(K(g.w), String(req.body.artikelId || ''));
    if (!a) return res.status(404).json({ error: 'Dat artikel kennen we niet.' });
    if (a.vervallen) return res.status(409).json({ error: 'Een vervallen versie hoeft niet nagekeken te worden; werk de geldige versie bij.' });
    a.laatstGecontroleerd = dag();
    a.controles = (a.controles || []).concat([{ door: g.l.naam, at: nu() }]).slice(-50);
    if (req.body.geldigTot !== undefined) a.geldigTot = schoon(req.body.geldigTot, 10) || null;
    log(g.w, g.l, 'kennis-nagekeken', a.id, a.titel);
    save();
    res.json({ ok: true, artikel: kort(g, a) });
  });

  app.post('/api/bedrijf/kennis/lees', (req, res) => {
    const g = werkPoort(req, res, 'kennis'); if (!g) return;
    const a = eigenVeld(K(g.w), String(req.body.artikelId || ''));
    if (!a) return res.status(404).json({ error: 'Dat artikel kennen we niet.' });
    if (!mag(g, a)) return res.status(403).json({ error: 'Dit artikel is afgeschermd met het recht "' + a.recht + '".' });
    res.json({ ok: true, artikel: Object.assign({}, a, stand(a)),
      let: a.vervallen ? 'Dit is een OUDE versie; hij staat er om een besluit van toen te kunnen reconstrueren. De geldige versie staat onder opgevolgdDoorId.' : null });
  });

  /* Zoeken. De afscherming geldt ook HIER: wie het recht niet heeft, ziet het
     artikel niet in de resultaten. Een kennisbank die pas bij het openen
     afschermt, lekt via zijn eigen index (de titel verraadt vaak genoeg). */
  app.post('/api/bedrijf/kennis/zoek', (req, res) => {
    const g = werkPoort(req, res, 'kennis'); if (!g) return;
    const q = schoon(req.body.q, 80).toLowerCase();
    const metVervallen = req.body.ookVervallen === true;
    const alles = Object.values(K(g.w)).filter(a => mag(g, a));
    const treffers = alles
      .filter(a => metVervallen || !a.vervallen)
      .filter(a => !req.body.soort || a.soort === String(req.body.soort))
      .filter(a => !q || a.titel.toLowerCase().includes(q) || a.tekst.toLowerCase().includes(q))
      .sort((a, b) => String(b.at).localeCompare(String(a.at)));
    res.json({ ok: true, aantal: treffers.length, artikelen: treffers.slice(0, 100).map(a => kort(g, a)),
      verborgen: alles.length !== Object.values(K(g.w)).length
        ? Object.values(K(g.w)).length - alles.length : 0,
      let: 'Afgeschermde artikelen staan ook niet in deze uitslag; een index die de titel wel toont, is de afscherming kwijt.' });
  });

  app.post('/api/bedrijf/kennis/controlelijst', (req, res) => {
    const g = werkPoort(req, res, 'kennis'); if (!g) return;
    const rijen = Object.values(K(g.w)).filter(a => !a.vervallen && mag(g, a)).map(a => kort(g, a))
      .filter(a => a.stand === 'controle nodig' || a.stand === 'bijna toe aan controle')
      .sort((a, b) => (a.dagenTeGaan || 0) - (b.dagenTeGaan || 0));
    const zonderDatum = Object.values(K(g.w)).filter(a => !a.vervallen && !a.geldigTot && mag(g, a));
    res.json({ ok: true, aantal: rijen.length, artikelen: rijen,
      zonderHoudbaarheid: zonderDatum.map(a => ({ id: a.id, titel: a.titel, eigenaar: a.eigenaar })),
      let: 'Wat over de datum is, wordt NIET automatisch weggegooid. Kennis wissen omdat een datum verstreken is, is hoe een organisatie haar geheugen verliest.' });
  });

  // het nieuwsblok op het startscherm: de laatste geldige artikelen van soort 'nieuws'
  sctx.startBron('nieuws', 'kennis', (g) => {
    const rijen = Object.values(K(g.w)).filter(a => a.soort === 'nieuws' && !a.vervallen && mag(g, a))
      .sort((a, b) => String(b.at).localeCompare(String(a.at)));
    return { aantal: rijen.length, berichten: rijen.slice(0, 5).map(a => ({ id: a.id, titel: a.titel, at: a.at })) };
  });

  return { SOORTEN, stand };
};
