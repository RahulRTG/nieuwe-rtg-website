/* Media OS (deelmodule): DE UNIVERSELE CONTENTIDENTITEIT.

   Er waren vier media-apps die elkaar niet kenden: RTG Klankwerk (uitgegeven
   muziek), RTG Theater (video), RTG Clips (korte verticale video) en RTG Podium
   (live). Vier keer een maker, vier keer een volgknop, vier keer een lijst --
   terwijl het bij een lid om ÉÉN maker en ÉÉN relatie gaat.

   Dit bestand maakt van die vier één catalogus. Wat het NIET doet, en dat is de
   kern van het ontwerp: het bewaart niets van die vier zelf. Elke rij komt bij
   het opvragen uit het domein dat hem bezit (regel 4 van LAT.md: nooit twee
   plekken die dezelfde waarheid vasthouden). De Media OS bezit alleen wat er
   nog niet was: de bibliotheek, de smaak en de meldingsvoorkeur.

   Een stuk krijgt hier één id: "<vorm>:<domein-id>", bijvoorbeeld
   "video:v3f1a2" of "track:u91c0". Daarmee kan de hub, de bibliotheek en de
   smaak over de vier vormen heen praten zonder te weten waar iets vandaan komt.

   WAT ER MET OPZET NIET IN ZIT. Geen volgorde op populariteit en geen oneindige
   lijst. Dat is niet vergeten: het Klankwerk, de Zaal van het Theater en de
   dagselectie van Clips weigeren die alle drie al met zoveel woorden, en een
   laag erboven die het alsnog invoert zou die keuze stil terugdraaien. */
'use strict';

const VORMEN = { track: 'Muziek', video: 'Video', clip: 'Korte video', live: 'Live' };

/* Het id is één string zodat hij door een URL, een bibliotheekrij en een
   chatbericht kan reizen. Splitsen doen we op de EERSTE dubbele punt: een
   domein-id mag er zelf een bevatten zonder dat de vorm zoekraakt. */
const stukId = (vorm, id) => vorm + ':' + id;
function deelId(sid) {
  const s = String(sid || '');
  const i = s.indexOf(':');
  if (i < 1) return null;
  const vorm = s.slice(0, i), id = s.slice(i + 1);
  if (!VORMEN[vorm] || !id) return null;
  return { vorm, id };
}

function maakCatalogus({ bronnen }) {
  /* Elke bron mag WEIGEREN (Podium doet dat bij een niet-geverifieerd of niet
     18+-account) of stuk zijn. Dat verdwijnt hier niet stil (regel 5): de
     wereld draagt een lijst `buiten` met de vorm en de reden erbij, en het
     scherm zet die eronder. Een lege FLOW omdat er niets is, en een lege FLOW
     omdat u er niet bij mag, zijn twee verschillende dingen. */
  function haal(fn) {
    let r;
    try { r = fn(); } catch (e) { return { rijen: [], reden: 'Deze bron gaf een fout: ' + (e && e.message ? e.message : 'onbekend') }; }
    if (!r || r.error) return { rijen: [], reden: (r && r.error) || 'Deze bron gaf niets terug.' };
    return { rijen: r, reden: null };
  }

  /* De vier vertalers (van een domeinbeeld naar EEN stuk) staan in
     ./catalogus-vormen.js: daar staat hoe een stuk ERUITZIET, hier hoe de
     wereld wordt SAMENGESTELD. */
  const { vanTrack, vanVideo, vanClip, vanLive } = require('./catalogus-vormen')({ VORMEN, stukId });

  function alles(sess) {
    const key = sess.key;
    const buiten = [];
    const uit = [];

    const m = haal(() => bronnen.tracks(sess));
    if (m.reden) buiten.push({ vorm: 'track', vormNaam: VORMEN.track, reden: m.reden });
    else for (const u of (m.rijen.uitgaven || [])) uit.push(vanTrack(u, key));

    const t = haal(() => bronnen.videos(key));
    if (t.reden) buiten.push({ vorm: 'video', vormNaam: VORMEN.video, reden: t.reden });
    else {
      /* DE VOLGORDE HIER IS GEDRAG. Een eigen video staat OOK in "nieuw" (op
         uw eigen kanaal bent u geen abonnee), en het ontdubbelen onderaan
         houdt de EERSTE kopie. Staat het eigen kanaal dus niet vooraan, dan
         wint de anonieme kopie en ziet een maker zijn eigen werk als dat van
         een vreemde. Toets 2b zakt daarop.

         En: een kaart waar de bytes nog niet op staan hoort niet in een wereld
         met een speelknop. Alleen het eigen kanaal toont zulke kaarten; dat
         filter kan pas bestaan sinds het Theater `klaar` meestuurt. */
      for (const v of ((t.rijen.mijn || {}).videos || [])) if (v.klaar) uit.push(vanVideo(v, key, false, true));
      for (const v of (t.rijen.abonnementen || [])) uit.push(vanVideo(v, key, true, false));
      for (const v of (t.rijen.nieuw || [])) uit.push(vanVideo(v, key, false, false));
    }

    const c = haal(() => bronnen.clips(key));
    if (c.reden) buiten.push({ vorm: 'clip', vormNaam: VORMEN.clip, reden: c.reden });
    else {
      for (const x of (c.rijen.clips || [])) uit.push(vanClip(x, key));
      for (const x of (c.rijen.mijn || [])) uit.push(vanClip(x, key));
    }

    const p = haal(() => bronnen.live(key));
    if (p.reden) buiten.push({ vorm: 'live', vormNaam: VORMEN.live, reden: p.reden });
    else for (const k of (p.rijen.kanalen || [])) uit.push(vanLive(k, key));

    // dubbelen eruit: een eigen video staat zowel in "nieuw" als in "mijn"
    const gezien = new Set();
    const rijen = uit.filter(s => (gezien.has(s.id) ? false : (gezien.add(s.id), true)));
    return { rijen, buiten };
  }

  return { alles, vanTrack, vanVideo, vanClip, vanLive, stukId, deelId, VORMEN };
}

module.exports = { maakCatalogus, stukId, deelId, VORMEN };
