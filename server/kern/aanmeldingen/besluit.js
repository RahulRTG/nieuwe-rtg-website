/* HET MENSELIJKE BESLUIT over een aanmelding: accepteren of afwijzen, en bij
   een akkoord de pas echt toekennen.

   Afgesplitst uit ../aanmeldingen.js omdat dat bestand op 10.189 bytes stond --
   eenenvijftig onder de grens van 10.240 -- en de keuring er al maanden op wees
   dat het er vlak onder zat. Elke toevoeging duwde hem eroverheen. Dit is de
   naad die er toch al lag: alles hieronder gaat over de ENE menselijke handeling
   in een verder volledig geautomatiseerde stroom, en die heeft zijn eigen regels.

   DE REGEL DIE HIER WOONT. Een Lifestyle- of Business Pass ontstaat uitsluitend
   na menselijke goedkeuring; de AI kent ze nooit zelf toe, en de gedeelde
   kantoorcode is geen mens. Wie met die code beslist is achteraf niet aan te
   wijzen, dus voor die twee passen weigeren we. Voor de RTG Pass, die na de
   AI-intake voor iedereen open staat, noteren we eerlijk dat het via de gedeelde
   code ging.

   Tot vandaag droeg ELK besluit de naam 'RTG-personeel', omdat de route
   req.session uitlas terwijl officeAuth die nooit zet. De grendel hieronder
   stond er dus al en werd verslagen door een terugval die altijd slaagde. Zie
   test/aanmeldbesluit.test.js -- en let op dat die toets over de ROUTE gaat: de
   kern-toets geeft de naam met de hand mee en kan deze fout niet zien. */
'use strict';

module.exports = ({ vind, beeld, kap, nu, accounts, save, startBetalingen, PASSEN }) => {
  function beslis(id, besluit, door, notitie) {
    const a = vind(id); if (!a) return { status: 404, error: 'Deze aanmelding bestaat niet.' };
    if (a.status !== 'in behandeling') return { status: 409, error: 'Over deze aanmelding is al beslist (' + a.status + ').' };
    if (!['geaccepteerd', 'afgewezen'].includes(besluit)) return { status: 400, error: 'Kies accepteren of afwijzen.' };
    /* GEEN NAAM? Voor een Lifestyle- of Business Pass is dat een weigering: de
       merkregel zegt dat die uitsluitend na MENSELIJKE goedkeuring ontstaan, en
       de gedeelde kantoorcode is geen mens. Voor de RTG Pass (na de AI-intake
       voor iedereen open) noteren we eerlijk dat het via de gedeelde code ging
       -- beter een spoor dat "we weten het niet" zegt dan een spoor dat een
       persoon verzint. Zie test/aanmeldbesluit.test.js. */
    const anoniem = !door || kap(door, 60).length < 2;
    if (anoniem && (a.pas === 'lifestyle' || a.pas === 'business'))
      return { status: 403, error: 'Een ' + (a.pas === 'business' ? 'Business' : 'Lifestyle') +
        ' Pass wordt alleen toegekend door een herleidbaar persoon. Log in met je eigen RTG-account (gekoppeld aan de backoffice) in plaats van met de gedeelde kantoorcode.' };
    const wie = anoniem ? 'backoffice (gedeelde code)' : kap(door, 60);
    a.status = besluit;
    a.besluit = { besluit, door: wie, notitie: kap(notitie, 300), at: nu() };
    a.bijgewerkt = nu();
    if (besluit === 'geaccepteerd') {
      // na een akkoord loopt de betaling automatisch: 12 maanden, met de 30%-split
      startBetalingen(a);
      // De poort van het merk: een Lifestyle-/Business Pass ontstaat hier, door dit
      // menselijke besluit, en nergens anders (zelf-registreren geeft ze niet).
      // Is er een account gekoppeld, dan tillen we het nu op via setTier.
      if ((a.pas === 'lifestyle' || a.pas === 'business') && a.accountId && accounts && accounts.setTier) {
        const opgetild = accounts.setTier(a.accountId, a.pas);
        a.besluit.optillen = opgetild ? { naar: a.pas } : { mislukt: true };
      }
    }
    save();
    return { ok: true, aanmelding: beeld(a), betaalschema: besluit === 'geaccepteerd' };
  }

  return { beslis };
};
