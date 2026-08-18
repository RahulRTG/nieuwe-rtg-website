/* ============================================================================
   DE AUDITSPOREN -- WELKE COLLECTIES ZIJN EEN JOURNAAL?

   De AUDIT-as van de bewijsmatrix vraagt: blijft er een spoor achter dat niemand
   kan wissen. Die vraag valt uiteen in twee stukken, en dit bestand gaat over
   het eerste:

     1  LAAT DEZE ROUTE EEN SPOOR NA?        <- hier
     2  is dat spoor onuitwisbaar?           <- server/lib/keten.js, bestaat al
                                                (AUDIT-KETEN-LOKAAL, in bedrijf)

   Stuk twee was er dus al; stuk een niet, en zonder dat stond de hele as voor
   alle 4185 routes op ongemeten terwijl er wel degelijk journalen worden
   geschreven.

   ER IS GEEN ENKELE DOORGANG WAAR AUDITREGELS ONTSTAAN. Gezocht: er is geen
   gedeelde schrijver die je kunt aftappen. Elk domein hangt zijn regels aan zijn
   eigen collectie. Daarom hier een LIJST, en de lijst is gemeten en niet
   geraden: dit zijn de journaal-achtige collecties die STAATPROEF.json werkelijk
   heeft zien bewegen tijdens een ronde over alle schrijfroutes.

   WAT EEN JOURNAAL IS, VOOR DEZE MEETING: een collectie die vastlegt WIE WAT
   DEED, en waar regels bijkomen in plaats van veranderen. Een collectie met
   gegevens (agendas, suppliers, horeca) is dat niet -- die verandert omdat er
   iets IS veranderd, en dat meet de STATE-as al.

   WAT ER BEWUST NIET IN STAAT: collecties waarvan de naam op een journaal lijkt
   maar die gegevens dragen. stadPaspoort staat er niet in: dat is een document
   en geen spoor. Bij twijfel eruit -- een te ruime lijst maakt van elke
   gegevenswijziging een auditspoor en dan meet deze as niets meer. */
'use strict';

const SPOREN = [
  ['securityLog', 'het veiligheidsbord: geweigerde pogingen, rechten-escalaties, alarmen'],
  ['kantoorAudit', 'wie in het kantoor wat deed'],
  ['inzageLog', 'wie andermans gegevens heeft ingezien; het journaal met de hashketen (server/inzagelog.js)'],
  ['commandJournaal', 'de handelingen van het commandocentrum'],
  ['commandJournaalTotaal', 'de teller onder datzelfde journaal'],
  ['payrollRegelJournaal', 'elke wijziging aan een loonregel, met wie en waarom'],
  ['supplierActivity', 'wat een leverancier in zijn zaak heeft gedaan']
];

const NAMEN = SPOREN.map(([n]) => n);

/* De lengtes van de sporen op dit moment. Alleen LENGTES en geen inhoud: dit
   draait per verzoek onder een meetvlag, en een momentopname van de inhoud zou
   de meting duurder maken dan het gemetene. Een collectie die er niet is telt
   als 0 -- dan valt hij op zodra hij WEL groeit. */
function standVan(data) {
  const uit = {};
  const d = data || {};
  for (const naam of NAMEN) {
    const v = d[naam];
    uit[naam] = Array.isArray(v) ? v.length : (typeof v === 'number' ? v : 0);
  }
  return uit;
}

/* Welke sporen zijn gegroeid tussen twee standen. Alleen GROEI telt: een
   journaal dat krimpt is geen spoor dat wordt achtergelaten maar een spoor dat
   verdwijnt, en dat is een heel andere bevinding (daar gaat de keten over). */
function gegroeid(voor, na) {
  const uit = [];
  for (const naam of NAMEN) {
    if ((na[naam] || 0) > (voor[naam] || 0)) uit.push(naam);
  }
  return uit;
}

module.exports = { SPOREN, NAMEN, standVan, gegroeid };
