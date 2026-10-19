/* ============================================================================
   DE WERELD KLAARZETTEN VOOR DE HERSTELPROEF -- en waarom dat geen valsspelen is.

   HET PROBLEEM. Het plausibele lijf (scripts/lib/rolproef.js) is voor alle routes
   hetzelfde, en dat kan niet anders: het weet niet welke clip, welke salon of
   welke chauffeurskaart in DEZE database bestaat. Van de 74 vermoede paren
   kwamen er 51 daardoor niet binnen -- en dat zegt iets over de proef en niets
   over het paar. De uitslag stond dan op `nietBeproefd`, eerlijk maar leeg.

   WAT DIT WEL EN NIET IS. Dit zet geen uitslag klaar en zet geen poort open. Het
   zet een schakelaar aan die in een verse database uit staat (de leden-bank), en
   het geeft per route de velden die DIE route nu eenmaal eist. Wat er daarna
   gemeten wordt is onaangeraakt: draait de heenweg, en zet de terugweg hem terug?

   DRIE SOORTEN INGREPEN, en het onderscheid is het hele punt:

     wereld    een schakelaar of een voorziening die er in een verse database
               niet is. Dit gebeurt EEN keer, voor alle paren.
     lijf      de velden die deze route eist. Alleen vorm -- een geldige clipduur,
               een soort relatie, een kaartnummer.
     onbereikbaar  wat een andere WERELD nodig heeft dan deze proef opzet: een
               zaak met de werkvorm journalistiek, een ingericht landpakket, een
               salon met een agenda. Dat wordt NIET nagebouwd; het staat met zijn
               reden in de uitslag, want een proef die zijn eigen meetobject
               verzint, meet zichzelf.

   Zelfde afweging als scripts/lib/idemwereld.js, en om dezelfde reden daar
   uitgeschreven. Wat hier NIET gebeurt is de kredietroutes forceren of een
   poort omzeilen: staat er 403 omdat het huis iets niet toestaat, dan blijft
   dat staan.
   ========================================================================== */
'use strict';

/* ---- 1. DE WERELD: wat er eenmalig aan moet ------------------------------ */
async function zetWereldKlaar({ roep, tokens, aanmeld, tweede }) {
  const gedaan = [];
  const sleutels = {};
  /* De leden-bank staat in een verse database niet live, en dat gaf vier
     bankroutes een 403 met "De RTG Bank is nog niet live voor leden". Een
     schakelaar, geen slot -- en hij gaat om via de gewone kantoorroute. */
  const r = await roep('/api/office/bank/leden', tokens.office, { aan: true });
  if (r.status >= 200 && r.status < 300) gedaan.push('leden-bank aan');

  /* DE REKENING EEN KEER, EN ONTHOUDEN. /api/bank/akkoord geeft de rekening
     alleen bij de EERSTE oproep mee; daarna antwoordt hij kort. Elk bankpaar
     zijn eigen akkoord laten doen, gaf dus bij het tweede paar 404 "De rekening
     bestaat niet" -- terwijl die rekening er stond. Een gegeven dat maar een
     keer wordt uitgedeeld, hoort bij de wereld en niet bij een paar. */
  const ak = await roep('/api/bank/akkoord', tokens.member, {});
  const iban = ak && ak.data && ak.data.rekening && ak.data.rekening.iban;
  if (iban) { sleutels.iban = iban; gedaan.push('een rekening voor het lid'); }

  /* EEN TWEEDE LID, want een vaste betaling vraagt een TEGENrekening die
     bestaat -- en een extern voorbeeld-IBAN is dat niet ("De tegenrekening
     bestaat niet"). Zelfde ingreep als scripts/lib/idemwereld.js, en om dezelfde
     reden: geld sturen vraagt iemand anders. */
  /* `tweede` is een PROEFLID met een gebonden toestel (./proeftoestel.js): de
     bank vraagt sinds A-P1-04 een eigen account, en een demo-pas kreeg hier een
     403 op /api/bank/akkoord. Zonder `tweede` blijft het de oude weg. */
  if (tweede || aanmeld) {
    const ander = tweede || await aanmeld('/api/login', { tier: 'lifestyle' });
    if (ander && ander.codenaam) sleutels.anderCodenaam = ander.codenaam;
    if (ander && ander.token) {
      const ak2 = await roep('/api/bank/akkoord', ander.token, {});
      const iban2 = ak2 && ak2.data && ak2.data.rekening && ak2.data.rekening.iban;
      if (iban2) { sleutels.naarIban = iban2; gedaan.push('een tweede lid met een rekening'); }
    }
  }
  /* GELD OP DE PAS EN IN DE KASSA (18 oktober 2026), voor de geldparen uit de
     domeinlijst van scripts/herstel.js. Een tegoed kopen vraagt saldo, en geld
     apart zetten vraagt omzet bij de zaak -- die komt van een kascode van het
     lid, ingeind aan de kassa, langs de gewone routes en hun eigen poorten. */
  const op = await roep('/api/pay/oplaad', tokens.member, { centen: 20000, idem: 'herstelwereld-' + vers() });
  if (op && op.status >= 200 && op.status < 300) gedaan.push('saldo op de pas van het lid');
  if (tokens.supplier) {
    const kas = await roep('/api/pay/kascode', tokens.member, { centen: 10000, idem: 'herstelwereld-' + vers() });
    const code = kas && kas.data && (kas.data.code || (kas.data.kascode && kas.data.kascode.code));
    if (code) {
      const v = await roep('/api/supplier/pos/sale', tokens.supplier,
        { total: 100, method: 'rtgpay', payCode: code, idem: 'herstelwereld-' + vers() });
      if (v && v.status >= 200 && v.status < 300) gedaan.push('omzet bij de zaak');
      /* De kascode is daarmee gebruikt; de kascode van het paar is een verse. */
    }
  }
  return { gedaan, sleutels };
}
const vers = () => Math.random().toString(36).slice(2, 10);
/* Een dag een eind vooruit, uit de klok; zie `straks` verderop. */
const dagNa = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
let careDag = 0;

/* ---- 2. HET LIJF: de velden die deze route eist -------------------------- */
/* Per route, met de reden waarom dat veld er moet zijn -- overgenomen uit het
   antwoord van de route zelf en niet gegokt. Dit gaat over VORM: een clip die
   1 tot 60 seconden duurt, een relatie met een bestaande soort. Wie hier een
   uitkomst probeert te sturen, is de proef aan het schrijven in plaats van de
   wereld. */
const LIJVEN = Object.freeze({
  '/api/clips/maak': { duurS: 12 },
  /* `soort` is bij een pas de PASsoort en niet het woord uit het plausibele
     lijf; zonder dit gaf de voorziening 400 en had de heenweg geen pas. */
  '/api/bank/pas/uitgeven': { soort: 'debit' },
  /* Een vers adres per poging: publiceren op een bezet adres geeft 409, en de
     opwarmronde bezet het adres van de meetronde. */
  '/api/site/publiceer': () => ({ adres: 'proef-' + Math.random().toString(36).slice(2, 9) }),
  '/api/supplier/site/publiceer': () => ({ adres: 'proef-' + Math.random().toString(36).slice(2, 9) }),
  /* Beide rekeningen komen uit de wereld: een vaste betaling gaat van het lid
     naar het tweede lid. Hier eerst een extern voorbeeld-IBAN als tegenrekening,
     en dat gaf "De tegenrekening bestaat niet" -- een vaste betaling binnen dit
     huis wijst naar een rekening die er is. */
  /* `idem` hoort erbij sinds main: een opdracht die geld verplaatst vraagt een
     idempotentiesleutel. VERS per poging, en dat is de hele les: met een vaste
     sleutel gaf de meetronde keurig 200 en veranderde niets -- de route deed
     precies waar hij voor is gebouwd, want de opwarmronde had die sleutel al
     gebruikt. Een proef die met een herhaalsleutel meet, meet de herhaling en
     niet de handeling. */
  '/api/bank/terugkerend/zet': (k) => ({ vanIban: k.iban, naarIban: k.naarIban,
    centen: 100, interval: 'maand', oms: 'proef',
    idem: 'herstelproef-' + Math.random().toString(36).slice(2, 10) }),

  /* DE GELDPAREN uit DOMEINPAREN in scripts/herstel.js. Elk veld komt uit de
     foutmelding van de route zelf (dezelfde waarden als scripts/lib/idemwereld.js),
     en elke `idem` is vers per poging -- om dezelfde reden als hierboven. */
  '/api/pay/kascode': () => ({ centen: 100, idem: 'herstelproef-' + vers() }),
  '/api/pay/verzoek': (k) => ({ aan: [k.anderCodenaam], totaalCenten: 500, oms: 'proefklompje', idem: 'herstelproef-' + vers() }),
  '/api/pay/tegoed/koop': (k) => ({ centen: 500, aan: k.anderCodenaam, oms: 'prooftegoed', idem: 'herstelproef-' + vers() }),
  /* Een tegoed dat nog loopt, neemt de route alleen terug MET intrekken: de
     code mag dan niet meer werken (kern/pay/tegoed.js). Zonder die vlag gaf zij
     409 "terugnemen kan pas na de vervaldatum" -- de route zegt zelf hoe. */
  '/api/pay/tegoed/terug': () => ({ intrekken: true, idem: 'herstelproef-' + vers() }),
  '/api/supplier/giftcard/sell': () => ({ bedrag: 25, idem: 'herstelproef-' + vers() }),
  /* Een VERSE naam per poging. Apart zetten onder een naam die al bestaat, TELT
     BIJ dat oormerk op (kern/waarde/oormerk.js), en vrijgeven geeft het hele
     oormerk vrij. Met een vaste naam stond het oormerk van de opwarmronde er
     nog, zette de meetronde er 50 cent bij en gaf de terugweg het geheel vrij
     -- inclusief het restant van de opwarming. Dan meet je het restant en niet
     het paar; zelfde les als het verse adres bij publiceren. */
  '/api/supplier/pay/treasury/apart': () => ({ naam: 'Proefoormerk ' + vers(), centen: 50, doel: 'btw' }),
  '/api/wallet/voeg': () => ({ soort: 'klantenkaart', titel: 'Proefkaart', code: 'PROEF-' + vers() }),
  /* De terugweg van een weggehaalde regel is een NIEUWE regel, dus zonder het
     id van de oude: met dat id gaf regelZet 404 "deze regel bestaat niet". */
  '/api/geld/beleid/zet': () => ({ soort: 'minimumbuffer', drempelCenten: 10000, niveau: 'kijken', id: undefined }),

  /* EEN VERS TIJDSLOT PER POGING bij Care. De opzoeking vindt EEN behandeling
     met haar vaste tijden, en die tijden hangen niet aan een dag: de agenda
     van de behandelaar is per (dag, tijd) schaars (kern/care/leden.js). De
     opwarmronde bezette dus het slot van de meetronde, en de heenweg kreeg 409
     "Dat tijdslot is al bezet" -- van zijn eigen opwarming. Een andere DAG per
     poging geeft elke boeking een vrij slot, zonder de bezetregel te raken:
     dezelfde les als het verse adres bij publiceren hierboven. */
  '/api/care/boek': () => ({ datum: dagNa(3 + (++careDag)) }),
  /* DE BESCHERMZAAK KENT GEEN NAAM, en het plausibele lijf stuurt er een mee
     (`naam`, `email`). De klasse weigert die velden hard
     (kern/beschermzaak/klasse.js, WEIGERT) -- terecht, en dat blijft zo. Het
     lijf hoort dus te sturen wat deze route vraagt: een aanleiding en een korte
     feitelijke omschrijving; de codenaam maakt de zaak zelf. `undefined` valt
     bij het versturen weg, zodat de velden echt ontbreken. */
  '/api/rtfos/bescherming/open': { naam: undefined, email: undefined,
    aanleiding: 'anders', wat: 'Proefzaak: een korte feitelijke omschrijving zonder namen.' },
  '/api/rtfos/bescherming/sluit': { naam: undefined, email: undefined,
    uitkomst: 'Proefzaak afgerond.', bewaarDagen: 30, bewaarWaarom: 'Proeftermijn van de herstelproef.' },

  '/api/member/rtmail/regel/maak': { veld: 'onderwerp', bevat: 'proef', actie: 'etiket', waarde: 'proef' },
  '/api/supplier/rtmail/regel/maak': { veld: 'onderwerp', bevat: 'proef', actie: 'etiket', waarde: 'proef' },
  '/api/office/weefsel/relatie/maak': { soort: 'voedt' },
  '/api/staff/mob/cdt/aanmelden': { chauffeurskaart: 'PROEF-0001' },
  '/api/staff/mob/cdt/afmelden': { chauffeurskaart: 'PROEF-0001' },
  /* Geen plaatsnamen maar coordinaten: plekBepaal() kent `zaak`, `halte`,
     `favoriet`, `hier` en een punt op de kaart -- en een string hoort er niet
     bij. "Amsterdam" gaf dus 400, en dat was mijn lijf en niet de route. */
  '/api/mob/reis/boek': { van: { lat: 52.37, lng: 4.89, label: 'Proefpunt' },
    naar: { lat: 51.92, lng: 4.48, label: 'Proefdoel' } }
});

/* ---- 2b. DE VOORZIENING: eerst het onderwerp laten ontstaan -------------- */
/* Sommige routes hebben geen VELD nodig maar een DING: publiceren vraagt een
   website, binnenkomen vraagt een kamer, een pas uitgeven vraagt een rekening.
   Dat ding wordt hier langs de gewone route aangemaakt -- met zijn eigen poort
   ervoor -- en de identificerende velden uit dat antwoord reizen mee.

   Dit is geen omweg om een poort: valt de voorziening om, dan blijft de
   heenweg gewoon falen en heet het paar `nietBeproefd`. */
const VOORZIENINGEN = Object.freeze({
  '/api/site/publiceer': '/api/site/bewaar',
  '/api/site/live': ['/api/site/bewaar', '/api/site/publiceer'],
  '/api/supplier/site/publiceer': '/api/supplier/site/bewaar',
  '/api/supplier/site/live': ['/api/supplier/site/bewaar', '/api/supplier/site/publiceer'],
  '/api/meet/kom': '/api/meet/maak',
  '/api/meet/verlaat': ['/api/meet/maak', '/api/meet/kom'],
  '/api/agenda/bewaar': '/api/agenda/toevoegen',
  '/api/bank/pas/uitgeven': '/api/bank/akkoord',
  '/api/bank/pas/sluit': ['/api/bank/akkoord', '/api/bank/pas/uitgeven'],
  '/api/bank/terugkerend/zet': '/api/bank/akkoord',
  '/api/bank/terugkerend/stop': ['/api/bank/akkoord', '/api/bank/terugkerend/zet']
});

/* ---- 2c. DE OPZOEKING: het onderwerp bestaat al -------------------------- */
/* HET VERSCHIL MET EEN VOORZIENING, en dat is het hele punt van deze laag.
   Een voorziening MAAKT het onderwerp (publiceren vraagt een website, dus
   bewaren we er een). Een opzoeking maakt niets: zij LEEST wat de zaaiset al
   heeft gezet en geeft de identificerende velden door.

   WAAROM DIT GEEN VERZINNEN IS. De regel boven dit bestand zegt dat een proef
   die zijn eigen meetobject verzint zichzelf meet, en die regel staat overeind.
   Hier wordt niets gemaakt: de salon, de zorgaanbieder en hun behandelingen
   staan in de zaaiset, en dit haalt hun eigen codes op langs de gewone
   leesroute. Wie dat niet doet, meet niet de terugweg maar zijn eigen
   onwetendheid over welke salon er in DEZE database staat.

   HET VERSCHIL MET EEN LIJF is dat een lijf VORM is (een clip duurt 12
   seconden) en dit IDENTITEIT (deze salon, deze behandeling, dit vrije uur).
   Een lijf kun je opschrijven; dit moet je vragen.

   HET WAS EEN ONJUISTE REDEN EN GEEN ONTBREKENDE WERELD. Hieronder stond
   `'/api/verzorging/boek': 'een salon in de zaaiset'` -- gemeten op 6 september
   2026 geeft /api/verzorging de salon VELVET met behandeling b1 en achttien
   vrije tijden, en /api/care de aanbieder zenith met zt1. Die werelden waren er
   dus; wat ontbrak was de opzoeking. Een paar dat `wereldOntbreekt` heet
   terwijl de wereld er staat, is een meetfout die eruitziet als een besluit --
   en juist die vorm houdt zichzelf jaren in stand.

   EEN OPZOEKING MAG NIETS TERUGGEVEN. Vindt zij niets (een lege zaaiset, een
   agenda zonder vrij uur), dan blijft het paar gewoon falen op de heenweg en
   heet het `nietBeproefd`. Zij verzint dan geen tweede kandidaat. */

/* Een datum een eind vooruit, uit de klok en nooit vast opgeschreven. Beide
   boekroutes eisen `datum >= vandaag()`; een vaste datum in dit bestand zou op
   de dag erna stilletjes gaan zakken, en dat is precies de fout die
   test/experience-platform.e2e.test.js een keer heeft gemaakt. */
const straks = () => new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);

const OPZOEKINGEN = Object.freeze({
  /* De salon: code, behandeling en een vrij uur horen bij ELKAAR. Ze los
     ophalen geeft een behandeling van de ene salon op een uur van de andere,
     en dan meet je een 409 in plaats van een terugweg. */
  '/api/verzorging/boek': async ({ roep }) => {
    const datum = straks();
    const r = await roep('/api/verzorging', { datum });
    const aanbieders = (r && r.data && r.data.aanbieders) || [];
    for (const a of aanbieders) {
      const b = (a.behandelingen || []).find(x => (x.tijden || []).length);
      if (b) return { code: a.code, behandelingId: b.id, datum, tijd: b.tijden[0] };
    }
    return null;
  },
  /* Care wijst zijn aanbieder met `aanbiederId` aan en niet met `code`, en de
     vrije tijden staan bij de behandeling zelf in plaats van per dag. Twee
     domeinen, twee talen -- de proef past zich aan de route aan en niet
     andersom, net als bij `iban` tegenover `vanIban` hierboven. */
  '/api/care/boek': async ({ roep }) => {
    const r = await roep('/api/care', {});
    const aanbieders = (r && r.data && r.data.aanbieders) || [];
    for (const a of aanbieders) {
      const b = (a.behandelingen || []).find(x => (x.tijden || []).length);
      if (b) return { aanbiederId: a.id, behandelingId: b.id, datum: straks(), tijd: b.tijden[0] };
    }
    return null;
  }
});

/* ---- 3. ONBEREIKBAAR: wat een andere wereld vraagt ----------------------- */
/* Dit is geen lijst mislukkingen maar een lijst BESLUITEN: deze paren vragen
   een wereld die deze proef niet opzet, en het nabouwen ervan zou meer
   verzinnen dan meten. Elk draagt wat er zou moeten bestaan. Zij komen in de
   uitslag als `wereldOntbreekt` en niet als `nietBeproefd`, want "wij hebben
   geen krant" is iets anders dan "de proef kwam er niet bij". */
const ONBEREIKBAAR = Object.freeze({
  '/api/supplier/redactie/artikel/bewaar': 'een zaak met de werkvorm journalistiek; deze proef logt in op de zaaizaak',
  '/api/supplier/redactie/artikel/verwijder': 'een zaak met de werkvorm journalistiek; deze proef logt in op de zaaizaak',
  '/api/supplier/redactie/rubriek/bewaar': 'een zaak met de werkvorm journalistiek; deze proef logt in op de zaaizaak',
  '/api/supplier/redactie/rubriek/verwijder': 'een zaak met de werkvorm journalistiek; deze proef logt in op de zaaizaak',
  '/api/command/stad/start': 'een ingericht landpakket; een stad in een land zonder inrichting is een stad zonder munt',
  '/api/command/stad/stop': 'een ingericht landpakket; een stad in een land zonder inrichting is een stad zonder munt',
  '/api/thuis/boek': 'een huis in de zaaiset',
  '/api/thuis/annuleer': 'een huis in de zaaiset',
  '/api/rtfos/meldcode/open': 'een stadsafdeling in de zaaiset',
  '/api/rtfos/meldcode/sluit': 'een stadsafdeling in de zaaiset',
  /* Gemeten op 18 oktober 2026, met het lijf dat de beschermzaak WEL vraagt
     (zie LIJVEN): de heenweg geeft dan 404 "Deze stadsafdeling bestaat niet".
     Een beschermzaak hangt aan een stad, net als het meldcode-dossier hierboven,
     en de zaaiset heeft er geen. Zelfde besluit als bij de meldcode: de proef
     richt geen stad in om zichzelf iets te meten te geven. Het lijf blijft
     staan, zodat dit paar meteen meetbaar is zodra de wereld een stad heeft. */
  '/api/rtfos/bescherming/open': 'een stadsafdeling in de zaaiset; een beschermzaak hangt aan een stad',
  '/api/rtfos/bescherming/sluit': 'een stadsafdeling in de zaaiset; een beschermzaak hangt aan een stad',
  '/api/office/afdelingshotel/boek': 'een afdeling in het afdelingshotel',
  '/api/office/afdelingshotel/annuleer': 'een afdeling in het afdelingshotel',
  '/api/vak/ritme/start': 'een zaak met vaste afspraken',
  '/api/vak/ritme/stop': 'een zaak met vaste afspraken',
  '/api/veiligheid/wacht/start': 'een gevulde kring; deze wacht waarschuwt de kring, dus zonder kring is er niets te waarschuwen',
  '/api/veiligheid/wacht/stop': 'een gevulde kring; deze wacht waarschuwt de kring, dus zonder kring is er niets te waarschuwen',
  '/api/reserveer': 'een partner in de zaaiset',
  '/api/asset/koop': 'een object in de assetlijst',
  '/api/asset/gebruik': 'een object in de assetlijst',
  '/api/reisbureau/boek': 'een reis in het reisbureau',
  '/api/reisbureau/annuleer': 'een reisaanvraag in het reisbureau',
  '/api/residentie/spel/zet': 'een lopend potje in de residentie',
  '/api/residentie/spel/stop': 'een lopend potje in de residentie',
  '/api/mob/reis/boek': 'een geplande reisoptie; boeken gaat op een optie uit een reisplan en niet op twee punten',
  '/api/mob/reis/annuleer': 'een geboekte reis, en die vraagt eerst een geplande reisoptie',
  '/api/annuleer': 'een boeking in de zaaiset; het soort (order, ride, boeking) is een veld, maar het ding moet bestaan',
  '/api/office/weefsel/relatie/maak': 'een stadsweefsel met objecten aan beide kanten van de relatie',
  '/api/office/weefsel/relatie/weg': 'een stadsweefsel met objecten aan beide kanten van de relatie',

  /* Vier families die met main meekwamen. Alle vier vragen zij een IDENTITEIT
     die deze proef niet heeft: een gezinssessie, een klastoken, een bedrijf,
     een geregistreerd vermogen. Dat is geen poort die dichtzit maar een wereld
     die er niet is -- en hem nabouwen zou betekenen dat de proef zichzelf een
     gezin toekent. */
  '/api/rtf/kantoorpakket/maak': 'een ingelogd gezin (RTFoundation); de proef heeft een lid, geen gezin',
  '/api/rtf/kantoorpakket/weg': 'een ingelogd gezin (RTFoundation); de proef heeft een lid, geen gezin',
  '/api/rtf/samen/maak': 'een ingelogd gezin (RTFoundation); de proef heeft een lid, geen gezin',
  '/api/rtf/samen/weg': 'een ingelogd gezin (RTFoundation); de proef heeft een lid, geen gezin',
  '/api/foundation/school/les/start': 'een klas met een geldig klastoken',
  '/api/foundation/school/les/stop': 'een klas met een geldig klastoken',
  '/api/foundation/school/excursie/start': 'een klas met een geldig klastoken',
  '/api/foundation/school/excursie/stop': 'een klas met een geldig klastoken',
  '/api/foundation/school/machtiging/zet': 'een school en een gezin met een gezinscode',
  '/api/foundation/school/machtiging/stop': 'een school en een gezin met een gezinscode',
  '/api/werkplek/kantoorpakket/maak': 'een bedrijf waar dit lid werkt; de werkplekpoort kijkt eerst naar het bedrijf',
  '/api/werkplek/kantoorpakket/weg': 'een bedrijf waar dit lid werkt; de werkplekpoort kijkt eerst naar het bedrijf',
  '/api/command/incident/open': 'een geregistreerd vermogen in de ops-cockpit; een incident hangt aan een vermogen',
  '/api/command/incident/sluit': 'een geregistreerd vermogen in de ops-cockpit; een incident hangt aan een vermogen'
});

/* Een lijf mag een FUNCTIE zijn van wat de voorziening opleverde. Twee redenen,
   allebei uit een gezakte ronde: een website-adres moet per poging vers zijn
   (een tweede keer publiceren op hetzelfde adres geeft 409 "al bezet"), en de
   bankroutes noemen dezelfde rekening niet overal hetzelfde -- `iban` bij het
   uitgeven van een pas, `vanIban` bij een vaste betaling. Dat laatste is geen
   slordigheid van dit huis maar de taal van die route, en de proef hoort zich
   daaraan aan te passen in plaats van andersom. */
const lijfVoor = (pad, uitVoorziening) => {
  const l = LIJVEN[pad];
  return typeof l === 'function' ? l(uitVoorziening || {}) : (l || {});
};
/* Een voorziening mag een KETEN zijn: live-zetten vraagt een gepubliceerde
   site, en publiceren vraagt een bewaarde. */
const voorzieningVoor = (pad) => {
  const v = VOORZIENINGEN[pad];
  return v ? (Array.isArray(v) ? v : [v]) : null;
};
const onbereikbaar = (pad) => ONBEREIKBAAR[pad] || null;
/* Een opzoeking is ASYNC: zij stelt een echte vraag aan de server. */
const opzoekingVoor = (pad) => OPZOEKINGEN[pad] || null;

module.exports = { zetWereldKlaar, lijfVoor, voorzieningVoor, onbereikbaar, opzoekingVoor,
  LIJVEN, VOORZIENINGEN, ONBEREIKBAAR, OPZOEKINGEN };
