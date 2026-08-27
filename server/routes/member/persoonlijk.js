/* Persoonlijke ledenroutes: zorg, locatie, Rahul en Shared Assets.
   De logica woont in de kernmodules. */
const { maakLiveTwin } = require('../../ai-live-twin');

module.exports = (kern) => {
  const { app, auth, liveCodename, pestgrens, bus, noteerBeurt, zorgVan, zorgZet, locDeel, locStopKlant, locMijn, stuurLus } = kern;
  const { fluisterZeg, fluisterPush, fluisterProfiel, fluisterOnthoud, fluisterVergeet, fluisterFocus, sparLijst, sparParkeer, sparStatus } = kern.fluister;
  const aiStatus = () => require('../../ai-stand').beschikbaarheid(kern.anthropic);

/* ---- de zorgvolle keten (kern/gastzorg.js) ----
   Het zorgprofiel: allergenen, dieet en medische aandachtspunten. Reist
   alleen mee met bestellingen en verblijven als het lid delen aanzet. */
app.post('/api/zorgprofiel', auth, (req, res) => res.json({ ok: true, zorg: zorgVan(req.session.key) }));
app.post('/api/zorgprofiel/zet', auth, (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
  res.json(zorgZet(req.session.key, req.body));
});
/* Live meekijken met toestemming: het lid wijst een zaak aan; die ziet de
   gps-positie tot de zaak (of het lid zelf) het delen stopzet. */
app.post('/api/locatie/deel', auth, (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
  const r = locDeel(req.session.key, liveCodename(req.session), req.body.supplierCode);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});
app.post('/api/locatie/stop', auth, (req, res) => {
  const r = locStopKlant(req.session.key, String(req.body.id || ''));
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});
app.post('/api/locatie/mijn', auth, (req, res) => res.json(locMijn(req.session.key)));

/* ---- Fluister: de persoonlijke assistent met geheugen (kern/fluister.js).
   Voor iedereen, over de eigen gegevens; alles is opvraagbaar en wisbaar. */
app.post('/api/fluister', auth, async (req, res) => {
  /* De pestgrens staat VOOR alles: drie waarschuwingen bij pesten, dan een
     vurig slotantwoord en 24 uur weg; daarna opent alleen een excuus de
     deur weer (kern/pestgrens.js). Neemt de poort het gesprek over, dan
     komt er geen gewone AI-beurt en ook geen stuur-lus. */
  /* Het stille codewoord (kern/veilig/codewoord.js). Staat hier, in de gewone
     Rahul-route, omdat de zin juist in een DOODGEWOON gesprek moet kunnen
     vallen: je hoeft geen app te openen, en degene die meekijkt ziet je niets
     bijzonders doen. Wat er ook gebeurt, hierna gaat het gesprek precies
     verder zoals altijd: geen ander antwoord, geen extra veld, geen vinkje.
     Elk zichtbaar verschil zou de functie kapotmaken. */
  if (kern.codewoordCheck) { try { kern.codewoordCheck(req.session.key, req.body.q, 'rahul'); } catch (e) {} }
  const grens = pestgrens.poort(req.session.key, req.body.q);
  if (grens) return res.json({ antwoord: grens.antwoord, pestgrens: true, weg: !!grens.weg });
  // sessie mee voor doen (reserveren, 24 uur plannen)
  const r = await fluisterZeg(req.session.key, liveCodename(req.session), req.body.q, req.session);
  if (r.error) return res.status(r.status).json({ error: r.error });
  /* Rahul aan het stuur: pakten de eigen regels het gesprek NIET op
     (pakte=false), dan mag hij het met het AI-stuur alsnog echt DOEN;
     alles wat het lid zelf kan, met de eigen inlog en de geld-drempel.
     Zonder AI-sleutel bestaat stuurLus niet en blijft alles zoals het was. */
  if (stuurLus && !r.pakte) {
    const lus = await stuurLus(req, {
      vraag: req.body.q,
      wereld: 'member',
      // streamende voortgang voor een zware taak: elke stap wordt live
      // "Stap X/24: taxi zoeken..." op de eigen SSE-verbinding (de UI toont het)
      opStap: (v) => {
        /* De enige publicerende plek in dit huis die de actor met zekerheid
           weet: hier ligt de codenaam van het lid al op tafel. Nooit de echte
           naam -- die woont in de identiteitskluis en hoort niet op een bus. */
        try { bus && bus.publish('sse', { doel: 'tier', match: [req.session.tier],
          event: 'rahul-voortgang', data: { stap: v.stap, totaal: v.totaal, bericht: v.bericht, klaar: !!v.klaar },
          envelop: { actor: liveCodename(req.session), classificatie: 'persoonsgegeven' } }); } catch (e) {}
      },
      // Leden- en Foundationpaden wel; werkwerelden blijven buiten bereik.
      filter: p => !['/api/supplier', '/api/staff', '/api/office', '/api/partner'].some(w => p.startsWith(w)),
      systeem: require('../../kern/rahul').RAHUL_LEAD +
        'Je helpt een RTG-lid (codenaam ' + liveCodename(req.session) + ', pas: ' + (req.session.tier || 'rtg') + ') in de leden-app. ' +
        'Je regelt niet alleen reizen, bestellen, betalen en de Salon, maar ook de RTFoundation voor het gezin (bijvoorbeeld het babyboek, school, toetsen of het zakgeldpotje) als het lid daar recht op heeft.'
    });
    if (lus && lus.tekst) {
      onthoudGesprek(req, lus.tekst);
      const stand = aiStatus();
      const antwoord = { antwoord: lus.tekst, gedaan: lus.acties.some(a => a.status < 400), stuur: lus.acties,
        goedkeuringen: lus.acties.filter(a => a.goedkeuring).map(a => a.goedkeuring),
        goedkeuringWereld: 'member',
        aiBeschikbaar: true, modus: stand.modus, verwerking: stand.verwerking, kompas: stand.kompas };
      antwoord.liveTwin = maakLiveTwin({ vraag: req.body.q, context: req.body.context, wereld: 'member',
        actor: req.session.tier || 'member', stand, gedaan: antwoord.gedaan, goedkeuringen: antwoord.goedkeuringen });
      return res.json(antwoord);
    }
  }
  onthoudGesprek(req, r && r.antwoord);
  const stand = aiStatus();
  const antwoord = Object.assign(r, { aiBeschikbaar: stand.beschikbaar, modus: stand.modus,
    verwerking: stand.verwerking, kompas: stand.kompas });
  antwoord.liveTwin = maakLiveTwin({ vraag: req.body.q, context: req.body.context, wereld: 'member',
    actor: req.session.tier || 'member', stand, gedaan: !!antwoord.gedaan, goedkeuringen: antwoord.goedkeuringen });
  res.json(antwoord);
});
/* De uitwisseling in het doorlopende gesprek zetten, zodat de chat in de app en
   de balk in het OS EEN draadje zijn en je geschiedenis niet half is. Alleen
   vastleggen wat er al gebeurd is; kern/ai.js weigert dit voor Lifestyle en
   Business, waar de chat de lijn naar een mens is. */
function onthoudGesprek(req, antwoord) {
  try {
    if (!req.session.account || !antwoord) return;
    noteerBeurt(req.session.account, req.body.q, antwoord, req.body.lang);
  } catch (e) { /* het gesprek loggen mag het antwoord nooit in de weg zitten */ }
}
app.post('/api/fluister/profiel', auth, (req, res) => {
  // nieuwe seintjes worden meteen ook een melding op het toestel (met dedupe)
  fluisterPush(req.session.key);
  const p = fluisterProfiel(req.session.key);
  // de voorspeller en Balans fluisteren stil mee: alleen een rijpe gewoonte
  // of een echt volle week wordt een seintje in "Rahul ziet", nooit een
  // melding op het toestel
  const vs = kern.voorspel && kern.voorspel.seintjeVoor(kern.voorspel.voorLid(liveCodename(req.session), req.session.key));
  const bs = kern.balans && kern.balans.seintjeVoorBalans(kern.balans.balansVoorLid(liveCodename(req.session), req.session.key));
  p.seintjes = [vs, bs].filter(Boolean).concat(p.seintjes || []).slice(0, 5);
  res.json(p);
});
app.post('/api/fluister/onthoud', auth, (req, res) => {
  const r = fluisterOnthoud(req.session.key, req.body.tekst);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});
app.post('/api/fluister/vergeet', auth, (req, res) => {
  const r = fluisterVergeet(req.session.key, req.body.wat);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});
// de inklap-laag deelt (alleen) tellers van schermgebruik, zodat Fluister leert
app.post('/api/fluister/focus', auth, (req, res) => res.json(fluisterFocus(req.session.key, req.body.scores)));

/* ---- Sparren (kern/fluister/sparren.js): Rahul denkt mee om het idee beter te
   maken, en parkeert een gedachte die je noemt op een druk moment. Op een
   rustig moment (thuis, lege agenda) kaart hij hem uit zichzelf weer aan. */
app.post('/api/spar/lijst', auth, (req, res) => res.json(sparLijst(req.session.key)));
app.post('/api/spar/parkeer', auth, (req, res) => {
  if (req.session.tier === 'guest') return res.status(403).json({ error: 'Alleen voor leden.' });
  const r = sparParkeer(req.session.key, req.body.tekst, 'app');
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});
app.post('/api/spar/status', auth, (req, res) => {
  const st = req.body.status === 'weg' ? 'weg' : 'besproken';
  const r = sparStatus(req.session.key, String(req.body.id || ''), st);
  if (r.error) return res.status(r.status).json({ error: r.error });
  res.json(r);
});

require('./persoonlijk-assets')(kern);

// Toren 4, RTG Care (zorg & welzijn) staat apart, in ./persoonlijk-care.js
require('./persoonlijk-care')(kern);
};
