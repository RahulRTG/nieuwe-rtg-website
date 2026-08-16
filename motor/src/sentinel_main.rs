/* RTG Sentinel — onafhankelijke Rust-voordeur en lokale herstelkamer.

   De app luistert alleen intern. Sentinel staat ervoor en kan verkeer stoppen
   zonder medewerking van Node. De beheerpoort hoort op loopback; beheer op
   afstand gaat via SSH of `docker compose exec sentinel ...`, niet via een
   openbaar dashboard. Zero dependencies, alleen std + rtg_motor. */
use rtg_motor::{aead, http::{self,Request,Response}, json::{self,Json}, rng, sentinel::{self,Mode,Sentinel}};
use std::collections::HashMap;
use std::fs::{self,OpenOptions};
use std::io::{self,Read,Write};
use std::net::{IpAddr,Shutdown,SocketAddr,TcpListener,TcpStream,ToSocketAddrs};
use std::path::{Path,PathBuf};
use std::sync::{Arc,Mutex};
use std::sync::atomic::{AtomicU64,Ordering};
use std::thread;
use std::time::Duration;

fn env(k:&str,d:&str)->String{std::env::var(k).unwrap_or_else(|_|d.into())}
fn env_bool(k:&str,d:bool)->bool{match std::env::var(k).ok().as_deref(){Some("1")|Some("true")|Some("ja")=>true,Some("0")|Some("false")|Some("nee")=>false,_=>d}}
fn is_loopback(addr:&str)->bool{
    if let Ok(a)=addr.parse::<SocketAddr>(){return a.ip().is_loopback()}
    if let Ok(a)=addr.parse::<IpAddr>(){return a.is_loopback()}
    let host=addr.rsplit_once(':').map(|x|x.0).unwrap_or(addr);
    host.eq_ignore_ascii_case("localhost")||host.parse::<IpAddr>().map(|x|x.is_loopback()).unwrap_or(false)
}
fn verbind(addr:&str,timeout:Duration)->io::Result<TcpStream>{
    let mut laatste=None;
    for a in addr.to_socket_addrs()?{match TcpStream::connect_timeout(&a,timeout){Ok(s)=>return Ok(s),Err(e)=>laatste=Some(e)}}
    Err(laatste.unwrap_or_else(||io::Error::new(io::ErrorKind::InvalidInput,"adres lost niet op")))
}
fn token_pad()->PathBuf{PathBuf::from(env("RTG_SENTINEL_TOKEN_FILE","sentinel-data/control.token"))}
fn lees_token()->Result<Vec<u8>,String>{
    let s=match std::env::var("RTG_SENTINEL_TOKEN"){Ok(x)if !x.trim().is_empty()=>x,
      _=>fs::read_to_string(token_pad()).map_err(|_|"Sentinel-token ontbreekt; draai `rtg-sentinel init`.".to_string())?};
    let s=s.trim();if s.len()<32{return Err("Sentinel-token is te kort (minimaal 32 tekens).".into())}
    Ok(s.as_bytes().to_vec())
}
fn schrijf_token(p:&Path)->Result<(),String>{
    if p.exists(){return Err(format!("Tokenbestand bestaat al: {}",p.display()))}
    if let Some(d)=p.parent(){fs::create_dir_all(d).map_err(|e|e.to_string())?}
    let token=rng::code(64).map_err(|e|e.to_string())?;
    #[cfg(unix)] {use std::os::unix::fs::OpenOptionsExt;let mut f=OpenOptions::new().write(true).create_new(true).mode(0o600).open(p).map_err(|e|e.to_string())?;f.write_all((token+"\n").as_bytes()).map_err(|e|e.to_string())?;}
    #[cfg(not(unix))] {fs::write(p,token+"\n").map_err(|e|e.to_string())?;}
    println!("Sentinel-beheersleutel gemaakt: {}",p.display());Ok(())
}

type Actief=Arc<Mutex<HashMap<u64,TcpStream>>>;
struct Verbinding{nummer:u64,actief:Actief}
impl Drop for Verbinding{fn drop(&mut self){if let Ok(mut a)=self.actief.lock(){a.remove(&self.nummer);}}}
fn sluit_actief(a:&Actief){if let Ok(mut m)=a.lock(){for s in m.values(){let _=s.shutdown(Shutdown::Both);}m.clear();}}

fn antwoord(mut s:TcpStream,status:u16,body:&str,extra:&str)->io::Result<()> {
    let reden=match status{200=>"OK",400=>"Bad Request",403=>"Forbidden",409=>"Conflict",413=>"Payload Too Large",503=>"Service Unavailable",_=>"Error"};
    write!(s,"HTTP/1.1 {} {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nCache-Control: no-store\r\nConnection: close\r\n{}\r\n{}",status,reden,body.len(),extra,body)
}
fn header_einde(b:&[u8])->Option<usize>{b.windows(4).position(|x|x==b"\r\n\r\n").map(|i|i+4)}
#[cfg_attr(not(test),allow(dead_code))]
struct Kop{methode:String,pad:String,content_len:usize,upgrade:bool,nieuw:Vec<u8>}
fn lees_kop(s:&mut TcpStream)->Result<(Kop,Vec<u8>),String>{
    s.set_read_timeout(Some(Duration::from_secs(15))).ok();let mut alles=Vec::new();let mut buf=[0u8;4096];
    let einde=loop{let n=s.read(&mut buf).map_err(|e|e.to_string())?;if n==0{return Err("verbinding sloot voor de kop".into())}alles.extend_from_slice(&buf[..n]);
      if alles.len()>64*1024{return Err("verzoekkop boven 64 KiB".into())}if let Some(i)=header_einde(&alles){break i}};
    let kop=std::str::from_utf8(&alles[..einde]).map_err(|_|"verzoekkop is geen UTF-8")?;
    // Alleen CRLF. Een andere ontleding tussen proxy en app is request smuggling.
    for (i,b) in kop.as_bytes().iter().enumerate(){if *b==b'\n'&&(i==0||kop.as_bytes()[i-1]!=b'\r'){return Err("kale LF in verzoekkop".into())}if *b==b'\r'&&kop.as_bytes().get(i+1)!=Some(&b'\n'){return Err("kale CR in verzoekkop".into())}}
    let mut lijnen=kop[..kop.len()-4].split("\r\n");let start=lijnen.next().ok_or("lege startlijn")?;let d=start.split_whitespace().collect::<Vec<_>>();
    if d.len()!=3||!d[1].starts_with('/')||!(d[2]=="HTTP/1.1"||d[2]=="HTTP/1.0"){return Err("ongeldige startlijn".into())}
    let mut cl=None;let mut upgrade=false;let mut bewaard=Vec::new();let mut host=false;
    for l in lijnen{let (n,v)=l.split_once(':').ok_or("header zonder dubbele punt")?;let n=n.trim();let v=v.trim();
      if n.is_empty()||n!=l.split_once(':').unwrap().0||!n.bytes().all(|b|b.is_ascii_alphanumeric()||b"!#$%&'*+-.^_`|~".contains(&b)){return Err("ongeldige headernaam".into())}
      if n.eq_ignore_ascii_case("transfer-encoding"){return Err("Transfer-Encoding wordt aan deze grens geweigerd".into())}
      if n.eq_ignore_ascii_case("expect"){return Err("Expect wordt aan deze grens geweigerd".into())}
      if n.eq_ignore_ascii_case("content-length"){if v.is_empty()||!v.bytes().all(|x|x.is_ascii_digit()){return Err("ongeldige Content-Length".into())}let x=v.parse::<usize>().map_err(|_|"Content-Length te groot")?;if cl.is_some()&&cl!=Some(x){return Err("botsende Content-Length".into())}cl=Some(x);}
      if n.eq_ignore_ascii_case("upgrade"){upgrade=true;}
      if n.eq_ignore_ascii_case("host"){if host||v.is_empty(){return Err("ontbrekende of dubbele Host".into())}host=true;}
      let doorstuur=!n.eq_ignore_ascii_case("connection")&&!n.eq_ignore_ascii_case("proxy-connection")
        &&!n.eq_ignore_ascii_case("keep-alive")&&!n.eq_ignore_ascii_case("te")&&!n.eq_ignore_ascii_case("trailer")
        &&!n.eq_ignore_ascii_case("proxy-authenticate")&&!n.eq_ignore_ascii_case("proxy-authorization")
        &&!n.eq_ignore_ascii_case("forwarded")&&!n.eq_ignore_ascii_case("x-real-ip")
        &&!n.to_ascii_lowercase().starts_with("x-forwarded-");
      if doorstuur{bewaard.push(l);}
    }
    if !host{return Err("Host ontbreekt".into())}
    let content_len=cl.unwrap_or(0);if content_len>128*1024*1024{return Err("body boven 128 MiB".into())}
    let mut nieuw=format!("{}\r\n",start);for l in bewaard{nieuw.push_str(l);nieuw.push_str("\r\n");}
    nieuw.push_str(if upgrade{"Connection: upgrade\r\n\r\n"}else{"Connection: close\r\n\r\n"});
    Ok((Kop{methode:d[0].into(),pad:d[1].split('?').next().unwrap_or(d[1]).into(),content_len,upgrade,nieuw:nieuw.into_bytes()},alles[einde..].to_vec()))
}
fn stuur_body(client:&mut TcpStream,up:&mut TcpStream,eerste:&[u8],lengte:usize)->Result<(),String>{
    if eerste.len()>lengte{return Err("pipelining na de body wordt geweigerd".into())}
    up.write_all(eerste).map_err(|e|e.to_string())?;let mut over=lengte-eerste.len();let mut b=[0u8;64*1024];
    while over>0{let grens=over.min(b.len());let n=client.read(&mut b[..grens]).map_err(|e|e.to_string())?;if n==0{return Err("body voortijdig gesloten".into())}up.write_all(&b[..n]).map_err(|e|e.to_string())?;over-=n;}Ok(())
}
fn relay_upgrade(mut client:TcpStream,mut up:TcpStream)->io::Result<()> {
    let mut c2=client.try_clone()?;let mut u2=up.try_clone()?;let t=thread::spawn(move||io::copy(&mut c2,&mut u2));let r=io::copy(&mut up,&mut client);let _=t.join();r.map(|_|())
}
fn proxy_een(mut client:TcpStream,upstream:&str,proto:&str,state:Arc<Mutex<Sentinel>>,actief:Actief,nummer:u64){
    let _guard=Verbinding{nummer,actief};
    let peer=client.peer_addr().map(|x|x.ip().to_string()).unwrap_or_else(|_|"onbekend".into());
    let (kop,eerst)=match lees_kop(&mut client){Ok(x)=>x,Err(e)=>{let body=format!("{{\"error\":\"Sentinel weigert het verzoek: {}\"}}",e.replace('"',"'"));let _=antwoord(client,400,&body,"");return}};
    if kop.pad=="/__sentinel/live"{let _=antwoord(client,200,"{\"ok\":true,\"sentinel\":true}","");return}
    if kop.pad=="/__sentinel/ready"{let (klaar,body)={let s=state.lock().unwrap();let ok=s.mode!=Mode::Isolatie&&s.scan.ok&&s.upstream_gezond;(ok,s.status_json(0).dump())};let _=antwoord(client,if klaar{200}else{503},&body,"");return}
    let toegestaan={state.lock().unwrap().staat_pad_toe(&kop.pad)};
    if !toegestaan{let s=state.lock().unwrap();let body=format!("{{\"error\":\"RTG is door Sentinel afgesloten.\",\"mode\":\"{}\",\"revisie\":{}}}",s.mode.as_str(),s.revisie);let _=antwoord(client,503,&body,"Retry-After: 60\r\n");return}
    let mut up=match verbind(upstream,Duration::from_secs(3)){Ok(x)=>x,Err(_)=>{let _=antwoord(client,503,"{\"error\":\"RTG-hoofdproces niet bereikbaar.\"}","Retry-After: 5\r\n");return}};
    let mut nieuwe_kop=kop.nieuw.clone();nieuwe_kop.truncate(nieuwe_kop.len().saturating_sub(2));
    nieuwe_kop.extend_from_slice(format!("X-Forwarded-For: {}\r\nX-Forwarded-Proto: {}\r\n\r\n",peer,proto).as_bytes());
    up.set_read_timeout(Some(Duration::from_secs(60))).ok();if up.write_all(&nieuwe_kop).is_err(){return}
    if kop.upgrade{if up.write_all(&eerst).is_ok(){let _=relay_upgrade(client,up);}return}
    if stuur_body(&mut client,&mut up,&eerst,kop.content_len).is_err(){return}
    // Geen TCP half-close: een asynchrone Node-poort kan de clientverbinding
    // dan al opruimen voordat zijn antwoord klaar is. Content-Length en de
    // geweigerde Transfer-Encoding begrenzen het verzoek volledig.
    let _=io::copy(&mut up,&mut client);
}

fn fout(status:u16,msg:&str)->Response{let mut j=Json::obj();j.set("error",Json::Str(msg.into()));Response{status,body:j.dump()}}
fn prefixes(j:&Json)->Vec<String>{match j.get("prefixes"){Some(Json::Arr(a))=>a.iter().filter_map(|x|x.as_str().map(str::to_string)).collect(),_=>Vec::new()}}
fn controle_handler(req:&Request,state:&Arc<Mutex<Sentinel>>,actief:&Actief,token:&[u8],fail_closed:bool)->Response{
    if req.path=="/v1/live"{return Response{status:200,body:"{\"ok\":true,\"sentinel\":true}".into()}}
    if !aead::ct_eq(req.token.as_bytes(),token){return fout(403,"Geen geldige Sentinel-beheersleutel.")}
    if req.method=="GET"&&req.path=="/v1/status"{let s=state.lock().unwrap();return Response{status:200,body:s.status_json(actief.lock().map(|x|x.len()).unwrap_or(0)).dump()}}
    if req.method=="GET"&&req.path=="/v1/audit"{let s=state.lock().unwrap();return match sentinel::audit_tail(&s.data.join("audit.jsonl"),50){Ok(j)=>Response{status:200,body:j.dump()},Err(e)=>fout(500,&e)}}
    if req.method=="POST"&&req.path=="/v1/scan"{let mut s=state.lock().unwrap();let ok=s.scan_nu(fail_closed);if !ok{sluit_actief(actief)}return Response{status:if ok{200}else{409},body:s.status_json(actief.lock().map(|x|x.len()).unwrap_or(0)).dump()}}
    if req.method=="POST"&&req.path=="/v1/mode"{
        let j=match json::parse(if req.body.is_empty(){"{}"}else{&req.body}){Ok(x)=>x,Err(_)=>return fout(400,"Kapotte JSON.")};
        let mode=match Mode::parse(j.str_at("mode").unwrap_or("")){Some(x)=>x,None=>return fout(400,"Mode moet normaal, waakzaam, beperkt of isolatie zijn.")};
        if mode==Mode::Isolatie&&j.str_at("bevestiging")!=Some("ISOLEER RTG"){return fout(400,"Typ exact ISOLEER RTG.")}
        let was_isolatie=state.lock().unwrap().mode==Mode::Isolatie;
        if mode==Mode::Normaal&&was_isolatie&&j.str_at("bevestiging")!=Some("HERSTEL RTG"){return fout(400,"Typ exact HERSTEL RTG.")}
        let reden=j.str_at("reden").unwrap_or("");let ps=prefixes(&j);let mut s=state.lock().unwrap();
        if let Err(e)=s.wijzig(mode,reden,ps,"beheerstand"){return fout(409,&e)}drop(s);sluit_actief(actief);
        let s=state.lock().unwrap();return Response{status:200,body:s.status_json(0).dump()}
    }
    fout(404,"Onbekende Sentinel-route.")
}

fn probe(upstream:&str)->bool{
    let mut s=match verbind(upstream,Duration::from_secs(2)){Ok(x)=>x,Err(_)=>return false};
    s.set_read_timeout(Some(Duration::from_secs(3))).ok();if s.write_all(b"GET /api/health HTTP/1.1\r\nHost: rtg-intern\r\nConnection: close\r\n\r\n").is_err(){return false}
    let mut b=[0u8;32];match s.read(&mut b){Ok(n)=>String::from_utf8_lossy(&b[..n]).starts_with("HTTP/1.1 200"),Err(_)=>false}
}

fn daemon()->Result<(),String>{
    let token=lees_token()?;let root=PathBuf::from(env("RTG_SENTINEL_ROOT","."));let bewijs=PathBuf::from(env("RTG_SENTINEL_BEWIJS","release-bewijs.json"));
    let bewijs=if bewijs.is_absolute(){bewijs}else{root.join(bewijs)};let data=PathBuf::from(env("RTG_SENTINEL_DATA","sentinel-data"));
    let pin=env("RTG_RELEASE_BEWIJS_SHA256","");let proxy_addr=env("RTG_SENTINEL_ADDR","127.0.0.1:3080");let control=env("RTG_SENTINEL_CONTROL_ADDR","127.0.0.1:3091");
    let upstream=env("RTG_SENTINEL_UPSTREAM","127.0.0.1:3000");let fail_closed=env_bool("RTG_SENTINEL_FAIL_CLOSED",true);
    let proto=env("RTG_SENTINEL_FORWARDED_PROTO","http").to_ascii_lowercase();
    if proto!="http"&&proto!="https"{return Err("RTG_SENTINEL_FORWARDED_PROTO moet http of https zijn.".into())}
    if !is_loopback(&control)&&!env_bool("RTG_SENTINEL_CONTROL_EXTERN_BEWUST",false){return Err("Beheeradres is niet loopback; zet RTG_SENTINEL_CONTROL_EXTERN_BEWUST=1 alleen achter een aparte beheerfirewall.".into())}
    if proxy_addr==upstream{return Err("Sentinel-proxy en upstream mogen niet hetzelfde adres zijn.".into())}proxy_addr.to_socket_addrs().map_err(|_|"Ongeldig Sentinel-luisteradres")?;upstream.to_socket_addrs().map_err(|_|"Ongeldig upstreamadres")?;
    let mut kern=Sentinel::open(root,bewijs,pin,data,token.clone())?;let groen=kern.scan_nu(fail_closed);
    eprintln!("[sentinel] releasecontrole: {} ({} verschil(len))",if groen{"groen"}else{"ROOD"},kern.scan.verschil_aantal);
    let state=Arc::new(Mutex::new(kern));let actief:Actief=Arc::new(Mutex::new(HashMap::new()));
    {let s=Arc::clone(&state);let a=Arc::clone(&actief);let t=token.clone();let c=control.clone();thread::spawn(move||{if let Err(e)=http::serve(&c,64,move|r|controle_handler(r,&s,&a,&t,fail_closed)){eprintln!("[sentinel] beheerpoort gestopt: {}",e);std::process::exit(1)}});}
    {let s=Arc::clone(&state);let a=Arc::clone(&actief);let up=upstream.clone();let interval=env("RTG_SENTINEL_PROBE_SEC","10").parse::<u64>().unwrap_or(10).clamp(2,300);let auto=env("RTG_SENTINEL_AUTO_ISOLATE_AFTER","0").parse::<u64>().unwrap_or(0);
      thread::spawn(move||loop{let ok=probe(&up);let mut k=s.lock().unwrap();k.zet_upstream(ok);let isoleren=auto>0&&k.upstream_fouten>=auto&&k.mode!=Mode::Isolatie;if isoleren{let reden=format!("Hoofdproces {} controles onbereikbaar.",k.upstream_fouten);let _=k.wijzig(Mode::Isolatie,&reden,Vec::new(),"auto-isolatie-upstream");}drop(k);if isoleren{sluit_actief(&a);}thread::sleep(Duration::from_secs(interval));});}
    {let s=Arc::clone(&state);let a=Arc::clone(&actief);let sec=env("RTG_SENTINEL_SCAN_SEC","300").parse::<u64>().unwrap_or(300).clamp(30,86400);thread::spawn(move||loop{thread::sleep(Duration::from_secs(sec));let mut k=s.lock().unwrap();if !k.scan_nu(fail_closed){drop(k);sluit_actief(&a);}});}
    let listener=TcpListener::bind(&proxy_addr).map_err(|e|format!("Proxy {}: {}",proxy_addr,e))?;eprintln!("[sentinel] voordeur {} -> {}; beheer {}",proxy_addr,upstream,control);
    let teller=AtomicU64::new(1);for c in listener.incoming(){let c=match c{Ok(x)=>x,Err(_)=>continue};let n=teller.fetch_add(1,Ordering::Relaxed);if let Ok(mut m)=actief.lock(){if let Ok(k)=c.try_clone(){m.insert(n,k);}}
      let s=Arc::clone(&state);let a=Arc::clone(&actief);let up=upstream.clone();let p=proto.clone();thread::spawn(move||proxy_een(c,&up,&p,s,a,n));}Ok(())
}

fn ctl(args:&[String])->Result<(),String>{
    let token=String::from_utf8(lees_token()?).map_err(|_|"Token is geen UTF-8")?;let addr=env("RTG_SENTINEL_CONTROL_ADDR","127.0.0.1:3091");let cmd=args.get(0).map(String::as_str).unwrap_or("status");
    let (method,path,body)=match cmd{
      "status"=>("GET","/v1/status",String::new()),"audit"=>("GET","/v1/audit",String::new()),"scan"=>("POST","/v1/scan","{}".into()),
      "watch"=>{let r=args.get(1).ok_or("Gebruik: ctl watch <reden>")?;( "POST","/v1/mode",format!("{{\"mode\":\"waakzaam\",\"reden\":{}}}",Json::Str(r.clone()).dump()))},
      "restrict"=>{let ps=args.get(1).ok_or("Gebruik: ctl restrict </pad,/pad2> <reden>")?.split(',').map(|x|Json::Str(x.into())).collect::<Vec<_>>();let r=args.get(2).ok_or("Reden ontbreekt")?;( "POST","/v1/mode",format!("{{\"mode\":\"beperkt\",\"reden\":{},\"prefixes\":{}}}",Json::Str(r.clone()).dump(),Json::Arr(ps).dump()))},
      "isolate"=>{let r=args.get(1).ok_or("Gebruik: ctl isolate <reden> 'ISOLEER RTG'")?;let b=args.get(2).map(String::as_str).unwrap_or("");( "POST","/v1/mode",format!("{{\"mode\":\"isolatie\",\"reden\":{},\"bevestiging\":{}}}",Json::Str(r.clone()).dump(),Json::Str(b.into()).dump()))},
      "restore"=>{let r=args.get(1).ok_or("Gebruik: ctl restore <reden> 'HERSTEL RTG'")?;let b=args.get(2).map(String::as_str).unwrap_or("");( "POST","/v1/mode",format!("{{\"mode\":\"normaal\",\"reden\":{},\"bevestiging\":{}}}",Json::Str(r.clone()).dump(),Json::Str(b.into()).dump()))},
      _=>return Err("Commando: status, audit, scan, watch, restrict, isolate of restore.".into())};
    let mut s=TcpStream::connect(&addr).map_err(|e|format!("Sentinel-beheer {}: {}",addr,e))?;let req=format!("{} {} HTTP/1.1\r\nHost: sentinel\r\nAuthorization: Bearer {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",method,path,token.trim(),body.len(),body);s.write_all(req.as_bytes()).map_err(|e|e.to_string())?;s.shutdown(Shutdown::Write).ok();let mut uit=String::new();s.read_to_string(&mut uit).map_err(|e|e.to_string())?;let status=uit.split_whitespace().nth(1).and_then(|x|x.parse::<u16>().ok()).unwrap_or(500);let body=uit.split("\r\n\r\n").nth(1).unwrap_or(&uit);println!("{}",body);if status>=300{return Err(format!("Sentinel antwoordde {}",status))}Ok(())
}

/* Een kapotte auditketen mag nooit via de netwerk-API worden "gerepareerd".
   Offline bewaren we audit én stand onder een nieuwe naam, starten we een
   nieuwe keten verplicht in isolatie en laten we alle bewijsbestanden staan. */
fn herstel_audit(args:&[String])->Result<(),String>{
    if args.get(0).map(String::as_str)!=Some("BEWAAR EN HERSTART AUDIT"){
        return Err("Stop Sentinel en typ exact: recover-audit 'BEWAAR EN HERSTART AUDIT'".into())
    }
    let control=env("RTG_SENTINEL_CONTROL_ADDR","127.0.0.1:3091");
    if verbind(&control,Duration::from_millis(250)).is_ok(){return Err("Sentinel draait nog; stop hem eerst zodat het bewijs niet verandert.".into())}
    let token=lees_token()?;let data=PathBuf::from(env("RTG_SENTINEL_DATA","sentinel-data"));let audit=data.join("audit.jsonl");
    if !audit.exists(){return Err("Er is geen auditbestand om veilig te stellen.".into())}
    if sentinel::controleer_audit(&audit,&token).is_ok(){return Err("De auditketen is geldig; herstel is niet nodig.".into())}
    let suffix=rng::nu_ms();let state=data.join("state.json");
    let state_bewijs=data.join(format!("state.corrupt-{}.json",suffix));
    let audit_bewijs=data.join(format!("audit.corrupt-{}.jsonl",suffix));
    if state.exists(){fs::rename(&state,&state_bewijs).map_err(|e|format!("Stand veiligstellen: {}",e))?;}
    fs::rename(&audit,&audit_bewijs).map_err(|e|format!("Audit veiligstellen: {}",e))?;
    let root=PathBuf::from(env("RTG_SENTINEL_ROOT","."));let bewijs=PathBuf::from(env("RTG_SENTINEL_BEWIJS","release-bewijs.json"));
    let bewijs=if bewijs.is_absolute(){bewijs}else{root.join(bewijs)};let pin=env("RTG_RELEASE_BEWIJS_SHA256","");
    let mut s=Sentinel::open(root,bewijs,pin,data.clone(),token)?;s.scan_nu(true);
    if s.mode!=Mode::Isolatie{s.wijzig(Mode::Isolatie,"Auditbewijs veiliggesteld; onderzoek vereist voor herstel.",Vec::new(),"offline-auditherstel")?;}
    println!("Oude audit veiliggesteld: {}",audit_bewijs.display());
    if state_bewijs.exists(){println!("Oude stand veiliggesteld: {}",state_bewijs.display());}
    println!("Nieuwe audit gestart in isolatie. Start Sentinel en herstel pas na onderzoek en een groene scan.");Ok(())
}

fn hoofd()->Result<(),String>{let args=std::env::args().skip(1).collect::<Vec<_>>();match args.get(0).map(String::as_str){
    Some("init")=>{let p=args.get(1).map(PathBuf::from).unwrap_or_else(token_pad);schrijf_token(&p)},
    Some("ctl")=>ctl(&args[1..]),
    Some("verify-audit")=>{let t=lees_token()?;let data=PathBuf::from(env("RTG_SENTINEL_DATA","sentinel-data"));match sentinel::controleer_audit(&data.join("audit.jsonl"),&t){Ok((true,n,h))=>{println!("Auditketen geldig: {} regels, kop {}",n,if h.is_empty(){"leeg"}else{&h});Ok(())},Ok(_)=>Err("Auditketen ongeldig".into()),Err(e)=>Err(e)}},
    Some("recover-audit")=>herstel_audit(&args[1..]),
    Some("help")|Some("--help")=>{println!("rtg-sentinel [serve]\nrtg-sentinel init [tokenbestand]\nrtg-sentinel ctl status|audit|scan|watch|restrict|isolate|restore\nrtg-sentinel verify-audit\nrtg-sentinel recover-audit 'BEWAAR EN HERSTART AUDIT'");Ok(())},
    Some("serve")|None=>daemon(),Some(x)=>Err(format!("Onbekend commando: {}",x))}}
fn main(){if let Err(e)=hoofd(){eprintln!("[sentinel] {}",e);std::process::exit(1)}}

#[cfg(test)]
mod tests{
 use super::*;
 #[test]fn loopback_guard(){assert!(is_loopback("127.0.0.1:3091"));assert!(is_loopback("[::1]:3091"));assert!(!is_loopback("0.0.0.0:3091"));}
 #[test]fn verzoekgrens_weigert_smuggling(){let listener=TcpListener::bind("127.0.0.1:0").unwrap();let a=listener.local_addr().unwrap();let t=thread::spawn(move||{let(mut s,_)=listener.accept().unwrap();lees_kop(&mut s)});let mut c=TcpStream::connect(a).unwrap();c.write_all(b"POST /x HTTP/1.1\r\nContent-Length: 2\r\nContent-Length: 3\r\n\r\n{}").unwrap();assert!(t.join().unwrap().is_err());}
 #[test]fn verzoekgrens_leest_pad_en_body(){let listener=TcpListener::bind("127.0.0.1:0").unwrap();let a=listener.local_addr().unwrap();let t=thread::spawn(move||{let(mut s,_)=listener.accept().unwrap();lees_kop(&mut s).unwrap()});let mut c=TcpStream::connect(a).unwrap();c.write_all(b"POST /api/pay/x?q=1 HTTP/1.1\r\nHost: x\r\nContent-Length: 2\r\n\r\n{}").unwrap();let(k,b)=t.join().unwrap();assert_eq!(k.methode,"POST");assert_eq!(k.pad,"/api/pay/x");assert_eq!(b,b"{}");}
 #[test]fn verzoekgrens_verwijdert_client_forwarding(){let listener=TcpListener::bind("127.0.0.1:0").unwrap();let a=listener.local_addr().unwrap();let t=thread::spawn(move||{let(mut s,_)=listener.accept().unwrap();lees_kop(&mut s).unwrap().0});let mut c=TcpStream::connect(a).unwrap();c.write_all(b"GET / HTTP/1.1\r\nHost: x\r\nX-Forwarded-For: 1.2.3.4\r\nForwarded: for=1.2.3.4\r\n\r\n").unwrap();let k=t.join().unwrap();let h=String::from_utf8(k.nieuw).unwrap().to_ascii_lowercase();assert!(!h.contains("forwarded"));}
}
