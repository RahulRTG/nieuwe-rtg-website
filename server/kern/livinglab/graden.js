/* RTF Living Lab, deel "graden": puur rekenwerk. Wat mag een conclusie dragen,
   en waarom niet meer?

   Dit bestand raakt geen opslag aan en heeft geen context nodig -- het krijgt
   een studie en een conclusie mee en geeft een graad terug. Dat is met opzet:
   het is de scherpste regel van het hele Living Lab, en een regel die je zonder
   database kunt uitrekenen, kun je ook zonder database TOETSEN.

   DRIE PLAFONDS, EN HET LAAGSTE WINT:

   1. WAT ER LIGT (plafondBewijs). Hoe meer dragers EN hoe meer verschillende
      SOORTEN dragers, hoe hoger een conclusie kan reiken. Beide tellen mee, want
      acht observaties van dezelfde middag zijn één soort bewijs dat acht keer is
      opgeschreven -- die horen niet hoger te komen dan drie waarnemingen uit
      drie verschillende hoeken.
   2. WAT DE METHODE KAN DRAGEN (plafondPlan). Acht interviews blijven acht
      interviews, ook met tien citaten. Alleen een vergelijkende opzet (A/B-test,
      veldexperiment) kan "bewezen" dragen; dat staat in ./kader.js bij de
      methoden en wordt door ./plan.js in het plan vastgelegd. Zonder plan is het
      plafond `waarneming`: wie nog geen opzet heeft, heeft geen vergelijking.
   3. WIE HET TEKENT (graadZonderMens). De graden `sterk` en `bewezen` dragen
      `mens: true` en bestaan alleen met een handtekening. Bij een MENSELIJK
      onderwerp -- welzijn, gedrag, cohesie, onderwijs -- ligt die grens een
      trede lager: daar vraagt alles boven "waarneming" al een professionele
      handtekening. Dat is de opdracht "bij mentale en sociale onderwerpen weegt
      het menselijke oordeel zwaarder" als rekenregel.

   Het derde plafond vervalt zodra er een handtekening onder staat -- dat is
   precies wat een handtekening doet. De eerste twee vervallen NOOIT: zou een
   handtekening ook die opheffen, dan kon een professional met één krabbel
   "bewezen" schrijven onder nul bewijs. */
'use strict';

const kader = require('./kader');

const plafondPlan = s => kader.graad(s.dossier.plan.hoogstBewijs || 'waarneming') || kader.graad('waarneming');
const menselijkOnderwerp = s => { const so = kader.soort(s.soort); return !!so && so.menselijk; };
// de hoogste graad die zonder handtekening bereikbaar is
const graadZonderMens = s => (menselijkOnderwerp(s) ? kader.graad('waarneming') : kader.graad('indicatie'));

function plafondBewijs(c) {
  const n = (c.bewijs || []).length;
  const soorten = new Set((c.bewijs || []).map(w => w.soort)).size;
  if (!n) return kader.graad('aanname');
  if (n >= 8 && soorten >= 4) return kader.graad('bewezen');
  if (n >= 5 && soorten >= 3) return kader.graad('sterk');
  if (n >= 3 && soorten >= 2) return kader.graad('indicatie');
  return kader.graad('waarneming');
}

/* De reden gaat mee terug, want "dit mag niet" zonder reden leert een
   onderzoeker niets -- en dan gaat hij gokken in plaats van bewijs zoeken. */
function plafond(s, c) {
  const kandidaten = [
    { g: plafondBewijs(c), reden: 'wat er aan bewijs onder ligt' },
    { g: plafondPlan(s), reden: 'wat de gekozen methoden kunnen dragen' }
  ];
  if (!c.tekenaar) kandidaten.push({ g: graadZonderMens(s),
    reden: menselijkOnderwerp(s)
      ? 'dit een menselijk onderwerp is: hoger vraagt de handtekening van een professional'
      : 'hoger dan een indicatie een menselijk oordeel vraagt' });
  const laagste = kandidaten.reduce((a, b) => (b.g.rang < a.g.rang ? b : a));
  return { graad: laagste.g, reden: laagste.reden };
}

/* Vraagt deze graad een handtekening? Twee gevallen, en het tweede is de reden
   dat dit een eigen functie is: `sterk` en `bewezen` vragen hem altijd, maar bij
   een menselijk onderwerp vraagt ook `indicatie` er al een. */
const handtekeningNodig = (s, doel) => doel.mens || doel.rang > graadZonderMens(s).rang;

module.exports = { plafond, plafondBewijs, plafondPlan, graadZonderMens, menselijkOnderwerp, handtekeningNodig };
