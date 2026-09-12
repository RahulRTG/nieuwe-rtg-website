/* DE RAHUL-BEURT -- /api/fluister, de menselijke ingang van dit huis.

   Afgesplitst uit ./persoonlijk.js toen dat door de omvangband van
   keuringsregel `omvang` ging. De naad is echt en niet cosmetisch: hier staat
   EEN gesprek met een mens, met alles wat daarbij hoort (de pestgrens, het
   stille codewoord, het plafond, de schermcontext, de stuurlus en het spoor),
   en daar blijft het lichte werk eromheen -- zorg, locatie, profiel. Zelfde
   patroon als ./persoonlijk-spar.js en ./persoonlijk-care.js.

   DE VOLGORDE IN DEZE ROUTE IS DE HELE VEILIGHEID, en hij is van boven naar
   beneden te lezen: eerst het codewoord (dat mag aan niets te zien zijn), dan
   de pestgrens (die het gesprek kan overnemen), dan de eigen regels van
   kern/fluister, en pas als die het NIET pakken de stuurlus. Wie hier iets
   tussenvoegt, verplaatst een grens. */
const { maakLiveTwin } = require('../../ai-live-twin');
const plafond = require('../../kern/stuur/plafond');

module.exports = (kern) => {
  const { app, auth, liveCodename, pestgrens, bus, noteerBeurt, stuurLus } = kern;
  const { fluisterZeg } = kern.fluister;
  const aiStatus = () => require('../../ai-stand').beschikbaarheid(kern.anthropic);

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
    const plafondTrede = plafond.geldigeTrede(req.body.plafond);
    const grendel = plafond.grendelVoor(plafondTrede, 'member');
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
        /* De schermcontext van de client, ONGESANEERD meegegeven: saneren doet
           kern/stuur/menscontext.js, op een plek waar de grens ook getoetst is.
           Hier hem alvast opknippen zou een tweede contract zijn. */
        context: req.body.context,
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
            filter: p => !['/api/supplier', '/api/staff', '/api/office', '/api/partner'].some(w => p.startsWith(w))
          && (!grendel || grendel(p)),
        systeem: require('../../kern/rahul').RAHUL_LEAD +
          'Je helpt een RTG-lid (codenaam ' + liveCodename(req.session) + ', pas: ' + (req.session.tier || 'rtg') + ') in de leden-app. ' +
          'Je regelt niet alleen reizen, bestellen, betalen en de Salon, maar ook de RTFoundation voor het gezin (bijvoorbeeld het babyboek, school, toetsen of het zakgeldpotje) als het lid daar recht op heeft.'
      });
      if (lus && lus.tekst) {
        onthoudGesprek(req, lus.tekst);
        const stand = aiStatus();
        /* HET STUURSPOOR VERLAAT DE SERVER ALLEEN OP DE DETERMINISTISCHE RAIL.
           Het spoor zegt WELKE fasen liepen (kern/stuur/spoor.js); dat is een
           binnenkaart en geen antwoord aan een lid. Maar zonder hem is van buitenaf
           niet te bewijzen dat een uitlegvraag NIETS heeft aangeraakt -- dan is die
           belofte een bewering. De voorwaarde is daarom de rail zelf: die staat al
           achter drie fail-closed grendels (kern/stuur/rail.js) en kan nooit in
           productie aanstaan. Er komt dus geen tweede schakelaar bij, en in
           productie draagt het antwoord geen letter extra. */
        const railNu = kern.stuurRail ? kern.stuurRail() : null;
        const antwoord = { pakte: true, plafond: plafondTrede,
          spoor: (railNu && railNu.naam === 'DETERMINISTISCH') ? lus.spoor : undefined,
          antwoord: lus.tekst, gedaan: lus.acties.some(a => a.status < 400), stuur: lus.acties,
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
};
