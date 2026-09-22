  /* One owner action for desktop buttons and mobile document gestures. */
  var documentActieBezig = new Set();
  async function markeren(id, aan) {
    var doc = stand && (stand.docs || []).find(function (x) { return x.id === id && x.vanMij; });
    if (!doc || documentActieBezig.has(id)) return false;
    documentActieBezig.add(id);
    try {
      var r = await api('ster', { id: id, aan: !!aan });
      if (r.status !== 200 || r.body.error || !r.body.ok) throw new Error(r.body.error || 'De markering kon niet worden bewaard.');
      await laadLijst();
      if (window.RTGDocs) await window.RTGDocs.vernieuw();
      return true;
    } catch (e) { zeg(e.message || 'De markering kon niet worden bewaard.'); return false; }
    finally { documentActieBezig.delete(id); }
  }
  async function verwijderen(id, bevestigd) {
    var doc = stand && (stand.docs || []).find(function (x) { return x.id === id && x.vanMij; });
    if (!doc || documentActieBezig.has(id)) return false;
    if (!bevestigd && !confirm('Wilt u "' + doc.titel + '" voorgoed verwijderen? Dit kunt u niet ongedaan maken.')) return false;
    documentActieBezig.add(id);
    try {
      var r = await api('weg', { id: id });
      if (r.status !== 200 || r.body.error || !r.body.ok) throw new Error(r.body.error || 'Het document kon niet worden verwijderd.');
      tabs = tabs.filter(function (tab) { return tab.id !== id; });
      if (open && open.id === id) { clearTimeout(bewaarT); sluitEditor(); }
      else tekenTabs();
      await laadLijst();
      if (window.RTGDocs) await window.RTGDocs.vernieuw();
      zeg('Het document is verwijderd.');
      return true;
    } catch (e) { zeg(e.message || 'Het document kon niet worden verwijderd. Probeer het opnieuw.'); return false; }
    finally { documentActieBezig.delete(id); }
  }
