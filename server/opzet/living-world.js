'use strict';
/* Brondomeinen houden hun media en publicatierechten. Geen kopie van bytes,
   boekingen of kwalificaties in de ervaringslus. */
const {hash} = require('../kern/living-world/model');
module.exports = (kern,hulp) => {
  const sources = {
    context:require('./living-world-context')(kern),
    name:key=>kern.codenaamVan(key),
    media(owner,ref,viewer=owner) {
      const split = String(ref || '').indexOf(':');
      const kind = ref.slice(0,split), id = ref.slice(split+1);
      let row;
      if (kind === 'video') {
        row = (kern.theaterVideosVan(owner) || []).find(v=>v.id === id && v.klaar && !v.zaakCode);
      } else if (kind === 'clip') {
        row = (kern.clipsVan(owner,viewer) || []).find(v=>v.id === id);
      }
      if (!row) return null;
      return {mine:owner === viewer,shareable:true,version:hash([row.id,row.at,row.titel]),
        public:{id:ref,title:row.titel,poster:row.poster || null,
          url:'/apps/media.html#stuk=' + encodeURIComponent(ref)}};
    }
  };
  kern.livingWorld = require('../kern/living-world')({
    db:hulp.db,save:hulp.save,bewerkCollectie:hulp.bewerkCollectie,sources
  });
};
