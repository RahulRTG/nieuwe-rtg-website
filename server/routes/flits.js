/* Domein "flits": RTG Flits, de rijhulp van het netwerk. De ledenkant
   (rondom-beeld, melden, klopt/weg) achter de gewone leden-inlog; chauffeurs
   melden met dezelfde functies via hun PDA-inlog. Geen punten, geen spel. */
module.exports = (kern) => {
  const { app, auth, supplierAuth, liveCodename, flitsMeld, flitsStem, flitsRond, flitsVooruit } = kern;
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);
  const geenGast = (req, res) => {
    if (req.session.tier === 'guest') { res.status(403).json({ error: 'RTG Flits is voor leden.' }); return true; }
    return false;
  };

  // het rondom-beeld voor het rijscherm (land stuurt de flitser-landregel)
  app.post('/api/flits/rond', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, flitsRond({ lat: req.body.lat, lng: req.body.lng }, req.body.land));
  });
  // melden: een tik; dichtbij dezelfde soort telt als bevestiging
  app.post('/api/flits/meld', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, flitsMeld(req.session.key, liveCodename(req.session), req.body || {}));
  });
  // klopt nog / weg
  app.post('/api/flits/stem', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, flitsStem(req.session.key, req.body.id, req.body.klopt !== false));
  });
  // de vooruitblik: de Ghost Driver-motor over de stad van de rijder
  app.post('/api/flits/vooruit', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, flitsVooruit(String(req.body.stad || '')));
  });

  // de chauffeurskant: zelfde functies, op de PDA-inlog (naam van het netwerk)
  app.post('/api/staff/flits/meld', supplierAuth, (req, res) => {
    const wie = 'staff:' + req.supplier.code + ':' + (req.actor && req.actor.staffId || 'pda');
    stuur(res, flitsMeld(wie, (req.actor && req.actor.name) || req.supplier.name, req.body || {}));
  });
  app.post('/api/staff/flits/rond', supplierAuth, (req, res) => {
    stuur(res, flitsRond({ lat: req.body.lat, lng: req.body.lng }, req.body.land));
  });
};
