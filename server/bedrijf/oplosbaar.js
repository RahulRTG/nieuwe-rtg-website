/* WELKE SOORTEN EEN GEKOPPELD LID MAG OPLOSSEN, en per soort de grens.

   Oplossen betekent dat er een titel van de RTG-kant meekomt in de
   werkruimtelaag. Dat mag alleen voor gegevens die dit lid ook op de gewone
   manier zou zien -- en die vraag is PER SOORT anders. Daarom is dit een tabel
   met een functie per soort en geen vinkje: wie er een soort bijzet, schrijft
   op waarom een gekoppeld lid die mag zien.

   De aanroeper (./herkomst.js) heeft dan al vastgesteld dat er een echte
   RTG-sessie meekomt EN dat die het account is dat dit lid zelf koppelde. Wat
   hier staat is de tweede laag: wat mag deze persoon van de RTG-kant lezen. */
'use strict';

module.exports = {

  /* Een zaaknaam is openbaar -- hij staat in de Mall -- dus hier valt niets te
     lekken dat een lid niet ook gewoon kan opzoeken. */
  zaak: (kern, id) => {
    const z = kern.findSupplier ? kern.findSupplier(id) : null;
    return z ? { titel: z.name || z.code, sub: [z.type, z.city].filter(Boolean).join(' · ') } : null;
  },

  /* EEN VOERTUIG IS NIET OPENBAAR, en daarom is de zoekopdracht hier zelf de
     grens. Er wordt niet eerst gezocht en daarna gecontroleerd of het mag: er
     wordt uitsluitend gezocht in de vloten van de vervoerders waar dit lid
     volgens de personeelsadministratie WERKELIJK WERKT (kern/werkplekken.js,
     dezelfde ene bron die het Podium en het Theater gebruiken). Staat het
     voertuig bij een ander, dan is er geen pad waarlangs het gevonden wordt --
     en dat is sterker dan een controle die iemand kan vergeten.

     Let op wat dit betekent: gekoppeld zijn is NIET genoeg. Een medewerker van
     een werkruimte die niet bij die vervoerder in dienst is, krijgt de naam van
     de bus niet te zien, ook al heeft hij zijn RTG-account netjes gekoppeld. */
  voertuig: (kern, id, sessieKey) => {
    const zaken = kern.werkplekken ? kern.werkplekken.zakenVan(sessieKey) : [];
    for (const z of zaken) {
      const a = z && z.code ? kern.assetMet(z.code, id) : null;
      if (!a) continue;
      const b = kern.assetBeeld(a, {});
      return { titel: b.naam || b.id,
        sub: [b.categorieNaam, b.registratie, b.inzetbaar ? 'inzetbaar' : 'niet inzetbaar']
          .filter(Boolean).join(' · ') };
    }
    return null;
  }
};
