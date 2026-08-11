/* Spellen (deelmodule): HET BELEID -- alle toetredingsvragen op een plek.

   Volwassenen en Foundation-gebruikers spelen door dezelfde motor. Dat is goed
   (een spel hoeft niet twee keer te bestaan) en het betekent dat er een laag
   moet zijn die per moment zegt wat er mag. Die vragen bestonden al, maar
   verspreid: `wereldFout` en `leeftijdFout` in gedeeld.js, `progressieMag` in
   grens.js, de kring in kring.js, en de zichtlagen in zicht.js.

   Zolang alleen de lobby ze stelde ging dat goed. Zodra er meer INGANGEN
   bijkomen -- een spel starten vanuit een chat, een projectiescherm dat zich
   aanmeldt, een Game Night die vijf potjes achter elkaar opzet -- moet elk van
   die ingangen dezelfde vragen stellen, in dezelfde volgorde. Dat is precies de
   vorm waarin ze uiteen gaan lopen: de ene deur wordt ruimer dan de andere
   zonder dat iemand dat besloten heeft. Kring.js bestaat om die reden al.

   DIT BESTAND NEEMT DE REGELS NIET OVER, en dat is de belangrijkste regel
   eraan. Het roept ze aan. Een policylaag die zelf gaat beslissen is een tweede
   kopie, en dan zijn er weer twee antwoorden op dezelfde vraag -- het probleem
   dat hij moest oplossen. Wie hier een leeftijdsgrens of een wereldregel ziet
   staan die niet uit gedeeld.js of grens.js komt, kijkt naar een fout.

   WAT ER WEL BIJ KOMT is de VOLGORDE en de volledigheid: `mag()` stelt alle
   vragen die bij een toetreding horen en geeft de eerste weigering terug, zodat
   een nieuwe ingang er geen kan overslaan. Dat is geen regel maar een
   checklist, en een checklist hoort op een plek te staan.

   HET BELEID KOMT NOOIT UIT HET VERZOEK. Dezelfde regel als bij `online` in
   routes/spellen.js, waar de kring van de server komt en niet van de client:
   wie zijn eigen beleid mag meesturen, opent een 18+-spel als schoolsessie. De
   context van een potje wordt daarom gezet door de INGANG (de lobby weet of hij
   uit een chat of uit de Hall komt) en niet doorgegeven door de aanvrager. */
module.exports = (ctx) => {
  const { wereldFout, leeftijdFout, ZICHT } = ctx;
  const spel = (soort) => (ctx.SPEL || {})[soort];

  /* De contexten waarin een potje kan ontstaan. Een gesloten lijst, om dezelfde
     reden als de twaalf gesprekssoorten in kern/comm: een vrij tekstveld is
     binnen een maand een verzameling spelfouten, en dit veld bepaalt straks
     welk beleid er hangt. 'hall' is de stille standaard. */
  const CONTEXTEN = ['hall', 'chat', 'salon', 'school', 'werk', 'reis', 'hospitality'];
  const contextVan = (c) => CONTEXTEN.includes(c) ? c : 'hall';

  /* ALLE toetredingsvragen, in volgorde, voor EEN persoon. Geeft de eerste
     weigering terug of null.

     `wie` mag ook een lijst zijn: bij het starten van een potje moet elke
     uitgenodigde langs de leeftijdspoort, en dat op de aanroepplek herhalen is
     precies hoe je er een vergeet. */
  function mag(wie, soort, { wereld } = {}) {
    if (!spel(soort)) return { status: 400, error: 'Onbekend spel.' };
    const wf = wereldFout(wereld, soort);
    if (wf) return { status: 400, error: wf };
    for (const h of (Array.isArray(wie) ? wie : [wie])) {
      const lf = leeftijdFout(soort, h);
      if (lf) return { status: 403, error: lf };
    }
    return null;
  }

  /* MEEDOEN OP UITNODIGING is bewust een SMALLERE vraag dan starten: de
     leeftijdspoort geldt, de wereldpoort niet. Dat is geen vergeetachtigheid
     maar de regel uit gedeeld.js -- `wereld` zegt welke app een potje mag
     STARTEN, en meespelen kan altijd over en weer. Die asymmetrie stond
     impliciet in twee losse aanroepen; hier staat hij met zijn reden. */
  function magMeedoen(wie, soort) {
    const lf = leeftijdFout(soort, wie);
    return lf ? { status: 403, error: lf } : null;
  }

  /* Mag er bij dit spel meegekeken worden? Dat is nu dezelfde vraag als
     "bestaat er een kijkweergave", en dat is de hele winst van zicht.js: er is
     niets meer om apart aan of uit te zetten. `partij.js` stelt hem HIER en
     niet zelf aan ZICHT -- anders zijn er weer twee plekken die hem
     beantwoorden, en dat is precies wat deze laag moest opheffen.

     `magGeprojecteerd` en een `bewaart()` om `progressieMag` heen stonden hier
     ook, en zijn eruit gehaald: ze hadden geen enkele aanroeper. Vooruit
     gebouwde API is dode code die er als beleid uitziet. De projectievraag komt
     terug zodra de projectiekamer er is (GAMEHALL.md §9), mét een aanroeper. */
  const magBekeken = (soort) => !!(ZICHT[soort] && ZICHT[soort].kijker);

  /* Wat een ingang aan een potje mag meegeven. Bewust een functie en geen
     object dat de aanroeper zelf vult: zo is er een plek waar staat welke
     velden er bestaan en wat hun veilige waarde is. */
  function roomVelden({ context, bron, host, tempo }) {
    return {
      context: contextVan(context),
      // waar dit potje vandaan komt ('gesprek:ab12'), voor de weg terug
      bron: typeof bron === 'string' && bron ? String(bron).slice(0, 120) : null,
      host: host || null,
      tempo: tempo || null
    };
  }

  return { CONTEXTEN, contextVan, mag, magMeedoen, magBekeken, roomVelden };
};
