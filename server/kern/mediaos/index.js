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

const MODI = {
  muziek: { naam: 'Muziek', vormen: ['track'] },
  kijk: { naam: 'Kijk', vormen: ['video', 'live'] },
  flow: { naam: 'Flow', vormen: ['clip'] },
  alles: { naam: 'Alles', vormen: ['track', 'video', 'clip', 'live'] }
};
const WERELD_MAX = 60;      // de wereld is eindig, en zegt waar hij ophoudt

function maakMediaOS({ db, save, schoon, codenaamVan, keyVanCodenaam, notify, bronnen }) {
  const catalogus = maakCatalogus({ bronnen });
  const smaak = maakSmaak({ db, save, schoon });
  const hub = maakHub({ catalogus, bronnen, keyVanCodenaam, codenaamVan });

  /* Wat de Media OS ZELF bezit -- de bibliotheek over de vier vormen heen en
     de meldingsvoorkeur per maker -- staat in ./eigen.js. Dat is precies de
     naad van dit bestand: alles hier omheen LEEST de vier domeinen, dat ene
     bestand is het enige dat schrijft in eigen tafels. */
  const eigen = require('./eigen')({ db, save, schoon, catalogus });
  const { biebVan, bewaar, bieb, meldZet, meldVan, MELD_SOORTEN } = eigen;
  /* En de andere kant van die voorkeur: nieuw werk wekt de volgers die dit
     soort van deze maker aan hebben staan (./wekken.js). De vier domeinen
     roepen dat aan via een laat gebonden haak in ./opzet/kernlaag*.js. */
  const wekken = maakWekken({ notify, codenaamVan, meldVan, bronnen });

  /* ---- volgen: één knop, en hij schrijft in de domeinen zelf ----
     Clips en het Theater kennen een gratis volgrelatie; die worden allebei
     gezet. Het Podium kent alleen een BETAALD maandabonnement, en dat wordt
     hier met opzet niet aangeraakt: één volgknop die ongemerkt een incasso
     start is precies wat niet mag. De hub geeft dat als aparte stap terug. */
  async function volg(sess, opdracht) {
    const o = opdracht || {};
    const naam = schoon(o.codenaam, 60);
    if (!naam) return { status: 400, error: 'Zeg erbij wie u wilt volgen.' };
    /* De gids is async en geeft een RIJ terug, geen sleutel; zie de uitleg in
       ./hub.js. Wie hier de Promise als sleutel gebruikt, schrijft een
       onvindbare volgrelatie weg zonder dat er iets klaagt. */
    const rij = keyVanCodenaam ? await keyVanCodenaam(naam) : null;
    const mKey = rij && rij.key ? rij.key : null;
    if (!mKey) return { status: 404, error: 'Deze maker bestaat niet (of heeft een andere codenaam).' };
    if (mKey === sess.key) return { status: 400, error: 'U hoeft uzelf niet te volgen.' };
    const aan = o.aan !== false;
    const gedaan = [];
    /* Alleen schrijven waar er ook iets te volgen IS. Een volgrelatie op een
       maker zonder werk zou een rij in de lijst van Clips zetten waar nooit
       iets uit komt -- en het lid zou "volgend" zien staan zonder dat dat
       ergens op slaat. */
    const heeftClips = bronnen.clipsVan ? (bronnen.clipsVan(mKey, sess.key) || []).length > 0 : false;
    if (heeftClips && bronnen.volgClips) {
      const r = bronnen.volgClips(sess.key, mKey, aan);
      if (r && !r.error) gedaan.push('clips');
    }
    const kanaal = bronnen.theaterKanaalVan ? bronnen.theaterKanaalVan(mKey) : null;
    if (kanaal && bronnen.volgTheater) {
      const r = bronnen.volgTheater(sess.key, kanaal.id, aan);
      if (r && !r.error) gedaan.push('theater');
    }
    if (!gedaan.length) {
      return { status: 409, error: 'Van deze maker staat er nog niets waar een volgrelatie op past.' };
    }
    return { status: 200, ok: true, volg: aan, in: gedaan, codenaam: naam,
      meldingen: meldVan(sess.key, naam), soortenMogelijk: MELD_SOORTEN,
      let: 'Een livekanaal van het Podium kost een maandbedrag; dat blijft een aparte, bewuste stap.' };
  }

  /* ---- de wereld: één catalogus, drie standen ---- */
  function wereld(sess, opties) {
    const o = opties || {};
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
    return {
      status: 200, modus: modusNaam, modusNaam: modus.naam,
      modi: Object.keys(MODI).map(k => ({ id: k, naam: MODI[k].naam })),
      stukken: rijen,
      totaal: geordend.rijen.length,
      einde: meer > 0
        ? 'Dat is wat er nu voor u klaarstaat; er staan nog ' + meer + ' stukken achter de rand.'
        : 'Dat was alles wat er nu staat.',
      uitleg: 'Op volgorde van: wie u volgt, wat u zelf hebt aangewezen, en daarna wat er het laatst bij kwam. ' +
        'Er is geen hitlijst en geen volgorde op kijkcijfers; bij elk stuk staat waarom het er staat.',
      weggelaten: geordend.weggelaten,
      buiten: alles.buiten,
      smaak: s, regelaars: smaak.smaakRegelaars(),
      volgt: [...volgt].filter(Boolean)
    };
  }

  return {
    mediaWereld: wereld, mediaVolg: volg,
    mediaBieb: bieb, mediaBewaar: bewaar,
    mediaMeldZet: meldZet, mediaMeldVan: meldVan,
    mediaSmaakStuur: (sess, o) => smaak.smaakStuur(sess.key, o),
    mediaSmaakVan: (sess) => ({ status: 200, smaak: smaak.smaakVan(sess.key), regelaars: smaak.smaakRegelaars() }),
    mediaStuk: hub.mediaStuk, mediaMaker: hub.mediaMaker, mediaBord: hub.mediaBord,
    mediaNieuwWerk: wekken.mediaNieuwWerk, mediaVolgersVan: wekken.mediaVolgersVan,
    MEDIA_MODI: MODI, MEDIA_MELD_SOORTEN: MELD_SOORTEN
  };
}

module.exports = { maakMediaOS, MODI };
