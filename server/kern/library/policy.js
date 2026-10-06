'use strict';
const M = require('./model');
function represents(ctx, ref) { return ctx.identities.represents(ctx.actor, ref) === true; }
function party(ctx, ref = ctx.actor) {
  if (!ctx.identities.exists(ref) || !represents(ctx, ref)) M.fail('AUTHORITY_DENIED', 'U vertegenwoordigt deze partij niet.', 403);
  return ref;
}
function manager(ctx) {
  if (!represents(ctx, ctx.w.responsible)) M.fail('AUTHORITY_DENIED', 'Alleen de werkbeheerder mag dit doen.', 403);
}
function member(ctx) {
  const w = ctx.w;
  return represents(ctx, w.responsible) || Object.values(w.contributions).some(c =>
    c.status === 'accepted' && represents(ctx, c.actorRef)) || Object.values(w.agreements).some(a =>
    a.parties.some(p => represents(ctx, p)));
}
function readable(ctx) {
  if (!member(ctx)) M.fail('NOT_FOUND', 'Dit werk is niet beschikbaar.', 404);
}
function agreement(w) {
  const a = w.activeAgreementId && M.get(w.agreements, w.activeAgreementId);
  if (!a || a.status !== 'accepted') M.fail('AGREEMENT_REQUIRED', 'Een volledig geaccepteerde afspraak is vereist.', 409);
  if (a.conflict) M.fail('BLOCKING_CONFLICT', 'Er is een onopgelost samenwerkingsconflict.', 409);
  return a;
}
function editor(ctx) {
  const a = ctx.w.activeAgreementId && M.get(ctx.w.agreements, ctx.w.activeAgreementId);
  if (a ? a.status !== 'accepted' || a.conflict || !a.editors.some(p => represents(ctx, p)) : !represents(ctx, ctx.w.responsible))
    M.fail('EDIT_DENIED', 'U mag dit concept niet wijzigen.', 403);
}
function publisher(ctx) {
  const a = agreement(ctx.w);
  if (!represents(ctx, a.publisher)) M.fail('PUBLISH_DENIED', 'U mag voor deze afspraak niet publiceren.', 403);
  return a;
}
module.exports = { represents, party, manager, member, readable, agreement, editor, publisher };
