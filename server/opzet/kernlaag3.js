/* DE KERN SAMENSTELLEN -- deel 3 van 7.
   Waarom er op positie is geknipt en wat `kern` en `hulp` zijn: zie de kop van
   ./kernlaag1.js. Wat er in dit deel zit, in deze volgorde:
     luchthaven
     marechaussee
     uitgifte
     sportclub
     drm
     redactie
     ideeen
     huisdb
     atelier
     studio
     hardwarelab
     architect
     redactie
     ideeen
     hulpdienst
     zorgketen
     ketenchat
     defensie
     rampbeeld
     vakwerk
     pay
     keuken
     verblijf
     hoteldorp
     gastzorg
     assets
     lifestyle
     rechterhand

   Het Privekantoor en wat eromheen hangt (levensgraaf, bureau, postdatum) staat
   in ./kernlaag3b.js -- zie de kop daar waarom die drie bij elkaar horen. */
'use strict';

module.exports = (kern, hulp) => {
  const { DATA_DIR, accounts, anthropic, betaal, betaalOpdrachten, bijeen, boekingenVanZaak, boekingenVoegToe, crypto, db, etaMinutes, findSupplier, haversine, keyVanCodenaam, liveCodename, notify, notifySupplier, save, schoon, sseToCustomer, sseToSupplier } = hulp;

/* RTG Airport (kern/luchthaven.js): de gehele luchthavenoperatie ·
   vluchtleiding, passagiersketen (boeken/inchecken op codenaam), de draai op
   het platform, de toren (baanklaring), de bagagekelder en security. */
Object.assign(kern, require('../kern/luchthaven').maakLuchthaven({ db, save, crypto, anthropic,
  visumtaakVan: () => kern.visumtaak }));
kern.lucht.seed();
/* De Brigade RTG Airport (kern/marechaussee.js): de Koninklijke Marechaussee
   op het veld · grensbalie (passagierslijst op codenaam), patrouilles,
   incidenten en de AI-wachtcommandant. */
Object.assign(kern, require('../kern/marechaussee').maakMarechaussee({ db, save, crypto, anthropic }));
kern.kmar.seed();
/* De documentenuitgifte (kern/uitgifte.js): officiele documentatie met een
   druk op de knop overschrijven naar oude apparatuur of een harde schijf,
   altijd achter het vier- of zes-ogenprincipe (zaak, RTG-kantoor, rijk). */
Object.assign(kern, require('../kern/uitgifte').maakUitgifte({ db, save, crypto }));
/* RTG Sportclub (kern/sportclub.js): het stadion met eigen plattegrond,
   tickets met horeca en wc's, teams van jeugd tot eerste, veldbeheer,
   trainingskampen (RTG beslist), sponsors, momenten en de financien. */
Object.assign(kern, require('../kern/sportclub').maakSportclub({ db, save, crypto, anthropic }));
kern.sport.seed();
/* RTG contentbescherming (kern/drm.js): de DRM-route (Encrypted Media
   Extensions, Clear Key door RTG zelf bediend) voor de beschermde media. */
Object.assign(kern, require('../kern/drm').maakDrm({ db, save, crypto }));
/* De Ideeenkamer (kern/ideeen.js): de gedeelde werkbank van de vier
   ontwerpbureaus; een idee kan als concept naar elk bureau (spin-off), dus de
   bureaus gaan als referenties mee. */
/* RTG Redactie (kern/redactie.js): het persbureau -- krant, magazine en
   drukkerij, met de AI-hoofdredacteur en de nieuwstips uit het hele platform.
   Doet als volwaardig bureau mee in de Ideeenkamer hieronder. */
Object.assign(kern, require('../kern/redactie').maakRedactie({ db, save, crypto, anthropic, schoon }));
Object.assign(kern, require('../kern/ideeen').maakIdeeen({ db, save, crypto, anthropic, schoon,
  bureaus: { atelier: kern.atelier, studio: kern.studio, hardware: kern.hardware, architect: kern.architect, redactie: kern.redactie } }));
/* Dezelfde zes bureaus nog een keer, nu voor de RTFoundation. De modules
   blijven onaangeraakt; ze krijgen via kern/huisdb.js alleen een andere bril op
   waardoor hun opslagsleutel naar een eigen la wijst (atelier -> atelierRtf).
   Zo ontwerpt de stichting in haar eigen atelier, studio, hardwarelab,
   architectenbureau, redactie en ideeenkamer, zonder dat het werk van RTG en
   dat van de stichting op een hoop belandt. */
const { huisDb, RTF_OMLEIDING, huisNaam } = require('../kern/huisdb');
const rtfBureauCtx = { db: huisDb(db, RTF_OMLEIDING), save, crypto, anthropic, schoon };
Object.assign(kern, huisNaam(require('../kern/atelier').maakAtelier(rtfBureauCtx), 'Rtf'));
Object.assign(kern, huisNaam(require('../kern/studio').maakStudio(rtfBureauCtx), 'Rtf'));
Object.assign(kern, huisNaam(require('../kern/hardwarelab').maakHardwarelab(rtfBureauCtx), 'Rtf'));
Object.assign(kern, huisNaam(require('../kern/architect').maakArchitect(rtfBureauCtx), 'Rtf'));
Object.assign(kern, huisNaam(require('../kern/redactie').maakRedactie(rtfBureauCtx), 'Rtf'));
Object.assign(kern, huisNaam(require('../kern/ideeen').maakIdeeen(Object.assign({}, rtfBureauCtx, {
  bureaus: { atelier: kern.atelierRtf, studio: kern.studioRtf, hardware: kern.hardwareRtf,
    architect: kern.architectRtf, redactie: kern.redactieRtf } })), 'Rtf'));
/* De hulpdiensten (kern/hulpdienst.js): zes korpsen met een meldkamer,
   eenheden over land, water en door de lucht, bijstand tussen korpsen en
   de zorgketen ambulance -> ziekenhuis -> huisarts. */
Object.assign(kern, require('../kern/hulpdienst')({ db, save, crypto, anthropic, findSupplier }));
/* De zorgketen (kern/zorgketen.js): recepten naar de apotheek, de eerste
   hulp met triagekleuren, verwijzingen en de agenda's van de specialist en
   beauty medical. */
/* Het vakbewijs en de persoonseis (kern/vakbewijs.js, kern/persoonseis.js): de
   mensenkant van wat de aanmeldingen al voor de ZAAK doen. Ze staan hier vlak
   VOOR hun eerste lezer -- de zorgketen hieronder toetste het genre van de zaak
   en niet de mens die voorschreef. De identiteitsstand komt laat gebonden uit
   payrollOS: de enige lezer van `verified` in dit huis. */
Object.assign(kern, require('../kern/vakbewijs')({ db, save, schoon, accounts }));
Object.assign(kern, { persoonseis: require('../kern/persoonseis')({
  vakbewijsHeeft: kern.vakbewijsHeeft, sleutelLid: kern.sleutelLid,
  identiteitVan: (p) => kern.payrollOS.identiteit.stand(p.lid) }) });
Object.assign(kern, require('../kern/zorgketen')({ db, save, crypto, findSupplier,
  persoonseis: kern.persoonseis }));
/* De ketenchat (kern/ketenchat.js): korpsen verbinden eenmalig, delen een
   ketenkanaal en maken besloten deelgroepen waar de meldkamer meekijkt. */
Object.assign(kern, require('../kern/ketenchat')({ db, save, crypto, findSupplier }));
/* De defensie-toren (kern/defensie.js): paraatheid, materieel en onderhoud,
   bevoorrading en oefeningen. Logistiek en organisatie, uitdrukkelijk GEEN
   wapensysteem, vuurleiding of doelselectie. */
Object.assign(kern, require('../kern/defensie')({ db, save, crypto, anthropic, findSupplier }));
/* Het gezamenlijke rampbeeld (kern/rampbeeld.js): korpsen, zorg en defensie
   delen tijdens een calamiteit hun paraatheid, vrije bedden en eenheden in
   een overzicht, met een coordinatieniveau. */
Object.assign(kern, require('../kern/rampbeeld')({ db, save, findSupplier, anthropic }));
/* Vakwerk (kern/vakwerk.js): het slimme dashboard voor de dienstverlenende
   genres (zzp, chef, wellness). Zelfde aanbod-/boekingsmodel als voorheen,
   maar met een vandaag-bord, KPI's en een genre-bewuste AI-assistent, zodat
   deze apps op het niveau van de horeca- en hoteltorens komen. */
/* ordersVanZaak komt erbij voor het gedeelde klantenboek (kern/klantenboek.js):
   wie bij dezelfde zaak at maar niet boekte, was daar eerst geen klant. */
Object.assign(kern, require('../kern/vakwerk').maakVakwerk({ db, save, anthropic, findSupplier,
  boekingenVanZaak, ordersVanZaak: require('../db').ordersVanZaak, schoon,
  crypto, notify, notifySupplier, sseToCustomer, sseToSupplier, boekingenVoegToe }));
/* RTG Pay (kern/pay.js): de interne betaallaag met wallet, grootboek,
   tikkies, kassacode en automatisch bijladen via de betaal-naad. */
Object.assign(kern, require('../kern/pay')({ db, save, bijeen, crypto, betaal, keyVanCodenaam, sseToCustomer, schoon, betaalOpdrachten,
  // de geld-regie bepaalt het tarief; als thunk zodat de mount-volgorde niet uitmaakt
  betaaldienstKosten: c => (kern.betaaldienstKosten ? kern.betaaldienstKosten(c) : 0) }));
/* Het keukenbrein (kern/keuken.js): recepten per gerecht, automatische
   voorraad-afboeking bij elke verkoop, telling/verspilling/levering met
   logboek, marges en het inkoopadvies. */
/* DE COMMERCIELE RONDE (kern/commercie/ronde.js): het werk dat wel gebouwd was
   en nooit werd gedaan. Vier lagen legden verplichtingen vast -- mislukte
   betaaldienstboekingen, aflopende contracten, volle AI-tegoeden en drie soorten
   verrekening -- en geen ervan werd door iets opgepakt. Een functie zonder
   beller is stiller dan een ontbrekende functie: de code ziet er compleet uit.

   Hij hangt hier omdat pay net gemount is: de ronde heeft een boekfunctie nodig
   en die zit daar. De losse lagen worden LAAT gelezen (kern.* op het moment van
   draaien), zodat de mount-volgorde van de rest niet uitmaakt. */
Object.assign(kern, (() => {
  const { maakVerrekening } = require('../kern/commercie/verrekening');
  const { maakRonde } = require('../kern/commercie/ronde');
  const prijsmeldingen = require('../kern/commercie/prijsmelding').maakPrijsmeldingen({ db, save });
  const allocatie = require('../kern/commercie/allocatie').maakAllocatie({ db, save });
  const tegoed = require('../kern/commercie/tegoed').maakTegoed({ db, save });
  const verrekening = maakVerrekening({ db, save,
    boekAsync: (b) => kern.pay.boekAsync(b), prijsmeldingen, allocatie,
    rekLid: kern.pay.rekLid, rekPartner: kern.pay.rekPartner });
  const ronde = maakRonde({
    fees: kern.pay.fees, contracten: kern.aanmeldingen && kern.aanmeldingen.contracten,
    tegoed, verrekening, allocatie,
    boekAsync: (b) => kern.pay.boekAsync(b),
    /* Meldingen gaan door het bestaande kanaal; faalt dat, dan mag de ronde niet
       omvallen -- een melding is geen geld. */
    melden: (m) => { try { if (typeof notify === 'function') notify(m.houder || 'kantoor', { icon: 'geld', title: 'RTG', body: m.tekst }); } catch (e) {} },
    env: process.env });
  /* De tik. Zelfde patroon als de opdrachtenronde van de bank: een vaste
     interval die alleen KIJKT, en die zichzelf niet in de weg zit als een ronde
     langer duurt (elke ronde is idempotent). `unref` zodat een test-server niet
     blijft hangen op deze timer.

     Vijf minuten en geen minuut: hier staat geen geld vast dat iemand net heeft
     weggestuurd -- dit zijn verplichtingen die hoe dan ook vandaag worden
     voldaan. Een minuut zou vooral de motor bezighouden. */
  const RONDE_MS = Number(process.env.RTG_COMMERCIE_RONDE_MS || 300000);
  let bezig = false;
  const timer = setInterval(() => {
    if (bezig) return;                 // een ronde die uitloopt, krijgt geen tweede
    bezig = true;
    ronde.draai()
      .catch(e => console.warn('[commercie] ronde mislukt:', e.message))
      .finally(() => { bezig = false; });
  }, RONDE_MS);
  if (timer.unref) timer.unref();

  return { commercieRonde: ronde, commercieVerrekening: verrekening,
    commercieAllocatie: allocatie, commercieTegoed: tegoed, prijsmeldingen };
})());

Object.assign(kern, require('../kern/keuken')({ db, save, crypto, schoon, notifySupplier }));
/* De verblijf-laag (kern/verblijf.js): echte verblijven met datums, het
   receptiebord en de check-in/check-out-keten; logies als kamerlast. */
Object.assign(kern, require('../kern/verblijf')({ db, save, crypto, schoon, findSupplier, notify, notifySupplier, sseToSupplier, sseToCustomer }));
/* Het hoteldorp (kern/hoteldorp.js): negen afdelingen met hetzelfde lichte
   gereedschap: postenlijsten met een eigen statusketen, en het dorpsplein. */
Object.assign(kern, require('../kern/hoteldorp')({ db, save, crypto, schoon, sseToSupplier, notifySupplier, haversine }));
// de zorgvolle keten: zorgprofiel van de gast + live meekijken met toestemming
Object.assign(kern, require('../kern/gastzorg')({ db, save, crypto, schoon, notify, notifySupplier, sseToSupplier, sseToCustomer, findSupplier, haversine, etaMinutes }));
// Toren 3, RTG Shared Assets: 300 tickets per object, Access en Asset
Object.assign(kern, require('../kern/assets')({ db, save, crypto, schoon, notify, pay: kern.pay }));
// De Rechterhand: de premium Lifestyle Pass-suite (concierge, bezittingen, gezondheid)
Object.assign(kern, require('../kern/lifestyle')({ db, save, crypto, anthropic, liveCodename, notify }));
// De extra premium ROS-apps van de Lifestyle Pass: Reisboek, Cellier, Table, Maison
Object.assign(kern, require('../kern/rechterhand')({ db, save, crypto, liveCodename, anthropic, DATA_DIR }));
};
