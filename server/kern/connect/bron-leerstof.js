/* ============================================================================
   DE EERSTE BRON -- leerstof, voor twee motoren tegelijk.

   kern/leerstof.js draagt 166 leerdoelen over 26 vakken, elk met een naam, een
   les en een uitleg. Deze bron maakt er ontdekkingen van, en hij voedt twee
   motoren van ./mixer.js die het TEGENOVERGESTELDE doen:

     interesse     vakken waarvan de mens zelf zei dat hij ze wil zien
     nieuwsgierig  een vak waar hij NOOIT om heeft gevraagd, bereikt via een
                   vraag uit ./bruggen.js

   Dat die twee uit dezelfde bron komen is geen bezuiniging maar de proef: als
   dezelfde rijen twee motoren met tegengestelde opdracht kunnen voeden, zit het
   verschil in de MOTOR en niet in de data -- precies wat een mixer moet zijn.

   DE TITEL VAN EEN BRUG IS DE VRAAG EN NIET HET VAK. "Natuurkunde, groep 7"
   opent niemand; "waarom krult een bal als je hem van opzij raakt?" wel. Het
   vak staat er als onderwerp onder, zodat de mens ziet waar hij terechtkomt --
   een vraag die verzwijgt dat het natuurkunde is, is een lokkertje.

   GEEN WILLEKEUR, WEL VERANDERING. De keuze verschuift per DAG en niet per
   verzoek: dezelfde mens die twee keer ververst, ziet hetzelfde. Een lijst die
   bij elke aanraking verandert, is een gokkast -- en hij is bovendien niet na
   te rekenen, wat elke toets hierover waardeloos maakt. De verschuiving is een
   rotatie op het dagnummer, dus morgen staat er iets anders zonder dat er iets
   is bewaard over wat iemand gisteren zag.

   WAT DEZE BRON NIET WEET, en dat is met opzet: wie de mens is. Hij krijgt een
   lijst ONDERWERPEN met een gewicht en verder niets -- geen leeftijd, geen
   groep, geen schoolniveau. Daardoor kan hij niet filteren op geschiktheid, en
   dat is de regel van FOUNDATION.md par. 5 in de vorm van een handtekening in
   plaats van een afspraak. Het gevolg is dat een volwassene een doel uit groep
   4 kan tegenkomen; dat is eerlijker dan een laag die zelf bepaalt wat te
   kinderachtig voor iemand is.
   ========================================================================== */
'use strict';

const bruggen = require('./bruggen');
const ontdekking = require('./ontdekking');

/* Het pad naar het leerscherm. Een PAD, nooit een handeling -- de mens gaat
   er zelf heen en deze laag start geen les (kern/connect/ontdekking.js). */
const INGANG = '/apps/rtgschool.html';
const HERKOMST = 'leerstof';

/* Hoeveel een motor per keer aanbiedt. Ruim onder de twaalf plekken van de
   mixer, zodat een bron nooit in zijn eentje de hele lijst vult: dan zou de
   verdeling van de mixer een formaliteit zijn. */
const PER_MOTOR = 4;

/* Het dagnummer. Niet de klok maar de DATUM, zodat alles binnen een dag
   hetzelfde blijft en de uitkomst na te rekenen is. */
const dagNr = (vandaag) => Math.floor(Date.parse(String(vandaag || new Date().toISOString().slice(0, 10))) / 86400000) || 0;

/* Een deterministische greep: begin op een plek die met de dag opschuift en
   loop rond. Geen Math.random -- zie de kop. */
function greep(lijst, hoeveel, dag) {
  const n = lijst.length;
  if (!n) return [];
  const uit = [], start = ((dag % n) + n) % n;
  for (let i = 0; i < Math.min(hoeveel, n); i++) uit.push(lijst[(start + i) % n]);
  return uit;
}

function maakLeerstofbron({ DOELEN }) {
  const alle = Object.values(DOELEN || {}).filter(d => d && d.vak && d.naam && d.id);
  const perVak = new Map();
  for (const d of alle) {
    if (!perVak.has(d.vak)) perVak.set(d.vak, []);
    perVak.get(d.vak).push(d);
  }

  const alsOntdekking = (d, extra) => Object.assign({
    id: d.id,
    onderwerp: d.vak,
    soort: 'les',
    titel: d.naam,
    ingang: INGANG + '?doel=' + encodeURIComponent(d.id),
    herkomst: HERKOMST,
    kring: 'publiek',
    dektNiet: 'Dit is een les en geen toets: wat u hier doet wordt nergens beoordeeld en met niemand vergeleken.',
    werkwoorden: ['ontdek', 'begrijp', 'doe'],
    zekerheid: null
  }, extra || {});

  /* MOTOR 1 -- interesse. Alleen vakken met een POSITIEF gewicht. Een mens die
     nog niets heeft gezegd, krijgt hier niets: deze motor verzint geen
     interesse, dat is het werk van de andere. */
  function interesse(ctx) {
    const c = ctx || {};
    const dag = dagNr(c.vandaag);
    const wil = (c.onderwerpen || []).filter(o => Number(o.gewicht) > 0).map(o => String(o.onderwerp).toLowerCase());
    if (!wil.length) return [];
    const rij = [];
    for (const vak of perVak.keys()) {
      if (!wil.some(w => vak.includes(w) || w.includes(vak))) continue;
      for (const d of greep(perVak.get(vak), 2, dag)) rij.push(alsOntdekking(d));
    }
    return ontdekking.projecteerAlle(greep(rij, PER_MOTOR, dag), HERKOMST).ontdekkingen;
  }

  /* MOTOR 2 -- nieuwsgierig. Van een onderwerp dat de mens WEL kent naar een
     vak dat hij niet noemde, via de vraag die de sprong draagt. Een vak dat
     hij al volgt, valt af: dan was het geen brug maar een omweg. */
  function nieuwsgierig(ctx) {
    const c = ctx || {};
    const dag = dagNr(c.vandaag);
    const eigen = new Set((c.onderwerpen || []).map(o => String(o.onderwerp).toLowerCase()));
    /* Zonder enig onderwerp is er niets om vanaf te bruggen. Dan levert deze
       motor een spreiding over de vakken -- EEN doel per vak, dagelijks
       verschoven. Dat is geen verrassing maar een eerlijk beginpunt, en het
       staat in `dektNiet` zodat het niet als persoonlijk leest. */
    if (!eigen.size) {
      const vakken = [...perVak.keys()].sort();
      const rij = greep(vakken, PER_MOTOR, dag).map(vak => alsOntdekking(greep(perVak.get(vak), 1, dag)[0], {
        dektNiet: 'Dit is niet op u afgestemd: u hebt nog niet gezegd wat u interesseert, dus dit is een spreiding over de vakken.'
      }));
      return ontdekking.projecteerAlle(rij.filter(Boolean), HERKOMST).ontdekkingen;
    }
    const rij = [];
    for (const o of eigen) {
      for (const b of bruggen.vanaf(o, 3)) {
        if (eigen.has(b.naar)) continue;
        const doelen = perVak.get(b.naar);
        if (!doelen || !doelen.length) continue;
        const d = greep(doelen, 1, dag)[0];
        rij.push(alsOntdekking(d, {
          /* De VRAAG is de titel; het vak blijft het onderwerp. Zie de kop. */
          titel: b.vraag,
          soort: 'vraag',
          dektNiet: 'Deze vraag brengt u van ' + o + ' naar ' + b.naar + '. Dat verband is opgeschreven en niet gemeten (graad: ' + b.graad + ').',
          zekerheid: 'De brug van ' + o + ' naar ' + b.naar + ' is een verklaard verband, geen gemeten verband.'
        }));
      }
    }
    return ontdekking.projecteerAlle(greep(rij, PER_MOTOR, dag), HERKOMST).ontdekkingen;
  }

  return { interesse, nieuwsgierig, vakken: [...perVak.keys()].sort(), doelen: alle.length };
}

module.exports = { maakLeerstofbron, PER_MOTOR, INGANG, HERKOMST, greep, dagNr };
