/* Clips (deelmodule): de studio -- knippen, geluid en ondertitels.

   Clips had opnemen en delen, maar niets ertussenin. Dat is precies het stuk
   waar de bekende knip-apps geld voor vragen: ondertitels bewerken, een clip
   inkorten, en het geluid regelen zit daar achter Pro of achter een watermerk.
   Hier hoort het erbij.

   HET ONTWERP VOLGT DE ARCHITECTUUR, NIET ANDERSOM. Het beeld van een clip
   staat ALLEEN op het toestel van de maker (kern/clips.js); RTG heeft het nooit.
   Daarom kan hier niets "gerenderd" worden, en dat hoeft ook niet:

   - KNIPPEN is een begin en een eind, geen nieuwe video. De speler van de kijker
     springt naar `van` en stopt bij `tot`. Het origineel blijft heel -- u kunt
     een knip dus altijd terugdraaien, want er is niets weggegooid. Dat is beter
     dan wat een knip-app doet, niet minder.
   - ONDERTITELS zijn tekst, en tekst is klein. Die staan dus WEL bij RTG, want
     de kijker moet ze kunnen lezen ook al komt het beeld rechtstreeks van het
     toestel van de maker.
   - GELUID is een mededeling van de maker over wat de kijker gaat horen.

   DE REGEL DIE DIT HUIS ERAAN TOEVOEGT: EEN CLIP ZONDER ONDERTITEL IS EEN CLIP
   DIE EEN DEEL VAN DE MENSEN NIET KAN VOLGEN. Daarom draagt elke clip in de
   feed of hij ondertiteld is, en kan een kijker de selectie beperken tot wat hij
   kán volgen. Dat is geen filter voor de smaak maar voor de toegang -- en het is
   de kijker die hem aanzet, niet wij.

   Wat hier NIET komt: een muziekbibliotheek. We hebben geen rechten op muziek en
   doen dus niet alsof.

   WEL: JE EIGEN MUZIEK. Sinds RTG Studio (kern/muziek.js) kan een lid zelf een
   stuk maken waarin geen enkele licentie van een ander zit -- elke klank wordt
   door de app opgewekt. Op zoiets hebben we de rechten wél, want ze zijn van de
   maker. Daarom is er een vierde antwoord bijgekomen: "muziek", en die geldt
   ALLEEN met een stuk dat van jou is en dat je zelf klaar noemde. De toets
   daarvoor staat in de muziekmodule, niet hier: wie eigenaar is, weet de
   eigenaar-module. */

/* Wat een geldige ondertitelregel is, staat in kern/ondertitels.js -- niet hier.
   Het Theater heeft sinds vandaag hetzelfde spoor, en twee kopieen van die
   twintig regels validatie lopen binnen een jaar uiteen (LAT.md regel 4). De
   grenzen (200 regels, 120 tekens) staan daar, met de reden erbij. */
const { schoonCues } = require('./ondertitels');
const GELUID = ['eigen', 'stil', 'stem', 'muziek'];

module.exports = ({ db, save, schoon, clipMet, eigenTrack }) => {
  const getal = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };
  const mijn = (key, cid) => {
    const c = clipMet(cid);
    if (!c) return { fout: { status: 404, error: 'Clip niet gevonden.' } };
    if (c.key !== key) return { fout: { status: 403, error: 'Dit is niet uw clip.' } };
    return { c };
  };

  /* De knip. Van en tot liggen binnen de opname en `van` ligt voor `tot`; een
     knip van nul seconden bestaat niet. Terugdraaien = de knip weghalen, en dat
     kan altijd, want er is nooit iets weggegooid. */
  function knip(key, cid, invoer) {
    const { c, fout } = mijn(key, cid); if (fout) return fout;
    const v = invoer || {};
    if (v.weg) { delete c.knip; save(); return { status: 200, ok: true, knip: null }; }
    const van = getal(v.van), tot = getal(v.tot);
    if (van == null || tot == null) return { status: 400, error: 'Geef een begin en een eind.' };
    if (van < 0 || tot > c.duurS) return { status: 400, error: 'De knip valt buiten de opname.' };
    if (tot - van < 1) return { status: 400, error: 'Een clip duurt minstens een seconde.' };
    c.knip = { van: Math.round(van * 10) / 10, tot: Math.round(tot * 10) / 10 };
    save();
    return { status: 200, ok: true, knip: c.knip, duurNa: Math.round((c.knip.tot - c.knip.van) * 10) / 10 };
  }

  /* De ondertitels. Een lijst regels met een begin, een eind en tekst. We
     sorteren op tijd en houden de lijst begrensd; verder laten we hem met rust,
     want de maker weet zelf het beste hoe zijn zinnen lopen. */
  function ondertitels(key, cid, regels) {
    const { c, fout } = mijn(key, cid); if (fout) return fout;
    const uit = schoonCues(regels, c.duurS);
    if (!uit) return { status: 400, error: 'Geef de ondertitels als lijst.' };
    c.ondertitels = uit;
    save();
    return { status: 200, ok: true, regels: uit.length, ondertitels: uit };
  }

  /* Wat de kijker gaat horen. Vier eerlijke antwoorden:
       eigen  -- het geluid van de opname zelf
       stil   -- deze clip is gemaakt om zonder geluid te bekijken
       stem   -- er ligt een gesproken toelichting overheen (die reist net als het
                 beeld rechtstreeks van het toestel van de maker naar de kijker)
       muziek -- een stuk dat u ZELF in RTG Studio maakte

     Dat laatste is streng: het stuk moet van u zijn en door u klaar genoemd.
     Kan de muziekmodule dat niet bevestigen, dan weigeren we -- liever een
     nette weigering dan een clip met muziek waarvan niemand weet van wie ze is. */
  function geluid(key, cid, soort, muziekId) {
    const { c, fout } = mijn(key, cid); if (fout) return fout;
    const s = String(soort || '').toLowerCase();
    if (!GELUID.includes(s)) return { status: 400, error: 'Kies: eigen, stil, stem of muziek.' };
    if (s === 'muziek') {
      const t = eigenTrack ? eigenTrack(key, muziekId) : null;
      if (!t) return { status: 400, error: 'Kies een eigen stuk uit RTG Studio dat u klaar hebt gemeld.' };
      c.muziek = { id: t.id, naam: t.naam, bpm: t.bpm };
    } else {
      delete c.muziek;
    }
    c.geluid = s;
    save();
    return { status: 200, ok: true, geluid: s, muziek: c.muziek || null };
  }

  /* Wat de feed per clip meekrijgt. `ondertiteld` staat er los van de regels
     zelf, zodat een kijker kan zien wat hij kan volgen zonder eerst alle tekst
     op te halen. */
  function studioBeeld(c) {
    const on = Array.isArray(c.ondertitels) ? c.ondertitels : [];
    return { knip: c.knip || null, geluid: c.geluid || 'eigen', muziek: c.muziek || null,
      ondertiteld: on.length > 0, ondertitels: on,
      speelduurS: c.knip ? Math.round((c.knip.tot - c.knip.van) * 10) / 10 : c.duurS };
  }

  return { clipsKnip: knip, clipsOndertitels: ondertitels, clipsGeluid: geluid,
    clipsStudioBeeld: studioBeeld, CLIPS_GELUID: GELUID,
    CLIPS_CUES_MAX: require('./ondertitels').CUES_MAX };
};
