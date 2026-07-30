/* Kern-module "ondernemerpoort": de poort die een nieuwe zaak eerst door de
   basis loodst voordat de zaak online mag (zichtbaar en boekbaar voor leden).

   De ondernemer moet drie dingen doen voordat de deuren opengaan:
   1. de Salon-pagina vullen (een bio en een foto, zodat leden je herkennen);
   2. de rondleiding door de kassa volgen;
   3. de rondleiding door de werk-apps volgen (bestellingen, team, agenda, Rahul).

   Pas als alle stappen klaar zijn, kan de manager de zaak online zetten. Zo
   staat er nooit een lege of half-ingerichte zaak in de app. Bestaande zaken
   zijn "grandfathered": online is standaard aan (undefined telt als aan), dus
   alleen een nieuw goedgekeurde partner (online === false) moet door de poort.

   Zuivere logica-laag: geen db, geen routes; die zitten in
   routes/supplier/poort.js. salonProfielCompleet komt uit server.js. */
module.exports = ({ salonProfielCompleet }) => {
  // De rondleidingen die de ondernemer minstens een keer doorloopt. De teksten
  // zijn het script; de app laat de stappen zien en meldt "gevolgd" terug.
  const RONDLEIDINGEN = [
    { id: 'kassa', naam: 'De kassa',
      stappen: ['Sla een verkoop aan en kies contant of RTG Pay',
                'Vraag de rekening op en reken in een keer af',
                'Bekijk aan het eind van de dag het Z-rapport'] },
    { id: 'werk', naam: 'De werk-apps',
      stappen: ['Zie hoe bestellingen en boekingen binnenkomen',
                'Loop je team, rooster en agenda langs',
                'Vraag Rahul iets, of laat Rahul iets voor je doen'] },
    { id: 'salon', naam: 'Je Salon-pagina',
      stappen: ['Zie hoe je pagina eruitziet voor leden',
                'Plaats je eerste folder of bericht',
                'Bekijk je volgers en cijfers'] }
  ];
  // Alleen de kassa- en werk-rondleiding zijn verplicht voor de poort; de
  // Salon-rondleiding is een handige extra, maar de Salon-PAGINA (bio + foto)
  // is wel verplicht -- dat is de eerste poortstap.
  const VERPLICHTE_RONDLEIDINGEN = ['kassa', 'werk'];

  function rondleidingKlaar(s, id) {
    return !!(s.rondleiding && s.rondleiding[id]);
  }
  function rondleidingZet(s, id) {
    if (!RONDLEIDINGEN.some(r => r.id === id)) return false;
    if (!s.rondleiding || typeof s.rondleiding !== 'object') s.rondleiding = {};
    s.rondleiding[id] = new Date().toISOString();
    return true;
  }

  // De poortstappen: elk met een eigen id, of hij klaar is, en een uitleg.
  function poortStappen(s) {
    return [
      { id: 'salon', naam: 'Salon-pagina gevuld', klaar: salonProfielCompleet(s),
        tekst: 'Een bio en een foto, zodat leden je herkennen.' },
      { id: 'kassa', naam: 'Rondleiding kassa', klaar: rondleidingKlaar(s, 'kassa'),
        tekst: 'Je bent een keer door het kassasysteem gelopen.' },
      { id: 'werk', naam: 'Rondleiding werk-apps', klaar: rondleidingKlaar(s, 'werk'),
        tekst: 'Je bent een keer door de werk-apps gelopen.' }
    ];
  }
  function poortKlaar(s) { return poortStappen(s).every(x => x.klaar); }

  // Online-staat: undefined = aan (bestaande zaken), false = nog dicht. Een zaak
  // is pas echt online als ook de Salon-pagina compleet is (anders geen etalage).
  function zaakOnline(s) { return s.online !== false && salonProfielCompleet(s); }

  // Volledig beeld voor de app: de stappen, de rondleidingen en de online-staat.
  function poortBeeld(s) {
    const stappen = poortStappen(s);
    return {
      online: zaakOnline(s),
      onlineGezet: s.online !== false,          // de knop-stand (los van compleetheid)
      klaar: stappen.every(x => x.klaar),        // mag de zaak online?
      stappen,
      rondleidingen: RONDLEIDINGEN.map(r => ({ id: r.id, naam: r.naam, stappen: r.stappen,
        klaar: rondleidingKlaar(s, r.id),
        verplicht: VERPLICHTE_RONDLEIDINGEN.includes(r.id) }))
    };
  }

  return { RONDLEIDINGEN, VERPLICHTE_RONDLEIDINGEN, rondleidingKlaar, rondleidingZet,
           poortStappen, poortKlaar, zaakOnline, poortBeeld };
};
