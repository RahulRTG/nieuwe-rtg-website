/* Spellen (deelmodule): VARIANTEN -- wat er aan een spel te kiezen valt.

   Een variant PARAMETRISEERT de regels; hij vervangt ze niet. Quizduel met
   schoolvragen is hetzelfde spel met dezelfde motor: dezelfde beurten, dezelfde
   winnaarsbepaling, dezelfde poorten. Wat verschilt is waar de vragen vandaan
   komen. Vier quiz-apps bouwen zou vier keer dezelfde fouten opleveren, en dat
   is de reden dat dit een veld op het potje is en geen tweede spel.

   ELKE KEUZE IS EEN GESLOTEN LIJST, en dat is de belangrijkste beperking hier.
   Een vrij tekstveld is binnen een maand een verzameling spelfouten -- dezelfde
   reden waarom `CONTEXTEN` in ./beleid.js een lijst is en waarom kern/comm
   twaalf gesprekssoorten kent en geen vrije soort. Het levert bovendien iets op
   wat een open veld niet kan: de lobby kan de keuzes UITTEKENEN, want ze staan
   in de descriptor en reizen mee in `SPEL`.

   EEN VERKEERDE VARIANT IS EEN 400 EN GEEN STILLE TERUGVAL. Wie als docent
   'groep 6, rekenen' kiest en door een tikfout algemene kennis krijgt, merkt
   dat pas als de klas de eerste vraag ziet. Terugvallen op de standaard is
   daar de duurste vorm van behulpzaamheid; weigeren is eerlijk.

   TWEE LAGEN, want de vragen zijn van twee soorten:

   1. PER VELD -- staat deze waarde in de lijst van dit veld? Dat is generiek en
      staat hier.
   2. OVER DE VELDEN HEEN -- 'groep' hoort bij 'bron: school' en nergens anders.
      Dat is een SPELREGEL en hoort dus in het spel: een descriptor mag een
      `variantFout(variant)` meegeven die een zin teruggeeft of niets. Deze
      module roept hem aan en bedenkt er niets bij.

   WAT ER (NOG) NIET IS: `GAMEHALL.md` paragraaf 22 zegt dat een variant nooit
   ranked mag zijn -- een officiele uitslag hoort bij vaste regels. Die laag
   bestaat nog niet, dus die regel is hier nog niet af te dwingen. Hij staat als
   open punt en niet als stilzwijgende belofte. */

/* De descriptorkant: wat een spel over zijn eigen varianten mag zeggen.
   `fout` komt van de keuring mee zodat de melding dezelfde vorm heeft als elke
   andere descriptorfout -- met het BESTAND erin, want "welke had ik ook alweer"
   is precies het zoeken dat het register opheft. */
function keurVarianten(naam, s, fout) {
  const v = s.varianten;
  if (s.variantFout !== undefined && typeof s.variantFout !== 'function')
    fout(naam, 'heeft een `variantFout` die geen functie is.');
  if (v === undefined) {
    if (s.variantFout) fout(naam, 'heeft een `variantFout` zonder `varianten`; er valt niets te keuren.');
    return null;
  }
  if (!v || typeof v !== 'object' || !Object.keys(v).length)
    fout(naam, 'heeft een `varianten` die geen niet-leeg object is. Laat hem weg als er niets te kiezen valt.');

  const velden = {}, standaarden = {};
  for (const [veld, def] of Object.entries(v)) {
    if (!/^[a-z][a-z0-9]{1,15}$/.test(veld))
      fout(naam, `heeft variantveld '${veld}'; alleen kleine letters en cijfers, 2 tot 16 tekens.`);
    if (!def || !Array.isArray(def.keuze) || !def.keuze.length)
      fout(naam, `heeft variantveld '${veld}' zonder een niet-lege \`keuze\`. Een variant is een gesloten lijst.`);
    if (def.keuze.some(k => typeof k !== 'string' || !k))
      fout(naam, `heeft variantveld '${veld}' met een keuze die geen tekst is.`);
    if (!('standaard' in def))
      fout(naam, `heeft variantveld '${veld}' zonder \`standaard\`. Zet hem op null als het veld leeg mag blijven.`);
    if (def.standaard !== null && !def.keuze.includes(def.standaard))
      fout(naam, `heeft variantveld '${veld}' met een standaard die niet in zijn eigen keuze staat.`);
    velden[veld] = def.keuze.slice();
    standaarden[veld] = def.standaard;
  }
  return { velden, standaarden, fout: s.variantFout || null };
}

/* De verzoekkant: wat een aanvrager mag kiezen. Geeft `{ variant }` terug of
   een weigering met een reden die de speler iets zegt.

   Een spel ZONDER varianten krijgt geen variant, ook niet als er een wordt
   meegestuurd -- stil laten vallen zou betekenen dat een client denkt iets te
   hebben gekozen. */
function kiesVariant(def, gevraagd) {
  const g = (gevraagd && typeof gevraagd === 'object' && !Array.isArray(gevraagd)) ? gevraagd : {};
  if (!def) {
    if (Object.keys(g).length) return { status: 400, error: 'Bij dit spel valt er niets te kiezen.' };
    return { variant: null };
  }
  const onbekend = Object.keys(g).filter(k => !def.velden[k]);
  if (onbekend.length) return { status: 400, error: 'Onbekende keuze: ' + onbekend.join(', ') + '.' };

  const variant = {};
  for (const [veld, keuzes] of Object.entries(def.velden)) {
    const w = g[veld] === undefined || g[veld] === null || g[veld] === '' ? def.standaarden[veld] : String(g[veld]);
    if (w === null) { variant[veld] = null; continue; }
    if (!keuzes.includes(w))
      return { status: 400, error: `'${veld}' kan hier niet op '${String(w).slice(0, 40)}' staan.` };
    variant[veld] = w;
  }
  // de vraag over de velden HEEN, en die stelt het spel zelf
  const zin = def.fout ? def.fout(variant) : null;
  if (zin) return { status: 400, error: zin };
  return { variant };
}

module.exports = { keurVarianten, kiesVariant };
