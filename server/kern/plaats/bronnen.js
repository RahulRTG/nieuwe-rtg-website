/* Plaatslaag, deel "bronnen": WAAR DE HEKKEN VANDAAN KOMEN.

   Afgesplitst van ./hekken.js toen dat over de leesgrens ging, en de naad is
   echt: daar staat WAT een hek is (de doelen, hun straal, wat er naar het
   toestel gaat), hier staat WAAR ze vandaan komen. Drie herkomsten:

     de plekken van kern/navigatie   leveranciers, haltes, loketten
     de gebieden van kern/stadsweefsel   de zones, met echte vlakgeometrie
     een geregistreerde BRON         een domein levert zijn eigen plaatsen

   Die derde is fase 2b van PLAATS.md en lost het volgende op: de posten van een
   beveiligingsteam, de depots van een dispatch en de werkorders van het weefsel
   zijn ook plaatsen waar aanwezigheid telt, maar ze staan in geen van de eerste
   twee. Zie de uitleg bij bronToevoegen() voor waarom ze niet worden gekopieerd
   en niet worden gelezen, maar geleverd. */
'use strict';

module.exports = ({ weefsel, navPoi, DOEL }) => {

  /* HET BRONNENREGISTER (PLAATS.md fase 2b).

     Het probleem dat dit oplost: de posten van een beveiligingsteam, de depots
     van een dispatch en de werkorders van het weefsel zijn óók plaatsen waar
     aanwezigheid telt, maar ze staan niet in de plekken van kern/navigatie. Er
     waren twee uitwegen en één ervan is fout.

     FOUT: de plaatslaag laten LEZEN in elk van die domeinen. Dan kent deze
     module de datavorm van vijf andere domeinen, en verandert hij mee met elk
     van de vijf.

     OOK FOUT: de hekken KOPIEREN naar db.data.plaatsHekken bij het aanmaken.
     Dan bestaat de plek twee keer -- eenmaal bij de eigenaar en eenmaal hier --
     en lopen ze uiteen zodra er een adres wijzigt. Precies wat geografie.js
     beschrijft.

     GOED, en het is het patroon dat dit huis al heeft (kern/geldgraaf/bronnen.js,
     kern/levensgraaf/bronnen.js): het domein dat de plek BEZIT levert hem, in
     dezelfde vorm, op het moment dat ernaar wordt gevraagd. Niets gekopieerd,
     niets gelezen over een grens heen, en één waarheid.

     DE HARDE REGEL VOOR EEN BRON: hij mag alleen plaatsen teruggeven die dit lid
     sowieso al mag zien. De hekkenlijst gaat naar het TOESTEL, dus een bron die
     de bezorgadressen van andermans bestellingen teruggeeft, lekt die adressen
     aan iedereen die de route aanroept. Vandaar dat een bron de codenaam krijgt:
     niet om te filteren als extraatje, maar omdat filteren zijn taak is. */
  const bronnen = [];
  function bronToevoegen(naam, doel, fn) {
    if (!DOEL[doel] || typeof fn !== 'function') return false;
    const i = bronnen.findIndex(b => b.naam === naam);
    const bron = { naam: String(naam), doel, fn };
    if (i >= 0) bronnen[i] = bron; else bronnen.push(bron);   // opnieuw zetten mag; twee keer dezelfde naam niet
    return true;
  }
  function vanBronnen(doel, codenaam, key) {
    const uit = [];
    for (const b of bronnen) {
      if (b.doel !== doel) continue;
      let rij;
      /* Een bron die stukloopt mag de rest niet meenemen. Zonder dit vangnet
         betekent één kapot domein dat een lid helemaal geen hekken meer krijgt,
         en dan lijkt de plaatslaag stuk terwijl er één bron hapert. */
      try { rij = b.fn(codenaam, key) || []; } catch (e) { continue; }
      for (const h of rij) {
        if (!h || !Array.isArray(h.punten) || !h.punten.length) continue;
        uit.push({ id: h.id, naam: h.naam || h.id, bron: b.naam,
          soort: h.soort === 'vlak' ? 'vlak' : 'punt',
          punten: h.punten.map(p => ({ lat: p.lat, lng: p.lng })),
          straalM: h.straalM != null ? h.straalM : DOEL[doel].straalM });
      }
    }
    return uit;
  }

  /* De plekken van de navigatiekern worden puntenhekken. We geven bewust GEEN
     positie mee aan navPoi: die zou hij gebruiken om te sorteren, en dan zou de
     server precies dat moeten weten wat hier niet hoort te komen. */
  function vanPlekken(lagen, straalM) {
    if (!lagen.length || typeof navPoi !== 'function') return [];
    let r;
    try { r = navPoi(lagen, null); } catch (e) { return []; }
    if (!r || r.status !== 200 || !r.lagen) return [];
    const uit = [];
    for (const laag of lagen) {
      for (const p of (r.lagen[laag] || [])) {
        if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
        /* Het id draagt de CODE als die er is, en anders de naam. Een zaak heeft
           een code die niet verandert; een halte of een loket heeft alleen een
           naam. Een hek-id dat meebeweegt met een hernoeming laat elke lopende
           waarneming in het niets wijzen -- en juist bij aanwezigheid op het
           werk is dat het verschil tussen "hij was er" en "onbekend". */
        uit.push({ id: laag + ':' + (p.code || p.naam), naam: p.naam, bron: 'navigatie',
          soort: 'punt', punten: [{ lat: p.lat, lng: p.lng }], straalM });
      }
    }
    return uit;
  }

  /* De zones uit de gebiedenboom worden vlakhekken. Een vlak heeft geen straal:
     je staat erin of niet, en dat is precies wat een zone hoort te betekenen.
     Werkt het weefsel niet (of is de boom nog niet gezaaid), dan leveren we geen
     zones in plaats van te doen alsof -- een hek dat niet bestaat mag niet als
     leeg gebied naar een toestel, want dan meldt dat toestel "buiten" over iets
     waar het nooit in kon zitten. */
  function vanWeefsel() {
    if (!weefsel || typeof weefsel.weefselGebieden !== 'function') return [];
    let r;
    try { r = weefsel.weefselGebieden({ niveau: 'zone' }); } catch (e) { return []; }
    if (!r || r.status !== 200 || !Array.isArray(r.gebieden)) return [];
    return r.gebieden
      .filter(g => g.geometrie && g.geometrie.soort === 'vlak' &&
        Array.isArray(g.geometrie.punten) && g.geometrie.punten.length >= 3)
      .map(g => ({ id: 'zone:' + g.id, naam: g.naam || g.id, bron: 'weefsel',
        soort: 'vlak', punten: g.geometrie.punten.map(p => ({ lat: p.lat, lng: p.lng })), straalM: 0 }));
  }

  return { bronToevoegen, vanBronnen, vanPlekken, vanWeefsel };
};
