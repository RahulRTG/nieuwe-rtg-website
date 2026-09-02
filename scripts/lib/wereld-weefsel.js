/* ============================================================================
   HET STADSWEEFSEL -- een gebied, een object, een doel en een werkorder.

   HET PROBLEEM. Veertig routes onder /api/office/weefsel/ stranden op vijf
   dingen die niet bestaan: een object (5), een besluit (4), een project (4),
   een gebied (2) en een zaak (2), plus een staart van enkelingen. Het is het
   stadsbesturingsvlak van het kantoor, en alles hangt aan een plek.

   DE VELDNAMEN ZIJN GEPREFIXEERD, en dat is geen toeval maar een ontwerp: de
   routes lezen `gebiedNaam`, `objectNaam`, `doelNaam` en `omschrijving` --
   nooit gewoon `naam` (routes/kantoren/weefsel.js). Zo kan een lijf voor twee
   dingen tegelijk staan zonder dat ze elkaar overschrijven. Raden had hier
   alleen "Hoe heet het gebied?" opgeleverd, met een naam die er wel degelijk
   in stond.

   DE PLEK WORDT GELEZEN, NIET VERZONNEN. Een object weigert met "Die positie
   ligt buiten de stad" als het punt in geen enkele zone valt, en die zones
   zijn geseed met echte veelhoeken (kern/stadsweefsel/geografie.js). Ik had
   coordinaten kunnen gokken; in plaats daarvan geeft
   /api/office/weefsel/gebieden zelf `midden` terug -- het middelpunt van de
   stad, per definitie binnen de grenzen. Verschuift de geografie ooit, dan
   verschuift dit mee in plaats van stil te breken.

   DE VOLGORDE IS DE KETEN: een werkorder hangt aan een object, een project aan
   een doel. Wat er niet komt, blokkeert alleen wat eronder hangt -- en dat
   staat met reden in de stappen. */
'use strict';

async function zetWeefselKlaar({ post, tokens }) {
  const stappen = [];
  const off = (tokens || {})['kantoor-op-naam'] || (tokens || {}).office;
  if (!off) {
    return { klaar: false, extra: {}, stappen,
      reden: 'zonder kantoorsessie is er niemand die het stadsweefsel beheert' };
  }

  const doe = async (naam, pad, lijf) => {
    let a = null;
    try { a = await post(pad, lijf, off); } catch (e) { a = null; }
    const ok = a && a.status >= 200 && a.status < 300;
    stappen.push({ naam, pad, status: a ? a.status : 0, ok,
      waarom: ok ? null : ((a && a.data && a.data.error) || 'geen antwoord') });
    return ok ? a.data : null;
  };

  const extra = {};

  /* 1. De stad zelf: waar ligt hij, en welk punt ligt er zeker binnen. */
  const kaart = await doe('de stadsgeografie', '/api/office/weefsel/gebieden', { niveau: 'wijk' });
  const midden = kaart && kaart.midden;
  const zone = kaart && Array.isArray(kaart.gebieden) && kaart.gebieden[0];
  if (zone && zone.id) { extra.gebied = zone.id; extra.gebiedId = zone.id; extra.ouder = zone.id; }
  if (midden && typeof midden.lat === 'number') { extra.lat = midden.lat; extra.lng = midden.lng; }

  /* 2. Een eigen gebied binnen die stad. */
  /* Een buurt hoort onder een WIJK en niet onder een zone -- de hierarchie is
     stad, wijk, buurt, zone, straatsegment, en de route zegt dat zelf. Vandaar
     dat de kaart hierboven op wijkniveau wordt opgevraagd. */
  /* Een buurt hoort onder een WIJK en niet onder een zone -- de hierarchie is
     stad, wijk, buurt, zone, straatsegment, en de route zegt dat zelf.

     En hij vraagt een VLAK: "Geef minstens een punt binnen de grenzen van RTG
     Stad." Dat vlak wordt hier gerekend uit de `grenzen` die diezelfde route
     teruggaf -- een klein vierkantje rond het middelpunt. Verzonnen
     coordinaten zouden bij de eerste verhuizing van de stad stil breken. */
  const gr = kaart && kaart.grenzen;
  const d0 = gr ? Math.min(gr.lat1 - gr.lat0, gr.lng1 - gr.lng0) / 20 : 0;
  const punten = (midden && gr) ? [
    { lat: midden.lat - d0, lng: midden.lng - d0 },
    { lat: midden.lat - d0, lng: midden.lng + d0 },
    { lat: midden.lat + d0, lng: midden.lng + d0 },
    { lat: midden.lat + d0, lng: midden.lng - d0 }
  ] : null;
  const g = await doe('een gebied', '/api/office/weefsel/gebied/maak',
    { niveau: 'buurt', gebiedNaam: 'Proefbuurt', ouder: zone && zone.id, punten });
  const gebied = g && g.gebied && g.gebied.id;
  if (gebied) { extra.gebied = gebied; extra.gebiedId = gebied; }

  /* 3. Een object op het middelpunt -- binnen de stad, want dat punt komt uit
        de kaart zelf. */
  const o = await doe('een stadsobject', '/api/office/weefsel/object/maak',
    { soort: 'pand', objectNaam: 'Proefpand',
      lat: midden && midden.lat, lng: midden && midden.lng,
      eigenaar: 'gemeente', beheerder: 'gemeente', bouwjaar: 1990, conditie: 3 });
  const object = o && o.object && o.object.id;
  if (object) { extra.object = object; extra.objectId = object; }

  /* 4. Een beleidsdoel, en het project dat eraan hangt. */
  const d = await doe('een beleidsdoel', '/api/office/weefsel/doel/maak',
    { doelNaam: 'Proefdoel', omschrijving: 'een doel om te kunnen meten',
      jaar: new Date().getFullYear(), indicator: 'proef' });
  const doel = d && d.doel && d.doel.id;
  if (doel) {
    extra.doel = doel; extra.doelId = doel;
    const pr = await doe('een project bij dat doel', '/api/office/weefsel/project/maak',
      { doelId: doel, projectNaam: 'Proefproject', omschrijving: 'proef',
        /* Klein genoeg om binnen het ambtelijk mandaat te vallen: daarboven
           vraagt de route een collegebesluit met kenmerk, en dat is een
           bevoegdheidsgrens en geen formulierveld. */
        budget: 1000, bedrag: 1000, jaar: new Date().getFullYear() });
    const project = pr && pr.project && pr.project.id;
    if (project) { extra.project = project; extra.projectId = project; }
  }

  /* 5. Een werkorder op dat object. */
  if (object) {
    const w = await doe('een werkorder', '/api/office/weefsel/werk/maak',
      { objectId: object, omschrijving: 'Proefwerk', soort: 'onderhoud', prioriteit: 'normaal' });
    const werk = w && w.werkorder && w.werkorder.id;
    if (werk) { extra.werk = werk; extra.werkId = werk; extra.werkorderId = werk; }
  }

  const geteld = Object.keys(extra).length;
  return { klaar: geteld > 2, extra, stappen,
    reden: geteld > 2 ? null : 'het weefsel leverde bijna niets op; zie stappen' };
}

module.exports = { zetWeefselKlaar };
