/* Clientprojectie van een al geautoriseerd account; geen toegang tot opslag,
   sessies of wijzigingsfuncties. De aanroeper bepaalt wie dit mag opvragen. */
const tijdzone = require('../kern/tijdzone');
module.exports = (ctx) => {
  const { realNameOf, emailOf, phoneOf } = ctx;
/* Openbaar profiel voor de client (nooit de wachtwoord-hash of ruwe kluis). */
function publicUser(u) {
  if (!u) return null;
  const since = new Date(u.created_at);
  const months = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
  const full = realNameOf(u);
  const parts = full.trim().split(/\s+/);
  const shortName = parts.length > 1 ? parts[0][0] + '. ' + parts.slice(1).join(' ') : parts[0];
  return {
    id: u.id, tier: u.tier, name: shortName, full,
    email: emailOf(u), phone: phoneOf(u), codename: u.codename,
    number: 'RTG · ' + tijdzone.jaarIn(since) + ' · ' + String(1000 + u.id).slice(-4),
    since: months[tijdzone.maandIn(since) - 1] + ' ' + tijdzone.jaarIn(since),
    account: true, verified: u.verified || 'unverified', emailVerified: !!u.email_verified
  };
}

  return { publicUser };
};
