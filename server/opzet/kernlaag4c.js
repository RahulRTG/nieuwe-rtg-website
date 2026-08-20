/* DE KERN SAMENSTELLEN -- deel 4c: de drie kamers van RTG Kantoren.
   Uit deel 4b geknipt op de 10 kB-grens toen de belasting- en ondernemersronde
   dat deel eroverheen duwden. De knip valt op een naad: deze drie kamers
   gebruiken `bankregie` niet (de reden dat 4b als geheel bestaat), alleen de
   kern die er na 4b al ligt -- regering leest kern.bank en kern.opvang, en die
   staan er dan allebei. Wordt NA kernlaag4b aangeroepen; zie server.js. */
'use strict';

module.exports = (kern, hulp) => {
  const { FISCAAL_PEILJAAR, LANDEN, crypto, db, ledenAantal, save } = hulp;

/* De fiscale laag (Regelwacht + btw-aangifte), uit 4b geknipt op de 10 kB-grens
   toen de merge van de dwarsverbindingen-ronde dat deel eroverheen duwde. Het
   is een eigen naad: belastingen leunen niet op de bankregie die 4b als geheel
   bijeenhoudt, alleen op de gedeelde LANDEN-tabel en het factuurregister, en
   die staan er allebei. */
/* De Regelwacht (kern/fiscaal/regelwacht.js): belastingen en regels worden
   automatisch bijgewerkt -- een gevalideerde overlay op de gedeelde
   LANDEN-tabel, herstart-vast, met een dagelijkse bron-check. */
/* Het bronnenregister (kern/fiscaal/bronnen/): waar de regels vandaan komen en
   hoeveel gezag dat heeft. Gaat VOOR de Regelwacht, die hem meekrijgt en er bij
   elke dagelijkse controle overheen loopt. */
Object.assign(kern, require('../kern/fiscaal/bronnen').maakBronnen({ db, save, LANDEN }));
Object.assign(kern, require('../kern/fiscaal/regelwacht')({ db, save, LANDEN, peiljaar: FISCAAL_PEILJAAR, bronnen: kern.bronnen }));
kern.regelwacht.herstelOverlay();
/* De zzp-wacht (kern/fiscaal/zzpwacht.js): de ondernemersregimes per
   ingangsdatum, zodat een berekening over een ander jaar met de regels van dat
   jaar rekent in plaats van met die van nu. Zelfde mechaniek als de Regelwacht,
   eigen bak en eigen validatie. */
Object.assign(kern, require('../kern/fiscaal/zzpwacht')({ db, save, peiljaar: FISCAAL_PEILJAAR }));
kern.zzpwacht.herstel();
/* De btw-aangifte van een zaak (kern/fiscaal/btwaangifte.js): opmaken uit het
   factuurregister, controleren, indienen vastleggen en corrigeren -- naar het
   model van de loonaangifte, met het factuurregister als enige bron. */
Object.assign(kern, require('../kern/fiscaal/btwaangifte').maakBtwAangifte({ db, save, crypto }));
/* De bewijsketen (kern/fiscaal/herkomst.js): waar komt dit bedrag vandaan, komt
   het herbouwd op de cent uit, en wat raakt een regelwijziging. Hij hoort NA de
   Regelwacht, want hij leest de jaargangen die daar ontstaan. */
Object.assign(kern, require('../kern/fiscaal/herkomst').maakHerkomst({ db, jaargangen: kern.regelwacht.jaargangen }));
/* De afsluiting van een periode (kern/fiscaal/aansluiting.js): de controles die
   er al waren bij elkaar opgeteld, per geldstroom, met wat er NIET onder een
   controle valt erbij. payrollOS staat er al sinds kernlaag2. */
Object.assign(kern, require('../kern/fiscaal/aansluiting').maakAansluiting({ db,
  btwAangifte: kern.btwAangifte, payrollOS: kern.payrollOS }));
/* De pre-flight (kern/fiscaal/preflight.js): GO/REVIEW/BLOCK voor de klik, en
   met opzet zonder eigen controles -- elke uitslag komt uit de routine die de
   handeling straks ook aanroept. */
Object.assign(kern, require('../kern/fiscaal/preflight').maakPreflight({ db, btwAangifte: kern.btwAangifte }));
/* De aangiftegateway (kern/fiscaal/gateway/): mandaten, verzegelde zendingen,
   idempotentie en een keten die een wijziging achteraf verraadt. KLAARGEZET EN
   NIET AANGEZET -- het kanaal is inert en het zekerheidsregister houdt het
   verzenden tegen; zie de kop van gateway/index.js. */
Object.assign(kern, require('../kern/fiscaal/gateway/mandaat').maakMandaat({ db, save }));
Object.assign(kern, require('../kern/fiscaal/gateway').maakGateway({ db, save, crypto,
  mandaat: kern.mandaat, kanalen: { sbr: require('../kern/fiscaal/gateway/sbr').kanaal } }));
const regelTimer = setInterval(() => { kern.regelwacht.check().catch(() => {}); }, Number(process.env.FISCAAL_CHECK_MS || 86400000));
if (regelTimer.unref) regelTimer.unref();

/* De Opvang-afdeling (AZC/COA), het Regeringskantoor van de
   minister-president en het eigen hotel van elke afdeling -- alle drie
   kamers van RTG Kantoren. */
Object.assign(kern, require('../kern/opvang')({ db, save, crypto }));
Object.assign(kern, require('../kern/afdelingshotel')({ db, save, crypto }));
Object.assign(kern, require('../kern/regering')({ db, save, crypto, LANDEN,
  regelwacht: kern.regelwacht, bank: kern.bank, opvang: kern.opvang, afdelingen: kern.afdelingen, ledenAantal }));
};
