/* Media OS (deelmodule): DE VIER VERTALERS -- van een domeinbeeld naar EEN stuk.

   Klankwerk, Theater, Clips en Podium tonen hun werk elk in hun eigen vorm.
   Hier wordt daar een rij van gemaakt die de wereld, de bibliotheek, een
   afspeellijst en een uitvoering allemaal kunnen lezen.

   Gesplitst van ./catalogus.js toen dat bestand over de 10 kB-keuringsgrens
   ging, en de naad die de keuring aanwees was ook de juiste: daar staat hoe de
   WERELD wordt samengesteld, hier staat hoe EEN stuk eruitziet.

   WAT ELKE VERTALER MOET DRAGEN, en waarom dat geen kleinigheid is: `spelen`
   (waar en hoe dit afspeelt, en als dat elders is: waarom), `mijn` (is dit van
   de kijker -- de enige plek waar die vraag wordt beantwoord), en `duurS` waar
   die bekend is. Dat laatste stond voor een uitgegeven stuk lang op null; sinds
   de duur wordt gerekend uit tempo en maten (kern/muziek-uitgave-beeld.js) valt
   er een tijdlijn overheen te leggen, en dat is precies wat de makersstudio van
   kern/uitvoering/ nodig heeft. */
'use strict';

module.exports = ({ VORMEN, stukId }) => {
  /* ---- de vier vertalers: van een domeinbeeld naar één stuk ---- */

  // Muziek: een UITGAVE uit het Klankwerk. Het geluid reist niet als bestand;
  // de motor op het toestel rekent het uit, precies zoals de maker het hoorde.
  function vanTrack(u, key) {
    const maker = (u.makers || [])[0] || {};
    return {
      id: stukId('track', u.id), vorm: 'track', vormNaam: VORMEN.track,
      titel: u.naam,
      maker: { codenaam: maker.codenaam || u.naamOnder, onder: u.onder, naamOnder: u.naamOnder },
      // de duur is GEREKEND door het muziekdomein zelf; zie muziek-uitgave-beeld.js
      at: u.at, duurS: u.duurS != null ? u.duurS : null, onderwerp: 'muziek',
      meta: u.bpm + ' slagen · ' + u.maten + ' maten' + (u.onder === 'rtg' ? ' · onder de RTG-naam' : ''),
      spelen: { soort: 'motor', bron: u.id },
      cijfers: { mooi: u.mooi || 0, reacties: u.reacties || 0 },
      makers: u.makers || [], toelichting: u.toelichting || '',
      mijn: !!u.vanMij, trackId: u.trackId || null
    };
  }

  // Video: een stuk uit het Theater. Ligt hij THUIS (P2P), dan speelt hij niet
  // hier maar in het Theater zelf -- dat staat er ook bij, want een knop die
  // niets doet is erger dan een knop die zegt waar hij heen gaat.
  function vanVideo(v, key, abonnee, mijn) {
    const thuis = v.bewaring === 'thuis';
    return {
      id: stukId('video', v.id), vorm: 'video', vormNaam: VORMEN.video,
      titel: v.titel,
      maker: { codenaam: v.codenaam, kanaal: v.kanaal, kanaalId: v.kanaalId },
      at: v.at, duurS: v.duurS || null, onderwerp: v.genre || null,
      meta: (v.duurS ? Math.round(v.duurS / 60) + ' min · ' : '') + v.mb + ' MB · ' + v.kanaal,
      spelen: thuis
        ? { soort: 'elders', bron: '/apps/theater.html', reden: 'Deze video staat thuis bij de maker; het Theater haalt hem rechtstreeks op.' }
        : { soort: 'stream', bron: '/api/theater/kijk/' + v.id },
      cijfers: { reacties: v.reacties || 0 },
      omschrijving: v.omschrijving || '',
      /* De ondertitels reizen mee, net als bij een clip hieronder: het is tekst,
         dus klein, en de speler moet ze hebben voordat het beeld begint. Zonder
         dit veld speelt de Media OS dezelfde video als het Theater maar zonder
         band -- twee schermen, een bestand, twee ervaringen. */
      ondertitels: Array.isArray(v.ondertitels) ? v.ondertitels : [],
      ondertiteld: !!v.ondertiteld,
      mijn: !!mijn, volgIk: !!abonnee
    };
  }

  // Korte video: een clip. Het beeld staat ALLEEN op het toestel van de maker
  // en reist rechtstreeks; RTG heeft de bytes niet en krijgt ze ook niet. Dus
  // speelt hij in Clips, waar dat doorgeefluik staat, en niet hier.
  function vanClip(c, key) {
    return {
      id: stukId('clip', c.id), vorm: 'clip', vormNaam: VORMEN.clip,
      titel: c.titel,
      maker: { codenaam: c.codenaam },
      at: c.at, duurS: c.speelduurS || c.duurS, onderwerp: null,
      meta: (c.speelduurS || c.duurS) + 's · ' + (c.online ? 'maker online' : 'maker offline') +
        (c.ondertiteld ? ' · ondertiteld' : ''),
      /* 'p2p': dit speelt WEL hier, maar niet langs RTG. De bytes staan op het
         toestel van de maker en reizen rechtstreeks; shared/clipdeler.js doet
         dat, en dezelfde laag speelt hem in Clips. `bron` is waar een scherm
         zonder die laag hem alsnog kan kijken -- geen dode knop. */
      spelen: { soort: 'p2p', bron: '/apps/clips.html',
        reden: 'Het beeld staat op het toestel van de maker en reist rechtstreeks; RTG heeft die bytes niet.' },
      cijfers: { reacties: c.reacties || 0 },
      poster: c.poster || null, geluid: c.geluid || 'eigen', muziek: c.muziek || null,
      /* Wat de speler nodig heeft om de clip te tonen ZOALS de maker hem
         bedoelde: is hij nu bereikbaar, waar begint en eindigt de knip, en de
         ondertitels (die komen wel van RTG, want tekst is klein). */
      online: !!c.online, knip: c.knip || null, ondertitels: c.ondertitels || [],
      mijn: !!c.mijn, volgIk: !!c.volgIk
    };
  }

  // Live: een kanaal van het Podium. Staat er nu niets aan, dan is het kanaal
  // zelf het stuk -- je volgt een maker, niet een uitzending.
  function vanLive(k, key) {
    return {
      id: stukId('live', k.id), vorm: 'live', vormNaam: VORMEN.live,
      titel: k.live ? k.live.titel : k.naam,
      maker: { codenaam: k.codenaam, kanaal: k.naam },
      at: k.live ? k.live.sinds : null, duurS: null, onderwerp: k.genre || null,
      meta: k.live ? ('nu live · ' + k.kijkers + ' kijkers') : 'niet live',
      spelen: { soort: 'elders', bron: '/apps/podium.html', reden: 'Live gaat rechtstreeks van kijker naar kijker; dat staat in het Podium.' },
      cijfers: { kijkers: k.kijkers || 0 },
      live: !!k.live, abbCenten: k.abbCenten || 0, ikAbonnee: !!k.ikAbonnee,
      /* De sleutel van de maker komt WEL binnen (het Podium zet hem in zijn
         eigen beeld) maar gaat hier NIET verder: hij wordt alleen vergeleken
         om te weten of dit uw eigen kanaal is. Wat naar buiten reist, draagt
         codenamen (server/accounts). */
      mijn: !!(key && k.makerKey === key), bio: k.bio || ''
    };
  }

  /* ---- alles ophalen en normaliseren ----
     `sess` gaat mee omdat het Klankwerk zijn zaal op een sessie opvraagt en de
     rest op een sleutel; dat verschil wordt hier opgevangen en gaat niet verder
     de Media OS in. */

  /* Een PARTITUUR (kern/uitvoering/): geen opname maar een werk dat op het
     moment van vragen wordt uitgevoerd. Hij speelt daarom niet HIER: `elders`
     met de reden erbij, precies zoals een thuis-video en een clip dat al doen.
     Een speelknop die een uitvoering zou starten zonder de vraag "hoeveel tijd
     heeft u" is geen speelknop maar een gok. */
  function vanPartituur(p, key) {
    return {
      id: stukId('partituur', p.id), vorm: 'partituur', vormNaam: VORMEN.partituur,
      titel: p.naam,
      maker: { codenaam: p.codenaam },
      at: p.at, duurS: p.totaalS || null, onderwerp: null,
      meta: p.onderdelen + ' onderdelen - kern ' + Math.round(p.kernS) + 's van ' + Math.round(p.totaalS) + 's' +
        (p.toestemming && p.toestemming.inkorten ? ' - past zich aan uw tijd aan' : ' - alleen in zijn geheel') +
        (p.prijsCenten ? ' - ' + (p.prijsCenten / 100).toFixed(2) + ' euro' : ''),
      spelen: { soort: 'elders', bron: '/apps/uitvoering.html',
        reden: 'Een partituur wordt uitgevoerd en niet afgespeeld: u zegt eerst hoeveel tijd u heeft.' },
      cijfers: {},
      /* Wat een kijker moet weten VOORDAT hij erop tikt: kost het iets, en hoe
         kort kan het. Niet wat erin zit -- wie er niet in mag, hoort niet te
         zien waaruit het bestaat. */
      kernS: p.kernS, aanspraakNodig: p.aanspraakNodig || null, prijsCenten: p.prijsCenten || 0,
      mijn: p.key === key
    };
  }

  return { vanTrack, vanVideo, vanClip, vanLive, vanPartituur };
};
