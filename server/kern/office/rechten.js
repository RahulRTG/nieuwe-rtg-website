/* Documentrechten gelden voor API, lijst en realtime, ook bij oude opslag. */
// de kring: een RTF-gezin deelt binnen het eigen gezin, nooit daarbuiten
const inKring = (d, kring) => !!(kring && d.kring === kring && d.kringDeel);
// Ook oude opslag kan nog een deling naast 'strikt' dragen. De lees- en
// schrijfgrens moet die tegenstrijdige stand zelf veilig afhandelen.
const deelbaar = d => !d.beheer || d.beheer.classificatie !== 'strikt';
const magSchrijven = (d, key, kring) => d.key === key || (deelbaar(d)
  && ((d.bewerkers || []).includes(key) || (inKring(d, kring) && d.kringDeel === 'bewerken')));
const magLezen = (d, key, kring) => magSchrijven(d, key, kring) || (deelbaar(d)
  && ((d.gedeeldMet || []).includes(key) || inKring(d, kring)));

module.exports = { inKring, magSchrijven, magLezen };
