/* ============================================================================
   ADAPTIEF RTG -- de persoonlijke laag, en waar hij ophoudt.

   WAT DEZE LAAG IS. Een mens vertelt RTG in een halve minuut genoeg om een
   eerste persoonlijke wereld te openen, en die wereld groeit daarna met hem
   mee. Drie bestanden dragen dat: ./ladder.js weet hoe hard iets is,
   ./bewaren.js bewaart wat er is verteld of opgemerkt, ./vraag.js beslist wat
   er nog gevraagd wordt. Dit bestand knoopt ze aan elkaar en is de enige plek
   waar ze samenkomen.

   WAT DEZE LAAG NIET IS, EN DAT IS DE HELFT VAN HET ONTWERP.

   Hij is geen tweede waarheid over een mens. NEIGINGVORM.json meting C legde de
   vijftien punten van het voorstel tegen de code, en alle vijftien hadden al
   bestaande code die ze draagt. De SITUATIE (welke reis, welke werkruimte) is
   van kern/experience/contexts.js. De PROJECTIE per wereld is van
   kern/experience/projections.js. De AANDACHT is van
   kern/experience/attention.js. De TERMIJNEN zijn van
   kern/levensgraaf/termijnen.js. De doorwerking naar een zaak is van
   kern/gastzorg-profiel.js.

   Wat nergens stond is wat een mens LEUK VINDT, met een grond eronder. Dat, en
   verder niets, is wat deze laag toevoegt. Hij projecteert niet, hij beslist
   niet wat er op een scherm komt, en hij schrijft in geen enkel ander domein.

   ------------------------------------------------------------------------
   DRIE GRENZEN DIE IN DIT BESTAND IN CODE STAAN EN NIET IN EEN BELOFTE

   1. DE INTAKE IS NOOIT VERPLICHT. Er is geen route die hem afdwingt en geen
      antwoord dat een andere functie opent of sluit. `overslaan()` bestaat, en
      wie hem nooit doet houdt exact het huis dat hij vandaag heeft. Dat is
      geen coulance: personalisatie die je moet ondergaan om normaal te kunnen
      werken, is geen personalisatie maar een tolpoort.

   2. DE UITKOMST VOEGT ALLEEN TOE. `opent()` geeft bestemmingen die opengaan.
      Er is geen functie die iets dichtdoet, en dat kan ook niet -- er is geen
      veld waarin dat zou passen. FOUNDATION.md par. 5: een motor als deze mag
      alleen TOEVOEGEN en nooit zeggen "dit is niets voor jou".

   3. HET LID KAN ALLES ZIEN EN WEGHALEN. `geheugen()` toont ook wat niet meer
      meetelt en wat is geweigerd, want een geheugenkaart die alleen het
      geldige toont, verzwijgt wat er is opgeslagen.

   ------------------------------------------------------------------------
   WAT ER MET OPZET NIET IS, MET DE REDEN ERBIJ

   - GEEN LEZER IN DE AI-CONTEXT. Neigingen gaan vandaag niet naar
     kern/ai/prompt.js. Dat is geen vergeetachtigheid maar AI-CONTEXT-01: die
     context wordt opgebouwd uit een POSITIEVE lijst velden (`LEDENVELDEN`,
     vandaag `trip` en `invoices`), en daar iets aan toevoegen is een besluit
     met een eigen toets (test/aicontext-allowlist.test.js) en niet een
     bijvangst van deze laag. Zodra dat besluit valt, is `neigingen(key,
     'helpen')` de weg -- met een doel, en niet met een spread.

   - GEEN WEGING VAN DE PROJECTIE. Deze laag bepaalt niet in welke volgorde
     kaarten op een scherm staan. Dat zou betekenen dat een tweede laag gaat
     beslissen wat kern/experience/projections.js al levert, en dan zeggen er
     twee schermen op een dag iets anders over hetzelfde (BESTUUR.md).

   - GEEN GROEPSUITKOMST. Het voorstel vraagt om "Onze RTG": vier gezinsleden,
     een gezamenlijke keuze, zonder elkaars voorkeuren te tonen. De onderbouw
     ligt er (kern/levensband/inzage.js weet per STUK wat een band mag zien),
     maar de rekensom zelf is er niet -- en hij is niet te maken zonder een
     besluit over wat een deelnemer van de uitslag mag afleiden. Vier mensen en
     een uitkomst "1 persoon heeft een dieetwens" is een profieluitdraai met
     een omweg. Dat staat in NEIGING.md als open besluit en hier als
     afwezigheid, niet als lege functie. */
'use strict';

module.exports = function maakNeigingLaag({ db, save, crypto, nu }) {
  const neiging = require('./bewaren')({ db, save, crypto, nu });
  const vraag = require('./vraag');
  const ladder = require('./ladder');

  /* De onderwerpen die dit lid draagt en die nog meetellen. De vraagmotor krijgt
     hier ALLEEN een lijst woorden -- geen sleutel, geen account, geen graden.
     Daardoor kan hij structureel niets over een mens weten, en dat is een
     eigenschap van de handtekening en niet van de discipline van de aanroeper
     (dezelfde vorm als `vondsten(voorwaarde)` in kern/knelpunt/aanvoer.js). */
  function onderwerpenVan(key) {
    const r = neiging.neigingen(key, 'tonen');
    return (r.neigingen || []).map(n => n.onderwerp);
  }

  /* DE INTAKE. Geeft de volgendeVraag vraag, of `klaar` met wat er is opengegaan.
     Er zit geen teller in en geen "stap 2 van 5": het aantal vragen hangt af
     van de antwoorden, en een voortgangsbalk die dat suggereert liegt. */
  function intake(key) {
    neiging.veeg(key);
    const onderwerpen = onderwerpenVan(key);
    const gesteld = neiging.gesteld(key);
    const v = vraag.volgendeVraag(onderwerpen, gesteld);
    if (!v) return { ok: true, klaar: true, vraag: null, opent: vraag.opent(onderwerpen),
      waarom: 'Er is geen vraag meer die iets nieuws opendoet.' };
    return { ok: true, klaar: false, vraag: v, opent: vraag.opent(onderwerpen) };
  }

  /* EEN ANTWOORD. Alles wat een lid hier aantikt, is GEZEGD -- de sterkste
     grond, want hij heeft het zelf gekozen. De vraag wordt genoteerd als
     gesteld, ook als er niets is aangevinkt: niet kiezen is ook een antwoord,
     en zonder dat komt dezelfde vraag terug tot het lid iets aanklikt. */
  function antwoord(key, vraagId, onderwerpen) {
    const v = vraag.VRAGEN.find(x => x.id === vraagId);
    if (!v) return { status: 400, error: 'Die vraag ken ik niet.' };
    const geldig = new Set(v.opties.map(o => o.onderwerp));
    const gekozen = (Array.isArray(onderwerpen) ? onderwerpen : []).filter(o => geldig.has(o));
    /* Een onderwerp dat niet bij deze vraag hoort, wordt WEGGELATEN en niet
       stil bewaard: anders is dit endpoint een vrije schrijfweg naar het
       geheugen van een lid, en dan bepaalt de client wat RTG "weet". */
    for (const o of gekozen) neiging.bewaarNeiging(key, { onderwerp: o, grond: 'gezegd', doel: ['tonen', 'helpen'] });
    neiging.noteerGesteld(key, vraagId);
    return Object.assign({ ok: true, opgeslagen: gekozen.length,
      genegeerd: (Array.isArray(onderwerpen) ? onderwerpen.length : 0) - gekozen.length }, intake(key));
  }

  /* DE INTAKE OVERSLAAN. Bestaat, en doet precies niets behalve de vragen
     wegzetten. Zie grens 1 in de kop. */
  function overslaan(key) {
    for (const v of vraag.VRAGEN) neiging.noteerGesteld(key, v.id);
    return { ok: true, klaar: true, waarom: 'Overgeslagen. Je kunt dit later alsnog doen.' };
  }
  const opnieuw = key => Object.assign(neiging.opnieuw(key), intake(key));

  /* IETS OPMERKEN UIT GEDRAG. Dit is de progressive-profiling kant: geen vraag,
     maar een waarneming. De grond is nooit `gezegd` -- dat woord is voor wat
     het lid zelf heeft aangetikt, en een aanroeper die gedrag als een uitspraak
     boekt, maakt van een vermoeden een bewijs. */
  function merkOp(key, onderwerp, grond) {
    const g = grond === 'gekozen' || grond === 'afgeleid' ? grond : 'afgeleid';
    return neiging.bewaarNeiging(key, { onderwerp, grond: g, doel: ['tonen'] });
  }

  /* De geheugenkaart woont in ./geheugen.js: een andere vraag, een andere
     lezer, en samen gingen ze over de omvangsgrens. */
  const { geheugen } = require('./geheugen')({ neiging });

  /* EEN NAAM OP DE KERN EN NIET ELF, en dat is dezelfde vorm als
     kern/socialewereld.js en kern/geldwereld.js: `kern.neiging.intake(...)`.

     Het scheelde meer dan netheid. scripts/norm.js ratelt op `kernBreedte` --
     kern-eigenschappen die routes aanraken -- en elf losse namen duwden die
     meter met zeven omhoog voor een laag met zeven routes. Een laag die zijn
     eigen deurtje per functie op de kern legt, laat die meter groeien met het
     aantal FUNCTIES in plaats van met het aantal LAGEN, en dan meet hij niets
     meer.

     De vier onderaan staan met opzet NIET in GRENZEN.json: geen enkel domein
     mag er vandaag bij. `lees` is de weg voor een toekomstige lezer (altijd MET
     een doel), `merkOp` de progressive-profiling kant die nog geen aanroeper
     heeft, en `controle` en `ladder` zijn er voor toetsen en meters. Leeg is
     dicht: wie ze nodig heeft, zet ze bewust op de lijst van zijn domein. */
  return {
    neiging: {
      intake, antwoord, overslaan, opnieuw, geheugen,
      vergeet: (key, id) => neiging.vergeetNeiging(key, id),
      nietVoor: (key, id, doel) => neiging.nietVoor(key, id, doel),
      /* Voor lezers binnen het huis. Altijd MET een doel -- zie ./bewaren.js. */
      lees: (key, doel, opties) => neiging.neigingen(key, doel, opties),
      merkOp,
      controle: () => vraag.controle(),
      ladder
    }
  };
};
