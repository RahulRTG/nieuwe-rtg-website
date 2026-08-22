/* WAT ZIT ER IN HET ABONNEMENT VAN DEZE ZAAK -- en wie is haar aanspreekpunt?

   TWEE DINGEN DIE BIJ ELKAAR HOREN. Een zaak kon nergens zien op welke trede zij
   staat en wat daarbij hoort; de poort in server/opzet/leverancierpoort.js
   houdt sinds vandaag onderdelen tegen die niet in het abonnement zitten, en een
   grens die je pas voelt als je ertegenaan loopt is geen product maar een
   verrassing.

   EN DE VASTE CONTACTPERSOON. `can_use_dedicated_support` was de vijfde stille
   capability, en hij is de enige van de vijf die NIET als slot hoort te werken.
   Iedereen krijgt hulp; wat de trede bepaalt is of daar een NAAM aan hangt of de
   gewone lijn. Een capability die een baan kiest in plaats van een deur sluit is
   nog steeds een caller -- er wordt iets anders van de wereld door.

   WAAROM DE NAAM HIER NIET WORDT VERZONNEN. Staat er geen contactpersoon bij de
   zaak, dan zegt dit endpoint dat de vaste contactpersoon nog wordt toegewezen
   -- en niet een naam die klinkt alsof er iemand klaarzit. Zie CLAUDE.md: nooit
   claimen dat iets geregeld is wat niet geregeld is. */
const caps = require('../../kern/commercie/capaciteiten');
const ladder = require('../../kern/pasladder');
const { TERUGVAL } = require('../../kern/commercie/zaakabonnement');

const naamVan = (t) => (ladder.trede(t) || {}).naam || t;

/* DE CAPABILITY DIE EEN BAAN KIEST IN PLAATS VAN EEN DEUR SLUIT. Los van de
   route, want een tak die alleen via een HTTP-verzoek te bereiken is, is een tak
   die niemand toetst.

   De naam wordt hier NIET verzonnen. Staat er geen contactpersoon bij de zaak,
   dan zegt dit dat RTG er een toewijst -- en niet iets dat klinkt alsof er
   iemand klaarzit. Zie CLAUDE.md: nooit claimen dat iets geregeld is wat niet
   geregeld is. */
function contactlijn(pas, accountmanager) {
  const naam = accountmanager ? String(accountmanager).slice(0, 60) : null;
  if (!caps.mag(pas, 'can_use_dedicated_support'))
    return { soort: 'lijn', naam: null,
      tekst: 'U gebruikt de gewone lijn van RTG. Een vaste contactpersoon hoort bij ' +
        caps.tredenMet('can_use_dedicated_support').map(naamVan).join(' en ') + '.' };
  return { soort: 'vast', naam,
    tekst: naam ? 'Uw vaste contactpersoon bij RTG is ' + naam + '.'
      : 'Uw abonnement bevat een vaste contactpersoon; RTG wijst die toe.' };
}

module.exports = (kern) => {
  const { app, supplierAuth } = kern;

  app.post('/api/supplier/abonnement', supplierAuth, (req, res) => {
    try {
      const zaak = req.supplier;
      const abo = kern.zaakAbonnement ? kern.zaakAbonnement.van(zaak.code)
        : { pas: TERUGVAL, herkomst: 'voor-de-ladder' };
      const trede = ladder.trede(abo.pas) || {};

      res.json({ ok: true,
        pas: abo.pas, naam: trede.naam || abo.pas, herkomst: abo.herkomst, sinds: abo.sinds || null,
        bevat: caps.capsVan(abo.pas).map(c => ({ id: c, uitleg: caps.CAPS[c] })),
        bevatNiet: Object.keys(caps.CAPS).filter(c => !caps.mag(abo.pas, c))
          .map(c => ({ id: c, uitleg: caps.CAPS[c],
            zit_in: caps.tredenMet(c).map(naamVan) })),
        contact: contactlijn(abo.pas, zaak.accountmanager) });
    } catch (e) {
      console.error('[supplier-abonnement]', e);
      res.status(500).json({ error: 'Het abonnement kon niet worden opgehaald.' });
    }
  });
};
module.exports.contactlijn = contactlijn;
