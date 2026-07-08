/* RTG realtime, gedeeld door het website-portaal en de app.
   - live updates via Server-Sent Events (schermen werken bij zonder refresh)
   - notificaties (in-app belletje + systeemmelding als het scherm open is)
   - web-push registratie (systeemmelding als het scherm dicht is) */

(function(){
  function b64ToUint8(base64){
    const pad = '='.repeat((4 - base64.length % 4) % 4);
    const s = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(s);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  window.RTGRealtime = {
    token: null,
    notifications: [],
    onSync: null,
    onChange: null,
    source: null,

    async start(token, opts){
      this.token = token;
      this.onSync = opts.onSync || null;
      this.onChange = opts.onChange || null;
      try {
        const r = await fetch('/api/notifications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
        });
        const d = await r.json();
        this.notifications = d.notifications || [];
      } catch (e) {}
      if (this.onChange) this.onChange();
      this._connect();
      return this.notifications;
    },

    _connect(){
      if (!window.EventSource) return;
      try { this.source = new EventSource('/api/stream?token=' + encodeURIComponent(this.token)); }
      catch (e) { return; }
      this.source.addEventListener('sync', e => {
        const d = JSON.parse(e.data);
        if (this.onSync) this.onSync(d.scope);
      });
      this.source.addEventListener('notify', e => {
        const n = JSON.parse(e.data);
        this.notifications.unshift(n);
        if (this.onChange) this.onChange(n);
        this._foreground(n);
      });
    },

    _foreground(n){
      if ('Notification' in window && Notification.permission === 'granted'){
        try { new Notification(n.title, { body: n.body, icon: 'icon.svg', tag: n.id }); } catch (e) {}
      }
    },

    unread(){ return this.notifications.filter(n => !n.read).length; },

    async markRead(){
      this.notifications.forEach(n => n.read = true);
      if (this.onChange) this.onChange();
      try {
        await fetch('/api/notifications/read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + this.token }
        });
      } catch (e) {}
    },

    /* Zet push aan: vraagt toestemming en registreert een subscription.
       Geeft een status terug voor de UI. */
    async enablePush(){
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window))
        return 'unsupported';
      let perm = Notification.permission;
      if (perm === 'default') perm = await Notification.requestPermission();
      if (perm !== 'granted') return 'denied';
      try {
        const reg = await navigator.serviceWorker.ready;
        const { key } = await (await fetch('/api/push/key')).json();
        if (!key) return 'unsupported';
        let sub = await reg.pushManager.getSubscription();
        if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(key) });
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + this.token },
          body: JSON.stringify({ subscription: sub })
        });
        return 'on';
      } catch (e) { return 'error'; }
    },

    pushState(){
      if (!('Notification' in window)) return 'unsupported';
      return Notification.permission === 'granted' ? 'on' : Notification.permission;
    },

    stop(){
      if (this.source){ this.source.close(); this.source = null; }
      this.notifications = [];
    }
  };
})();
