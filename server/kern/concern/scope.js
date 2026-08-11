/* CONCERN (deelmodule): ROL + REIKWIJDTE. Stap 4.

   > Rechten komen uit twee dingen: WAT bent u (de rol) en WAAR geldt het.

   Dat tweede ontbrak. server/bedrijf/rollen.js draagt al 18 rechten, 14 rollen,
   einddatums, vier soorten inzage die een REDEN vragen en een journaal -- maar
   die rollen gelden per werkruimte. "CFO van de hele holding" of "chef, alleen
   de keuken Amsterdam" was niet te zeggen.

   ER KOMT GEEN DERDE RECHTENMODEL BIJ, en dat is een grens uit CONCERN.md. Dit
   bestand verzint geen rechten; het LEEST de rechtentabel en zet er een
   reikwijdte omheen. Een eigen lijst zou bij het eerste verschil onbeslisbaar
   maken welke geldt -- LAT-regel 4.

   DE KWALIFICATIE IS EEN FILTER, GEEN ROL. Rol geeft MOGELIJKE toegang,
   kwalificatie bepaalt de WERKELIJKE. Dezelfde vorm als het werkvenster in
   magWerken(): een geldige inlog tegenhouden zonder dat er een rol verandert.

   EN ER WORDT NIETS VERLEEND. Deze laag antwoordt op vragen. */
'use strict';

const ROLLEN = require('../../bedrijf/rollen');

/* De reikwijdtes, van breed naar smal. De volgorde IS de betekenis: wie een
   recht op `concern` heeft, heeft het ook op elke entiteit daarbinnen. */
const NIVEAUS = ['concern', 'entiteit', 'vestiging', 'afdeling'];

/* Conflicten die om functiescheiding vragen. Elk paar is een combinatie die één
   mens in staat stelt zijn eigen werk goed te keuren. RTG SIGNALEERT en beslist
   niet: er zijn bedrijven waar dit onvermijdelijk is (een eenmanszaak is per
   definitie zijn eigen tweede paar ogen), en een systeem dat dat blokkeert
   maakt zichzelf onbruikbaar in plaats van veiliger. */
const CONFLICTEN = [
  { id: 'inkoop-en-betalen', rechten: ['klant', 'geld.goedkeuren'],
    kop: 'Kan zowel relaties aanmaken als betalingen goedkeuren',
    waarom: 'Wie een leverancier kan aanmaken en daarna zijn factuur kan goedkeuren, kan geld naar een eigen adres sturen zonder dat iemand meekijkt.' },
  { id: 'mens-en-geld', rechten: ['mens', 'geld.goedkeuren'],
    kop: 'Kan zowel personeel beheren als betalingen goedkeuren',
    waarom: 'Wie iemand kan aannemen en de loonbetaling kan goedkeuren, kan een dienstverband opvoeren dat niet bestaat.' },
  { id: 'besluit-en-journaal', rechten: ['besluit', 'journaal'],
    kop: 'Kan besluiten nemen en het journaal inzien of opschonen',
    waarom: 'Toezicht op eigen handelen is geen toezicht. Het journaal hoort gelezen te worden door iemand anders dan wie erin staat.' }
];

module.exports = (ctx) => {
  const { db, save, schoon, entiteitVind, vestigingVind, employmentVanPersoon,
    employmentVanEntiteit, tijdVandaag } = ctx;

  /* De kwalificaties wonen in ./scope-filters.js: zij zijn geen recht en geen
     rol, en horen dus niet in het bestand dat over rollen gaat. Hier worden ze
     alleen GELEZEN -- mag() hangt er zijn filter aan. */
  const filters = require('./scope-filters')(ctx);
  const { kwalificatiesVan } = filters;

  const rechtBestaat = (r) => (ROLLEN.RECHTEN || []).some(x => (x.id || x) === r);
  const rolVan = (id) => (ROLLEN.ROLLEN || []).find(r => r.id === id) || null;

  /* ---- de reikwijdte zelf ---- */

  /* Waar geldt dit dienstverband? Staat er niets op, dan is de reikwijdte de
     vestiging als die er is en anders de entiteit. Dat is een afleiding en geen
     standaardwaarde: iemand die op één vestiging werkt heeft geen bevoegdheid
     over de andere, tenzij dat er met zoveel woorden staat. */
  function scopeVan(emp) {
    if (emp.scope && NIVEAUS.includes(emp.scope.soort) && emp.scope.id) return emp.scope;
    if (emp.afdeling && emp.vestiging) return { soort: 'afdeling', id: emp.vestiging + '/' + emp.afdeling };
    if (emp.vestiging) return { soort: 'vestiging', id: emp.vestiging };
    return { soort: 'entiteit', id: emp.entiteit };
  }

  /* Dekt reikwijdte A het doel B? Een concern dekt zijn entiteiten, een entiteit
     haar vestigingen, een vestiging haar afdelingen. */
  function dekt(scope, doel) {
    if (!scope || !doel) return false;
    if (scope.soort === doel.soort && scope.id === doel.id) return true;
    if (NIVEAUS.indexOf(scope.soort) > NIVEAUS.indexOf(doel.soort)) return false;
    if (scope.soort === 'concern') {
      if (doel.soort === 'entiteit') { const e = entiteitVind(doel.id); return !!e && e.concern === scope.id; }
      if (doel.soort === 'vestiging') { const v = vestigingVind(doel.id); const e = v && entiteitVind(v.entiteit); return !!e && e.concern === scope.id; }
      if (doel.soort === 'afdeling') { const v = vestigingVind(String(doel.id).split('/')[0]); const e = v && entiteitVind(v.entiteit); return !!e && e.concern === scope.id; }
    }
    if (scope.soort === 'entiteit') {
      if (doel.soort === 'vestiging') { const v = vestigingVind(doel.id); return !!v && v.entiteit === scope.id; }
      if (doel.soort === 'afdeling') { const v = vestigingVind(String(doel.id).split('/')[0]); return !!v && v.entiteit === scope.id; }
    }
    if (scope.soort === 'vestiging' && doel.soort === 'afdeling')
      return String(doel.id).split('/')[0] === scope.id;
    return false;
  }

  /* ---- DE VRAAG: MAG DEZE PERSOON DIT, HIER? ----

     Geeft altijd een UITLEG mee, ook bij ja. Dat is CONCERN.md §7: een systeem
     dat rechten uitdeelt zonder te kunnen zeggen waarom iemand ergens NIET bij
     kan, is een systeem waarin mensen rechten stapelen tot het werkt. */
  function mag(persoon, recht, doel, opties) {
    if (!rechtBestaat(recht)) {
      return { ok: false, reden: 'onbekend-recht', uitleg: 'Dit recht kennen we niet: ' + recht };
    }
    const emps = employmentVanPersoon(persoon, false);
    if (!emps.length) {
      return { ok: false, reden: 'geen-werkrelatie',
        uitleg: 'Deze persoon heeft hier geen lopend dienstverband of mandaat.' };
    }
    const kwal = kwalificatiesVan(persoon).filter(k => k.geldig);
    const treffers = [];
    const bijna = [];

    for (const beeld of emps) {
      const emp = ctx.employmentVind(beeld.id);
      if (!emp) continue;
      const rol = rolVan(emp.rol) || rolVan(String(emp.rol).toLowerCase());
      const rechten = rol ? rol.rechten : [];
      const heeft = rechten.includes(recht);
      const s = scopeVan(emp);
      const past = dekt(s, doel);
      if (heeft && past) {
        /* De kwalificatie-eis. Staat hij op het recht, dan moet de persoon hem
           geldig hebben; anders telt deze treffer niet mee. */
        const eis = (opties || {}).kwalificatie;
        if (eis && !kwal.some(k => k.wat === eis || (k.opent || []).includes(eis))) {
          bijna.push({ employment: emp.id, rol: emp.rol, reden: 'kwalificatie',
            uitleg: 'De rol geeft dit recht, maar de vereiste kwalificatie (' + eis + ') ontbreekt of is verlopen.' });
          continue;
        }
        treffers.push({ employment: emp.id, rol: emp.rol, rolNaam: rol ? rol.naam : emp.rol,
          scope: s, alleenLezen: !!(rol && rol.alleenLezen) });
      } else if (heeft && !past) {
        bijna.push({ employment: emp.id, rol: emp.rol, reden: 'reikwijdte',
          uitleg: 'Deze rol geeft het recht, maar niet hier.', scope: s });
      } else if (!heeft && rol) {
        bijna.push({ employment: emp.id, rol: emp.rol, reden: 'rol', uitleg: 'Deze rol draagt dit recht niet.' });
      } else {
        bijna.push({ employment: emp.id, rol: emp.rol, reden: 'onbekende-rol',
          uitleg: 'Deze rol staat niet in de rollentabel; er komen geen rechten uit.' });
      }
    }

    if (!treffers.length) {
      return { ok: false, reden: 'geen-recht', bijna,
        uitleg: 'Geen van de werkrelaties van deze persoon geeft ' + recht + ' op deze plek.' };
    }
    return { ok: true, via: treffers,
      redenNodig: (ROLLEN.REDEN_NODIG || []).includes(recht),
      uitleg: 'Toegestaan via ' + treffers.map(t => t.rolNaam).join(', ') +
        ((ROLLEN.REDEN_NODIG || []).includes(recht) ? '. Dit recht vraagt een opgegeven reden, die in het journaal komt.' : '.') };
  }

  /* ---- functiescheiding ----
     Wat iemand bij elkaar in handen heeft. Signaleren, opties tonen, en de
     keuze bij de mens laten -- wet 5. */
  function functiescheiding(entiteitId) {
    const uit = [];
    const perPersoon = new Map();
    for (const beeld of employmentVanEntiteit(entiteitId, false)) {
      const emp = ctx.employmentVind(beeld.id);
      const rol = emp && (rolVan(emp.rol) || rolVan(String(emp.rol).toLowerCase()));
      if (!rol) continue;
      const set = perPersoon.get(emp.persoon) || new Set();
      for (const r of rol.rechten) set.add(r);
      perPersoon.set(emp.persoon, set);
    }
    for (const [persoon, rechten] of perPersoon) {
      for (const c of CONFLICTEN) {
        if (c.rechten.every(r => rechten.has(r))) {
          uit.push({ id: c.id, persoon, kop: c.kop, waarom: c.waarom, rechten: c.rechten,
            opties: ['toestaan', 'tweede goedkeurder', 'rechten aanpassen'] });
        }
      }
    }
    return { conflicten: uit, gekeken: perPersoon.size,
      uitleg: 'RTG signaleert deze combinaties en beslist er niet over. Bij een klein bedrijf is dit vaak onvermijdelijk; dan is een tweede goedkeurder de bruikbare uitweg.' };
  }

  return Object.assign({ SCOPE_NIVEAUS: NIVEAUS, SCOPE_CONFLICTEN: CONFLICTEN,
    scopeVan, scopeDekt: dekt, scopeMag: mag, scopeFunctiescheiding: functiescheiding },
    filters);
};
