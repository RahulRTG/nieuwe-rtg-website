/* Media OS (deelmodule): WAT DE MEDIA OS ZELF BEZIT.

   De rest van kern/mediaos/ leest de vier media-domeinen en bewaart niets van
   ze (LAT.md regel 4). Dit bestand is de uitzondering, en dat mag: het gaat
   om twee dingen die in geen van die vier bestonden.

   1. DE BIBLIOTHEEK over de vormen heen. Hij bewaart alleen het stuk-ID. Wat
      een stuk IS blijft van zijn domein -- haalt de maker het weg, dan is het
      hier ook weg. Een rij die niet meer op te lossen is verdwijnt niet stil
      maar staat er als "weggehaald door de maker" (regel 5).
   2. DE MELDINGSVOORKEUR per maker: één keer volgen, zelf kiezen waarvoor je
      gewekt wilt worden. Let op wat dit vandaag WEL en NIET doet -- zie de
      opmerking bij meldZet, en TAKEN.md 4.11. */
'use strict';

const BIEB_MAX = 500;
const MELD_SOORTEN = ['muziek', 'video', 'flow', 'live'];

module.exports = ({ db, save, schoon, catalogus }) => {
  const nu = () => new Date().toISOString();

  function biebTabel() {
    if (!db.data.mediaBieb || typeof db.data.mediaBieb !== 'object') db.data.mediaBieb = {};
    return db.data.mediaBieb;
  }
  const biebVan = (key) => {
    const t = biebTabel();
    if (!Array.isArray(t[key])) t[key] = [];
    return t[key];
  };

  /* ---- de bibliotheek ---- */
  function bewaar(sess, opdracht) {
    const o = opdracht || {};
    const id = String(o.id || '');
    if (!catalogus.deelId(id)) return { status: 400, error: 'Dit is geen geldig stuk-id.' };
    const rij = biebVan(sess.key);
    const stond = rij.some(x => x.id === id);
    if (o.aan === false) {
      biebTabel()[sess.key] = rij.filter(x => x.id !== id);
    } else {
      if (!stond) rij.unshift({ id, at: nu() });
      if (rij.length > BIEB_MAX) biebTabel()[sess.key] = rij.slice(0, BIEB_MAX);
    }
    save();
    return { status: 200, ok: true, bewaard: o.aan !== false, aantal: biebVan(sess.key).length };
  }
  /* De bibliotheek bewaart alleen het ID. Wat een stuk IS, blijft van zijn
     domein -- haalt de maker het weg, dan is het hier ook weg, en dat hoort
     zo. Een rij die niet meer op te lossen is, verdwijnt niet stil maar staat
     er als "weggehaald door de maker" (regel 5). */
  function bieb(sess) {
    const rij = biebVan(sess.key);
    const wereld = catalogus.alles(sess);
    const kaart = new Map(wereld.rijen.map(r => [r.id, r]));
    const stukken = [], verdwenen = [];
    for (const b of rij) {
      const s = kaart.get(b.id);
      if (s) stukken.push(Object.assign({}, s, { bewaardOp: b.at }));
      else verdwenen.push({ id: b.id, bewaardOp: b.at });
    }
    return { status: 200, stukken, verdwenen,
      uitleg: verdwenen.length
        ? 'Van ' + verdwenen.length + ' bewaarde stukken staat het origineel niet meer in uw wereld: de maker heeft ze weggehaald, of ze staan achter een deur die voor u dicht is.'
        : 'Alles wat u bewaarde staat er nog.' };
  }

  /* ---- de meldingsvoorkeur per maker ---- */
  function meldTabel() {
    if (!db.data.mediaMeldingen || typeof db.data.mediaMeldingen !== 'object') db.data.mediaMeldingen = {};
    return db.data.mediaMeldingen;
  }
  function meldZet(sess, opdracht) {
    const o = opdracht || {};
    const naam = schoon(o.codenaam, 60);
    if (!naam) return { status: 400, error: 'Zeg erbij om welke maker het gaat.' };
    const soorten = Array.isArray(o.soorten) ? o.soorten.filter(s => MELD_SOORTEN.includes(s)) : [];
    const t = meldTabel();
    t[sess.key] = t[sess.key] && typeof t[sess.key] === 'object' ? t[sess.key] : {};
    t[sess.key][naam] = soorten;
    save();
    /* EERLIJK OVER WAT DIT VANDAAG DOET (regel 6: een belofte in tekst is een
       belofte in code). De voorkeur wordt vastgelegd en de Media OS geeft hem
       terug, maar er hangt hier nog GEEN verzending aan: de vier apps sturen
       hun eigen meldingen zoals ze dat altijd deden. Een scherm dat "u krijgt
       voortaan alleen nog X" zou beloven wat er niet gebeurt. Staat als taak
       in TAKEN.md, met de oorzaak erbij. */
    return { status: 200, ok: true, codenaam: naam, soorten, soortenMogelijk: MELD_SOORTEN,
      let: 'Vastgelegd. Er hangt hier vandaag nog geen verzending aan: de vier apps sturen hun eigen meldingen. ' +
        'Dit is de lijst waar de Media OS naar kijkt zodra hij zelf gaat sturen.' };
  }
  const meldVan = (key, naam) => {
    const t = meldTabel()[key] || {};
    return Array.isArray(t[naam]) ? t[naam] : MELD_SOORTEN.slice();
  };

  return { biebVan, bewaar, bieb, meldZet, meldVan, MELD_SOORTEN };
};
