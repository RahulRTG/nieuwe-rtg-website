/* EEN AFGELOPEN POTJE UITLEZEN -- wat er van een campagne in het register komt.

   Afgesplitst van ./loopbaan.js op de naad die het onderwerp zelf aangeeft.
   Daar staat het REGISTER: wat je erin mag zetten, wie het bezit, en de
   18+-grens die er overal overheen ligt. Dat is af zodra het klopt. Hier staat
   wat een AFGELOPEN PARTIJ oplevert, en dat groeit met elke laag die een feit
   produceert dat het waard is een potje te overleven -- fase C zette er de
   nalatenschap bij, en dat was meteen de druppel over de 10 kB-grens.

   TWEE BRONNEN, EEN ONDERWERP.

     DE DIENSTVERBANDEN (`staat.diensten`) -- wie werkte bij wie, hoe lang, en
     waarom het ophield. VERHAAL.md stap 2.
     DE OVERDRACHTEN (`staat.uit`, gestempeld door magnaat/uitstap.js) -- wie
     zijn levenswerk aan wie gaf. Dat is wat GAMEHALL.md 12.9 `legacy` noemt.

   Ze staan in EEN bestand omdat ze dezelfde vraag beantwoorden: wat blijft er
   van deze campagne over bij de mensen die hem speelden. Twee bestanden zouden
   twee keer dezelfde grens moeten bewaken.

   ER KOMT GEEN BEDRAG MEE, uit geen van beide bronnen. In `diensten` staat een
   `loon` en een `betaaldTotaal`, in `uit` staat wat een overname kostte; die
   blijven waar ze horen -- in het potje. Blijvende waarde komt uit tijd en uit
   wat je deed, nooit uit geld (VERHAAL.md paragraaf 1). Wat hier van een bedrag
   overblijft is een DUUR.

   HET STAAT HIER ALS VORM EN NIET ALS SPELNAAM. Vandaag is Magnaat het enige
   spel met dienstverbanden en overdrachten; een tweede spel dat ze heeft levert
   dezelfde lijsten aan en hoeft niets nieuws te bouwen. Een spel dat ze niet
   heeft komt hier langs en er gebeurt niets. */
'use strict';

module.exports = ({ onthoud, onthoudBaan, duur, codenaamVan, alle }) => {
  /* DE NALATENSCHAP staat in ./loopbaan-nalaten.js: dat is een OVERDRACHT en dit
     zijn DIENSTVERBANDEN. Je kunt je zaak doorgeven zonder ooit iemand in dienst
     te hebben gehad, en dat is precies de campagne waarin die overdracht het
     enige is wat er te onthouden viel. */
  const { noteerNalatenschap } = require('./loopbaan-nalaten')({ onthoud, duur, codenaamVan });

  /* DE STAP DIE EEN CAMPAGNE OVERSPANT: je was werknemer, en nu heb je een eigen
     zaak (SAMENLEVING.md fase 3). Tot nu toe kon `eerste_zaak` alleen BINNEN een
     partij vallen -- hij wordt geschreven vanuit de dienstverbandenlus, en wie
     deze campagne geen baan had komt daar nooit langs. Precies de mens die het
     betreft dus.

     GEEN NIEUWE MOMENTSOORT: het is dezelfde menselijke gebeurtenis en die heeft
     al een naam. De tweede mens is de werkgever waar je het GELEERD hebt (de
     meeste maanden), want een moment zonder tweede mens bestaat niet -- en dat
     levert de zin op waar het om gaat. Er komt niets mee: geen kas, geen pand,
     geen krediet. Zie ./loopbaan-profiel.js. */
  function noteerOndernemer(potje) {
    if (!alle) return [];
    const st = potje.staat || {};
    const uit = [];
    for (const h of potje.spelers || []) {
      if (!((st.vestigingen || {})[h] || []).length) continue;
      const cn = codenaamVan(h);
      const l = alle()[cn];
      if (!l) continue;
      /* UIT EEN EERDERE CAMPAGNE, en dat is de hele voorwaarde. Banen uit DIT
         potje tellen niet mee: die weg loopt al door de lus hieronder, en zou
         hij hier ook lopen dan hangt af van de volgorde welke van de twee wint. */
      const eerder = l.banen.filter(b => b.potje !== potje.id && (b.maanden || 0) > 0);
      if (!eerder.length) continue;
      const per = {};
      for (const b of eerder) per[b.werkgever] = (per[b.werkgever] || 0) + b.maanden;
      const leermeester = Object.entries(per).sort((a, b) => b[1] - a[1])[0];
      const r = onthoud(h, cn, 'eerste_zaak',
        { samen: leermeester[0], wat: duur(leermeester[1]), potje: potje.id });
      if (r.bewaard) uit.push({ wie: cn, na: leermeester[0] });
    }
    return uit;
  }

  /* ---------- het potje, in zijn geheel ----------

     Dezelfde vorm als `noteerUitslag` in ./uitslagen.js en om dezelfde reden
     idempotent: hij wordt aangeroepen vanuit `naPotje` in ./partij.js, en een
     partij kan maar een keer klaar zijn. */
  function noteerLoopbaan(potje) {
    if (!potje || potje.status !== 'klaar' || potje.loopbaanGenoteerd) return null;
    potje.loopbaanGenoteerd = true;
    /* DE NALATENSCHAP DRAAIT EERST, want hij hangt niet aan een dienstverband:
       een campagne waarin niemand in dienst was maar wel iemand zijn zaak
       doorgaf, hoort dat moment te krijgen. Zou hij na de vroege terugkeer
       hieronder staan, dan viel hij weg zodra er geen diensten waren -- en dat
       is precies de partij waarin een overdracht het enige is wat er te
       onthouden viel. */
    const nagelaten = noteerNalatenschap(potje);
    /* DE OVERGANG WERKNEMER -> ONDERNEMER, en hij draait VOOR de lus hieronder
       omdat hij er niet in past: die loopt langs de dienstverbanden van DEZE
       partij, en juist de mens die vorige campagne in dienst was en nu voor
       zichzelf begint heeft er geen. Zie de uitleg bij `noteerOndernemer`. */
    noteerOndernemer(potje);
    const diensten = ((potje.staat || {}).diensten) || [];
    if (!diensten.length) return nagelaten ? { nagelaten } : null;
    const uit = [];
    for (const d of diensten) {
      const maanden = d.maanden || 0;
      if (maanden < 1) continue;                 // niet begonnen is niet gewerkt
      const wn = codenaamVan(d.werknemer), wg = codenaamVan(d.werkgever);
      /* BEIDE KANTEN, elk op zijn eigen codenaam en elk alleen als DIE persoon
         binnen de grens valt. Dezelfde regel als bij de nalatenschap hierboven,
         en het is de enige lezing die klopt. */
      /* IN WELK VAK. Zonder dit kan een loopbaan wel zeggen dat je ergens drie
         jaar werkte maar niet WAT je leerde -- en dan is "zes jaar horeca" niet
         te beantwoorden. De sector komt van de vestiging waar het dienstverband
         aan hing; een bestuursrol heeft er geen, en dan staat er niets. */
      const zaak = ((potje.staat || {}).vestigingen
        ? Object.values(potje.staat.vestigingen).flat().find(v => v.id === d.vestiging)
        : null) || null;
      const r1 = onthoudBaan(d.werknemer, wn, { werkgever: wg, rol: d.rol,
        rolnaam: d.rolnaam, sector: zaak ? zaak.sector : null, maanden,
        reden: d.reden || 'partij voorbij', potje: potje.id });
      if (r1.bewaard) {
        onthoud(d.werknemer, wn, 'eerste_baan', { samen: wg, wat: d.rol, potje: potje.id });
        uit.push({ wie: wn, bij: wg });
      }
      /* En de werkgeverskant: dat er iemand voor je werkte is ook JOUW
         geschiedenis. Hij krijgt geen `baan` -- hij had er geen -- maar wel het
         moment, want er was een tweede mens bij. */
      onthoud(d.werkgever, wg, 'eerste_mens', { samen: wn, wat: d.rol, potje: potje.id });
      /* DE EERSTE PROMOTIE (hoofdstuk 2). Hij ontstaat vanzelf uit de eerste
         geaccepteerde stijging BINNEN dezelfde arbeidsrelatie -- niet uit een
         verhaal en niet uit een knop. Stond hij in de tabel zonder schrijver,
         dan was de mooiste zin van deze laag een dode ingang; dat was hij tot
         magnaat/promotie.js bestond. */
      const eerste = (d.promoties || [])[0];
      if (eerste)
        onthoud(d.werknemer, wn, 'eerste_promotie', { samen: wg,
          wat: (d.rolnaam || eerste.naar), potje: potje.id });
      /* SAMEN DOORGEKOMEN (hoofdstuk 5), en met de strengste eis van de acht:
         er moet ECHTE gedeelde tegenslag zijn geweest (magnaat/dienst.js
         stempelt hem alleen bij schade), EN het dienstverband moet het gehaald
         hebben. Wie wegging toen het tegenzat, ging er niet samen doorheen. */
      const zwaar = (d.zwaar || [])[0];
      if (zwaar && d.status === 'loopt') {
        onthoud(d.werknemer, wn, 'samen_door', { samen: wg, wat: zwaar.wat, potje: potje.id });
        onthoud(d.werkgever, wg, 'samen_door', { samen: wn, wat: zwaar.wat, potje: potje.id });
      }
      /* DE STORING DIE HIJ BEEINDIGDE (par. 0f wet 5). Het FEIT staat op de
         dienst (magnaat/rush-maand.js schreef het, met de drempel er al in);
         hier valt alleen de vraag of het een moment werd. Dat onderscheid is
         par. 0b: het feit blijft waar, de betekenis mag verschuiven.

         ALLEEN DE EERSTE, en dat regelt de NAAM: ../loopbaan.js laat een soort
         met het voorvoegsel `eerste_` hoogstens een keer toe. Het gaat om de dag
         dat je voor het eerst zelf een probleem beeindigde, niet om een teller.

         DE WOORDEN KOMEN UIT HET FEIT ZELF en niet uit een tabel hier. Dit
         bestand hoort niet te weten hoe een koeling heet -- dat is een detail
         van de magnaat-motor, en een woordenboek hier zou uit de pas gaan lopen
         met het spel dat het beschrijft. */
      const beeindigd = (d.diensten || []).find(x => x.storing && x.storing.zwaar);
      if (beeindigd)
        onthoud(d.werknemer, wn, 'eerste_storing', { samen: wg,
          wat: beeindigd.storing.naam || 'een storing', potje: potje.id });
      /* DE LEERLING DIE ZELF BEGON (hoofdstuk 9, en de mooiste van de acht).
         Alleen als hij bij het einde van de partij ook echt een eigen zaak
         had -- anders is het een voornemen en geen moment. */
      const eigen = ((potje.staat.vestigingen || {})[d.werknemer] || []).length;
      if (eigen > 0) {
        onthoud(d.werknemer, wn, 'eerste_zaak', { samen: wg, wat: duur(maanden), potje: potje.id });
        onthoud(d.werkgever, wg, 'opgeleid', { samen: wn, wat: duur(maanden), potje: potje.id });
      }
    }
    return nagelaten ? Object.assign(uit, { nagelaten }) : uit;
  }

  return { noteerLoopbaan, noteerNalatenschap };
};
