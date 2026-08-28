/* Foundation OS, deel "inkoop": gezamenlijk inkopen over steden heen.

   TWINTIG STEDEN DIE ELK APART VIJFTIG SLAAPZAKKEN KOPEN, BETALEN DE PRIJS VAN
   VIJFTIG SLAAPZAKKEN. Samen kopen is het meest tastbare voordeel van een
   federatie -- en tegelijk de plek waar een federatie het snelst zijn eigen
   governance omzeilt: "we doen het samen, dus het hoeft niet langs de stad".

   DAAROM IS DE KERN VAN DEZE MODULE DAT ER NIETS WORDT OMZEILD.

   1. INSCHRIJVEN DOET DE STAD ZELF, met een bron van de EIGEN stad en voor een
      eigen project. Er is geen landelijke knop die namens een stad geld
      vastlegt. Het oormerk blijft dus gewoon staan: geoormerkt jongerengeld
      koopt geen voedselpakketten, ook niet in een gezamenlijke order.

   2. SLUITEN MAAKT PER STAD EEN GEWONE UITGAVE-AANVRAAG (geld-uitgaven.js:
      boekAanvraag). Die loopt daarna door de vier ogen en de limiet van die
      stad, precies zoals elke andere uitgave. Een gezamenlijke order is dus
      geen betaling maar een BESTELLING waar elke stad zelf nog ja op zegt.
      Zou de inkoop zijn eigen boekingen schrijven, dan was hij de achterdeur
      om de goedkeuringsladder heen -- en dat is precies wat een inkoopmodule
      in de praktijk wordt als niemand erop let.

   3. DE SOM KLOPT TOT DE CENT. De stukprijs valt bij het sluiten meestal lager
      uit dan de indicatie (dat is de hele bedoeling), en dan moet het totaal
      exact over de steden verdeeld worden. Delen geeft afrondingsresten; die
      worden met de grootste-rest-methode toegekend, zodat de som van de delen
      exact het totaal is. Een cent die "wegvalt" is klein en het is het begin
      van een boekhouding die niet meer sluit.

   4. MINDER DAN TWEE STEDEN IS GEEN GEZAMENLIJKE INKOOP. Dan is het gewoon een
      bestelling van een stad, en die loopt via de eigen uitgaven. */

const STATUS = ['open', 'gesloten', 'geleverd', 'afgeblazen'];

module.exports = (ctx, eigen) => {
  const { nu, rid, schoon, naarCenten, euro, S, audit, wie, poort, stadVan, save } = ctx;
  const { boekAanvraag } = eigen;

  const I = () => S().inkoop;
  const vind = id => I().find(x => x.id === String(id || '')) || null;
  const totaalStuks = i => (i.deelnames || []).reduce((s, d) => s + d.aantal, 0);
  const beeld = i => ({ id: i.id, wat: i.wat, eenheid: i.eenheid, status: i.status,
    openerStad: (stadVan(i.openerStad) || {}).naam || null, leverancier: i.leverancier,
    indicatiePerStuk: euro(i.indicatieCenten), definitiefPerStuk: euro(i.definitiefCenten),
    sluitDatum: i.sluitDatum, stuks: totaalStuks(i),
    deelnames: (i.deelnames || []).map(d => ({ stad: (stadVan(d.stad) || {}).naam || d.stad,
      stadId: d.stad, aantal: d.aantal, projectId: d.projectId, deel: euro(d.deelCenten || 0),
      uitgaveId: d.uitgaveId || null })),
    totaal: euro((i.deelnames || []).reduce((s, d) => s + (d.deelCenten || 0), 0)), at: i.at });

  function lijst(req) {
    const w = wie(req);
    if (!w.key) return { status: 401, error: 'Log in om de gezamenlijke inkoop te zien.' };
    return { ok: true, statussen: STATUS, inkoop: I().slice(-200).reverse().map(beeld) };
  }

  function maak(req, b) {
    b = b || {};
    const w = wie(req);
    const g = poort(w, b.stad, 'geld.beheren');
    if (!g.ok) return g;
    const wat = schoon(b.wat, 120);
    if (wat.length < 3) return { status: 400, error: 'Wat wordt er samen ingekocht?' };
    const ind = naarCenten(b.indicatie);
    if (ind === null || ind === 0) return { status: 400, error: 'Wat is de indicatieprijs per stuk?' };
    const sluit = schoon(b.sluitDatum, 10);
    if (sluit && Number.isNaN(Date.parse(sluit))) return { status: 400, error: 'Gebruik een datum als 2026-10-01.' };
    if (I().length >= 20000) return { status: 400, error: 'Het inkoopregister zit vol.' };
    const rij = { id: rid(), openerStad: g.stad.id, wat, eenheid: schoon(b.eenheid, 20) || 'stuks',
      indicatieCenten: ind, definitiefCenten: 0, leverancier: schoon(b.leverancier, 120),
      sluitDatum: sluit || null, status: 'open', deelnames: [], door: w.key, at: nu() };
    I().push(rij);
    audit(w.key, 'inkoop.maak', wat, 'geopend door ' + g.stad.naam);
    save();
    return { ok: true, inkoop: beeld(rij) };
  }

  /* Inschrijven. De stad legt zelf vast hoeveel, voor welk project en uit welke
     bron. Die drie horen bij elkaar: zonder project is er geen bestemming, en
     zonder bron is de toezegging een intentie die bij het sluiten omvalt. */
  function schrijfIn(req, id, b) {
    b = b || {};
    const i = vind(id);
    if (!i) return { status: 404, error: 'Deze inkoop bestaat niet.' };
    if (i.status !== 'open') return { status: 400, error: 'Deze inkoop staat op "' + i.status + '" en neemt geen inschrijvingen meer aan.' };
    const p = S().projecten.find(x => x.id === String(b.projectId || ''));
    if (!p) return { status: 404, error: 'Kies het project waarvoor deze stad meedoet.' };
    const w = wie(req);
    const g = poort(w, p.stad, 'uitgave.aanvragen', p.vlag);
    if (!g.ok) return g;
    if (!['goedgekeurd', 'actief'].includes(p.status)) {
      return { status: 400, error: 'Dit project staat op "' + p.status + '"; er wordt pas ingekocht als het is goedgekeurd.' };
    }
    const aantal = Math.round(Number(b.aantal));
    if (!Number.isFinite(aantal) || aantal <= 0) return { status: 400, error: 'Hoeveel ' + i.eenheid + ' neemt deze stad af?' };
    const bron = S().bronnen.find(x => x.id === String(b.bronId || ''));
    if (!bron) return { status: 404, error: 'Kies de bron waaruit deze stad betaalt.' };
    if (bron.stad !== p.stad) {
      return { status: 400, error: 'Die bron hoort bij een andere stad. Elke stad betaalt uit eigen middelen; dat is wat een gezamenlijke inkoop gezamenlijk maakt en geen gedeelde pot.' };
    }
    if (bron.projectId && bron.projectId !== p.id) {
      const ander = S().projecten.find(x => x.id === bron.projectId);
      return { status: 403, error: 'Dat geld is geoormerkt voor "' + ((ander && ander.naam) || bron.projectId) +
        '". Een gezamenlijke inkoop maakt een oormerk niet los.' };
    }
    if (!Array.isArray(i.deelnames)) i.deelnames = [];
    const bestaand = i.deelnames.find(d => d.stad === p.stad);
    if (bestaand) {
      bestaand.aantal = Math.min(aantal, 10000000);
      bestaand.projectId = p.id;
      bestaand.bronId = bron.id;
    } else {
      if (i.deelnames.length >= 500) return { status: 400, error: 'Deze inkoop zit vol met deelnemers.' };
      i.deelnames.push({ stad: p.stad, aantal: Math.min(aantal, 10000000), projectId: p.id,
        bronId: bron.id, door: w.key, deelCenten: 0, uitgaveId: null, at: nu() });
    }
    audit(w.key, 'inkoop.inschrijving', i.wat, g.stad.naam + ': ' + aantal + ' ' + i.eenheid);
    save();
    return { ok: true, inkoop: beeld(i) };
  }

  /* Het sluiten en de statusgang staan in ./inkoop-sluiten.js: daar zit de
     centnauwkeurige verdeling en de overgang naar gewone uitgave-aanvragen per
     stad. Dit bestand liep over de 10 KB van keuringsregel 13. */
  const sluiten = require('./inkoop-sluiten')(ctx, { vind, beeld, totaalStuks, boekAanvraag });

  return { lijst, maak, schrijfIn, sluit: sluiten.sluit, status: sluiten.status,
    vind, beeld, STATUS };
};
module.exports.STATUS = STATUS;
