/* Foundation OS, deel "subsidies": aanvragen, voorwaarden en verantwoording.

   EEN SUBSIDIE IS GEEN INKOMSTEN MAAR EEN VERPLICHTING MET GELD ERBIJ. Dat is
   het hele verschil met een donatie, en het is de reden dat dit een eigen
   module is en geen bron met een vinkje. Er hangen voorwaarden aan, er zijn
   rapportagemomenten, er is een verantwoordingsdatum, en als het misgaat komt
   het geld terug. Een stichting die dat in een spreadsheet bijhoudt, ontdekt
   het terugbetalingsrisico op het moment dat de brief komt.

   DRIE DINGEN DIE HIER IN CODE STAAN EN NIET IN EEN AFSPRAAK:

   1. TOEKENNEN MAAKT ZELF DE GEOORMERKTE BRON. Zodra een subsidie op
      "toegekend" gaat, ontstaat er een bron in geld.js met de bestemming
      eraan vast -- en niet los, met de hand, in een tweede scherm. Twee plekken
      die hetzelfde bedrag vasthouden lopen uiteen (LAT.md regel 4), en juist
      bij subsidiegeld is dat de duurste vorm: het OOR van het oormerk zit dan
      niet in de administratie.

   2. AANVAARDEN BOVEN DE STADSGRENS IS LANDELIJK WERK. Een subsidie aannemen
      is een verplichting aangaan namens de hele stichting. Dezelfde ladder als
      bij de uitgaven, uit dezelfde functie (basis.js: limietVan), zodat de twee
      nooit uit elkaar lopen.

   3. VERANTWOORD BETEKENT VERANTWOORD. Zolang er een rapportagemoment open
      staat, gaat een subsidie niet op "verantwoord". Anders is dat vinkje het
      administratieve equivalent van wegkijken.

   EN EEN GEMISTE DEADLINE VALT OP. Een kans met een verstreken datum wordt niet
   stil oud; hij komt terug als `gemist`. Wat je niet ziet, vraag je niet aan. */

const SOORTEN = ['gemeente', 'fonds', 'rijk', 'provincie', 'europa', 'bedrijf', 'loterij'];
const STATUS = ['kans', 'in_voorbereiding', 'aangevraagd', 'toegekend', 'afgewezen', 'verantwoord', 'teruggevorderd'];
const KETEN = {
  kans: ['in_voorbereiding', 'afgewezen'],
  in_voorbereiding: ['aangevraagd', 'afgewezen'],
  aangevraagd: ['toegekend', 'afgewezen'],
  toegekend: ['verantwoord', 'teruggevorderd'],
  verantwoord: ['teruggevorderd'],
  afgewezen: ['in_voorbereiding'], teruggevorderd: []
};
const RISICO = ['laag', 'middel', 'hoog'];

module.exports = (ctx, eigen) => {
  const { nu, rid, schoon, centen, euro, S, audit, wie, rolIn, poort, limietVan, save } = ctx;
  const { bronUitSubsidie } = eigen;

  const vind = id => S().subsidies.find(s => s.id === String(id || '')) || null;
  const verlopen = s => !!s.deadline && Date.parse(s.deadline) < Date.now();
  const openMomenten = s => (s.momenten || []).filter(m => !m.af);

  const beeld = s => ({ id: s.id, stad: s.stad, naam: s.naam, verstrekker: s.verstrekker,
    soort: s.soort, projectId: s.projectId, status: s.status, deadline: s.deadline,
    aangevraagd: euro(s.aangevraagdCenten), toegekend: euro(s.toegekendCenten),
    // Een gemiste deadline is geen eigenschap van de subsidie maar van vandaag;
    // hij wordt daarom gerekend en niet opgeslagen.
    gemist: verlopen(s) && ['kans', 'in_voorbereiding'].includes(s.status),
    risico: s.risico, voorwaarden: s.voorwaarden || [], momenten: s.momenten || [],
    openMomenten: openMomenten(s).length, bewijs: (s.bewijs || []).slice(0, 30),
    bronId: s.bronId || null, at: s.at });

  function lijst(req, stadId) {
    const w = wie(req);
    const g = poort(w, stadId, 'stad.lezen');
    if (!g.ok) return g;
    const rijen = S().subsidies.filter(s => s.stad === g.stad.id);
    return { ok: true, soorten: SOORTEN, statussen: STATUS, keten: KETEN, risicos: RISICO,
      subsidies: rijen.map(beeld),
      totalen: {
        aangevraagd: euro(rijen.filter(s => s.status === 'aangevraagd').reduce((a, s) => a + s.aangevraagdCenten, 0)),
        toegekend: euro(rijen.filter(s => ['toegekend', 'verantwoord'].includes(s.status)).reduce((a, s) => a + s.toegekendCenten, 0)),
        gemist: rijen.filter(s => beeld(s).gemist).length,
        openMomenten: rijen.reduce((a, s) => a + openMomenten(s).length, 0),
        risicoHoog: rijen.filter(s => s.risico === 'hoog' && s.status === 'toegekend').length
      } };
  }

  function maak(req, b) {
    b = b || {};
    const w = wie(req);
    const g = poort(w, b.stad, 'geld.beheren', 'subsidy_management');
    if (!g.ok) return g;
    const naam = schoon(b.naam, 120);
    if (naam.length < 3) return { status: 400, error: 'Hoe heet deze subsidie of regeling?' };
    const soort = String(b.soort || '');
    if (!SOORTEN.includes(soort)) return { status: 400, error: 'Kies een soort (' + SOORTEN.join(', ') + ').' };
    const bedrag = centen(b.bedrag === undefined ? 0 : b.bedrag);
    if (bedrag === null) return { status: 400, error: 'Welk bedrag vraagt u aan? Nul mag ook.' };
    const deadline = schoon(b.deadline, 10);
    if (deadline && Number.isNaN(Date.parse(deadline))) return { status: 400, error: 'Gebruik een datum als 2027-02-01.' };
    let projectId = schoon(b.projectId, 20) || null;
    if (projectId) {
      const p = S().projecten.find(x => x.id === projectId);
      if (!p || p.stad !== g.stad.id) return { status: 400, error: 'Dat project hoort niet bij deze stad.' };
    }
    if (S().subsidies.length >= 50000) return { status: 400, error: 'Het subsidieregister zit vol.' };
    const s = { id: rid(), stad: g.stad.id, naam, verstrekker: schoon(b.verstrekker, 120),
      soort, projectId, status: 'kans', deadline: deadline || null,
      aangevraagdCenten: bedrag, toegekendCenten: 0,
      risico: RISICO.includes(String(b.risico)) ? String(b.risico) : 'middel',
      voorwaarden: [], momenten: [], bewijs: [], bronId: null, door: w.key, at: nu() };
    S().subsidies.push(s);
    audit(w.key, 'subsidie.maak', naam, g.stad.naam + ', ' + euro(bedrag));
    save();
    return { ok: true, subsidie: beeld(s) };
  }

  function zet(req, id, b) {
    const s = vind(id);
    if (!s) return { status: 404, error: 'Deze subsidie staat niet in het register.' };
    const w = wie(req);
    const g = poort(w, s.stad, 'geld.beheren', 'subsidy_management');
    if (!g.ok) return g;
    b = b || {};
    if (b.naam !== undefined) s.naam = schoon(b.naam, 120) || s.naam;
    if (b.verstrekker !== undefined) s.verstrekker = schoon(b.verstrekker, 120);
    if (b.risico !== undefined && RISICO.includes(String(b.risico))) s.risico = String(b.risico);
    if (b.deadline !== undefined) {
      const d = schoon(b.deadline, 10);
      if (d && Number.isNaN(Date.parse(d))) return { status: 400, error: 'Gebruik een datum als 2027-02-01.' };
      s.deadline = d || null;
    }
    if (b.bedrag !== undefined && s.status !== 'toegekend') {
      const c = centen(b.bedrag);
      if (c === null) return { status: 400, error: 'Welk bedrag vraagt u aan?' };
      s.aangevraagdCenten = c;
    }
    if (Array.isArray(b.voorwaarden)) s.voorwaarden = b.voorwaarden.map(x => schoon(x, 200)).filter(Boolean).slice(0, 40);
    save();
    return { ok: true, subsidie: beeld(s) };
  }

  /* De statusovergang, de rapportagemomenten en de bewijsstukken staan in
     ./subsidies-keten.js: dat is de kant met de grendels (toekennen maakt de
     bron, verantwoorden vraagt afgeronde momenten en bewijs), en dit bestand
     liep over de 10 KB van keuringsregel 13. */
  const keten = require('./subsidies-keten')(ctx, { vind, beeld, openMomenten, bronUitSubsidie, KETEN, RISICO });

  return { lijst, maak, zet, status: keten.status, moment: keten.moment,
    bewijsMaak: keten.bewijsMaak, vind, beeld, SOORTEN, STATUS, KETEN, RISICO };
};
module.exports.SOORTEN = SOORTEN;
module.exports.STATUS = STATUS;
