/* De Salon als volwaardige app: leden die zelf plaatsen, meerdere foto's per
   post, onderwerpen (hashtags), en een feed die verder gaat dan de laatste 60.

   Wat hier veranderde en waarom:

   1. LEDEN KONDEN NIET PLAATSEN. Alleen partners hadden een route; nu schrijft
      een lid zelf via `authorKey`.
   2. HET PLAFOND VAN 60. `posts.slice(0, 60)` zorgde dat post 61
      duwde post 1 er stilletjes uit, voorgoed. Dat is nu een ruim, instelbaar
      venster met echte paginering.
      Wel begrensd: `posts` is één rij in de kv-opslag; oneindig vraagt later
      het grootboek-patroon, niet alleen een hogere kap.
   3. Beeld gaat NOOIT als base64 de database in; het gaat naar de mediastore en
      we bewaren de verwijzing. Dat was al zo voor partners en geldt hier ook.

   De zichtbaarheidspoort blijft waar hij hoort: kern/salonviraal.js bepaalt wat
   iemand te zien krijgt, kern/veilig.js is de 9+-keuring op elke tekst. */
const { keur } = require('../veilig');
const vorm = require('./vorm');

module.exports = ({ db, save, media, liveCodename, codenaamVan, crypto, broadcastSync, spraaktekst }) => {
  /* Valt een post uit het venster, of haalt de auteur hem weg, dan gaan zijn
     foto's mee. Dat gebeurde niet: de verwijzing verdween, het bestand bleef --
     zie kern/mediaopruim.js voor wat dat op drie plekken tegelijk aanrichtte. */
  const opruim = require('../mediaopruim')(media, db);
  const MAX_POSTS = Number(process.env.SALON_MAX || 2000);
  const MAX_MEDIA = 6;              // foto's/video's per post (de karrousel)
  const salonMedia = require('./media')({ media, crypto, spraaktekst });
  const { MAX_FOTO_BYTES, MAX_VIDEO_BYTES } = salonMedia;
  const PAGINA = 20;                // posts per bladzijde
  const TEKST_MAX = 600;
  const nu = () => new Date().toISOString();
  const upload = salonMedia.upload;

  /* Een id dat echt uniek is. Eerst stond hier `Date.now() + random(1000)`, en
     dat leek genoeg tot de paginerings-toets 65 posts achter elkaar plaatste:
     dan zitten er betrouwbaar een of twee dubbele ids tussen. Twee posts met
     hetzelfde id betekent dat verwijderen, bewaren of melden de VERKEERDE post
     raakt -- een stille vergissing met iemands bericht.

     Nu strikt oplopend, en met een blik op wat er al ligt: de poortwachter
     (server/trio.js) start drie serverkinderen op dezelfde opslag, en die delen
     deze teller niet. */
  let laatsteId = 0;
  function nieuwId() {
    const t = Date.now();
    laatsteId = t > laatsteId ? t : laatsteId + 1;
    while (db.data.posts.some(p => p.id === laatsteId)) laatsteId++;
    return laatsteId;
  }

  function S() {
    if (!Array.isArray(db.data.posts)) db.data.posts = [];
    if (!db.data.salon || typeof db.data.salon !== 'object') db.data.salon = {};
    const s = db.data.salon;
    for (const k of ['bewaard', 'volgtLid', 'verborgen', 'bio']) if (!s[k] || typeof s[k] !== 'object') s[k] = {};
    return s;
  }
  const publiek = require('./publiek')({ S, vorm });

  const onderwerpenUit = require('./onderwerpen');

  /* Een lid plaatst. Meerdere foto's/video's mogen, elk met een beschrijving
     voor wie niet ziet. Zonder beschrijving gaat het bestand gewoon mee,
     maar de app vraagt erom -- de a11y-keuring van dit project is niet voor
     niets een vaste stap. */
  async function plaats(sess, invoer) {
    const tekst = String((invoer && invoer.tekst) || '').trim().slice(0, TEKST_MAX);
    const ruw = Array.isArray(invoer && invoer.media) ? invoer.media.slice(0, MAX_MEDIA) : [];
    if (!tekst && !ruw.length) return { error: 'Schrijf iets, of kies een foto.' };
    if (tekst) { const k = keur(tekst); if (!k.ok) return { error: k.reden }; }

    const beeld = [];
    const gebruikteUploads = [];
    for (const m of ruw) {
      const uploadId = m && typeof m === 'object' ? String(m.uploadId || '') : '';
      const bron = typeof m === 'string' ? m : (m && m.beeld);
      const alt = String((m && m.alt) || '').slice(0, 200);
      if (alt) { const k = keur(alt); if (!k.ok) return { error: k.reden }; }
      if (uploadId) {
        const klaar = salonMedia.neem(sess, uploadId);
        if (!klaar) return { error: 'Deze upload is verlopen. Kies het bestand opnieuw.' };
        if (klaar.type === 'video' && klaar.ondertitelStatus === 'wacht') return {
          error: 'Maak eerst ondertitels, of geef aan dat de video geen gesproken tekst bevat.' };
        beeld.push({ src: klaar.src, alt, type: klaar.type, mime: klaar.mime,
          ondertitels: klaar.ondertitels || [], ondertitelStatus: klaar.ondertitelStatus });
        gebruikteUploads.push(uploadId);
        continue;
      }
      if (typeof bron !== 'string' || !bron) continue;
      try {
        const src = await media.bewaarPubliek(bron, 1.5 * 1024 * 1024);
        if (!src) return { error: 'Deze foto is te groot of heeft een niet-ondersteund formaat.' };
        beeld.push({ src, alt, type: 'image', mime: String(bron.slice(5, bron.indexOf(';'))) });
      } catch (e) { return { error: 'Deze foto kon ik niet bewaren.' }; }
    }

    S();
    const post = {
      id: nieuwId(),
      author: liveCodename(sess) || 'Een lid', authorKey: sess.key, tier: sess.tier,
      partner: false, place: String((invoer && invoer.plaats) || '').slice(0, 60) || null,
      visual: null, photo: (beeld.find(m => m.type !== 'video') || {}).src || null, // oudere schermen lezen alleen beeld
      media: beeld, onderwerpen: onderwerpenUit(tekst),
      text: tekst, lang: (invoer && invoer.lang) || 'nl', at: nu(),
      momentType: vorm.soort(invoer && invoer.momentType),
      publiek: vorm.publiek(invoer && invoer.publiek),
      startsAt: datumTijd(invoer && invoer.startsAt),
      endsAt: datumTijd(invoer && invoer.endsAt),
      baseLikes: 0, likedBy: {}, comments: [],
      reactiesVan: ['iedereen', 'vrienden', 'niemand'].includes(invoer && invoer.reactiesVan) ? invoer.reactiesVan : 'iedereen',
      promoMag: (invoer && invoer.promoMag) === true,
      meldingen: []
    };
    db.data.posts.unshift(post);
    // begrensd venster: de oudste vallen af, maar niet meer bij 60 -- en hun
    // foto's vallen mee af, anders groeit de mediastore ongelimiteerd door
    kap();
    save();
    salonMedia.verbruik(gebruikteUploads);
    if (broadcastSync) broadcastSync(['rtg', 'lifestyle', 'business'], 'salon');
    return { ok: true, post: publiek(post, sess) };
  }

  function datumTijd(waarde) {
    if (!waarde) return null;
    const d = new Date(waarde);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  function verwijder(sess, postId) {
    S();
    const i = db.data.posts.findIndex(p => String(p.id) === String(postId));
    if (i < 0) return { error: 'Deze post bestaat niet.' };
    if (db.data.posts[i].authorKey !== sess.key) return { error: 'Dit is niet jouw post.' };
    const [weg] = db.data.posts.splice(i, 1);
    save();
    // en de foto's van die post; anders blijft de /media-url gewoon opvraagbaar
    opruim.wis(opruim.refsVanPosts([weg]));
    return { ok: true };
  }

  /* De feed, met echte paginering. `na` is de id van de laatste post die je al
     hebt; je krijgt de volgende bladzijde. Geen oneindige scroll-truc: de app
     toont een knop en zegt eerlijk wanneer je bij bent. */
  function feed(sess, opties, poort) {
    const s = S();
    const o = opties || {};
    const mij = sess && sess.key;
    const verborgen = (mij && s.verborgen[mij]) || [];
    const zoek = String(o.zoek || '').trim().toLowerCase().slice(0, 60);
    const onderwerp = String(o.onderwerp || '').trim().toLowerCase().replace(/^#/, '').slice(0, 30);

    let lijst = db.data.posts.filter(p => {
      if (verborgen.includes(p.id)) return false;
      if (p.weg) return false;
      // gearchiveerd: uit de etalage van iedereen, ook uit je eigen raster
      if (p.archief && !o.archief) return false;
      if (o.archief && !p.archief) return false;
      if (poort && !poort(p)) return false;
      if (onderwerp && !(p.onderwerpen || []).includes(onderwerp)) return false;
      if (zoek && !String(p.text || '').toLowerCase().includes(zoek)
        && !String(p.place || '').toLowerCase().includes(zoek)
        && !String(p.author || '').toLowerCase().includes(zoek)) return false;
      if (o.vanKey && p.authorKey !== o.vanKey) return false;
      if (o.bewaard && !((s.bewaard[mij] || []).includes(p.id))) return false;
      return true;
    });
    const totaal = lijst.length;
    if (o.na != null) {
      const i = lijst.findIndex(p => String(p.id) === String(o.na));
      lijst = i >= 0 ? lijst.slice(i + 1) : lijst;
    }
    const limiet = Math.min(PAGINA, Math.max(1, Number(o.limiet) || PAGINA));
    const bladzijde = lijst.slice(0, limiet);
    return {
      posts: bladzijde.map(p => publiek(p, sess)),
      totaal,
      meer: lijst.length > bladzijde.length,
      volgende: bladzijde.length ? bladzijde[bladzijde.length - 1].id : null
    };
  }

  /* Welke onderwerpen leven er? Geteld over de recente posts, aflopend. Dit is
     de ontdek-kant: je kiest zelf een onderwerp, er is geen motor die kiest wat
     jou het langst vasthoudt. */
  function onderwerpen(limiet) {
    S();
    const tel = new Map();
    for (const p of db.data.posts.slice(0, 400)) {
      for (const t of (p.onderwerpen || [])) tel.set(t, (tel.get(t) || 0) + 1);
    }
    return [...tel].sort((a, b) => b[1] - a[1]).slice(0, Math.min(30, limiet || 12))
      .map(([naam, aantal]) => ({ naam, aantal }));
  }

  const postMet = id => { S(); return db.data.posts.find(p => String(p.id) === String(id)) || null; };

  /* Het venster kappen. Stond eerst op vijf plekken als `slice(0, 60)` los in
     de partner-routes; nu op EEN plek, zodat de grens niet per route kan
     verschillen en er maar een getal is om te verzetten. */
  function kap() {
    S();
    if (db.data.posts.length <= MAX_POSTS) return;
    const eraf = db.data.posts.slice(MAX_POSTS);
    db.data.posts.length = MAX_POSTS;
    opruim.wis(opruim.refsVanPosts(eraf));
  }

  return { upload, ondertitel: salonMedia.ondertitel, plaats, verwijder, feed, publiek, onderwerpen, onderwerpenUit, postMet, kap, S,
    MAX_POSTS, MAX_MEDIA, MAX_FOTO_BYTES, MAX_VIDEO_BYTES };
};
