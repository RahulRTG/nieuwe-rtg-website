/* RTG Theater, deelbestand "zaal": WAT DE KIJKER ZIET EN DOET.

   De zaal is chronologisch en gecureerd: abonnementen bovenaan, daarna wat er
   het laatst bij kwam. Geen algoritmische aanbevelingen, geen autoplay, geen
   oneindige feed -- dat is een keuze en geen gebrek.

   Wat hier ook staat: abonneren, reageren en melden. Bij die laatste twee zit
   de deur van de INTERNE bibliotheek (./zaak.js) erin: een interne video
   bestaat niet voor wie er niet werkt, ook niet om op te reageren of over te
   klagen. Zo staat die grens overal waar een video wordt aangeraakt, en niet
   alleen in de lijst.

   Krijgt de gedeelde ctx van kern/theater/index.js. */
'use strict';

module.exports = (ctx) => {
  const { db, save, schoon, id, nu, lijsten, kanaalVan, kanaalMet, videoMet, videoBeeld,
    eigenBeeld, codenaamVan, sseToOffice, zaak, GENRES, REACTIES_MAX, MAX_VIDEO_MB } = ctx;

  function zaal(key) {
    lijsten();
    /* De openbare zaal, en INTERNE kanalen horen daar niet in. Die grens staat
       hier, op de plek waar de lijst wordt gemaakt -- niet in de app, want dan
       zou elke volgende lezer hem opnieuw moeten onthouden. */
    const rijen = db.data.theaterVideos.filter(v => {
      const k = kanaalMet(v.kanaalId);
      return v.klaar && k && k.status === 'goedgekeurd' && !k.zaakCode;
    }).map(videoBeeld).sort((a, b) => String(b.at).localeCompare(String(a.at)));
    const mijnAbb = new Set(db.data.theaterKanalen.filter(k => (k.volgers || []).includes(key)).map(k => k.id));
    const eigen = kanaalVan(key);
    return { status: 200, kwaliteit: 'Origineel beeld, tot 4K: wij hercomprimeren niets.',
      abonnementen: rijen.filter(v => mijnAbb.has(v.kanaalId)),
      nieuw: rijen.filter(v => !mijnAbb.has(v.kanaalId)).slice(0, 40),
      mijn: eigen ? eigenBeeld(eigen) : null, genres: GENRES, maxMb: MAX_VIDEO_MB };
  }
  function abonneer(key, kid, aan) {
    const k = kanaalMet(kid); if (!k || k.status !== 'goedgekeurd') return { status: 404, error: 'Kanaal niet gevonden.' };
    k.volgers = (k.volgers || []).filter(x => x !== key);
    if (aan !== false) k.volgers.push(key);
    save();
    return { status: 200, ok: true, volg: aan !== false };
  }

  /* ---- reacties en melden (op codenaam, begrensd) ---- */
  function reactie(key, vid, tekst) {
    const v = videoMet(vid); if (!v || !v.klaar) return { status: 404, error: 'Video niet gevonden.' };
    // een interne video bestaat niet voor wie er niet werkt -- ook niet om op te reageren
    if (!zaak.zaakMagVideo(key, v)) return { status: 404, error: 'Video niet gevonden.' };
    tekst = schoon(tekst, 300); if (!tekst) return { status: 400, error: 'Lege reactie.' };
    const rij = db.data.theaterReacties[vid] = db.data.theaterReacties[vid] || [];
    const r = { codenaam: codenaamVan(key), tekst, at: nu() };
    rij.push(r); if (rij.length > REACTIES_MAX) db.data.theaterReacties[vid] = rij.slice(-REACTIES_MAX);
    save();
    return { status: 200, ok: true, reactie: r };
  }
  const reacties = vid => ({ status: 200, reacties: ((db.data.theaterReacties || {})[String(vid || '')] || []).slice(-40) });
  function meld(key, vid, reden) {
    const v = videoMet(vid); if (!v) return { status: 404, error: 'Video niet gevonden.' };
    if (!zaak.zaakMagVideo(key, v)) return { status: 404, error: 'Video niet gevonden.' };
    lijsten();
    db.data.theaterMeldingen.push({ id: id(), videoId: v.id, titel: v.titel, van: codenaamVan(key),
      reden: schoon(reden, 300) || 'Geen reden opgegeven', at: nu() });
    db.data.theaterMeldingen = db.data.theaterMeldingen.slice(-200);
    save(); sseToOffice('sync', { scope: 'theater' });
    return { status: 200, ok: true };
  }

  return { zaal, abonneer, reactie, reacties, meld };
};
