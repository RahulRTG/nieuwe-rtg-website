/* DE GEREEDSCHAPPEN VAN HET STUUR -- wat het model kan aanroepen, en wat elk
   stuk daarvan bewaakt.

   Apart bestand sinds de plancompiler erbij kwam: ./lus.js liep tegen de 10 KB
   van keuringsregel 13. De naad zit hier goed -- dit is de BESCHRIJVING van wat
   het model mag vragen, en lus.js is de lus die het afhandelt. */
'use strict';
const { TWIJFELREGELS } = require('../rahul/twijfel');

/* De twee gereedschappen. Staan buiten de fabriek omdat ze vast zijn, en
   omdat de twijfelpoort alleen dichtzit als `zeker` en `begrepen` ECHT
   verplichte velden zijn; dat is nu van buitenaf te controleren
   (test/rahul-mens.test.js). */
const TOOLS = [
  /* `kaart` geeft de paden die DEZE opdracht raken (./resolver.js: versmalt de
     keuze, nooit de bevoegdheid). `alles: true` is de ontsnapping. */
  { name: 'kaart', description: 'De API-paden (POST) die je met "doe" kunt aanroepen. Standaard alleen de paden die deze ' +
      'opdracht raken. Staat er niet bij wat je zoekt, roep hem dan opnieuw aan met alles=true voor de volledige lijst.',
    input_schema: { type: 'object', properties: {
      alles: { type: 'boolean', description: 'true = de volledige lijst voor deze rol, zonder versmalling' } } } },
  /* `zeker` en `begrepen` zijn geen formaliteit maar de poort tegen twijfel
     (kern/rahul/twijfel.js). Het model moet expliciet verklaren dat het het
     zeker weet en in een zin opschrijven wat het gaat doen; lukt dat niet,
     dan hoort het te vragen in plaats van te doen. Dit is een gedragsrem, geen
     autorisatiegrens: die staat server-side in stuur/beleid + goedkeuring. */
  { name: 'doe', description: 'Voer een actie uit op een RTG API-pad (POST), met de inlog van de gebruiker. ' +
      'Alleen gebruiken als je het ZEKER weet: zet zeker=true en beschrijf in "begrepen" in een zin wat je gaat doen en voor wie. ' +
      'Twijfel je over wat, wanneer, hoeveel, waar of voor wie, gebruik deze tool dan NIET maar stel eerst een vraag.',
    input_schema: { type: 'object', properties: {
      pad: { type: 'string' }, body: { type: 'object' },
      zeker: { type: 'boolean', description: 'true als je zonder enige twijfel weet wat er moet gebeuren' },
      begrepen: { type: 'string', description: 'in een korte zin: wat ga je precies doen en voor wie' } },
      required: ['pad', 'zeker', 'begrepen'] } },
  /* `plan` WEEGT een keten en voert er niets van uit (./plan.js). Hij bestaat
     omdat de lus anders actie-actie-actie doet: dan ziet niemand -- ook de
     gebruiker niet -- vooraf wat er staat te gebeuren, en een plan dat je pas
     kent terwijl het draait kun je niet weigeren. Wat eruit komt is een
     gewogen plan of een afwijzing MET de bezwaren; uitvoeren blijft `doe`, en
     dus het gewone voorstel dat een mens buiten dit gesprek bevestigt. */
  { name: 'plan', description: 'Weeg een keten van stappen VOORDAT je iets doet. Geef doel en stappen; je krijgt per stap ' +
      'terug of hij bestaat voor deze gebruiker, welke frictie hij heeft en hoeveel bevestigingen het plan gaat vragen. ' +
      'Je krijgt er ook een GEVOLGVOORSPELLING bij: welke collecties de stappen in een eerdere proef aanraakten, ' +
      'en bij hoeveel stappen dat NIET gemeten is. Dit voert NIETS uit. Gebruik hem bij een opdracht van meerdere ' +
      'handelingen, en vertel de gebruiker daarna kort wat er klaarstaat en wat je niet kunt voorspellen.',
    input_schema: { type: 'object', properties: {
      doel: { type: 'string', description: 'wat de gebruiker wil bereiken, in een zin' },
      stappen: { type: 'array', description: 'de stappen in volgorde',
        items: { type: 'object', properties: {
          id: { type: 'string', description: 'kort kenmerk, bijvoorbeeld s1' },
          capability: { type: 'string', description: 'het API-pad van deze stap' },
          invoer: { type: 'object', description: 'het lichaam dat die stap zou krijgen' },
          afhankelijkVan: { type: 'array', items: { type: 'string' }, description: 'kenmerken van stappen die eerst moeten' },
          uitkomst: { type: 'string', description: 'wat deze stap moet opleveren' } },
          required: ['capability'] } } },
      required: ['doel', 'stappen'] } }
];

module.exports = { TOOLS, TWIJFELREGELS };
