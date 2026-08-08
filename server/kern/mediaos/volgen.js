/* Media OS (deelmodule): VOLGEN -- één knop over de vier vormen heen.

   Dit is het enige stuk van de Media OS dat in de domeinen SCHRIJFT, en daarom
   staat het apart: de rest van de laag leest alleen. Wat het schrijft, schrijft
   het in de volgerslijst van het domein zelf -- Clips en het Theater -- zodat er
   nergens een tweede administratie naast het origineel komt (LAT.md regel 4).

   TWEE REGELS DIE ER TOE DOEN:
   1. Het Podium kent alleen een BETAALD maandabonnement, en dat wordt hier niet
      aangeraakt. Eén volgknop die ongemerkt een incasso start is precies wat
      niet mag; de hub geeft dat als aparte, bewuste stap terug.
   2. Alleen schrijven waar er ook iets te volgen IS. Een volgrelatie op een
      maker zonder werk zou een rij achterlaten waar nooit iets uit komt, en het
      lid zou "volgend" zien staan zonder dat dat ergens op slaat. */
'use strict';

module.exports = ({ schoon, keyVanCodenaam, bronnen, meldVan, MELD_SOORTEN }) => {
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

  return volg;
};
