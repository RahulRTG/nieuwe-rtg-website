/* Foundation OS, deel "campagnes": landelijk werven, lokaal besteden.

   EEN LANDELIJKE CAMPAGNE HAALT GELD OP DAT NERGENS THUISHOORT. "Steun de
   RTFoundation" is geen bestemming; iemand geeft aan de stichting en verwacht
   dat het bij mensen terechtkomt. Zodra dat geld binnen is, moet het naar
   steden -- en dat is precies het moment waarop een federatie ruzie krijgt, of
   waarop het geld op het hoofdkantoor blijft liggen omdat niemand een sleutel
   durft vast te leggen.

   DAAROM STAAT DE SLEUTEL VOORAF VAST, EN TELT HIJ OP TOT HONDERD. Niet
   ongeveer honderd: exact. Een sleutel van 99% laat elke ronde een restje
   achter dat nergens hoort, en dat restje wordt in een jaar een potje.

   EN DE VERDELING VERLIEST GEEN CENT. Delen geeft resten; die worden met de
   grootste-rest-methode toegekend zodat de som van de delen exact het bedrag
   is. Dit is dezelfde rekenregel als bij de gezamenlijke inkoop, en om dezelfde
   reden: een boekhouding die per ronde een cent kwijtraakt, sluit na een jaar
   niet meer en niemand weet meer waar het begon.

   WAT ER PER STAD ONTSTAAT IS EEN GEWONE BRON, geoormerkt op de campagne en met
   herbestemming "met_toestemming" -- want de gever gaf aan de campagne en niet
   aan een willekeurig project. Verschuiven kan dus alleen langs de weg die daar
   voor staat (geld-bron.js), landelijk en met een reden.

   DE SLEUTEL IS EEN KEUZE EN GEEN FORMULE. Er is met opzet geen automatische
   verdeling naar inwonertal of naar "prestatie": het eerste negeert waar de
   nood zit, het tweede beloont de stad die het makkelijkste werk doet. Het
   landelijke bestuur zet de sleutel, met de reden erbij, en die staat in het
   auditspoor. */

const STATUS = ['concept', 'live', 'gesloten'];

module.exports = (ctx, eigen) => {
  const { nu, rid, schoon, centen, euro, S, audit, wie, stadVan, save } = ctx;
  const { bronUitCampagne } = eigen;

  const C = () => S().campagnes;
  const vind = id => C().find(c => c.id === String(id || '')) || null;
  const sleutelSom = c => (c.sleutel || []).reduce((s, x) => s + x.promille, 0);

  const beeld = c => ({ id: c.id, naam: c.naam, doel: c.doel, status: c.status,
    van: c.van, tot: c.tot, opgehaald: euro(c.opgehaaldCenten), rondes: (c.rondes || []).length,
    // promille intern (drie decimalen op een procent), procent naar buiten:
    // 33,3% + 33,3% + 33,4% telt exact op tot 100 en 1/3 + 1/3 + 1/3 niet.
    sleutel: (c.sleutel || []).map(x => ({ stad: x.stad, stadNaam: (stadVan(x.stad) || {}).naam || x.stad,
      procent: x.promille / 10, reden: x.reden || '' })),
    sluitend: sleutelSom(c) === 1000, at: c.at });

  function lijst(req) {
    const w = wie(req);
    if (!w.key) return { status: 401, error: 'Log in om de campagnes te zien.' };
    return { ok: true, statussen: STATUS, landelijk: !!w.landelijk,
      campagnes: C().map(c => Object.assign(beeld(c), {
        rondesDetail: w.landelijk ? (c.rondes || []).slice(-20).reverse() : undefined })) };
  }

  function maak(req, b) {
    b = b || {};
    const w = wie(req);
    if (!w.landelijk) return { status: 403, error: 'Een landelijke campagne opent het landelijke RTF-bestuur.' };
    const naam = schoon(b.naam, 120);
    if (naam.length < 3) return { status: 400, error: 'Hoe heet de campagne?' };
    const tot = schoon(b.tot, 10);
    if (tot && Number.isNaN(Date.parse(tot))) return { status: 400, error: 'Gebruik een datum als 2026-12-31.' };
    if (C().length >= 5000) return { status: 400, error: 'Het campagneregister zit vol.' };
    const c = { id: rid(), naam, doel: schoon(b.doel, 400), status: 'concept',
      van: schoon(b.van, 10) || nu().slice(0, 10), tot: tot || null,
      sleutel: [], opgehaaldCenten: 0, rondes: [], door: w.key, at: nu() };
    C().push(c);
    audit(w.key, 'campagne.maak', naam, '');
    save();
    return { ok: true, campagne: beeld(c) };
  }

  /* De verdeelsleutel. In promille van honderd (dus 333 = 33,3%), zodat een
     derde-derde-derde exact sluit. Optellen tot precies 1000 is een harde eis
     en geen waarschuwing: de sleutel is de belofte waarmee het geld binnenkomt. */
  function sleutelZet(req, id, delen) {
    const c = vind(id);
    if (!c) return { status: 404, error: 'Deze campagne bestaat niet.' };
    const w = wie(req);
    if (!w.landelijk) return { status: 403, error: 'De verdeelsleutel stelt het landelijke bestuur vast.' };
    if (c.status === 'gesloten') return { status: 400, error: 'Deze campagne is gesloten.' };
    const rijen = [];
    for (const d of (Array.isArray(delen) ? delen : [])) {
      const stad = stadVan(d && d.stad);
      if (!stad) return { status: 404, error: 'Een van deze stadsafdelingen bestaat niet.' };
      if (rijen.some(x => x.stad === stad.id)) return { status: 400, error: 'RTF ' + stad.naam + ' staat er twee keer in.' };
      const promille = Math.round(Number(d.procent) * 10);
      if (!Number.isFinite(promille) || promille <= 0) return { status: 400, error: 'Elk aandeel is groter dan nul (RTF ' + stad.naam + ').' };
      rijen.push({ stad: stad.id, promille, reden: schoon(d.reden, 200) });
    }
    if (!rijen.length) return { status: 400, error: 'Verdeel de campagne over ten minste een stad.' };
    const som = rijen.reduce((s, x) => s + x.promille, 0);
    if (som !== 1000) {
      return { status: 400, error: 'De sleutel telt op tot ' + (som / 10) + '% en moet exact 100% zijn. ' +
        'Een sleutel die niet sluit, laat elke ronde een restje achter dat nergens hoort.' };
    }
    c.sleutel = rijen;
    audit(w.key, 'campagne.sleutel', c.naam, rijen.map(x => ((stadVan(x.stad) || {}).naam || x.stad) + ' ' + (x.promille / 10) + '%').join(', '));
    save();
    return { ok: true, campagne: beeld(c) };
  }

  function status(req, id, naar) {
    const c = vind(id);
    if (!c) return { status: 404, error: 'Deze campagne bestaat niet.' };
    const w = wie(req);
    if (!w.landelijk) return { status: 403, error: 'Een campagne openen of sluiten doet het landelijke bestuur.' };
    const st = String(naar || '');
    if (!STATUS.includes(st)) return { status: 400, error: 'Deze status kennen we niet.' };
    if (st === 'live' && sleutelSom(c) !== 1000) {
      return { status: 400, error: 'Zet eerst een sluitende verdeelsleutel. Geld ophalen zonder te weten waar het heen gaat, is hoe een potje ontstaat.' };
    }
    c.status = st;
    audit(w.key, 'campagne.status', c.naam, st);
    save();
    return { ok: true, campagne: beeld(c) };
  }

  /* Een binnengekomen bedrag verdelen. Dit is het hart: het bedrag gaat er in
     een keer in en komt er als bronnen per stad uit, tot de cent kloppend. */
  function ronde(req, id, b) {
    b = b || {};
    const c = vind(id);
    if (!c) return { status: 404, error: 'Deze campagne bestaat niet.' };
    const w = wie(req);
    if (!w.landelijk) return { status: 403, error: 'Campagnegeld verdeelt het landelijke bestuur.' };
    if (c.status !== 'live') return { status: 400, error: 'Deze campagne staat op "' + c.status + '".' };
    if (sleutelSom(c) !== 1000) return { status: 400, error: 'De verdeelsleutel sluit niet.' };
    const bedrag = centen(b.bedrag);
    if (bedrag === null || bedrag === 0) return { status: 400, error: 'Welk bedrag is er binnengekomen?' };

    const ruw = c.sleutel.map(s => ({ s, exact: (bedrag * s.promille) / 1000 }));
    let som = 0;
    for (const r of ruw) { r.deel = Math.floor(r.exact); som += r.deel; }
    ruw.sort((a, b2) => (b2.exact - b2.deel) - (a.exact - a.deel));
    for (let k = 0; k < bedrag - som; k++) ruw[k % ruw.length].deel += 1;
    const controle = ruw.reduce((s, r) => s + r.deel, 0);
    if (controle !== bedrag) {
      return { status: 500, error: 'De verdeling sluit niet (' + controle + ' van ' + bedrag + ' cent). Er is niets geboekt.' };
    }

    const delen = [];
    for (const r of ruw) {
      if (r.deel === 0) continue;
      const bron = bronUitCampagne({ stad: r.s.stad, centen: r.deel, campagne: c.naam,
        gever: schoon(b.gever, 120) || 'campagne ' + c.naam, door: w.key });
      delen.push({ stad: r.s.stad, stadNaam: (stadVan(r.s.stad) || {}).naam || r.s.stad,
        bedrag: euro(r.deel), bronId: bron.id });
    }
    c.opgehaaldCenten += bedrag;
    if (!Array.isArray(c.rondes)) c.rondes = [];
    c.rondes.push({ id: rid(), centen: bedrag, gever: schoon(b.gever, 120), delen, door: w.key, at: nu() });
    audit(w.key, 'campagne.ronde', c.naam, euro(bedrag) + ' euro over ' + delen.length + ' steden');
    save();
    return { ok: true, campagne: beeld(c), delen,
      melding: euro(bedrag) + ' euro verdeeld over ' + delen.length + ' steden; de som van de delen is exact het bedrag.' };
  }

  return { lijst, maak, sleutelZet, status, ronde, vind, beeld, STATUS };
};
module.exports.STATUS = STATUS;
