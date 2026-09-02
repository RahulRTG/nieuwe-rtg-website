/* ============================================================================
   HET AFWEGINGSKADER VAN STAP 5 -- de twee beslissingen, in die volgorde.

   WAT HIER IS GEREPAREERD. Deze module kende stap 5 als EEN keuze uit een
   lijstje van vier (hulp georganiseerd, gemeld, beide, geen actie). Dat is niet
   wat de meldcode sinds 2019 vraagt. Stap 5 is een AFWEGINGSKADER met twee
   beslissingen die na elkaar worden genomen:

     BESLISSING 1  Is melden noodzakelijk?
                   Melden is ALTIJD noodzakelijk bij acute of structurele
                   onveiligheid -- ook als hulp mogelijk is.
     BESLISSING 2  Is hulp verlenen of organiseren (ook) mogelijk?
                   Alleen als de professional passende hulp kan bieden of
                   organiseren, de betrokkenen daaraan meewerken, en die hulp
                   tot DUURZAME veiligheid leidt.

   WAAROM DAT VERSCHIL ERTOE DOET, EN NIET EEN FORMALITEIT IS. In de oude vorm
   kon een medewerker "hulp_georganiseerd" kiezen terwijl hij bij stap 4 acute
   onveiligheid had vastgesteld, en niets hield hem tegen. Precies die uitkomst
   is wat het afwegingskader onmogelijk wil maken: hulp organiseren is geen
   VERVANGING van melden, het komt ernaast. Een lijstje met vier gelijkwaardige
   opties suggereert een keuze waar de wet er geen laat.

   DE UITKOMST WORDT NU AFGELEID EN NIET GEKOZEN. Twee beslissingen leveren
   precies vier combinaties op, en dat zijn exact de vier uitkomsten die er al
   waren. Ze allebei laten invoeren zou twee plekken geven die hetzelfde zeggen,
   en die lopen uiteen (LAT.md regel 4) -- in dit geval op de manier die het
   ergst is: het dossier zou een uitkomst dragen die niet volgt uit de afweging
   eronder.

   WAT DEZE MODULE NIET DOET. Hij velt geen oordeel over ernst. Of er acute of
   structurele onveiligheid is, stelt een MENS vast bij stap 4; dit bestand
   rekent alleen met wat die mens daar heeft opgeschreven. Een afwegingskader
   dat zelf gaat wegen, is geen kader maar een beslisser.

   Afgesplitst uit ./meldcode.js op de 10 KB van keuringsregel 13.
   ========================================================================== */
'use strict';

/* De vier uitkomsten, en per uitkomst welke twee beslissingen erachter zitten.
   Deze tabel IS de afleiding; er staat nergens anders een tweede. */
const UITKOMSTEN = ['hulp_georganiseerd', 'gemeld_veilig_thuis', 'beide', 'geen_actie'];

function uitkomstVan(melden, hulp) {
  if (melden && hulp) return 'beide';
  if (melden) return 'gemeld_veilig_thuis';
  if (hulp) return 'hulp_georganiseerd';
  return 'geen_actie';
}

/* ---------------------------------------------------------------------------
   STAP 4: WEGEN. Twee vragen, en allebei een echte booleaan.

   "Weet niet" bestaat hier niet, en dat is dezelfde keuze als bij de
   veiligheidsvraag van de beschermzaak: wie het niet weet, weegt hem als
   onveilig. Een derde stand zou de grendel van stap 5 laten wegvallen op
   precies de dossiers waar hij het hardst nodig is.
   ------------------------------------------------------------------------- */
function keurWeging(b) {
  if (typeof b.acuut !== 'boolean') {
    return { status: 400, error: 'Is er ACUTE onveiligheid? Ja of nee -- "weet niet" weegt hier als ja. ' +
      'Dit antwoord bepaalt bij stap 5 of melden nog een keuze is.' };
  }
  if (typeof b.structureel !== 'boolean') {
    return { status: 400, error: 'Is er STRUCTURELE onveiligheid? Ja of nee. Ook dit antwoord bepaalt bij ' +
      'stap 5 of melden nog een keuze is.' };
  }
  return null;
}

/* ---------------------------------------------------------------------------
   STAP 5: BESLISSEN. De twee beslissingen, met de grendel ertussen.
   ------------------------------------------------------------------------- */
function keurBesluit(b, weging) {
  /* De weging moet er zijn, en met haar twee antwoorden. Zonder stap 4 is er
     niets om beslissing 1 aan te toetsen, en dan is de grendel een decoratie. */
  if (!weging || typeof weging.acuut !== 'boolean' || typeof weging.structureel !== 'boolean') {
    return { status: 400, error: 'Stap 4 (wegen) draagt nog geen oordeel over acute of structurele ' +
      'onveiligheid. Beslissen zonder die weging is beslissen zonder kader.' };
  }
  if (typeof b.meldenNoodzakelijk !== 'boolean') {
    return { status: 400, error: 'Beslissing 1: is melden bij Veilig Thuis noodzakelijk? Ja of nee.' };
  }
  if (typeof b.hulpMogelijk !== 'boolean') {
    return { status: 400, error: 'Beslissing 2: is hulp verlenen of organiseren (ook) mogelijk? Ja of nee. ' +
      'Deze vraag komt NA de eerste en vervangt hem niet.' };
  }

  /* DE GRENDEL. Dit is de hele reden dat dit bestand bestaat. */
  const onveilig = weging.acuut || weging.structureel;
  if (onveilig && !b.meldenNoodzakelijk) {
    const welke = [weging.acuut ? 'acute' : null, weging.structureel ? 'structurele' : null]
      .filter(Boolean).join(' en ');
    return { status: 400, error: 'Bij stap 4 is ' + welke + ' onveiligheid vastgesteld. Dan is melden bij ' +
      'Veilig Thuis noodzakelijk -- ook als u hulp kunt organiseren. Hulp komt ernaast en niet in de plaats. ' +
      'Klopt de weging niet meer, dan hoort die te worden herzien en niet deze beslissing.' };
  }

  /* Hulp mag alleen "mogelijk" heten als het naar DUURZAME veiligheid leidt.
     Dat is het criterium dat in de praktijk wordt overgeslagen: er wordt iets
     geregeld, het is even rustig, en het dossier gaat dicht. */
  if (b.hulpMogelijk) {
    const t = String(b.hulpToelichting || '').trim();
    if (t.length < 20) {
      return { status: 400, error: 'Waarom leidt deze hulp tot DUURZAME veiligheid, werken de betrokkenen ' +
        'eraan mee, en kunt u haar bieden of organiseren? Zonder die drie is hulp niet "mogelijk" in de zin ' +
        'van het afwegingskader.' };
    }
  }
  return null;
}

module.exports = { UITKOMSTEN, uitkomstVan, keurWeging, keurBesluit };
