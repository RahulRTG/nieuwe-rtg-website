/* ============================================================================
   DE PERSOONSROUTES -- deuren die een MEDEWERKER vragen, niet een bedrijf.

   De demo-inlog van een zaak (`/api/supplier/login` met gebruikersnaam en
   wachtwoord) levert een sessie met actor { name: 'Beheer', manager: true }
   en GEEN staffId: een bedrijfsaccount, geen persoon. Tweeendertig routes in
   FIXTURE_403 weigeren precies daarop, en ze zeggen het er zelf bij:

     "Alleen met een persoonlijke login."      (routes/staff/inzetbaarheid.js)
     "Alleen vanaf een persoonlijke PDA."      (de horeca-wijk)
     "Dit postvak hoort niet bij uw persoonlijke inlog."

   De poort leest `req.actor.staffId`. Dat is geen recht dat ontbreekt maar een
   PERSOON die ontbreekt -- en dat is precies de bedoeling: een dienst, een
   pauze, een overdracht en een postvak horen op een naam te staan.

   TWEE VORMEN, dezelfde redenering als ./accountroutes.js. `/api/staff/` is
   in zijn geheel het personeelsdomein en staat als voorvoegsel: alle 46
   routes eronder dragen rol `supplier`, en een persoonlijke managersessie is
   daar een strikt betere aanklopper (dezelfde zaak, dezelfde managerrol, plus
   een naam). De veertien overige liggen in domeinen met 128 respectievelijk 9
   routes waar de bedrijfssessie wel degelijk werk heeft; die staan als heel
   pad, zodat de rest onaangeraakt blijft.

   WAT DIT NIET DOET. Het is geen sterkere sleutel. De medewerker logt in met
   zijn eigen pincode, langs dezelfde verifyStaffPin, hetzelfde pinslot en
   hetzelfde werkvenster als in de leverancier-app. */
'use strict';
const { dekt } = require('./padgrens');

const VOORVOEGSELS = [
  { pad: '/api/staff/', gemeten: 18, waarom: 'het personeelsdomein; alle 46 routes dragen rol supplier en 18 eisen een staffId' }
];

const PADEN = [
  '/api/supplier/horeca/handover/accept', '/api/supplier/horeca/handover/start',
  '/api/supplier/horeca/missions/status',
  '/api/supplier/horeca/wijk/aanvaard', '/api/supplier/horeca/wijk/bied',
  '/api/supplier/horeca/wijk/gezien', '/api/supplier/horeca/wijk/neem',
  '/api/supplier/horeca/wijk/tafel-terug', '/api/supplier/horeca/wijk/trek-in',
  '/api/supplier/horeca/wijk/weiger',
  '/api/supplier/payroll/openvoorwerk',
  '/api/supplier/werkmail/inbox', '/api/supplier/werkmail/lees', '/api/supplier/werkmail/verzonden'
];
const PADENSET = new Set(PADEN);

function dektPad(pad) {
  return PADENSET.has(String(pad || '')) || VOORVOEGSELS.some(v => dekt(pad, v.pad));
}

/* Alleen vanaf `supplier`, en niet vanaf een genrezaak: die verfijning is al
   gemaakt en zou hier worden overschreven door een sessie bij een ANDERE zaak.
   Dezelfde grens als in ./genrezaken.js en ./accountroutes.js. */
function persoonsRolVoor(huidigeRol, pad) {
  if (!dektPad(pad)) return { rol: null, reden: 'dit pad vraagt geen persoonlijke login' };
  if (huidigeRol !== 'supplier') {
    return { rol: null, reden: '`' + huidigeRol + '` is geen bedrijfssessie van de demo-zaak; ' +
      'een persoonlijke login verfijnt alleen `supplier`' };
  }
  return { rol: 'zaak-persoonlijk', reden: null };
}

module.exports = { VOORVOEGSELS, PADEN, dektPad, persoonsRolVoor };
