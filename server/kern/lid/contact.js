/* De contactregels tussen de pas-niveaus: wie mag wie aanspreken in De Salon.

   Uit lid.js gelicht toen dat bestand over de 10 KB kwam. Het is ook een eigen
   onderwerp: hier staat een SOCIALE afspraak, en verder in lid.js staat wat een
   lid te zien krijgt. Die twee horen niet in elkaars weg te zitten.

   De afspraak: Lifestyle en Business mogen elk RTG-lid aanspreken; een RTG-lid
   reageert alleen met andere RTG-leden, tenzij een hoger lid het contact eerst
   legde. Een gast kan alleen liken. */
module.exports = function maakContact({ db, PERSONAS }) {
  function hasContact(higherFull, rtgFull) {
    return db.data.contacts.some(c => c.higher === higherFull && c.rtg === rtgFull);
  }
  function addContact(higherFull, rtgFull) {
    if (!hasContact(higherFull, rtgFull)) {
      db.data.contacts.push({ higher: higherFull, rtg: rtgFull });
    }
  }
  /* Wie een post schrijft, staat erin als CODENAAM (post.author, gezet met
     liveCodename). Het contactboek hieronder gebruikt daarom aan beide kanten
     diezelfde codenaam.

     Dat was niet zo, en daardoor deed de deur uit engageError() niets. Er werd
     een contact weggeschreven als {higher: volledige naam, rtg: codenaam} en
     opgezocht als {higher: codenaam, rtg: volledige naam} -- de velden stonden
     verwisseld, dus de vergelijking kon nooit kloppen. Voor een echt account
     niet, en voor de demo-persona's evenmin. De belofte "tenzij dit lid u eerst
     heeft aangesproken" is dus nooit ingelost. Dat is erger dan een gesloten
     deur: het scherm vertelde het lid dat er een weg was. */
  const ikBen = (sess) => (sess && sess.account) ? sess.account.codename
    : ((PERSONAS[sess && sess.tier] || {}).codename || null);

  function canEngage(sess, post) {
    if (sess.tier === 'guest') return false;
    if (sess.tier === 'rtg') {
      if (post.tier === 'rtg') return true;
      return hasContact(post.author, ikBen(sess));
    }
    return true;
  }
  function engageError(viewerTier) {
    if (viewerTier === 'guest') return 'Zonder pas kunt u alleen liken. Reageren en berichten zijn voor leden.';
    return 'Met de RTG Pass reageert en dm’t u alleen met andere RTG-leden, tenzij dit lid u eerst heeft aangesproken.';
  }
  /* Na een reactie/DM van een hoger lid op een RTG-post: leg het contact vast. */
  function registerContact(sess, post) {
    if ((sess.tier === 'lifestyle' || sess.tier === 'business') && post.tier === 'rtg') {
      addContact(ikBen(sess), post.author);
    }
  }

  return { hasContact, addContact, canEngage, engageError, registerContact };
};
