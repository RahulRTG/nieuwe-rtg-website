/* RTG Theater, deelbestand "video": de bytes en het Thuisarchief. De video wordt
   eerst als kaart aangemeld, daarna komen de bytes binnen en worden EXACT bewaard
   (geen hercompressie, alleen webm/mp4, met een grens per video en per kanaal). Een
   thuis-video blijft op het apparaat van de maker; wij kennen alleen titel en omvang
   en geven het WebRTC-signaal door. Plus verwijderen en de stream-verwijzing voor de
   kijk-route. Krijgt de gedeelde ctx van kern/theater/index.js. */
const { schoonCues } = require('../ondertitels');

module.exports = (ctx) => {
  // nieuwWerk: de haak van de Media OS (laat gebonden en optioneel)
  const nieuwWerk = ctx.nieuwWerk;
  const { db, save, fs, path, mediaDir, schoon, nu, id, lijsten, kanaalVan, kanaalMet, videoMet,
    kanaalBytes, mbVan, sseToCustomer, thuisAanwezigheid, thuisOnline,
    THUIS_TTL_MS, THUIS_SIGNALEN, MAX_VIDEO_MB, MAX_KANAAL_MB } = ctx;

  /* Een intern kanaal van een zaak waar dit lid de LEIDING heeft. Geen leiding,
     of een kanaal van een andere zaak: dan bestaat het hier niet. */
  function intern(key, kanaalId) {
    const k = kanaalMet(kanaalId);
    if (!k || !k.zaakCode) return null;
    return (ctx.zakenVan(key) || []).some(z => z.code === k.zaakCode && z.leiding) ? k : null;
  }

  /* ---- de video: eerst de kaart, dan de bytes (originele kwaliteit) ---- */
  function videoMaak(key, data) {
    /* Publiceren kan in het EIGEN kanaal, of in de interne bibliotheek van een
       zaak waar dit lid de leiding heeft (./zaak.js). Dat tweede geval vraagt
       er uitdrukkelijk om met een kanaalId: anders zou een video stilletjes in
       de verkeerde wereld landen, en dat is precies het soort fout dat je pas
       merkt als de verkeerde mensen meekijken. */
    const k = data && data.kanaalId ? intern(key, String(data.kanaalId)) : kanaalVan(key);
    if (!k) return { status: 404, error: 'Meld eerst een kanaal aan.' };
    if (k.status !== 'goedgekeurd') return { status: 403, error: 'Uw kanaal wacht nog op goedkeuring door RTG-kantoor.' };
    const titel = schoon(data.titel, 80); if (!titel) return { status: 400, error: 'Geef de video een titel.' };
    let poster = null;
    if (typeof data.poster === 'string' && /^data:image\/(jpeg|webp);base64,/.test(data.poster) && data.poster.length < 120000) poster = data.poster;
    const thuis = data.bewaring === 'thuis';
    const v = { id: id(), kanaalId: k.id, key, titel, omschrijving: schoon(data.omschrijving, 400),
      duurS: Math.min(Math.max(Math.round(Number(data.duurS) || 0), 0), 6 * 3600), poster,
      bewaring: thuis ? 'thuis' : 'rtg',
      // een thuis-video is meteen 'klaar': de bytes blijven bij de maker,
      // wij noteren alleen de (door de maker gemelde) omvang voor de kijker
      klaar: thuis, mbGeschat: thuis ? Math.min(Math.max(Math.round(Number(data.mbGeschat) || 0), 0), 100000) : 0,
      bytes: 0, ext: null, at: nu() };
    db.data.theaterVideos.push(v); save();
    return { status: 200, ok: true, id: v.id, maxMb: MAX_VIDEO_MB, bewaring: v.bewaring };
  }
  // de bytes zelf: exact bewaren wat binnenkomt; alleen echt beeldmateriaal
  function videoUpload(key, vid, buffer) {
    const v = videoMet(vid); if (!v || v.key !== key) return { status: 404, error: 'Video niet gevonden.' };
    if (v.bewaring === 'thuis') return { status: 409, error: 'Deze video blijft bij u thuis; er wordt niets bij RTG bewaard.' };
    if (v.klaar) return { status: 409, error: 'Deze video is al geupload.' };
    if (!Buffer.isBuffer(buffer) || buffer.length < 100) return { status: 400, error: 'Geen videobestand ontvangen.' };
    if (buffer.length > MAX_VIDEO_MB * 1048576) return { status: 413, error: 'Tot ' + MAX_VIDEO_MB + ' MB per video in deze demo.' };
    const k = kanaalMet(v.kanaalId);
    if (kanaalBytes(k) + buffer.length > MAX_KANAAL_MB * 1048576)
      return { status: 413, error: 'Het kanaalquotum (' + MAX_KANAAL_MB + ' MB) is vol; verwijder eerst iets.' };
    const webm = buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3;
    const mp4 = buffer.slice(4, 8).toString('latin1') === 'ftyp';
    if (!webm && !mp4) return { status: 415, error: 'Alleen webm of mp4; het bestand komt ongewijzigd bij de kijker.' };
    v.ext = webm ? 'webm' : 'mp4';
    try { fs.writeFileSync(path.join(mediaDir, v.id + '.' + v.ext), buffer); }
    catch (e) { return { status: 500, error: 'Opslaan mislukte: ' + e.message }; }
    v.bytes = buffer.length; v.klaar = true; save();
    /* Pas HIER is er iets te kijken: een kaart zonder bytes is geen video, en
       de volgers wekken op het moment van aanmaken zou ze naar een leeg scherm
       sturen. Laat gebonden; zie kern/mediaos/. */
    if (nieuwWerk) { try { nieuwWerk(key, 'video', v.titel); } catch (e) {} }
    return { status: 200, ok: true, mb: mbVan(v.bytes) };
  }
  function videoWeg(vid) {
    const v = videoMet(vid); if (!v) return;
    try { if (v.ext) fs.unlinkSync(path.join(mediaDir, v.id + '.' + v.ext)); } catch (e) {}
    db.data.theaterVideos = db.data.theaterVideos.filter(x => x.id !== vid);
    delete db.data.theaterReacties[vid];
    save();
  }
  function verwijder(key, vid, kantoor) {
    const v = videoMet(vid); if (!v) return { status: 404, error: 'Video niet gevonden.' };
    if (!kantoor && v.key !== key) return { status: 403, error: 'Alleen de maker of kantoor verwijdert een video.' };
    videoWeg(vid);
    return { status: 200, ok: true };
  }
  // voor de kijk-route: waar de bytes staan (in productie: de CDN-verwijzing)
  function streamVan(vid, key) {
    const v = videoMet(vid); if (!v || !v.klaar || !v.ext) return null;   // thuis-video: wij hebben de bytes niet
    /* DE DEUR OP DE BYTES ZELF. Een interne bibliotheek die alleen uit de
       lijsten is weggelaten, is geen interne bibliotheek: wie het video-id
       heeft, haalt de beelden dan gewoon op met een link. Daarom vraagt ook
       deze route of dit lid bij die zaak werkt (./zaak.js). */
    if (ctx.zaakMagVideo && !ctx.zaakMagVideo(key, v)) return null;
    return { pad: path.join(mediaDir, v.id + '.' + v.ext), bytes: v.bytes,
      type: v.ext === 'webm' ? 'video/webm' : 'video/mp4', titel: v.titel };
  }

  /* ---- het Thuisarchief: aanwezigheid en het signaal-doorgeefluik ---- */
  function thuisAanwezig(key, ids) {
    lijsten();
    const geaccepteerd = [];
    for (const vid of (Array.isArray(ids) ? ids.slice(0, 100) : [])) {
      const v = videoMet(String(vid));
      if (v && v.key === key && v.bewaring === 'thuis') { thuisAanwezigheid.set(v.id, Date.now()); geaccepteerd.push(v.id); }
    }
    return { status: 200, ok: true, geaccepteerd, ttlS: THUIS_TTL_MS / 1000 };
  }
  function signaal(key, vid, kind, doelKey, payload) {
    const v = videoMet(vid); if (!v || v.bewaring !== 'thuis') return { status: 404, error: 'Video niet gevonden.' };
    if (!THUIS_SIGNALEN.includes(kind)) return { status: 400, error: 'Onbekend signaal.' };
    const ikMaker = v.key === key;
    if (ikMaker && !doelKey) return { status: 400, error: 'De maker antwoordt gericht aan een kijker.' };
    if (!ikMaker && !thuisOnline(v)) return { status: 409, error: 'De maker is nu niet online; dit werk staat alleen op diens eigen apparaat.' };
    const doel = ikMaker ? String(doelKey) : v.key;
    sseToCustomer(doel, 'theater', { kind, videoId: v.id, van: key, payload: payload || null });
    return { status: 200, ok: true };
  }

  /* ---- de ondertitels ----

     TAKEN.md 4.21 noemde dit met zoveel woorden als NIET gebouwd: "ondertiteling
     of doorzoekbare spraak" ontbrak in de Media for Business-kant. check.js
     regel 49 telde de bioscoop van het Theater en de filmspeler van de Media OS
     daarom als 'onbedekt' -- opgenomen inhoud waar wel een ondertitelspoor bij
     hoort en waar het model geen veld voor had.

     Wat een geldige regel is, staat NIET hier maar in kern/ondertitels.js, samen
     met de clip-kant. Wat hier wel staat is wie eraan mag komen: de maker van de
     video, net als bij verwijderen. Een kanaal van een zaak verandert daar niets
     aan -- wie de video plaatste, schrijft de ondertitels.

     Een lege lijst is een geldig antwoord en wist het spoor: een maker die zijn
     ondertitels terugtrekt hoort dat te kunnen zonder de video weg te gooien. */
  function ondertitels(key, vid, regels) {
    const v = videoMet(vid); if (!v || v.key !== key) return { status: 404, error: 'Video niet gevonden.' };
    const uit = schoonCues(regels, v.duurS);
    if (!uit) return { status: 400, error: 'Geef de ondertitels als lijst.' };
    v.ondertitels = uit;
    save();
    return { status: 200, ok: true, regels: uit.length, ondertitels: uit };
  }

  return { videoMaak, videoUpload, verwijder, streamVan, thuisAanwezig, signaal,
    videoOndertitels: ondertitels };
};
