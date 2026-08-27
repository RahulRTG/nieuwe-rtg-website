/* CONCERN (deelmodule): HET DIENSTVERBAND. Stap 3.

   EEN MENS, MEERDERE WERKGEVERS. Dat is de hele reden dat dit bestand bestaat.

   Wat er stond: kern/eenaccount.js draagt een sleutelbos -- één RTG-account met
   daaraan werkrollen (`personeel` bij zaak X, `kantoor`, `werkruimte`). Dat is
   een goede laag en hij blijft. Maar een rol aan een zaakcode is geen
   dienstverband: er hoort geen werkgever bij, geen vestiging, geen afdeling,
   geen periode en geen reden. Iemand die bij twee bedrijven werkt en bij een
   derde als adviseur meekijkt, heeft in die opzet drie losse sleutels en
   nergens het feit dat het drie verschillende werkrelaties zijn.

     Person
     ├── Employment  North Sea Hotels BV · Amsterdam · Manager · actief
     ├── Employment  Olive Restaurant BV · Haarlem · Adviseur · actief
     └── Mandate     Holding BV · Accountant · read-only finance

   HET DIENSTVERBAND HANGT AAN DE ENTITEIT EN NIET AAN DE ZAAK. Dat is een
   keuze met gevolgen, en het is de goede: een hotelgroep die haar restaurant
   sluit, sluit een operating unit -- het personeel is in dienst van de BV en
   raakt zijn dienstverband niet kwijt omdat een van de zaken dicht gaat. De
   vestiging staat er wél bij, want daar werkt iemand.

   MANDAAT IS GEEN DIENSTVERBAND. Een accountant met inzage in de financiën van
   drie BV's is geen werknemer, en het zou onjuist zijn hem als zodanig te
   tellen -- in het organigram, in de loonrun of in een personeelsbestand. Het
   is dezelfde structuur met een andere soort, en dat verschil staat op het
   object en niet in een vaag rolveld.

   ALLES OP CODENAAM. Wie iemand is, staat in de identiteitskluis. Wat hier
   staat is een codenaam, een rol en een venster -- dezelfde regel die
   kern/onderneming/toegang.js al hanteert. */
'use strict';

const SOORTEN = {
  employment: { label: 'Dienstverband', telt: true,
    uitleg: 'Deze persoon werkt hier.' },
  mandaat: { label: 'Mandaat', telt: false,
    uitleg: 'Deze persoon werkt hier niet, maar heeft een afgebakende bevoegdheid of inzage.' }
};

const DATUM = /^\d{4}-\d{2}-\d{2}$/;

module.exports = (ctx) => {
  const { db, save, crypto, schoon, entiteitVind, vestigingVind, tijdVandaag, opslag } = ctx;

  const nu = () => new Date().toISOString();

  const bak = () => opslag.tak('employments');

  const vind = (id) => bak()[String(id || '')] || null;

  /* Loopt dit dienstverband op deze dag? Precies het venster van
     server/bedrijf/rollen.js en van ./tijd.js: van en tot inclusief. Drie
     plekken met hetzelfde venster is geen herhaling maar noodzaak -- een venster
     dat hier soepeler is, zegt iets anders dan de poort die de toegang bewaakt. */
  const loopt = (e, d) => !(e.van && String(e.van) > d) && !(e.tot && String(e.tot) < d);

  /* ---- aannemen ---- */
  function employmentNieuw(body) {
    const b = body || {};
    const persoon = schoon(b.persoon, 80);
    if (!persoon) return { status: 400, error: 'Wie gaat hier werken?' };

    const ent = entiteitVind(b.entiteit);
    if (!ent) return { status: 404, error: 'Deze entiteit bestaat niet.' };

    const soort = SOORTEN[b.soort] ? b.soort : 'employment';
    const rol = schoon(b.rol, 80);
    if (!rol) return { status: 400, error: 'Wat gaat deze persoon doen?' };

    let vest = null;
    if (b.vestiging) {
      vest = vestigingVind(b.vestiging);
      if (!vest) return { status: 404, error: 'Deze vestiging bestaat niet.' };
      if (vest.entiteit !== ent.id) {
        return { status: 400, error: 'Deze vestiging hoort bij een andere entiteit.',
          uitleg: 'Iemand werkt op een vestiging van de entiteit die hem in dienst neemt.' };
      }
      if (vest.gesloten) return { status: 409, error: 'Deze vestiging is gesloten.' };
    }

    const van = b.van && DATUM.test(b.van) ? b.van : tijdVandaag();
    const tot = b.tot === undefined || b.tot === null || b.tot === '' ? null : b.tot;
    if (tot !== null && !DATUM.test(tot)) return { status: 400, error: 'Tot welke datum? (JJJJ-MM-DD)' };
    if (tot !== null && tot < van) return { status: 400, error: 'De einddatum ligt voor de begindatum.' };

    /* Dezelfde persoon twee keer bij dezelfde entiteit in dezelfde rol op
       hetzelfde moment is geen tweede baan maar een dubbele invoer. Een tweede
       rol bij dezelfde werkgever mag wel -- dat komt echt voor. */
    const dubbel = Object.values(bak()).find(x => x.persoon === persoon && x.entiteit === ent.id
      && x.rol === rol && x.soort === soort && !x.tot);
    if (dubbel) return { status: 409, error: 'Deze persoon heeft deze rol hier al.', employment: beeld(dubbel) };

    const e = {
      id: 'emp_' + crypto.randomBytes(6).toString('hex'),
      persoon, entiteit: ent.id, vestiging: vest ? vest.id : null,
      afdeling: schoon(b.afdeling, 60) || null,
      rol, soort,
      leidinggevende: b.leidinggevende ? String(b.leidinggevende) : null,
      van, tot,
      /* De reikwijdte: waar geldt deze rol? Standaard de vestiging als die er is,
         anders de entiteit. Zie ./scope.js -- daar wordt hij uitgelegd en
         gebruikt; hier wordt hij alleen vastgelegd. */
      scope: b.scope && typeof b.scope === 'object' ? b.scope : null,
      gemaakt: nu()
    };
    bak()[e.id] = e;
    save();
    return { ok: true, employment: beeld(e) };
  }

  /* Uit dienst. Geen verwijdering: iemand die vorig jaar bij u werkte, werkte
     vorig jaar bij u -- en dat moet terug te vinden zijn als er een vraag komt
     over wie toen wat deed. Zie ./offboarding.js voor wat er verder bij hoort. */
  function employmentBeeindig(e, per) {
    const d = per && DATUM.test(per) ? per : tijdVandaag();
    if (d < String(e.van)) return { status: 400, error: 'De einddatum ligt voor de begindatum.' };
    if (e.tot && String(e.tot) <= tijdVandaag()) return { status: 409, error: 'Dit dienstverband is al beëindigd.' };
    e.tot = d;
    e.beeindigd = nu();
    save();
    return { ok: true, employment: beeld(e) };
  }

  function employmentZet(e, body) {
    const b = body || {};
    if (b.rol !== undefined) { const r = schoon(b.rol, 80); if (r) e.rol = r; }
    if (b.afdeling !== undefined) e.afdeling = schoon(b.afdeling, 60) || null;
    if (b.leidinggevende !== undefined) e.leidinggevende = b.leidinggevende ? String(b.leidinggevende) : null;
    if (b.scope !== undefined) e.scope = b.scope && typeof b.scope === 'object' ? b.scope : null;
    if (b.vestiging !== undefined) {
      if (!b.vestiging) e.vestiging = null;
      else {
        const v = vestigingVind(b.vestiging);
        if (!v) return { status: 404, error: 'Deze vestiging bestaat niet.' };
        if (v.entiteit !== e.entiteit) return { status: 400, error: 'Deze vestiging hoort bij een andere entiteit.' };
        e.vestiging = v.id;
      }
    }
    save();
    return { ok: true, employment: beeld(e) };
  }

  /* ---- lezen ---- */
  function beeld(e) {
    const d = tijdVandaag();
    const ent = entiteitVind(e.entiteit);
    const v = e.vestiging ? vestigingVind(e.vestiging) : null;
    return { id: e.id, persoon: e.persoon,
      entiteit: e.entiteit, vestiging: e.vestiging,
      vestigingNaam: v ? v.naam : null,
      afdeling: e.afdeling, rol: e.rol,
      soort: e.soort, soortLabel: SOORTEN[e.soort].label, telt: SOORTEN[e.soort].telt,
      leidinggevende: e.leidinggevende || null,
      van: e.van, tot: e.tot,
      actief: loopt(e, d),
      /* Een dienstverband dat nog moet beginnen is niet hetzelfde als een dat is
         afgelopen, en allebei zijn ze "niet actief". Wie dat verschil niet
         toont, laat iemand zoeken naar een fout die er niet is. */
      stand: loopt(e, d) ? 'loopt' : (e.van > d ? 'begint nog' : 'beëindigd'),
      bestaatEntiteit: !!ent };
  }

  const vanPersoon = (persoon, ookOud) => Object.values(bak())
    .filter(e => e.persoon === persoon && (ookOud || loopt(e, tijdVandaag())))
    .map(beeld);

  const vanEntiteit = (entiteitId, ookOud) => Object.values(bak())
    .filter(e => e.entiteit === entiteitId && (ookOud || loopt(e, tijdVandaag())))
    .map(beeld);

  const vanVestiging = (vestigingId, ookOud) => Object.values(bak())
    .filter(e => e.vestiging === vestigingId && (ookOud || loopt(e, tijdVandaag())))
    .map(beeld);

  /* Wie werkte hier op een gegeven dag -- de tijdmachine voor mensen. */
  const opDatum = (entiteitId, datum) => {
    const d = DATUM.test(String(datum)) ? datum : tijdVandaag();
    return Object.values(bak()).filter(e => e.entiteit === entiteitId && loopt(e, d)).map(beeld);
  };

  return Object.assign({ EMPLOYMENT_SOORTEN: SOORTEN, employmentVind: vind,
    employmentNieuw, employmentBeeindig, employmentZet, employmentBeeld: beeld,
    employmentVanPersoon: vanPersoon, employmentVanEntiteit: vanEntiteit,
    employmentVanVestiging: vanVestiging, employmentOpDatum: opDatum,
    employmentAlle: () => Object.values(bak()), employmentLoopt: loopt },
    require('./employment-organigram')({ vanEntiteit }));
};
