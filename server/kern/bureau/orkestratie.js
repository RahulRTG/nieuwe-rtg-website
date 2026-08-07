/* Het Privekantoor, deelbestand "orkestratie": wat raakt dit nog meer?

   Dit is het onderdeel waarvoor de Life Graph is gebouwd. Alle andere delen
   lezen de graaf om iets te TONEN; dit deel leest hem om een vraag te
   beantwoorden die het lid anders zelf moest stellen, dertien apps lang:

     "Wij gaan in augustus zes weken naar Ibiza."

   Dat is geen reis. Dat is een huis dat zes weken leegstaat, personeel dat
   moet worden ingeroosterd of juist niet, wagens die stilstaan en toch APK
   moeten, paspoorten die precies in die weken verlopen, een verjaardag die u
   mist, een verzekering die intussen afloopt en een diner dat u al had
   toegezegd.

   TWEE HELFTEN, en ze doen echt iets anders:

     de KETEN     wat een verzoek in dit domein altijd raakt. Een vaste tabel,
                  want dit is vakkennis en geen berekening: een diner thuis
                  raakt gasten, wijn, personeel, de woning en vervoer, en dat
                  is zo of er nu iets in de graaf staat of niet.
     de RAAKVLAKKEN  wat het in DIT geval raakt. Komt uit de graaf en uit de
                  periode: welke termijnen vallen erin, welke afspraken, welke
                  lopende zaken.

   De tabel zonder de graaf geeft een algemeen lijstje dat voor iedereen
   hetzelfde is. De graaf zonder de tabel mist alles wat nog nergens als datum
   staat. Samen zijn ze het verschil tussen een checklist en een kantoor.

   ELKE DEELOPDRACHT KRIJGT ZIJN EIGEN OORDEEL. Dat is de reden dat dit niet
   gewoon een lijstje is: "het huis winterklaar" valt onder huishouden en mag
   bij L4 vanzelf lopen, terwijl "vervoer voor uw gasten" onder vervoer valt en
   bij L2 aan u wordt voorgelegd. Een verzoek valt dus uiteen in stukken die
   ieder hun eigen mandaat volgen -- en dat is precies wat een chef de bureau
   doet.

   WAT HIER NOOIT IN KOMT: gezondheid en nalatenschap. Geen enkel verzoek mag
   die twee als deelopdracht meenemen; het zijn de twee kamers die het kantoor
   niet aanraakt (zie delegatie.js en cases.js, waar dezelfde grens iets anders
   doet). Een reis die "even uw dokter afzegt" is precies de vanzelfsprekendheid
   die wij niet leveren.

   Gemount via ./index.js. */
'use strict';

// de twee kamers die nooit door een ander verzoek worden meegenomen
const NOOIT = new Set(['gezondheid', 'nalatenschap']);

/* De keten per domein. Elk stuk noemt het domein waaronder het VALT -- niet het
   domein van het verzoek -- want daar hangt zijn mandaat aan. */
const K = (domein, wat, waarom) => ({ domein, wat, waarom });
const KETEN = {
  reizen: [
    K('gezelschap', 'Reisdocumenten van uw gezelschap', 'Een paspoort dat tijdens uw reis verloopt, verloopt op de verkeerde plek.'),
    K('huishouden', 'Het huis tijdens uw afwezigheid', 'Personeel, post, toezicht en de dingen die doorlopen.'),
    K('vervoer', 'Heen en terug, en wat er blijft staan', 'Ook een wagen die stilstaat heeft zijn keuring.'),
    K('kring', 'Wat u in die weken zou missen', 'Verjaardagen en afspraken vallen niet stil omdat u weg bent.'),
    K('gelegenheden', 'Toezeggingen in die periode', 'Wat u al had toegezegd, zegt u liever nu af dan later.')
  ],
  gelegenheden: [
    K('kring', 'Gasten en uitnodigingen', 'Wie komt er, en wat weten wij al van hen?'),
    K('gezelschap', 'Personeel voor die avond', 'Bediening, keuken en wie er blijft.'),
    K('collectie', 'Wijn uit uw kelder', 'Wat staat er klaar, en wat drinkt nu op zijn mooist?'),
    K('huishouden', 'De woning gereed', 'Schoonmaak, inrichting en wat er die dag nog moet gebeuren.'),
    K('vervoer', 'Vervoer voor uw gasten', 'Halen, brengen en waar iedereen parkeert.')
  ],
  huishouden: [
    K('gezelschap', 'Wie het uitvoert', 'Uw vaste mensen, of iemand die wij erbij halen.'),
    K('vermogen', 'Wat het aan de woning verandert', 'Verbouwing en onderhoud raken de waarde en de polis.')
  ],
  vervoer: [
    K('vermogen', 'Verzekering en waarde', 'Een aanschaf of ingreep hoort in het register te staan.'),
    K('gezelschap', 'Wie ermee rijdt', 'Chauffeur, sleutels en de afspraken eromheen.')
  ],
  collectie: [
    K('vermogen', 'Taxatie en polis', 'Wat u toevoegt, hoort verzekerd en getaxeerd te zijn.'),
    K('huishouden', 'Waar het komt te staan', 'Klimaat, ruimte en beveiliging.')
  ],
  kring: [
    K('gelegenheden', 'Het moment zelf', 'Een attentie is vaak een afspraak in vermomming.')
  ],
  vermogen: [
    K('huishouden', 'Wat het in huis betekent', 'Een aankoop moet ergens staan en verzorgd worden.')
  ],
  gezelschap: [
    K('huishouden', 'Het rooster thuis', 'Wie er komt en wanneer raakt het huishouden.')
  ],
  filantropie: []
};

module.exports = (ctx) => {
  const { graaf, cases, beoordeel, rid, inAanbouw } = ctx;
  const isDatum = d => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));
  const vandaag = () => new Date().toISOString().slice(0, 10);

  /* Wat raakt een periode? Puur uit de graaf: elke knoop met een datum die in
     het venster valt. Geen tabel, geen aanname -- als het lid het nergens heeft
     ingevuld, weten wij het niet, en dan zeggen wij dat ook (zie `gedekt`). */
  function inPeriode(key, van, tot, voorafG) {
    const g = voorafG || graaf(key);
    const a = isDatum(van) ? van : vandaag();
    const b = isDatum(tot) ? tot : a;
    return g.knopen
      .filter(k => k.vervalt && k.vervalt >= a && k.vervalt <= b)
      .map(k => {
        const ouder = k.ouder ? g.perId.get(k.ouder) : null;
        return { id: k.id, naam: k.naam, wat: k.vervaltWat, kamer: k.kamer, bron: k.bron,
          datum: k.vervalt, waarvan: ouder ? ouder.naam : '' };
      })
      .sort((x, y) => x.datum.localeCompare(y.datum));
  }

  /* De deelopdrachten van een zaak: de keten van zijn domein, elk stuk met een
     eigen oordeel van de delegatie-engine en met wat de graaf erover weet. */
  function deelopdrachten(key, zaak, voorafG) {
    const g = voorafG || graaf(key);
    const keten = KETEN[zaak.domein] || [];
    const raak = (zaak.van || zaak.tot) ? inPeriode(key, zaak.van, zaak.tot, g) : [];
    return keten.filter(st => !NOOIT.has(st.domein)).map(st => {
      /* Het bedrag van de hoofdzaak telt hier NIET mee. Een diner van vijftien
         mille maakt "wie komt er" geen beslissing van vijftien mille; wat een
         deelopdracht kost weten wij pas als iemand ernaar heeft gekeken. Dus
         nul, en dat betekent: binnen elke grens die er is. */
      const oordeel = beoordeel(key, st.domein, 0);
      return {
        id: zaak.id + ':' + st.domein,
        domein: st.domein, wat: st.wat, waarom: st.waarom,
        magZelf: oordeel.magZelf, reden: oordeel.reden,
        // wat de graaf hierover al weet: knopen in die kamer, en de termijnen
        // die in de periode van de zaak vallen
        inBeeld: g.knopen.filter(k => k.kamer === st.domein && !k.ouder).length,
        raakt: raak.filter(r => r.kamer === st.domein)
      };
    });
  }

  /* Het antwoord op "wij gaan zes weken weg". Los opvraagbaar, want het is ook
     zonder zaak een zinnige vraag -- het lid wil eerst WETEN wat het raakt en
     dan pas beslissen of hij ons erop zet. */
  function raakvlak(key, b) {
    const g = graaf(key);
    const van = isDatum(b.van) ? b.van : vandaag();
    const tot = isDatum(b.tot) ? b.tot : van;
    if (tot < van) return { status: 400, error: 'De einddatum ligt voor de begindatum.' };
    const raakt = inPeriode(key, van, tot, g);
    const domein = KETEN[b.domein] ? b.domein : 'reizen';
    const nep = { id: 'proef', domein, van, tot };
    const zaken = cases(key).zaken.filter(z => z.van && z.van >= van && z.van <= tot);
    const perKamer = {};
    for (const r of raakt) (perKamer[r.kamer] = perKamer[r.kamer] || []).push(r);
    return {
      status: 200, van, tot, domein,
      dagen: Math.round((new Date(tot + 'T12:00:00Z') - new Date(van + 'T12:00:00Z')) / 86400000) + 1,
      raakt, perKamer, zaken,
      keten: deelopdrachten(key, nep, g),
      /* Eerlijk over wat wij NIET weten: de kamers die nog in aanbouw zijn
         kunnen hier niets melden, en juist bij een lange afwezigheid is "uw
         dieren" geen detail. Dit zwijgen benoemen is het halve werk; doen alsof
         de lijst compleet is, is de fout.

         De lijst komt UIT de plattegrond (kamers.js) en staat hier niet nog een
         keer. Hij stond dat wel, en liep binnen een uur uiteen: zodra inkoop een
         kamer met een deur werd, bleef hier staan dat wij er geen zicht op
         hadden. Regel 4 van de lat, betrapt op heterdaad. */
      nietGedekt: inAanbouw ? inAanbouw() : []
    };
  }

  return { raakvlak, deelopdrachten, inPeriode, ORKESTRATIE_KETEN: KETEN, ORKESTRATIE_NOOIT: NOOIT };
};
