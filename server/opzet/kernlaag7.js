/* DE KERN SAMENSTELLEN -- deel 7 van 7.
   Waarom er op positie is geknipt en wat `kern` en `hulp` zijn: zie de kop van
   ./kernlaag1.js. Wat er in dit deel zit, in deze volgorde:
     gegevenspoort
     gegevensgesprek
     werkbijlogin
     vonk
     voorspel
     synergie
     balans
     rahul
     rahul
     rahul-fases
     theater
     rtfos */
'use strict';

module.exports = (kern, hulp) => {
  const { accounts, archief, crypto, db, findSupplier, haversine, keyVanCodenaam, klokVan, leeftijdVan, logActivity, notify, openVacatures, notifySupplier, path, rememberSession, save, schoon, sseToCustomer, sseToOffice, supplierState, zetRtgai } = hulp;

/* De gegevenspoort (kern/gegevenspoort.js + kern/gegevensgesprek.js): een gratis
   account vraagt vier dingen; pas als er een DERDE PARTIJ bij komt (een zaak, een
   koerier) vraagt Rahul in een gesprek precies wat die handeling nodig heeft. */
{
  const poort = require('../kern/gegevenspoort').maakGegevenspoort({
    accounts, getMemberState: accounts.getMemberState
  });
  /* `onboarding` gaat mee omdat de adresstap de woonplaats bijschrijft in het
     onboardingprofiel: sinds de velden een MOMENT dragen is dat de enige
     voeding van het stad-facet in kern/ledenregister.js. Zonder deze regel
     verliest de boardroom stil zijn indeling per plaats. */
  const gesprek = require('../kern/gegevensgesprek').maakGegevensgesprek({
    accounts, gegevenspoort: poort, saveMemberState: accounts.saveMemberState,
    getMemberState: accounts.getMemberState, schoon, onboarding: kern.onboarding
  });
  Object.assign(kern, {
    gegevensPoort: poort.poort, gegevensNodig: poort.ontbreekt, gegevensStop: poort.stop,
    gegevensStart: gesprek.gegevensStart, gegevensZeg: gesprek.gegevensZeg
  });
}
/* Werk bij het inloggen (kern/werkbijlogin.js): wie een werkplek heeft, krijgt
   die er bij het inloggen meteen bij -- geen tweede inlog en geen pincode. Het
   werkvenster van de werkgever bepaalt of hij open of dicht is. */
Object.assign(kern, require('../kern/werkbijlogin').maakWerkBijLogin({
  accounts, crypto, findSupplier, magWerken: kern.magWerken, rememberSession,
  logInlog: kern.logInlog, logActivity, supplierState
}));
/* RTG Vonk (kern/vonk.js): dating op codenaam met de Salon-veiligheidslat
   (18+ en KYC via de podium-poort), een eindige dagselectie, en bij een
   match automatisch een tafel bij een partner rond het midden van de twee
   woonplaatsen (EUR 10 p.p. vooraf: EUR 5 RTG, EUR 5 aanbetaling zaak). */
Object.assign(kern, require('../kern/vonk').maakVonk({
  db, save, crypto, schoon, accounts, leeftijdVan, codenaamVan: kern.codenaamVan, keyVanCodenaam,
  haversine, findSupplier, reserveerTafel: kern.reserveerTafel, pay: kern.pay, notify, sseToCustomer, sseToOffice
}));
/* De voorspeller (kern/voorspel.js): leert het ritme van elk lid en elke
   zaak uit het RTG Pay-grootboek (de ene bron waar elke app in boekt) en
   zet verwachtingen klaar voor de apps en voor Rahul. */
Object.assign(kern, require('../kern/voorspel').maakVoorspel({ db, findSupplier }));

/* RTG Synergie (kern/synergie.js): zaken maken samen deals en pakketten;
   pas als elke deelnemer heeft getekend staat het pakket live, en RTG Pay
   splitst elke aankoop exact volgens de afgesproken aandelen. */
Object.assign(kern, require('../kern/synergie').maakSynergie({
  db, save, crypto, schoon, findSupplier, notifySupplier, pay: kern.pay
}));

/* RTG Balans (kern/balans.js): Rahul kijkt naar agenda, rooster en
   eetpatroon en adviseert ook eens niks: rust, hobby's, ontprikkelen;
   zonder dwang en zonder iets nieuws over het lid vast te leggen. */
Object.assign(kern, require('../kern/balans').maakBalans({
  db, zorgVan: kern.zorgVan, klokVan
}));

/* De AI-regie: de boardroom kan Rahuls karakter en verhaal aanvullen
   (kern/rahul.js leest het profiel live uit de database; de vaste kern
   blijft in de code en wordt door de drift-tests bewaakt). */
require('../kern/rahul').zetRahulBron(() => db.data.rahulProfiel || null);

/* De omgangsvormen van Rahul (kern/rahul.js, rahulLeadVoor): het geslacht van
   het lid komt uit het eigen profiel (v/m/x). Volwassen leden krijgen de
   vrouw-/man-vorm; minderjarige leden (15-17) krijgen het kind-hart (het grote
   luisterende oor); onbekend geeft null en dan blijft Rahul neutraal. */
/* Hoe Rahul zich verhoudt tot dit lid. Dit liep op GESLACHT en loopt nu op
   wat het lid ZELF heeft gekozen (kern/rahul-omgang.js legt uit waarom).
   Leeftijd telt nog wel: onder de 18 het kind-hart, en de plagerige stand
   bestaat alleen voor volwassenen. */
require('../kern/rahul').zetGeslachtBron((key) => {
  const m = /^user-(\d+)$/.exec(String(key || ''));
  if (!m) return null;
  let md = null;
  try { md = accounts.getMemberState(Number(m[1])); } catch (e) { return null; }
  if (!md) return null;
  let lft = null;
  if (md.geboren) {
    const g = new Date(md.geboren), nu2 = new Date();
    lft = nu2.getFullYear() - g.getFullYear();
    if (nu2 < new Date(nu2.getFullYear(), g.getMonth(), g.getDate())) lft -= 1;
  }
  /* De levensfase (kern/rahul-fases.js) bepaalt in welke ROL Rahul staat:
     kind, scholier, student, volwassen of senior. De leeftijd geeft de
     standaard, het lid mag hem bijstellen, en faseVoor() bewaakt dat een
     minderjarige alleen tussen kind en scholier kan kiezen. */
  const fase = require('../kern/rahul-fases').faseVoor(lft, md.fase);
  return {
    fase,
    soort: (fase === 'kind' || fase === 'scholier') ? 'kind' : 'volwassen',
    omgang: md.omgang || 'maatje',
    voornaamwoord: md.voornaamwoord || '',
    aanhef: md.aanhef || '',
    // Bij een onbekende leeftijd is het antwoord nee: geen plagerige stand.
    volwassen: lft != null && lft >= 18
  };
});

/* RTG Theater (kern/theater.js): de videobibliotheek op bioscoopniveau.
   Kanalen na menselijke goedkeuring; de bytes blijven origineel (geen
   hercompressie) en staan als bestanden in de datamap, nooit in git. */
Object.assign(kern, require('../kern/theater').maakTheater({
  db, save, crypto, schoon, codenaamVan: kern.codenaamVan, notify, sseToOffice, sseToCustomer,
  mediaDir: path.join(process.env.RTG_DATA_DIR || path.join(__dirname, 'data'), 'theater')
}));
/* De routebedrading staat in ./opzet/routes.js: welke domeinen dit proces
   bedient en welke routers er daarna op de kern worden gehangen. Dat blok is
   de natuurlijke naad van dit bestand -- alles hierboven BOUWT de kern op,
   vanaf daar wordt er alleen nog opgehangen. De volgorde daarbinnen is
   gedrag en geen smaak; zie de kop van dat bestand. */
/* LET OP DE VOLGORDE: dit MOET boven de regel hieronder staan die de routers
   ophangt. routes/rtfos/index.js pakt zijn kern bij het ophangen uit elkaar
   (const { app, officeAuth, rtfos } = kern), dus een kern die pas daarna wordt
   gevuld komt daar nooit meer aan. Stond dit blok eronder, dan hing de hele
   RTFoundation aan een undefined en gaf elke ingang "Cannot read properties of
   undefined" -- 115 toetsen lang, zonder dat de server ook maar iets meldde. */
/* DE ECONOMISCHE NAAD van het stadsweefsel: de kansenlaag leest de vacatures,
   de bedrijven en de beroepen die hier al bestaan, en legt ze op de kaart. Ze
   blijven wonen waar ze wonen -- kern/werk houdt de vacatures bij, de
   partnerlijst de bedrijven, de Beroepen-Bibliotheek de beroepen -- en het
   weefsel is er alleen de LEZER van. Laat gebonden, want alle drie zijn ze
   eerder gemount dan dit punt. */
kern.weefsel.weefselKoppelEconomie({
  vacatures: () => openVacatures(null, null).map(v => ({ id: v.id, code: v.supplierCode, bedrijf: v.bedrijf,
    func: v.func, uren: v.uren, loc: v.loc })),
  bedrijven: () => (db.data.suppliers || []).map(s => ({ code: s.code, naam: s.name, type: s.type || null, loc: s.loc })),
  beroepen: () => {
    const bb = require('../kern/beroepenbieb/data');
    return [...bb.TECHNIEK_BEROEPEN.map(b => ({ beroep: b, wereld: 'techniek', wereldLabel: 'Technisch & agrarisch' })),
      ...bb.ZAKEN_BEROEPEN.map(b => ({ beroep: b, wereld: 'zaken', wereldLabel: 'Bedrijfsleven' }))];
  }
});

/* Het Foundation OS (kern/rtfos/): het bestuurssysteem van de RTFoundation --
   een landelijke stichting met zelfstandige stadsafdelingen, lokale
   partnerstichtingen, projecten, vrijwilligers, geoormerkt geld, hulpvragen en
   verantwoording aan gemeenten. Krijgt boardroomWie/magBoardroom mee: het
   landelijke bestuur IS de boardroom, en de zetels per stad hangen aan dezelfde
   sleutel uit een echte inlog (zie kern/rtfos/basis.js). */
Object.assign(kern, require('../kern/rtfos')({ db, save, crypto,
  // deze twee komen uit de KERN en niet uit hulp: kantoor.js hangt ze daar op
  boardroomWie: kern.boardroomWie, magBoardroom: kern.magBoardroom,
  // en de agenda: dat is de ENIGE koppeling die vandaag echt iets doet
  // (een RTF-activiteit als afspraak in je eigen RTG-agenda). Zonder hem
  // meldt het koppelbord hem eerlijk als kapot, en dat is hij dan ook.
  }));

const gekozenDomeinen = require('./routes')(kern);
/* De meelezer van de RTG AI wordt hierboven in de bedrading gebouwd, maar de
   middleware die hem voedt staat bovenaan dit bestand en sluit over deze
   variabele. Hij wordt daarom HIER gezet en niet in opzet/routes.js: een
   toewijzing aan een binding uit een ander bestand is geen bedrading meer maar
   een verborgen draad terug. Per verzoek uitgelezen, dus dit moment is vroeg
   genoeg. */
zetRtgai(kern.rtgai || null);

/* Archiveren gebeurt bij het opstarten en daarna elk uur. In vloot-modus doet
   alleen het office-domein dit, zodat niet twee processen tegelijk aan de
   orders-collectie trekken. */
if (gekozenDomeinen.includes('office')) {
  try { archief.archiveerNu(); } catch (e) { console.warn('[archief] ronde mislukt:', e.message); }
  const archiefTimer = setInterval(() => {
    try { archief.archiveerNu(); } catch (e) { console.warn('[archief] ronde mislukt:', e.message); }
  }, 3600000);
  if (archiefTimer.unref) archiefTimer.unref();
}


};
