/* DE KERN SAMENSTELLEN -- deel 4b.
   Waarom er op positie is geknipt en wat `kern` en `hulp` zijn: zie de kop van
   ./kernlaag1.js. Wat er in dit deel zit, in deze volgorde:
     bankregie
     bank
     reis
     fiscaal/regelwacht
     thuis
     koppel
     tafelwensen
     checklijst
     werkvormen
     opvang
     afdelingshotel
     regering */
'use strict';

/* `bankregie` wordt hier verklaard en tot onderaan dit deel gebruikt; daarom
   loopt de grens met deel 4a ervoor en niet erin. */
module.exports = (kern, hulp) => {
  const { FISCAAL_PEILJAAR, LANDEN, accounts, anthropic, betaal, centen, crypto, db, findSupplier, fonds, keyVanCodenaam, ledenAantal, log, magAi, ondernemerpoort, save, schoon, sseToCustomer, sseToOffice, sseToSupplier } = hulp;

/* Bankregie (kern/bankregie.js): de geldinfrastructuur-knop van de boardroom --
   een schakelaar met DRIE standen (partner -> hybride -> eigen) die bepaalt hoe
   RTG Bank clearet: via de externe kaart-naad, als eigen emissie, of allebei.
   Eerst gemount zodat de bank en de kantoor-routes dezelfde regie delen. */
const bankregie = require('../kern/bankregie').maakBankregie({ db, save });
Object.assign(kern, bankregie);
/* RTG Bank (kern/bank): de eigen bank, gebouwd OP het RTG Pay-grootboek en met
   dezelfde dubbele-boekhoud-tucht -- rekeningen met een echt IBAN, storten (langs
   de 3-standen knop), overboeken, de brug van/naar de wallet, uitgaande SEPA achter
   de betaal-naad, en sparen met rente. Klaar om met een knop de eigen bank te worden. */
Object.assign(kern, require('../kern/bank')({ db, save, crypto, schoon, betaal, pay: kern.pay, bankregie, keyVanCodenaam, accounts, sseToCustomer, sseToOffice, anthropic }));
/* De Reiswijzer (kern/reis.js): alle reisregels van elk land -- visum,
   rijrichting, alarmnummer, water, fooi, let-op -- in place op de gedeelde
   LANDEN-tabel gezet, VOOR de Regelwacht zodat de overlay er bovenop komt. */
Object.assign(kern, require('../kern/reis')({ LANDEN }));
/* De Regelwacht (kern/fiscaal/regelwacht.js): belastingen en regels worden
   automatisch bijgewerkt -- een gevalideerde overlay op de gedeelde
   LANDEN-tabel, herstart-vast, met een dagelijkse bron-check. */
Object.assign(kern, require('../kern/fiscaal/regelwacht')({ db, save, LANDEN, peiljaar: FISCAAL_PEILJAAR }));
kern.regelwacht.herstelOverlay();
const regelTimer = setInterval(() => { kern.regelwacht.check().catch(() => {}); }, Number(process.env.FISCAAL_CHECK_MS || 86400000));
if (regelTimer.unref) regelTimer.unref();
/* RTG Thuis (kern/thuis): thuisverhuur van lid aan lid -- ons antwoord op
   Airbnb, met alle premium functies gratis en de Reiswijzer aan boord. De
   commerciele tak (kern/thuis/zakelijk) draait op dezelfde landtabel als de
   rest van het huis: daar komt de logies-btw vandaan. */
Object.assign(kern, require('../kern/thuis')({ db, save, crypto, schoon, reiswijzer: kern.reiswijzer, landVind: kern.landVind, findSupplier, LANDEN }));
/* De werkvloer-laag: de koppellaag (kern/koppel.js) zet een handeling van
   het ene scherm op het andere -- betalen op afstand met een RTG-code,
   aftekenen voor verzending, tekenen voor ontvangst. De tafellijst
   (kern/tafelwensen.js) brengt allergenen en wensen per stoel bij de
   bediening en per tafel bij de keuken. De checklijst (kern/checklijst.js)
   deel je met je team; iedereen vinkt zelf af. */
Object.assign(kern, require('../kern/koppel')({ db, save, crypto, schoon, dyncode: kern.dyncode, sseToSupplier }));
Object.assign(kern, require('../kern/tafelwensen')({ db, save, crypto, schoon }));
Object.assign(kern, require('../kern/checklijst')({ db, save, crypto, schoon }));
/* De werkvormen (kern/werkvormen.js): elke zaak krijgt automatisch elke
   gereedschapskist die bij haar past -- een zzp'er die ritten rijdt heeft
   de vervoerstools EN de zzp-tools. De afleiding zelf hangt al aan db
   (db.capsVan); dit is de kern-ingang voor de route. */
Object.assign(kern, require('../kern/werkvormen')({ db }));
/* De ONDERNEMING (kern/onderneming): één bedrijfsobject dat bestaat vanaf
   "ik denk erover na" tot een groep met meerdere vennootschappen. Hij hangt
   hier, direct achter de werkvormen, omdat hij hun afleiding samenvoegt met
   twee assen die zij niet kent: de rechtsvorm (zzp, bv, stichting) en de
   levensfase. De boekingen- en bonnen-index komt rechtstreeks uit ../db,
   net als in kern/leverancier.js: O(1) per zaak in plaats van een scan. */
Object.assign(kern, require('../kern/onderneming')({ db, save, crypto, schoon, findSupplier,
  ordersVanZaak: require('../db').ordersVanZaak, boekingenVanZaak: require('../db').boekingenVanZaak,
  /* De aanvraag om een zaak loopt langs de BESTAANDE aanmeldingsstroom
     (gemount in kernlaag2), zodat er geen tweede deur ontstaat naast de deur
     waar een mens voor staat. Zie de kop van kern/onderneming/index.js. */
  aanmeldingen: kern.aanmeldingen,
  /* De poort die elke nieuwe zaak al door de basis loodst. Gelezen en niet
     nagebouwd: twee lijsten die allebei "is deze zaak er klaar voor" beweren,
     lopen uiteen. */
  ondernemerpoort,
  /* Het personeel van een zaak woont in de identiteitskluis (SQLite), niet in
     db.data. De toegangslaag telt en klokt het; namen worden hier niet
     opgehaald. Zie kern/onderneming/toegang.js. */
  staffLijst: (code) => accounts.listStaff(code),
  /* De AI-laag van het Ondernemers-OS draait op dezelfde client en dezelfde
     poort als de rest van het huis; zonder sleutel valt hij terug op de eigen
     data. Zie kern/onderneming/ontwerper.js. */
  anthropic, magAi }));
/* De Rechtsvormwacht (kern/onderneming/rechtsvormwacht.js): rechtsvormen --
   Nederlandse en buitenlandse in een register -- worden automatisch bijgewerkt
   in plaats van overgetypt. Zelfde ontwerp als de Regelwacht hierboven: een
   gevalideerde overlay op het gedeelde register, herstart-vast, met een
   dagelijkse bron-check en de ingebouwde tabel als veilige basis. Hij hangt
   direct achter de onderneming, want die tabel is van hem. */
Object.assign(kern, require('../kern/onderneming/rechtsvormwacht')({ db, save }));
kern.rechtsvormwacht.herstelOverlay();
const rvTimer = setInterval(() => { kern.rechtsvormwacht.check().catch(() => {}); },
  Number(process.env.RECHTSVORM_CHECK_MS || 86400000));
if (rvTimer.unref) rvTimer.unref();
/* De Opvang-afdeling (AZC/COA), het Regeringskantoor van de
   minister-president en het eigen hotel van elke afdeling -- alle drie
   kamers van RTG Kantoren. */
Object.assign(kern, require('../kern/opvang')({ db, save, crypto }));
Object.assign(kern, require('../kern/afdelingshotel')({ db, save, crypto }));
Object.assign(kern, require('../kern/regering')({ db, save, crypto, LANDEN,
  regelwacht: kern.regelwacht, bank: kern.bank, opvang: kern.opvang, afdelingen: kern.afdelingen, ledenAantal }));
/* Pay draait op de eigen bank zodra die live is: een saldotekort in de wallet
   wordt eerst gedekt vanaf de eigen betaalrekening (eigen rails), en pas
   daarna via de kaart-naad. Late binding, want de bank bouwt op pay. */
kern.pay.koppelBank(({ codenaam, centen }) => bankregie.bankLedenAan()
  ? kern.bank.bankDekWallet({ codenaam, centen })
  : { status: 403, error: 'De leden-bank is niet live.' });
/* Cutover-reconcile: draait de wallet in motor-modus (RTG_MOTOR_GELD=motor), dan
   is de Rust-motor de autoriteit -- neem bij het opstarten de saldi-spiegel over
   uit de motor-snapshot, zodat we altijd in lockstep starten (ook na een crash of
   nadat de motor los is bijgewerkt). No-op in de standaard schaduw-modus. */
if (kern.pay.geldModus === 'motor') {
  Promise.resolve(kern.pay.reconcileVanMotor())
    .then(r => {
      if (r && r.ok && !r.overgeslagen) log.info('motor-reconcile', { rekeningen: r.rekeningen, som: r.som });
      else if (r && r.error) log.warn('motor-reconcile mislukt', { fout: r.error });
    })
    .catch(e => log.warn('motor-reconcile uitzondering', { fout: e.message }));
}
// Zelfde herstart-reconcile voor het BANK-grootboek (tweede motor-ledger).
if (kern.bank.geldModus === 'motor') {
  Promise.resolve(kern.bank.reconcileVanMotor())
    .then(r => {
      if (r && r.ok && !r.overgeslagen) log.info('motor-reconcile bank', { rekeningen: r.rekeningen, som: r.som });
      else if (r && r.error) log.warn('motor-reconcile bank mislukt', { fout: r.error });
    })
    .catch(e => log.warn('motor-reconcile bank uitzondering', { fout: e.message }));
}
/* De RTFoundation-afdracht over de eigen rails: staat de knop effectief op
   "eigen" (en niet in nood), dan boekt de 30% als grootboekboeking van de
   reserve naar de foundation-tegenrekening. Anders geeft de naad null terug
   en volgt fonds.js gewoon de bestaande betaal-naad. Late binding, want het
   fonds is eerder gemount dan de bank. */
fonds.koppelBank(async ({ centen, referentie, oms }) => {
  const c = bankregie.bankClearing();
  if (c.modus !== 'eigen') return null;
  return kern.bank.boekAsync({ van: 'rtg:reserve', naar: 'extern:foundation', centen, soort: 'afdracht', oms, ref: referentie });
});
};
