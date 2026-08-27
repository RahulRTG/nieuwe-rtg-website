/* UITVOERENDE MEDIA (deelmodule): DE PARTITUUR -- wat de maker vastlegt.

   Een partituur is geen montage maar de RUIMTE waarbinnen montages mogen
   ontstaan: welke fragmenten er zijn, welke daarvan de kern vormen, wat er mag
   worden weggelaten, en wie het mag zien. RTG maakt daar op het moment van
   vragen één uitvoering van (./uitvoer.js).

   WAAROM "PARTITUUR" EN NIET "PROGRAMMA". Ook dit is gemeten en geen smaak:
   `programma` is in dit huis al bezet als een LIJST GEBEURTENISSEN OP EEN DAG
   -- het reisprogramma in kern/rechterhand/reisboek.js, het wedstrijdprogramma
   in kern/sportclub/cockpit.js, de clubprogramma's in kern/rtfclubs.js. Dat is
   een andere betekenis dan deze, en twee betekenissen op één woord is precies
   wat SEMANTIEK.json telt. `partituur` was vrij (nul treffers), en de metafoor
   klopt tot in de details: een partituur wordt niet afgespeeld maar UITGEVOERD,
   twee uitvoeringen van dezelfde partituur verschillen, en de componist bepaalt
   wat vastligt en wat de uitvoerende mag kiezen.

   DE PARTITUUR GAAT OVER EIGEN WERK. Een onderdeel mag alleen verwijzen naar
   een stuk waarvan DIT LID de maker is. Dat is geen extra regel maar de
   bestaande waarheid: de catalogus zegt bij elke rij al of hij van u is
   (`mijn`), en die vraag wordt hier met de sessie van de maker gesteld. Een
   partituur over andermans werk zou hermontage zijn onder een vreemde naam, en
   dat is een rechtenvraag en geen instelling (UITVOEREND.md par. 4.6).

   WAT ER MET OPZET NIET IN ZIT: een teller hoe vaak een partituur is
   uitgevoerd, en een volgorde op populariteit. De vier mediadomeinen weigeren
   die alle vier met zoveel woorden; een laag erboven die ze alsnog invoert,
   draait die keuze terug zonder dat iemand het ziet. */
'use strict';

const F = require('./fragment');

const ROLLEN = {
  kern: 'Hoort er altijd in. Zonder dit is het niet meer het werk.',
  verdieping: 'Mag weg als de tijd op is, of als de kijker er niet om vraagt.'
};
const MAX_ONDERDELEN = 300;
const MAX_PARTITUREN = 100;

module.exports = ({ db, save, schoon, crypto, catalogus }) => {
  const nu = () => new Date().toISOString();
  const id = () => 'pt' + crypto.randomBytes(4).toString('hex');

  function tabel() {
    if (!Array.isArray(db.data.partituren)) db.data.partituren = [];
    return db.data.partituren;
  }
  const met = (pid) => tabel().find(p => p.id === String(pid || '')) || null;
  const vanMij = (key, pid) => { const p = met(pid); return p && p.key === key ? p : null; };

  /* De toestemming: wat RTG met dit werk mag doen. Twee schakelaars, allebei
     standaard UIT. Dat is de belangrijkste standaardwaarde in dit bestand: wie
     niets invult, houdt zijn volledige werk. Een maker moet uitdrukkelijk
     zeggen dat er ingekort mag worden -- niet uitdrukkelijk zeggen dat het niet
     mag (UITVOEREND.md par. 4.6). */
  const schoneToestemming = (t) => ({
    inkorten: !!(t && t.inkorten),
    hermonteren: !!(t && t.hermonteren)
  });

  const beeld = (p, voorMaker) => ({
    id: p.id, naam: p.naam, klaar: !!p.klaar, at: p.at, bijgewerkt: p.bijgewerkt || p.at,
    onderdelen: (p.onderdelen || []).map(o => ({
      fragmentId: o.fragmentId, naam: o.naam, rol: o.rol, rolUitleg: ROLLEN[o.rol],
      diepte: o.diepte, duurS: F.duurVan(o.fragmentId),
      stukId: (F.lees(o.fragmentId) || {}).stukId || null
    })),
    regels: p.regels, toestemming: p.toestemming,
    aanspraakNodig: p.aanspraakNodig || null, prijsCenten: p.prijsCenten || 0,
    kernS: (p.onderdelen || []).filter(o => o.rol === 'kern').reduce((n, o) => n + F.duurVan(o.fragmentId), 0),
    totaalS: (p.onderdelen || []).reduce((n, o) => n + F.duurVan(o.fragmentId), 0),
    rollen: voorMaker ? ROLLEN : undefined
  });

  /* ---- de partituur zelf ---- */
  function maak(sess, opdracht) {
    const naam = schoon((opdracht || {}).naam, 80);
    if (!naam) return { status: 400, error: 'Geef de partituur een naam.' };
    if (tabel().filter(p => p.key === sess.key).length >= MAX_PARTITUREN)
      return { status: 409, error: 'U heeft de bovengrens van ' + MAX_PARTITUREN + ' partituren bereikt.' };
    const p = { id: id(), key: sess.key, naam, onderdelen: [],
      regels: { maxS: 0 }, toestemming: schoneToestemming(null),
      aanspraakNodig: null, prijsCenten: 0, klaar: false, at: nu(), bijgewerkt: nu() };
    tabel().push(p); save();
    return { status: 200, ok: true, partituur: beeld(p, true) };
  }

  function zet(sess, opdracht) {
    const o = opdracht || {};
    const p = vanMij(sess.key, o.id);
    if (!p) return { status: 404, error: 'Deze partituur bestaat niet, of is niet van u.' };
    if (o.weg === true) {
      db.data.partituren = tabel().filter(x => x !== p); save();
      return { status: 200, ok: true, weg: true };
    }
    if (o.naam != null) {
      const naam = schoon(o.naam, 80);
      if (!naam) return { status: 400, error: 'Geef de partituur een naam.' };
      p.naam = naam;
    }
    if (o.toestemming != null) p.toestemming = schoneToestemming(o.toestemming);
    if (o.aanspraakNodig !== undefined) {
      const c = String(o.aanspraakNodig || '').toLowerCase();
      if (!c && p.prijsCenten > 0 && o.prijsCenten == null)
        return { status: 400, error: 'Haal eerst de prijs weg: een betaald werk zonder aanspraak zou voor iedereen opengaan.' };
      p.aanspraakNodig = c ? c : null;
    }
    /* DE PRIJS. Hij woont hier omdat hij bij de partituur hoort, maar wat er
       met geld GEBEURT staat in ./aanbod.js -- die naad loopt waar hij hoort:
       hier staat wat iets kost, daar staat wat er gebeurt als iemand het koopt.

       Een prijs zonder benodigde aanspraak bestaat niet, en dat is geen
       formaliteit: dan zou een lid betalen voor iets dat toch al opengaat. */
    if (o.prijsCenten != null) {
      const n = Math.round(Number(o.prijsCenten));
      const prijs = Number.isFinite(n) && n > 0 ? n : 0;
      if (prijs > 0 && !(o.aanspraakNodig || p.aanspraakNodig))
        return { status: 400, error: 'Een prijs vraagt om een aanspraak: zonder die deur betaalt iemand voor iets dat toch al opengaat.' };
      p.prijsCenten = prijs;
    }
    if (o.maxS != null) {
      const n = Math.round(Number(o.maxS));
      p.regels.maxS = Number.isFinite(n) && n > 0 ? Math.min(n, F.MAX_S) : 0;
    }
    /* Klaarzetten kan alleen met een kern. Een partituur zonder kern zou RTG
       vragen om te bepalen wat het werk IS, en dat is precies de beslissing die
       hier bij de maker hoort te blijven. */
    if (o.klaar != null) {
      const kern = (p.onderdelen || []).filter(x => x.rol === 'kern').length;
      if (o.klaar && !kern)
        return { status: 400, error: 'Wijs eerst minstens één onderdeel als kern aan: zonder kern kan RTG niet weten wat het werk is.' };
      p.klaar = !!o.klaar;
    }
    p.bijgewerkt = nu(); save();
    return { status: 200, ok: true, partituur: beeld(p, true) };
  }

  /* Wat er IN een partituur zit -- erbij, eruit, verplaatsen, en de
     eigendomscontrole -- staat in ./onderdelen.js. Gesplitst toen dit bestand
     tegen de 10 kB-grens liep; de naad loopt waar hij hoort. */
  const { onderdeel, eigenWerk } = require('./onderdelen')({ save, schoon, nu, catalogus, vanMij, beeld, ROLLEN, MAX_ONDERDELEN });

  const mijne = (sess) => ({ status: 200, partituren: tabel().filter(p => p.key === sess.key).map(p => beeld(p, true)), rollen: ROLLEN });

  return { maak, zet, onderdeel, eigenWerk, mijne, met, beeld, ROLLEN };
};
