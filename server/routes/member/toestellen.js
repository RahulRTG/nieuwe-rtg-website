/* ============================================================================
   MIJN RTG: MIJN TOESTELLEN -- een sessie binden aan het toestel waarop zij draait.

   Afgesplitst van ./sessies.js op de 10 kB-grens, en op een echte naad: een
   sessie en een toestel hebben verschillende levensduren. Een toestel overleeft
   zijn sessies, en een sessie kan aan een toestel gebonden zijn zonder dat dat
   toestel bij die sessie hoort. Twee onderwerpen, twee bestanden.

   De uitleg over WAT een toestel bewijst -- en waarom alleen bezit van een
   niet-exporteerbare sleutel `bewezen` verdient -- staat in de kop van
   server/kern/identiteit/toestellen.js. Lees die eerst.
   ========================================================================== */
'use strict';
const klok = require('../../lib/klok');

const TOKEN_MAX_MS = 30 * 24 * 3600 * 1000;

module.exports = (kern) => {
  const { app, auth, accounts, sessieregister, toestellen, handelingsspoor } = kern;

  const eisLid = (req, res) => {
    if (req.session.tier === 'guest') { res.status(403).json({ error: 'Alleen voor leden.' }); return false; }
    if (!req.session.account) { res.status(403).json({ error: 'Dit hoort bij een eigen RTG-account.' }); return false; }
    return true;
  };
  const spoor = (req, wat, extra) => {
    try { if (handelingsspoor) handelingsspoor.leg(req.session.key, wat, extra || {}); } catch (e) {}
  };

  /* ------------------------------------------------------------------------
     TOESTELBINDING. Twee stappen, met opzet: eerst een uitdaging halen, dan hem
     ondertekend terugsturen. In een keer zou betekenen dat de client zelf mag
     bepalen wat er getekend wordt, en dan tekent een aanvaller iets dat hij al
     had liggen.

     LET OP WAT HIER NIET STAAT: geen route die een SESSIE opent op grond van
     een toestelsleutel. Deze twee routes staan achter `auth`, dus er is al een
     mens gecontroleerd; de sleutel bindt die sessie en opent er nooit een. Zie
     grens 1 in kern/identiteit/toestellen.js.
     ---------------------------------------------------------------------- */
  app.post('/api/mijn/toestel/uitdaging', auth, (req, res) => {
    if (!eisLid(req, res)) return;
    if (!toestellen) return res.status(503).json({ error: 'Toestelbinding is hier niet beschikbaar.' });
    res.json(toestellen.uitdaging(req.session.key));
  });

  app.post('/api/mijn/toestel/bind', auth, async (req, res) => {
    if (!eisLid(req, res)) return;
    if (!toestellen) return res.status(503).json({ error: 'Toestelbinding is hier niet beschikbaar.' });
    const r = await toestellen.bind(req.session.key, req.body.jwk, req.body.handtekening, req.body.naam);
    if (r.error) return res.status(400).json(r);

    /* HET SCHARNIER. De handtekening is zojuist gecontroleerd, dus dit is het
       ene moment waarop deze claim `cryptografisch` mag heten -- en dus
       `bewezen`. Reconstrueren we hem later uit het register, dan is het een
       afleiding en zakt hij naar `vermoed`. Vandaar dat het hier gebeurt en
       niet in een opruimtaak.

       vul() weigert een claim die bestaand bewijs zou verzwakken, dus een
       tweede binding kan deze nooit stilletjes omlaag halen. */
    let inSessie = false;
    if (sessieregister && req.session.sid) {
      const nu = klok.datum().toISOString();
      const hk = { bron: 'toestelsleutel', methode: 'cryptografisch', vastgesteldOp: nu, regelversie: 'blok3' };
      const uit = sessieregister.vul(req.session.sid, {
        toestel: { toestelId: r.toestelId, bindingId: r.bindingId, bindingStand: 'bevestigd', herkomst: hk },
        /* SLEUTELBINDING IS IETS ANDERS DAN TOESTELBINDING, al ontstaan ze op
           hetzelfde moment. `toestel` zegt WELK toestel deze sessie draait;
           `sleutelbinding` zegt dat het TOKEN aan die sleutel vastzit en dat
           zware handelingen voortaan een bezitsbewijs vragen
           (kern/identiteit/bezitsbewijs.js). Ze samenvoegen zou betekenen dat je
           het een niet kunt hebben zonder het ander -- en juist het verschil
           tussen "ik weet waar je zit" en "een gestolen token helpt niet" is
           waar deze laag over gaat. */
        sleutelbinding: { keyRef: r.toestelId, schema: 'rtg-bezitsbewijs-v1', herkomst: hk }
      });
      inSessie = !!(uit && uit.ok);
    }
    spoor(req, 'toestel-gebonden', { toestelId: r.toestelId, nieuw: !!r.nieuw });
    res.json(Object.assign({}, r, { inSessie,
      /* Eerlijk over de reikwijdte: deze binding geldt voor DEZE sessie. Andere
         sessies op hetzelfde toestel zijn niet met terugwerkende kracht bewezen,
         want daar is nooit een handtekening voor gezien. */
      nietGeraakt: inSessie ? 'Andere sessies op dit toestel blijven onbevestigd: voor die sessies is nooit een handtekening gezien.'
        : 'Het toestel is bevestigd, maar deze sessie draagt geen identiteit en kon niet worden gebonden.' }));
  });

  app.post('/api/mijn/toestel/noem', auth, (req, res) => {
    if (!eisLid(req, res)) return;
    if (!toestellen) return res.status(503).json({ error: 'Toestelbinding is hier niet beschikbaar.' });
    const r = toestellen.noem(req.session.key, String(req.body.toestelId || ''), req.body.naam);
    res.status(r.error ? 400 : 200).json(r);
  });

  /* Een toestel intrekken sluit OOK zijn sessies. Die twee apart laten zou
     betekenen dat "ik vertrouw dit toestel niet meer" een naamplaatje weghaalt
     terwijl de sessie erop gewoon doorwerkt -- en dat is precies het toestel
     dat iemand kwijt is. */
  app.post('/api/mijn/toestel/introk', auth, async (req, res, next) => {
    try {
    if (!eisLid(req, res)) return;
    if (!toestellen) return res.status(503).json({ error: 'Toestelbinding is hier niet beschikbaar.' });
    const tid = String(req.body.toestelId || '');
    const r = toestellen.trekIn(req.session.key, tid);
    if (r.error) return res.status(400).json(r);
    const gesloten = [];
    for (const s of (sessieregister ? sessieregister.vanLid(req.session.key) : [])) {
      if (s.toestelId !== tid || s.sid === req.session.sid) continue;
      await accounts.trekInSessie(s.sid, klok.nu() + TOKEN_MAX_MS);
      sessieregister.sluit(s.sid);
      gesloten.push(s.sid);
    }
    if (accounts.wachtIntrekkingen) await accounts.wachtIntrekkingen();
    spoor(req, 'toestel-ingetrokken', { toestelId: tid, sessies: gesloten.length });
    res.json({ ok: true, toestelId: tid, sessiesGesloten: gesloten.length,
      nietGeraakt: 'Deze sessie blijft open, zodat u zichzelf niet buitensluit. De sleutel op dit toestel wordt in de browser gewist.' });
    } catch (e) { next(e); }
  });
};
