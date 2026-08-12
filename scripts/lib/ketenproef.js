/* ============================================================================
   DE KETENPROEF -- wat er per businessketen werkelijk gebeurde onder sabotage.

   WAAROM DIT MEER IS DAN "ER WAS EEN VERSCHIL". De verraadronde kon tot nu toe
   zeggen dat een injectie ZICHTBAAR was. Dat is het begin van een antwoord en
   niet het antwoord: zichtbaar kan betekenen dat de gebruiker een nette fout
   kreeg en er niets is gebeurd (uitstekend), of dat hij een bevestiging kreeg en
   het geld weg is (rampzalig). Allebei "zichtbaar", allebei één regel in de
   uitslag.

   Dus wordt er per keten en per verraad ACHT dingen apart opgeschreven:

     INJECTIE            heeft het verraad werkelijk toegeslagen
     ZICHTBAAR           week er iets af van de schone ronde
     CLIENT-ANTWOORD     kreeg de aanroeper OK of FAIL
     TOESTANDWIJZIGING   GEEN / TERUGGEDRAAID / BLIJVEND
     LEDGER-INVARIANT    klopt het grootboek nog op de cent
     AUDIT               is er een spoor achtergebleven
     RETRY-VEILIG        levert dezelfde oproep nog eens geen tweede effect op
     ROLLBACK            PROVEN of NIET

   DE ENIGE COMBINATIE DIE ECHT SLECHT IS, staat niet in het rijtje maar volgt
   eruit: CLIENT-ANTWOORD = OK met TOESTANDWIJZIGING = GEEN. Dan is er iets
   bevestigd wat niet is gebeurd. Omgekeerd is FAIL met GEEN precies goed -- het
   systeem zei nee en hield zich eraan. Dat is `rollback: PROVEN`.

   EN DE LAT VOOR EEN NIEUW VERRAAD. Elk verraad dat erbij komt moet deze zeven
   stappen halen voordat het meetelt:

     injecteerbaar -> aantoonbaar toegeslagen -> zichtbaar -> reproduceerbaar
     -> businessuitkomst gemeten -> invariant beoordeeld -> rollback beoordeeld

   Zonder die lat groeit de motor uit tot een indrukwekkende catalogus
   chaosknoppen die weinig zegt over de veiligheid van RTG. `voldoetAanLat()`
   hieronder is die lat, en hij staat als functie zodat hij te toetsen is in
   plaats van te beloven.
   ========================================================================== */
'use strict';

const JA = 'JA', NEE = 'NEE';
const GEEN = 'GEEN', TERUGGEDRAAID = 'TERUGGEDRAAID', BLIJVEND = 'BLIJVEND';

/* De acht velden afleiden uit de ruwe waarnemingen van één scenario.

   `schoon` is dezelfde keten zonder verraad -- de ijklijn. Zonder die
   vergelijking is "de notitie staat er niet" niet te onderscheiden van "de
   notitie stond er sowieso nooit", en dan meet je je eigen scenario in plaats
   van het verraad. */
function beoordeel({ schoon, met, verraadSloegToe, herhaalbaar }) {
  const s = schoon || {}, m = met || {};

  const zichtbaar = JSON.stringify(afwijkingen(s, m)) !== '[]';

  /* CLIENT-ANTWOORD. 2xx is OK, al het andere FAIL. Een verzoek dat helemaal
     niet aankwam (de server lag) telt ook als FAIL: de aanroeper kreeg geen
     bevestiging, en dat is wat er voor hem toe doet. */
  /* DRIE STANDEN, EN DE DERDE IS ER GEKOMEN DOOR SCENARIO 3.

     Eerst waren het er twee: OK of FAIL. Maar een crash vóór de response geeft
     geen antwoord, en dat is iets anders dan een weigering. Het verschil is bij
     geld het hele verschil: bij een WEIGERING hoort er niets te blijven staan
     (anders is het "geweigerd en toch geboekt"), bij GEEN ANTWOORD hoort de
     duurzame boeking juist wél te blijven staan -- de klant weet alleen niet dat
     het gelukt is, en dáárvoor bestaat de idempotentiesleutel.

     Zonder deze derde stand meldde de proef een geslaagd scenario 3 als een
     fout, en dat is de vervelendste soort: hij zou iemand ertoe brengen correct
     gedrag te "repareren". */
  const clientAntwoord = (m.schrijfStatus >= 200 && m.schrijfStatus < 300) ? 'OK'
    : (m.schrijfStatus === 0 || m.schrijfStatus == null) ? 'GEEN ANTWOORD' : 'FAIL';

  /* TOESTANDWIJZIGING. Drie standen, en het verschil tussen de eerste twee is
     niet cosmetisch: GEEN betekent dat er nooit iets is gebeurd, TERUGGEDRAAID
     dat het is gebeurd en netjes ongedaan gemaakt. Dat laatste is een sterker
     bewijs van een werkende transactie. */
  let toestandWijziging;
  if (m.blijftNaHerstart === true) toestandWijziging = BLIJVEND;
  else if (m.zichtbaarVoorHerstart === true) toestandWijziging = TERUGGEDRAAID;
  else toestandWijziging = GEEN;

  const ledgerInvariant = m.ledgerKlopt === false ? 'GEBROKEN'
    : m.ledgerKlopt === true ? 'GELDIG' : 'ONGEMETEN';
  const audit = m.auditSpoor === true ? 'AANWEZIG'
    : m.auditSpoor === false ? 'AFWEZIG' : 'ONGEMETEN';
  const retryVeilig = m.retryGafTweedeEffect === false ? JA
    : m.retryGafTweedeEffect === true ? NEE : 'ONGEMETEN';

  /* ROLLBACK IS PROVEN ALS DE AANROEPER NEE KREEG EN ER NIETS IS BLIJVEN STAAN.
     Bewust streng: bij een OK-antwoord valt er niets terug te draaien en is
     PROVEN dus betekenisloos -- dan staat er NVT en niet stilzwijgend PROVEN. */
  let rollback;
  if (clientAntwoord === 'OK') rollback = 'NVT';
  /* Bij GEEN ANTWOORD valt er niets terug te draaien: het systeem heeft niets
     beloofd en niets geweigerd. Dan telt de retry, niet de rollback. */
  else if (clientAntwoord === 'GEEN ANTWOORD') rollback = 'NVT';
  else if (toestandWijziging === BLIJVEND) rollback = 'NIET';
  else rollback = 'PROVEN';

  return {
    injectie: verraadSloegToe ? JA : NEE,
    zichtbaar: zichtbaar ? JA : NEE,
    clientAntwoord,
    toestandWijziging,
    ledgerInvariant,
    audit,
    retryVeilig,
    rollback,
    herhaalbaar: herhaalbaar ? JA : NEE,
    afwijkingen: afwijkingen(s, m)
  };
}

/* Wat wijkt af van de schone ronde. Alleen de velden die iets betekenen; de
   ruwe meetwaarden staan er los bij. */
function afwijkingen(schoon, met) {
  const uit = [];
  for (const k of new Set([...Object.keys(schoon), ...Object.keys(met)])) {
    if (JSON.stringify(schoon[k]) !== JSON.stringify(met[k])) {
      uit.push(k + ': ' + JSON.stringify(schoon[k]) + ' -> ' + JSON.stringify(met[k]));
    }
  }
  return uit.sort();
}

/* DE ERGSTE UITKOMST, apart benoemd zodat hij niet tussen zeven regels
   verdwijnt: BEVESTIGD EN NIET BLIJVEND.

   DIT STOND ER EERST TE KRAP IN, en de eerste echte ronde legde dat bloot. De
   eerste versie eiste toestandWijziging === GEEN. Maar de notitieketen leverde
   onder `schrijf-verloren` dit op: client OK, zichtbaar vóór de herstart, weg
   erna -- dus TERUGGEDRAAID. Dat glipte erlangs, terwijl het precies het geval
   is waar dit ding voor bestaat: een gebruiker die een bevestiging kreeg en zijn
   werk kwijt is.

   TERUGGEDRAAID is alleen een GOEDE uitkomst als de aanroeper FAIL kreeg. Dan
   heeft het systeem zich bedacht en dat netjes gemeld. Kreeg hij OK, dan is
   dezelfde toestand een stil verlies. De uitkomst is dus niet los van het
   antwoord te lezen -- en dat is nu ook zo geschreven. */
function isStilVerlies(o) {
  return o.clientAntwoord === 'OK' && o.toestandWijziging !== BLIJVEND;
}

/* ---------------------------------------------------------------------------
   DE STRENGERE LAT VOOR GELD.

   Een financiële route is pas PROVEN als DRIE dingen tegelijk kloppen:
   het responsegedrag, de persistentie na herstart, en de grootboekinvariant.
   Twee van de drie is niet twee derde bewijs maar geen bewijs.

   DE EERSTE RONDE LIET ZIEN WAAROM. De geldketen onder `schrijf-verloren`:

       client response ..... OK
       ledger invariant .... GELDIG
       state wijziging ..... TERUGGEDRAAID   <- het geld is weg

   Antwoord goed, grootboek intern kloppend, en de oplading bestaat niet meer.
   Dat kan, omdat een VERLOREN schrijfactie het grootboek kloppend achterlaat:
   er is nooit iets geboekt, dus de som blijft nul. De sluitcontrole bewaakt dat
   het grootboek met ZICHZELF klopt -- niet dat wat bevestigd is ook bestaat.
   Twee verschillende beloften, en wie ze door elkaar haalt kan een correct
   antwoord toetsen boven een beschadigde boekhouding.

   EN ONGEMETEN IS HIER NOOIT GOED. Staat de grootboekinvariant op ONGEMETEN,
   dan kan een geldroute niet PROVEN worden, punt. Bij geld is "we hebben niet
   gekeken" hetzelfde als "we weten het niet".
   ------------------------------------------------------------------------- */
function financieelOordeel(o) {
  if (!o) return { staat: 'ONGEMETEN', reden: 'geen waarneming' };
  if (o.ledgerInvariant === 'GEBROKEN') {
    return { staat: 'NIET', reden: 'het grootboek klopt niet meer' };
  }
  if (o.ledgerInvariant !== 'GELDIG') {
    return { staat: 'ONGEMETEN', reden: 'de grootboekinvariant is niet gemeten; bij geld telt dat niet als goed' };
  }
  if (isStilVerlies(o)) {
    return { staat: 'NIET', reden: 'bevestigd aan de aanroeper en na de herstart weg' };
  }
  if (o.clientAntwoord === 'OK' && o.toestandWijziging !== BLIJVEND) {
    return { staat: 'NIET', reden: 'bevestigd zonder blijvend gevolg' };
  }
  if (o.clientAntwoord === 'FAIL' && o.toestandWijziging === BLIJVEND) {
    return { staat: 'NIET', reden: 'geweigerd en toch blijvend geboekt' };
  }
  /* SCENARIO 3. Geen antwoord, duurzaam geboekt, en de herhaling boekt niet nog
     eens -- dat is precies goed, en het is de zwaarste van de drie. */
  if (o.clientAntwoord === 'GEEN ANTWOORD') {
    if (o.toestandWijziging !== BLIJVEND) {
      return { staat: 'NIET', reden: 'het proces stierf na de commit en de boeking is toch weg' };
    }
    if (o.retryVeilig !== JA) {
      return { staat: 'NIET', reden: 'de klant kreeg geen antwoord en de herhaling boekt een tweede keer' };
    }
    return { staat: 'PROVEN',
      reden: 'geen antwoord, duurzaam geboekt, en de herhaling boekt niet nog eens' };
  }
  if (o.retryVeilig === 'NEE') {
    return { staat: 'NIET', reden: 'een herhaling boekt een tweede keer' };
  }
  return { staat: 'PROVEN',
    reden: 'antwoord, persistentie na herstart en grootboekinvariant kloppen alle drie' };
}

/* DE LAT VOOR EEN VERRAAD. Zeven stappen, en een verraad telt pas mee als hij
   ze allemaal haalt. Geeft terug wat er ontbreekt, zodat "voldoet niet" een
   werklijst is in plaats van een oordeel. */
const LAT = [
  { stap: 'injecteerbaar', check: (o) => o.injectie === JA || o.injectie === NEE },
  { stap: 'aantoonbaar toegeslagen', check: (o) => o.injectie === JA },
  { stap: 'zichtbaar', check: (o) => o.zichtbaar === JA },
  { stap: 'reproduceerbaar', check: (o) => o.herhaalbaar === JA },
  { stap: 'businessuitkomst gemeten', check: (o) => o.clientAntwoord !== 'ONGEMETEN' && o.toestandWijziging != null },
  { stap: 'invariant beoordeeld', check: (o) => o.ledgerInvariant !== 'ONGEMETEN' || o.audit !== 'ONGEMETEN' },
  { stap: 'rollback beoordeeld', check: (o) => o.rollback !== 'ONGEMETEN' }
];

function voldoetAanLat(o) {
  const ontbreekt = LAT.filter(l => !l.check(o || {})).map(l => l.stap);
  return { voldoet: ontbreekt.length === 0, ontbreekt };
}

const CONTROL = {
  control: 'KETENPROEF',
  wat: 'per businessketen is onder echte sabotage gemeten wat de gebruiker kreeg en wat er bleef staan',
  eigenaar: 'Techniek',
  bewijs: ['test/ketenproef.test.js'],
  bewijsstuk: 'KETENS.json -- acht velden per keten en verraad, met de zevenstappenlat',
  grens: 'drie ketens van de tientallen die er zijn, en alleen de twee verraden die op het ' +
    'schrijfpad zijn ingebouwd. Voor GELD geldt de strengere lat (antwoord EN persistentie ' +
    'EN grootboek); voor de andere ketens is er nog geen invariant om tegen af te rekenen. Een keten die achter een poort zit (KYC, een bestaande ' +
    'toestemming) wordt NIET beoordeeld en staat als blind met reden in het register.',
  dekking: { register: 'KETENS.json', beproefd: 'gemeten.voldoetAanLat',
    totaal: 'gemeten.scenarios', eenheid: 'scenarios die de zevenstappenlat halen',
    tellers: { ketens: 'gemeten.ketens', blindeKetens: 'gemeten.blindeKetens',
      rollbackBewezen: 'gemeten.rollbackBewezen', ledgerGebroken: 'gemeten.ledgerGebroken',
      stilVerlies: 'gemeten.stilVerlies',
      /* Geld apart, met de strengere lat: alle drie of niets. */
      geldProven: 'gemeten.geldProven', geldScenarios: 'gemeten.geldScenarios' } }
};

module.exports = { beoordeel, afwijkingen, isStilVerlies, financieelOordeel, voldoetAanLat, LAT, CONTROL,
  JA, NEE, GEEN, TERUGGEDRAAID, BLIJVEND };
