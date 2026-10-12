/* ============================================================================
   WAT EEN LID VAN EEN BERAAD ZIET -- en vooral wat niet (besluit 4, par. 9.1).

   De opslag kent elke stem op sleutel: anders kan een lid zijn stem niet
   wijzigen en kan niemand twee keer stemmen worden voorkomen. Deze weergave is
   daarom de GRENS, en ze valt aan de bron van het antwoord, niet op het scherm:
   wat hier niet uitkomt, krijgt geen lijst, geen export en geen model.

   VIER REGELS:
   1. Een individuele stem ziet alleen wie hem uitbracht (`mijnStem`). Er is
      geen veld dat zegt wie er gestemd heeft, ook niet zonder de keuze erbij.
   2. Tijdens het stemmen geen telling, ook niet het aantal uitgebrachte stemmen.
      Wie de stand voor en na een nieuwe stem ziet, kent die stem (differentie).
   3. Na het sluiten de aantallen -- behalve onder MIN_STEMMERS uitgebrachte
      stemmen: dan alleen de eindstand, met de reden waarom er geen getal staat.
   4. Een GEVOELIG beraad (geloof, zorg, alles waarvoor de opener dat vooraf
      zegt) toont nooit een verhouding, alleen de eindstand. Dat het beraad
      gevoelig is, staat er vanaf het openen bij: "vooraf duidelijk".
   ========================================================================== */
'use strict';

const S = require('./standen');

const ZICHTBAARHEID = Object.freeze({
  gewoon: 'Na het sluiten zie je hoeveel stemmen er voor, tegen en blanco waren -- bij minder dan ' +
    S.MIN_STEMMERS + ' stemmen alleen de uitkomst. Wie wat stemde, ziet niemand.',
  gevoelig: 'Dit beraad is gevoelig: na het sluiten zie je alleen de uitkomst, nooit aantallen. Wie wat stemde, ziet niemand.'
});

function uitslagZicht(b, r) {
  if (r.stand !== 'besloten' || !r.uitslag) return null;
  if (b.gevoelig) return { getoond: false, reden: 'gevoelig', uitleg: ZICHTBAARHEID.gevoelig };
  if (r.uitslag.uitgebracht < S.MIN_STEMMERS) {
    return { getoond: false, reden: 'te-kleine-groep', grens: S.MIN_STEMMERS,
      uitleg: 'Minder dan ' + S.MIN_STEMMERS + ' stemmen: een getal zou zeggen wie wat stemde. Alleen de uitkomst staat hier.' };
  }
  const u = r.uitslag;
  return { getoond: true, voor: u.voor, tegen: u.tegen, onthouding: u.onthouding, uitgebracht: u.uitgebracht,
    quorum: u.quorum };
}

function maakZicht({ codenaamVan }) {
  const naam = (k) => { try { return codenaamVan(k); } catch (e) { return null; } };

  function item(x, key) {
    const eigen = x.vanKey === key;
    return { id: x.id, van: naam(x.vanKey), vanMij: eigen, at: x.at,
      ingetrokken: x.ingetrokken || null,
      // ingetrokken woorden leest alleen de schrijver nog; de regel blijft voor iedereen staan
      tekst: x.ingetrokken && !eigen ? null : x.tekst };
  }

  function ronde(b, r, key) {
    return {
      nr: r.nr, stand: r.stand, geopend: r.geopend, quorum: r.quorum,
      inbreng: r.inbreng.map(x => item(x, key)),
      bezwaren: r.bezwaren.map(x => item(x, key)),
      openPunten: r.openPunten.map(x => item(x, key)),
      voorstel: r.voorstel ? { versie: r.voorstel.versie, tekst: r.voorstel.tekst, door: naam(r.voorstel.door),
        at: r.voorstel.at } : null,
      bevroren: !!r.voorstelBevroren,
      mijnStem: r.stemmen[key] || null,
      uitslag: uitslagZicht(b, r),
      eindstand: r.eindstand ? { stand: r.eindstand.stand, toelichting: r.eindstand.toelichting,
        door: naam(r.eindstand.door), at: r.eindstand.at } : null,
      mijnTerugkoppeling: (r.terugkoppeling && r.terugkoppeling[key]) || null
    };
  }

  function beraad(b, key, extra) {
    return Object.assign({
      id: b.id, drager: { soort: b.drager.soort, id: b.drager.id }, vraag: b.vraag,
      door: naam(b.door), vanMij: b.door === key, at: b.at, gevoelig: !!b.gevoelig,
      zichtbaarheid: b.gevoelig ? ZICHTBAARHEID.gevoelig : ZICHTBAARHEID.gewoon,
      rondes: b.rondes.map(r => ronde(b, r, key)),
      tijdlijn: { regels: b.tijdlijn.length, top: b.tijdlijn.length ? b.tijdlijn[0].hash : null }
    }, extra || {});
  }

  // De korte vorm voor een lijst en voor de terugkoppeling van wie al vertrok.
  function kort(b, key) {
    const r = b.rondes[b.rondes.length - 1];
    return { id: b.id, vraag: b.vraag, ronde: r.nr, stand: r.stand, gevoelig: !!b.gevoelig,
      eindstand: r.eindstand ? r.eindstand.stand : null, uitslag: uitslagZicht(b, r),
      mijnTerugkoppeling: (r.terugkoppeling && r.terugkoppeling[key]) || null };
  }

  return { beraad, kort, uitslagZicht };
}

module.exports = { maakZicht, uitslagZicht, ZICHTBAARHEID };
