/* Gemeente-domein "meldingen": pijler 1, meldingen openbare ruimte. Een inwoner
   meldt iets kapots of vies (met optionele GPS), de melding gaat naar de juiste
   ploeg en de melder volgt de status. De gemeente-medewerker ziet de behandelijst
   en werkt de status bij. Plus de AI-triage die categorie en ploeg voorstelt
   (Claude met een deterministische regel-fallback). Krijgt de gedeelde ctx van
   kern/gemeente/index.js. */
const { coord } = require('../util');
module.exports = (ctx) => {
  const { db, save, anthropic, nu, id, ref, schoon, seed, deGemeente, publiekeMelding,
    notify, notifySupplier, sseToSupplier, weefsel, CATS, PLOEG, MELD_STATUS } = ctx;

  function meld(sess, codenaam, data) {
    seed();
    data = data || {};
    const categorie = CATS[data.categorie] ? data.categorie : 'overig';
    const tekst = schoon(data.tekst, 500);
    if (tekst.length < 4) return { status: 400, error: 'Omschrijf kort wat er aan de hand is.' };
    const g = deGemeente();
    const m = {
      id: id(), ref: ref('M'), gemeente: g ? g.code : 'GEMEENTE',
      categorie, categorieLabel: CATS[categorie], tekst,
      locatie: schoon(data.locatie, 120) || null,
      lat: coord(data.lat, 90) || null, lng: coord(data.lng, 180) || null,
      melderKey: sess.key, melder: codenaam,
      status: 'nieuw', ploeg: PLOEG[categorie], updates: [], at: nu()
    };
    db.data.gemeenteMeldingen.unshift(m);
    db.data.gemeenteMeldingen = db.data.gemeenteMeldingen.slice(0, 20000);
    /* En dezelfde melding gaat als WAARNEMING naar het stadsweefsel. Twee
       waarheden zijn dat niet: dit dossier is de BEHANDELING van de gemeente
       (ploeg, updates, status naar de melder), de zaak in het weefsel is het
       PROBLEEM in de stad -- en die kan er een zijn terwijl er vier mensen
       over belden via vier kanalen. De zaakverwijzing gaat mee terug, zodat
       een ambtenaar kan zien dat zijn melding bij een grotere zaak hoort.
       Faalt het weefsel, dan gaat de melding gewoon door: het meldrecht van
       een inwoner mag niet afhangen van een zijtak. */
    if (weefsel) {
      const w = weefsel.weefselMeld({ kanaal: 'gemeente', categorie: m.categorie, tekst: m.tekst,
        lat: m.lat, lng: m.lng, gebied: m.locatie, melder: codenaam, bronRef: m.ref });
      if (w && w.ok) { m.zaak = w.zaak.ref; m.zaakId = w.zaak.id; m.samengevoegd = w.duplicaat; }
      /* Lukt het niet -- meestal omdat er geen positie meegestuurd is en de
         vrije tekst "bij de brug" geen gebied is -- dan staat DAT op de
         melding. Stil overslaan zou betekenen dat een melding zonder GPS
         onzichtbaar buiten de stadszaken valt en niemand weet waarom. */
      else if (w && w.error) m.zaakFout = w.error;
    }
    save();
    if (g && notifySupplier) notifySupplier(g.code, { icon: '\u{1F6A7}', title: 'Nieuwe melding: ' + CATS[categorie], body: codenaam + ': ' + tekst.slice(0, 80) });
    if (g && sseToSupplier) sseToSupplier(g.code, 'sync', { scope: 'gemeente' });
    return { ok: true, melding: publiekeMelding(m) };
  }
  function mijnMeldingen(key) {
    return (db.data.gemeenteMeldingen || []).filter(m => m.melderKey === key).slice(0, 50).map(publiekeMelding);
  }

  /* ---- gemeente-medewerkers ---- */
  function meldingenLijst(filter) {
    seed();
    filter = filter || {};
    let list = (db.data.gemeenteMeldingen || []);
    if (filter.ploeg) list = list.filter(m => m.ploeg === filter.ploeg);
    if (filter.status) list = list.filter(m => m.status === filter.status);
    else list = list.filter(m => !['opgelost', 'afgewezen'].includes(m.status));
    return { ok: true, meldingen: list.slice(0, 200).map(m => ({ ...publiekeMelding(m), melder: m.melder, ploeg: m.ploeg, lat: m.lat, lng: m.lng })) };
  }
  function meldingZet(actor, r, patch) {
    patch = patch || {};
    const m = (db.data.gemeenteMeldingen || []).find(x => x.ref === String(r || ''));
    if (!m) return { status: 404, error: 'Melding niet gevonden.' };
    if (typeof patch.status === 'string' && MELD_STATUS.includes(patch.status)) {
      m.status = patch.status;
      /* Opgelost bij de gemeente is ook opgelost in de stad. Dit was de laatste
         halve naad: een ambtenaar kon een melding afhandelen terwijl de zaak in
         het weefsel open bleef staan -- en dan blijft er werk op de veldlijst
         staan voor iets wat al gedaan is, en ziet een tweede melder zijn
         melding eeuwig als "open". Andersom sluit het weefsel de zaak bij het
         klaarmelden van de laatste werkorder; nu is de keten aan beide kanten
         dicht. */
      if (m.zaakId && weefsel && ['opgelost', 'afgewezen'].includes(m.status)) {
        try { weefsel.weefselZaakKlaar(m.zaakId, actor || 'gemeente', 'afgehandeld door de gemeente (' + m.ref + ')'); }
        catch (e) { console.error('[gemeente] zaak sluiten', e && e.message); }
      }
    }
    if (typeof patch.ploeg === 'string' && patch.ploeg) m.ploeg = schoon(patch.ploeg, 40);
    const note = schoon(patch.update, 300);
    if (note) m.updates.unshift({ tekst: note, at: nu(), door: actor || 'gemeente' });
    m.updates = (m.updates || []).slice(0, 40);
    save();
    if (m.melderKey && notify) { /* de melder ziet de status in de app; push blijft licht */ }
    const g = deGemeente(); if (g && sseToSupplier) sseToSupplier(g.code, 'sync', { scope: 'gemeente' });
    return { ok: true, melding: publiekeMelding(m) };
  }

  /* AI-triage voor een melding: stelt categorie en ploeg voor (Claude, met een
     deterministische regel-fallback zodat het altijd werkt). Mens beslist. */
  function regelTriage(tekst) {
    const t = String(tekst || '').toLowerCase();
    const kies = (re, cat) => re.test(t) ? cat : null;
    const cat = kies(/lantaarn|lamp|verlicht|donker|straatlicht/, 'verlichting')
      || kies(/afval|vuil|container|zwerf|prullenbak|stort/, 'afval')
      || kies(/gat|weg|stoep|tegel|asfalt|put/, 'wegdek')
      || kies(/boom|tak|groen|struik|onkruid|gras/, 'groen')
      || kies(/riool|water|stank|verstop|lek/, 'riool')
      || kies(/overlast|lawaai|herrie|geluid|hangjong/, 'overlast')
      || kies(/speeltuin|speel|schommel|wip/, 'speeltuin') || 'overig';
    return { categorie: cat, categorieLabel: CATS[cat], ploeg: PLOEG[cat] };
  }
  async function triage(tekst) {
    const val = regelTriage(tekst);
    if (!anthropic) return { ok: true, ...val, bron: 'regel' };
    try {
      const resp = await anthropic.messages.create({
        model: 'claude-sonnet-5', max_tokens: 120,
        system: 'Je bent de meldkamer van een gemeente. Kies voor de melding de best passende categorie uit: ' +
          Object.keys(CATS).join(', ') + '. Antwoord uitsluitend als JSON: {"categorie":"<sleutel>"}.',
        messages: [{ role: 'user', content: String(tekst || '').slice(0, 400) }]
      });
      const m = ((resp.content.find(c => c.type === 'text') || {}).text || '').match(/\{[\s\S]*\}/);
      const j = m ? JSON.parse(m[0]) : {};
      const cat = CATS[j.categorie] ? j.categorie : val.categorie;
      return { ok: true, categorie: cat, categorieLabel: CATS[cat], ploeg: PLOEG[cat], bron: 'ai' };
    } catch (e) { return { ok: true, ...val, bron: 'regel' }; }
  }

  return { meld, mijnMeldingen, meldingenLijst, meldingZet, triage };
};
