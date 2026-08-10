/* RTG Kantoor: de samenhanglaag over de kantoorwereld (laag 2 uit PLATFORM.md).

   Wat dit WEL is: één plek waar uw werkdag bij elkaar staat -- wat er vandaag
   op de agenda staat, welke taak nog open is, welk document u het laatst
   aanraakte, welk bestand er binnenkwam -- ongeacht in welke app het leeft.

   Wat dit NIET is, en niet mag worden: een eigen kantooradministratie. Deze
   module heeft geen eigen collectie, schrijft nooit, en bewaart niets. Elke
   regel wordt bij het opvragen uit het domein zelf gehaald, via de functie die
   dat domein al had (LAT.md regel 4, en de super-app-regel in PLATFORM.md).

   DE TOETSVRAAG UIT PLATFORM.md, hier toegepast. "Is dit een zelfstandige
   professionele capability, of een tweede ingang naar dezelfde?" Voor alle vier
   is het antwoord het eerste, en daarom smelt hier NIETS samen:

     RTG Office (apps/office.html)   eigen kern (kern/office/), eigen bestandsformaat,
                                     eigen versiebeheer -- documenten, bladen,
                                     presentaties, formulieren. Zelfstandig.
     RTG Agenda (apps/agenda.html)   eigen kern (kern/agenda.js + agenda-pro.js),
                                     eigen ICS-laag en uitnodigingen. Zelfstandig.
     RTG Notities (apps/notities.html) eigen kern, eigen deelmodel, en een eigen
                                     koppeling naar de agenda. Zelfstandig.
     RTG Bestanden (apps/bestanden.html) eigen kern, versleutelde bytes op schijf,
                                     quotum, prullenbak. Zelfstandig.

   Vier volwaardige producten dus, en daarboven dit: één beeld. Werken doet u
   in de specialist; hier staat wat er speelt en een weg erheen.

   De kern wordt LAAT gelezen (kern.agenda, kern.notities, ...) en niet bij het
   opzetten uitgepakt: deze module wordt samengesteld in dezelfde ronde als de
   domeinen die hij leest, en welke laag als eerste klaar is, is geen eigenschap
   waar je op wilt bouwen. */
/* De agenda bewaart per LID onder een eigen sleutel ('lid:' + key), en die
   regel woont in kern/agenda.js naast de opslag die hem gebruikt. Hem hier
   overtikken zou een tweede plek maken die dezelfde waarheid bewaart (LAT.md
   regel 4) -- en precies dat ging hier eerst mis: kern.agenda.lijst(key) gaf
   netjes een lege lijst terug, zonder fout, en het scherm zei "een lege
   werkdag" terwijl er een bestuursoverleg stond. */
const { agendaLidSleutel } = require('./agenda');

module.exports.maakKantoorwereld = ({ kern }) => {

  const dag = (d) => String(d || '').slice(0, 10);
  const vandaag = () => new Date().toISOString().slice(0, 10);

  /* Wat een regel BETEKENT hoort op één plek te wonen -- dezelfde afspraak als
     in kern/reiswereld.js, en met opzet dezelfde woorden. Zou Kantoor zelf
     bedenken dat "vandaag" oranje is terwijl Reizen daar iets anders van maakt,
     dan lopen de twee binnen een maand uit elkaar op precies de vraag waar
     iemand op stuurt (LAT.md regel 4, ONTWERP.md par. 3 en 5).

     Drie dingen per regel, en niet alleen een kleur:
       sig    -- de toestand voor de Signal Rail
       teken  -- het teken naast het woord, want kleur alleen is niet genoeg
       wacht  -- waarop gewacht wordt, als er op iets gewacht wordt */
  const BETEKENIS = {
    verlopen:  { sig: 'incident', teken: '!' },
    vandaag:   { sig: 'aandacht', teken: '!' },
    open:      { sig: 'actief', teken: '◷' },
    gedeeld:   { sig: 'actief', teken: '◷', wacht: 'de ander' },
    klaar:     { sig: 'gezond', teken: '✓' },
    rustig:    { sig: 'gezond', teken: '✓' }
  };

  const regel = (soort, o) => {
    const st = String(o.status || '').toLowerCase();
    const b = BETEKENIS[st] || {};
    return {
      soort, titel: o.titel || '', wanneer: dag(o.wanneer) || null,
      tijd: o.tijd || null, status: o.status || '',
      sig: b.sig || '', teken: b.teken || '', wacht: b.wacht || '',
      /* Alleen meesturen wat het domein ECHT weet. Een document kent geen tijd
         en een agendapunt kent geen eigenaar-van-buiten; daar iets neerzetten
         zou een gegeven verzinnen dat er nooit stond. */
      door: o.door || null,
      kenmerk: o.kenmerk || '', app: o.app, link: o.link
    };
  };

  /* Een bron die stukgaat mag de andere niet meenemen, en mag ook niet stil
     verdwijnen. Een kantoorbeeld dat na een storing drie van de vier domeinen
     toont is erger dan een dat zegt dat het het niet weet: het eerste lijkt
     compleet, en dan mist iemand zijn vergadering. */
  function bron(naam, fn, uit, stil) {
    try { for (const r of fn() || []) uit.push(r); }
    catch (e) { stil.push(naam); }
  }

  function werkdag(key) {
    const uit = [], stil = [];
    const nu = vandaag();

    bron('agenda', () => (kern.agenda.lijst(agendaLidSleutel(key)) || [])
      .filter(i => !i.gedaan && dag(i.datum) >= nu)
      .map(i => regel('afspraak', {
        titel: i.titel, wanneer: i.datum, tijd: i.tijd,
        status: dag(i.datum) === nu ? 'vandaag' : 'open',
        kenmerk: i.id, app: 'Agenda', link: '/apps/agenda.html'
      })), uit, stil);

    /* Taken zijn notities met een afvinklijst of een herinnering. Een notitie
       zonder allebei is een aantekening en geen taak -- die hoort hier niet,
       anders wordt dit beeld een tweede notitie-app. */
    bron('taken', () => {
      const n = kern.notities.notitiesLijst(key) || {};
      const alles = (n.eigen || []).concat(n.gedeeld || []);
      return alles.filter(x => !x.archief && ((x.items || []).some(i => !i.af) || x.herinnerOp))
        .map(x => {
          const open = (x.items || []).filter(i => !i.af).length;
          const wanneer = x.herinnerOp ? dag(x.herinnerOp) : null;
          let status = 'open';
          if (wanneer && wanneer < nu) status = 'verlopen';
          else if (wanneer === nu) status = 'vandaag';
          else if (!x.vanMij) status = 'gedeeld';
          return regel('taak', {
            titel: x.titel || (x.tekst || '').slice(0, 60), wanneer,
            tijd: x.herinnerTijd, status, door: x.vanMij ? null : x.door,
            kenmerk: x.id, app: 'Notities', link: '/apps/notities.html',
            open
          });
        });
    }, uit, stil);

    bron('documenten', () => {
      const d = kern.officeMijn(key) || {};
      /* Alleen wat er ONLANGS is aangeraakt. Een drive uitputtend opsommen is
         het werk van de specialist; hier gaat het om waar u mee bezig was. */
      return (d.docs || []).slice(0, 6).map(x => regel('document', {
        titel: x.titel, wanneer: x.gewijzigd, status: 'rustig',
        kenmerk: x.id, app: 'Office', link: '/apps/office.html'
      })).concat((d.gedeeld || []).slice(0, 4).map(x => regel('document', {
        titel: x.titel, wanneer: x.gewijzigd, status: 'gedeeld', door: x.door,
        kenmerk: x.id, app: 'Office', link: '/apps/office.html'
      })));
    }, uit, stil);

    bron('bestanden', () => {
      const b = kern.bestanden.bestandenLijst(key) || {};
      return (b.gedeeld || []).slice(0, 5).map(x => regel('bestand', {
        titel: x.naam, wanneer: x.gewijzigd || x.op, status: 'gedeeld',
        kenmerk: x.id, app: 'Bestanden', link: '/apps/bestanden.html'
      }));
    }, uit, stil);

    /* Sorteren op wat er als eerste aandacht vraagt, en daarna op tijd. Een
       verlopen taak hoort boven een document van gisteren, ook al is dat
       document recenter aangeraakt. */
    const rang = { incident: 0, aandacht: 1, actief: 2, gezond: 3, '': 4 };
    const regels = uit.sort((a, b) =>
      (rang[a.sig] - rang[b.sig]) ||
      String(a.wanneer || '9999').localeCompare(String(b.wanneer || '9999')) ||
      String(a.tijd || '').localeCompare(String(b.tijd || '')));

    /* Uitzonderingsgestuurd (ONTWERP.md par. 3): het scherm hoort niet te
       roepen hoeveel het weet, maar of er iets aan de hand is. */
    const telling = {
      regels: regels.length,
      vandaag: regels.filter(r => r.wanneer === nu).length,
      aandacht: regels.filter(r => r.sig === 'aandacht' || r.sig === 'incident').length,
      wachtend: regels.filter(r => !!r.wacht).length,
      /* Onbekende toestanden apart tellen en apart noemen. Ze verstoppen tussen
         "in orde" zou een raadsel als geruststelling verkopen. */
      onbekend: regels.filter(r => !r.sig).length
    };

    return {
      ok: true,
      regels,
      telling,
      /* Eerlijk over wat er niet gemeten is: niet nul melden wat onbekend is.
         Het scherm zegt dit hardop, want een leeg kantoorbeeld dat eigenlijk
         een storing is, laat iemand een vergadering missen. */
      stil,
      bronnen: ['agenda', 'taken', 'documenten', 'bestanden']
    };
  }

  return { kantoorwereld: { werkdag } };
};
