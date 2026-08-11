/* CONCERN (deelmodule): BULK-UITNODIGEN.

   Afgesplitst van ./uitnodiging.js toen die over de 10 kB ging. De naad is
   inhoudelijk: daar staat EEN uitnodiging (en die moet in een scherm passen),
   hier staan er duizend tegelijk -- een heel ander probleem, met een heel
   andere fout-modus.

   EEN IMPORT DIE ZEGT ALLES BEGREPEN TE HEBBEN, LIEGT OVER DE REGELS DIE ZIJ
   RIED. Daarom komt er geen "1.500 verwerkt" uit maar een telling met de
   twijfelgevallen apart -- en die gaan NIET mee in het voorstel.

   EN ER WORDT NIET METEEN VERSTUURD. 1.464 uitnodigingen is een handeling met
   gevolgen voor 1.464 mensen. Wet 5. */
'use strict';

module.exports = (ctx) => {
  const { schoon, entiteitVind, vestigingAlleVanEntiteit, uitnodigingNieuw } = ctx;

  /* ---- bulk ----

     Een bedrijf met 1.500 medewerkers uploadt één bestand. Wat eruit komt is
     GEEN "1.500 verwerkt": de regels die twijfel geven worden apart geteld en
     apart getoond. Een import die zegt alles begrepen te hebben, liegt over de
     regels die zij ried. */
  function uitnodigingBulk(door, entiteitId, regels) {
    const ent = entiteitVind(entiteitId);
    if (!ent) return { status: 404, error: 'Deze entiteit bestaat niet.' };
    if (!Array.isArray(regels) || !regels.length) return { status: 400, error: 'Er staat niets in dit bestand.' };
    if (regels.length > 5000) return { status: 400, error: 'Maximaal 5000 regels per keer.' };

    const klaar = [], beoordelen = [];
    const vestigingen = new Map();
    for (const r of (ctx.vestigingAlleVanEntiteit(entiteitId) || [])) {
      if (!r.gesloten) vestigingen.set(String(r.naam).toLowerCase(), r.id);
    }

    for (let i = 0; i < regels.length; i++) {
      const r = regels[i] || {};
      const rol = schoon(r.rol, 80);
      const contact = schoon(r.contact || r.naam, 160);
      if (!rol || !contact) {
        beoordelen.push({ regel: i + 1, waarom: 'rol of contact ontbreekt', gegeven: r });
        continue;
      }
      const plek = r.vestiging ? String(r.vestiging).toLowerCase() : null;
      if (plek && !vestigingen.has(plek)) {
        beoordelen.push({ regel: i + 1, waarom: 'vestiging "' + r.vestiging + '" bestaat niet', gegeven: r });
        continue;
      }
      klaar.push({ regel: i + 1, contact, rol, vestiging: plek ? vestigingen.get(plek) : null,
        afdeling: schoon(r.afdeling, 60) || null, van: r.van });
    }

    return { ok: true, gevonden: regels.length,
      klaar: klaar.length, beoordelen: beoordelen.length,
      teBeoordelen: beoordelen.slice(0, 200), voorstel: klaar,
      uitleg: klaar.length + ' van de ' + regels.length + ' regels kunnen meteen uitgenodigd worden. ' +
        (beoordelen.length ? beoordelen.length + ' regels vragen om een beslissing en worden NIET meegestuurd.' : 'Er zijn geen twijfelgevallen.'),
      /* Met opzet geen knop die meteen verstuurt: 1.464 uitnodigingen is een
         handeling met gevolgen voor 1.464 mensen. Wet 5. */
      volgende: 'Bevestig om ' + klaar.length + ' uitnodigingen te versturen.' };
  }

  function uitnodigingBulkVerstuur(door, entiteitId, voorstel) {
    if (!Array.isArray(voorstel) || !voorstel.length) return { status: 400, error: 'Er is niets te versturen.' };
    const uit = [], mislukt = [];
    for (const v of voorstel.slice(0, 5000)) {
      const r = uitnodigingNieuw(door, { entiteit: entiteitId, vestiging: v.vestiging,
        afdeling: v.afdeling, rol: v.rol, contact: v.contact, kanaal: 'bulk', van: v.van });
      if (r.ok) uit.push(r.uitnodiging); else mislukt.push({ contact: v.contact, error: r.error });
    }
    return { ok: true, verstuurd: uit.length, mislukt, uitnodigingen: uit };
  }

  return { uitnodigingBulk, uitnodigingBulkVerstuur };
};
