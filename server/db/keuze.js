/* WELKE OPSLAG DRAAIT ER, EN DRAAGT DIE EEN GROOTBOEK?

   Twee vragen die op twee plekken beantwoord moesten worden: de opslaglaag kiest
   de motor, en de configuratiekeuring moet weten wat die keuze in productie
   betekent. Zodra dat twee keer wordt opgeschreven lopen ze uiteen -- en dan
   keurt de keuring een stand goed die de opslag heel anders invult. Vandaar een
   eigen bestandje zonder afhankelijkheden: geen require-lus, en beide kanten
   lezen dezelfde regel.

   WAAROM DE TWEEDE VRAAG ERTOE DOET. Zonder rij-voor-rij grootboek is er maar
   een vangnet voor een collectie die zijn grens raakt: db/tx/index.js schrijft de
   staart naar archief/ en kapt pas als dat gelukt is. Dat is beter dan verlies,
   maar het is een vangnet en geen grootboek -- er is geen index, geen paginering,
   en herstel betekent handwerk met een jsonl-bestand. Voor betalingen is dat te
   mager, en daarom blokkeert de productiekeuring een stand zonder grootboek.

   Ik had in LAT.md geschreven dat de json- en geheugen-stand "de ontwikkel- en
   toetsstanden zijn en niet de productiestand". Dat was aangenomen en niet
   nagetrokken: kiesStore() hieronder laat zien dat een installatie met een
   achtergebleven db.json en zonder DATABASE_URL gewoon in de json-stand start,
   ook in productie, en de keuring gaf daar alleen een waarschuwing over. */
'use strict';

/* De opslagkeuze. RTG_STORE is altijd de baas; daarna wint een DATABASE_URL;
   anders houdt een BESTAANDE installatie zijn db.json (er verandert niets onder
   je voeten) en krijgt een verse installatie de SQLite-motor.
   Puur: het bestaan van db.json gaat er als argument in, zodat deze functie
   zonder schijf te beproeven is. */
function kiesStore(env, bestaatDbJson) {
  const url = (env && (env.DATABASE_URL || env.PG_URL)) || null;
  return (env && env.RTG_STORE) || (url ? 'postgres' : (bestaatDbJson ? 'json' : 'sqlite'));
}

/* Draagt deze stand een rij-voor-rij grootboek (db/tx/ledger.js)?

   - postgres: altijd, het grootboek start mee met de pool (db/postgres.js);
   - sqlite: ja, tenzij het expliciet is uitgezet met TX_LEDGER_SQLITE=0;
   - json en geheugen: nee, daar is alleen het archief-vangnet.

   Dit is de enige plek waar dat staat, en db/index.js gebruikt hem ook om te
   besluiten of hij het sqlite-grootboek start. Zo kan de keuring niet iets
   beweren wat de opslag niet doet. */
function heeftGrootboek(env, store) {
  if (store === 'postgres') return true;
  if (store === 'sqlite') return !(env && env.TX_LEDGER_SQLITE === '0');
  return false;
}

module.exports = { kiesStore, heeftGrootboek };
