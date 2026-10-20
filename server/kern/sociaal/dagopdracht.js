/* Vrijblijvende daguitnodiging, los van snaps, mediaopslag en contacten. */
/* ---------- de vuurtjes zijn eruit, en dat is een besluit ----------
   Hier stond een snap-streak per vriendenpaar: snapten jullie allebei op
   dezelfde dag, dan groeide het vuurtje, en een dag missen doofde het. Precies
   het patroon dat de huisregels van dit huis verbieden -- een teller die alleen
   omhoog gaat als je elke dag komt, maakt van contact een verplichting. Dat het
   in de RTFoundation-app stond, bij kinderen, maakte het niet beter.

   Wat blijft is de dag-opdracht hieronder: een uitnodiging ("iets geels"). Die
   kost je niets als je hem overslaat, en dat is het verschil.

   Oude installaties houden nog een dode db.data.streaks; er wordt niets meer
   in geschreven en niets meer uit gelezen. */
const dagVan = (t) => new Date(t || Date.now()).toISOString().slice(0, 10);

/* ---------- de dag-opdracht: elke dag een snap-uitdaging voor iedereen ---------- */
const OPDRACHTEN = [
  { emoji: 'emo-hart', tekst: 'iets geels' }, { emoji: 'balans', tekst: 'je uitzicht van nu' },
  { emoji: 'horeca', tekst: 'je ontbijt of lunch' }, { emoji: 'sport', tekst: 'je schoenen van vandaag' },
  { emoji: 'oogst', tekst: 'iets dat groeit' }, { emoji: 'reisboek', tekst: 'wat je aan het leren bent' },
  { emoji: 'emo-lol', tekst: 'iets dat je aan het lachen maakte' }, { emoji: 'ontwerp', tekst: 'de mooiste kleur om je heen' },
  { emoji: 'balans', tekst: 'iets met water' }, { emoji: 'emo-bloem', tekst: 'een dier (of iets dat erop lijkt)' },
  { emoji: 'help', tekst: 'een driehoek in het wild' }, { emoji: 'balans', tekst: 'de lucht van dit moment' },
  { emoji: 'entourage', tekst: 'iets dat je samen doet' }, { emoji: 'wonen', tekst: 'je favoriete plek thuis' },
  { emoji: 'muziek', tekst: 'waar jij muziek van krijgt' }, { emoji: 'mode', tekst: 'de gekste sok die je vindt' },
  { emoji: 'oogst', tekst: 'de oudste boom die je ziet' }, { emoji: 'sneltekst', tekst: 'je eigen handschrift' },
  { emoji: 'wonen', tekst: 'een spiegelbeeld (niet van jezelf)' }, { emoji: 'horeca', tekst: 'iets gezonds' },
  { emoji: 'taal', tekst: 'de eerste letter van je naam, ergens gevonden' }, { emoji: 'balans', tekst: 'iets dat bij de avond hoort' },
  { emoji: 'spelen', tekst: 'iets dat precies past' }, { emoji: 'auto', tekst: 'iets met wielen' },
  { emoji: 'balans', tekst: 'drie kleuren in een beeld' }, { emoji: 'agenda', tekst: 'hoe laat het is, zonder klok' },
  { emoji: 'emo-hart', tekst: 'iets waar je dankbaar voor bent' }, { emoji: 'ontdek', tekst: 'iets heel kleins, heel dichtbij' }
];
function dagOpdracht() {
  const dag = dagVan();
  let h = 0; for (const c of dag) h = ((h * 31) + c.charCodeAt(0)) >>> 0;
  return Object.assign({ dag }, OPDRACHTEN[h % OPDRACHTEN.length]);
}

module.exports = { dagOpdracht };
