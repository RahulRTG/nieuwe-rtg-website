/* Kern-module "werkplekken": BIJ WELKE ORGANISATIES HOORT DIT LID, EN WAAR
   HEEFT HIJ DE LEIDING.

   Eén vraag, één antwoord, één plek. Hij komt uit de personeelsadministratie
   die het huis al heeft: meldt een medewerker zich aan met de uitnodiging van
   zijn werkgever, dan krijgt zijn personeelsrecord het member_id van zijn
   RTG-account (accounts.staffPositions). Diezelfde koppeling laat de werk-app
   meekomen bij het inloggen.

   WAAROM DIT EEN EIGEN MODULE IS. Het Podium had deze vraag als eerste nodig
   (zone 'zaak': een town hall die alleen het eigen personeel ziet). Het Theater
   heeft hem nu ook nodig (een interne videobibliotheek van een organisatie).
   Twee keer dezelfde vraag twee keer beantwoorden is twee plekken die uit
   elkaar kunnen lopen -- en bij een TOEGANGSvraag is dat de gevaarlijkste
   soort (LAT.md regel 4). Wie er een derde lezer bij bouwt, gebruikt deze.

   De naam van de zaak komt uit het leveranciersregister en niet uit de
   personeelsrij: die draagt de naam van de MEDEWERKER. Bestaat de zaak niet
   meer, dan valt de werkplek weg in plaats van naamloos mee te reizen. */
'use strict';

function maakWerkplekken({ accounts, findSupplier }) {
  function zakenVan(key) {
    const m = /^user-(\d+)$/.exec(String(key || ''));
    if (!m) return [];
    let rijen = [];
    try { rijen = accounts.staffPositions(Number(m[1])) || []; } catch (e) { return []; }
    return rijen.map(r => {
      const s = findSupplier ? findSupplier(r.supplier_code) : null;
      return { code: r.supplier_code, naam: (s && s.name) || r.supplier_code, bestaat: !!s, leiding: r.role === 'manager' };
    }).filter(z => !findSupplier || z.bestaat);
  }
  // werkt dit lid bij deze zaak? en heeft hij er de leiding?
  const werktBij = (key, code) => zakenVan(key).some(z => z.code === code);
  const leidtBij = (key, code) => zakenVan(key).some(z => z.code === code && z.leiding);
  return { zakenVan, werktBij, leidtBij };
}

module.exports = { maakWerkplekken };
