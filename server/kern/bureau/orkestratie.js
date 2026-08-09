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

// De keten per domein staat als tabel in ./keten.js.
const { KETEN, NOOIT } = require('./keten');

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
