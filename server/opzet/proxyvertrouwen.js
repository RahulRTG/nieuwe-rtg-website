'use strict';

/* Proxyvertrouwen is installatieconfiguratie, geen routebesluit. Eén plaats
   zet zowel het aantal vertrouwde hops als de expliciete proxyadressen. */
module.exports = function configureerProxyvertrouwen(app, env) {
  const omgeving = env || process.env;
  app.set('trust proxy', Number(omgeving.RTG_PROXY_HOPS != null ? omgeving.RTG_PROXY_HOPS : 1));
  app.set('proxy ips', String(omgeving.RTG_PROXY_IPS || '').split(',')
    .map(waarde => waarde.trim()).filter(Boolean));
};
