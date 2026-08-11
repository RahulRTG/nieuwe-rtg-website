/* CONCERN (deelmodule): VERANDERING. Stap 10 -- impact, terugdraaien,
   uitdiensttreding, overname en fusie.

   DEZELFDE INTELLIGENTIE BLIJFT NA DE ONBOARDING BESTAAN. Dat is de kern van
   dit bestand. Een systeem dat je helpt opbouwen en je daarna alleen laat met
   een reorganisatie, heeft je geholpen op het makkelijke moment.

   EERST TONEN, DAN DOEN. "Maak alle Finance centraal" is één zin en zes BV's.
   Elke ingreep hier levert eerst een IMPACT en pas daarna, met een aparte
   handeling, het resultaat. Dat is wet 5: de complexiteit onder water, de
   bevestiging bij de mens -- en het is de enige manier waarop een ingreep van
   deze omvang eerlijk kan zijn.

   EN HISTORIE WORDT NOOIT VERNIETIGD. Een overname maakt geen nieuw bedrijf;
   een fusie wist geen dienstverbanden. Dat is wet 4: als een reorganisatie het
   verleden uitwist, kan niemand meer nagaan wie waarvoor tekende toen het
   gebeurde -- en dat is precies het moment waarop iemand het wil weten.

   HET TERUGDRAAIEN IS EERLIJK BEGRENSD. Een momentopname bewaart de STRUCTUUR
   (entiteiten, vestigingen, dienstverbanden, feiten), niet de hele database.
   Wat er sinds de opname aan facturen, orders of berichten is bijgekomen, blijft
   staan -- terugdraaien is geen tijdreis. Dat staat in het antwoord, want een
   herstelknop waarvan de reikwijdte onduidelijk is, is gevaarlijker dan geen
   herstelknop. */
'use strict';

const MAX_OPNAMES = 20;

module.exports = (ctx) => {
  const { db, save, crypto, schoon, entiteitVind, entiteitBeeld, entiteitAlle,
    vestigingAlleVanEntiteit, employmentVanEntiteit, employmentVanPersoon,
    employmentVind, employmentBeeindig, uitnodigingOpenstaand,
    tijdGeschiedenis, tijdZet, tijdVandaag, concernUbo } = ctx;

  const nu = () => new Date().toISOString();

  function opnamebak() {
    if (!db.data.concern || typeof db.data.concern !== 'object') db.data.concern = {};
    if (!Array.isArray(db.data.concern.opnames)) db.data.concern.opnames = [];
    return db.data.concern.opnames;
  }

  /* ---- IMPACT ----

     Wat raakt deze ingreep? Telt entiteiten, mensen, vestigingen en zaken.
     Geeft NOOIT zelf het bevel: de aanroeper krijgt een beeld en beslist. */
  function impact(eigenaar, plan) {
    const p = plan || {};
    const ents = (p.entiteiten && p.entiteiten.length
      ? p.entiteiten.map(entiteitVind).filter(Boolean)
      : ctx.entiteitVanEigenaar(eigenaar));

    let mensen = 0, vestigingen = 0, zaken = 0;
    const perEntiteit = [];
    for (const e of ents) {
      const v = vestigingAlleVanEntiteit(e.id).filter(x => !x.gesloten);
      const m = employmentVanEntiteit(e.id, false);
      const z = v.reduce((n, x) => n + (x.units || []).length, 0);
      vestigingen += v.length; mensen += m.length; zaken += z;
      perEntiteit.push({ entiteit: e.id, naam: entiteitBeeld(e).naam,
        vestigingen: v.length, mensen: m.length, zaken: z });
    }
    return { ok: true, wat: schoon(p.wat, 200) || 'deze wijziging',
      raakt: { entiteiten: ents.length, vestigingen, mensen, zaken },
      perEntiteit,
      regel: 'Dit raakt ' + ents.length + ' entiteit(en), ' + vestigingen + ' vestiging(en), ' +
        mensen + ' medewerker(s) en ' + zaken + ' zaak/zaken.',
      volgende: 'Bevestig om door te voeren. Maak eerst een momentopname als u terug wilt kunnen.' };
  }

  /* ---- MOMENTOPNAME EN TERUGDRAAIEN ---- */
  function opnameMaak(eigenaar, waarom) {
    const ents = ctx.entiteitVanEigenaar(eigenaar);
    if (!ents.length) return { status: 409, error: 'Er is niets om te bewaren.' };
    const ids = new Set(ents.map(e => e.id));
    const o = {
      id: 'opn_' + crypto.randomBytes(6).toString('hex'),
      eigenaar, waarom: schoon(waarom, 200) || null, at: nu(),
      /* Een diepe kopie, want een ondiepe wijst naar dezelfde objecten en dan
         verandert de "opname" mee met wat hij zou moeten bewaren. Precies de
         fout die zetRegister() met kopie() vermijdt. */
      entiteiten: JSON.parse(JSON.stringify(ents)),
      vestigingen: JSON.parse(JSON.stringify(
        Object.values((db.data.concern.vestigingen) || {}).filter(v => ids.has(v.entiteit)))),
      employments: JSON.parse(JSON.stringify(
        Object.values((db.data.concern.employments) || {}).filter(x => ids.has(x.entiteit)))),
      feiten: JSON.parse(JSON.stringify(
        (db.data.concern.feiten || []).filter(f => ids.has(f.entiteit))))
    };
    const bak = opnamebak();
    bak.push(o);
    while (bak.length > MAX_OPNAMES) bak.shift();
    save();
    return { ok: true, opname: { id: o.id, at: o.at, waarom: o.waarom,
      telling: { entiteiten: o.entiteiten.length, vestigingen: o.vestigingen.length,
        mensen: o.employments.length, feiten: o.feiten.length } } };
  }

  const opnames = (eigenaar) => opnamebak().filter(o => o.eigenaar === eigenaar)
    .map(o => ({ id: o.id, at: o.at, waarom: o.waarom,
      telling: { entiteiten: o.entiteiten.length, vestigingen: o.vestigingen.length,
        mensen: o.employments.length, feiten: o.feiten.length } })).reverse();

  function opnameHerstel(eigenaar, id) {
    const o = opnamebak().find(x => x.id === id && x.eigenaar === eigenaar);
    if (!o) return { status: 404, error: 'Deze momentopname bestaat niet.' };
    const ids = new Set(o.entiteiten.map(e => e.id));

    /* Alles van deze eigenaar dat NU bestaat weghalen en de opname terugzetten.
       Alleen van deze eigenaar: een herstel mag nooit aan andermans entiteiten
       komen, ook niet als er ondertussen iets is bijgekomen. */
    const c = db.data.concern;
    for (const e of ctx.entiteitVanEigenaar(eigenaar)) { delete c.entiteiten[e.id]; ids.add(e.id); }
    for (const [k2, v] of Object.entries(c.vestigingen || {})) if (ids.has(v.entiteit)) delete c.vestigingen[k2];
    for (const [k2, v] of Object.entries(c.employments || {})) if (ids.has(v.entiteit)) delete c.employments[k2];
    c.feiten = (c.feiten || []).filter(f => !ids.has(f.entiteit));

    for (const e of o.entiteiten) c.entiteiten[e.id] = JSON.parse(JSON.stringify(e));
    for (const v of o.vestigingen) c.vestigingen[v.id] = JSON.parse(JSON.stringify(v));
    for (const m of o.employments) c.employments[m.id] = JSON.parse(JSON.stringify(m));
    c.feiten.push(...JSON.parse(JSON.stringify(o.feiten)));
    save();
    return { ok: true, hersteld: o.at,
      grens: 'De structuur staat terug zoals op ' + o.at + '. Facturen, orders en berichten van na dat moment zijn NIET teruggedraaid -- dit is geen tijdreis.' };
  }

  return Object.assign({ concernImpact: impact, concernOpnameMaak: opnameMaak,
    concernOpnames: opnames, concernOpnameHerstel: opnameHerstel },
    require('./verandering-eigendom')(ctx));
};
