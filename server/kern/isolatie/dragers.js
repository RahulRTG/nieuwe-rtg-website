/* DE ZES DRAGERS -- van wie is deze beveiligingsstand.

   DIT WAS HET ECHTE GAT. RTG had de standen (kern/incidentcontrole.js), het
   centrale profiel (kern/beschermstand.js) en de AI-allowlist
   (kern/stuur/beleid.js) al. Wat ontbrak was de DIMENSIE: alle vijf standen
   waren huis-breed en operator-gedreven, één veld in
   `db.data.techniek.incidentcontrole.modus`. RTG kon daardoor niet zeggen "dit
   ene lid staat in isolatie" -- en dat is precies wat een gericht aangevallen
   account nodig heeft, en wat een heel platform stilzetten juist niet is.

   EEN BEVEILIGINGSBESLUIT IS DUS NIET `modus` MAAR `stand(drager)`:

     huis          normaal
     organisatie   beschermd
     identiteit    isolatie
     sessie        isolatie
     apparaat      beperkt

   WAAROM DIT GEEN LADDER VAN DRAGERS IS. De verleiding is "de fijnste drager
   wint" -- de sessie is specifieker dan het huis, dus de sessie beslist. Dat is
   fout, en gevaarlijk fout: dan zet een aanvaller die één sessie in handen heeft
   zijn eigen sessie op `normaal` en is het huis-brede incident weg. De
   samenvoeging is daarom een JOIN (kern/isolatie/ordening.js) en geen keuze: de
   strengste eis van alle dragers geldt, en een lagere drager kan een hogere
   nooit neutraliseren. Dat is SEC-LOCK-003, en het volgt uit deze vorm in
   plaats van uit een extra regel.

   DE RANGORDE HIERONDER GAAT DUS NIET OVER WIE WINT. Hij gaat over wie een
   stand mag ZETTEN: het huis wordt gezet door de eigenaar, een organisatie door
   haar eigen beheer, en een identiteit door het lid zelf of door RTG. Een
   drager kan nooit een stand zetten op een drager boven zich -- een lid zet zijn
   eigen isolatie aan en niet die van zijn werkgever, laat staan die van het
   huis.

   `workload` HOORT ER MET OPZET BIJ EN IS MET OPZET NOG LEEG. Een achtergrondtaak,
   een geplande opdracht en een webhook-verwerker zijn geen mens en geen sessie,
   en ze zijn vandaag de enige uitvoeringsvorm die aan geen enkele drager hangt.
   Hem nu weglaten zou betekenen dat er over een jaar een zevende begrip bij
   komt; hem nu invullen zou betekenen dat er een stand staat die niemand zet.
   Hij staat er dus als drager met `bron: null` en dat is zichtbaar in de meting. */
'use strict';

/* TWEE VRAGEN DIE ONDER EEN VELDNAAM ZATEN, en dat was een stille meetfout.

   `bron` beantwoordt: WAAR STAAT DE STAND. `sleutelbron` beantwoordt: WAAR KOMT
   DE SLEUTEL VANDAAN BIJ EEN LOPEND VERZOEK. Dat zijn niet dezelfde vraag, en de
   meter las de eerste als de tweede: `werkend()` filterde op `bron !== null` en
   scripts/isolatieproef.js meldde daarom "5 van 6 met een bron", terwijl er bij
   een echt verzoek maar EEN drager een sleutel had. `apparaat` had een keurige
   opslagplek en geen enkele plek in de code die hem ooit zette; `sessie` viel
   stil terug op de identiteitsleutel, dus twee lagen zetten in werkelijkheid
   dezelfde stand.

   Waar een sleutelbron ontbreekt staat de REDEN, en die reden wordt door
   ./sessiedragers.js letterlijk doorgegeven aan het scherm. Een lid dat een laag
   niet kan zetten, hoort te horen waarom -- niet een knop die niets doet. */
const DRAGERS = Object.freeze([
  { naam: 'huis',        wat: 'het hele platform',                       gezetDoor: 'eigenaar',        bron: 'db.data.techniek.incidentcontrole.modus',
    sleutelbron: 'geen sleutel nodig: er is er maar een' },
  { naam: 'organisatie', wat: 'één klantorganisatie (TENANT.md: org IS de klant)', gezetDoor: 'orgbeheer of RTG', bron: 'db.data.isolatie.organisatie',
    sleutelbron: null,
    geenSleutel: 'DRIE REDENEN, en ze zijn alle drie gemeten. (1) Een ledensessie draagt geen ' +
      'organisatiecode: req.session wordt op precies EEN plek gezet (opzet/diensten2.js) in de vorm ' +
      '{ tier, key, account }, en daar zit geen org bij. (2) De zaaksessie die WEL een code draagt, ' +
      'bereikt deze laag helemaal niet: supplierAuth zet req.supplier en req.actor en nooit ' +
      'req.session, dus voor een zaakverzoek weegt GEEN ENKELE drager mee -- niet alleen deze niet. ' +
      '(3) En er is geen eenduidig antwoord op de vraag welke organisatie het IS: TENANT.md houdt ' +
      'org, werkruimte en leverancier met opzet uit elkaar, en iemand die bij twee organisaties ' +
      'werkt zou de strengste van de twee over zijn hele sessie krijgen -- de join kent geen wereld. ' +
      'Een sleutel invullen is hier dus geen ontbrekend stukje werk maar een BESLUIT dat eerst moet ' +
      'worden genomen; hem raden sluit de verkeerde mensen af.' },
  { naam: 'identiteit',  wat: 'één mens of zaak, over al zijn sessies',   gezetDoor: 'het lid zelf of RTG', bron: 'db.data.isolatie.identiteit',
    sleutelbron: 'req.session.key' },
  { naam: 'sessie',      wat: 'één ingelogde sessie',                     gezetDoor: 'het lid zelf of RTG', bron: 'db.data.isolatie.sessie',
    sleutelbron: 'de sha256 van het bearer-token (kern/sessies.js tokenHash) -- een login, een sleutel' },
  { naam: 'apparaat',    wat: 'één toestel',                              gezetDoor: 'het lid zelf of RTG', bron: 'db.data.isolatie.apparaat',
    sleutelbron: 'een afgeleide van de passkey waarmee is ingelogd, in het ondertekende token ' +
      '(kern/isolatie/apparaatsleutel.js)',
    geenSleutel: 'RTG kent een apparaat alleen van een PASSKEY: daar bewijst een authenticator met ' +
      'echte cryptografie dat hij dezelfde is als de vorige keer. Wie met een wachtwoord inlogt, ' +
      'draagt geen toestel -- en een verzonnen sleutel zou een stand opleveren die aan niets hangt. ' +
      'Let op het woord: `apparaat` betekent op een webauthn-credential iets anders (single- of ' +
      'multiDevice) en op kern/toestellen.js weer iets anders (een horloge of weegschaal met een ' +
      'eigen smalle sleutel); die drie mogen niet worden samengevoegd.' },
  { naam: 'workload',    wat: 'een achtergrondtaak, geplande opdracht of webhook-verwerker',
    gezetDoor: 'niemand',
    bron: null,
    sleutelbron: null,
    geenSleutel: 'geen achtergrondtaak meldt zich aan; er is ook geen gedeeld beginpunt waar dat ' +
      'zou kunnen (de async-context van kern/kosten/haak.js draagt een kostendrager, geen actor).',
    nietGebouwd: 'er is nog geen plek waar een achtergrondtaak zichzelf als drager aanmeldt. ' +
      'Hij staat hier omdat hij bestaat, niet omdat hij werkt -- een lege stand die als `normaal` ' +
      'meetelt zou de join stil verzwakken, dus telt hij als een drager ZONDER stand en niet als ' +
      'een drager MET de stand normaal. HET GAT HEEFT EEN MAAT: zie ISOLATIEPROEF.json, ' +
      'noemers.workload (gemeten door scripts/lib/achtergrond.js). Twee andere plekken stellen ' +
      'dezelfde afwezigheid al vast met zoveel woorden: opzet/handeling.js ("een cronjob draait ' +
      'buiten deze context") en kosten/haak.js ("een achtergrondtaak krijgt `huis`"). Dat JSON-bestand ' +
      'wordt hier NIET gelezen: een bouwartefact kan een commit achterlopen, en gezag komt niet uit ' +
      'een artefact (EXECUTIE.md blok 3).' }
]);

const OP_NAAM = Object.freeze(Object.fromEntries(DRAGERS.map(d => [d.naam, d])));
const NAMEN = Object.freeze(DRAGERS.map(d => d.naam));

/* Wie mag op wie een stand zetten. Een drager zet nooit iets op zichzelf-of-hoger
   VERZWAKKENDS; verstrengen mag wel op de eigen laag. De verlagingskant wordt
   door ./ontsluiting.js afgehandeld en niet hier -- dit zegt alleen wiens laag
   het is. */
function magZetten(zetter, doelDrager) {
  const a = NAMEN.indexOf(String(zetter));
  const b = NAMEN.indexOf(String(doelDrager));
  if (a < 0 || b < 0) return false;
  return a <= b;
}

/* De dragers die een stand kunnen OPSLAAN. Het verschil met DRAGERS is het
   meetpunt: een drager zonder bron is een gat met een naam. */
function werkend() { return DRAGERS.filter(d => d.bron !== null); }

/* De dragers die bij een LOPEND VERZOEK werkelijk meedoen. Dit is het strengere
   en eerlijkere getal van de twee, en het hoort naast `werkend()` te staan en
   niet in plaats daarvan: RTG kan een organisatie wel dichtzetten vanaf de
   cockpit (dus de opslag werkt), terwijl die stand bij een verzoek van dat lid
   nog niet meeweegt (dus de sleutel ontbreekt). Die twee samentellen zou van
   allebei een halve waarheid maken. */
function metSleutelbron() { return DRAGERS.filter(d => d.sleutelbron !== null && d.sleutelbron !== undefined); }

module.exports = { DRAGERS, OP_NAAM, NAMEN, magZetten, werkend, metSleutelbron };
