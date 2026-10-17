(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.document) root.RTGRahulApproval = api;
})(typeof globalThis === 'undefined' ? null : globalThis, function () {
  'use strict';
  function create(opts) {
    var page = opts.page, win = opts.win, open = [], auth = '', path = '', boundOwner = '';
    var label = page.querySelector('[data-approval]'), button = page.querySelector('[data-approve]');
    function clear() { open = []; auth = ''; path = ''; boundOwner = ''; label.textContent = 'Geen open voorstel'; button.hidden = true; }
    function show(data, token, isMember, owner) {
      open = data && data.goedkeuringen || []; auth = token; boundOwner = owner;
      var world = isMember ? 'member' : data && data.goedkeuringWereld === 'staff' ? 'staff' : 'supplier';
      path = '/api/' + world + '/doe/bevestig'; var proposal = open[0];
      if (!proposal) { clear(); return; }
      label.textContent = proposal.samenvatting || proposal.pad || 'Voorstel klaar'; button.hidden = false;
    }
    async function confirm() {
      await opts.sync(); var proposal = open[0], owner = opts.owner();
      if (!proposal || !auth || boundOwner !== owner) return false;
      if (!win.confirm('Controleer deze exacte actie:\n\n' + (proposal.samenvatting || proposal.pad) + '\n\nWilt u dit eenmalige voorstel uitvoeren?')) return false;
      button.disabled = true;
      try {
        var response = await win.fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + auth }, body: JSON.stringify({ goedkeuringId: proposal.id, akkoord: true }) });
        var data = await response.json(); await opts.sync();
        if (opts.owner() !== owner) return false;
        if (!response.ok || data.error) throw new Error(data.error || 'Bevestiging mislukt.');
        if (win.RTGLiveTwin) win.RTGLiveTwin.bevestigd(data);
        opts.add('rahul', 'U heeft het exacte voorstel bevestigd en de server heeft het ' + (data.ok ? 'uitgevoerd.' : 'geweigerd.'));
        open.shift(); var world = path.indexOf('/staff/') >= 0 ? 'staff' : path.indexOf('/member/') >= 0 ? 'member' : 'supplier';
        show({ goedkeuringen: open, goedkeuringWereld: world }, auth, world === 'member', owner); return true;
      } catch (error) {
        await opts.sync(); if (opts.owner() === owner) opts.add('rahul', error.message || 'Het voorstel is niet uitgevoerd.'); return false;
      } finally { button.disabled = false; }
    }
    return Object.freeze({ clear: clear, show: show, confirm: confirm });
  }
  return Object.freeze({ create: create });
});
