/* De grens. Dit bestand bestaat vóór er iets is om mee te praten, en dat is
   met opzet: het veiligheidsmodel hoort in de architectuur en niet in een
   latere ronde (docs/life.md).

   DRIE NIVEAUS, en RTG weet altijd in welke het staat.

   1. lifestyle   -- ritme, rust, structuur, gewoonten. Hier mag RTG meedenken.
   2. professioneel -- iets waar een mens bij hoort: een coach, een huisarts,
                     een behandelaar. RTG mag helpen de weg te vinden, niet de
                     inhoud te geven.
   3. klinisch    -- crisis, zelfbeschadiging, medicatie, diagnose. Hier houdt
                     RTG op. Geen advies, geen "even samen kijken", geen
                     geruststelling: alleen de weg naar echte hulp.

   DE GRENS IS CODE EN GEEN PROMPT. Wat hier wordt aangewezen, kan door geen
   enkel model worden weggepraat: de aanroeper krijgt `mag: false` terug en er
   valt niets te overrulen. Een taalmodel dat zijn eigen veiligheidsregel mag
   uitleggen, is geen veiligheidsregel.

   EN DIT IS EEN VLOER, GEEN FILTER. Wat hier doorheen komt is NIET
   "veilig bevonden" -- het is alleen niet herkend. Een woordenlijst mist
   omschrijvingen, understatement, ironie en elke taal die er niet in staat.
   Daarom staat er bij twijfel altijd een uitweg naar een mens op het scherm,
   ook als er niets is aangewezen. Wie dit ooit als een filter gaat gebruiken
   ("het is niet aangeslagen, dus het mag"), gebruikt hem verkeerd. */

/* De signalen. Bewust kort en bewust breed: liever een keer te veel naar een
   mens verwijzen dan een keer te weinig. Een valse treffer kost een zin die
   iemand kan wegklikken; een gemiste treffer kost iets anders. */
const KLINISCH = [
  /\bzelfmoord|suicide|suïcide\b/i,
  /\b(niet|nie)\s+meer\s+(leven|verder|willen\s+leven)\b/i,
  /\been\s+eind\s+(aan|maken)\b.{0,20}\b(leven|alles)\b/i,
  /\bmezelf?\s+(iets\s+aan\s*doen|pijn\s+doen|snijden|beschadigen)\b/i,
  /\bik\s+wil\s+dood\b/i,
  /\bhet\s+hoeft\s+niet\s+meer\b/i,
  /\bgeen\s+reden\s+om\s+(door|verder)\s+te\s+gaan\b/i
];

const MEDISCH = [
  /\b(dosis|dosering|mg\b|milligram|innemen|afbouwen|ophogen)\b/i,
  /\b(antidepressiva|medicatie|medicijn(en)?|pillen)\b/i,
  /\b(diagnose|stoornis|is\s+dit\s+.{0,15}\b(depressie|burn-?out|adhd|autisme)\b)/i,
  /\b(zwanger|zwangerschap)\b/i
];

/* Zwaar gemoed dat aanhoudt is geen crisis en geen diagnose, maar wel een
   reden om een mens te noemen. Dit is een TELLING en geen oordeel over de
   persoon: hij zegt alleen dat het al even zo gaat. */
const ZWAAR = ['zwaar', 'leeg', 'angstig'];
const ZWAAR_DAGEN = 5;

const HULP = {
  kop: 'Dit is te groot voor een app',
  tekst: 'RTG is geen hulpverlener en doet hier niet alsof. Praat met iemand die dit wel kan.',
  wegen: [
    { naam: '113 Zelfmoordpreventie', hoe: 'Bel 0800-0113 (gratis, dag en nacht) of chat via 113.nl' },
    { naam: 'Uw huisarts', hoe: 'Ook buiten kantooruren, via de huisartsenpost' },
    { naam: 'Direct gevaar', hoe: 'Bel 112' }
  ]
};

/* Het oordeel over een stuk vrije tekst. Levert altijd alle drie de velden op:
   het niveau, of RTG hier iets mag zeggen, en wat er in plaats daarvan hoort te
   gebeuren. */
function niveauVan(tekstIn) {
  const t = String(tekstIn || '');
  if (KLINISCH.some(r => r.test(t))) {
    return { niveau: 'klinisch', mag: false, reden: 'crisis',
      escalatie: HULP,
      uitleg: 'RTG geeft hier geen advies en geen geruststelling. Alleen de weg naar hulp.' };
  }
  if (MEDISCH.some(r => r.test(t))) {
    return { niveau: 'klinisch', mag: false, reden: 'medisch',
      escalatie: {
        kop: 'Hier hoort een behandelaar bij',
        tekst: 'Over medicatie, dosering en diagnose zegt RTG niets. Dat is werk voor iemand die u kent.',
        wegen: [
          { naam: 'Uw huisarts of behandelaar', hoe: 'Zij kennen uw dossier en uw medicatie' },
          { naam: 'Uw apotheek', hoe: 'Voor vragen over innemen en bijwerkingen' }
        ]
      },
      uitleg: 'Een taalmodel hoort niet over medicatie te gaan, ook niet voorzichtig.' };
  }
  return { niveau: 'lifestyle', mag: true, reden: null, escalatie: null,
    uitleg: 'RTG mag hier meedenken over ritme, rust en structuur.' };
}

/* Aanhoudend zwaar: geen crisis, wel een reden om een mens te noemen. Krijgt de
   recente check-ins (nieuwste eerst) en telt hoeveel er op rij zwaar zijn. */
function aanhoudendZwaar(checkins) {
  let op_rij = 0;
  for (const c of checkins || []) {
    if (!ZWAAR.includes(c.stemming)) break;
    op_rij++;
  }
  if (op_rij < ZWAAR_DAGEN) return null;
  return {
    niveau: 'professioneel', dagen: op_rij,
    kop: 'Het gaat al ' + op_rij + ' dagen zwaar',
    tekst: 'Dat is lang genoeg om er iemand bij te halen. Niet omdat het RTG te veel wordt, '
      + 'maar omdat een mens hier meer kan dan een scherm.',
    wegen: [
      { naam: 'Uw huisarts', hoe: 'De gewone eerste stap; die kent de weg verder' },
      { naam: 'Iemand uit uw kring', hoe: 'Praten helpt ook als er niets opgelost wordt' }
    ]
  };
}

module.exports = { niveauVan, aanhoudendZwaar, HULP, ZWAAR, ZWAAR_DAGEN, KLINISCH, MEDISCH };
