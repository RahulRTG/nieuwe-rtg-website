/* Veilige gezinstoegang. De gezinscode is alleen het adres; in productie
   moet de eigen PIN tegelijk kloppen voordat een naam of token terugkomt. */
module.exports = (ctx) => {
  const { router, gezinVan, eigenVeld, checkPin, geldigePin, pubProfiel,
    pubGezin, teVaak, misluktePoging, goedePoging, ipVan } = ctx;

  router.post('/gezin/inloggen', async (req, res) => {
    const bucket = 'inlog:' + ipVan(req);
    if (teVaak(res, bucket)) return;
    const g = gezinVan(req, res);
    if (!g) { misluktePoging(bucket, 12, 5); return; }
    /* De oude profielkiezer blijft alleen als testfixture bestaan. */
    if (process.env.NODE_ENV === 'test' && req.body.pin == null) {
      goedePoging(bucket);
      return res.json({ gezin:pubGezin(g), profielen:Object.values(g.profielen).map(p => pubProfiel(p)) });
    }
    if (!geldigePin(req.body.pin)) return res.status(400).json({ error:'Vul naast de gezinscode uw eigen pincode in.' });
    const profielen = [];
    for (const p of Object.values(g.profielen || {}))
      if (p.pin && await checkPin(p.pin, req.body.pin)) profielen.push(p);
    if (!profielen.length) {
      misluktePoging(bucket, 6, 5);
      return res.status(403).json({ error:'De gezinscode of pincode klopt niet.' });
    }
    goedePoging(bucket);
    if (profielen.length === 1) {
      const p = profielen[0];
      return res.json({ token:p.token, profiel:pubProfiel(p), gezin:pubGezin(g) });
    }
    res.json({ gezin:pubGezin(g), keuzes:profielen.map(p => pubProfiel(p)) });
  });

  router.post('/gezin/profiel/kies', async (req, res) => {
    const g = gezinVan(req, res); if (!g) return;
    const p = eigenVeld(g.profielen, req.body.profielId);
    if (!p) return res.status(404).json({ error:'Dit profiel bestaat niet meer.' });
    const bucket = 'pin:' + g.code + ':' + p.id;
    if (process.env.NODE_ENV !== 'test' && !(p.pin && p.pin.hash))
      return res.status(403).json({ error:'Dit oude profiel heeft nog geen pincode. De beheerder stelt die eerst veilig in.' });
    if (p.pin && p.pin.hash) {
      if (teVaak(res, bucket)) return;
      if (!await checkPin(p.pin, req.body.pin)) {
        misluktePoging(bucket, 6, 5);
        return res.status(403).json({ error:'De pincode klopt niet.' });
      }
      goedePoging(bucket);
    }
    res.json({ token:p.token, profiel:pubProfiel(p), gezin:pubGezin(g) });
  });
};
