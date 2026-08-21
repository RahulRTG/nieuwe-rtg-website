'use strict';
/* RISICOPROPAGATIE -- wie wordt er geraakt, en hoe zwaar weegt dat?

   DE VRAAG. Er is iets veranderd aan een handvol bestanden. Welke bewijzen zijn
   daardoor mogelijk niet meer geldig? Een diff kan dat niet beantwoorden: die
   kent alleen de bestanden die zelf zijn aangeraakt. Wat je nodig hebt is de
   OMGEKEERDE graaf -- van een gewijzigd bestand naar iedereen die het inlaadt,
   en van hen naar hun inladers, tot het ophoudt.

   DE VORM VAN EEN WIJZIGING LIEGT, en dat is waarom deze laag bestaat naast
   lib/semdiff.js. Twee echte gevallen van 21 augustus 2026:

     - de inlogrem verloor twee regels. De diff toont het verwijderen van een
       `await`; dat leest als binnenwerk. Wat het was: de doelemmer telde nog wel
       maar remde niet meer.
     - een schermregel werd van een toewijzing een toewijzing-met-controle. Puur
       binnenwerk -- en het repareerde een scherm dat voor elk lid een bestand
       opende zonder ooit de inhoud te tonen.

   Beide keren zei de vorm "klein" en zei de graaf "beveiliging". Daarom levert
   semdiff alleen een ONDERGRENS, en wint hier het zwaarste gebied dat de
   wijziging kan bereiken.

   DE GRONDWET, TWEEDE ZIN (PROOF-INCREMENTAL.md par. 0): wat het systeem niet
   kan bewijzen als irrelevant, behandelt het als relevant. Dat heeft hier een
   heel concreet gevolg, en het is de belangrijkste regel in dit bestand:

     EEN BESTAND MET EEN ONOPGELOSTE KANT LAADT MOGELIJK ALLES IN, dus van geen
     enkele wijziging is te bewijzen dat hij daar niet aankomt. Zulke bestanden
     staan in ELKE impactverzameling, met naam en reden. Vandaag zijn dat er
     twee. Dat is geen schoonheidsfout in de meting -- dat is de prijs van die
     twee regels, zichtbaar gemaakt, elke keer opnieuw.

   DRIE MANIEREN OM GERAAKT TE ZIJN, en ze worden apart geteld (par. 3.2):

     zeker        bereikt over uitsluitend opgeloste kanten
     mogelijk     bereikt over minstens een BENADERDE kant (het is een van deze
                  kandidaten, welke weten we niet)
     onopgelost   in de verzameling omdat hij zelf een onoplosbare require heeft

   Alleen `zeker` is een feit. De andere twee zijn eerlijkheid, en ze horen niet
   te worden weggemiddeld tot een percentage.
   ========================================================================== */

/* Gevoeligheid op volgorde. `algemeen` is geen gebied maar de afwezigheid van
   een gebied; hij staat onderaan zodat een gemist pad de zachte eis krijgt en
   niet stilletjes de harde. */
const ZWAARTE = ['algemeen', 'identity', 'money', 'security'];
const zwaarder = (a, b) => (ZWAARTE.indexOf(a) >= ZWAARTE.indexOf(b) ? a : b);

/* De klassen uit semdiff, van licht naar zwaar. Deze lijst staat hier ook zodat
   de twee lagen elkaar kunnen vergelijken zonder elkaar in te laden. */
const KLASSEN = ['cosmetic', 'implementation', 'contract', 'public API',
  'schema', 'authorization', 'money', 'security'];
const hogerst = (a, b) => (KLASSEN.indexOf(a) >= KLASSEN.indexOf(b) ? a : b);

/* Welk gebied welke klasse afdwingt zodra een wijziging het kan bereiken. */
const GEBIED_KLASSE = { security: 'security', money: 'money',
  identity: 'authorization', algemeen: 'implementation' };

/* ------------------------------------------------------- de onoplosbare rand */
/* De bestanden die een require hebben die pas op runtime bekend is. Zij kunnen
   niet bewijzen wat ze NIET inladen, dus zij zijn altijd geraakt. */
function onopgelosteRand(ix) {
  const uit = new Map();
  for (const b of ix.bestanden.values()) {
    for (const o of b.kanten.onbekend) {
      if (uit.has(b.pad)) continue;
      uit.set(b.pad, o.vorm + ' op regel ' + o.lijn + ' -- ' + o.reden);
    }
  }
  return uit;
}

/* ----------------------------------------------------------- de propagatie */
/* Breedte-eerst over de OMGEKEERDE graaf. Breedte en niet diepte, omdat de
   afstand er toe doet: een direct inlader is iets anders dan iemand acht stappen
   verderop, en een planner mag dat verschil straks gebruiken. Wat hij NIET mag
   is het verschil gebruiken om iets over te slaan zonder bewijs -- de afstand is
   informatie, geen vrijbrief. */
function raak(ix, gewijzigd, opties) {
  const o = opties || {};
  const maxDiepte = o.maxDiepte == null ? Infinity : o.maxDiepte;

  /* Welke kanten zijn BENADERD? Dan is "X laadt Y in" geen feit maar een
     mogelijkheid, en alles wat via Y verder wordt bereikt erft die twijfel.

     EN WAAROM DE OPGELOSTE KANTEN ER OOK BIJ MOETEN: een bestand kan een module
     zowel LETTERLIJK inladen als in een maplus noemen. Dan bestaat er tussen
     dezelfde twee bestanden een benaderde EN een opgeloste kant, en de eerste
     versie hier zag alleen de benaderde -- die zette het paar op "mogelijk" en
     de opwaardering verderop kon er nooit meer bij, want de tweede ronde over
     hetzelfde paar rekende exact dezelfde twijfel uit. Twijfel over een pad dat
     ernaast bewezen is, is geen twijfel. Het regressiecorpus vond dit binnen een
     minuut na het schrijven; met de hand was het nooit opgevallen, want de
     uitkomst was alleen maar VOORZICHTIGER dan nodig -- de stille fout die je
     niet als fout herkent. */
  const benaderdeKant = new Set();
  const opgelosteKant = new Set();
  for (const b of ix.bestanden.values()) {
    for (const d of b.kanten.opgelost) opgelosteKant.add(d + ' <- ' + b.pad);
    for (const ben of b.kanten.benaderd) {
      for (const k of ben.kandidaten) benaderdeKant.add(k + ' <- ' + b.pad);
    }
  }

  const geraakt = new Map();
  const rij = [];
  /* EEN GEWIJZIGD PAD DAT NIET IN DE INDEX STAAT, IS EEN GAT EN GEEN NUL.
     De eerste versie hiervan sloeg zo'n pad stilletjes over -- en dat is exact
     de versmalling die par. 0 verbiedt: de impactverzameling zag er dan
     keurig klein uit terwijl er iets buiten beeld was veranderd. Twee echte
     gevallen: een bestand dat is VERWIJDERD (niemand laadt het meer in, dus de
     omgekeerde graaf weet niets meer van hem) en een wijziging in een map die
     deze index niet bestrijkt. In beide gevallen is de verzameling hieronder
     niet compleet, en dat moet de aanroeper WETEN in plaats van raden. */
  const onvolledig = [];
  for (const g of gewijzigd) {
    if (!ix.bestanden.has(g)) {
      onvolledig.push({ pad: g, waarom: 'staat niet in de index -- verwijderd, of buiten de gemeten mappen' });
      continue;
    }
    geraakt.set(g, { afstand: 0, via: 'zeker', reden: 'zelf gewijzigd' });
    rij.push(g);
  }

  for (let i = 0; i < rij.length; i++) {
    const hier = rij[i];
    const staat = geraakt.get(hier);
    if (staat.afstand >= maxDiepte) continue;
    for (const inlader of ix.omgekeerd.get(hier) || []) {
      const paar = hier + ' <- ' + inlader;
      const twijfel = benaderdeKant.has(paar) && !opgelosteKant.has(paar);
      const via = twijfel || staat.via === 'mogelijk' ? 'mogelijk' : 'zeker';
      const bestaand = geraakt.get(inlader);
      /* Een tweede pad naar hetzelfde bestand mag de zekerheid VERBETEREN maar
         nooit verslechteren: als er ergens een keten van uitsluitend opgeloste
         kanten naartoe loopt, dan staat vast dat hij geraakt is. Zonder deze
         regel bepaalt de toevallige volgorde van de rij het antwoord. */
      if (bestaand) {
        if (bestaand.via === 'mogelijk' && via === 'zeker') {
          bestaand.via = 'zeker';
          bestaand.reden = 'ingeladen door ' + hier;
        }
        continue;
      }
      geraakt.set(inlader, { afstand: staat.afstand + 1, via,
        reden: (twijfel ? 'laadt mogelijk ' : 'laadt ') + hier + ' in' });
      rij.push(inlader);
    }
  }

  /* De onoplosbare rand komt er ALTIJD bij -- ook als de wijziging in een hoek
     zit waar hij niets mee te maken lijkt te hebben. "Lijkt" is precies het
     woord waar deze laag tegen is gebouwd. */
  for (const [pad, waarom] of onopgelosteRand(ix)) {
    if (geraakt.has(pad)) continue;
    geraakt.set(pad, { afstand: -1, via: 'onopgelost',
      reden: 'kan niet bewijzen wat hij niet inlaadt: ' + waarom });
  }

  /* Het zwaarste gebied dat vanuit deze wijziging bereikbaar is. */
  let gebied = 'algemeen';
  const gebieden = new Map();
  for (const pad of geraakt.keys()) {
    const g = ix.gebiedVan(pad);
    gebieden.set(g, (gebieden.get(g) || 0) + 1);
    gebied = zwaarder(gebied, g);
  }

  const telling = { zeker: 0, mogelijk: 0, onopgelost: 0 };
  for (const s of geraakt.values()) telling[s.via]++;

  return { geraakt, gebied, gebieden, telling, onvolledig,
    volledig: onvolledig.length === 0, gewijzigd: [...gewijzigd] };
}

/* ----------------------------------------------------------- de eindklasse */
/* ONDERGRENS UIT DE VORM, EINDOORDEEL UIT DE GRAAF. `ondergrens` is wat
   semdiff.js uit de tekst van de wijziging haalde; die mag alleen omhoog. */
function klasseVan(uitkomst, ondergrens) {
  const uitGraaf = GEBIED_KLASSE[uitkomst.gebied] || 'implementation';
  let klasse = hogerst(ondergrens || 'cosmetic', uitGraaf);

  /* IS DE VERZAMELING NIET COMPLEET, DAN IS ER NIETS BEWEZEN. Een onbekend
     gewijzigd pad kan overal terechtkomen; het zwaarste gebied is dan geen
     uitkomst maar een gok. Hier gaat de klasse naar boven EN valt de
     cosmetische kortsluiting hieronder weg -- want die leunt erop dat we van
     elke gewijzigde regel weten waar hij staat. */
  if (!uitkomst.volledig) {
    return { klasse: 'security', ondergrens: ondergrens || 'cosmetic', uitGraaf,
      gebied: uitkomst.gebied, betrouwbaar: false,
      waarom: uitkomst.onvolledig.length + ' gewijzigd(e) pad(en) buiten de index: ' +
        uitkomst.onvolledig.map((x) => x.pad).join(', ') };
  }
  /* EEN COSMETISCHE WIJZIGING BLIJFT COSMETISCH, ook in de beveiligingslaag --
     maar alleen als de vorm dat ZEKER weet, en dat weet hij per regel: een
     witregel of een commentaarregel verandert niets aan wat de machine doet. Dit
     is de enige plek waar de graaf verliest, en hij verliest hier terecht. */
  if ((ondergrens || 'cosmetic') === 'cosmetic') klasse = 'cosmetic';
  return { klasse, ondergrens: ondergrens || 'cosmetic', uitGraaf, gebied: uitkomst.gebied, betrouwbaar: true };
}

module.exports = { raak, klasseVan, onopgelosteRand, ZWAARTE, KLASSEN, zwaarder, hogerst, GEBIED_KLASSE };
