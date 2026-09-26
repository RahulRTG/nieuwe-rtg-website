/* DE BELEIDSMOTOR, AFDWINGEN PER DEUR -- de stap na de schaduw.

   Besluit van de eigenaar (24 september 2026): per kantoordeur een schakelaar,
   standaard SCHADUW. Een labronde over 586 kantoorroutes en zes soorten sessies
   gaf 3544 waarnemingen en nul keer oneens -- maar de rijpheid is een eis over
   een ECHT proces (200 waarnemingen over 7 dagen, ../commercie/schaduw.js), en
   een lab is dat niet. Dus beslist de schakelaar niet zelf: aanzetten kan alleen
   voor een deur die rijp is en nooit oneens was, en dat rekent ./stand.js uit.

   WAT AFDWINGEN BETEKENT, en wat niet. De motor komt NAAST de poort, niet in zijn
   plaats: de poort blijft lopen, want hij zet ook de sessievelden waar de routes
   op leunen (req.session, req.eigenaar). Afdwingen voegt dus alleen een WEIGERING
   toe -- de motor kan nooit iets doorlaten wat de poort tegenhoudt. De oude poort
   weghalen is een volgende stap, met een eigen besluit.

   ONBEKEND IS GEEN WEIGEREN (CONTROLPLANE.md): kan de motor een feit niet
   vaststellen, dan is dat een 503 en geen 403. Een storing hoort niet te klinken
   als een overtreding, en een lid dat een 403 krijgt denkt dat hij iets mist.

   Uitzetten kan altijd: dat is de noodweg terug naar de schaduw. */
'use strict';

function maakAfdwingen({ eigen, save, stand, deuren, UITKOMST }) {
  const kaart = () => eigen.kijk('beleidsAfdwingen') || {};

  const aan = (deur) => !!(kaart()[deur] && kaart()[deur].aan === true);

  function zet(deur, wil, wie) {
    if (!deuren[deur]) return { status: 404, error: 'Deze deur kent de beleidsmotor niet.' };
    if (typeof wil !== 'boolean') return { status: 400, error: 'Zet afdwingen aan (true) of terug naar de schaduw (false).' };
    if (wil) {
      const d = (stand().deuren || []).find(x => x.deur === deur);
      if (!d || !d.kanVerhuizen) return { status: 409, deur,
        error: 'Deze deur kan nog niet afgedwongen worden: ' + (d ? d.waarom : 'geen stand') + '.',
        uitleg: 'Een deur gaat pas om als de schaduw rijp is en de motor nooit oneens was met de poort.' };
    }
    const k = eigen.bak('beleidsAfdwingen');
    k[deur] = { aan: wil, door: wie || null, at: new Date().toISOString() };
    save();
    return Object.assign({ ok: true, deur }, overzicht()[deur]);
  }

  function overzicht() {
    const k = kaart();
    const uit = {};
    for (const deur of Object.keys(deuren)) {
      const r = k[deur] || {};
      uit[deur] = { stand: r.aan === true ? 'afdwingen' : 'schaduw', door: r.door || null, at: r.at || null };
    }
    return uit;
  }

  /* De weigering, met de opbouw in woorden. */
  function weiger(res, deur, besluit) {
    if (besluit.uitkomst === UITKOMST.ONBEKEND) {
      return res.status(503).json({ error: 'De beleidsmotor kon voor deze deur niet vaststellen of u binnen mag. Probeer het zo opnieuw.', deur });
    }
    return res.status(403).json({ error: 'De beleidsmotor weigert deze deur (' + deur + '): ' + String(besluit.reden || 'een eis is niet gehaald').replace(/\.$/, '') + '.', deur });
  }

  return { aan, zet, overzicht, weiger };
}

module.exports = { maakAfdwingen };
