/* De Toestelkluis: het eigen toestel van het lid als opslag voor de eigen
   kopieen (facturen, tickets, overzichten). De bytes staan in de prive
   opslag van de browser (OPFS), per site afgeschermd door de browser zelf
   en alleen leesbaar op dit toestel; RTG kan er niet bij en er gaat niets
   over de lijn. De server houdt alleen het gezaghebbende record (het
   grootboek, contracten, identiteit): dat is de waarheid en blijft dat.

   We vragen een keer om "persistent storage", zodat de browser deze kluis
   niet stilletjes opruimt bij ruimtegebrek. Zonder OPFS (heel oude
   browsers) doen alle functies rustig niets: downloaden blijft gewoon
   werken, er valt alleen geen kopie in de kluis. */
(() => {
  if (window.Toestelkluis) return;
  const kan = () => !!(navigator.storage && navigator.storage.getDirectory);
  let vast = false;
  async function map() {
    const wortel = await navigator.storage.getDirectory();
    if (!vast) { vast = true; try { await navigator.storage.persist(); } catch (e) {} }
    return wortel.getDirectoryHandle('kluis', { create: true });
  }
  const veilig = naam => String(naam).replace(/[^\w.\-]+/g, '_').slice(0, 120);

  async function bewaar(naam, blob) {
    if (!kan()) return { ok: false };
    try {
      const d = await map();
      const f = await d.getFileHandle(veilig(naam), { create: true });
      const w = await f.createWritable();
      await w.write(blob);
      await w.close();
      return { ok: true, naam: veilig(naam) };
    } catch (e) { return { ok: false }; }
  }
  async function lijst() {
    if (!kan()) return [];
    try {
      const d = await map(), uit = [];
      for await (const [naam, h] of d.entries()) {
        if (h.kind !== 'file') continue;
        const f = await h.getFile();
        uit.push({ naam, bytes: f.size, at: f.lastModified });
      }
      return uit.sort((a, b) => b.at - a.at);
    } catch (e) { return []; }
  }
  async function haal(naam) {
    if (!kan()) return null;
    try { const d = await map(); return await (await d.getFileHandle(veilig(naam))).getFile(); }
    catch (e) { return null; }
  }
  async function wis(naam) {
    if (!kan()) return { ok: false };
    try { const d = await map(); await d.removeEntry(veilig(naam)); return { ok: true }; }
    catch (e) { return { ok: false }; }
  }
  async function ruimte() {
    try { const e = await navigator.storage.estimate(); return { gebruikt: e.usage || 0, totaal: e.quota || 0 }; }
    catch (e) { return { gebruikt: 0, totaal: 0 }; }
  }

  window.Toestelkluis = { kan, bewaar, lijst, haal, wis, ruimte };
})();
