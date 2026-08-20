/* School (deelmodule): de rapporttekst en de studievoortgang. Hoort bij
   school/rapport.js (het rapport zelf en het vaststellen), dat de rapportlijst
   en de vak-uitsplitsing via de context meegeeft.

   De regel die dit bestand draagt: de AI schrijft hooguit een CONCEPT. Er is
   geen route die een tekst publiceert -- publiceren gebeurt alleen door het
   rapport vast te stellen, en dat vraagt een mens die bevestigt dat hij de
   teksten heeft gelezen. Zonder AI-sleutel komt er geen verzonnen tekst maar
   een feitelijke opzet uit de cijfers zelf. */
const { maakAI } = require('../ai');
const { tekst: aiTekst } = require('../ai-kort');

module.exports = (sctx) => {
  const { router, save, nu, schoon, K, S, eigenVeld, poort, log, gezinSessie,
    rapporten: R, perVak, gemiddelde, leerlingLijst, meld } = sctx;
  const gem = (cijfers) => gemiddelde(cijfers);

  /* ---------- de conceptteksten ----------
     Met AI-sleutel schrijft Rahul een voorstel op basis van de cijfers en de
     aanwezigheid; zonder sleutel komt er een feitelijke opzet uit dezelfde
     gegevens. In beide gevallen: concept, met de bron erbij. */
  router.post('/school/rapport/tekst', async (req, res) => {
    const g = poort(req, res, 'leerling'); if (!g) return;
    const rap = R(g.sch).find(r => r.id === String(req.body.rapportId || ''));
    if (!rap) return res.status(404).json({ error: 'Dat rapport kennen we niet.' });
    if (rap.vastgesteld) return res.status(409).json({ error: 'Dit rapport is vastgesteld; teksten wijzigen kan niet meer.' });
    const rij = (rap.leerlingen || []).find(x => x.sleutel === String(req.body.sleutel || ''));
    if (!rij) return res.status(404).json({ error: 'Die leerling staat niet in dit rapport.' });

    const feiten = rij.vakken.map(v => v.vak + ': gemiddeld ' + (v.gemiddelde == null ? 'nog geen cijfer' : v.gemiddelde) + ' (' + v.aantal + ' cijfers)').join('; ')
      + '. Aanwezigheid: ' + rij.aanwezigheid.lessen + ' geregistreerde lessen, ' + rij.aanwezigheid.gemist + ' gemist, ' + rij.aanwezigheid.telaat + ' keer te laat.';
    const ai = maakAI();
    let voorstel = null, bron = 'opzet uit de cijfers (geen AI-sleutel)';
    if (ai) {
      voorstel = await aiTekst(ai,
        'Je schrijft een CONCEPT-rapporttekst voor een leerling, in het Nederlands, hooguit 90 woorden. '
        + 'Je bent geen beoordelaar: je vat feitelijk samen wat er staat, benoemt wat goed gaat en wat aandacht vraagt, '
        + 'en je doet geen uitspraken over aanleg, karakter, thuissituatie of toekomst. Geen vergelijking met klasgenoten, '
        + 'geen advies over doubleren of niveau -- dat besluit een mens met het hele beeld. Schrijf naar de leerling toe, warm en gewoon.',
        'Leerling: ' + rij.naam + '. ' + feiten, { max: 320 }).catch(() => null);
      if (voorstel) bron = 'AI-concept, nagekeken door een mens vereist';
    }
    if (!voorstel) {
      const sterk = rij.vakken.filter(v => v.gemiddelde != null && v.gemiddelde >= 7).map(v => v.vak);
      const aandacht = rij.vakken.filter(v => v.gemiddelde != null && v.gemiddelde < 5.5).map(v => v.vak);
      voorstel = 'Deze periode staan er ' + rij.vakken.length + ' vakken met cijfers.'
        + (sterk.length ? ' Sterk: ' + sterk.join(', ') + '.' : '')
        + (aandacht.length ? ' Aandacht voor: ' + aandacht.join(', ') + '.' : '')
        + ' Aanwezigheid: ' + rij.aanwezigheid.gemist + ' gemiste lessen van ' + rij.aanwezigheid.lessen + '.'
        + ' (Vul aan in eigen woorden.)';
    }
    rij.tekst = voorstel; rij.tekstBron = bron; rij.tekstConcept = true;
    save();
    res.json({ ok: true, sleutel: rij.sleutel, tekst: voorstel, bron, concept: true,
      uitleg: 'Dit is een voorstel. Pas het aan en stel het rapport daarna vast; ongelezen gaat er niets naar het gezin.' });
  });

  // de tekst met de hand zetten (of de AI-tekst corrigeren)
  router.post('/school/rapport/tekst/zet', (req, res) => {
    const g = poort(req, res, 'leerling'); if (!g) return;
    const rap = R(g.sch).find(r => r.id === String(req.body.rapportId || ''));
    if (!rap) return res.status(404).json({ error: 'Dat rapport kennen we niet.' });
    if (rap.vastgesteld) return res.status(409).json({ error: 'Dit rapport is vastgesteld.' });
    const rij = (rap.leerlingen || []).find(x => x.sleutel === String(req.body.sleutel || ''));
    if (!rij) return res.status(404).json({ error: 'Die leerling staat niet in dit rapport.' });
    rij.tekst = schoon(req.body.tekst, 1200) || null;
    rij.tekstBron = 'geschreven door ' + g.p.naam; rij.tekstConcept = true;
    save();
    res.json({ ok: true, tekst: rij.tekst });
  });

  /* ---------- vaststellen ----------
     De enige weg naar het gezin. Met naam, moment en de bevestiging dat de
     teksten zijn gelezen -- want dat is precies de belofte die hier wordt
     gedaan. */
  router.post('/school/rapport/stel-vast', (req, res) => {
    const g = poort(req, res, 'leerling'); if (!g) return;
    const rap = R(g.sch).find(r => r.id === String(req.body.rapportId || ''));
    if (!rap) return res.status(404).json({ error: 'Dat rapport kennen we niet.' });
    if (rap.vastgesteld) return res.status(409).json({ error: 'Dit rapport is al vastgesteld.' });
    if (req.body.gelezen !== true) return res.status(400).json({ error: 'Bevestig dat u de teksten hebt gelezen (gelezen: true). Een rapport dat niemand heeft nagekeken, gaat hier niet de deur uit.' });
    rap.vastgesteld = true; rap.vastgesteldAt = nu(); rap.vastgesteldDoor = g.p.naam;
    for (const rij of rap.leerlingen) rij.tekstConcept = false;
    log(g.sch, g.p, 'rapport-vastgesteld', rap.id, rap.klas + ' ' + rap.periode);
    save();
    meld(g.sch, 'rapport.vastgesteld', { rapportId: rap.id, klasCode: rap.klasCode, periode: rap.periode });
    res.json({ ok: true, rapport: { id: rap.id, vastgesteld: true, vastgesteldDoor: rap.vastgesteldDoor },
      uitleg: 'Vanaf nu zichtbaar voor de gezinnen van deze klas.' });
  });

  /* ---------- de gezinskant ----------
     Alleen vastgestelde rapporten, alleen van de eigen kinderen. */
  router.post('/school/rapport/mijn', (req, res) => {
    const s = gezinSessie(req, res); if (!s) return;
    const uit = [];
    for (const sch of Object.values(S())) for (const r of (sch.rapporten || [])) {
      if (!r.vastgesteld) continue;
      for (const rij of (r.leerlingen || [])) {
        if (!String(rij.sleutel || '').startsWith(s.g.code + ':')) continue;
        if (!s.beheerder && rij.sleutel !== s.g.code + ':' + s.p.id) continue; // een kind ziet zijn eigen rapport
        uit.push({ school: sch.naam, klas: r.klas, periode: r.periode, vastgesteldAt: r.vastgesteldAt,
          naam: rij.naam, gemiddelde: rij.gemiddelde, vakken: rij.vakken, aanwezigheid: rij.aanwezigheid, tekst: rij.tekst });
      }
    }
    res.json({ ok: true, rapporten: uit.slice(0, 50) });
  });

  /* ---------- studievoortgang ----------
     Hetzelfde beeld over de tijd: per vak de cijfers op volgorde, plus de
     behaalde leerdoelen uit het ondersteuningsplan. Voor de mentor en het
     gezin dezelfde bron. */
  router.post('/school/voortgang', (req, res) => {
    const g = poort(req, res, 'leerling'); if (!g) return;
    const k = eigenVeld(K(), String(req.body.klasCode || '').trim().toUpperCase());
    if (!k || k.schoolCode !== g.sch.code) return res.status(404).json({ error: 'Die klas hoort niet bij deze school.' });
    const sleutel = String(req.body.sleutel || '');
    const l = (k.leerlingen || []).find(x => x.sleutel === sleutel);
    if (!l) return res.status(404).json({ error: 'Die leerling zit niet in deze klas.' });
    const leerling = Object.values(leerlingLijst(g.sch)).find(x => x.sleutel === sleutel);
    const doelen = leerling && leerling.zorg ? (leerling.zorg.doelen || []) : [];
    res.json({ ok: true, naam: l.naam, vakken: perVak(k, sleutel),
      gemiddelde: gem((k.cijfers || []).filter(c => c.leerling === sleutel)),
      huiswerk: { gegeven: (k.huiswerk || []).length, afgevinkt: (k.huiswerk || []).filter(h => (h.afDoor || []).includes(sleutel)).length },
      leerdoelen: { behaald: doelen.filter(d => d.behaald).length, open: doelen.filter(d => !d.behaald).length,
        let: doelen.length ? null : 'Er staat geen ondersteuningsplan; leerdoelen komen uit het zorgdeel.' },
      rapporten: R(g.sch).filter(r => r.vastgesteld && (r.leerlingen || []).some(x => x.sleutel === sleutel))
        .map(r => ({ periode: r.periode, gemiddelde: (r.leerlingen.find(x => x.sleutel === sleutel) || {}).gemiddelde })) });
  });
};
