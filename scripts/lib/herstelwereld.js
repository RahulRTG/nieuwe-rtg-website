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
async function zetWereldKlaar({ roep, tokens, aanmeld }) {
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
  if (aanmeld) {
    const ander = await aanmeld('/api/login', { tier: 'lifestyle' });
    if (ander && ander.token) {
      const ak2 = await roep('/api/bank/akkoord', ander.token, {});
      const iban2 = ak2 && ak2.data && ak2.data.rekening && ak2.data.rekening.iban;
      if (iban2) { sleutels.naarIban = iban2; gedaan.push('een tweede lid met een rekening'); }
    }
  }
  return { gedaan, sleutels };
}

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
  '/api/verzorging/boek': 'een salon in de zaaiset',
  '/api/verzorging/annuleer': 'een salon in de zaaiset',
  '/api/thuis/boek': 'een huis in de zaaiset',
  '/api/thuis/annuleer': 'een huis in de zaaiset',
  '/api/care/boek': 'een zorgaanbieder in de zaaiset',
  '/api/care/annuleer': 'een zorgaanbieder in de zaaiset',
  '/api/rtfos/meldcode/open': 'een stadsafdeling in de zaaiset',
  '/api/rtfos/meldcode/sluit': 'een stadsafdeling in de zaaiset',
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

module.exports = { zetWereldKlaar, lijfVoor, voorzieningVoor, onbereikbaar,
  LIJVEN, VOORZIENINGEN, ONBEREIKBAAR };
