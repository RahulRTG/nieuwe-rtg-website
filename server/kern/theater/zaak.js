/* RTG Theater, deelbestand "zaak": DE INTERNE VIDEOBIBLIOTHEEK VAN EEN
   ORGANISATIE -- de opgenomen kant van Media for Business.

   Het Podium had dit al voor LIVE (zone 'zaak': een town hall die alleen het
   eigen personeel ziet). Wat ontbrak was het opgenomen werk: een training, een
   werkinstructie, de opname van diezelfde town hall. Dat kon hier niet bestaan,
   want elk Theaterkanaal is openbaar zodra het kantoor het goedkeurt.

   WAAROM DIT IN HET THEATER STAAT EN NIET IN DE MEDIA OS. Een laag erboven kan
   alleen FILTEREN wat er al is, en alles wat er al is, is openbaar. Een
   "interne" wereld die bestaat uit een selectie van openbaar werk zou het woord
   intern gebruiken voor iets wat het niet is -- de ergste soort belofte, want
   niemand merkt het verschil tot het misgaat. Intern moet daarom bij het
   PUBLICEREN vastliggen, en publiceren gebeurt hier.

   DE REGELS, en ze zijn met opzet dezelfde als bij zone 'zaak' van het Podium:
   - een intern kanaal hoort bij een ZAAK en niet bij een mens; het draagt een
     zaakCode en de LEIDING van die zaak begint het;
   - wie er werkt kijkt; wie er niet werkt komt er niet in, ook niet met het id;
   - een intern kanaal staat in GEEN enkele openbare lijst: niet in de zaal van
     het Theater, niet in de gedeelde mediawereld, en niet op een profielkaart;
   - een lid mag naast zijn eigen kanaal ook een intern kanaal beheren. Dat zijn
     twee verschillende dingen, en de "u heeft al een kanaal"-regel gaat alleen
     over het persoonlijke.

   Wie waar werkt komt uit kern/werkplekken.js -- dezelfde bron als het Podium,
   want twee antwoorden op een toegangsvraag is er een te veel (LAT.md regel 4).
   Krijgt de gedeelde ctx van kern/theater/index.js. */
'use strict';

module.exports = (ctx) => {
  const { db, save, schoon, id, nu, lijsten, kanaalMet, videoBeeld, zakenVan, GENRES } = ctx;

  const zaakKanalen = () => { lijsten(); return db.data.theaterKanalen.filter(k => !!k.zaakCode); };
  const kanaalVanZaak = (code) => zaakKanalen().find(k => k.zaakCode === code) || null;
  /* De codes van de zaken waar dit lid werkt. Dit is de hele deur: staat de
     code van het kanaal er niet bij, dan bestaat dat kanaal voor deze kijker
     niet -- niet in een lijst, en niet op zijn id. */
  const mijnCodes = (key) => new Set(zakenVan(key).map(z => z.code));

  function beeld(k, key) {
    const zaak = zakenVan(key).find(z => z.code === k.zaakCode);
    return { id: k.id, naam: k.naam, genre: k.genre, bio: k.bio, status: k.status,
      zaakCode: k.zaakCode, zaakNaam: (zaak && zaak.naam) || k.zaakCode,
      leiding: !!(zaak && zaak.leiding),
      // de eigen naam en kleur van deze organisatie (./huisstijl.js)
      huisstijl: ctx.merk ? ctx.merk.huisstijlVan(k, zaak && zaak.naam) : null,
      videos: db.data.theaterVideos.filter(v => v.kanaalId === k.id).map(videoBeeld) };
  }

  /* ---- het interne kanaal aanmelden ----
     Alleen de leiding, en alleen voor een zaak waar die leiding ook werkelijk
     zit. Zonder die tweede helft kan een manager een kanaal openen op naam van
     een willekeurig ander bedrijf, en kijkt dat hele bedrijf mee. */
  function kanaalMaak(key, data) {
    lijsten();
    const code = String((data || {}).zaakCode || '');
    const mijne = zakenVan(key).filter(z => z.leiding);
    if (!mijne.length) return { status: 403, error: 'Een interne bibliotheek start de leiding van een zaak.' };
    const zaak = mijne.find(z => z.code === code) || (code ? null : mijne[0]);
    if (!zaak) return { status: 403, error: 'Kies een zaak waar u de leiding heeft.' };
    if (kanaalVanZaak(zaak.code)) return { status: 409, error: 'Deze zaak heeft al een interne bibliotheek.' };
    const naam = schoon((data || {}).naam, 40) || zaak.naam;
    const k = { id: id(), key, zaakCode: zaak.code, naam,
      genre: GENRES.includes((data || {}).genre) ? data.genre : 'salon',
      bio: schoon((data || {}).bio, 300), status: 'wacht', volgers: [], at: nu() };
    db.data.theaterKanalen.push(k); save();
    ctx.sseToOffice('sync', { scope: 'theater' });
    return { status: 200, ok: true, kanaal: beeld(k, key) };
  }

  /* ---- de interne zaal: alles van de zaken waar u werkt ---- */
  function zaal(key) {
    lijsten();
    const codes = mijnCodes(key);
    const zaken = zakenVan(key);
    if (!zaken.length) {
      return { status: 200, mag: false, zaken: [], kanalen: [], videos: [],
        reden: 'Deze wereld is van organisaties; u werkt nergens waar RTG van weet.' };
    }
    const kanalen = zaakKanalen().filter(k => codes.has(k.zaakCode) && k.status === 'goedgekeurd');
    const kIds = new Set(kanalen.map(k => k.id));
    const videos = db.data.theaterVideos.filter(v => v.klaar && kIds.has(v.kanaalId)).map(videoBeeld)
      .sort((a, b) => String(b.at).localeCompare(String(a.at)));
    /* Ook de zaken ZONDER bibliotheek komen mee, met of u er de leiding heeft.
       Anders ziet iemand een lege wereld en leest hij nergens dat er iets te
       beginnen valt -- of dat juist niet, omdat hij de leiding niet heeft. */
    return { status: 200, mag: true,
      zaken: zaken.map(z => ({ code: z.code, naam: z.naam, leiding: z.leiding,
        bibliotheek: !!kanaalVanZaak(z.code) })),
      kanalen: kanalen.map(k => beeld(k, key)), videos,
      uitleg: 'Wat hier staat is van uw organisatie en staat in geen enkele openbare lijst. ' +
        'RTG bewaart de beelden; wie er niet werkt komt er niet bij, ook niet met een link.' };
  }

  /* De lezer voor de Media OS: de interne video's van dit lid, als gewone
     video-rijen. De Media OS zet ze in een eigen stand en mengt ze NIET door de
     openbare wereld -- die grens staat op precies een plek (./index.js). */
  function videosVoor(key) {
    const r = zaal(key);
    return r.mag ? r.videos : [];
  }
  // mag dit lid deze video zien? (de deur van een INTERN kanaal, op het stuk zelf)
  function magVideo(key, v) {
    const k = kanaalMet(v.kanaalId);
    if (!k || !k.zaakCode) return true;          // niet intern: hier gaat deze deur niet over
    return mijnCodes(key).has(k.zaakCode);
  }

  return { zaakKanaalMaak: kanaalMaak, zaakZaal: zaal, zaakVideosVoor: videosVoor,
    zaakMagVideo: magVideo, kanaalVanZaak };
};
