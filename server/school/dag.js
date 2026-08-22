/* School (deelmodule): het dagplan van een leerling die in een klas zit.

   Hetzelfde plan als in de leerlingapp (kern/leerstof-dag.js), met er VOORAAN
   wat de school heeft gevraagd. Die volgorde is de bedoeling: huiswerk komt
   van een mens die deze klas kent, en dat weegt zwaarder dan wat de motor zelf
   voorstelt.

   Twee dingen die hier met opzet niet gebeuren:

   - er wordt NIETS opgeslagen. Het plan wordt telkens uitgerekend; er is dus
     geen lijst van "wat heeft dit kind vandaag niet gedaan", en die kan er ook
     niet later stilletjes bij komen. Zie de kop van kern/leerstof-dag.js;
   - de deadline van huiswerk komt van de leraar en wordt getoond zoals hij is.
     Er wordt geen eigen urgentie omheen gebouwd -- geen aftelklok, geen rode
     kleur, geen "nog maar". Wat de school vraagt is al duidelijk genoeg. */
const { DOELEN } = require('../kern/leerstof');

module.exports = (sctx) => {
  const { router, eigenVeld, K, gezinSessie, leerlingVan, leerstof, rtfHandle } = sctx;
  // leerstof is een functie: de motor bestaat nog niet als deze module wordt opgebouwd
  const motor = () => (typeof leerstof === 'function' ? leerstof() : null);

  router.post('/school/dag', (req, res) => {
    const s = gezinSessie(req, res); if (!s) return;
    const k = eigenVeld(K(), String(req.body.klasCode || '').trim().toUpperCase());
    if (!k) return res.status(404).json({ error: 'Klas niet gevonden.' });
    const profielId = s.beheerder && req.body.profielId ? String(req.body.profielId) : s.p.id;
    const l = leerlingVan(k, s.g, profielId);
    if (!l) return res.status(403).json({ error: 'Dit kind zit niet in deze klas.' });
    const kern = motor();
    if (!kern || !rtfHandle) return res.status(503).json({ error: 'De leerstof is nu niet bereikbaar.' });

    /* Wat de school vroeg en nog niet af is. Alleen huiswerk met een leerdoel
       kan hier meedoen: de rest is een opdracht op papier en geen stap in de
       leerlijn -- die staat gewoon bij het huiswerk zelf. */
    const extra = (k.huiswerk || [])
      .filter(h => h.doel && DOELEN[h.doel] && !(h.afDoor || []).includes(l.sleutel))
      .slice(0, 3)
      .map(h => ({ soort: 'huiswerk', doel: h.doel, naam: DOELEN[h.doel].naam, vak: DOELEN[h.doel].vak,
        huiswerkId: h.id, deadline: h.deadline || null, klasCode: k.code,
        waarom: 'Dit heeft ' + (k.leraar || 'je leraar') + ' voor deze klas klaargezet.' }));

    /* De fase van de KLAS reist mee: een kind dat de school hier heeft geplaatst
       heeft zelf nooit een fase gekozen, en zou anders alleen huiswerk zien. */
    const plan = kern.leerstofDag(rtfHandle(s.g.code, profielId), extra, { fase: k.fase || null });
    res.json(Object.assign({}, plan, { klas: { code: k.code, naam: k.naam } }));
  });
};
