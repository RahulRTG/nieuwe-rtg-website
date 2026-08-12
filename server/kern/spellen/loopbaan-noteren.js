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

module.exports = ({ onthoud, onthoudBaan, duur, codenaamVan }) => {
  /* ---------- de nalatenschap: wat je achterliet bij wie doorging ----------

     DRIE REGELS, en ze volgen alle drie uit lagen die er al stonden.

     1. GEEN OPVOLGER, GEEN MOMENT. Wie zonder opvolger uitstapt wikkelt af en
        laat niemand achter. Dan is er geen tweede mens, en `onthoud` weigert
        zo'n moment sowieso -- de wet van deze laag is dat een herinnering twee
        mensen raakt. Hier wordt hij niet eens aangeboden.
     2. TWEE KANTEN, ELK OP ZIJN EIGEN CODENAAM EN ELK MET ZIJN EIGEN GRENS. Een
        volwassene die met een tiener speelde houdt zijn eigen kant; de tiener
        houdt niets. Daarom staan hier twee aanroepen en geen gedeelde vlag.
     3. WAT HIJ ONTHOUDT IS EEN DUUR. Zie de kop hierboven. */
  function noteerNalatenschap(potje) {
    const weg = ((potje && potje.staat) || {}).uit || {};
    const uit = [];
    for (const [h, w] of Object.entries(weg)) {
      /* Wie met lege handen vertrok liet ook niets achter, en een moment
         daarover zou een herinnering aan een leegte zijn. */
      if (!w || !w.naar || !(w.overgedragen > 0)) continue;
      const van = codenaamVan(h), naar = codenaamVan(w.naar);
      const hoelang = duur(w.maand || 0);
      const a = onthoud(h, van, 'doorgegeven', { samen: naar, wat: hoelang, potje: potje.id });
      const b = onthoud(w.naar, naar, 'overgenomen', { samen: van, wat: hoelang, potje: potje.id });
      if (a.bewaard || b.bewaard) uit.push({ van, naar, maand: w.maand || 0 });
    }
    return uit.length ? uit : null;
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
      const r1 = onthoudBaan(d.werknemer, wn, { werkgever: wg, rol: d.rol,
        rolnaam: d.rolnaam, maanden, reden: d.reden || 'partij voorbij', potje: potje.id });
      if (r1.bewaard) {
        onthoud(d.werknemer, wn, 'eerste_baan', { samen: wg, wat: d.rol, potje: potje.id });
        uit.push({ wie: wn, bij: wg });
      }
      /* En de werkgeverskant: dat er iemand voor je werkte is ook JOUW
         geschiedenis. Hij krijgt geen `baan` -- hij had er geen -- maar wel het
         moment, want er was een tweede mens bij. */
      onthoud(d.werkgever, wg, 'eerste_mens', { samen: wn, wat: d.rol, potje: potje.id });
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
