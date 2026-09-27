/* Finale Connection-routes. De POST-lezers veranderen niets; alle overige
   routes zijn capability-gated en door state, consent, ownership of een
   doelgebonden idempotentiesleutel begrensd. */
'use strict';

const afgetekend={door:'Codex, handler en kernketen nagelezen; adversarial toetsen in connection-final.test.js',op:'2026-09-26'};
const bewijs={gemeten:'test/connection-final.test.js en de Connection Constitution bewijzen consent, purpose, state, block en projectiegrenzen',op:'2026-09-26'};
const toegang=capability=>({klasse:'AUTHENTICATED',connectionCapability:capability,
  uitleg:'auth stelt de actor vast; daarna openen Connection-policy en de domeineigen state-/ownershipgrens uitsluitend deze capability'});
const contract=(id,capability,stand,klasse,nagekeken)=>({mutatieId:id,herkomst:'mens',semantiek:{klasse},toegang:toegang(capability),stand,
  nagekeken,bewijs,afgetekend});
const lees=(id,cap)=>contract(id,cap,'NOT_APPLICABLE','idempotent','Deze POST is een projectielezer; dezelfde toestand levert dezelfde toegestane projectie en roept geen save aan.');
const zet=(id,cap)=>contract(id,cap,'PROTECTED','idempotent','De kern schrijft een gewenste toestand of guarded transition; herhalen creëert geen tweede domeinobject of geldmutatie.');
const sleutel=(id,cap)=>contract(id,cap,'PROTECTED','sleutelVereist','Een CSPRNG-idempotentiesleutel is verplicht en de kern geeft bij herhaling hetzelfde media-, call- of verzoekobject terug.');

const C={};
for(const product of ['vonk','rendezvous']){
  const p='/api/connection/'+product;
  C['POST '+p+'/status']=lees(product+'.communication.status','connection.message');
  C['POST '+p+'/consent']=zet(product+'.communication.consent','connection.communication.consent');
  C['POST '+p+'/text']=zet(product+'.communication.text','connection.message');
  C['POST '+p+'/message/remove']=zet(product+'.communication.message.remove','connection.message');
  C['POST '+p+'/message/report']=zet(product+'.communication.message.report','connection.safety.block');
  C['POST '+p+'/message-media']=sleutel(product+'.communication.media','connection.media');
  C['POST '+p+'/call/start']=sleutel(product+'.communication.call.start',product==='vonk'?'connection.voice':'connection.voice');
  C['POST '+p+'/call/answer']=zet(product+'.communication.call.answer','connection.call.control');
  C['POST '+p+'/call/signal']=zet(product+'.communication.call.signal','connection.call.control');
  C['POST '+p+'/call/poll']=lees(product+'.communication.call.poll','connection.call.control');
  C['POST '+p+'/call/end']=zet(product+'.communication.call.end','connection.call.control');
}
Object.assign(C,{
  'POST /api/vonk/profile-photo/order':zet('vonk.profile.photo.order','connection.profile.photo.manage'),
  'POST /api/member/rendezvous/profile-photo':sleutel('rendezvous.profile.photo.upload','connection.profile.photo.manage'),
  'POST /api/member/rendezvous/profile-photo/publish':zet('rendezvous.profile.photo.publish','connection.profile.photo.manage'),
  'POST /api/member/rendezvous/profile-photo/remove':zet('rendezvous.profile.photo.remove','connection.profile.photo.manage'),
  'POST /api/member/rendezvous/profile-photo/order':zet('rendezvous.profile.photo.order','connection.profile.photo.manage'),
  'POST /api/member/rendezvous/concierge':lees('rendezvous.concierge.list','connection.concierge.request'),
  'POST /api/member/rendezvous/concierge/request':sleutel('rendezvous.concierge.request','connection.concierge.request'),
  'POST /api/member/rendezvous/concierge/approve':zet('rendezvous.concierge.approve','connection.concierge.request'),
  'POST /api/office/rendezvous/concierge':lees('rendezvous.concierge.office.list','connection.concierge.manage'),
  'POST /api/office/rendezvous/concierge/step':zet('rendezvous.concierge.office.step','connection.concierge.manage'),
  'POST /api/office/rendezvous/arrangements':lees('rendezvous.arrangements.office.list','connection.concierge.manage'),
  'POST /api/office/rendezvous/arrangement/step':zet('rendezvous.arrangements.office.step','connection.concierge.manage'),
  'POST /api/member/rendezvous/circles':lees('rendezvous.circles.list','connection.circle.read'),
  'POST /api/member/rendezvous/circle/rsvp':zet('rendezvous.circle.rsvp','connection.circle.read'),
  'POST /api/office/rendezvous/circles':lees('rendezvous.circles.office.list','connection.circle.manage'),
  'POST /api/office/rendezvous/circle/create':sleutel('rendezvous.circle.create','connection.circle.manage'),
  'POST /api/office/rendezvous/circle/invite':zet('rendezvous.circle.invite','connection.circle.manage'),
  'POST /api/office/rendezvous/circle/gathering':sleutel('rendezvous.circle.gathering','connection.circle.manage')
});

module.exports={CONTRACTEN:C};
