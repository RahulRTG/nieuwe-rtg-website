'use strict';
module.exports = ({app,auth,experience}) => {
  app.post('/api/living-world/view',auth,(req,res) => {
    if (req.session.tier === 'guest') return res.status(403).json({error:'Log in om uw wereld te openen.'});
    const out = experience.livingWorldView(req.session.key,req.body || {});
    res.status(out.status || 200).json(out);
  });
};
