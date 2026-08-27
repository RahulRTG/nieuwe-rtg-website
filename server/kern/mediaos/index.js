/* DE MEDIA OS -- één mediawereld over vier apps heen.

   RTG had vier media-apps die niets van elkaar wisten: Klankwerk (muziek),
   Theater (video), Clips (korte video) en Podium (live). Voor een lid is dat
   vier keer dezelfde maker, vier keer een volgknop en vier keer zoeken. Voor
   een maker is het vier keer publiceren en vier keer bijhouden hoe het gaat.

   De Media OS legt daar één laag overheen met DRIE STANDEN op dezelfde wereld:

     MUZIEK  -- wat er is uitgegeven in het Klankwerk
     KIJK    -- de video's van het Theater en de livekanalen van het Podium
     FLOW    -- de korte verticale video's van Clips

   Dezelfde catalogus, dezelfde makers, dezelfde bibliotheek, dezelfde smaak.
   Wie in FLOW iets hoort, staat één tik later bij het hele stuk, de maker en
   zijn andere werk (zie ./hub.js).

   HET ONTWERPBESLUIT DAT ALLES DRAAGT: de Media OS BEZIT DE VIER DOMEINEN
   NIET. Elke rij wordt bij het opvragen uit het domein zelf gehaald, en een
   volgknop hier schrijft in de volgerslijst van het domein zelf. Er komt dus
   geen tweede exemplaar van een clip, een abonnement of een uitgave naast het
   origineel te staan (LAT.md regel 4). Wat de Media OS wél bezit, is precies
   wat nergens bestond: de bibliotheek over de vormen heen, het smaakprofiel
   dat u zelf invult, en de meldingsvoorkeur per maker.

   EN WAT ER MET OPZET NIET KOMT. Geen oneindige feed, geen volgorde op
   populariteit, geen stil meegeschreven kijkprofiel. De drie apps eronder
   weigeren dat alle drie met zoveel woorden; een laag erboven die het alsnog
   invoert, draait die keuzes terug zonder dat iemand het merkt. Bij elk stuk
   staat waarom het er staat, en de regelaars om dat bij te sturen staan
   ernaast (./smaak.js). */
'use strict';

const { maakCatalogus } = require('./catalogus');
const { maakSmaak } = require('./smaak');
const { maakHub } = require('./hub');
const { maakWekken } = require('./wekken');
const { legeStand } = require('./leeg');

const MODI = {
  muziek: { naam: 'Muziek', vormen: ['track'] },
  kijk: { naam: 'Kijk', vormen: ['video', 'live'] },
  flow: { naam: 'Flow', vormen: ['clip'] },
  alles: { naam: 'Alles', vormen: ['track', 'video', 'clip', 'live'] },
  /* MEDIA FOR BUSINESS. Een eigen stand, geen filter over de gewone wereld:
     wat hier staat is INTERN gepubliceerd (kern/theater/zaak.js, kern/podium
     zone 'zaak') en staat in geen enkele openbare lijst. Een filter over
     openbaar werk zou het woord "intern" gebruiken voor iets wat het niet is.
     De stand verschijnt alleen bij wie ergens werkt -- zie zaakWereld(). */
  zaak: { naam: 'Zaak', vormen: ['video', 'live'], intern: true }
};
const WERELD_MAX = 60;      // de wereld is eindig, en zegt waar hij ophoudt

function maakMediaOS({ db, save, schoon, crypto, codenaamVan, keyVanCodenaam, notify, bronnen, zijnVrienden, sseToCustomer }) {
  const catalogus = maakCatalogus({ bronnen });
  const smaak = maakSmaak({ db, save, schoon });
  const hub = maakHub({ catalogus, bronnen, keyVanCodenaam, codenaamVan });

  /* Wat de Media OS ZELF bezit -- de bibliotheek over de vier vormen heen en
     de meldingsvoorkeur per maker -- staat in ./eigen.js. Dat is precies de
     naad van dit bestand: alles hier omheen LEEST de vier domeinen, dat ene
     bestand is het enige dat schrijft in eigen tafels. */
  const eigen = require('./eigen')({ db, save, schoon, catalogus });
  const { biebVan, bewaar, bieb, meldZet, meldVan, MELD_SOORTEN } = eigen;
  /* En het derde eigen ding: AFSPEELLIJSTEN over de vier vormen (./lijsten.js).
     Zelfde regel als de bibliotheek -- alleen id's, opgelost met de sessie van
     de lezer, dus wat weg of dicht is, staat er als verdwenen en niet als een
     kaart die niemand kan spelen. */
  const lijsten = require('./lijsten')({ db, save, schoon, crypto, catalogus, codenaamVan, keyVanCodenaam, zijnVrienden });
  /* En het vierde: SAMEN LUISTEREN (./samen.js). Een luisterkamer deelt de
     aanwijzer en niet het geluid -- iedere deelnemer lost het stuk op met zijn
     eigen sessie, dus de kamer is geen manier om iemand iets te laten horen
     wat hij zelf niet mag openen. */
  const samen = require('./samen')({ db, save, crypto, catalogus, codenaamVan, keyVanCodenaam, zijnVrienden, sseToCustomer });
  /* En de andere kant van die voorkeur: nieuw werk wekt de volgers die dit
     soort van deze maker aan hebben staan (./wekken.js). De vier domeinen
     roepen dat aan via een laat gebonden haak in ./opzet/kernlaag*.js. */
  const wekken = maakWekken({ notify, codenaamVan, meldVan, bronnen });

  /* VOLGEN staat in ./volgen.js: één knop die in Clips en het Theater tegelijk
     schrijft, en met opzet NIET in het betaalde Podium-abonnement. Dat is een
     eigen onderwerp -- het gaat over schrijven in de domeinen, terwijl de rest
     van dit bestand leest. */
  const volg = require('./volgen')({ schoon, keyVanCodenaam, bronnen, meldVan, MELD_SOORTEN });

  /* MEDIA FOR BUSINESS (./zaakwereld.js): de interne wereld van uw organisatie
     -- de opgenomen bibliotheek van het Theater en de interne livekanalen van
     het Podium. Eigen bestand, want het is een eigen wereld met een eigen deur;
     zie de kop daar voor waarom dit géén filter over de openbare wereld is. */
  const { zaakWereld, modiVoor } = require('./zaakwereld')({ MODI, catalogus, bronnen });

  /* ---- de wereld: één catalogus, drie standen ---- */
  function wereld(sess, opties) {
    const o = opties || {};
    if (o.modus === 'zaak') return zaakWereld(sess);
    const modusNaam = MODI[o.modus] ? o.modus : 'alles';
    const modus = MODI[modusNaam];
    const alles = catalogus.alles(sess);
    const s = smaak.smaakVan(sess.key);

    // wie u volgt, afgeleid uit de domeinen zelf (geen tweede lijst)
    const volgt = new Set();
    for (const r of alles.rijen) if (r.volgIk) volgt.add((r.maker || {}).codenaam);

    const inModus = alles.rijen.filter(r => modus.vormen.includes(r.vorm));
    const geordend = smaak.smaakOrden(inModus, s, volgt);
    const bewaard = new Set(biebVan(sess.key).map(x => x.id));
    const rijen = geordend.rijen.slice(0, WERELD_MAX)
      .map(r => Object.assign({}, r, { bewaard: bewaard.has(r.id) }));

    const meer = geordend.rijen.length - rijen.length;
    /* Een leeg raster ziet eruit als een kapotte app en zegt niet waarom. Bij
       niets te tonen komt er daarom een stand mee die WEL iets zegt: wat hier
       komt, waarom het er nu niet is, en welke stap dat opheft (./leeg.js). */
    const leeg = rijen.length ? null : legeStand(modusNaam, alles.buiten, geordend.weggelaten, modus.vormen);
    return {
      status: 200, modus: modusNaam, modusNaam: modus.naam,
      leeg,
      modi: modiVoor(sess),
      stukken: rijen,
      totaal: geordend.rijen.length,
      einde: meer > 0
        ? 'Dat is wat er nu voor u klaarstaat; er staan nog ' + meer + ' stukken achter de rand.'
        : 'Dat was alles wat er nu staat.',
      uitleg: 'Op volgorde van: wie u volgt, wat u zelf hebt aangewezen, en daarna wat er het laatst bij kwam. ' +
        'Er is geen hitlijst en geen volgorde op kijkcijfers; bij elk stuk staat waarom het er staat.',
      weggelaten: geordend.weggelaten,
      /* Alleen de bronnen die in DEZE stand horen. Onder FLOW stond anders een
         kaart "Live staat buiten uw wereld" -- waar in die stand helemaal geen
         live in zit. Zelfde filter als in ./leeg.js, en om dezelfde reden: een
         scherm hoort geen deur te noemen die er niet toe doet. */
      buiten: (alles.buiten || []).filter(b => modus.vormen.includes(b.vorm)),
      smaak: s, regelaars: smaak.smaakRegelaars(),
      volgt: [...volgt].filter(Boolean)
    };
  }

  return Object.assign({}, lijsten, samen, {
    /* De catalogus gaat naar buiten omdat de uitvoerende laag (kern/uitvoering/)
       fragmenten met de sessie van de KIJKER moet oplossen, langs precies deze
       weg. Hem daar opnieuw opbouwen uit dezelfde bronnen zou een tweede
       antwoord geven op "wat mag dit lid zien" -- en dat is er een te veel
       (LAT.md regel 4). Lezen alleen: er staat geen schrijvende functie op. */
    mediaCatalogus: catalogus,
    mediaWereld: wereld, mediaVolg: volg,
    mediaBieb: bieb, mediaBewaar: bewaar,
    mediaMeldZet: meldZet, mediaMeldVan: meldVan,
    mediaSmaakStuur: (sess, o) => smaak.smaakStuur(sess.key, o),
    mediaSmaakVan: (sess) => ({ status: 200, smaak: smaak.smaakVan(sess.key), regelaars: smaak.smaakRegelaars() }),
    mediaStuk: hub.mediaStuk, mediaMaker: hub.mediaMaker, mediaBord: hub.mediaBord,
    mediaNieuwWerk: wekken.mediaNieuwWerk, mediaVolgersVan: wekken.mediaVolgersVan,
    MEDIA_MODI: MODI, MEDIA_MELD_SOORTEN: MELD_SOORTEN
  });
}

module.exports = { maakMediaOS, MODI };
