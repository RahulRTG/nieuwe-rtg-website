/* Media OS (deelmodule): DE STUK-HUB, HET MAKERSPROFIEL EN HET MAKERSBORD.

   DE STUK-HUB. Eén stuk is zelden één ding. Onder een uitgegeven nummer hangen
   de clips die dat nummer als geluid gebruiken (die verbinding bestaat echt in
   de data: kern/clips-studio.js legt vast welk EIGEN stuk er onder een clip
   ligt), het andere werk van dezelfde maker, en het livekanaal waar hij
   optreedt. De hub zet die bij elkaar in plaats van vier keer zoeken.

   WAT DE HUB WEL EN NIET VERBINDT. Alleen verbindingen die in de gegevens
   ZITTEN: dezelfde maker, en hetzelfde geluid onder een clip. Er is hier geen
   "officiële videoclip bij dit nummer", want niemand heeft die koppeling ooit
   gelegd -- een gokje op titelgelijkenis zou eruitzien als een feit en dat
   niet zijn.

   HET MAKERSBORD telt alleen wat er ECHT geteld wordt. Er staat geen bereik en
   geen kijktijd, omdat RTG die niet bijhoudt: Clips-beeld passeert de server
   nooit, en het Theater telt geen weergaven. Een trechter van verzonnen
   getallen is voor een maker erger dan geen trechter -- die stuurt hij bij op
   cijfers die niets meten. Wat er niet geteld wordt, staat er met naam bij. */
'use strict';

function maakHub({ catalogus, bronnen, keyVanCodenaam, codenaamVan }) {
  const { vanTrack, vanVideo, vanClip, vanLive, deelId } = catalogus;

  const lijst = (fn) => {
    try { const r = fn(); return Array.isArray(r) ? r : (r && r.error ? [] : (r || [])); }
    catch (e) { return []; }
  };

  /* De gids is de ENIGE plek waar een codenaam aan een sleutel vastzit, en hij
     is ASYNC (met Postgres een geindexeerde opzoeking) en geeft een RIJ terug,
     geen sleutel. Daarom is alles hieronder async en wordt er `.key` uit
     gepakt. Wie dat vergeet, krijgt een Promise als sleutel: altijd waar, dus
     de maker "bestaat" altijd en zijn werk is altijd leeg -- precies een
     stille storing, en die is hier door toets 5 en 9 gevonden. */
  const sleutelVan = async (naam) => {
    if (!keyVanCodenaam) return null;
    const rij = await keyVanCodenaam(naam);
    return rij && rij.key ? rij.key : null;
  };

  /* ---- het makersprofiel: één maker, alle vormen, één volgstand ---- */
  async function maker(sess, codenaam) {
    const naam = String(codenaam || '');
    const mKey = await sleutelVan(naam);
    if (!mKey) return { status: 404, error: 'Deze maker bestaat niet (of heeft een andere codenaam).' };
    const key = sess.key;
    const tracks = lijst(() => bronnen.tracksVan(mKey, key)).map(u => vanTrack(u, key));
    const videos = lijst(() => bronnen.videosVan(mKey)).map(v => vanVideo(v, key, false));
    const clips = lijst(() => bronnen.clipsVan(mKey, key)).map(c => vanClip(c, key));
    const kanaal = bronnen.liveVan ? bronnen.liveVan(mKey, key) : null;
    const live = kanaal ? [vanLive(kanaal, key)] : [];
    const theaterKanaal = bronnen.theaterKanaalVan ? bronnen.theaterKanaalVan(mKey) : null;

    /* De volgstand is een SAMENVATTING van de domeinen, geen eigen waarheid.
       Wie hier "volgend" ziet staan, staat ook echt in de volgerslijst van
       Clips of in de abonnees van het Theaterkanaal. */
    const volgtClips = clips.some(c => c.volgIk);
    const volgtTheater = !!(bronnen.volgtTheater && bronnen.volgtTheater(key, mKey));
    return {
      status: 200,
      maker: { codenaam: naam, zelf: mKey === key },
      volg: {
        aan: volgtClips || volgtTheater,
        clips: volgtClips, theater: volgtTheater,
        theaterKanaal: theaterKanaal ? { id: theaterKanaal.id, naam: theaterKanaal.naam } : null,
        /* Het maandabonnement op een livekanaal is een BETALING en blijft een
           aparte, bewuste stap. Eén volgknop die ongemerkt een incasso start,
           is precies wat hier niet hoort te kunnen. */
        live: kanaal ? { id: kanaal.id, abonnee: !!kanaal.ikAbonnee, centen: kanaal.abbCenten || 0,
          let: 'Een livekanaal volgen kost geld; dat regelt u in het Podium, bewust en apart.' } : null
      },
      werk: { muziek: tracks, video: videos, flow: clips, live },
      aantallen: { muziek: tracks.length, video: videos.length, flow: clips.length, live: live.length }
    };
  }

  /* ---- de hub rond één stuk ---- */
  async function stuk(sess, id) {
    const d = deelId(id);
    if (!d) return { status: 400, error: 'Dit is geen geldig stuk-id.' };
    const key = sess.key;
    const wereld = catalogus.alles(sess);
    const dit = wereld.rijen.find(r => r.id === id);
    if (!dit) return { status: 404, error: 'Dit stuk staat niet (meer) in uw wereld.' };

    const mk = (dit.maker || {}).codenaam || '';
    const mKey = await sleutelVan(mk);
    const verwant = { muziek: [], video: [], flow: [], live: [] };
    if (mKey) {
      verwant.muziek = lijst(() => bronnen.tracksVan(mKey, key)).map(u => vanTrack(u, key)).filter(x => x.id !== id);
      verwant.video = lijst(() => bronnen.videosVan(mKey)).map(v => vanVideo(v, key, false)).filter(x => x.id !== id);
      verwant.flow = lijst(() => bronnen.clipsVan(mKey, key)).map(c => vanClip(c, key)).filter(x => x.id !== id);
      const kanaal = bronnen.liveVan ? bronnen.liveVan(mKey, key) : null;
      if (kanaal) verwant.live = [vanLive(kanaal, key)].filter(x => x.id !== id);
    }

    /* De echte tweede verbinding: clips die DIT stuk als geluid gebruiken.
       Alleen bij een uitgave, want alleen daar ligt een track-id onder. */
    let gebruiktAls = [];
    if (dit.vorm === 'track' && dit.trackId && bronnen.clipsMetTrack) {
      gebruiktAls = lijst(() => bronnen.clipsMetTrack(dit.trackId, key)).map(c => vanClip(c, key));
    }
    return {
      status: 200, stuk: dit,
      gebruiktAls,
      gebruiktAlsUitleg: dit.vorm === 'track'
        ? (gebruiktAls.length ? 'Korte video’s waar dit stuk onder ligt.' : 'Nog geen korte video’s met dit stuk eronder.')
        : null,
      verwant,
      maker: { codenaam: mk, zelf: mKey === key },
      uitleg: 'Alles hier hangt aan dit stuk langs een verbinding die echt in de gegevens staat: dezelfde maker, of hetzelfde geluid. Wij raden niets bij elkaar.'
    };
  }

  /* ---- het makersbord: één trechter over alle vormen ---- */
  function bord(sess) {
    const key = sess.key;
    const tracks = lijst(() => bronnen.tracksVan(key, key));
    const videos = lijst(() => bronnen.videosVan(key));
    const clips = lijst(() => bronnen.clipsVan(key, key));
    const kanaal = bronnen.liveVan ? bronnen.liveVan(key, key) : null;
    const theaterKanaal = bronnen.theaterKanaalVan ? bronnen.theaterKanaalVan(key) : null;
    const clipVolgers = (bronnen.clipsVolgersVan ? bronnen.clipsVolgersVan(key) : []).length;

    const som = (rij, veld) => rij.reduce((n, x) => n + (Number(x[veld]) || 0), 0);
    const volgers = (theaterKanaal ? (theaterKanaal.volgers || 0) : 0) + clipVolgers;
    return {
      status: 200,
      werk: {
        muziek: { stukken: tracks.length, mooi: som(tracks, 'mooi'), reacties: som(tracks, 'reacties') },
        video: { stukken: videos.length, reacties: som(videos, 'reacties'),
          kanaal: theaterKanaal ? theaterKanaal.naam : null,
          status: theaterKanaal ? theaterKanaal.status : 'geen kanaal' },
        flow: { stukken: clips.length, reacties: som(clips, 'reacties') },
        live: kanaal ? { kanaal: kanaal.naam, live: !!kanaal.live, kijkers: kanaal.kijkers || 0 } : null
      },
      relatie: { volgers, theaterVolgers: theaterKanaal ? (theaterKanaal.volgers || 0) : 0, clipVolgers },
      geld: {
        podiumAbonnees: kanaal && kanaal.abonnees != null ? kanaal.abonnees : 0,
        podiumVerdiendCenten: kanaal && kanaal.verdiend != null ? kanaal.verdiend : 0,
        uitleg: 'Cadeaus en maandabonnementen van het Podium lopen via RTG Pay; dat is vandaag de enige plek waar een maker hier iets verdient.'
      },
      /* Regel 6: wat er niet staat, staat er MET NAAM bij. Anders leest een
         maker de stilte als een nul. */
      nietGeteld: [
        'weergaven en kijktijd -- die worden nergens bijgehouden',
        'bereik en doorklik -- daarvoor zou elk scherm mee moeten schrijven, en dat doet het niet',
        'streams per stuk -- het Klankwerk telt "mooi" en reacties, geen luisterbeurten'
      ]
    };
  }

  return { mediaMaker: maker, mediaStuk: stuk, mediaBord: bord };
}

module.exports = { maakHub };
