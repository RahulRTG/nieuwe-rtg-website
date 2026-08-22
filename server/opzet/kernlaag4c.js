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
Object.assign(kern, require('../kern/fiscaal/regelwacht')({ db, save, LANDEN, peiljaar: FISCAAL_PEILJAAR }));
kern.regelwacht.herstelOverlay();
/* De btw-aangifte van een zaak (kern/fiscaal/btwaangifte.js): opmaken uit het
   factuurregister, controleren, indienen vastleggen en corrigeren -- naar het
   model van de loonaangifte, met het factuurregister als enige bron. */
Object.assign(kern, require('../kern/fiscaal/btwaangifte').maakBtwAangifte({ db, save, crypto }));
const regelTimer = setInterval(() => { kern.regelwacht.check().catch(() => {}); }, Number(process.env.FISCAAL_CHECK_MS || 86400000));
if (regelTimer.unref) regelTimer.unref();

/* Officiele handels-, douane-, register- en sanctiebronnen worden eveneens
   gevolgd. Een inhoudswijziging opent hercontroles; de bron kan dus nooit
   zelfstandig een juridische grendel versoepelen. */
kern.handelsregelwacht = require('../kern/handelsregelwacht')({ db, save });
if (process.env.HANDELSREGELS_UIT !== '1') {
  const handelsTimer = setInterval(() => { kern.handelsregelwacht.check().catch(() => {}); },
    Number(process.env.HANDELSREGELS_CHECK_MS || 21600000));
  if (handelsTimer.unref) handelsTimer.unref();
  if (process.env.NODE_ENV === 'production') {
    const eerste = setTimeout(() => { kern.handelsregelwacht.check().catch(() => {}); },
      Number(process.env.HANDELSREGELS_EERSTE_CHECK_MS || 15000));
    if (eerste.unref) eerste.unref();
  }
}

/* De Opvang-afdeling (AZC/COA), het Regeringskantoor van de
   minister-president en het eigen hotel van elke afdeling -- alle drie
   kamers van RTG Kantoren. */
Object.assign(kern, require('../kern/opvang')({ db, save, crypto }));
Object.assign(kern, require('../kern/afdelingshotel')({ db, save, crypto }));
Object.assign(kern, require('../kern/regering')({ db, save, crypto, LANDEN,
  regelwacht: kern.regelwacht, bank: kern.bank, opvang: kern.opvang, afdelingen: kern.afdelingen, ledenAantal }));
};
