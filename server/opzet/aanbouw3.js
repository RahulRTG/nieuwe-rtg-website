/* DE KERN-AANBOUW, DEEL DRIE: de RTG Life-stapel.

   Alles wat over het leven van het lid zelf gaat: doelen, dagmetingen, training,
   medicijnen, de noodkaart, gewoonten, de dagcheck-in, gekoppelde toestellen,
   het toegankelijkheidsprofiel, het gedachtenboek, het Consent Center, de
   dagcoach en het ene scherm. Afgesplitst van ./aanbouw2.js toen die over de
   10 KB-keuringsgrens ging; zie docs/life.md voor de samenhang.

   DE VOLGORDE IS GEDRAG, en hier op drie plekken:
   - Training komt NA de metingen, want aftekenen schrijft een beweging-meting.
   - De noodkaart komt NA het medicatieschema, want hij leest de middelenlijst.
   - De dagcoach en Life komen als LAATSTE en krijgen de kern mee in plaats van
     losse functies: ze lezen lagen die verspreid gemonteerd zijn, en een kopie
     op montagemoment zou undefined bevriezen.
   ========================================================================== */
'use strict';

module.exports = function bouwKernAanDrie(kern, grens) {
  const { db, save, crypto, schoon } = kern;
  /* De doelenmotor (kern/doelen.js): waar u begon, waar u heen wilt, wanneer
     en waarom. De mijlpalen worden afgeleid en niet bewaard, zodat een gemiste
     week geen mislukking is maar gewoon een ander pad. */
  Object.assign(kern, require('../kern/doelen')({ db, save, crypto, schoon }));
  require('../routes/doelen')(grens('doelen'));
  /* De dagmetingen (kern/metingen.js): slaap, beweging en water, door het lid
     zelf ingevuld. De bron die RTG Life miste; herkomst blijft zichtbaar. */
  Object.assign(kern, require('../kern/metingen')({ db, save }));
  require('../routes/metingen')(grens('metingen'));
  /* Het medicatieschema (kern/medicatie.js): uw eigen lijst en uw eigen wekker.
     RTG bepaalt nooit een dosering en controleert geen combinaties; wat er staat
     heeft het lid overgetikt van het doosje. Staat hier BOVEN de noodkaart, want
     die leest de lijst eruit. */
  Object.assign(kern, require('../kern/medicatie')({ db, save, schoon, crypto }));
  require('../routes/medicatie')(grens('medicatie'));
  /* Het trainingsschema (kern/trainingsschema.js).
     LET OP DE NAAM: er bestaat al een server/training.js, en dat is iets heel
     anders -- de micro-learning voor personeel in de PDA. Die twee mogen niet
     dezelfde bestandsnaam dragen; toen dat wel zo was, is test/training.test.js
     van dat andere onderdeel per ongeluk overschreven. RTG schrijft geen
     training voor -- geen sets, geen opbouw, geen belastingscore. Aftekenen
     schrijft een beweging-meting weg via de metingenlaag, zodat er geen tweede
     beweegcijfer naast het bestaande komt. Staat daarom NA de metingen. */
  Object.assign(kern, require('../kern/trainingsschema')({ db, save, schoon, crypto,
    metingZet: kern.metingZet }));
  require('../routes/trainingsschema')(grens('trainingsschema'));
  /* De noodkaart (kern/noodkaart.js): een noodcontact en, als u dat wilt, uw
     allergenen en uw medicijnen -- gelezen uit het zorgprofiel en het
     medicatieschema, niet gekopieerd. Niemand kan hem opvragen; u toont hem zelf. */
  Object.assign(kern, require('../kern/noodkaart')({ db, save, schoon,
    zorgVan: kern.zorgVan, medicijnenVan: kern.medicatieVoorNoodkaart }));
  require('../routes/noodkaart')(grens('noodkaart'));
  /* Gewoonten (kern/gewoonten.js): kleine dingen die u vaker wilt doen. De
     reeksteller staat UIT tot het lid hem zelf aanzet, en een gebroken reeks is
     geen gebeurtenis -- geen melding, geen rood. */
  Object.assign(kern, require('../kern/gewoonten')({ db, save, schoon, crypto }));
  require('../routes/gewoonten')(grens('gewoonten'));
  /* De dagcheck-in (kern/gemoed.js) op de grens uit kern/zorgniveau.js. De
     grens staat er eerder dan de functie: elke vrije tekst gaat er langs voor
     er iets terugkomt, en slaat hij aan, dan is er geen tip maar een weg naar
     echte hulp. */
  Object.assign(kern, require('../kern/gemoed')({ db, save, schoon }));
  require('../routes/gemoed')(grens('gemoed'));
  /* Het gedachtenboek (kern/gedachten.js): opschrijven voor uzelf. Er leest geen
     model mee en er wordt niets samengevat; de crisisregel bewaart hier WEL en
     zet de weg naar hulp ernaast, want woorden laten verdwijnen straft eerlijk
     zijn. */
  Object.assign(kern, require('../kern/gedachten')({ db, save, schoon, crypto }));
  require('../routes/gedachten')(grens('gedachten'));
  /* Gekoppelde toestellen (kern/toestellen.js): de tweede herkomst. Een eigen
     smalle sleutel per toestel die precies een ding kan -- een dagmeting
     wegschrijven -- en die het lid altijd kan intrekken. */
  Object.assign(kern, require('../kern/toestellen')({ db, save, crypto, schoon,
    metingVanToestel: kern.metingVanToestel }));
  require('../routes/toestellen')(grens('toestellen'));
  /* Het toegankelijkheidsprofiel (kern/toegankelijk.js): hoe het scherm zich
     hoort te gedragen. Hangt aan het ik-domein, want het is een instelling van
     het lid over zichzelf; shared/basis.js voert hem uit op elke pagina. */
  Object.assign(kern, require('../kern/toegankelijk')({ accounts: kern.accounts }));
  // Wie ben ik voor Rahul: omgang, voornaamwoorden en de eigen geloofskeuze.
  require('../routes/ik')(grens('ik'));
  /* Het Consent Center (kern/consent.js): wie raakt mijn gegevens aan, en waar
     zet ik dat stop. Bewaart niets en trekt in bij de bron; krijgt daarom de
     KERN mee, net als Life, want hij leest lagen die verspreid gemonteerd zijn. */
  Object.assign(kern, require('../kern/consent')({ kern }));
  require('../routes/consent')(grens('consent'));
  /* De dagcoach (kern/dagcoach.js): wat er vandaag staat, op volgorde van de
     klok. Hij plant niets en bezit niets -- afvinken gebeurt in de laag die het
     ding wel bezit. Krijgt de KERN mee, net als Life, om dezelfde reden. */
  Object.assign(kern, require('../kern/dagcoach')({ kern }));
  require('../routes/dagcoach')(grens('dagcoach'));
  /* RTG Life (kern/life.js): het ene scherm dat de lagen hierboven bij elkaar
     leest -- ritme, doelen, afspraken en de check-in. Hij krijgt de KERN mee en
     geen losse functies, want hij pakt ze op aanroepmoment: hij hangt later in
     de bouw dan wat hij leest, en een kopie zou undefined bevriezen. */
  Object.assign(kern, require('../kern/life')({ kern }));
  require('../routes/life')(grens('life'));
};
