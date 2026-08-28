/* Foundation OS, deel "subsidies-keten": toekennen, rapporteren, verantwoorden.

   HIER STAAN DE DRIE GRENDELS VAN DE SUBSIDIEMODULE:

   1. TOEKENNEN MAAKT ZELF DE GEOORMERKTE BRON (geld.js: bronUitSubsidie). Niet
      met de hand in een tweede scherm, want twee plekken die hetzelfde bedrag
      vasthouden lopen uiteen (LAT.md regel 4) -- en bij subsidiegeld zit het
      oormerk dan niet in de administratie.

   2. AANVAARDEN BOVEN DE STADSGRENS IS LANDELIJK WERK. Een subsidie aannemen is
      een verplichting aangaan namens de hele stichting, met voorwaarden en een
      terugbetaalrisico. Dezelfde ladder als bij de uitgaven, uit dezelfde
      functie (basis.js: limietVan).

   3. VERANTWOORD BETEKENT VERANTWOORD. Zolang er een rapportagemoment open
      staat of er geen enkel bewijsstuk in het dossier zit, gaat een subsidie
      niet op "verantwoord". Anders is dat vinkje wegkijken met een knop.

   Afgesplitst uit subsidies.js op de 10 KB van keuringsregel 13. */

module.exports = (ctx, eigen) => {
  const { nu, rid, schoon, naarCenten, euro, S, audit, wie, rolIn, poort, limietVan, save } = ctx;
  const { vind, beeld, openMomenten, bronUitSubsidie, KETEN, RISICO } = eigen;

  /* De statusovergang. Twee stappen dragen een grendel, en ze staan hieronder
     met hun eigen zin omdat ze om iets anders vragen: bij "toegekend" moet er
     iemand met genoeg bevoegdheid tekenen, bij "verantwoord" moet het werk af
     zijn. */
  function status(req, id, naar, b) {
    b = b || {};
    const s = vind(id);
    if (!s) return { status: 404, error: 'Deze subsidie staat niet in het register.' };
    const w = wie(req);
    const g = poort(w, s.stad, 'geld.beheren', 'subsidy_management');
    if (!g.ok) return g;
    const st = String(naar || '');
    const mag = KETEN[s.status] || [];
    if (!mag.includes(st)) {
      return { status: 400, error: 'Vanaf "' + s.status + '" kan een subsidie naar ' +
        (mag.length ? mag.join(' of ') : 'niets meer') + ', niet naar "' + st + '".' };
    }
    if (st === 'toegekend') {
      const bedrag = naarCenten(b.bedrag === undefined ? euro(s.aangevraagdCenten) : b.bedrag);
      if (bedrag === null || bedrag === 0) return { status: 400, error: 'Welk bedrag is er toegekend?' };
      const grens = limietVan(g.stad, rolIn(w, s.stad));
      if (bedrag > grens) {
        return { status: 403, error: 'Een subsidie van ' + euro(bedrag) + ' euro aannemen is een verplichting aangaan namens de hele stichting; dat gaat boven uw grens van ' +
          (grens === Infinity ? 'onbeperkt' : euro(grens) + ' euro') + '. Het landelijke RTF-bestuur beslist hierover.' };
      }
      s.toegekendCenten = bedrag;
      /* De geoormerkte bron ontstaat hier, en maar een keer. Herbestemmen kan
         alleen met toestemming van de verstrekker -- dat is bij subsidiegeld
         geen beleefdheid maar de voorwaarde waaronder het is gegeven. */
      if (!s.bronId) {
        const bron = bronUitSubsidie({
          stad: s.stad, projectId: s.projectId, centen: bedrag,
          gever: s.verstrekker || s.naam, kenmerk: 'subsidie ' + s.naam, door: w.key
        });
        s.bronId = bron.id;
      }
    }
    if (st === 'verantwoord') {
      const open = openMomenten(s);
      if (open.length) {
        return { status: 400, error: 'Er staan nog ' + open.length + ' rapportagemomenten open (' +
          open.slice(0, 2).map(m => m.wat).join(', ') + '). Rond die eerst af.' };
      }
      if (!(s.bewijs || []).length) {
        return { status: 400, error: 'Er staat geen enkel bewijsstuk in het dossier. Een verantwoording zonder bewijs is een bewering.' };
      }
    }
    const oud = s.status;
    s.status = st;
    if (st === 'teruggevorderd') s.teruggevorderd = { door: w.key, reden: schoon(b.reden, 300), at: nu() };
    audit(w.key, 'subsidie.status', s.naam, oud + ' -> ' + st + (st === 'toegekend' ? ' (' + euro(s.toegekendCenten) + ')' : ''));
    save();
    return { ok: true, subsidie: beeld(s) };
  }

  // Een rapportagemoment: wanneer moet er wat worden opgeleverd, en is het af.
  function moment(req, id, b) {
    b = b || {};
    const s = vind(id);
    if (!s) return { status: 404, error: 'Deze subsidie staat niet in het register.' };
    const w = wie(req);
    const g = poort(w, s.stad, 'geld.beheren', 'subsidy_management');
    if (!g.ok) return g;
    if (!Array.isArray(s.momenten)) s.momenten = [];
    if (b.momentId) {
      const m = s.momenten.find(x => x.id === String(b.momentId));
      if (!m) return { status: 404, error: 'Dit rapportagemoment bestaat niet.' };
      m.af = b.af === true;
      m.afAt = m.af ? nu() : null;
      save();
      return { ok: true, subsidie: beeld(s) };
    }
    const wat = schoon(b.wat, 200);
    if (!wat) return { status: 400, error: 'Wat moet er op dat moment worden opgeleverd?' };
    const datum = schoon(b.datum, 10);
    if (datum && Number.isNaN(Date.parse(datum))) return { status: 400, error: 'Gebruik een datum als 2027-02-01.' };
    if (s.momenten.length >= 50) return { status: 400, error: 'Vijftig rapportagemomenten is genoeg.' };
    s.momenten.push({ id: rid(), wat, datum: datum || null, af: false, at: nu() });
    save();
    return { ok: true, subsidie: beeld(s) };
  }

  function bewijsMaak(req, id, b) {
    b = b || {};
    const s = vind(id);
    if (!s) return { status: 404, error: 'Deze subsidie staat niet in het register.' };
    const w = wie(req);
    const g = poort(w, s.stad, 'geld.beheren', 'subsidy_management');
    if (!g.ok) return g;
    const naam = schoon(b.naam, 120);
    if (!naam) return { status: 400, error: 'Hoe heet het bewijsstuk?' };
    if (!Array.isArray(s.bewijs)) s.bewijs = [];
    if (s.bewijs.length >= 200) return { status: 400, error: 'Dit dossier zit vol.' };
    s.bewijs.unshift({ id: rid(), naam, soort: schoon(b.soort, 40) || 'overig',
      verwijzing: schoon(b.verwijzing, 200), door: w.key, at: nu() });
    audit(w.key, 'subsidie.bewijs', s.naam, naam);
    save();
    return { ok: true, subsidie: beeld(s) };
  }

  return { status, moment, bewijsMaak };
};
