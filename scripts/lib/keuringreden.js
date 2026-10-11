'use strict';
/* ============================================================================
   DE REDEN VAN EEN KEURING (ARCHITECTOPDRACHT.md fase 6)

   scripts/plan.js kiest al hoe zwaar er gekeurd wordt: semdiff.js geeft per
   bestand een ondergrens uit de VORM, risico.js geeft het zwaarste GEBIED dat
   de wijziging kan bereiken, en de zwaarste van de twee wint. Wat ontbrak, was
   WELKE regels er afgingen. In de samenvatting stond een code en een zin; wie
   wilde weten waarom een wijziging in kern/pay zwaar werd gekeurd, moest de
   code lezen.

   Dit bestand beslist niets. Het schrijft uit wat plan.js al besloot, als een
   lijst afgegane regels. Per regel:

     wet       het ID uit WETTEN.json, of null met de bron als er geen wet is
     regel     welke regel het was (vorm, graaf, onvolledig, cosmetisch, modus)
     gemeten   wat er gemeten werd, als getallen en namen
     graad     de graad van die meting (BESTUUR.md, geen vijfde):
                 vermoed   woordpatronen op gewijzigde coderegels; semdiff.js zegt
                           zelf "de vorm liegt", het is een ondergrens
                 gemeten   de importgraaf, de soort uit het pad, of een regel die
                           per regel zeker is
                 onbekend  er ontbreekt een meting, en dan wint de strengste
     klasse    de klasse die deze regel afdwingt

   DE MAX-REGEL staat in de code die besluit (semdiff.zwaarste, risico.hogerst)
   en niet hier. Dit bestand rekent hem na: de klasse van de keuring is de
   strengste van de afgegane regels, behalve als de cosmetische kortsluiting
   afging, en die is dan zelf een afgegane regel met de graad gemeten.

   GEEN LABEL. Er komt geen LOW, HIGH of CRITICAL bij. De uitvoer is de lijst
   regels plus de getallen van het bereik; het huis heeft genoeg schalen.
   ========================================================================== */
const { GEWICHT, zwaarste } = require('./semdiff');
const { GEBIED_KLASSE } = require('./risico');

const WET_MAX = 'keuring-zwaarste-regel-wint';
const WET_ONTBREEKT = 'keuring-ontbrekende-meting-is-streng';

/* Welke besluitcodes van modusbesluit() uit een ontbrekend gegeven komen. Die
   vallen onder de tweede wet: geen gegeven is de strengste keuring. */
const ONTBREKEND = new Set(['impact-onvolledig', 'alle-bewijzen-onbekend',
  'geen-vertrouwd-bewijsboek', 'bewijsboek-ongeldig', 'geen-geldig-hergebruik']);

function telPerGebied(gebieden) {
  if (!gebieden) return {};
  return Object.fromEntries([...(gebieden instanceof Map ? gebieden : new Map(Object.entries(gebieden)))].sort());
}

/* `p` is de uitkomst van plan() (niet geserialiseerd: hij draagt de Map's). */
function redenen(p) {
  const regels = [];
  for (const b of (p.wijziging && p.wijziging.bestanden) || []) {
    /* Een klasse uit het PAD (besturing, document, gegevens) is een meting; een
       klasse uit woordpatronen op coderegels is een vermoeden -- semdiff.js
       noemt dat zelf een ondergrens, want "de vorm liegt". */
    regels.push({ wet: WET_MAX, regel: 'vorm', klasse: b.klasse, graad: b.soort === 'code' ? 'vermoed' : 'gemeten',
      gemeten: { pad: b.pad, soort: b.soort || null, regels: b.regels || 0, patronen: b.redenen || [] } });
  }
  const o = p.oordeel || {};
  const impact = p.impact || {};
  if (impact.volledig === false) {
    regels.push({ wet: WET_ONTBREEKT, regel: 'impact-onvolledig', klasse: 'security', graad: 'onbekend',
      gemeten: { buitenDeIndex: (impact.onvolledig || []).length, paden: (impact.onvolledig || []).slice(0, 5).map((x) => x.pad) } });
  } else {
    regels.push({ wet: WET_MAX, regel: 'graaf', klasse: GEBIED_KLASSE[impact.gebied] || 'implementation', graad: 'gemeten',
      gemeten: { gebied: impact.gebied || null, perGebied: telPerGebied(impact.gebieden), geraakt: impact.telling || null } });
    if (o.klasse === 'cosmetic' && (p.wijziging && p.wijziging.bestanden || []).length) {
      regels.push({ wet: WET_MAX, regel: 'cosmetisch', klasse: 'cosmetic', graad: 'gemeten',
        gemeten: { reden: 'elke gewijzigde regel is witruimte of commentaar; dat is per regel zeker (risico.klasseVan)' } });
    }
  }
  const besluit = p.besluit || {};
  regels.push({ wet: ONTBREKEND.has(besluit.code) ? WET_ONTBREEKT : null,
    ...(ONTBREKEND.has(besluit.code) ? {} : { bron: 'scripts/plan.js modusbesluit()' }),
    regel: 'modus', klasse: null, graad: ONTBREKEND.has(besluit.code) ? 'onbekend' : 'gemeten',
    gemeten: { modus: p.mode, code: besluit.code || null, reden: besluit.reden || null, telling: p.telling || null } });

  return {
    klasse: o.klasse || null,
    regels,
    klopt: klopt(o.klasse, regels),
    bereik: {
      gewijzigd: (p.gewijzigd || []).length,
      geraakt: impact.telling || null,
      bestandenPerGebied: telPerGebied(impact.gebieden),
      nietGemeten: {
        symbolen: 'deze poort leest de importgraaf en niet SYMBOLEN.json',
        routes: 'deze poort kent bestanden en geen routes; zie ROUTEBRON.json',
        schermen: 'deze poort kent bestanden en geen schermen; zie SCHERMROUTES.json',
      },
    },
  };
}

/* De nareken: is de gekozen klasse de strengste van de afgegane regels? */
function klopt(klasse, regels) {
  const met = regels.filter((r) => r.klasse);
  if (!met.length) return { ja: klasse == null, strengste: null };
  if (met.some((r) => r.regel === 'cosmetisch')) return { ja: klasse === 'cosmetic', strengste: 'cosmetic', via: 'cosmetisch' };
  const strengste = met.map((r) => r.klasse).reduce((a, b) => zwaarste(a, b));
  return { ja: strengste === klasse, strengste };
}

module.exports = { redenen, klopt, WET_MAX, WET_ONTBREEKT, ONTBREKEND, GEWICHT };
