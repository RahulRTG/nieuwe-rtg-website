/* ============================================================================
   MIJN RTG: DE HERKOMST VAN EEN INLOG VASTLEGGEN -- op een plek.

   Dit stond vier keer bijna hetzelfde in de inlogwegen (wachtwoord, registratie,
   passkey, aanmeldgesprek) en dat is precies zoveel plekken om te vergeten. Een
   inlogweg die dit niet doet, levert een sessie op die op het scherm van het lid
   "Herkomst niet vastgelegd" heet -- en dat is stil: het ziet er niet uit als
   een fout, alleen als iets dat nog moet komen.

   WAT HIER NIET IN ZIT, EN MET OPZET: de METHODE. Die verschilt echt per weg en
   die verschillen zijn de hele waarde van deze laag. Een wachtwoord is
   `gemeten`, een passkey `cryptografisch`, een SSO-overdracht `afgeleid` omdat
   wij de oorspronkelijke inlog niet zagen. Zou deze helper er een kiezen, dan
   was hij binnen een halfjaar het ene antwoord dat overal opgaat -- en dan zegt
   de graad niets meer.
   ========================================================================== */
'use strict';
const klok = require('../../lib/klok');

/* Vastleggen op het moment van authenticatie. Faalt stil naar "niets
   vastgelegd" als er geen register of geen sid is: een sessie die geen
   identiteit draagt, is een eerlijke uitkomst en geen fout die de inlog mag
   tegenhouden. Iemand buitensluiten omdat de bewijslaag hapert, is precies de
   omkering die CONTROLPLANE.md verbiedt -- een storing hoort niet te klinken
   als een overtreding. */
function legInlogVast({ sessieregister, accounts, token, lidKey, type, assurance, methode, bron, authenticatorId }) {
  if (!sessieregister || !accounts || typeof accounts.sessieVan !== 'function') return null;
  const sid = accounts.sessieVan(token);
  if (!sid) return null;
  const nu = klok.datum().toISOString();
  const herkomst = (m) => ({ bron, methode: m, vastgesteldOp: nu, regelversie: 'mijnrtg' });
  const auth = { type, herkomst: herkomst(methode) };
  if (assurance) auth.assurance = assurance;
  if (authenticatorId) auth.authenticatorId = authenticatorId;
  sessieregister.open(sid, lidKey, {
    authenticator: auth,
    /* Namens wie: bij een gewone inlog handelt een mens voor zichzelf. Dat is
       geen aanname maar een waarneming -- er is op dit moment geen andere
       context gekozen. Een werkcontext ontstaat elders (kern/eenaccount). */
    context: { contextId: 'persoonlijk', contextSoort: 'persoonlijk', contextVersie: 1,
      herkomst: herkomst('gemeten') }
  });
  return sid;
}

module.exports = { legInlogVast };
