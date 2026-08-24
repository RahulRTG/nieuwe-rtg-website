/* ============================================================================
   DE APP STORE, BETAALDE KANT -- wat een app kost, wie wat krijgt, en waarom
   er geen tweede geldstroom naast RTG Pay staat.

   DE VIJF BEGRIPPEN ERBIJ, EN ER KOMT ER GEEN ZESDE:

     prijs        staat in het MANIFEST, dus per versie, dus door de keuring.
                  Een prijswijziging is een nieuwe versie met een nieuwe
                  handtekening van een mens (./manifest.js).
     aanschaf     een lid koopt EEN keer, voor die app. Updates zijn gratis:
                  de aanschaf hangt aan de app en niet aan de versie.
     bon          wat er precies is betaald -- bruto, btw, afdracht, netto --
                  en die is ONVERANDERLIJK. Ook als de afdracht morgen anders
                  is, blijft er staan wat er die dag gold.
     afdracht     het deel dat RTG inhoudt. Percentage door de eigenaar gezet,
                  met een reden en een journaalregel, en bevroren op de bon.
     teruggaverecht  wat er ontstaat als RTG of de uitgever een app intrekt die
                  een lid heeft gekocht. Het wordt KLAARGEZET; een mens beslist.

   DRIE GRENZEN DIE HIER WORDEN AFGEDWONGEN.

   1. KOPEN GEBEURT IN DE WINKEL, NOOIT IN DE APP. De brug kent geen methode die
      geld beweegt, en die komt er ook niet. GELD.md par. 3 zegt dat geld het
      huis nooit vanzelf verlaat en dat alles wat een derde raakt maximaal
      "klaarzetten" is; een aankoopknop IN een app van een derde is precies de
      autonome betaling die daar verboden wordt. Het lid koopt op een scherm van
      RTG, met de bon ervoor.

   2. ER IS GEEN TWEEDE GELDSTROOM. De aanschaf loopt over RTG Pay
      (kern/pay/verkoop.js), de opbrengst landt op de bestaande partnerrekening
      van de zaak, en uitbetalen is de weg die er al was -- manager-only, naar de
      bank. Dit bestand boekt niets zelf en telt geen saldi (LAT-regel 4).

   3. DE BTW HOORT BIJ HET LAND VAN HET LID. Dat is de wet voor een digitale
      dienst en niet onze keuze; kern/fiscaal/digitaal.js legt uit waarom dat een
      ander antwoord is dan het tarief van de zaak. Zonder bekend land geen
      aanschaf -- raden mag niet.
   ========================================================================== */
'use strict';

const { splitsBruto } = require('../fiscaal/digitaal');

/* De afdracht staat op nul tot de eigenaar hem zet, en dat is geen slappe
   standaard maar de bestaande belofte van dit huis: "RTG rekent 0% commissie:
   de partner houdt 100% van elke boeking" (server/seed/leveranciers.js). Wie
   daarvan afwijkt voor apps, doet dat bewust, met een reden, en het staat in het
   journaal. */
const AFDRACHT_MAX = 30;

module.exports = function maakGeld({ S, save, nu, boek, eigen, norm, uitgever, app, versie, pay, findSupplier }) {

  /* ------------------------------------------------------------- de afdracht */
  function afdracht() {
    const s = S();
    if (!s.afdracht || typeof s.afdracht !== 'object') {
      s.afdracht = { procent: 0, sinds: nu(), door: 'standaard', reden: 'RTG rekent 0% commissie, zoals bij elke andere partnerstroom in dit huis.' };
    }
    return s.afdracht;
  }
  function afdrachtZet({ procent, reden, door }) {
    const p = Number(procent);
    if (!Number.isFinite(p) || p < 0 || p > AFDRACHT_MAX || Math.round(p * 10) !== p * 10) {
      return { status: 400, error: 'De afdracht is 0 tot ' + AFDRACHT_MAX + ' procent, in stappen van een tiende.' };
    }
    const wie = String(door || '').trim().slice(0, 80);
    if (!wie) return { status: 400, error: 'Zet je naam erbij: wat elke uitgever van nu af aan afdraagt, hoort een mens te hebben besloten.' };
    if (String(reden || '').trim().length < 10) return { status: 400, error: 'Een afdracht draagt een reden van ten minste tien tekens; die leest elke uitgever.' };
    const oud = afdracht().procent;
    S().afdracht = { procent: p, sinds: nu(), door: wie, reden: String(reden).trim().slice(0, 400) };
    boek('afdracht-gezet', null, wie, { van: oud, naar: p, reden: S().afdracht.reden });
    save();
    return { status: 200, ok: true, afdracht: afdracht(), let: 'Dit geldt vanaf nu. Wat al is verkocht, houdt het percentage van die dag: een bon wordt niet herrekend.' };
  }

  /* ----------------------------------------------------------------- de bon */

  /* De rekensom, VOORDAT er iets beweegt. Hij wordt op twee plekken gebruikt en
     dat is met opzet dezelfde: het scherm dat hem laat zien voordat het lid
     drukt, en de aanschaf die hem daarna vastlegt. Zou het scherm zelf rekenen,
     dan kan wat een lid ziet verschillen van wat hij betaalt. */
  function bon({ sleutel, land }) {
    const a = app(sleutel);
    if (!a || !a.live) return { status: 404, error: 'Deze app staat niet in de App Store.' };
    const v = versie(a.live);
    if (!v || v.status !== 'gepubliceerd') return { status: 404, error: 'Deze app staat niet in de App Store.' };
    const prijs = Number(v.manifest.prijsCenten || 0);
    if (prijs <= 0) return { status: 200, ok: true, gratis: true, sleutel, naam: v.manifest.naam, brutoCenten: 0,
      let: 'Deze app is gratis; er valt niets af te rekenen.' };
    const s = splitsBruto(prijs, land);
    if (s.error) return { status: s.status || 400, error: s.error, land: s.land || null, landNodig: true };
    const proc = afdracht().procent;
    /* De afdracht wordt over het NETTO bedrag gerekend en niet over het bruto.
       Btw is geen omzet van de uitgever en ook niet van RTG -- hij wordt
       doorgegeven aan de fiscus. Een percentage over bruto zou betekenen dat een
       uitgever in een land met een hoger tarief meer afdraagt over hetzelfde
       werk, en daar valt geen zin over te schrijven die klopt. */
    const afdrachtCenten = Math.round(s.nettoCenten * proc) / 100;
    const afdr = Math.floor(afdrachtCenten);
    const u = uitgever(a.org);
    return { status: 200, ok: true, gratis: false, sleutel, naam: v.manifest.naam, versie: v.manifest.versie,
      uitgever: u ? { org: u.org, naam: u.naam } : null,
      land: s.land, landNaam: s.landNaam, btwProcent: s.tariefProcent,
      brutoCenten: s.brutoCenten, btwCenten: s.btwCenten, nettoCenten: s.nettoCenten,
      afdrachtProcent: proc, afdrachtCenten: afdr, uitgeverCenten: s.nettoCenten - afdr,
      let: 'Dit is wat je betaalt en waar het heen gaat. RTG int de btw en draagt hem af in ' + s.landNaam + '; de rest gaat naar de uitgever.' };
  }

  /* De koop zelf, de omzet en de teruggaverechten staan in ./aanschaf.js en
     ./teruggave.js. Ze zijn hiervandaan gesplitst toen dit bestand over de
     10 kB-keuringsgrens ging, en de naad loopt waar hij hoort: hier staat WAT
     iets kost, daar staat wat er GEBEURT als iemand het koopt of terugkrijgt. */
  const rekenen = { afdracht, bon };
  const A = require('./aanschaf')(Object.assign({ S, save, nu, boek, eigen, norm, uitgever, app, versie, pay, findSupplier }, rekenen));
  const T = require('./teruggave')(Object.assign({ S, save, nu, boek, eigen, pay }, { aankopen: A.aankopen }));

  return Object.assign({ afdracht, afdrachtZet, bon, AFDRACHT_MAX }, A, T);
};
