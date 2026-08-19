/* Plaatslaag, deel "hekken": WAT HET TOESTEL MAG WETEN.

   Een hek is een gebied met een naam en een doel. Het belangrijkste aan dit
   bestand is wat het NIET is: het is geen lijst van personen. Een hek beschrijft
   een plaats -- een zaak, een halte, een loket, een zone -- en die lijst is niet
   gevoelig. Daarom mag hij naar het toestel, en daarom kan de hek-motor daar
   draaien in plaats van hier (PLAATS.md par. 1). Dat is de hele truc: het
   gevoelige gegeven is niet "waar ligt die zaak" maar "welk lid staat daar", en
   dat tweede gegeven verlaat het toestel nooit.

   DE HEKKEN WORDEN AFGELEID, NIET GETEKEND, en ze komen uit de twee waarheden
   die er al zijn:
     - de PLEKKEN van kern/navigatie (navPoi): leveranciers, haltes en loketten.
       Die lijst is daar al de enige waarheid over "waar zit wat", en een tweede
       lezing van db.data.suppliers hiernaast zou precies de tweede waarheid zijn
       die geografie.js beschrijft: "twee plekken die dezelfde waarheid
       vasthouden lopen uiteen".
     - de GEBIEDEN van kern/stadsweefsel: de zones, met echte vlakgeometrie.
   Alleen wat nergens anders bestaat (een eigen hek van een bedrijf om zijn
   terrein) staat in db.data.plaatsHekken.

   EEN GRENS DIE ER HOORT TE ZIJN, EN DIE OPVALT. De server kan de hekken niet
   op afstand tot jou sorteren, want daarvoor zou hij moeten weten waar je bent
   -- en dat is exact het gegeven dat hier niet komt. Hij stuurt dus een
   begrensde verzameling en het toestel kiest zelf welke ervan het nalopen waard
   zijn. Wat er buiten de grens viel staat als `afgekapt` in het antwoord: een
   stille afkapping zou lezen als "dit zijn ze allemaal".

   ELK HEK DRAAGT ZIJN DOEL, en het doel is een gesloten lijst. Dat is geen
   administratie maar de handhaving van grens 2 uit PLAATS.md: een waarneming
   gemaakt voor een dienstrooster mag geen radar, advertentie of aanbeveling
   voeden. Zonder doel op het hek is die grens een belofte; met doel is het een
   filter dat je kunt zien werken. */
'use strict';

/* De doelen, met per doel WELKE plekken een hek worden en HOE strak. Een nieuw
   doel erbij zetten is een bewuste handeling: het opent een nieuwe reden
   waarvoor een toestel iets over zijn plaats zegt.

   De stralen zijn bewust niet één getal. Aanwezigheid op het werk hoort strak
   te zijn (sta je binnen, of sta je op de stoep); nadering juist ruim, want een
   bericht dat komt als je al binnen staat heeft niemand iets aan. Het zijn
   beginwaarden en geen natuurkunde -- ze staan hier op één plek zodat ze te
   verstellen zijn zonder ze te moeten zoeken. */
const DOEL = {
  // aanwezigheid op het werk: prikklok, patrouille, dienstrooster
  dienst: { lagen: ['leverancier'], straalM: 120, zones: false },
  // vervoer en bezorging: ophalen, afzetten, aangekomen
  rit: { lagen: ['leverancier', 'ov'], straalM: 150, zones: false },
  // de wacht en het alarm van RTG Veilig: waar kun je terecht
  veiligheid: { lagen: ['civic'], straalM: 250, zones: false },
  // klaarzetten voordat iemand er is (mall, hotel, residentie)
  nadering: { lagen: ['leverancier', 'civic'], straalM: 900, zones: false },
  // melden en zien in de zone waar je bent (stadsweefsel)
  stad: { lagen: [], straalM: 0, zones: true }
};
const DOELEN = Object.keys(DOEL);
const MAX = 300;

module.exports = ({ db, weefsel, navPoi }) => {

  const eigen = () => { if (!Array.isArray(db.data.plaatsHekken)) db.data.plaatsHekken = []; return db.data.plaatsHekken; };

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

  /* De hekken voor één doel. Dit is wat het toestel ophaalt, en er staat dus
     bewust geen enkel persoonsgegeven in. */
  function hekkenVoor(doel) {
    const d = String(doel || '');
    const regel = DOEL[d];
    if (!regel) return { status: 400, error: 'Onbekend doel.' };
    const lijst = (regel.zones ? vanWeefsel() : [])
      .concat(vanPlekken(regel.lagen, regel.straalM))
      .concat(eigen().filter(h => h.doel === d))
      .map(h => ({ ...h, doel: d }));
    return { status: 200, doel: d, straalM: regel.straalM,
      hekken: lijst.slice(0, MAX), afgekapt: Math.max(0, lijst.length - MAX) };
  }

  /* Bestaat dit hek, en hoort het bij dit doel? De waarneemkant gebruikt dit om
     een verzonnen hek-id te weigeren. Zonder deze controle kan een toestel
     waarnemingen sturen over hekken die niemand kent, en dan staat er in het
     actielog een geschiedenis van iets dat nooit heeft bestaan. */
  function kentHek(doel, id) {
    const r = hekkenVoor(doel);
    return r.status === 200 && r.hekken.some(h => h.id === String(id || ''));
  }

  /* HET ID VAN EEN ZAAK, OP EEN PLEK. Elk domein dat wil weten of iemand op zijn
     werk staat, heeft dit id nodig; zou elk domein het zelf samenstellen, dan
     staat de vorm ervan op vijf plaatsen en verandert hij op vier. */
  const hekVoorZaak = (code) => 'leverancier:' + String(code || '');

  return { DOELEN, DOEL, hekkenVoor, kentHek, hekVoorZaak };
};
