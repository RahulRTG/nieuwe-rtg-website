/* RTG CONCERN: de bedrijvenkant als één laag. Zie CONCERN.md voor de doctrine;
   dit bestand is de fabriek die de delen aan elkaar knoopt.

   DE ZES BEGRIPPEN, EN WAAR ZE WONEN:

     Concern         ./graaf.js       de economische groep
     Legal Entity    ./entiteit.js    de juridische rechtspersoon of onderneming
     Registration    ./tijd.js        de inschrijving, als feit met een loop
     Establishment   ./vestiging.js   de plek waar gewerkt wordt
     Operating Unit  ./vestiging.js   wat daar draait -- de bestaande `supplier`
     Brand           ./tijd.js        de handelsnaam, als feit met een loop

   Registratie en merk zijn met opzet FEITEN en geen objecten: allebei kunnen ze
   er meerdere tegelijk zijn, allebei kunnen ze aflopen zonder dat de entiteit
   ophoudt, en allebei horen ze een bron en een geschiedenis te dragen. Een veld
   heeft geen geschiedenis -- dat is wet 4.

   WAT DEZE LAAG NIET DOET. Zij vervangt niets. kern/onderneming/ blijft de weg
   van "ik denk erover na" naar een zaak; `suppliers` blijft de operationele
   zaak met zijn menu, vloot en personeel; server/bedrijf/rollen.js blijft de
   plek waar rechten wonen. Deze laag WIJST AAN en LEEST -- hetzelfde patroon
   dat de onderneming al gebruikt, om dezelfde reden: wie overschrijft, verliest
   wat de andere laag wist.

   DE VOLGORDE VAN OPBOUW IS NIET VRIJ. ./tijd.js eerst (alles hangt aan de
   feiten), dan ./entiteit.js, dan de rest -- ./graaf.js leest entiteiten,
   ./employment.js leest vestigingen, ./readiness.js leest alles. */
'use strict';

module.exports = (ctx) => {
  const { db, save, crypto, schoon, findSupplier } = ctx;

  /* Eén gedeelde context die per laag wordt aangevuld. Zo leest elke deellaag
     wat de vorige heeft neergezet, zonder dat er een tweede kopie van een
     leesfunctie ontstaat. */
  /* DE ENIGE PLEK WAAR CONCERN db AANRAAKT. Vanaf hier krijgt elke deellaag
     het contract mee in plaats van de database -- zie ./opslag.js. */
  const opslag = require('./opslag')({ db });
  const k = { db, save, crypto, schoon, findSupplier, vandaag: ctx.vandaag, opslag };

  Object.assign(k, require('./tijd')(k));
  Object.assign(k, require('./entiteit')(k));
  Object.assign(k, require('./vestiging')(k));
  Object.assign(k, require('./graaf')(k));
  Object.assign(k, require('./employment')(k));
  Object.assign(k, require('./scope')(k));
  Object.assign(k, require('./uitnodiging')(k));
  Object.assign(k, require('./readiness')(k));
  Object.assign(k, require('./verandering')(k));
  /* Document Intelligence en Discovery komen als LAATSTE: zij lezen alles wat
     hierboven staat en schrijven via entiteitNieuw/tijdZet. Andersom zou een
     halve context krijgen -- en dan valt de bevestiging stil in het niets. */
  Object.assign(k, require('./voorstel')(Object.assign(k, { ondernemingVind: ctx.ondernemingVind })));

  /* ---- de twee samenvattingen ----

     CONCERN.md §8 zegt dat alles hierboven alleen geslaagd is als hier iets
     leesbaars uit komt. Dit zijn die twee zinnen, en ze staan met opzet in de
     kern en niet in een scherm: een tweede scherm zou zijn eigen telling gaan
     doen, en dan lopen er twee cijfers rond. */

  /* Wat de ondernemer ziet als zijn concern staat. Geen "stap 43 van 78". */
  function concernOverzicht(eigenaar) {
    const ents = k.entiteitVanEigenaar(eigenaar);
    if (!ents.length) {
      return { ok: true, leeg: true,
        regel: 'U heeft nog geen entiteit. Begin met de naam van uw bedrijf; de rest volgt.' };
    }
    let vestigingen = 0, units = 0, mensen = 0, afdelingen = new Set(), rollen = new Set();
    const punten = [];
    for (const e of ents) {
      for (const v of k.vestigingAlleVanEntiteit(e.id)) {
        if (v.gesloten) continue;
        vestigingen++;
        units += (v.units || []).length;
      }
      for (const m of k.employmentVanEntiteit(e.id, false)) {
        if (m.telt) mensen++;
        if (m.afdeling) afdelingen.add(e.id + '/' + m.afdeling);
        rollen.add(m.rol);
      }
      const r = k.concernReadiness(e);
      punten.push(...r.blokkerend, ...r.aandacht);
    }
    return {
      ok: true,
      kop: 'Uw concern is opgebouwd.',
      telling: { entiteiten: ents.length, vestigingen, zaken: units,
        afdelingen: afdelingen.size, rollen: rollen.size, mensen },
      /* De punten worden GETELD en niet opgesomd in de kop: vier punten die
         aandacht vragen is een zin, veertig regels is een muur. */
      regel: punten.length
        ? 'Er ' + (punten.length === 1 ? 'is nog 1 punt dat' : 'zijn nog ' + punten.length + ' punten die') + ' uw aandacht vragen.'
        : 'Er zijn geen openstaande punten.',
      punten: punten.slice(0, 20)
    };
  }

  /* Wat de werknemer ziet. Vrijwel niets van de zwaarte hierboven -- dat is de
     hele bedoeling. */
  function werkOverzicht(persoon) {
    const emps = k.employmentVanPersoon(persoon, false);
    return { ok: true,
      werkplekken: emps.map(e => {
        const ent = k.entiteitVind(e.entiteit);
        return { employment: e.id,
          bedrijf: ent ? k.entiteitBeeld(ent).naam : null,
          rol: e.rol, plaats: e.vestigingNaam, soort: e.soortLabel,
          van: e.van, tot: e.tot };
      }),
      /* Ook hier de grens uit CONCERN.md, en met zoveel woorden: een werknemer
         die dit leest hoort te weten dat er geen abonnement achter zit. */
      regel: emps.length
        ? 'Uw werkplek' + (emps.length === 1 ? ' is' : 'ken zijn') + ' klaar.'
        : 'U heeft nog geen werkplek. Een werkgever nodigt u uit; dat is gratis.' };
  }

  /* Alles wat aan een entiteit hangt -- de vraag die entiteitVerwijder() stelt
     voordat hij iets weggooit. */
  function hangtAan(entiteitId) {
    const v = k.vestigingAlleVanEntiteit(entiteitId);
    const e = k.employmentVanEntiteit(entiteitId, true);
    const u = k.uitnodigingOpenstaand(entiteitId);
    const wat = [];
    if (v.length) wat.push(v.length + ' vestiging(en)');
    if (e.length) wat.push(e.length + ' dienstverband(en)');
    if (u.length) wat.push(u.length + ' openstaande uitnodiging(en)');
    return wat.length ? wat.join(', ') : null;
  }

  return Object.assign(k, { concernOverzicht, werkOverzicht, concernHangtAan: hangtAan });
};
