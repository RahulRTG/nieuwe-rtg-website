/* ============================================================================
   BUNDELEN EN HERSTELLEN -- het DOEN van de patroonlaag.

   ./patroon.js kijkt en verandert niets; dit bestand schrijft en licht mensen
   in. Dat is de naad, en hij scheelt dat bestand bovendien de omvangsgrens van
   keuringsregel 13.

   HIER ZIT DE SCHAALWINST VAN DE HELE LAAG. Twintig melders die aan een incident
   hangen, worden met EEN handeling bijgewerkt -- en dat is meteen de reden dat
   een dubbelklik hier duurder is dan waar dan ook: die stuurt twintig mensen een
   tweede keer hetzelfde. Beide functies hieronder zijn daarom beschermd tegen
   een herhaling, en allebei is dat GEMETEN en niet aangenomen.

   EN DE MACHINE SLUIT NIETS. Zie de kop van ./patroon.js: dat een storing
   verholpen is, bewijst niet dat het probleem van dit ene lid weg is.
   ========================================================================== */
'use strict';

const { STANDEN } = require('./klassen');

module.exports = function maakBundel({ zaken, loop, save, M, nu }) {
  /* BUNDELEN: een mens bevestigt, en dan gaan ze in EEN handeling aan hetzelfde
     incident. Dit is waar de schaalwinst zit -- vanaf hier is het een technische
     oplossing en twintig melders die vanzelf worden bijgewerkt.

     De incidentcode komt van BUITEN deze module. RTG Command geeft ze uit
     (RTG-0001); deze laag verzint er geen tweede reeks bij. */
  function bundel(zaakIds, { incident, door, tekst } = {}) {
    const code = String(incident || '').trim().slice(0, 60);
    if (!code) return { status: 400, error: 'Welk incident? Deze laag geeft zelf geen incidentnummers uit; die komen uit RTG Command.' };
    const ids = Array.isArray(zaakIds) ? zaakIds.slice(0, 500) : [];
    if (!ids.length) return { status: 400, error: 'Geef de zaken die bij dit incident horen.' };

    const gekoppeld = [], mislukt = [], alGekoppeld = [];
    for (const id of ids) {
      /* AL GEKOPPELD? DAN GEEN TWEEDE BERICHT. `koppel()` zelf is beschermd (hij
         geeft "al gekoppeld" terug), maar het BERICHT eronder was dat niet: een
         medewerker die twee keer klikte, stuurde twintig mensen twee keer
         dezelfde mededeling. Gevonden met een kale meetronde -- bij het lezen
         zag de tak eruit alsof koppel() alles afving. */
      const z = zaken.vind(id);
      if (z && z.koppelingen.some(k => k.soort === 'incident' && k.code === code)) {
        alGekoppeld.push(String(id).toUpperCase());
        continue;
      }
      const r = loop.koppel(id, { soort: 'incident', code, door });
      if (r && r.error) { mislukt.push({ id, waarom: r.error }); continue; }
      gekoppeld.push(r.zaak.id);
      loop.bericht(id, { van: 'systeem', wie: door,
        tekst: tekst || 'Wij hebben gezien dat meer mensen hier last van hebben. Uw melding is ' +
          'gekoppeld aan storing ' + code + '; u hoeft niets te doen en u hoort van ons zodra hij verholpen is.' });
    }
    if (save) save();
    return { ok: true, incident: code, gekoppeld: gekoppeld.length, zaken: gekoppeld, mislukt, alGekoppeld,
      let: alGekoppeld.length ? alGekoppeld.length + ' zaak/zaken hingen er al aan en hebben geen tweede bericht gekregen.' : null };
  }

  /* HERSTELD. Elke gekoppelde melder wordt ingelicht, en dat is het punt: een
     technische oplossing bereikt in een keer iedereen die erop wachtte.

     De stand gaat naar `inBehandeling` en niet naar `opgelost`. Zie de kop: dat
     de storing weg is, bewijst niet dat het probleem van dit lid weg is. */
  function hersteld(incident, { door, tekst } = {}) {
    const code = String(incident || '').trim();
    if (!code) return { status: 400, error: 'Welk incident is hersteld?' };
    const raak = zaken.bak().filter(z => z.koppelingen.some(k => k.soort === 'incident' && k.code === code));
    if (!raak.length) return { status: 404, error: 'Aan ' + code + ' hangt geen enkele zaak.' };

    /* EEN HERSTELMELDING GAAT EEN KEER UIT. Zonder deze regel stuurde een tweede
       klik iedereen opnieuw "de storing is verholpen" -- en dat is precies het
       bericht waarvan een tweede exemplaar het eerste ongeloofwaardig maakt.
       Ook uit de kale meetronde. Wie er echt nog iets bij wil zeggen, stuurt een
       bericht in de zaak; dat is een handeling met een naam eronder. */
    const eerder = M()[code];
    if (eerder) {
      return { status: 200, ok: true, incident: code, bijgewerkt: 0, gekoppeld: raak.length,
        alGemeld: eerder.at,
        let: 'De melders zijn hier al over ingelicht op ' + eerder.at + '. Er is niets opnieuw verstuurd; ' +
          'een tweede herstelmelding maakt de eerste ongeloofwaardig.' };
    }

    let bij = 0;
    for (const z of raak) {
      if ((STANDEN[z.stand] || {}).eind) continue;
      loop.bericht(z.id, { van: 'systeem', wie: door,
        tekst: tekst || 'Storing ' + code + ' is verholpen. Wij kijken na of daarmee ook uw melding klaar is; ' +
          'werkt het bij u nog niet, laat het hier weten.' });
      loop.stand(z.id, 'inBehandeling', { door: door || 'systeem',
        notitie: 'Incident ' + code + ' is hersteld. Deze zaak sluit niet vanzelf: een platformherstel ' +
          'bewijst niet dat het probleem van dit lid weg is.' });
      bij++;
    }
    M()[code] = { incident: code, at: nu(), door: String(door || 'systeem').slice(0, 60), bijgewerkt: bij };
    if (save) save();
    return { ok: true, incident: code, bijgewerkt: bij, gekoppeld: raak.length,
      let: 'De melders zijn ingelicht. De zaken zijn NIET gesloten -- dat blijft een oordeel per zaak.' };
  }

  return { bundel, hersteld };
};
