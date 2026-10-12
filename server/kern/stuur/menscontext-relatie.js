/* WAT DE VRAAG MET HET AANGEWEZEN OBJECT TE MAKEN HEEFT -- een interpretatieregel,
   geen gezagsstap (EDGE.md par. 14.4).

   WAAROM DIT BESTAAT. De Context Bridge vertelt Rahul WAT er op het scherm staat.
   Daarmee werd het scherm te dominant: een lid met een Ibiza-aanvraag open dat
   zei "ik wil met zes vrienden vier dagen naar Rome", kreeg die vraag naar de
   stuurlus gestuurd met de Ibiza-aanvraag als onderwerp. De expliciete vraag
   bepaalt de taak; het scherm helpt alleen bij het lezen van woorden als
   "deze" of "die".

   VIER UITKOMSTEN, en ze verlenen niets:

     over        de vraag gaat over het aangewezen object ("hoe staat deze
                 aanvraag", "wanneer vertrek ik naar Ibiza")
     wijzig      de vraag wil het aangewezen object veranderen
     los         de vraag noemt het object niet en verwijst er niet naar --
                 een nieuwe taak, of iets heel anders. Het object blijft buiten
                 beeld en wordt NIET het onderwerp
     onduidelijk de vraag wijst naar het object EN noemt iets wat er niet bij
                 hoort ("kan deze reis ook naar Rome?"). Dan wordt er gevraagd
                 en niet geraden

   DOMEINVRIJ, EN DAT IS MET OPZET. Er staat hier geen bestemming en geen
   reiswoord: het object noemt zichzelf via zijn soort en de waarden van zijn
   beeld (./menscontext-opzoek.js). "Rome" is los omdat het niet in het beeld van
   de Ibiza-aanvraag staat, niet omdat dit bestand weet wat een stad is.

   AANWIJZEN IS NIET HETZELFDE ALS NOEMEN. De vaste woorden hieronder zijn de
   enige taal in dit bestand: wijswoorden ("deze", "die", "hier") en
   wijzigwerkwoorden. Ze zijn opsombaar omdat ze over de VORM van een verwijzing
   gaan en niet over een domein -- dezelfde scheiding als INTERACTIES in
   ./menscontext.js.

   BIJ TWIJFEL NOOIT "wijzig". Een vraag die een bestaand object kan veranderen
   is de duurste vergissing; die uitkomst vraagt een wijswoord of de naam van
   het object EN een wijzigwerkwoord. */
'use strict';
const { inhoudswoorden } = require('./resolver-woorden');

const WIJS = /\b(deze|dit|die|dat|hier|daar|hiervan|daarvan|ervan)\b/i;
const WIJZIG = /\b(wijzig\w*|verander\w*|aanpass\w*|pas\b.*\baan|verzet\w*|verplaats\w*|annuleer\w*|zeg\b.*\baf|intrek\w*|trek\b.*\bin|zet\b.*\b(later|eerder|om|terug))\b/i;
/* Een nieuwe taak die zichzelf zo noemt. Zonder wijswoord gaat zo'n vraag nooit
   over het aangewezen object, ook als hij de soort noemt ("een nieuwe reis"). */
const NIEUW = /\b(nieuwe?|andere|nog een|extra|tweede)\b/i;
/* De soortnaam is pas een verwijzing met een bepaald of bezittelijk woord
   ervoor: "mijn aanvraag" wel, "een reis naar Rome" niet. */
const BEPAALD = '(?:mijn|de|het|deze|die|dat|dit|onze|uw|je)';
/* Een eigennaam midden in de zin: een hoofdletter die niet aan het begin staat.
   Grof, en dat mag: hij beslist alleen tussen `over` en `onduidelijk`, en bij
   twijfel wordt er gevraagd. */
const EIGENNAAM = /[^.!?\s]\s+([A-Z][a-z\u00C0-\u017F]{2,})/g;

/* De waarden van het beeld als woorden: wat het object NOEMT. */
function woordenVanBeeld(beeld) {
  const uit = new Set();
  for (const v of Object.values(beeld.velden || {}))
    if (typeof v === 'string') for (const w of inhoudswoorden(v)) uit.add(w);
  /* En de NAMEN van de velden, het eerste woord van elk: "klopt de prijs?" gaat
     over het object met `prijsPerPersoon`. Alleen het eerste woord, want
     `persoon` uit die naam staat ook in "800 euro per persoon" van een nieuwe
     reis. */
  for (const k of Object.keys(beeld.velden || {})) {
    const eerste = String(k).split(/(?=[A-Z])/)[0].toLowerCase();
    if (eerste.length >= 4) uit.add(eerste);
  }
  return uit;
}

/* Noemt de vraag de SOORT met een bepaald woord ervoor? De soort `reisaanvraag`
   heet in een zin "aanvraag" of "reis": de stammen van een samenstelling tellen
   mee vanaf vier letters. */
function noemtSoort(q, soort) {
  const s = String(soort || '').toLowerCase(), stammen = new Set([s]);
  for (let i = 4; i <= s.length - 4; i++) { stammen.add(s.slice(0, i)); stammen.add(s.slice(i)); }
  return [...stammen].some((st) => new RegExp('\\b' + BEPAALD + '\\s+' + st + '\\b', 'i').test(q));
}

/* `vraag` is de tekst van de mens; `beelden` de CANONIEKE objecten van deze
   beurt (zonder kan er niets over een object gaan). Geeft { relatie, reden }. */
function relatieVan(vraag, beelden) {
  const lijst = (beelden || []).filter((b) => b && b.soort);
  const q = String(vraag || '');
  if (!lijst.length) return { relatie: 'los', reden: 'er is geen object aangewezen', object: null };
  /* Twee aangewezen objecten (het scherm en het concept in het gesprek): de vraag
     gaat over het object waarvan hij de SOORT noemt ("deze aanvraag" tegenover
     "deze reiswens"), en anders over het eerste -- het nieuwste. */
  const object = lijst.find((b) => noemtSoort(q, b.soort)) || lijst[0];
  return Object.assign(oordeel(q, lijst), { object });
}

function oordeel(q, lijst) {
  const woorden = inhoudswoorden(q);
  const vanObject = new Set();
  for (const b of lijst) for (const w of woordenVanBeeld(b)) vanObject.add(w);
  const genoemd = woorden.filter((w) => vanObject.has(w));
  const wijst = WIJS.test(q) || lijst.some((b) => noemtSoort(q, b.soort));
  if (!wijst && NIEUW.test(q)) return { relatie: 'los', reden: 'de vraag noemt zelf een nieuwe taak' };
  const vreemdeNamen = [...q.matchAll(EIGENNAAM)].map((m) => m[1].toLowerCase()).filter((n) => !vanObject.has(n));

  if (!wijst && !genoemd.length)
    return { relatie: 'los', reden: 'de vraag noemt het aangewezen object niet en verwijst er niet naar' };
  /* Noemt de vraag een ANDERE naam en wijst hij niet naar het object, dan is
     dat het onderwerp: "met 6 personen naar Rome" gaat niet over Ibiza, ook al
     deelt hij het woord `personen` met die aanvraag. */
  if (!wijst && vreemdeNamen.length)
    return { relatie: 'los', reden: 'de vraag noemt ' + vreemdeNamen.join(', ') + ' als onderwerp, niet het aangewezen object' };
  if (WIJZIG.test(q)) return { relatie: 'wijzig', reden: 'de vraag wil het aangewezen object veranderen' };
  if (vreemdeNamen.length && wijst)
    return { relatie: 'onduidelijk', reden: 'de vraag wijst naar het object en noemt ' + vreemdeNamen.join(', ') + ', dat er niet bij hoort' };
  return { relatie: 'over', reden: wijst ? 'de vraag verwijst naar het aangewezen object' : 'de vraag noemt het aangewezen object' };
}

module.exports = { relatieVan, WIJS, WIJZIG, RELATIES: Object.freeze(['over', 'wijzig', 'los', 'onduidelijk']) };
