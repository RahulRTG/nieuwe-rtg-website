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
const { taakBeeld } = require('../../kern/stuur/taakbeeld');
// het volle plan zit al in `taak`; in `stuur` reist hij niet nog eens mee
const zonderPlan = (a) => Object.fromEntries(Object.entries(a).filter(([k]) => k !== 'plan'));

module.exports = (kern) => {
  const { app, auth, liveCodename, pestgrens, bus, noteerBeurt, stuurLus } = kern;
  const { fluisterZeg } = kern.fluister;
  const lusVoorLid = require('./persoonlijk-rahul-stuur')({ stuurLus, bus, liveCodename });
  const wijzigUitTekst = require('./persoonlijk-rahul-wijzig')(kern);
  const aiStatus = () => require('../../ai-stand').beschikbaarheid(kern.anthropic);
  const meting = require('../../kern/ai/routermeting');
  /* HEEFT DE GOEDKOPE LAAG HET GEDEKT -- en `r.pakte` alleen is daarvoor niet
     genoeg. kern/fluister/gesprek.js antwoordt met een model AAN met een
     modelantwoord en met een model UIT met haar eigen regels, en zet in allebei
     de gevallen pakte=true. Een meting op pakte alleen telt dus een
     modelantwoord als goedkope dekking -- nagemeten gebeurde dat ook. `viaModel`
     komt van de plek die het wel weet. */
  const goedkoopDekte = (r) => !!(r && r.pakte && !r.viaModel);

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
    // het scherm, aan DEZE sessie gebonden (EDGE.md par. 14.4)
    const sch = kern.contextDomeinen.scherm(req.session, req.body.context, req.body.q);
    // "maak er vijf dagen van": dezelfde wijzigingsroute als het scherm, zonder model
    const tw = wijzigUitTekst(req, sch);
    if (tw) { onthoudGesprek(req, tw.antwoord); return res.json(tw); }
    // sessie mee voor doen (reserveren, 24 uur plannen)
    const zeg = (eerst) => fluisterZeg(req.session.key, liveCodename(req.session), req.body.q, req.session,
      sch.scherm && Object.assign({ stuurEerst: eerst, verduidelijk: sch.verduidelijk }, sch.scherm));
    // een aangewezen object gaat eerst naar de stuurlus, als die er is
    let r = await zeg(!!(stuurLus && sch.aangewezen));
    if (r.error) return res.status(r.status).json({ error: r.error });
    /* Rahul aan het stuur: pakten de eigen regels het gesprek NIET op
       (pakte=false), dan mag hij het met het AI-stuur alsnog echt DOEN;
       alles wat het lid zelf kan, met de eigen inlog en de geld-drempel.
       Zonder AI-sleutel bestaat stuurLus niet en blijft alles zoals het was. */
    /* `stuurMagKijken` is de ENIGE uitbreiding op "pakte het zelf niet", en hij
       komt uit kern/fluister/bevestig.js: een "nee"/"toch niet" waarbij die laag
       niets van zichzelf had staan. De keuze om niets te doen blijft daarmee bij
       de laag die als enige weet of zij iets open had -- deze route classificeert
       geen zinnen en kijkt in geen enkele voorstellenlijst.

       EN HET IS GEEN GRATIS BIJEFFECT: vindt het stuur niets, dan levert de lus
       geen tekst en valt het antwoord van hierboven gewoon terug op zijn plek.
       Een zin die vandaag niets doet, doet pas iets zodra er echt een voorstel
       openstaat en de rail de zin herkent. */
    if (stuurLus && (!r.pakte || r.stuurMagKijken)) {
      const lus = await lusVoorLid(req, { grendel, opzoeking: sch.opzoeking });
      if (lus && lus.tekst) {
        onthoudGesprek(req, lus.tekst);
        /* Wat de Edge toont, uit serverbronnen (kern/stuur/taakbeeld.js); `gedaan`
           komt alleen uit echte uitvoeringen, nooit uit een gewogen plan. */
        const taak = taakBeeld({ vraag: req.body.q, sch, acties: lus.acties,
          plafond: grendel && { trede: plafondTrede, mag: grendel } });
        const stand = aiStatus();
        /* HET STUURSPOOR REIST MEE ALS DE LUS HEM MEEGEEFT, en die geeft hem
           alleen op de deterministische rail (kern/stuur/lus.js). Zonder dat
           spoor is van buitenaf niet te bewijzen dat een uitlegvraag NIETS
           heeft aangeraakt -- dan is die belofte een bewering. Deze route
           beslist er niets over: dat zou betekenen dat zij de railnaam moet
           kunnen opvragen, en daarmee verder reikt dan zij hoeft. */
        const antwoord = { pakte: true, plafond: plafondTrede, spoor: lus.spoor,
          antwoord: lus.tekst, gedaan: taak.uitgevoerd.length > 0, taak, stuur: lus.acties.map(zonderPlan),
          goedkeuringen: lus.acties.filter(a => a.goedkeuring).map(a => a.goedkeuring),
          goedkeuringWereld: 'member', staving: lus.staving,
          aiBeschikbaar: true, modus: stand.modus, verwerking: stand.verwerking, kompas: stand.kompas,
          uitgevoerd: require('../../ai-stand').uitgevoerd() };
        antwoord.liveTwin = maakLiveTwin({ vraag: req.body.q, context: req.body.context, wereld: 'member',
          actor: req.session.tier || 'member', stand, gedaan: antwoord.gedaan, goedkeuringen: antwoord.goedkeuringen });
        /* De schaduwmeting (kern/ai/routermeting.js): de stuurlus gaf het
           antwoord. `gedekt` is de TEGENFEITELIJKE vraag -- had de goedkope laag
           het ook gekund -- en dat weet kern/fluister zelf beter dan een proef
           op cannedAnswer, die in deze route niet eens voorkomt. */
        meting.meet(req.body.q, { ingang: 'fluister', pas: req.session.tier,
          gedekt: goedkoopDekte(r), modelAntwoordde: true });
        return res.json(antwoord);
      }
    }
    if (r.stuurEerst) r = await zeg(false);   // de stuurlus zei niets: dan het gesprek
    if (r.error) return res.status(r.status).json({ error: r.error });
    onthoudGesprek(req, r && r.antwoord);
    const stand = aiStatus();
    const antwoord = Object.assign(r, { aiBeschikbaar: stand.beschikbaar, modus: stand.modus,
      verwerking: stand.verwerking, kompas: stand.kompas, uitgevoerd: require('../../ai-stand').uitgevoerd() });
    // een concept van een domein (een reiswens) krijgt hetzelfde taakbeeld
    if (r.concept) antwoord.taak = taakBeeld({ vraag: req.body.q, sch, acties: [], concept: r.concept });
    antwoord.liveTwin = maakLiveTwin({ vraag: req.body.q, context: req.body.context, wereld: 'member',
      actor: req.session.tier || 'member', stand, gedaan: !!antwoord.gedaan, goedkeuringen: antwoord.goedkeuringen });
    // Geen stuurlus of geen tekst: kern/fluister gaf het antwoord, of anders de
    // algemene zin -- en dan telt dit als `nietsGafAntwoord`.
    meting.meet(req.body.q, { ingang: 'fluister', pas: req.session.tier,
      gedekt: goedkoopDekte(r), modelAntwoordde: !!(r && r.viaModel) });
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
