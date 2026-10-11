/* De /media-routes, gemonteerd vanuit server.js (die staat over de omvanggrens;
   wat hier staat zou hem laten groeien).

   /media is fail-closed (./toegang.js, AUTHORITY.md B4): /media/:naam alleen
   voor beeld op een verklaarde openbare plek, al het andere via een kort geldige
   ondertekende link (/media/t/:token) die een domeinroute na haar eigen poort
   zet. Het geheim voor die links: RTG_ENC_KEY, anders een uit het sessiegeheim
   afgeleide sleutel (gedeeld tussen servers op dezelfde opslag). Lazy, want het
   sessiegeheim bestaat pas na het laden van de kluis. */
'use strict';

module.exports = function monteerMedia({ app, media, data, accounts }) {
  require('./toegang').zet({ data,
    geheim: () => process.env.RTG_ENC_KEY || accounts.sleutelVoor('media-link') });
  app.get('/media/:naam', (req, res) => { media.serveer(req, res).catch(() => { if (!res.headersSent) res.status(500).end(); }); });
  app.get('/media/t/:token', (req, res) => { media.serveerLink(req, res).catch(() => { if (!res.headersSent) res.status(404).end(); }); });
};
