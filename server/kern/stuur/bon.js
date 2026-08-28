/* HET ACTIEBEWIJS -- de bon onder een door een mens bevestigde AI-handeling.
   FABRIC.md par. 3.8.

   WAAROM DIT BESTAAT. Na een bevestigde actie hoort er geen AI-verhaal te
   staan maar een bon: wat is er gebeurd, waarom mocht het, wat weten we van
   het bewijs eronder, en wat weten we NIET. Zonder zo'n bon is elke uitspraak
   over een AI-handeling achteraf een reconstructie uit logregels, en dan is
   "wij kunnen precies bewijzen wat er is gedaan en waarom" een belofte in
   tekst (LAT.md regel 6).

   ELKE REGEL KOMT UIT EEN REGISTER OF UIT DE KETEN ZELF. De bevoegdheid uit
   beleidVoor(), de bewijsstand uit VERTROUWEN.json via server/lib/vervalstaat.js,
   de bevestiging uit het verbruikte voorstel-token, de uitkomst uit het echte
   antwoord. Er staat niets op deze bon dat iemand heeft bedacht (PROOF.md par.
   9.1: bewijs is nooit een verhaal).

   EN DE GATEN STAAN EROP. Twee dingen die een bon graag zou dragen, weten we
   per handeling niet:

     welke gegevens er precies veranderden  -- dat meet de vingerafdruk
       (/api/techniek/vingerafdruk), en die hasht de hele opslag. Dat is een
       meetinstrument voor een proefronde, geen kosten die je per klik maakt.
     of de handeling terug te draaien is    -- alleen als de route een bekende
       tegenhanger heeft. Een terugweg beloven die niet bestaat is erger dan
       geen terugweg tonen (FABRIC.md par. 3.8).

   Ze staan daarom als `nietGemeten` op de bon in plaats van eraf. Een bon die
   zwijgt over wat hij niet weet, leest als volledigheid.

   GEEN PERSOONSGEGEVENS. De bon draagt de wereld (member/supplier/staff) en
   het voorstel-id, nooit een naam of e-mailadres: dit huis draait op codenamen
   (CLAUDE.md, privacy by design) en een actiebewijs is geen uitzondering. */
'use strict';
const { staatVan } = require('../../lib/vervalstaat');

/* De twee dingen die deze bon per handeling niet kan weten, met de reden
   erbij. Als vaste tekst, want een bon die per geval een andere verklaring
   verzint is zelf weer een verhaal. */
const NIET_GEMETEN = Object.freeze([
  'welke gegevens er precies zijn gewijzigd: dat meet de vingerafdruk over de hele opslag, ' +
    'en dat is een proefinstrument en geen kosten per handeling',
  'of deze handeling terug te draaien is: alleen een route met een bekende tegenhanger ' +
    'kan dat beloven, en een terugweg tonen die niet bestaat is erger dan geen'
]);

/* Puur: alles komt binnen, niets wordt opgehaald behalve de vervalstaat (die
   uit de gedeelde lezer komt en dus dezelfde waarheid is als de bewijspoort en
   de schorspoort). Los toetsbaar, zoals elke regel in dit huis. */
function maakBon({ pad, wereld, niveau, voorstelId, status, op, staat }) {
  const s = staat !== undefined ? staat : staatVan('POST', String(pad || ''));
  const code = Number(status) || 0;
  return {
    wat: 'POST ' + String(pad || ''),
    wereld: String(wereld || ''),
    /* Dat een MENS heeft bevestigd is het hart van deze bon: het model kan
       zichzelf geen goedkeuring geven (zie stuur/goedkeuring.js), dus dit veld
       zegt iets dat niet te vervalsen is vanuit een prompt. */
    bevestigd: {
      door: 'mens',
      voorstel: String(voorstelId || '').slice(0, 10),
      op: op || new Date().toISOString()
    },
    bevoegdheid: {
      niveau: niveau || 'voorstel',
      reden: 'deze actie staat als "' + (niveau || 'voorstel') + '" op de AI-allowlist voor ' +
        String(wereld || '') + ', en een mens heeft het exacte voorstel bevestigd'
    },
    bewijs: s
      ? { vervalstaat: s.staat, reden: s.reden || '' }
      : { vervalstaat: 'onbekend',
          reden: 'deze route staat niet in VERTROUWEN.json; er is geen gemeten vervalstaat om te tonen' },
    uitkomst: { status: code, gelukt: code >= 200 && code < 300 },
    nietGemeten: NIET_GEMETEN.slice()
  };
}

module.exports = { maakBon, NIET_GEMETEN };
