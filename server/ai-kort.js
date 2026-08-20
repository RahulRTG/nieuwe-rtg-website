/* ============================================================================
   DE TWEE KORTE AANROEPEN, EEN KEER OPGESCHREVEN.

   Losse modules die maar EEN ding van een model nodig hebben -- een ja/nee, of
   een kort stuk tekst -- bouwden daar elk hun eigen messages.create voor, met
   hun eigen modelnaam erin. Dat is precies de plek waar een harde afhankelijkheid
   ontstaat: zo'n module zit dan stil vast aan een aanbieder en mist de uitwijk
   die ./ai.js juist levert.

   Daarom staan ze hier, EEN keer, en niet elf keer verspreid.

   WAAROM APART VAN ./ai.js. Dat bestand is de uitwijkketen zelf: welke aanbieder,
   in welke volgorde, met de kraan en de rem ervoor. Dit is een gemakslaag
   DAAROP -- twee vormen die genoeg blijken voor bijna elke aanroeper. Twee
   onderwerpen, en ai.js stond met 9.916 bytes 324 onder de harde grens, dus de
   naad die er toch al lag is nu ook echt geknipt.

   ALLEBEI GEVEN ZE null BIJ TWIJFEL, en dat is de belangrijkste regel hier.
   Geen sleutel, geen enkele aanbieder die het haalde, of een onleesbaar
   antwoord: dan null. Nooit een verzonnen antwoord, zodat de aanroeper eerlijk
   kan terugvallen op zijn eigen heuristiek of kan tonen dat de AI even niet
   bereikbaar is. Een AI-storing mag nooit een besluit forceren.
   ========================================================================== */
'use strict';

/* Een kort ja/nee-oordeel, via dezelfde uitwijkketen. Losse modules die maar
   een classificatie nodig hebben (is dit maatschappelijk belangrijk? hoort dit
   bij die categorie?) bouwden daar elk hun eigen aanroep voor, met hun eigen
   modelnaam erin. Dat is precies de plek waar een hardcoded afhankelijkheid
   ontstaat: zo'n module zit stil vast aan Claude en mist de uitwijk.

   Hier staat het een keer: het lichte model (MODEL_KORT, overschrijfbaar met
   AI_MODEL_KORT) en het lezen van het antwoord. Geeft true, false, of null --
   null betekent "geen oordeel" (geen sleutel, geen enkele aanbieder haalde
   het, of een onleesbaar antwoord). De aanroeper valt dan terug op zijn eigen
   heuristiek; een AI-storing mag nooit een besluit forceren. */
const MODEL_KORT = process.env.AI_MODEL_KORT || 'claude-sonnet-5';
async function jaNee(ai, system, tekst) {
  if (!ai || !ai.messages) return null;
  try {
    const r = await ai.messages.create({
      model: MODEL_KORT, max_tokens: 8, system: String(system || ''),
      messages: [{ role: 'user', content: String(tekst || '').slice(0, 500) }]
    });
    const t = ((r && r.content) || []).map(b => (b && b.text) || '').join(' ').toLowerCase();
    if (/\b(ja|yes)\b/.test(t)) return true;
    if (/\b(nee|no)\b/.test(t)) return false;
    return null;
  } catch (e) { return null; }
}

/* Een kort STUK TEKST, via dezelfde uitwijkketen. Zelfde reden als jaNee: zodra
   een app zijn eigen messages.create schrijft, staat de modelnaam in die app en
   mist hij de uitwijk. Apps die de AI iets laten samenvatten, opstellen of
   uitpluizen roepen dit aan.

   Geeft null bij geen sleutel of als geen enkele aanbieder het haalde -- nooit
   een verzonnen antwoord, zodat de aanroeper eerlijk "de AI is even niet
   bereikbaar" kan tonen in plaats van iets te doen alsof. */
async function tekst(ai, system, prompt, opties) {
  if (!ai || !ai.messages) return null;
  const o = opties || {};
  try {
    const r = await ai.messages.create({
      model: o.model || MODEL_KORT,
      max_tokens: Math.min(2000, Number(o.max) || 400),
      system: String(system || ''),
      messages: [{ role: 'user', content: String(prompt || '').slice(0, o.invoerMax || 12000) }]
    });
    const t = ((r && r.content) || []).map(b => (b && b.text) || '').join('').trim();
    return t || null;
  } catch (e) { return null; }
}

module.exports = { jaNee, tekst, MODEL_KORT };
