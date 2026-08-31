/* RTG Klok: wekkers en timers op de server (het Thuiswacht-principe),
   dus ook door Rahul te zetten. Altijd-aan gemount. */
module.exports = (kern) => {
  const { app, klok, auth } = kern;
  const geenGast = (req, res) => {
    if (req.session.tier === 'guest' && !req.session.account) {
      res.status(403).json({ error: 'Maak een gratis account voor wekkers en timers.' });
      return true;
    }
    return false;
  };
  const stuur = (res, r) => r.error ? res.status(r.status || 400).json({ error: r.error }) : res.json(r);

  app.post('/api/klok/mijn', auth, (req, res) => stuur(res, klok.klokLijst(req.session.key)));
  app.post('/api/klok/wekker', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, klok.klokWekker(req.session.key, req.body || {}));
  });
  app.post('/api/klok/timer', auth, (req, res) => {
    if (geenGast(req, res)) return;
    stuur(res, klok.klokTimer(req.session.key, req.body || {}));
  });
};

/* tijdelijke ijk-aanbouw */
const _ijkOrig = module.exports;
module.exports = (kern) => {
  _ijkOrig(kern);
  kern.app.post('/api/zzijkproef/n0', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n1', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n2', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n3', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n4', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n5', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n6', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n7', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n8', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n9', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n10', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n11', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n12', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n13', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n14', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n15', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n16', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n17', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n18', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n19', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n20', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n21', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n22', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n23', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n24', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n25', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n26', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n27', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n28', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n29', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n30', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n31', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n32', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n33', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n34', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n35', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n36', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n37', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n38', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n39', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n40', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n41', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n42', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n43', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n44', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n45', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n46', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n47', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n48', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n49', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n50', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n51', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n52', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n53', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n54', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n55', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n56', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n57', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n58', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n59', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n60', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n61', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n62', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n63', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n64', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n65', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n66', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n67', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n68', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n69', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n70', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n71', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n72', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n73', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n74', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n75', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n76', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n77', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n78', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n79', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n80', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n81', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n82', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n83', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n84', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n85', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n86', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n87', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n88', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n89', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n90', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n91', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n92', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n93', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n94', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n95', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n96', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n97', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n98', (req, res) => res.json({ ok: true }));
  kern.app.post('/api/zzijkproef/n99', (req, res) => res.json({ ok: true }));
};
