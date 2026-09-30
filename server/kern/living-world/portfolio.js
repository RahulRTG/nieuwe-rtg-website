'use strict';
const {activeKnowledge,href} = require('./model');
module.exports = (read,time) => key => {
  const s=read();
  return Object.values(s.contributions).filter(c=>c.owner===key && s.places[c.placeId].status === 'published' && activeKnowledge(c,time(),s))
    .map(c=>({id:c.id,title:c.title,source:'living-world',url:href('contribution',c.id),
      revision:c.revision,reviewedAt:c.review.at,
      claim:'Een bijdrage van dit lid is door de plekbeheerder beoordeeld en gedeeld.',
      limit:'Dit verleent geen beroepskwalificatie, mentorrol of uitvoeringsbevoegdheid.'}));
};
