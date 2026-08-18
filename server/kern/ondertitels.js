/* WAT EEN ONDERTITELLIJST IS -- op EEN plek.

   Er zijn in dit huis twee soorten bewegend beeld die een kijker moet kunnen
   VOLGEN zonder geluid: een clip (kern/clips-studio.js, het beeld staat op het
   toestel van de maker) en een video in het Theater (kern/theater/video.js, de
   bytes staan bij RTG). Ze delen niets in hun opslag en dat hoort ook niet --
   maar de vraag "wat is een geldige ondertitelregel" is voor allebei dezelfde,
   en die hoort dus niet twee keer beantwoord te worden (LAT.md regel 4).

   HET GEVAL DAT DIT VOORKOMT. De clip-kant bestond al: begin, eind, tekst,
   gesorteerd, begrensd op 200 regels en 120 tekens. Toen het Theater er een
   ondertitelspoor bij kreeg, was de makkelijke weg die twintig regels validatie
   overschrijven. Twee kopieen van "wat mag een cue zijn" lopen binnen een jaar
   uiteen -- de een krijgt een langere regellimiet omdat iemand daarom vroeg, de
   ander niet -- en dan verschilt wat een kijker te zien krijgt per app, zonder
   dat iemand dat besloten heeft.

   WAT HIER NIET IN ZIT, en met opzet: waar de lijst wordt bewaard, wie hem mag
   wijzigen en hoe hij bij de speler komt. Dat verschilt echt per app (een clip
   hangt aan een maker met OPFS, een theatervideo aan een kanaal met een
   goedkeuring) en dat hoort dus in die modules te blijven.

   DE GRENZEN, met de reden erbij:
     200 regels   genoeg voor een uur spreken; daarboven is het geen ondertitel
                  meer maar een transcript, en dat is een ander ding
     120 tekens   wat iemand in beeld kan lezen voordat de regel wisselt
     binnen de duur   een cue na het eind van de video ziet niemand, en een cue
                  die begint na hij eindigt is een typefout, geen keuze

   Een regel die niet door de grens komt VERVALT en laat de rest staan. Dat is
   bewust: een lijst van tachtig regels weigeren omdat er een tijdstip fout staat,
   kost de maker zijn hele werk. */
'use strict';
const { schoon } = require('./util');

const CUES_MAX = 200;        // ondertitelregels per stuk
const CUE_TEKST = 120;       // tekens per regel; langer leest niemand in beeld

const getal = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

/* Maakt van wat er binnenkomt een geldige, gesorteerde lijst cues. `duurS` is de
   lengte van het beeld; is die onbekend of nul, dan wordt er niet op tijd
   begrensd (een thuis-video meldt zijn duur zelf en kan die op nul laten). */
function schoonCues(regels, duurS) {
  if (!Array.isArray(regels)) return null;
  const eind = Number(duurS) > 0 ? Number(duurS) : Infinity;
  const uit = [];
  for (const r of regels.slice(0, CUES_MAX)) {
    const tekst = schoon((r && r.tekst) || '', CUE_TEKST);
    const van = getal(r && r.van), tot = getal(r && r.tot);
    if (!tekst || van == null || tot == null) continue;
    if (van < 0 || tot > eind || tot <= van) continue;
    uit.push({ van: Math.round(van * 10) / 10, tot: Math.round(tot * 10) / 10, tekst });
  }
  uit.sort((a, b) => a.van - b.van);
  return uit;
}

module.exports = { schoonCues, CUES_MAX, CUE_TEKST };
