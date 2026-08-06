module.exports = (kern) => {
  const { app } = kern;
  app.post('/api/zz-ijk/proef', (req, res) => res.json({ ok: true }));
};
