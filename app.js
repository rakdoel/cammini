/* I miei cammini, app offline. Vanilla JS, nessuna dipendenza oltre Leaflet. */
"use strict";
const $=s=>document.querySelector(s);
const pagina=$("#pagina"), titolo=$("#titolo"), indietro=$("#indietro"), nav=$("#schede");
const TILES="https://tile.opentopomap.org/{z}/{x}/{y}.png";
const ATTR='Mappa © <a href="https://opentopomap.org">OpenTopoMap</a> (CC BY-SA), dati © OpenStreetMap';
const LIV={1:"facile",2:"media",3:"impegnativa",4:"alpinistica"};
const GRUPPI={Plantae:"Piante",Aves:"Uccelli",Mammalia:"Mammiferi",Insecta:"Insetti",Fungi:"Funghi",Reptilia:"Rettili",Amphibia:"Anfibi",Arachnida:"Ragni",Mollusca:"Molluschi",Actinopterygii:"Pesci",Animalia:"Altri animali"};
const POI_STILE={rifugio:["#a1341b","R","rifugio"],bivacco:["#fff","B","bivacco, riparo"],campeggio:["#2e7d32","▲","campeggio"],ostello:["#5b4a8b","O","ostello, albergue"],
  stazione:["#1a1a1a","S","stazione"],cima:["#6b4f2a","△","cima"],panorama:["#fff","◎","punto panoramico"],castello:["#b2182b","♜","castello"],cascata:["#1f78b4","↓","cascata"],grotta:["#4d4d4d","∩","grotta"]};
const LUOGO_STILE={acqua:["#0072B2","≈"],cascata:["#1f78b4","↓"],cima:["#8C510A","▲"],grotta:["#4d4d4d","∩"],religioso:["#6a3d9a","✝"],castello:["#b2182b","♜"],archeologia:["#8a6d1d","Π"],costa:["#01665e","⚓"],luogo:["#555","★"]};
let IDX=null, CACHE_C={}, mappa=null, gps=null, gpsMarker=null, seguiGps=false;
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const avviso=(t,ms=2500)=>{const a=$("#avviso");a.textContent=t;a.hidden=false;clearTimeout(a._t);a._t=setTimeout(()=>a.hidden=true,ms);};
const parteDi=sez=>IDX.capitoli.find(c=>c.id===sez).parte;
const infoParte=p=>IDX.parti.find(x=>x.id===p);
// col tema scuro la tinta chiara della parte diventa un fondo scuro appena colorato, così il testo chiaro resta leggibile
const SCURO=window.matchMedia&&matchMedia("(prefers-color-scheme: dark)");
function mescola(a,b,t){const h=x=>[1,3,5].map(i=>parseInt(x.slice(i,i+2),16));const A=h(a),B=h(b);return "#"+A.map((v,i)=>Math.round(v*t+B[i]*(1-t)).toString(16).padStart(2,"0")).join("");}
function lum(x){return [1,3,5].map(i=>parseInt(x.slice(i,i+2),16)/255).map(v=>v<=.03928?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);}
function contrasto(a,b){const A=lum(a),B=lum(b);return (Math.max(A,B)+.05)/(Math.min(A,B)+.05);}
// colore della parte per i testi piccoli (titoli dei riquadri, link): scurito o schiarito finché si legge bene sul fondo
function coloreTesto(c,scuro){const fondo=scuro?"#1f2227":"#ffffff",verso=scuro?"#ffffff":"#000000";for(let t=1;t>=.3;t-=.05){const m=mescola(c,verso,t);if(contrasto(m,fondo)>=4.5)return m;}return verso;}
function ponParte(c,tinta){const st=document.documentElement.style;st.setProperty("--parte",c);st.setProperty("--parte-t",coloreTesto(c,SCURO&&SCURO.matches));if(tinta)st.setProperty("--tinta",SCURO&&SCURO.matches?mescola(c,"#1f2227",.22):tinta);}
function colora(p){const i=infoParte(p)||{colore:"#0072B2",tinta:"#e6f0f7"};if(/^#[0-9a-f]{6}$/i.test(i.colore))document.documentElement.style.setProperty("--parte-t",coloreTesto(i.colore,SCURO&&SCURO.matches));document.documentElement.style.setProperty("--parte",i.colore);document.documentElement.style.setProperty("--tinta",SCURO&&SCURO.matches&&/^#[0-9a-f]{6}$/i.test(i.colore)?mescola(i.colore,"#1f2227",.22):i.tinta);document.querySelector('meta[name=theme-color]').content=i.colore;}

async function carica(url){const r=await fetch(url);if(!r.ok)throw new Error(url);return r.json();}
async function cammino(k){if(!CACHE_C[k])CACHE_C[k]=await carica(`dati/cammini/${k}.json`);return CACHE_C[k];}

/* ---------- navigazione ---------- */
window.addEventListener("hashchange",render);
// barra delle quattro sezioni in basso; dentro un cammino lascia il posto alle schede del cammino
const SEZIONI=[["cammini","#/","▲","Cammini"],["natura","#/natura","❀","Natura"],["riconosci","#/riconosci","◉","Riconosci"],["diario","#/diario","✎","Diario"],["aiuto","#/aiuto","✚","Aiuto"]];
const navS=document.createElement("nav"); navS.id="sezioni"; navS.setAttribute("aria-label","Sezioni");
navS.innerHTML=SEZIONI.map(([id,h,i,n])=>`<a data-s="${id}" href="${h}"><i>${i}</i>${n}</a>`).join("");
document.body.insertBefore(navS,$("#avviso"));
function sezioneDi(p){if(["natura","atlante","impara","calendario","qui","ambienti","tracce"].includes(p[0]))return"natura";if(p[0]==="riconosci")return"riconosci";if(["diario","esperienza","miei","piano"].includes(p[0]))return"diario";if(p[0]==="aiuto")return"aiuto";return"cammini";}
$("#cerca-btn").onclick=()=>{if(sezioneDi((location.hash||"#/").slice(2).split("/"))==="natura"){location.hash="#/atlante";setTimeout(()=>{const q=$("#qa");if(q)q.focus();},400);}else location.hash="#/cerca";};
const RADICI=["#/","#/natura","#/riconosci","#/diario","#/aiuto"];
// dentro un cammino la barra delle sezioni non c'è: l'aiuto resta raggiungibile dalla testata
const aiutoBtn=document.createElement("button"); aiutoBtn.id="aiuto-btn"; aiutoBtn.className="ico"; aiutoBtn.setAttribute("aria-label","Aiuto"); aiutoBtn.textContent="✚"; aiutoBtn.hidden=true;
aiutoBtn.onclick=()=>location.hash="#/aiuto"; $("#testata").insertBefore(aiutoBtn,$("#cerca-btn"));
function genitore(p){
  // dove porta il tasto indietro, con il nome che compare accanto alla freccia
  if(p[0]==="cammino"){const c=IDX.cammini.find(x=>x.chiave===p[1]);const cap=c&&IDX.capitoli.find(x=>x.id===c.sez);return cap?{nome:cap.nome,href:"#/capitolo/"+cap.id}:{nome:"Cammini",href:"#/"};}
  if(p[0]==="dove"&&p[2])return {nome:decodeURIComponent(p[1]),href:"#/dove/"+p[1]};
  if(p[0]==="dove"&&p[1]&&paesiDi().size>1)return {nome:"Dove",href:"#/dove"};
  if(p[0]==="qui"||p[0]==="ambienti")return {nome:"Natura",href:"#/natura"};
  if(p[0]==="aiuto")return {nome:"Aiuto",href:"#/aiuto"};
  if(p[0]==="esperienza")return p[1]?{nome:"La mia esperienza",href:"#/esperienza"}:{nome:"Diario",href:"#/diario"};
  if(p[0]==="miei")return {nome:"Diario",href:"#/diario"};
  if(p[0]==="piano")return {nome:"Il mio storico",href:"#/miei"};
  if(p[0]==="organizza")return p[1]==="risultati"?{nome:"Le domande",href:"#/organizza"}:{nome:"Cammini",href:"#/"};
  if(p[0]==="oggi"){const st=inCammino();const c=st&&IDX.cammini.find(x=>x.chiave===st.k);return c?{nome:c.nome,href:"#/cammino/"+c.chiave}:{nome:"Cammini",href:"#/"};}
  if(p[0]==="specie")return {nome:"Natura",href:`#/cammino/${p[1]}/natura`};
  if(p[0]==="atlante"&&p[1])return {nome:"Atlante",href:"#/atlante"};
  if(p[0]==="tracce"&&p[1])return {nome:"Tracce e segni",href:"#/tracce"};
  if(p[0]==="tracce")return {nome:"Natura",href:"#/natura"};
  if(p[0]==="impara"&&p[1])return {nome:"Impara",href:"#/impara"};
  if(p[0]==="impara"||p[0]==="calendario"||p[0]==="atlante")return {nome:"Natura",href:"#/natura"};
  if(p[0]==="capitolo")return {nome:"Come nel libro",href:"#/libro"};
  return {nome:"Cammini",href:"#/"};
}
// indietro torna alla pagina da cui si è arrivati; le schede di un cammino contano come una pagina sola
const STORIA=[], TITOLI={}; let tornando=false;
const stessaPagina=(a,b)=>!!(a&&b&&((a.startsWith("#/cammino/")&&a.split("/").slice(0,3).join("/")===b.split("/").slice(0,3).join("/"))||(a.startsWith("#/calendario")&&b.startsWith("#/calendario"))));
document.addEventListener("click",e=>{const a=e.target.closest("a[data-sostituisci]");if(!a)return;e.preventDefault();location.replace(a.getAttribute("href"));});
indietro.onclick=()=>{if(STORIA.length>1){tornando=true;history.back();}else location.hash=indietro.dataset.href||"#/";};
nav.querySelectorAll("button").forEach(b=>b.onclick=()=>{const m=location.hash.match(/#\/cammino\/([^/]+)/);if(m)location.replace(`#/cammino/${m[1]}/${b.dataset.tab}`);});
async function avvio(){IDX=await carica("dati/indice.json");render();if("serviceWorker" in navigator)navigator.serviceWorker.register("sw.js");}
// con la foto di copertina in cima il titolo nella testata compare solo dopo averla passata
function segnaCopertina(){const c=pagina.firstElementChild;document.body.classList.toggle("con-cop",!!c&&c.matches(".copertina,.testa-cap"));aggiornaCop();}
function aggiornaCop(){const c=document.body.classList.contains("con-cop")&&pagina.firstElementChild;document.body.classList.toggle("oltre-cop",!!c&&window.scrollY>c.offsetHeight-60);}
window.addEventListener("scroll",aggiornaCop,{passive:true});
async function render(){
  document.body.classList.remove("con-cop","oltre-cop");
  const h=location.hash||"#/"; const p=h.slice(2).split("/"); nav.hidden=true; document.body.classList.remove("con-schede"); indietro.hidden=RADICI.includes(h);
  if(RADICI.includes(h))STORIA.length=0;
  if(tornando){tornando=false;STORIA.pop();if(STORIA[STORIA.length-1]!==h)STORIA.push(h);}
  else if(stessaPagina(STORIA[STORIA.length-1],h))STORIA[STORIA.length-1]=h; else if(STORIA[STORIA.length-1]!==h)STORIA.push(h);
  const vb=$("#vediT"); if(vb)vb.hidden=true;
  navS.hidden=false; document.body.classList.add("con-sezioni"); aiutoBtn.hidden=true; const sz=sezioneDi(p); navS.querySelectorAll("a").forEach(a=>a.classList.toggle("attivo",a.dataset.s===sz));
  if(RIC.ferma){RIC.ferma.abort();RIC.ferma=null;}
  if(!indietro.hidden){const g=genitore(p);indietro.dataset.href=g.href;const prec=STORIA[STORIA.length-2];const nome=prec?(TITOLI[prec]||g.nome):g.nome;indietro.innerHTML=`‹ <span>${esc(nome.length>18?nome.slice(0,17)+"…":nome)}</span>`;}
  if(mappa){mappa.remove();mappa=null;} document.body.classList.remove("mappa-aperta"); if(gps&&p[0]!=="cammino"){navigator.geolocation.clearWatch(gps);gps=null;}
  window.scrollTo(0,0);
  try{
    const r=vista(p); Promise.resolve(r).then(()=>{TITOLI[h]=titolo.textContent;segnaCopertina();}).catch(e=>errore(e)); return r;
  }catch(e){errore(e);}
}
function errore(e){pagina.innerHTML=`<div class="vuoto">Non riesco a caricare questa pagina.<br><small>${esc(e&&e.message)}</small><br><br>Se sei senza rete, scarica prima il cammino quando hai connessione.</div>`;}
function vista(p){
  p=p.map(x=>{try{return decodeURIComponent(x);}catch{return x;}});
  {
    if(p[0]==="dove")return vistaDove(p[1],p[2]);
    if(p[0]==="trova")return vistaTrova();
    if(p[0]==="vicino")return vistaVicino();
    if(p[0]==="oggi")return vistaOggi();
    if(p[0]==="libro")return vistaLibro();
    if(p[0]==="qui")return vistaQui();
    if(p[0]==="ambienti")return vistaAmbienti();
    if(p[0]==="aiuto")return vistaAiuto(p[1],p[2]);
    if(p[0]==="parte")return vistaParte(p[1]);
    if(p[0]==="capitolo")return vistaCapitolo(p[1]);
    if(p[0]==="cammino")return vistaCammino(p[1],p[2]||"scheda");
    if(p[0]==="specie")return vistaSpecie(p[1],p[2]);
    if(p[0]==="cerca")return vistaCerca();
    if(p[0]==="atlante")return p[1]?vistaVoceAtlante(+p[1]):vistaAtlante();
    if(p[0]==="impara")return p[1]?vistaImpara(p[1]):vistaImparaLista();
    if(p[0]==="tracce")return vistaTracce(p[1],p[2]);
    if(p[0]==="calendario")return vistaCalendario(p[1]!==undefined?+p[1]:new Date().getMonth());
    if(p[0]==="filtro")return vistaFiltro(p[1]);
    if(p[0]==="info")return vistaInfo();
    if(p[0]==="natura")return vistaNatura();
    if(p[0]==="riconosci")return vistaRiconosci();
    if(p[0]==="diario")return vistaDiario();
    if(p[0]==="esperienza")return vistaEsperienza(p[1]);
    if(p[0]==="organizza")return vistaOrganizza(p[1]);
    if(p[0]==="piano")return vistaPiano(p[1]);
    if(p[0]==="miei")return vistaMiei();
    return vistaHome();
  }
}
const giorniDi=c=>{const m=String(c.giorni||c.tappe||"").match(/(\d+)/);return m?+m[1]:null;};
const kmDi=c=>{const m=String(c.km||"").match(/(\d+)/);return m?+m[1]:null;};
const FILTRI={brevi:["Fino a 3 giorni",c=>{const g=giorniDi(c);return g&&g<=3;}],settimana:["Da 4 a 7 giorni",c=>{const g=giorniDi(c);return g&&g>=4&&g<=7;}],lunghi:["Più di una settimana",c=>{const g=giorniDi(c);return g&&g>7;}],
  facili:["Facili",c=>c.livello===1],papa:["Per papà",c=>!!c.leggero],scaricati:["Scaricati sul telefono",c=>!!localStorage.getItem("off:"+c.chiave)]};
function miei(){return IDX.cammini.filter(c=>localStorage.getItem("off:"+c.chiave)||localStorage.getItem("diario:"+c.chiave)||localStorage.getItem("rec:"+c.chiave));}
function cardCapitolo(cap){
  const cs=IDX.cammini.filter(c=>c.sez===cap.id); const f=cs.find(c=>c.foto); const gg=cs.map(giorniDi).filter(Boolean);
  const durata=gg.length?(Math.min(...gg)===Math.max(...gg)?`${gg[0]} giorni`:`da ${Math.min(...gg)} a ${Math.max(...gg)} giorni`):"";
  return `<a class="cap-card" href="#/capitolo/${cap.id}" style="${f?`background-image:url(${f.foto})`:`background-color:${infoParte(cap.parte).colore}`}"><span class="n">${cs.length} cammini</span><h3>${esc(cap.nome)}</h3>${durata?`<p>${durata}</p>`:""}</a>`;
}
document.addEventListener("click",e=>{const a=e.target.closest("a[data-f]");if(!a)return;try{sessionStorage.setItem("filtri",JSON.stringify(Object.assign({q:"",durata:[],livello:[],zona:[],mese:null,papa:false,anello:false,scaricati:false,tenda:false,econ:false},JSON.parse(a.dataset.f))));}catch{}});
function vistaFiltro(k){
  const f=FILTRI[k]; if(!f){location.hash="#/";return;} colora(null); titolo.textContent=f[0];
  const cs=IDX.cammini.filter(f[1]).sort((a,b)=>(giorniDi(a)||99)-(giorniDi(b)||99)||(kmDi(a)||0)-(kmDi(b)||0));
  pagina.innerHTML=`<p class="intro-lista">${cs.length} cammini, dal più corto al più lungo. In ogni zona i cammini sono divisi in cartelle per durata.</p><ul class="lista con-foto">${cs.map(c=>rigaCammino(c,true)).join("")}</ul>`;
}
function vistaParte(id){
  const p=infoParte(id); colora(id); titolo.textContent=p.nome;
  const caps=IDX.capitoli.filter(c=>c.parte===id);
  pagina.innerHTML=`<p class="intro-lista">${esc(p.intro)}</p><div class="griglia-cap">${caps.map(cardCapitolo).join("")}</div>`;
}
function rigaCammino(c,conCapitolo){
  const g=giorniDi(c); const km=kmDi(c); const cap=IDX.capitoli.find(x=>x.id===c.sez);
  const dove=c.anello?`${esc(c.partenza)}, anello`:`${esc(c.partenza)} → ${esc(c.arrivo)}`;
  const dati=[km?`${km} km`:"",g?`${g} ${g===1?"giorno":"giorni"}`:"",`<span class="dot l${c.livello}">${c.livello}</span> ${LIV[c.livello]}`,c.leggero?`<span class="cuore">${c.leggero==="piano"?"♥":"♡"}</span> per papà`:""].filter(Boolean).join(" · ");
  return `<li><a href="#/cammino/${c.chiave}"><span class="foto" style="${(c.mini||c.foto)?`background-image:url(${c.mini||c.foto})`:""}"><span class="num">${c.n}</span></span><span class="t"><b>${esc(c.nome)}</b><small>${dove}${conCapitolo&&cap?` · ${esc(cap.nome)}`:""}</small><small class="dati">${dati}</small></span>`+
    `${localStorage.getItem("off:"+c.chiave)?`<span class="off" title="disponibile offline">⬇</span>`:""}<span class="freccia">›</span></a></li>`;
}
const CARTELLE=[["Fino a 3 giorni",g=>g&&g<=3],["Da 4 a 7 giorni",g=>g&&g>=4&&g<=7],["Da 8 a 15 giorni",g=>g&&g>=8&&g<=15],["Più di due settimane",g=>g&&g>15],["Durata da verificare",g=>!g]];
function vistaCapitolo(id){
  const cap=IDX.capitoli.find(c=>c.id===id); colora(cap.parte); titolo.textContent=cap.nome;
  const cs=IDX.cammini.filter(c=>c.sez===id).sort((a,b)=>(giorniDi(a)||999)-(giorniDi(b)||999)||a.nome.localeCompare(b.nome,"it")); const f=cs.find(c=>c.foto);
  const gruppi=CARTELLE.map(([n,t])=>[n,cs.filter(c=>t(giorniDi(c)))]).filter(g=>g[1].length);
  const K="cart:"+id; const chiuse=new Set(JSON.parse(sessionStorage.getItem(K)||"[]"));
  const corpo=gruppi.length>1?gruppi.map(([n,L_])=>`<details class="cartella" ${chiuse.has(n)?"":"open"} data-n="${esc(n)}"><summary><span class="ic">▸</span><b>${n}</b><small>${L_.length} ${L_.length===1?"cammino":"cammini"}</small></summary><ul class="lista con-foto">${L_.map(c=>rigaCammino(c)).join("")}</ul></details>`).join(""):`<ul class="lista con-foto">${cs.map(c=>rigaCammino(c)).join("")}</ul>`;
  pagina.innerHTML=`<div class="testa-cap" style="${f?`background-image:url(${f.foto})`:""}"><div class="dentro"><h2>${esc(cap.nome)}</h2><p>${cs.length} cammini. ${esc(cap.intro)}</p></div></div>${corpo}`;
  pagina.querySelectorAll("details.cartella").forEach(d=>d.ontoggle=()=>{d.open?chiuse.delete(d.dataset.n):chiuse.add(d.dataset.n);sessionStorage.setItem(K,JSON.stringify([...chiuse]));});
}
// Cerca e filtra: testo libero più filtri combinabili (durata, difficoltà, zona, mese, per papà, anello, scaricati)
const F_DURATA=[["1-3","fino a 3 giorni",g=>g&&g<=3],["4-7","4-7 giorni",g=>g&&g>=4&&g<=7],["8-15","8-15 giorni",g=>g&&g>=8&&g<=15],["16+","più di 15",g=>g&&g>15]];
const F_MESI=["gen","feb","mar","apr","mag","giu","lug","ago","set","ott","nov","dic"];
const FILTRI_VUOTI={q:"",durata:[],livello:[],zona:[],mese:null,papa:false,anello:false,scaricati:false,tenda:false,econ:false,esposti:false,mio:false};
function passaFiltri(c,f){
  f=Object.assign({},FILTRI_VUOTI,f); const t=(f.q||"").trim().toLowerCase();
  if(t.length>=2&&![c.nome,c.paese,c.partenza,c.arrivo,(IDX.capitoli.find(x=>x.id===c.sez)||{}).nome].join(" ").toLowerCase().includes(t))return false;
  const g=giorniDi(c);
  if(f.durata.length&&!f.durata.some(v=>F_DURATA.find(d=>d[0]===v)[2](g)))return false;
  if(f.livello.length&&!f.livello.includes(c.livello))return false;
  if(f.zona.length&&!f.zona.includes(c.sez))return false;
  if(f.mese!==null&&!["ottimo","possibile"].includes((c.mesi||[])[f.mese]))return false;
  if(f.tenda&&!(c.dorm&&c.dorm.n&&c.dorm.t===c.dorm.n&&(f.mese===null||c.dorm.m[f.mese]!=="n")))return false;
  if(f.econ&&!(c.dorm&&c.dorm.n&&c.dorm.n-c.dorm.e<=1))return false;
  if(f.papa&&!c.leggero)return false;
  if(f.anello&&!c.anello)return false;
  if(f.esposti&&!(c.esp!==2&&(c.lv||0)<5))return false;
  if(f.mio&&!((c.lv||9)<=mioLivello()))return false;
  if(f.scaricati&&!localStorage.getItem("off:"+c.chiave))return false;
  return true;
}
function leggiFiltri(){try{return JSON.parse(sessionStorage.getItem("filtri")||"{}");}catch{return {};}}
/* ---------- cammino ---------- */
async function vistaCammino(k,tab){
  const c=await cammino(k); const parte=parteDi(c.sez); colora(parte); titolo.textContent=c.nome;
  nav.hidden=false; document.body.classList.add("con-schede"); navS.hidden=true; document.body.classList.remove("con-sezioni"); aiutoBtn.hidden=false; nav.querySelectorAll("button").forEach(b=>b.classList.toggle("attivo",b.dataset.tab===tab));
  if(tab==="mappa")return tabMappa(c);
  if(tab==="natura")return tabNatura(c);
  if(tab==="storia")return tabStoria(c);
  if(tab==="diario")return tabDiario(c);
  await sicurezza(); if(location.hash.split("/")[2]!==k)return;
  return tabScheda(c);
}
function fonti(...L){const d=[...new Set(L.flat().filter(Boolean).map(u=>(u.match(/https?:\/\/(?:www\.)?([^/]+)/)||[,u])[1]))];return d.length?`<p class="fonti">Fonti: ${esc(d.join(", "))}</p>`:"";}
// testo breve con il pulsante per leggere quello completo (i testi brevi vengono da quelli completi, senza fatti nuovi)
function breveLungo(breve,lungo){
  if(!breve)return `<p>${esc(lungo||"")}</p>`;
  if(!lungo||lungo.length<=breve.length*1.15)return `<p>${esc(breve)}</p>`;
  return `<p class="bl" data-b="${esc(breve)}" data-l="${esc(lungo)}">${esc(breve)}</p><button class="leggi" type="button">Leggi tutto</button>`;
}
document.addEventListener("click",e=>{const b=e.target.closest("button.leggi");if(!b)return;const p=b.previousElementSibling;if(!p||!p.classList.contains("bl"))return;
  const lungo=b.dataset.aperto!=="1"; p.textContent=lungo?p.dataset.l:p.dataset.b; b.dataset.aperto=lungo?"1":""; b.textContent=lungo?"Versione breve":"Leggi tutto";});
function tabScheda(c){
  const f=c.paesaggi[0]; const km=c.km||""; const scaricato=localStorage.getItem("off:"+c.chiave);
  const g=giorniDi(c), kmN=kmDi(c);
  const fatti=[["Lunghezza",typeof c.km==="number"?`${c.km.toLocaleString("it-IT",{maximumFractionDigits:1})}<small> km</small>`:kmN?`${kmN}<small> km</small>`:"?",typeof c.km==="number"||String(km).trim()===String(kmN)?"":esc(km)],["Durata",g?`${g}<small> ${g===1?"giorno":"giorni"}</small>`:"?",esc(String(c.tappe||c.giorni||"").replace(/^\d+\s*giorni?,?\s*/,""))],
    ["Difficoltà",`<span class="dot l${c.livello}">${c.livello}</span>`,LIV[c.livello]],["Quota massima",/\d/.test(c.quota||"")?`${esc(String(c.quota).match(/\d[\d.]*/)[0].replace(/\./g,"").replace(/\B(?=(\d{3})+(?!\d))/g,"\u202f"))}<small> m</small>`:"?",/\d/.test(c.quota||"")?"":esc(c.quota||"non trovata")]];
  const righe=[c.leggero?["Per papà",`<span class="cuore">${c.leggero==="piano"?"♥":"♡"}</span> ${c.leggero==="piano"?"in piano":"colline dolci"}`]:null,
    c.anello?["Partenza e arrivo",esc(c.partenza)]:["Partenza",esc(c.partenza)],!c.anello?["Arrivo",esc(c.arrivo)]:null,["Tappe",esc(c.tappe)],c.dislivello?["Salita totale",`${esc(c.dislivello)} m`]:null,
    c.bagagli?["Trasporto zaino",esc(c.bagagli)]:null,c.sito?["Sito",`<a href="https://${esc(c.sito.replace(/^https?:\/\//,""))}" target="_blank" rel="noopener">${esc(c.sito)}</a>`]:null,["La mappa",esc(c.traccia||"")]].filter(r=>r&&r[1]);
  const mesi=c.mesi.map((s,i)=>`<span class="${s||""}">${IDX.mesi[i]}</span>`).join("");
  const L=c.tappe_lista||[]; const haKm=L.some(t=>t.km), haSal=L.some(t=>t.salita), haNota=L.some(t=>t.nota);
  const paceT=haKm&&passoPersonale();
  const tappe=L.length?`<table class="tappe"><tr><th>N.</th><th>Da</th><th>A</th>${haKm?"<th>km</th>":""}${haSal?"<th>Salita</th>":""}${paceT?"<th>Ore</th>":""}</tr>`+
    L.map(t=>`<tr><td>${esc(t.n)}${segniTappa(c,t.n).chip}</td><td>${esc(t.da)}</td><td>${esc(t.a)}</td>${haKm?`<td>${esc(t.km)}</td>`:""}${haSal?`<td>${esc(t.salita)}</td>`:""}${paceT?`<td>${oreTappa(numV(t.km),salitaNum(t.salita),paceT)}</td>`:""}</tr>${haNota&&t.nota?`<tr><td></td><td colspan="4" class="nota">${esc(t.nota)}</td></tr>`:""}`).join("")+"</table>"+(c.tappe_nota?`<p class="fonti">${esc(c.tappe_nota)}</p>`:""):`<p>${esc(c.tappe_nota||"Tappe non trovate nelle fonti.")}</p>`;
  const TD=c.tappe_descritte||[]; const pace=passoPersonale();
  const tappeDescr=TD.length?`<div class="tappe-descr">${TD.map(t=>`<details><summary><b>${esc(t.n)}.</b> ${esc(t.da)} <span class="fr">›</span> ${esc(t.a)}${t.km?` <small>${esc(String(t.km).replace(".",","))} km</small>`:""}${t.salita&&!/non trovato/.test(t.salita)?` <small>↑ ${esc(String(t.salita).replace(/\s*m$/,""))} m</small>`:""}${t.discesa&&!/non trovato/.test(t.discesa)?` <small>↓ ${esc(String(t.discesa).replace(/\s*m$/,""))} m</small>`:""}${t.proposta?` <span class="chip">tappa proposta</span>`:""}${/^EE/.test(t.difficolta||"")?` <span class="chip ee">${esc(t.difficolta)}</span>`:""}${segniTappa(c,t.n).chip}${pace&&t.km?` <small class="ore-t">≈ ${oreTappa(numV(t.km),salitaNum(/non trovato/.test(t.salita||"")?0:t.salita),pace)}</small>`:""}</summary>${segniTappa(c,t.n).nota}${breveLungo(((c.breve||{}).tappe||[]).find(x=>String(x.n)===String(t.n))?.testo,t.descrizione)}${t.esposizione&&!/^le fonti non ne parlano/i.test(t.esposizione)?`<p class="espo">${esc(t.esposizione)}</p>`:""}${t.fonte?`<p class="fonti">Fonte: ${esc((t.fonte.match(/https?:\/\/(?:www\.)?([^/]+)/)||[,t.fonte])[1])}</p>`:""}</details>`).join("")}</div>`:"";
  const prof=c.profilo&&c.profilo.q?profiloSvg(c.profilo,infoParte(parteDi(c.sez)).colore):"";
  const B=c.breve;
  pagina.innerHTML=`<div class="copertina" style="${f?`background-image:url(${f.file})`:`background:var(--parte)`}"><div class="dentro"><h2>${esc(c.nome)}</h2><p>${esc(c.paese||"")}${c.paese?". ":""}${c.anello?"Anello da "+esc(c.partenza):esc(c.partenza)+" - "+esc(c.arrivo)}</p></div></div>
  <div class="fatti su">${fatti.map(f=>`<div><small>${f[0]}</small><b>${f[1]}</b>${f[2]?`<span>${f[2]}</span>`:""}</div>`).join("")}</div>
  <div class="bottoni" style="margin-top:12px"><button class="btn largo" id="incam">▶ Sono in cammino${(inCammino()||{}).k===c.chiave?`, tappa ${esc(inCammino().tappa??"")}`:""}</button></div>
  <div class="azioni"><button class="btn secondario" id="scarica">${scaricato?"✓ Salvato offline":"⬇ Salva offline"}</button><a class="btn secondario" href="#/cammino/${c.chiave}/mappa">◎ Mappa</a><button class="btn secondario" id="gpx">⇩ GPX</button></div>
  <div class="barra" id="barra" hidden><i></i></div>
  ${B&&B.punti_chiave?`<section class="blocco in-breve-b"><h3>In breve</h3><ul class="punti-k">${B.punti_chiave.map(x=>`<li>${esc(x)}</li>`).join("")}</ul></section>`:""}
  <section class="blocco"><h3>Il percorso</h3>${breveLungo(B&&B.percorso,c.percorso)}</section>
  ${B&&B.arrivare?`<section class="blocco"><h3>Come arrivare e tornare</h3><p>${esc(B.arrivare)}</p></section>`:""}
  ${B&&(B.attenzione||[]).length?`<section class="blocco attenzione"><h3>Attenzione</h3><ul class="punti-k">${B.attenzione.map(x=>`<li>${esc(x)}</li>`).join("")}</ul></section>`:""}
  ${sezioneDaSoli(c)}
  ${c.leggero&&c.papa?`<div class="papa"><b>Per papà.</b> ${esc(c.papa)}</div>`:""}
  ${dormireHtml(c)}
  <section class="blocco"><h3>${B?"I dati del cammino":"In breve"}</h3><table class="breve">${righe.map(r=>`<tr><th>${r[0].toUpperCase()}</th><td>${r[1]}</td></tr>`).join("")}</table><h4 class="sotto">Quando andare</h4><div class="mesi">${mesi}</div><p class="fonti" style="margin-top:4px">Blu pieno i mesi migliori, azzurro quelli possibili, barrati quelli da evitare.</p></section>
  <section class="blocco"><h3>Le tappe</h3>${prof}${tappeDescr||tappe}${tappeDescr&&c.tappe_nota?`<p class="fonti">${esc(c.tappe_nota)}</p>`:""}</section>
  ${B&&(B.da_non_perdere||[]).length?`<section class="blocco"><h3>Da non perdere lungo la strada</h3><ol class="dnp">${B.da_non_perdere.map(x=>`<li><b>${esc(x.nome)}.</b> ${esc(x.testo)}</li>`).join("")}</ol></section>`:""}
  ${B?`<details class="blocco altre"><summary><h3>Altre informazioni pratiche</h3><span class="ic">›</span></summary><p>${esc(c.note)}</p><h4 class="sotto">Traccia GPX</h4><p>${esc((c.traccia_testo||c.traccia||"").replace(/<[^>]+>/g,""))}</p><p>Il GPX si apre con Komoot, OsmAnd, Organic Maps, Strava o l'app dell'orologio, che registrano il percorso in sottofondo e danno le indicazioni vocali.</p>${fonti(c.fonti,c.tappe_fonti)}</details>`
     :`<section class="blocco"><h3>Da sapere</h3><p>${esc(c.note)}</p><h3 style="margin-top:12px">Traccia GPX</h3><p>${esc((c.traccia_testo||c.traccia||"").replace(/<[^>]+>/g,""))}</p><p>Il GPX si apre con Komoot, OsmAnd, Organic Maps, Strava o l'app dell'orologio, che registrano il percorso in sottofondo e danno le indicazioni vocali.</p>${fonti(c.fonti,c.tappe_fonti)}</section>`}`;
  $("#scarica").onclick=()=>scaricaOffline(c);
  $("#incam").onclick=()=>{const st=inCammino();if(!st||st.k!==c.chiave)salvaInCammino({k:c.chiave,tappa:null,passo:(st&&st.passo)||4,nome:c.nome,dal:oggiISO()});location.hash="#/oggi";};
  $("#gpx").onclick=()=>esportaGpx(c.nome,c.linee,c.chiave+".gpx");
}
const TIPO_D={"campeggio":"campeggio","tenda ammessa":"tenda ammessa","rifugio gestito":"rifugio","rifugio non gestito":"rifugio libero","ostello":"ostello","accoglienza a offerta":"a offerta","casa per ferie":"casa per ferie"};
const opDormire=o=>`<li><span class="tipo-d t-${(o.tipo||"").replace(/\W+/g,"-")}">${esc(TIPO_D[o.tipo]||o.tipo)}</span> ${esc(o.nome||"")}${o.mesi?` <small>${esc(o.mesi)}</small>`:""}${o.prezzo?` <small>· ${esc(o.prezzo)}</small>`:""}${o.note?`<br><small class="nota-d">${esc(o.note)}</small>`:""}</li>`;
function dormireHtml(c){
  const d=c.dormire; if(!d)return "";
  const op=opDormire;
  return `<section class="blocco dormire"><h3>Dormire spendendo poco</h3><ul class="punti">${d.punti.map(p=>`<li>${esc(p)}</li>`).join("")}</ul>
  <p class="conti-d"><b>${d.tenda}</b> ${d.tenda===1?"notte":"notti"} su ${d.notti} con la tenda · <b>${d.econ}</b> su ${d.notti} senza pagare una stanza</p>
  <details><summary>Tappa per tappa</summary>${d.tappe.map(t=>`<div class="tappa-d"><b>${esc(t.n)}. ${esc(t.a)}</b>${t.opzioni.length?`<ul>${t.opzioni.map(op).join("")}</ul>`:`<p class="nota-d">Solo B&B, hotel o agriturismi.</p>`}</div>`).join("")}
  ${d.inverno?`<p><b>D'inverno.</b> ${esc(d.inverno)}</p>`:""}${d.regole?`<p><b>Tenda fuori dai campeggi.</b> ${esc(d.regole)}</p>`:""}
  <p class="fonti">Mesi e prezzi cambiano, prima di partire conviene chiamare. ${fonti(d.fonti).replace(/<\/?p[^>]*>/g,"")}</p></details></section>`;
}
function esportaGpx(nome,linee,file){
  const x=`<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="I miei cammini" xmlns="http://www.topografix.com/GPX/1/1"><metadata><name>${esc(nome)}</name></metadata><trk><name>${esc(nome)}</name>`+
    linee.map(L_=>`<trkseg>${L_.map(p=>`<trkpt lat="${p[1]}" lon="${p[0]}"${p[2]!=null?`><time>${new Date(p[2]).toISOString()}</time></trkpt>`:"/>"}`).join("")}</trkseg>`).join("")+`</trk></gpx>`;
  const blob=new Blob([x],{type:"application/gpx+xml"}); const f=new File([blob],file,{type:"application/gpx+xml"});
  if(navigator.canShare&&navigator.canShare({files:[f]})){navigator.share({files:[f],title:nome}).catch(()=>{});return;}
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=file;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},2000);
}
function profiloSvg(p,col){
  const W=600,H=150,ml=34,mr=8,mt=10,mb=22; const D=p.d,Q=p.q; const dmax=D[D.length-1]||1; const qmin=Math.floor(p.qmin/100)*100, qmax=Math.ceil((p.qmax+1)/100)*100;
  const x=d=>ml+(W-ml-mr)*d/dmax, y=q=>mt+(H-mt-mb)*(1-(q-qmin)/((qmax-qmin)||1));
  let path=`M${x(D[0])},${y(Q[0])}`; for(let i=1;i<D.length;i++)path+=`L${x(D[i]).toFixed(1)},${y(Q[i]).toFixed(1)}`;
  const area=path+`L${x(dmax)},${y(qmin)}L${x(D[0])},${y(qmin)}Z`;
  const passo=(qmax-qmin)>1500?500:(qmax-qmin)>600?200:100; let griglia="";
  for(let q=qmin;q<=qmax;q+=passo)griglia+=`<line x1="${ml}" x2="${W-mr}" y1="${y(q)}" y2="${y(q)}" stroke="#ddd" stroke-width="0.6"/><text x="${ml-4}" y="${y(q)+3}" font-size="9" text-anchor="end" fill="#777">${q}</text>`;
  const kmp=dmax>300?100:dmax>120?50:dmax>40?20:dmax>15?5:2; let assi="";
  for(let d=0;d<=dmax;d+=kmp)assi+=`<text x="${x(d)}" y="${H-6}" font-size="9" text-anchor="middle" fill="#777">${d}</text>`;
  let loc="";(p.localita||[]).forEach(([n,i])=>{if(i==null||!n)return;loc+=`<line x1="${x(D[i])}" x2="${x(D[i])}" y1="${y(Q[i])}" y2="${mt}" stroke="#999" stroke-width="0.6" stroke-dasharray="2 2"/><text x="${x(D[i])}" y="${mt+8}" font-size="8" text-anchor="middle" fill="#555">${esc(String(n).slice(0,14))}</text>`;});
  return `<svg class="profilo" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="profilo altimetrico">${griglia}<path d="${area}" fill="${col}" fill-opacity=".18"/><path d="${path}" fill="none" stroke="${col}" stroke-width="1.6"/>${loc}${assi}</svg><p class="fonti">Profilo stimato dal modello del terreno lungo la traccia, salita circa ${p.salita} m e discesa ${p.discesa} m, da ${p.qmin} a ${p.qmax} m. Km lungo la traccia in basso.</p>`;
}
function tabStoria(c){
  pagina.innerHTML=(c.paesaggi[1]?`<div class="foto-grande"><img src="${c.paesaggi[1].file}" alt=""><small>${esc(c.paesaggi[1].titolo)}. ${esc(c.paesaggi[1].autore)}, ${esc(c.paesaggi[1].licenza)}</small></div>`:"")+
    (c.paesaggio?`<section class="blocco"><h3>Come è nato questo paesaggio</h3>${breveLungo((c.breve||{}).paesaggio,c.paesaggio)}${fonti(c.paesaggio_fonti)}</section>`:"")+
    (c.storia?`<section class="blocco"><h3>La storia del cammino</h3>${breveLungo((c.breve||{}).storia,c.storia)}${fonti(c.storia_fonti)}</section>`:"")+
    `<section class="blocco"><h3>Cosa si incontra</h3><p>${esc(c.natura)}</p></section>`+
    ((c.curiosita||[]).length?`<section class="blocco"><h3>Curiosità</h3>${c.curiosita.map(x=>`<p class="curio">${esc(x.testo||x)}</p>`).join("")}</section>`:"")+
    ((c.prodotti||[]).length?`<section class="blocco"><h3>Prodotti e mestieri del posto</h3>${c.prodotti.map(x=>`<p><b>${esc(x.nome)}.</b> ${esc(x.testo)}</p>`).join("")}</section>`:"")+
    c.paesaggi.slice(2).map(p=>`<div class="foto-grande"><img src="${p.file}" alt="" loading="lazy"><small>${esc(p.titolo)}. ${esc(p.autore)}, ${esc(p.licenza)}</small></div>`).join("");
}
function tabNatura(c){
  const REGNI=["alberi e arbusti","fiori ed erbe","uccelli","mammiferi","insetti e invertebrati","rettili e anfibi","funghi","altro"];
  const ric=(c.specie_ricerca||[]);
  const tutte=ric.length?ric:[...c.specie_libro.map(s=>({...s,libro:true,id:"l"+s.sci.replace(/\W+/g,"_"),gruppo:gruppoLibro(s.tipo)})),...c.specie];
  const gruppi=[...new Set(tutte.map(s=>s.gruppo).filter(Boolean))].sort((a,b)=>(ric.length?REGNI:Object.keys(GRUPPI)).indexOf(a)-(ric.length?REGNI:Object.keys(GRUPPI)).indexOf(b));
  let att=sessionStorage.getItem("gr:"+c.chiave)||"tutti";
  const disegna=()=>{const L=tutte.filter(s=>att==="tutti"||s.gruppo===att);
    $("#griglia").innerHTML=L.length?L.map(s=>`<a href="#/specie/${c.chiave}/${s.id}" class="${s.illustrazione?"illu":""}"><div class="img" style="${s.foto?`background-image:url(${s.foto})`:""}">${s.foto?"":"❀"}</div><div class="nomi"><b>${esc(s.it||s.sci)}</b><i>${esc(s.sci)}</i>${s.tipica?"<small>simbolo del luogo</small>":s.libro?"<small>nel libro</small>":s.stato?`<small>${esc(s.stato)}</small>`:""}</div></a>`).join(""):`<div class="vuoto">Nessuna specie in questo gruppo</div>`;
    document.querySelectorAll(".gruppi button").forEach(b=>b.classList.toggle("attivo",b.dataset.g===att));};
  pagina.innerHTML=`<p style="margin:12px 14px 0;font-size:13.5px;color:var(--grigio)">${tutte.length} specie${ric.length?" tipiche di questo territorio, con la fotografia e, dove esiste, la tavola d'epoca dei naturalisti":""}. Tocca una specie per la scheda.</p>
  <div class="gruppi"><button data-g="tutti">Tutte</button>${gruppi.map(g=>`<button data-g="${g}">${GRUPPI[g]||g}</button>`).join("")}</div><div class="specie" id="griglia"></div>`;
  document.querySelectorAll(".gruppi button").forEach(b=>b.onclick=()=>{att=b.dataset.g;sessionStorage.setItem("gr:"+c.chiave,att);disegna();}); disegna();
}
function gruppoLibro(t){t=(t||"").toLowerCase();if(/uccell/.test(t))return"Aves";if(/mammif|fauna/.test(t))return"Mammalia";if(/insett|farfall/.test(t))return"Insecta";if(/fung/.test(t))return"Fungi";if(/rettil/.test(t))return"Reptilia";if(/anfib/.test(t))return"Amphibia";if(/flora|piant|alber|fior/.test(t))return"Plantae";return"Animalia";}
async function vistaSpecie(k,id){
  const c=await cammino(k); colora(parteDi(c.sez)); nav.hidden=true;
  const s=(c.specie_ricerca||[]).find(x=>x.id===id)||c.specie.find(x=>x.id===id)||c.specie_libro.map(x=>({...x,id:"l"+x.sci.replace(/\W+/g,"_"),libro:true})).find(x=>x.id===id);
  if(!s){pagina.innerHTML=`<div class="vuoto">Specie non trovata</div>`;return;}
  titolo.textContent=s.it||s.sci;
  pagina.innerHTML=`<section class="blocco scheda-specie">${s.foto?`<img src="${s.foto}" alt="${esc(s.it||s.sci)}">`:""}<h2>${esc(s.it||s.sci)}</h2><div class="sci">${esc(s.sci)}${s.gruppo?` · ${GRUPPI[s.gruppo]||s.gruppo}`:""}${s.stato?` · stato ${esc(s.stato)}`:""}</div>
  ${s.dove?`<p class="dove"><b>Su questo cammino.</b> ${esc(s.dove)}.</p>`:""}${s.n?`<p><a class="btn secondario" href="#/atlante/${s.n}">Scheda nell'atlante, n. ${s.n}</a></p>`:""}
  ${s.testo?`<p>${esc(s.testo)}</p>`:`<p style="color:var(--grigio)">Specie fotografata per il libro. Descrizione non disponibile offline.</p>`}
  ${s.scheda?[["Come riconoscerla","riconoscere"],["Dove e quando","dove_quando"],["Da dove viene","origine"],["Con le persone","uomo"],["Curiosità","curiosita"]].filter(([,k])=>s.scheda[k]).map(([t,k])=>`<h4 class="sotto">${t}</h4><p>${esc(s.scheda[k])}</p>`).join("")+(s.scheda.stato?`<p class="fonti">Stato di conservazione ${esc(s.scheda.stato)}.</p>`:"")+(s.scheda.fonti?`<p class="fonti">Fonti della scheda: ${esc(s.scheda.fonti.map(u=>(u.match(/https?:\/\/(?:www\.)?([^/]+)/)||[,u])[1]).filter((v,i,a)=>a.indexOf(v)===i).join(", "))}</p>`:""):""}
  ${s.wiki?`<p class="fonti">Testo da Wikipedia (${s.lingua==="en"?"inglese":"italiano"}), CC BY-SA. <a href="${esc(s.wiki)}" target="_blank" rel="noopener">Apri la voce</a></p>`:""}
  ${s.foto?`<p class="fonti">${s.illustrazione?"Tavola":"Foto"}: ${esc(s.autore||"autore su Commons")}, ${esc(s.licenza||"")}. ${esc(s.commons||"")}</p>`:""}
  ${s.tavola?`<div class="tavola"><img src="${s.tavola.file}" alt="Tavola d'epoca, ${esc(s.sci)}"><p class="fonti">Tavola d'epoca: ${esc(s.tavola.autore||"opera indicata su Commons")}, ${esc(s.tavola.licenza||"")}. ${esc(s.tavola.commons||"")}</p></div>`:""}
  ${s.fonte&&!s.wiki?`<p class="fonti">Fonte del testo: ${esc(String(s.fonte).replace(/^https?:\/\/(www\.)?/,"").slice(0,60))}</p>`:""}
  ${s.libro?`<p class="fonti">Specie citata nel libro per questo cammino.</p>`:s.regno?"":`<p class="fonti">Segnalata lungo il percorso su iNaturalist (osservazioni di qualità "research").</p>`}</section>`;
}

/* ---------- atlante della natura ---------- */
let ATLANTE=null;
async function atlante(){if(!ATLANTE)ATLANTE=await carica("dati/atlante.json");return ATLANTE;}
const REGNI_A=["alberi e arbusti","fiori ed erbe","uccelli","mammiferi","insetti e invertebrati","rettili e anfibi","funghi","altro"];
const NOME_REGNO_A={"altro":"pesci e molluschi"};
const cap1=t=>t?t[0].toUpperCase()+t.slice(1):"";
function leggiFA(){try{return Object.assign({q:"",amb:"",regno:"",mese:false},JSON.parse(sessionStorage.getItem("fatl")||"{}"));}catch{return {q:"",amb:"",regno:"",mese:false};}}
async function vistaAtlante(){
  colora(null); ponParte("#2E6B4F"); titolo.textContent="Atlante della natura";
  const A=await atlante(); const f=leggiFA(); const meseOra=new Date().getMonth()+1;
  pagina.innerHTML=`<div class="ingressi-atl"><a href="#/impara">Impara a riconoscere<small>querce, orchidee, funghi, vipere, rapaci…</small></a><a href="#/calendario">Il calendario<small>cosa vedere questo mese</small></a></div><p class="intro-atl">${A.specie.length} specie dei cammini italiani, ognuna una volta sola. Scegli l'ambiente in cui ti trovi o cerca per nome. Il numero è lo stesso del libro.</p>
  <div class="filtri-atl"><input id="qa" type="search" placeholder="Cerca un nome" value="${esc(f.q)}">
  <div class="fr"><span class="fl">Ambiente</span><div class="fc">${A.ambienti.map(a=>`<button class="fchip${f.amb===a?" attivo":""}" data-amb="${esc(a)}">${esc(a)}</button>`).join("")}</div></div>
  <div class="fr"><span class="fl">Gruppo</span><div class="fc">${REGNI_A.filter(r=>A.specie.some(s=>s.regno===r)).map(r=>`<button class="fchip${f.regno===r?" attivo":""}" data-regno="${r}">${esc(NOME_REGNO_A[r]||r)}</button>`).join("")}</div></div>
  <div class="fr"><div class="fc"><button class="fchip${f.mese?" attivo":""}" id="fmese">Si vede questo mese</button></div></div></div>
  <div class="conta" id="contaA"></div><div class="specie" id="grigliaA"></div>
  <p style="margin:14px"><button class="btn secondario" id="scaricaA">${localStorage.getItem("off:atlante")?"✓ Atlante disponibile offline":"⬇ Scarica l'atlante per l'uso offline"}</button></p><div class="barra" id="barraA" hidden><i></i></div>`;
  const salva=()=>sessionStorage.setItem("fatl",JSON.stringify(f));
  const disegna=()=>{const q=f.q.trim().toLowerCase();
    const L=A.specie.filter(s=>(!q||(s.it+" "+s.sci).toLowerCase().includes(q))&&(!f.amb||s.ambienti.includes(f.amb))&&(!f.regno||s.regno===f.regno)&&(!f.mese||(s.mesi||[]).includes(meseOra)));
    $("#contaA").textContent=`${L.length} specie`;
    $("#grigliaA").innerHTML=L.length?L.map(s=>`<a href="#/atlante/${s.n}" class="${s.illustrazione?"illu":""}"><div class="img" style="${s.foto?`background-image:url(${s.foto})`:""}">${s.foto?"":"❀"}</div><div class="nomi"><b><span class="na">${s.n}</span> ${esc(cap1(s.it))}</b><i>${esc(s.sci)}</i>${s.segno?`<small>${esc(s.segno)}</small>`:""}</div></a>`).join(""):`<div class="vuoto">Nessuna specie con questi filtri</div>`;};
  $("#qa").oninput=e=>{f.q=e.target.value;salva();disegna();};
  pagina.querySelectorAll("[data-amb]").forEach(b=>b.onclick=()=>{f.amb=f.amb===b.dataset.amb?"":b.dataset.amb;salva();vistaAtlante();});
  pagina.querySelectorAll("[data-regno]").forEach(b=>b.onclick=()=>{f.regno=f.regno===b.dataset.regno?"":b.dataset.regno;salva();vistaAtlante();});
  $("#fmese").onclick=()=>{f.mese=!f.mese;salva();vistaAtlante();};
  $("#scaricaA").onclick=()=>scaricaAtlante(A);
  disegna();
}
async function vistaVoceAtlante(n){
  colora(null); ponParte("#2E6B4F"); const A=await atlante(); const s=A.specie.find(x=>x.n===n);
  if(!s){pagina.innerHTML=`<div class="vuoto">Specie non trovata</div>`;return;}
  titolo.textContent=cap1(s.it);
  const info=[s.misura,s.periodo].filter(Boolean).join(" · ");
  const sc=s.scheda||{};
  pagina.innerHTML=`<section class="blocco scheda-specie">${s.foto?`<img src="${s.foto}" alt="${esc(s.it)}">`:""}<h2><span class="na">${s.n}</span> ${esc(cap1(s.it))}</h2><div class="sci">${esc(s.sci)} · ${esc(NOME_REGNO_A[s.regno]||s.regno)}</div>
  <p class="amb-atl">${esc(cap1(s.ambienti.join(", ")))}${info?`<br>${esc(info)}`:""}</p>
  ${s.segno?`<p><b>Al volo.</b> ${esc(s.segno)}.</p>`:""}${s.simili?`<p><b>Con cosa si confonde.</b> ${esc(s.simili)}.</p>`:""}
  ${[["Come riconoscerla","riconoscere"],["Dove e quando","dove_quando"],["Da dove viene","origine"],["Con le persone","uomo"],["Curiosità","curiosita"]].filter(([,k])=>sc[k]).map(([t,k])=>`<h4 class="sotto">${t}</h4><p>${esc(sc[k])}</p>`).join("")}
  ${sc.stato?`<p class="fonti">Stato di conservazione ${esc(sc.stato)}.</p>`:""}
  <h4 class="sotto">Lungo i cammini</h4>${s.inat?`<p class="fonti">Osservata su iNaturalist lungo questi cammini.</p>`:""}<ul class="lungo">${s.cammini.map(([k,nome,dove])=>`<li><a href="#/cammino/${k}/natura">${esc(nome)}</a>${dove?`. ${esc(dove)}.`:""}</li>`).join("")}</ul>
  ${sc.fonti?`<p class="fonti">Fonti della scheda: ${esc(sc.fonti.map(u=>(u.match(/https?:\/\/(?:www\.)?([^/]+)/)||[,u])[1]).filter((v,i,a)=>a.indexOf(v)===i).join(", "))}</p>`:""}
  ${s.foto?`<p class="fonti">${s.illustrazione?"Tavola":"Foto"}: ${esc(s.autore||"autore su Commons")}, ${esc(s.licenza||"")}. ${esc(s.commons||"")}</p>`:""}
  ${s.tavola?`<div class="tavola"><img src="${s.tavola.file}" alt="Tavola d'epoca, ${esc(s.sci)}"><p class="fonti">Tavola d'epoca: ${esc(s.tavola.autore||"opera indicata su Commons")}, ${esc(s.tavola.licenza||"")}. ${esc(s.tavola.commons||"")}</p></div>`:""}
  <p class="naviga-atl">${n>1?`<a href="#/atlante/${n-1}">‹ ${n-1}</a>`:"<span></span>"}<a href="#/atlante">Tutte</a>${A.specie.some(x=>x.n===n+1)?`<a href="#/atlante/${n+1}">${n+1} ›</a>`:"<span></span>"}</p></section>`;
}
let IMPARA=null, CALENDARIO=null;
async function vistaImparaLista(){
  colora(null); ponParte("#2E6B4F"); titolo.textContent="Impara a riconoscere";
  if(!IMPARA)IMPARA=await carica("dati/imparare.json");
  pagina.innerHTML=`<p class="intro-atl">Pagine brevi per distinguere specie che si somigliano. I numeri portano alle schede dell'atlante.</p><ul class="lista impara-l">${IMPARA.map(p=>`<li><a href="#/impara/${p.id}"><b>${esc(p.titolo)}</b><small>${esc((p.intro||"").split(". ")[0])}.</small></a></li>`).join("")}</ul>`;
}
async function vistaImpara(id){
  colora(null); ponParte("#2E6B4F");
  if(!IMPARA)IMPARA=await carica("dati/imparare.json"); const A=await atlante();
  const p=IMPARA.find(x=>x.id===id); if(!p){pagina.innerHTML=`<div class="vuoto">Pagina non trovata</div>`;return;}
  titolo.textContent=p.titolo; const per=sci=>A.specie.find(s=>s.sci===sci);
  pagina.innerHTML=`<section class="blocco"><h2>${esc(p.titolo)}</h2><p>${esc(p.intro||"")}</p>
  <div class="chiave">${p.chiave.map(r=>{const s=r.sci&&per(r.sci);return `<div class="riga-k">${s&&s.foto?`<a href="#/atlante/${s.n}" class="th" style="background-image:url(${s.foto})"></a>`:`<span class="th vuota"></span>`}<div><b>${esc(cap1(r.nome))}</b>${s?` <a class="na" href="#/atlante/${s.n}">${s.n}</a>`:""}${r.sci?`<br><i>${esc(r.sci)}</i>`:""}<p>${esc(r.come)}</p></div></div>`;}).join("")}</div>
  ${p.attenzione?`<div class="box-k att"><b>Attenzione</b><p>${esc(p.attenzione)}</p></div>`:""}${p.lo_sapevi?`<div class="box-k"><b>Lo sapevi?</b><p>${esc(p.lo_sapevi)}</p></div>`:""}
  ${fonti(p.fonti||[])}</section>`;
}
async function vistaCalendario(m){
  colora(null); ponParte("#2E6B4F");
  if(!CALENDARIO)CALENDARIO=await carica("dati/calendario.json"); const A=await atlante();
  const MESI=["gennaio","febbraio","marzo","aprile","maggio","giugno","luglio","agosto","settembre","ottobre","novembre","dicembre"];
  const c=CALENDARIO.find(x=>(x.mese||"").toLowerCase()===MESI[m])||{}; titolo.textContent="Il calendario";
  const chiave=(c.specie_chiave||[]).map(sci=>A.specie.find(s=>s.sci===sci)).filter(Boolean);
  const stag=A.specie.filter(s=>(s.mesi||[]).includes(m+1)&&(s.mesi||[]).length<=4);
  const card=s=>`<a href="#/atlante/${s.n}" class="${s.illustrazione?"illu":""}"><div class="img" style="${s.foto?`background-image:url(${s.foto})`:""}">${s.foto?"":"❀"}</div><div class="nomi"><b><span class="na">${s.n}</span> ${esc(cap1(s.it))}</b><i>${esc(s.sci)}</i></div></a>`;
  pagina.innerHTML=`<div class="chips mesi-cal">${MESI.map((x,i)=>`<a class="fchip${i===m?" attivo":""}" href="#/calendario/${i}" data-sostituisci>${x.slice(0,3)}</a>`).join("")}</div>
  <section class="blocco"><h2>${cap1(MESI[m])}</h2><p>${esc(c.intro||"")}</p>${(c.da_non_perdere||[]).length?`<div class="box-k"><b>Da non perdere</b><ul>${c.da_non_perdere.map(e=>`<li><b>${esc((e.cosa||"").replace(/\.$/,""))}.</b> ${esc(e.dove_quando||"")}</li>`).join("")}</ul></div>`:""}${fonti(c.fonti||[])}</section>
  ${chiave.length?`<h2 class="sez">Le specie del mese</h2><div class="specie">${chiave.map(card).join("")}</div>`:""}
  ${stag.length?`<h2 class="sez">Solo in questa stagione</h2><div class="specie">${stag.map(card).join("")}</div>`:""}`;
}
async function scaricaAtlante(A){
  const btn=$("#scaricaA"), barra=$("#barraA"), riemp=barra.querySelector("i"); btn.disabled=true; barra.hidden=false;
  const file=["dati/atlante.json","dati/imparare.json","dati/calendario.json",...A.specie.flatMap(s=>[s.foto,s.tavola&&s.tavola.file])].filter(Boolean);
  const cache=await caches.open("atlante"); let fatti=0, errori=0;
  const coda=[...file];
  await Promise.all(Array.from({length:4},async()=>{while(coda.length){const u=coda.shift();try{if(!(await cache.match(u))){const r=await fetch(u);if(r.ok)await cache.put(u,r.clone());else errori++;}}catch{errori++;}finally{fatti++;if(fatti%10===0||fatti===file.length){riemp.style.width=(100*fatti/file.length)+"%";btn.textContent=`Scarico ${fatti} di ${file.length}…`;}}}}));
  barra.hidden=true; btn.disabled=false;
  if(errori<file.length*0.1){localStorage.setItem("off:atlante",new Date().toISOString());btn.textContent="✓ Atlante disponibile offline";avviso("Atlante pronto anche senza rete",3000);}
  else{btn.textContent="⬇ Riprova il download";avviso(`${errori} elementi non scaricati, riprova più tardi`,4000);}
}

/* ---------- diario ---------- */
function tabDiario(c){
  const K="diario:"+c.chiave; const d=JSON.parse(localStorage.getItem(K)||"{}");
  const campi=[["data","Data"],["dove","Da dove a dove"],["km","Km"],["ore","Ore di cammino"],["meteo","Meteo"],["conchi","Con chi"],["dormito","Dove ho dormito"],["stavo","Come stavo"]];
  pagina.innerHTML=`<section class="blocco diario"><h3>Diario</h3><div class="due">${campi.map(([k,n])=>`<div><label>${n.toUpperCase()}</label><input data-k="${k}" value="${esc(d[k]||"")}"></div>`).join("")}</div>
  <label>NOTE, INCONTRI, PENSIERI</label><textarea data-k="note">${esc(d.note||"")}</textarea>
  <label>IN NATURA HO VISTO (piante, animali, funghi, rocce)</label><textarea data-k="natura">${esc(d.natura||"")}</textarea>
  <p class="fonti">Si salva da solo su questo telefono. <button class="btn secondario" id="esporta" style="padding:6px 10px">Copia il testo</button></p></section>`;
  pagina.querySelectorAll("[data-k]").forEach(el=>el.oninput=()=>{d[el.dataset.k]=el.value;localStorage.setItem(K,JSON.stringify(d));});
  $("#esporta").onclick=async()=>{const t=`${c.nome}\n`+campi.map(([k,n])=>`${n}: ${d[k]||""}`).join("\n")+`\n\nNote\n${d.note||""}\n\nIn natura ho visto\n${d.natura||""}`;try{await navigator.clipboard.writeText(t);avviso("Copiato");}catch{avviso("Non riesco a copiare");}};
}

/* ---------- mappa ---------- */
function iconaDiv(colore,testo,dim=20,bordo="#333",colTesto){return L.divIcon({className:"",html:`<div class="ico-poi" style="width:${dim}px;height:${dim}px;background:${colore};border-color:${bordo};color:${colTesto||(colore==="#fff"?"#333":"#fff")};font-size:${dim*0.55}px">${testo}</div>`,iconSize:[dim,dim],iconAnchor:[dim/2,dim/2],popupAnchor:[0,-dim/2]});}
function tabMappa(c){
  document.body.classList.add("mappa-aperta");
  pagina.innerHTML=`<div class="mappa-cont"><div id="mappa"></div><div class="mappa-strumenti"><button id="gps" title="Segui con il GPS">◎</button><button id="rec" title="Registra la traccia">●</button><button id="centra" title="Tutto il cammino">⤢</button><button id="livelli" title="Cosa mostrare">☰</button>${c.mappa_libro?`<button id="libro" title="Mappa disegnata del libro">▦</button>`:""}</div><div class="mappa-info" id="minfo">${c.tipo_traccia==="indicativo"?"Tracciato indicativo, non serve per orientarsi.":"Traccia "+esc(c.tipo_traccia)+". Tocca un simbolo per il nome."}</div></div>`;
  const col=infoParte(parteDi(c.sez)).colore; const bb=c.bb;
  mappa=L.map("mappa",{zoomControl:false,attributionControl:true}); mappa.attributionControl.setPrefix("");
  L.tileLayer(TILES,{maxZoom:17,maxNativeZoom:15,attribution:ATTR}).addTo(mappa);
  const tratteggio=c.tipo_traccia==="indicativo"; const linee=c.linee.map(l=>l.map(p=>[p[1],p[0]]));
  L.polyline(linee,{color:"#fff",weight:7,opacity:.85}).addTo(mappa);
  const traccia=L.polyline(linee,{color:col,weight:3.5,dashArray:tratteggio?"8 6":null}).addTo(mappa);
  mappa.fitBounds(traccia.getBounds(),{padding:[20,20]});
  // ogni strato compare da un certo zoom in su, così la vista d'insieme resta leggibile
  const strati={};
  const gruppo=(nome,on=true,zmin=0)=>{const g=L.layerGroup();strati[nome]={g,on,zmin};return g;};
  const gTappe=gruppo("Località di tappa",true,9), gLuoghi=gruppo("Luoghi del libro",true,9), gAcqua=gruppo("Acqua potabile",true,12), gRif=gruppo("Rifugi, bivacchi, campeggi, ostelli",true,10), gStaz=gruppo("Stazioni",true,11), gCime=gruppo("Cime e panorami",false,11), gAltri=gruppo("Castelli, cascate, grotte",false,11);
  const aggiorna=()=>{const z=mappa.getZoom();for(const s of Object.values(strati)){const v=s.on&&z>=s.zmin;if(v&&!mappa.hasLayer(s.g))s.g.addTo(mappa);if(!v&&mappa.hasLayer(s.g))mappa.removeLayer(s.g);}};
  mappa.on("zoomend",aggiorna); setTimeout(aggiorna,0);
  mappa.on("popupopen",e=>{const t=e.popup.getContent().replace(/<[^>]+>/g," ").trim();$("#minfo").textContent=t;});
  mappa.on("popupclose",()=>{$("#minfo").textContent=c.tipo_traccia==="indicativo"?"Tracciato indicativo, non serve per orientarsi.":"Traccia "+esc(c.tipo_traccia)+". Tocca un simbolo per il nome.";});
  const [a,b]=c.estremi||[c.linee[0][0],c.linee[c.linee.length-1].slice(-1)[0]];
  L.marker([a[1],a[0]],{icon:iconaDiv("#fff","",16,"#111")}).bindPopup(`<b>Partenza</b>${esc(c.partenza)}`).addTo(mappa);
  if(!c.anello)L.marker([b[1],b[0]],{icon:L.divIcon({className:"",html:'<div style="width:14px;height:14px;background:#111;border:2px solid #fff;box-shadow:0 1px 2px rgba(0,0,0,.4)"></div>',iconSize:[14,14],iconAnchor:[7,7]})}).bindPopup(`<b>Arrivo</b>${esc(c.arrivo)}`).addTo(mappa);
  c.localita.forEach(p=>L.marker([p[2],p[1]],{icon:iconaDiv("#fff","",11,"#111")}).bindPopup(`<b>${esc(p[0])}</b>località di tappa`).addTo(gTappe));
  c.luoghi.forEach(p=>{const st=LUOGO_STILE[p[1]]||LUOGO_STILE.luogo;L.marker([p[3],p[2]],{icon:iconaDiv("#fff",st[1],20,st[0],st[0])}).bindPopup(`<b>${esc(p[0])}</b>luogo citato nel libro`).addTo(gLuoghi);});
  c.acqua.forEach(p=>L.circleMarker([p[1],p[0]],{radius:5,color:"#0b3c5d",weight:1,fillColor:"#56B4E9",fillOpacity:1}).bindPopup(`<b>${p[2]==="sorgente"?"Sorgente":"Fontanella"}</b>acqua potabile secondo OpenStreetMap`).addTo(gAcqua));
  const dest={rifugio:gRif,bivacco:gRif,campeggio:gRif,ostello:gRif,stazione:gStaz,cima:gCime,panorama:gCime,castello:gAltri,cascata:gAltri,grotta:gAltri};
  Object.entries(c.poi).forEach(([cat,L_])=>{const st=POI_STILE[cat];if(!st||!dest[cat])return;L_.forEach(p=>{if(cat==="cima"&&!p[3])return;
    L.marker([p[1],p[0]],{icon:iconaDiv(st[0],st[1],cat==="cima"?16:20,cat==="bivacco"?"#a1341b":cat==="panorama"?"#333":"#fff")}).bindPopup(`<b>${esc(p[2]||st[2])}</b>${st[2]}${p[3]?`, ${p[3]} m`:""}`).addTo(dest[cat]);});});
  $("#centra").onclick=()=>{seguiGps=false;$("#gps").classList.remove("attivo");mappa.fitBounds(traccia.getBounds());};
  // la mappa disegnata del libro (boschi, campi, curve di livello): si guarda come un'immagine, anche senza rete
  if(c.mappa_libro){let mappaLibro=null;
    const apri=()=>{if(mappaLibro){mappaLibro.remove();mappaLibro=null;$("#mlibro").remove();$("#libro").classList.remove("attivo");$("#minfo").hidden=false;$("#minfo").textContent="Tocca un simbolo per il nome.";return;}
      const d=document.createElement("div");d.id="mlibro";$(".mappa-cont").appendChild(d);$("#libro").classList.add("attivo");$("#minfo").hidden=true;
      const im=new Image();im.onload=()=>{const w=im.naturalWidth,h=im.naturalHeight;const zmax=Math.log2(window.devicePixelRatio||1)+0.5;mappaLibro=L.map(d,{crs:L.CRS.Simple,zoomControl:false,attributionControl:false,minZoom:-4,maxZoom:zmax,zoomSnap:0.25,bounceAtZoomLimits:false});
        const b=[[0,0],[h,w]];L.imageOverlay(c.mappa_libro,b).addTo(mappaLibro);mappaLibro.fitBounds(b);mappaLibro.setMaxBounds([[-h*0.2,-w*0.2],[h*1.2,w*1.2]]);
        $("#minfo").hidden=false;$("#minfo").textContent="Mappa disegnata del libro, fissa. Per i punti utili torna alla mappa con il tasto ▦.";};
      im.src=c.mappa_libro;};
    $("#libro").onclick=apri;
    if(window.ANTEPRIMA)setTimeout(apri,50);}
  const prog=progressione(c.linee); let fuori=false, ultimoAvviso=0, wake=null;
  const K_REC="rec:"+c.chiave; let rec=JSON.parse(localStorage.getItem(K_REC)||"null"); let recLinea=null;
  const disegnaRec=()=>{if(!rec||!rec.punti.length)return;const ll=rec.punti.map(p=>[p[1],p[0]]);if(!recLinea)recLinea=L.polyline(ll,{color:"#CC79A7",weight:4,dashArray:"2 6"}).addTo(mappa);else recLinea.setLatLngs(ll);};
  disegnaRec(); if(rec&&rec.attiva)$("#rec").classList.add("attivo");
  const parla=t=>{try{if(!("speechSynthesis" in window))return;const u=new SpeechSynthesisUtterance(t);u.lang="it-IT";speechSynthesis.cancel();speechSynthesis.speak(u);}catch{}};
  const suPosizione=pos=>{const ll=[pos.coords.latitude,pos.coords.longitude]; const ora=Date.now();
    if(!gpsMarker||!mappa.hasLayer(gpsMarker)){gpsMarker=L.circleMarker(ll,{radius:8,color:"#fff",weight:2,fillColor:"#0072B2",fillOpacity:1}).addTo(mappa);}else gpsMarker.setLatLng(ll);
    const d=distanzaDaTraccia(ll,c.linee); const pr=prog.km(ll);
    const testo=`${d<1?Math.round(d*1000)+" m":d.toFixed(1)+" km"} dal sentiero · ${prog.n>1?`tratto ${pr.tratto}, `:""}km ${pr.km.toFixed(1)} di ${pr.tot.toFixed(0)} · precisione ${Math.round(pos.coords.accuracy)} m`;
    $("#minfo").textContent=testo;
    if(seguiGps){ if(d>0.1&&pos.coords.accuracy<60){ if(!fuori||ora-ultimoAvviso>120000){fuori=true;ultimoAvviso=ora;parla(`Attenzione, sei a ${Math.round(d*1000)} metri dal sentiero.`);} }
      else if(fuori&&d<0.05){fuori=false;parla("Sei di nuovo sul sentiero.");}
      mappa.setView(ll,Math.max(mappa.getZoom(),14)); }
    if(rec&&rec.attiva&&pos.coords.accuracy<80){const u=rec.punti[rec.punti.length-1];
      if(!u||distKm([u[0],u[1]],[ll[1],ll[0]])>0.008){rec.punti.push([+ll[1].toFixed(6),+ll[0].toFixed(6),ora]);localStorage.setItem(K_REC,JSON.stringify(rec));disegnaRec();}}
  };
  const avviaGps=()=>{if(gps)return;gps=navigator.geolocation.watchPosition(suPosizione,e=>avviso("Posizione non disponibile. Controlla i permessi."),{enableHighAccuracy:true,maximumAge:3000,timeout:20000});};
  const fermaGpsSeInutile=()=>{if(!seguiGps&&!(rec&&rec.attiva)&&gps){navigator.geolocation.clearWatch(gps);gps=null;}};
  $("#gps").onclick=async()=>{if(!navigator.geolocation){avviso("Il GPS non è disponibile");return;}seguiGps=!seguiGps;$("#gps").classList.toggle("attivo",seguiGps);
    if(seguiGps){avviaGps();avviso("Ti seguo. Ti avviso a voce se ti allontani dal sentiero. Lo schermo resta acceso.",4000);try{wake=await navigator.wakeLock.request("screen");}catch{}}
    else{fermaGpsSeInutile();try{wake&&wake.release();}catch{}wake=null;}};
  $("#rec").onclick=()=>{if(!navigator.geolocation){avviso("Il GPS non è disponibile");return;}
    if(rec&&rec.attiva){rec.attiva=false;localStorage.setItem(K_REC,JSON.stringify(rec));$("#rec").classList.remove("attivo");fermaGpsSeInutile();
      const kmr=rec.punti.reduce((s,p,i)=>i?s+distKm(rec.punti[i-1],p):0,0);
      if(rec.punti.length>1&&confirm(`Registrati ${kmr.toFixed(1)} km. Vuoi salvare il GPX? (Annulla per tenere la registrazione e riprenderla dopo)`)){esportaGpx(c.nome+" registrato",[rec.punti],c.chiave+"_registrato.gpx");}
      return;}
    if(rec&&rec.punti.length&&!confirm("Riprendo la registrazione precedente? (Annulla per ricominciare da zero)")){rec=null;if(recLinea){mappa.removeLayer(recLinea);recLinea=null;}}
    rec=rec||{punti:[],inizio:Date.now()}; rec.attiva=true; localStorage.setItem(K_REC,JSON.stringify(rec)); $("#rec").classList.add("attivo"); avviaGps();
    avviso("Registro la traccia finché l'app resta aperta. Per registrare a schermo spento usa Komoot, OsmAnd o l'orologio con il GPX.",5000);};
  document.addEventListener("visibilitychange",async()=>{if(document.visibilityState==="visible"&&seguiGps&&!wake){try{wake=await navigator.wakeLock.request("screen");}catch{}}});
  $("#livelli").onclick=()=>{const box=document.createElement("div");box.className="leaflet-control";box.style.cssText="position:absolute;right:60px;top:10px;z-index:1000;background:#fff;color:#222;border-radius:10px;padding:10px 12px;box-shadow:0 1px 4px rgba(0,0,0,.3);font-size:14px";
    box.innerHTML=Object.keys(strati).map(n=>`<label style="display:block;padding:3px 0"><input type="checkbox" data-n="${n}" ${strati[n].on?"checked":""}> ${n}</label>`).join("")+`<div style="margin-top:6px;font-size:12px;color:#666">I simboli compaiono ingrandendo. Mappa di fondo OpenTopoMap, serve rete o il download del cammino.</div>`;
    box.querySelectorAll("input").forEach(i=>i.onchange=()=>{strati[i.dataset.n].on=i.checked;aggiorna();if(i.checked&&mappa.getZoom()<strati[i.dataset.n].zmin)avviso("Si vede ingrandendo la mappa");});
    const chiudi=e=>{if(!box.contains(e.target)&&e.target.id!=="livelli"){box.remove();document.removeEventListener("click",chiudi);}};
    document.querySelector(".mappa-cont").appendChild(box); setTimeout(()=>document.addEventListener("click",chiudi),0);};
}
function distKm(a,b){const kx=111.32*Math.cos((a[1]+b[1])/2*Math.PI/180);return Math.hypot((a[0]-b[0])*kx,(a[1]-b[1])*110.57);}
function progressione(linee){
  // per ogni tratto la distanza cumulata; dice "km fatti" sul tratto più vicino
  const C=linee.map(L_=>{const cum=[0];for(let i=1;i<L_.length;i++)cum.push(cum[i-1]+distKm(L_[i-1],L_[i]));return cum;});
  const tot=C.reduce((s,c)=>s+(c[c.length-1]||0),0);
  return {tot,n:linee.length,km:ll=>{let bt=0,bi=0,bd=1e9;linee.forEach((L_,t)=>{for(let i=0;i<L_.length;i++){const d=distKm(L_[i],[ll[1],ll[0]]);if(d<bd){bd=d;bi=i;bt=t;}}});return {tratto:bt+1,km:C[bt][bi]||0,tot:C[bt][C[bt].length-1]||0};}};
}
function distanzaDaTraccia(ll,linee){const kx=111.32*Math.cos(ll[0]*Math.PI/180),ky=110.57;let best=1e9;
  for(const L_ of linee)for(let i=1;i<L_.length;i++){const a=L_[i-1],b=L_[i];const ax=(a[0]-ll[1])*kx,ay=(a[1]-ll[0])*ky,bx=(b[0]-ll[1])*kx,by=(b[1]-ll[0])*ky;const dx=bx-ax,dy=by-ay;const l2=dx*dx+dy*dy;
    let t=l2?-(ax*dx+ay*dy)/l2:0;t=Math.max(0,Math.min(1,t));const px=ax+t*dx,py=ay+t*dy;const d=Math.hypot(px,py);if(d<best)best=d;}
  return best;}

/* ---------- offline ---------- */
function tileXY(lon,lat,z){const n=2**z;const x=Math.floor((lon+180)/360*n);const la=lat*Math.PI/180;const y=Math.floor((1-Math.log(Math.tan(la)+1/Math.cos(la))/Math.PI)/2*n);return [x,y];}
function tilesCorridoio(linee,bb){
  const kmTot=linee.reduce((s,L_)=>{for(let i=1;i<L_.length;i++)s+=Math.hypot((L_[i][0]-L_[i-1][0])*111.32*Math.cos(L_[i][1]*Math.PI/180),(L_[i][1]-L_[i-1][1])*110.57);return s;},0);
  const zmax=kmTot<80?15:kmTot<300?14:13; const set=new Set();
  for(let z=10;z<=zmax;z++){const marg=z>=14?1:0;
    for(const L_ of linee)for(let i=0;i<L_.length;i++){const p=L_[i];const [x,y]=tileXY(p[0],p[1],z);for(let dx=-marg;dx<=marg;dx++)for(let dy=-marg;dy<=marg;dy++)set.add(`${z}/${x+dx}/${y+dy}`);
      if(i>0){const q=L_[i-1];const n=Math.ceil(Math.hypot(p[0]-q[0],p[1]-q[1])/(0.02/2**(z-10)));for(let j=1;j<n;j++){const [x2,y2]=tileXY(q[0]+(p[0]-q[0])*j/n,q[1]+(p[1]-q[1])*j/n,z);set.add(`${z}/${x2}/${y2}`);}}}}
  // panoramica
  for(let z=7;z<10;z++){const [x0,y0]=tileXY(bb[0],bb[3],z),[x1,y1]=tileXY(bb[1],bb[2],z);for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)set.add(`${z}/${x}/${y}`);}
  return [...set].map(s=>TILES.replace("{z}/{x}/{y}",s));
}
async function scaricaOffline(c){
  const btn=$("#scarica"), barra=$("#barra"), riemp=barra.querySelector("i"); btn.disabled=true; barra.hidden=false;
  const file=[`dati/cammini/${c.chiave}.json`,...c.paesaggi.map(p=>p.file),...c.specie_libro.map(s=>s.foto),...c.specie.map(s=>s.foto),...(c.specie_ricerca||[]).flatMap(s=>[s.foto,s.tavola&&s.tavola.file]),c.mappa_libro].filter(Boolean);
  const tiles=tilesCorridoio(c.linee,c.bb);
  const tot=file.length+tiles.length; let fatti=0, errori=0;
  btn.textContent="Scarico…";
  const cache=await caches.open("cammino-"+c.chiave), ct=await caches.open("tiles");
  async function prendi(url,cc){try{if(await cc.match(url))return;const r=await fetch(url,{mode:"cors"});if(r.ok)await cc.put(url,r.clone());else errori++;}catch{errori++;}finally{fatti++;if(fatti%10===0||fatti===tot){riemp.style.width=(100*fatti/tot)+"%";btn.textContent=`Scarico ${fatti} di ${tot}…`;}}}
  const coda=[...file.map(u=>[u,cache]),...tiles.map(u=>[u,ct])];
  const lavoratori=Array.from({length:4},async()=>{while(coda.length){const [u,cc]=coda.shift();await prendi(u,cc);}});
  await Promise.all(lavoratori);
  barra.hidden=true; btn.disabled=false;
  if(errori<tot*0.1){localStorage.setItem("off:"+c.chiave,new Date().toISOString());btn.textContent="✓ Salvato offline";avviso(`Fatto. ${errori?errori+" elementi non scaricati, riprova più tardi.":"Mappa e testi pronti anche senza rete."}`,4000);}
  else{btn.textContent="⬇ Riprova";avviso(`${errori} elementi non scaricati. Controlla la rete e riprova.`,4000);}
}

function vistaInfo(){
  colora(null); titolo.textContent="Informazioni";
  const off=Object.keys(localStorage).filter(k=>k.startsWith("off:")).length;
  pagina.innerHTML=`<section class="blocco"><h3>Come funziona</h3><p>${IDX.cammini.length} cammini in ${IDX.capitoli.length} capitoli${IDX.parti.length>1?` e ${IDX.parti.length} parti`:""}. Ogni cammino ha la scheda con le tappe, la mappa con il tracciato e i punti utili, la natura con le specie del luogo, la storia e un diario da compilare.</p>
  <p>Per usarla senza rete apri il cammino e tocca <b>Salva offline</b>, che mette sul telefono testi, foto e la mappa di fondo lungo il percorso. Cammini scaricati finora: ${off}.</p>
  <p>Su iPhone, da Safari, tocca Condividi e poi <b>Aggiungi alla schermata Home</b>. Su Android, dal menu di Chrome, <b>Installa app</b> o <b>Aggiungi a schermata Home</b>.</p></section>
  <section class="blocco"><h3>Simboli della mappa</h3><div class="legenda">
  <div><span class="s" style="background:#fff"></span>partenza, località di tappa</div><div><span class="s" style="background:#111;border-radius:0"></span>arrivo</div>
  <div><span class="s" style="background:#56B4E9;border-color:#0b3c5d"></span>fontanella, sorgente</div><div><span class="s" style="background:#a1341b"></span>rifugio</div>
  <div><span class="s" style="background:#fff;border-color:#a1341b"></span>bivacco, riparo</div><div><span class="s" style="background:#2e7d32"></span>campeggio</div>
  <div><span class="s" style="background:#5b4a8b"></span>ostello</div><div><span class="s" style="background:#1a1a1a"></span>stazione</div>
  <div><span class="s" style="background:#6b4f2a"></span>cima</div><div><span class="s" style="background:#fff"></span>panorama</div></div>
  <p class="fonti" style="margin-top:8px">Punti da OpenStreetMap entro un paio di chilometri dal tracciato. Le fontanelle entro 300 m. Verifica sempre sul posto.</p></section>
  <section class="blocco"><h3>Crediti e licenze</h3><p class="fonti">Testi raccolti da Leonardo Lascala dai siti dei cammini, dall'Atlante dei Cammini d'Italia, dai parchi e da Wikipedia. Mappa di fondo OpenTopoMap (CC BY-SA), dati © contributori di OpenStreetMap (ODbL), compresi fontanelle, rifugi e gli altri punti. Specie segnalate dagli osservatori di iNaturalist, descrizioni da Wikipedia (CC BY-SA). Foto da Wikimedia Commons con licenze libere, autore e licenza in ogni scheda.</p>
  <p class="fonti">I cammini cambiano. Prima di partire controlla il sito ufficiale, il meteo e lo stato dei sentieri. Chi cammina lo fa sotto la propria responsabilità.</p>
  <p><button class="btn secondario" id="svuota">Libera lo spazio dei download</button></p></section>`;
  $("#svuota").onclick=async()=>{if(!confirm("Cancello mappe e foto scaricate? I diari restano."))return;const ks=await caches.keys();for(const k of ks)if(k!=="app")await caches.delete(k);Object.keys(localStorage).filter(k=>k.startsWith("off:")).forEach(k=>localStorage.removeItem(k));avviso("Spazio liberato");render();};
}
/* ---------- natura: riquadri ---------- */
const MESI_N=["gennaio","febbraio","marzo","aprile","maggio","giugno","luglio","agosto","settembre","ottobre","novembre","dicembre"];
function verde(){colora(null);ponParte("#2E6B4F","#eaf2ec");document.querySelector('meta[name=theme-color]').content="#2E6B4F";}
const tileFoto=(href,titolo_,sotto,foto,cls="")=>`<a class="tile foto ${cls}" href="${href}" style="${foto?`background-image:linear-gradient(to top,rgba(0,0,0,.72),rgba(0,0,0,.08) 70%),url(${foto})`:""}"><b>${titolo_}</b><small>${sotto}</small></a>`;
async function vistaNatura(){
  verde(); titolo.textContent="Natura";
  const A=await atlante(); const m=new Date().getMonth();
  try{if(!IMPARA)IMPARA=await carica("dati/imparare.json");}catch{} try{if(!CALENDARIO)CALENDARIO=await carica("dati/calendario.json");}catch{}
  const per=sci=>A.specie.find(s=>s.sci===sci);
  const fotoDi=(...L)=>{for(const x of L){const s=per(x);if(s&&s.foto&&!s.illustrazione)return s.foto;}return (A.specie.find(s=>s.foto&&!s.illustrazione)||{}).foto;};
  const cal=(CALENDARIO||[]).find(x=>(x.mese||"").toLowerCase()===MESI_N[m])||{};
  const nMese=A.specie.filter(s=>(s.mesi||[]).includes(m+1)).length;
  pagina.innerHTML=`<div class="tiles"><a class="tile foto largo alto" href="#/qui" style="background-image:linear-gradient(to top,rgba(0,0,0,.72),rgba(0,0,0,.05) 70%),url(${fotoDi("Fagus sylvatica")})"><b>◎ Cosa c'è qui intorno</b><small>piante e animali della zona dove sei, in questo mese</small></a></div>
  <div class="tiles tiles-grandi">
   ${tileFoto("#/atlante","Atlante",`${A.specie.length} specie`,fotoDi("Quercus cerris","Fagus sylvatica"))}
   ${tileFoto("#/ambienti","In che ambiente sono?","faggeta, macchia, prato…",fotoDi("Arbutus unedo","Quercus ilex"))}
   ${tileFoto("#/calendario/"+m,"Questo mese",`${cap1(MESI_N[m])}, ${nMese} specie da cercare`,fotoDi(...(cal.specie_chiave||[])))}
   ${tileFoto("#/impara","Impara a riconoscere",`${(IMPARA||[]).length} pagine`,fotoDi("Quercus pubescens","Quercus robur"))}
  </div>
  <div class="tiles"><a class="tile foto largo" href="#/tracce" style="background-image:linear-gradient(to top,rgba(0,0,0,.72),rgba(0,0,0,.05) 70%),url(dati/foto/tracce/capriolo_impronta.jpg)"><b>Tracce e segni</b><small>impronte, piste, escrementi, pigne rosicchiate…</small></a></div>
  <a class="tile largo invito" href="#/riconosci"><b>◉ Cos'è quello che ho davanti?</b><small>fotografalo e l'app prova a riconoscerlo</small></a>`;
}

/* ---------- tracce e segni: impronte disegnate in scala, piste, altri segni ---------- */
let TRACCE=null;
const PX_CM=13;   // pixel per centimetro negli schemi, uguale per tutte le specie così le misure si confrontano
function svgScala(d,px){return d.svg.replace(/width="[\d.]+cm" height="[\d.]+cm"/,`width="${(d.w*px).toFixed(0)}" height="${(d.h*px).toFixed(0)}"`);}
function fotoTr(f){return `<figure class="foto-tr"><img src="${f.file}" alt="${esc(f.didascalia)}" loading="lazy"><figcaption>${esc(f.didascalia)} · ${f.autore?esc(f.autore)+", ":""}${esc(f.licenza)}, <a href="${f.url}" target="_blank" rel="noopener">iNaturalist</a></figcaption></figure>`;}
async function vistaTracce(id,sub){
  colora(null); ponParte("#2E6B4F");
  if(!TRACCE)TRACCE=await carica("dati/tracce.json");
  const T=TRACCE;
  if(!id){
    titolo.textContent="Tracce e segni";
    const gruppi=[...new Set(T.specie.map(e=>e.gruppo))];
    pagina.innerHTML=`<section class="blocco"><h3>Come leggere un'impronta</h3>${breveLungo(T.intro.split(". ").slice(0,2).join(". ")+".",T.intro)}</section>
    <section class="blocco"><h3>Le piste</h3><div class="piste">${T.piste.map(p=>`<div class="pista">${p.svg.replace(/width="[\d.]+cm" height="[\d.]+cm"/,'width="100%" height="190"')}<b>${esc(p.titolo)}</b><small>${esc(p.testo)}</small></div>`).join("")}</div><p class="fonti">Schemi non in scala, il verso di marcia è verso l'alto.</p></section>
    ${gruppi.map(g=>`<h2 class="sez">${esc(g)}</h2><ul class="lista tr-lista">${T.specie.filter(e=>e.gruppo===g).map(e=>{const a=e.disegni.ant;return `<li><a href="#/tracce/${e.id}"><span class="tr-th">${a?svgScala(a,Math.min(PX_CM*0.5,46/Math.max(a.w,a.h))):""}</span><span class="t"><b>${esc(cap1(e.it))}</b><small>${a?esc(a.testo):""}</small></span><span class="freccia">›</span></a></li>`;}).join("")}</ul>`).join("")}
    <h2 class="sez">Altri segni</h2><ul class="lista">${T.segni.map(s=>`<li><a href="#/tracce/segno/${s.id}"><span class="t"><b>${esc(s.titolo)}</b><small>${esc((s.chi||[]).slice(0,4).join(", "))}</small></span><span class="freccia">›</span></a></li>`).join("")}</ul>`;
    return;
  }
  if(id==="segno"){
    const s=T.segni.find(x=>x.id===sub); if(!s){pagina.innerHTML=`<div class="vuoto">Pagina non trovata</div>`;return;}
    titolo.textContent=s.titolo;
    pagina.innerHTML=`<section class="blocco${s.id==="sicurezza"?" attenzione":""}"><h3>${esc(s.titolo)}</h3><p>${esc(s.testo)}</p>${s.come_distinguere?`<p><b>Come distinguerli.</b> ${esc(s.come_distinguere)}</p>`:""}</section>
    ${(s.foto||[]).map(fotoTr).join("")}<section class="blocco">${fonti(s.fonti||[])}</section>`;
    return;
  }
  const e=T.specie.find(x=>x.id===id); if(!e){pagina.innerHTML=`<div class="vuoto">Pagina non trovata</div>`;return;}
  titolo.textContent=cap1(e.it);
  const par=(t,x)=>x?`<p><b>${t}.</b> ${esc(x)}</p>`:"";
  const imp=["ant","post"].filter(k=>e.disegni[k]).map(k=>`<div><div class="tr-svg">${svgScala(e.disegni[k],PX_CM)}</div><small><b>${k==="ant"?"Anteriore":"Posteriore"}</b><br>${esc(e.disegni[k].testo)}</small></div>`).join("");
  pagina.innerHTML=`<section class="blocco"><h2 class="tr-nome">${esc(cap1(e.it))} <i>${esc(e.sci)}</i>${e.n_atlante?` <a class="na" href="#/atlante/${e.n_atlante}">${e.n_atlante}</a>`:""}</h2>
    <div class="tr-imp">${imp}</div><p class="fonti">Schema disegnato sulle misure delle fonti, tutte le specie alla stessa scala. <span class="cm1"></span> 1 cm</p>
    ${par("Impronta",e.forma)}${par("Pista",e.andatura)}${par("Escrementi",e.escrementi)}${par("Altri segni",e.altri_segni)}${par("Con cosa si confonde",e.si_confonde)}${par("Dove cercarle",e.dove)}</section>
    ${e.id==="lupo"?`<section class="blocco in-breve-b"><h3>Lupo o cane?</h3><p>${esc(T.lupo_cane)}</p></section>`:""}
    ${(e.foto||[]).map(fotoTr).join("")}<section class="blocco">${fonti(e.fonti||[])}</section>`;
}

/* ---------- riconosci: tre modelli sul telefono, e Claude quando c'è ---------- */
// Modelli AIY di Google (Apache 2.0) addestrati su iNaturalist: piante, insetti, uccelli. Si tengono solo le specie
// osservate in Italia (dati/riconosci/riconosci.json, indice dell'etichetta -> [nome scientifico, nome italiano, numero nell'atlante]).
const RIC={pronto:null,R:null,M:null,claude:null,ferma:null};
const RIC_DIR="dati/riconosci/";
const RIC_FILE=["tf-core.min.js","tf-backend-cpu.min.js","tf-tflite.min.js","tflite_web_api_cc_simd.js","tflite_web_api_cc_simd.wasm","riconosci.json","plants.tflite","insects.tflite","birds.tflite"];
const RIC_GRUPPO={plants:"pianta",insects:"insetto",birds:"uccello"};
function caricaScript(src){return new Promise((ok,ko)=>{if(document.querySelector(`script[src="${src}"]`))return ok();const s=document.createElement("script");s.src=src;s.onload=()=>ok();s.onerror=()=>ko(new Error("non riesco a caricare "+src));document.head.appendChild(s);});}
function preparaRiconoscimento(stato){
  if(!RIC.pronto)RIC.pronto=(async()=>{
    for(const f of ["tf-core.min.js","tf-backend-cpu.min.js","tf-tflite.min.js"])await caricaScript(new URL(RIC_DIR+f,location.href).href);
    tflite.setWasmPath(new URL(RIC_DIR,location.href).href);   // percorso assoluto: con un percorso relativo la libreria ci attacca il #/ della pagina
    RIC.R=await carica(RIC_DIR+"riconosci.json"); RIC.M={};
    for(const m of ["plants","insects","birds"]){stato&&stato(`Preparo il riconoscimento (${RIC_GRUPPO[m]==="pianta"?"piante":RIC_GRUPPO[m]==="insetto"?"insetti":"uccelli"})…`);RIC.M[m]=await tflite.loadTFLiteModel(await bytesModello(m));}
  })().catch(e=>{RIC.pronto=null;throw e;});
  return RIC.pronto;
}
// il modello come file .tflite; dove quel tipo di file non si può pubblicare (l'anteprima dentro Claude) è in base64 dentro un .json
async function bytesModello(m){
  try{const r=await fetch(RIC_DIR+m+".tflite");if(r.ok&&!/html|json/.test(r.headers.get("content-type")||""))return await r.arrayBuffer();}catch{}
  const j=await carica(RIC_DIR+m+".b64.json"); const t=atob(j.b64); const u=new Uint8Array(t.length); for(let i=0;i<t.length;i++)u[i]=t.charCodeAt(i); return u.buffer;
}
function claudeConImmagini(){
  if(!RIC.claude)RIC.claude=(async()=>{try{if(!window.claude||!window.claude.use)return null;const s=await window.claude.use("sample");if(!s)return null;const l=await s.limits().catch(()=>null);return l&&l.images?s:null;}catch{return null;}})();
  return RIC.claude;
}
function ritaglio(img,lato){const c=document.createElement("canvas");c.width=c.height=lato;const w=img.naturalWidth,h=img.naturalHeight,l=Math.min(w,h);c.getContext("2d").drawImage(img,(w-l)/2,(h-l)/2,l,l,0,0,lato,lato);return c;}
function ridotta(img,max,q){const k=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));const c=document.createElement("canvas");c.width=Math.round(img.naturalWidth*k);c.height=Math.round(img.naturalHeight*k);c.getContext("2d").drawImage(img,0,0,c.width,c.height);return c;}
async function classifica(img){
  const x=tf.tidy(()=>tf.expandDims(tf.cast(tf.browser.fromPixels(ritaglio(img,224)),"int32"),0)); const out=[];
  try{for(const m in RIC.M){const y=RIC.M[m].predict(x);const p=await y.data();y.dispose();const L=RIC.R[m];for(const i in L)out.push({sci:L[i][0],it:L[i][1],n:L[i][2],p:p[+i]/255,m});}}
  finally{x.dispose();}
  return out.sort((a,b)=>b.p-a.p);
}
const fiducia=p=>p>=0.7?"molto probabile":p>=0.4?"probabile":"possibile";
async function vistaRiconosci(){
  colora(null); ponParte("#8A3B12"); document.querySelector('meta[name=theme-color]').content="#8A3B12"; titolo.textContent="Riconosci";
  let gruppo=sessionStorage.getItem("ric:g")||"tutto";
  const offline=localStorage.getItem("off:riconosci");
  pagina.innerHTML=`<section class="blocco ric-testa"><p>Fotografa da vicino una pianta, un fiore, un insetto o un uccello, con il soggetto al centro e ben a fuoco.</p>
   <div class="ric-bottoni"><label class="btn grande">◉ Scatta una foto<input type="file" accept="image/*" capture="environment" id="ricFoto"></label>
   <label class="btn secondario">Scegli dalla galleria<input type="file" accept="image/*" id="ricGal"></label></div>
   <div class="fc gruppi-ric">${[["tutto","Tutto"],["plants","Pianta"],["insects","Insetto"],["birds","Uccello"]].map(([v,t])=>`<button class="fchip${gruppo===v?" attivo":""}" data-g="${v}">${t}</button>`).join("")}</div></section>
  <div id="ricRis"></div>
  <section class="blocco"><h3>Come funziona</h3>
   <p>Sul telefono girano tre piccoli modelli, per piante, insetti e uccelli, che funzionano anche senza rete. Di ogni proposta vedi quanto è sicura e, se la specie è nell'atlante, la sua scheda. Non riconoscono funghi, mammiferi, rettili e anfibi, e con le foto storte o lontane sbagliano spesso.</p>
   <p id="ricInfoClaude" hidden>Quando c'è rete puoi chiedere anche a Claude, che guarda la foto e riconosce anche funghi, licheni e animali. Ogni domanda usa il tuo account Claude.</p>
   <div class="box-k att"><b>Attenzione</b><p>Non mangiare mai una pianta o un fungo riconosciuto da un'app. I funghi raccolti vanno fatti controllare all'ispettorato micologico della ASL.</p></div>
   <p><button class="btn secondario" id="ricScarica">${offline?"✓ Riconoscimento disponibile senza rete":"⬇ Scarica il riconoscimento per usarlo senza rete (16 MB)"}</button></p><div class="barra" id="ricBarra" hidden><i></i></div>
   <p class="fonti">Modelli AIY Vision Classifier di Google (piante, insetti, uccelli), licenza Apache 2.0, addestrati su foto di iNaturalist. Specie tenute: quelle con osservazioni verificate in Italia su iNaturalist.</p></section>`;
  pagina.querySelectorAll(".gruppi-ric .fchip").forEach(b=>b.onclick=()=>{gruppo=b.dataset.g;sessionStorage.setItem("ric:g",gruppo);pagina.querySelectorAll(".gruppi-ric .fchip").forEach(x=>x.classList.toggle("attivo",x===b));if(RIC.ultima)mostraTelefono();});
  for(const id of ["ricFoto","ricGal"])$("#"+id).onchange=e=>{const f=e.target.files&&e.target.files[0];e.target.value="";if(f)analizza(f);};
  $("#ricScarica").onclick=scaricaRiconoscimento;
  claudeConImmagini().then(s=>{const el=$("#ricInfoClaude");if(el)el.hidden=!s;});
  RIC.ultima=null;
  async function analizza(file){
    const A=await atlante(); const url=URL.createObjectURL(file); const img=new Image(); img.src=url;
    try{await img.decode();}catch{avviso("Non riesco ad aprire questa foto");return;}
    RIC.ultima={img,file,tel:null,claude:null};
    $("#ricRis").innerHTML=`<section class="blocco ris-ric"><div class="ric-foto"><img src="${url}" alt="La tua foto"></div>
      <h3>Sul telefono</h3><div id="ricTel"><p class="attesa">Preparo il riconoscimento…</p></div>
      <div id="ricClaude"></div>
      <div class="ric-salva"><label>NOME DA SALVARE</label><input id="ricNome" placeholder="Da riconoscere"><button class="btn secondario" id="ricSalva">Salva nel diario</button></div></section>`;
    $("#ricRis").scrollIntoView({behavior:"smooth",block:"start"});
    $("#ricSalva").onclick=()=>salvaOsservazione();
    try{await preparaRiconoscimento(t=>{const e=$("#ricTel .attesa");if(e)e.textContent=t;});RIC.ultima.tel=await classifica(img);mostraTelefono();}
    catch(e){$("#ricTel").innerHTML=`<p class="attesa">Il riconoscimento sul telefono non è disponibile${navigator.onLine?"":": senza rete serve averlo scaricato prima"}.</p>`;}
    const s=await claudeConImmagini();
    if(s&&RIC.ultima&&RIC.ultima.img===img){$("#ricClaude").innerHTML=`<p><button class="btn" id="ricChiedi">Chiedi a Claude</button></p>`;$("#ricChiedi").onclick=()=>chiediClaude(s,A);}
  }
  function riga(r,A){const s=r.n?A.specie.find(x=>x.n===r.n):null;const nome=cap1(r.it||(s&&s.it)||r.sci);
    return `<div class="riga-k">${s&&s.foto?`<a href="#/atlante/${s.n}" class="th" style="background-image:url(${s.foto})"></a>`:`<span class="th vuota"></span>`}<div><b>${esc(nome)}</b>${s?` <a class="na" href="#/atlante/${s.n}">${s.n}</a>`:""}<br><i>${esc(r.sci)}</i><p><span class="fid f${r.p>=0.7?3:r.p>=0.4?2:1}">${fiducia(r.p)}</span> · ${RIC_GRUPPO[r.m]}${s?"":" · non è nell'atlante"}</p></div></div>`;}
  async function mostraTelefono(){
    const A=await atlante(); const u=RIC.ultima; if(!u||!u.tel)return;
    const L=u.tel.filter(r=>gruppo==="tutto"||r.m===gruppo).filter((r,i,a)=>a.findIndex(x=>x.sci===r.sci)===i).slice(0,3).filter(r=>r.p>=0.12);
    $("#ricTel").innerHTML=L.length?`<div class="chiave">${L.map(r=>riga(r,A)).join("")}</div>`:`<p class="attesa">Non la riconosco. Prova più da vicino, con il soggetto al centro${RIC.claude?", oppure chiedi a Claude":""}.</p>`;
    const nome=$("#ricNome"); if(nome&&!nome.value&&L[0]&&L[0].p>=0.4){nome.value=cap1(L[0].it||L[0].sci);nome.dataset.sci=L[0].sci;nome.dataset.n=L[0].n||"";nome.dataset.fonte="telefono";}
  }
  async function chiediClaude(sample,A){
    const u=RIC.ultima; const box=$("#ricClaude"); const ctl=new AbortController(); RIC.ferma=ctl;
    box.innerHTML=`<h3>Claude</h3><p class="attesa">Claude sta guardando la foto… <button class="btn secondario" id="ricStop">Ferma</button></p>`;
    $("#ricStop").onclick=()=>ctl.abort();
    const blob=await new Promise(ok=>ridotta(u.img,1600).toBlob(ok,"image/jpeg",0.88));
    const indizi=(u.tel||[]).slice(0,3).filter(r=>r.p>=0.15).map(r=>`${r.sci} (${Math.round(r.p*100)}%)`).join(", ");
    const prompt=`Sei un naturalista esperto della flora, della fauna e dei funghi d'Italia. La foto è stata scattata a ${MESI_N[new Date().getMonth()]} lungo un cammino a piedi in Italia. Riconosci l'organismo principale al centro della foto. Arriva alla specie se i caratteri visibili bastano, altrimenti fermati al genere o alla famiglia. Non inventare. Se la foto non permette di dirlo, scrivilo.
${indizi?`Un piccolo modello sul telefono propone ${indizi}. È solo un indizio e sbaglia spesso.\n`:""}
Questo è l'elenco delle specie dell'atlante della persona, una per riga (nome scientifico | nome italiano). Se la specie che vedi è nell'elenco, usa esattamente quel nome scientifico.
${A.specie.map(s=>`${s.sci} | ${s.it}`).join("\n")}

Rispondi solo con un oggetto JSON con questi campi.
"sci" nome scientifico della specie, del genere o della famiglia.
"it" nome italiano comune, oppure stringa vuota.
"livello" uno fra "specie", "genere", "famiglia", "non riconoscibile".
"gruppo" uno fra "pianta", "fungo", "lichene", "insetto", "ragno", "uccello", "mammifero", "rettile", "anfibio", "altro".
"certezza" uno fra "alta", "media", "bassa".
"come" una o due frasi sui caratteri visibili nella foto che portano a questa risposta.
"simili" una frase su con cosa si confonde e come si distingue.
"attenzione" una frase su tossicità o pericoli se ce ne sono, altrimenti stringa vuota.
Scrivi in italiano semplice, con frasi brevi, senza trattini lunghi.`;
    try{
      const r=await sample.json(prompt,{images:[blob],signal:ctl.signal});
      if(RIC.ultima!==u)return; u.claude=r;
      const s=A.specie.find(x=>x.sci===r.sci)||A.specie.find(x=>x.sci.split(" ").slice(0,2).join(" ")===String(r.sci||"").split(" ").slice(0,2).join(" ")&&r.livello==="specie");
      const nome=cap1(r.it||(s&&s.it)||r.sci||"Non riconoscibile"); const fung=r.gruppo==="fungo"||(s&&s.regno==="funghi");
      box.innerHTML=`<h3>Claude</h3><div class="chiave"><div class="riga-k">${s&&s.foto?`<a href="#/atlante/${s.n}" class="th" style="background-image:url(${s.foto})"></a>`:`<span class="th vuota"></span>`}<div><b>${esc(nome)}</b>${s?` <a class="na" href="#/atlante/${s.n}">${s.n}</a>`:""}${r.sci&&r.livello!=="non riconoscibile"?`<br><i>${esc(r.sci)}</i>`:""}<p><span class="fid f${r.certezza==="alta"?3:r.certezza==="media"?2:1}">certezza ${esc(r.certezza||"bassa")}</span>${r.livello&&r.livello!=="specie"?` · ${esc(r.livello)}`:""}${r.gruppo?` · ${esc(r.gruppo)}`:""}${s?"":" · non è nell'atlante"}</p></div></div></div>
        ${r.come?`<p><b>Perché.</b> ${esc(r.come)}</p>`:""}${r.simili?`<p><b>Con cosa si confonde.</b> ${esc(r.simili)}</p>`:""}
        ${r.attenzione||fung?`<div class="box-k att"><b>Attenzione</b><p>${esc(r.attenzione||"")}${fung?" Nessun fungo va mangiato in base a un'app: fallo controllare all'ispettorato micologico della ASL.":""}</p></div>`:""}
        ${s?`<p><a class="btn secondario" href="#/atlante/${s.n}">Scheda nell'atlante, n. ${s.n}</a></p>`:""}`;
      const n_=$("#ricNome"); if(n_&&r.livello!=="non riconoscibile"){n_.value=nome;n_.dataset.sci=r.sci||"";n_.dataset.n=s?s.n:"";n_.dataset.fonte="Claude";}
    }catch(e){
      const c=e&&e.code; if(c==="cancelled"){box.innerHTML="";return;}
      const msg={not_granted:"Claude non ha il permesso di guardare le foto da questa pagina.",sampling_disabled:"Claude non è disponibile per questo account.",rate_limited:"Troppe richieste in poco tempo. Riprova fra qualche minuto.",
        image_rejected:"Questa foto non va bene, provane un'altra.",refused:"Claude non ha risposto su questa foto.",invalid_json:"La risposta non si legge bene, riprova.",session_expired:"Devi rientrare in Claude."}[c]||"La connessione si è interrotta. Riprova quando c'è rete.";
      box.innerHTML=`<h3>Claude</h3><p class="attesa">${msg}</p>${["not_granted","sampling_disabled","images_unavailable","not_declared"].includes(c)?"":`<p><button class="btn secondario" id="ricRiprova">Riprova</button></p>`}`;
      const rb=$("#ricRiprova"); if(rb)rb.onclick=()=>chiediClaude(sample,A);
    }finally{if(RIC.ferma===ctl)RIC.ferma=null;}
  }
  function salvaOsservazione(){
    const u=RIC.ultima; if(!u)return; const n_=$("#ricNome");
    const o={id:Date.now(),t:new Date().toISOString(),nome:(n_.value||"").trim()||"Da riconoscere",sci:n_.dataset.sci||"",n:+(n_.dataset.n||0)||0,fonte:n_.dataset.fonte||"",foto:ridotta(u.img,320).toDataURL("image/jpeg",0.7)};
    const L=leggiOss(); L.unshift(o);
    try{localStorage.setItem("osservazioni",JSON.stringify(L));avviso("Salvata nel diario");$("#ricSalva").textContent="✓ Salvata";$("#ricSalva").disabled=true;}
    catch{avviso("Spazio pieno: cancella qualche osservazione vecchia dal diario",4000);}
  }
}
async function scaricaRiconoscimento(){
  const btn=$("#ricScarica"), barra=$("#ricBarra"), riemp=barra.querySelector("i"); btn.disabled=true; barra.hidden=false;
  const cache=await caches.open("riconosci"); let fatti=0, errori=0;
  for(const f of RIC_FILE){const u=RIC_DIR+f;try{if(!(await cache.match(u))){let r=await fetch(u);if(!r.ok&&f.endsWith(".tflite")){const u2=u.replace(".tflite",".b64.json");r=await fetch(u2);if(r.ok){await cache.put(u2,r.clone());r=null;}}if(r&&r.ok)await cache.put(u,r.clone());else if(r)errori++;}}catch{errori++;}fatti++;riemp.style.width=(100*fatti/RIC_FILE.length)+"%";btn.textContent=`Scarico ${fatti} di ${RIC_FILE.length}…`;}
  barra.hidden=true; btn.disabled=false;
  if(!errori){localStorage.setItem("off:riconosci",new Date().toISOString());btn.textContent="✓ Riconoscimento disponibile senza rete";avviso("Riconoscimento pronto anche senza rete",3000);}
  else{btn.textContent="⬇ Riprova il download";avviso("Download non completo, riprova con una rete migliore",4000);}
}
function leggiOss(){try{return JSON.parse(localStorage.getItem("osservazioni")||"[]");}catch{return [];}}

/* ---------- diario: osservazioni e diari dei cammini ---------- */
async function vistaDiario(){
  await sicurezza(); colora(null); ponParte("#6A3D7A"); document.querySelector('meta[name=theme-color]').content="#6A3D7A"; titolo.textContent="Diario";
  const O=leggiOss(); const conDiario=IDX.cammini.filter(c=>localStorage.getItem("diario:"+c.chiave)); const scar=IDX.cammini.filter(c=>localStorage.getItem("off:"+c.chiave));
  const data=t=>new Date(t).toLocaleDateString("it-IT",{day:"numeric",month:"short",year:"numeric"});
  pagina.innerHTML=`<div class="tiles">
    <a class="tile" href="#oss"><b>Osservazioni</b><small>${O.length} ${O.length===1?"salvata":"salvate"}</small></a>
    <a class="tile" href="#dia"><b>Diari dei cammini</b><small>${conDiario.length} ${conDiario.length===1?"iniziato":"iniziati"}</small></a>
    <a class="tile" href="#/miei"><b>Il mio storico</b><small>${Object.keys(leggiPiani()).length} in programma, ${leggiStorico().length} fatti</small></a>
    <a class="tile" href="#/esperienza"><b>La mia esperienza</b><small>livello ${mioLivello()}, ${plur(leggiUscite().length,"uscita","uscite")}</small></a>
    <a class="tile" href="#/riconosci"><b>◉ Nuova osservazione</b><small>scatta e riconosci</small></a>
    <a class="tile" href="#/filtro/scaricati"><b>Sul telefono</b><small>${scar.length} ${scar.length===1?"cammino scaricato":"cammini scaricati"}</small></a></div>
  <h2 class="sez" id="oss">Le mie osservazioni</h2>
  ${O.length?`<div class="specie oss">${O.map(o=>`<div class="card-oss"><a ${o.n?`href="#/atlante/${o.n}"`:""}><div class="img" style="background-image:url(${o.foto})"></div><div class="nomi"><b>${esc(o.nome)}</b>${o.sci?`<i>${esc(o.sci)}</i>`:""}<small>${data(o.t)}${o.fonte?` · ${esc(o.fonte)}`:""}</small></div></a><button class="via" data-id="${o.id}" aria-label="Cancella">×</button></div>`).join("")}</div>`:`<p class="vuoto-p">Ancora nessuna. In <a href="#/riconosci">Riconosci</a> fotografa una pianta o un insetto e salvalo qui.</p>`}
  <h2 class="sez" id="dia">Diari dei cammini</h2>
  ${conDiario.length?`<ul class="lista con-foto">${conDiario.map(c=>rigaCammino(c,true).replace(`href="#/cammino/${c.chiave}"`,`href="#/cammino/${c.chiave}/diario"`)).join("")}</ul>`:`<p class="vuoto-p">Ogni cammino ha un diario da compilare: apri il cammino e tocca Diario in basso.</p>`}`;
  pagina.querySelectorAll('.tiles a[href^="#oss"],.tiles a[href^="#dia"]').forEach(a=>a.onclick=e=>{e.preventDefault();$(a.getAttribute("href")).scrollIntoView({behavior:"smooth"});});
  // cancellare chiede un secondo tocco: niente finestre di conferma, che dentro Claude non si aprono
  pagina.querySelectorAll(".via").forEach(b=>b.onclick=()=>{if(!b.classList.contains("conferma")){b.classList.add("conferma");b.textContent="Cancella";setTimeout(()=>{b.classList.remove("conferma");b.textContent="×";},3000);return;}
    localStorage.setItem("osservazioni",JSON.stringify(leggiOss().filter(o=>String(o.id)!==b.dataset.id)));vistaDiario();});
}

/* ---------- da solo: passaggi delicati e livelli di esperienza ---------- */
// Le regole dei livelli e i passaggi controllati sono in dati/sicurezza.json; le uscite e le caselle spuntate restano su questo telefono.
let SICUR=null;
async function sicurezza(){if(!SICUR){try{SICUR=await carica("dati/sicurezza.json");}catch{SICUR={cammini:{},livelli:[],tipi:{}};}}return SICUR;}
const SFORZO=0.00792;   // regola di Naismith nella versione di Scarf: 100 m di salita valgono circa 0,8 km in piano
function leggiLS(k,d){try{const v=JSON.parse(localStorage.getItem(k)||"null");return v??d;}catch{return d;}}
function scriviLS(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true;}catch{avviso("Non riesco a salvare su questo telefono");return false;}}
const leggiUscite=()=>leggiLS("uscite",[]);
const leggiEsp=()=>Object.assign({check:{},peso:null,passo:null},leggiLS("esperienza",{}));
const numV=v=>{const n=parseFloat(String(v??"").replace(",","."));return isFinite(n)?n:0;};
const salitaNum=s=>{const m=String(s??"").replace(/(\d)[\s .](?=\d{3}\b)/g,"$1").match(/\d+/);return m?+m[0]:0;};
const puntiU=u=>numV(u.km)+numV(u.salita)*SFORZO;
const alGiorno=u=>{const g=Math.max(1,numV(u.giorni)||1);return {km:numV(u.km)/g,salita:numV(u.salita)/g};};
const lvB=n=>`<span class="lv l${n}" aria-label="livello ${n}">${n}</span>`;
const elencoIt=L=>L.length<2?L.join(""):L.slice(0,-1).join(", ")+" e "+L[L.length-1];
function reqOk(r,U,E){
  const bene=u=>u.esito==="bene";
  if(r.tipo==="uscite"){const n=U.filter(u=>(!r.grado||(u.grado===r.grado&&bene(u)))&&(!r.compagnia||u.con===r.compagnia)&&(!(r.km||r.salita)||numV(u.km)>=(r.km||Infinity)||numV(u.salita)>=(r.salita||Infinity))).length;return {ok:n>=r.min,info:`${Math.min(n,r.min)} su ${r.min}`};}
  if(r.tipo==="giornata")return {ok:U.some(u=>{if(!bene(u))return false;const g=alGiorno(u);return r.o?(g.km>=r.km||g.salita>=r.salita):((!r.km||g.km>=r.km)&&(!r.salita||g.salita>=r.salita));})};
  if(r.tipo==="punti"){const p=U.reduce((s,u)=>s+puntiU(u),0);return {ok:p>=r.min,info:`${Math.floor(Math.min(p,r.min))} su ${r.min}`};}
  if(r.tipo==="piu_giorni")return {ok:U.some(u=>numV(u.giorni)>=r.giorni)||leggiStorico().some(h=>h.giorni>=r.giorni)};
  if(r.tipo==="passo")return {ok:!!(E.passo&&E.passo.mh>=r.min),info:E.passo?`ora ${Math.round(E.passo.mh)} m all'ora`:"test da fare"};
  if(r.tipo==="check")return {ok:!!E.check[r.id],check:true};
  return {ok:false};
}
function mioLivello(){const S=SICUR;if(!S||!S.livelli||!S.livelli.length)return 1;const U=leggiUscite(),E=leggiEsp();let n=1;for(const L of S.livelli.slice(1)){if(L.req.every(r=>reqOk(r,U,E).ok))n=L.n;else break;}return n;}
// passo personale in punti all'ora, dalle uscite con le ore segnate (almeno due)
function passoPersonale(U){const V=(U||leggiUscite()).filter(u=>numV(u.ore)>0&&puntiU(u)>0);if(V.length<2)return null;const p=V.reduce((s,u)=>s+puntiU(u),0)/V.reduce((s,u)=>s+numV(u.ore),0);return p>0?p:null;}
const oreIt=h=>{const m=Math.max(15,Math.round(h*60/15)*15);return `${Math.floor(m/60)} h${m%60?" "+String(m%60).padStart(2,"0"):""}`;};
const oreTappa=(km,sal,pace)=>pace&&km?oreIt((km+sal*SFORZO)/pace):"";

// riquadro "Da solo" nella scheda del cammino
function sezioneDaSoli(c){
  const S=SICUR; const r=S&&S.cammini&&S.cammini[c.chiave]; if(!r)return "";
  const L=S.livelli.find(x=>x.n===r.lv)||{nome:""}; const alte=Object.entries(r.tappe||{});
  const per=n=>alte.filter(([,v])=>v.lv===n).map(([t])=>t);
  let sotto="";
  if(r.compagnia)sotto="Da fare in compagnia di persone esperte.";
  else if(alte.length)sotto=cap1([5,4].filter(n=>per(n).length).map(n=>`livello ${n} per ${per(n).length>1?"le tappe "+elencoIt(per(n)):"la tappa "+per(n)[0]}`).join(", "))+`. Il resto è livello ${r.base}.`+(per(5).length?" Il livello 5 si fa solo in compagnia.":"");
  const U=leggiUscite(), mio=mioLivello();
  const tuo=!U.length?"Segna le tue uscite per sapere se fa per te.":mio>=r.lv?`Il tuo livello è ${mio}. Questo cammino è alla tua portata.`:mio>=r.base?`Il tuo livello è ${mio}. Alcune tappe sono sopra il tuo livello.`:`Il tuo livello è ${mio}. Per ora questo cammino è sopra il tuo livello.`;
  const P=r.pass||[];
  const stato=p=>p.ds==="no"?(p.tipo==="chiuso"?"chiuso, c'è un'alternativa":p.tipo==="traffico"?"da evitare a piedi":p.chiarire?"da chiarire prima di partire":p.evita?"non da solo, c'è una variante":"non da solo"):p.ds==="sì"?"fattibile":"con cautela";
  const passH=P.map(p=>{const no=p.ds==="no";return `<details class="pass${no?" no":""}"><summary><span class="ptipo">${no?"⚠ ":""}${esc((S.tipi[p.tipo]||{nome:p.tipo}).nome)}</span><b>${p.t?`Tappa ${esc(p.t)} · `:""}${esc(p.luogo)}</b><small>${stato(p)}</small></summary><p>${esc(p.testo)}</p>${p.var?`<p class="var"><b>Varianti.</b> ${esc(p.var)}</p>`:""}${fonti(p.fonti)}</details>`;}).join("");
  const nota=r.ver?(P.length?"Passaggi controllati sulle fonti a ottobre 2026. Le chiusure cambiano, prima di partire guarda il sito del cammino.":"Le fonti delle tappe non segnalano passaggi esposti o attrezzati."):"Livello ricavato dalla difficoltà. I passaggi delicati di questo cammino non sono ancora stati controllati.";
  return `<section class="blocco dasoli"><h3>Da solo</h3>
   <div class="lv-riga">${lvB(r.lv)}<div><b>Livello ${r.lv} · ${esc(L.nome)}</b>${sotto?`<small>${esc(sotto)}</small>`:""}</div></div>
   ${alte.filter(([,v])=>v.nota).map(([t,v])=>`<p class="lv-nota">Tappa ${esc(t)}. ${esc(v.nota)}</p>`).join("")}
   <p class="tuo">${esc(tuo)} <a href="#/esperienza">La mia esperienza ›</a></p>
   ${r.giudizio?`<p>${esc(r.giudizio)}</p>`:""}
   ${P.length?`<div class="passaggi">${passH}</div>`:""}
   <p class="fonti">${nota}</p></section>`;
}
// segni sulle tappe: livello più alto del resto del cammino e passaggi da non fare da soli
function segniTappa(c,n){
  const S=SICUR; const r=S&&S.cammini&&S.cammini[c.chiave]; if(!r)return {chip:"",nota:""};
  const s=String(n), v=(r.tappe||{})[s];
  const NO=(r.pass||[]).filter(p=>p.t===s&&p.ds==="no"&&p.tipo!=="chiuso"&&p.tipo!=="traffico");
  const tipi=[...new Set(NO.filter(p=>!p.evita).map(p=>p.tipo))], conVar=NO.some(p=>p.evita);
  const chip=(v?` <span class="chip lvc">liv. ${v.lv}</span>`:"")+tipi.map(t=>` <span class="chip no">⚠ ${esc((S.tipi[t]||{nome:t}).nome)}</span>`).join("")+(conVar&&!tipi.length?` <span class="chip var">⚠ con variante</span>`:"");
  const nota=v?`<p class="espo"><b>Livello ${v.lv}.</b> ${esc(v.perche||"")}${v.nota?" "+esc(v.nota):""}${NO.length?" I passaggi sono descritti nel riquadro Da solo.":""}</p>`:NO.length?`<p class="espo">Qui c'è un passaggio da non fare da soli, descritto nel riquadro Da solo con le varianti.</p>`:"";
  return {chip,nota};
}

async function vistaEsperienza(sub){
  const S=await sicurezza(); colora(null); ponParte("#6A3D7A"); document.querySelector('meta[name=theme-color]').content="#6A3D7A";
  if(sub==="nuova")return formUscita(S);
  if(sub==="regole")return regoleLivelli(S);
  titolo.textContent="La mia esperienza";
  const U=leggiUscite(), E=leggiEsp(), n=mioLivello(), L=S.livelli.find(x=>x.n===n)||{nome:"",da_solo:""}, Lp=S.livelli.find(x=>x.n===n+1);
  const pt=U.reduce((s,u)=>s+puntiU(u),0), pace=passoPersonale(U);
  const st=Lp?Lp.req.map(r=>[r,reqOk(r,U,E)]):[]; const fatti_=st.filter(([,s])=>s.ok).length;
  const reqH=st.map(([r,s])=>`<li class="${s.ok?"ok":""}">${s.check?`<label><input type="checkbox" data-c="${esc(r.id)}" ${s.ok?"checked":""}><span>${esc(r.testo)}</span></label>`:`<span class="seg">${s.ok?"✓":"○"}</span><span>${esc(r.testo)}${s.info&&!s.ok?` <small>${esc(s.info)}</small>`:""}</span>`}</li>`).join("");
  const data=t=>new Date(t).toLocaleDateString("it-IT",{day:"numeric",month:"short",year:"numeric"});
  const CON={solo:"da solo",amici:"con amici",esperti:"con persone esperte"}, ESITO={bene:"bene",faticosa:"faticosa",troppo:"troppo dura"};
  const usc=[...U].sort((a,b)=>String(b.data).localeCompare(String(a.data))).map(u=>`<li><div><b>${esc(u.nome||"Uscita")}</b><small>${esc(data(u.data||u.id))}${numV(u.giorni)>1?` · ${numV(u.giorni)} giorni`:""}</small><small>${[numV(u.km)?numIt(numV(u.km))+" km":"",numV(u.salita)?"↑ "+String(Math.round(numV(u.salita))).replace(/\B(?=(\d{3})+(?!\d))/g,"\u202f")+" m":"",u.grado?u.grado:"",CON[u.con]||"",ESITO[u.esito]||""].filter(Boolean).join(" · ")}${u.esposto?" · tratti esposti":""}${u.neve?" · neve":""}</small></div><span class="pt">${Math.round(puntiU(u))}<small>punti</small></span><button class="via" data-id="${esc(u.id)}" aria-label="Cancella">×</button></li>`).join("");
  const peso=numV(E.peso);
  const zainoH=S.zaino?`<table class="breve zaino-t">${S.zaino.fonti.map(f=>`<tr><th>${f.da===f.a?f.da:f.da+"-"+f.a}%</th><td>${esc(f.chi)}${peso?` <b>${f.da===f.a?numIt(peso*f.da/100):numIt(peso*f.da/100)+"-"+numIt(peso*f.a/100)} kg</b>`:""}</td></tr>`).join("")}</table>`:"";
  const tp=E.passo; const tpTesto=tp?`${Math.round(tp.mh)} m all'ora, il ${esc(data(tp.t))}. ${esc(tp.mh>=300?S.passo.sopra:S.passo.sotto)}`:"";
  pagina.innerHTML=`<section class="blocco liv-card"><div class="lv-riga grande">${lvB(n)}<div><small>IL TUO LIVELLO</small><b>${esc(L.nome)}</b></div></div>
    <p>${esc(L.da_solo)}</p>
    ${Lp?`<h4 class="sotto">Per il livello ${Lp.n}, ${esc(Lp.nome.toLowerCase())}</h4><div class="barra-l"><i style="width:${Math.round(100*fatti_/Math.max(1,st.length))}%"></i></div><ul class="req">${reqH}</ul>`:`<p class="fonti">È l'ultimo livello. I passaggi esposti restano da fare in compagnia.</p>`}
    <p class="fonti"><a href="#/esperienza/regole">Come funzionano i livelli ›</a></p></section>
  <div class="fatti"><div><small>Punti</small><b>${Math.round(pt)}</b></div><div><small>Uscite</small><b>${U.length}</b></div><div><small>Salita</small><b>${tp?Math.round(tp.mh):"…"}<small> m/h</small></b></div><div><small>Passo</small><b>${pace?numIt(pace):"…"}</b><span>punti all'ora</span></div></div>
  <div class="bottoni" style="margin-top:12px"><a class="btn largo" href="#/esperienza/nuova">+ Aggiungi un'uscita</a></div>
  ${pace?`<section class="blocco diario"><h3>Le tue ore</h3><p>Con il tuo passo, soste escluse.</p><div class="due"><div><label>KM</label><input id="cKm" inputmode="decimal" value="15"></div><div><label>SALITA (M)</label><input id="cSal" inputmode="numeric" value="600"></div></div><p class="ore-r" id="cOre"></p><p class="fonti">${esc(S.passo.ore)}</p></section>`:""}
  <details class="blocco altre diario" id="test" ${tp?"":"open"}><summary><h3>Test del passo in salita</h3><span class="ic">›</span></summary><p>${esc(S.passo.test)}</p>
    <div class="due"><div><label>SALITA (M)</label><input id="tpS" inputmode="numeric"></div><div><label>MINUTI SENZA SOSTE</label><input id="tpM" inputmode="numeric"></div></div>
    <div class="bottoni" style="margin:10px 0 0"><button class="btn" id="tpOk">Salva il test</button></div>${tp?`<p class="ore-r">${tpTesto}</p>`:""}<p class="fonti">${esc(S.passo.studio)}</p></details>
  <details class="blocco altre diario"><summary><h3>Lo zaino</h3><span class="ic">›</span></summary><p>${esc(S.zaino.testo)}</p>
    <div class="due"><div><label>IL TUO PESO (KG)</label><input id="peso" inputmode="decimal" value="${peso||""}"></div><div></div></div>${zainoH}
    <p>${esc(S.zaino.oshea)}</p><p><b>${esc(S.zaino.regola)}</b></p></details>
  <h2 class="sez">Le mie uscite</h2>
  ${U.length?`<ul class="uscite">${usc}</ul><p class="vuoto-p">Le uscite restano su questo telefono. <button class="btn secondario" id="copiaU" style="padding:6px 10px">Copia le uscite</button></p>`:`<p class="vuoto-p">Ancora nessuna. Ogni escursione e ogni cammino contano, anche quelli fatti prima di oggi.</p>`}`;
  pagina.querySelectorAll("input[data-c]").forEach(i=>i.onchange=()=>{const e=leggiEsp();e.check[i.dataset.c]=i.checked;scriviLS("esperienza",e);const y=window.scrollY;vistaEsperienza();window.scrollTo(0,y);});
  const pz=$("#peso"); if(pz)pz.onchange=()=>{const e=leggiEsp();e.peso=numV(pz.value)||null;scriviLS("esperienza",e);const y=window.scrollY;vistaEsperienza().then(()=>{window.scrollTo(0,y);const d=pagina.querySelectorAll("details")[1];if(d)d.open=true;});};
  $("#tpOk").onclick=()=>{const s=numV($("#tpS").value),m=numV($("#tpM").value);if(s<100||m<5){avviso("Scrivi i metri di salita e i minuti");return;}const e=leggiEsp();e.passo={mh:s/(m/60),s,m,t:Date.now()};scriviLS("esperienza",e);vistaEsperienza();};
  const cal=()=>{const o=$("#cOre");if(o)o.textContent=`Circa ${oreTappa(numV($("#cKm").value),numV($("#cSal").value),pace)||"…"} di cammino.`;};
  if(pace){$("#cKm").oninput=cal;$("#cSal").oninput=cal;cal();}
  pagina.querySelectorAll(".via").forEach(b=>b.onclick=()=>{if(!b.classList.contains("conferma")){b.classList.add("conferma");b.textContent="Cancella";setTimeout(()=>{b.classList.remove("conferma");b.textContent="×";},3000);return;}
    scriviLS("uscite",leggiUscite().filter(u=>String(u.id)!==b.dataset.id));vistaEsperienza();});
  const cu=$("#copiaU"); if(cu)cu.onclick=async()=>{const t=U.map(u=>[u.data,u.nome,u.km,u.salita,u.ore,u.giorni,u.grado,CON[u.con],ESITO[u.esito],u.esposto?"esposto":"",u.neve?"neve":"",u.zaino?u.zaino+" kg":""].join("; ")).join("\n");try{await navigator.clipboard.writeText("data; dove; km; salita; ore; giorni; grado; con chi; com'è andata; esposto; neve; zaino\n"+t);avviso("Copiate");}catch{avviso("Non riesco a copiare");}};
}
function formUscita(S){
  titolo.textContent="Nuova uscita";
  let b={}; try{b=JSON.parse(sessionStorage.getItem("bozzaUscita")||"{}");sessionStorage.removeItem("bozzaUscita");}catch{}
  const u=Object.assign({data:new Date().toISOString().slice(0,10),giorni:1,grado:"",con:"solo",esito:"bene",esposto:false,neve:false},b);
  const sc=(k,v,t)=>`<button type="button" class="fchip${u[k]===v?" attivo":""}" data-s="${k}" data-v="${v}">${t}</button>`;
  pagina.innerHTML=`<section class="blocco diario uscita"><h3>Nuova uscita</h3>
   <label>DOVE</label><input data-k="nome" value="${esc(u.nome||"")}" placeholder="Per esempio Monte Gennaro da Palombara">
   <div class="due"><div><label>DATA</label><input type="date" data-k="data" value="${esc(u.data)}"></div><div><label>GIORNI DI FILA</label><input inputmode="numeric" data-k="giorni" value="${esc(u.giorni)}"></div></div>
   <div class="tre"><div><label>KM</label><input inputmode="decimal" data-k="km" value="${esc(u.km??"")}"></div><div><label>SALITA (M)</label><input inputmode="numeric" data-k="salita" value="${esc(u.salita??"")}"></div><div><label>ORE</label><input inputmode="decimal" data-k="ore" value="${esc(u.ore??"")}" placeholder="senza soste"></div></div>
   <p class="fonti">Per più giorni scrivi i totali. Le ore sono quelle di cammino, senza le soste.</p>
   <label>GRADO DEL SENTIERO</label><div class="fc">${sc("grado","T","T")}${sc("grado","E","E")}${sc("grado","EE","EE")}${sc("grado","","non so")}</div>
   <label>CON CHI</label><div class="fc">${sc("con","solo","da solo")}${sc("con","amici","con amici")}${sc("con","esperti","con persone esperte o CAI")}</div>
   <label>COM'È ANDATA</label><div class="fc">${sc("esito","bene","bene, con energie")}${sc("esito","faticosa","faticosa")}${sc("esito","troppo","troppo dura")}</div>
   <label>C'ERANO ANCHE</label><div class="fc"><button type="button" class="fchip${u.esposto?" attivo":""}" data-b="esposto">tratti esposti</button><button type="button" class="fchip${u.neve?" attivo":""}" data-b="neve">neve</button></div>
   <div class="due"><div><label>ZAINO (KG)</label><input inputmode="decimal" data-k="zaino" value="${esc(u.zaino??"")}"></div><div></div></div>
   <div class="bottoni" style="margin:14px 0 0"><button class="btn" id="salvaU">Salva</button><a class="btn secondario" href="#/esperienza">Annulla</a></div></section>`;
  pagina.querySelectorAll("[data-s]").forEach(x=>x.onclick=()=>{u[x.dataset.s]=x.dataset.v;pagina.querySelectorAll(`[data-s="${x.dataset.s}"]`).forEach(y=>y.classList.toggle("attivo",y===x));});
  pagina.querySelectorAll("[data-b]").forEach(x=>x.onclick=()=>{u[x.dataset.b]=!u[x.dataset.b];x.classList.toggle("attivo",u[x.dataset.b]);});
  $("#salvaU").onclick=()=>{pagina.querySelectorAll("[data-k]").forEach(i=>u[i.dataset.k]=i.value.trim());
    const n={...u,id:String(Date.now()),km:numV(u.km),salita:salitaNum(u.salita),ore:numV(u.ore),giorni:Math.max(1,Math.round(numV(u.giorni))||1),zaino:numV(u.zaino)||null};
    if(!n.km&&!n.salita){avviso("Scrivi almeno i km o la salita");return;}
    if(scriviLS("uscite",[...leggiUscite(),n])){avviso("Uscita salvata");location.hash="#/esperienza";}};
}
function regoleLivelli(S){
  titolo.textContent="I livelli";
  const E=leggiEsp(), U=leggiUscite(), peso=numV(E.peso);
  pagina.innerHTML=`<section class="blocco"><h3>Come funzionano</h3><p>Ogni cammino e ogni tappa hanno il livello che serve per farli da soli. Il tuo livello sale con le uscite segnate e le caselle spuntate, e i livelli si sommano.</p><p class="fonti">${esc(S.nota)}</p></section>
  ${S.livelli.map(L=>`<section class="blocco livello"><div class="lv-riga">${lvB(L.n)}<div><b>${esc(L.nome)}</b><small>${esc(L.breve)}</small></div></div><p>${esc(L.da_solo)}</p>${L.req.length?`<h4 class="sotto">Per arrivarci</h4><ul class="req">${L.req.map(r=>{const s=reqOk(r,U,E);return `<li class="${s.ok?"ok":""}"><span class="seg">${s.ok?"✓":"○"}</span><span>${esc(r.testo)}</span></li>`;}).join("")}</ul>`:""}</section>`).join("")}
  <section class="blocco"><h3>Punti e passo</h3><p>${esc(S.passo.punti)}</p><p>${esc(S.passo.test)}</p><p>${esc(S.passo.sopra)}</p><p>${esc(S.passo.sotto)}</p><p class="fonti">${esc(S.passo.studio)}</p></section>
  <section class="blocco"><h3>Da solo, sempre</h3><ul class="punti-k">${S.da_soli.map(x=>`<li>${esc(x.t)} <small class="fonti">${esc(x.f)}</small></li>`).join("")}</ul></section>
  <section class="blocco"><h3>Lo zaino</h3><p>${esc(S.zaino.testo)}</p><table class="breve zaino-t">${S.zaino.fonti.map(f=>`<tr><th>${f.da===f.a?f.da:f.da+"-"+f.a}%</th><td>${esc(f.chi)}${peso?` <b>${f.da===f.a?numIt(peso*f.da/100):numIt(peso*f.da/100)+"-"+numIt(peso*f.a/100)} kg</b>`:""}</td></tr>`).join("")}</table><p>${esc(S.zaino.oshea)}</p><p><b>${esc(S.zaino.regola)}</b></p></section>
  <section class="blocco"><h3>Allenarsi</h3><ul class="punti-k">${S.allenarsi.map(x=>`<li>${esc(x.t)} <small class="fonti">${esc(x.f)}</small></li>`).join("")}</ul></section>
  <section class="blocco"><h3>I passaggi delicati</h3><table class="breve">${Object.values(S.tipi).map(t=>`<tr><th>${esc(t.nome.toUpperCase())}</th><td>${esc(t.testo)}</td></tr>`).join("")}</table></section>
  <details class="blocco altre"><summary><h3>Fonti</h3><span class="ic">›</span></summary><ul class="fonti-l">${S.fonti.map(([t,u])=>`<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a></li>`).join("")}</ul></details>`;
}

/* ---------- organizza un cammino: domande, proposte, piano e storico ---------- */
// piani in localStorage "piani" ({chiave: piano}), cammini fatti in "storico"; le risposte alle domande restano in sessionStorage "org"
const leggiPiani=()=>leggiLS("piani",{}), leggiStorico=()=>leggiLS("storico",[]);
const leggiOrg=()=>{try{return JSON.parse(sessionStorage.getItem("org")||"{}");}catch{return {};}};
const scriviOrg=o=>{try{sessionStorage.setItem("org",JSON.stringify(o));}catch{}};
const oggiISO=()=>new Date().toISOString().slice(0,10);
const mig=n=>String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g,"\u202f");
const dataBreve=s=>s?new Date(s+"T12:00").toLocaleDateString("it-IT",{weekday:"short",day:"numeric",month:"short"}):"";
const dataLunga=s=>s?new Date(s+"T12:00").toLocaleDateString("it-IT",{day:"numeric",month:"long",year:"numeric"}):"";
const piuGiorni=(s,n)=>{const d=new Date(s+"T12:00");d.setDate(d.getDate()+n);return d.toISOString().slice(0,10);};
const quotaNum=c=>{const q=String(c.quota||"");if(/piano/i.test(q))return 0;const m=q.replace(/(\d)\.(?=\d{3}\b)/g,"$1").match(/\d+/);return m?+m[0]:null;};
const ORG_GIORNI=[["1-3","2 o 3 giorni","un fine settimana lungo",g=>g&&g<=3],["4-5","4 o 5 giorni","",g=>g&&g>=4&&g<=5],["6-8","Una settimana","da 6 a 8 giorni",g=>g&&g>=6&&g<=8],["9-15","Due settimane","da 9 a 15 giorni",g=>g&&g>=9&&g<=15],["16+","Di più","oltre 15 giorni",g=>g&&g>15]];
const ORG_QUOTA={bassa:["Pianura e mare","sotto i 600 m",q=>q<600],colline:["Colline","fino a 1 200 m",q=>q<=1200],montagna:["Montagna","sopra i 1 200 m",q=>q>1200]};
const ORG_PASSI=["giorni","mese","dove","conchi","dormire","quota"];

async function vistaOrganizza(sub){
  await sicurezza(); colora(null); titolo.textContent="Organizza un cammino";
  if(sub==="risultati")return risultatiOrganizza();
  const o=leggiOrg(); let i=ORG_PASSI.findIndex(p=>o[p]===undefined); if(i<0)i=0;
  if(sub==="da-capo"){scriviOrg({});location.hash="#/organizza";return;}
  const passo=Number.isInteger(o._p)?o._p:i; const id=ORG_PASSI[passo]; const mOra=new Date().getMonth(); const E=leggiEsp();
  const opz=(v,t,s="",att=false)=>`<button class="opz grande-o${att?" attivo":""}" data-v="${esc(v)}"><b>${t}</b>${s?`<small>${s}</small>`:""}</button>`;
  const DOM={giorni:["Quanti giorni hai?",`<div class="opzioni">${ORG_GIORNI.map(([v,t,s])=>opz(v,t,s,o.giorni===v)).join("")}</div>`],
    mese:["Quando parti?",`<div class="opzioni">${opz(mOra,"Questo mese",MESI_LUNGHI[mOra],o.mese===mOra)}${opz((mOra+1)%12,"Il mese prossimo",MESI_LUNGHI[(mOra+1)%12],o.mese===(mOra+1)%12)}</div><div class="fc mesi-f">${F_MESI.map((m,j)=>`<button class="fchip${o.mese===j?" attivo":""}" data-v="${j}">${m}</button>`).join("")}</div>`],
    dove:["Quanto lontano da casa?",`<div class="opzioni">${opz("vicino","Vicino a casa","partenza entro 150 km in linea d'aria",o.dove==="vicino")}${opz("italia","In Italia","",o.dove==="italia")}${opz("ovunque","Anche all'estero","",o.dove==="ovunque")}</div>
      <p class="org-casa" id="casaP">${E.casa?`Casa è dove l'hai segnata il ${esc(dataLunga(E.casa.d))}. <button class="link" id="casaB">Aggiorna con la posizione di adesso</button>`:`Per "vicino" mi serve sapere dov'è casa. <button class="link" id="casaB">Usa la posizione di adesso</button>`}</p>`],
    conchi:["Con chi vai?",`<div class="opzioni">${opz("solo","Da solo",`solo cammini al tuo livello, ${mioLivello()} o meno`,o.conchi==="solo")}${opz("papa","Con papà","cammini leggeri, in piano o colline dolci",o.conchi==="papa")}${opz("esperti","Con persone esperte",`fino a un livello sopra il tuo`,o.conchi==="esperti")}</div>`],
    dormire:["Come vuoi dormire?",`<div class="opzioni">${opz("tenda","In tenda","quando si può",o.dormire==="tenda")}${opz("poco","Spendendo poco","ostelli, accoglienza, tenda",o.dormire==="poco")}${opz("stanza","Va bene tutto","anche B&B e alberghi",o.dormire==="stanza")}</div>`],
    quota:["Pianura, colline o montagna?",`<div class="opzioni">${Object.entries(ORG_QUOTA).map(([v,[t,s]])=>opz(v,t,s,o.quota===v)).join("")}${opz("tutto","Indifferente","",o.quota==="tutto")}</div>`]};
  const [dom,corpo]=DOM[id];
  pagina.innerHTML=`<div class="org"><div class="org-passi">${ORG_PASSI.map((p,j)=>`<i class="${j<passo?"fatto":j===passo?"ora":""}"></i>`).join("")}</div>
    <p class="org-n">Domanda ${passo+1} di ${ORG_PASSI.length}</p><h2 class="org-dom">${dom}</h2>${corpo}
    <div class="org-nav">${passo?`<button class="btn secondario" id="orgIndietro">‹ Indietro</button>`:`<span></span>`}<button class="link" id="orgSalta">${passo<ORG_PASSI.length-1?"Salta":"Vedi le proposte"} ›</button></div></div>`;
  const avanti=v=>{const n=leggiOrg();n[id]=v;n._p=passo+1;if(passo+1>=ORG_PASSI.length){delete n._p;scriviOrg(n);location.hash="#/organizza/risultati";return;}scriviOrg(n);vistaOrganizza();window.scrollTo(0,0);};
  pagina.querySelectorAll(".org [data-v]").forEach(b=>b.onclick=()=>avanti(id==="mese"?+b.dataset.v:b.dataset.v));
  $("#orgSalta").onclick=()=>avanti(o[id]??null);
  const ind=$("#orgIndietro"); if(ind)ind.onclick=()=>{const n=leggiOrg();n._p=passo-1;scriviOrg(n);vistaOrganizza();};
  const cb=$("#casaB"); if(cb)cb.onclick=async()=>{cb.textContent="Cerco la posizione…";try{const p=await posizione();const e=leggiEsp();e.casa={lat:p.lat,lon:p.lon,d:oggiISO()};scriviLS("esperienza",e);$("#casaP").textContent="Fatto, casa è dove sei adesso.";}catch(e){$("#casaP").textContent=msgPos(e);}};
}
// punteggio dei cammini: i limiti di livello non si allargano mai, giorni, quota e dormire sì se le proposte sono poche
async function risultatiOrganizza(){
  titolo.textContent="Le proposte"; const o=leggiOrg(), E=leggiEsp(), mio=mioLivello(); let dist={};
  if(o.dove==="vicino"&&E.casa){try{const V=await vicini();for(const x of distanze(E.casa,V))dist[x.k]=x.d0??x.d;}catch{}}
  const ita=c=>(c.reg||[]).some(r=>r[0]==="Italia");
  const base=c=>{
    if(o.conchi==="esperti"){if((c.lv||9)>Math.min(5,mio+1))return false;}
    else{if((c.lv||9)>mio||c.esp===2)return false;}
    if(o.conchi==="papa"&&!c.leggero)return false;
    if(o.mese!=null&&!["ottimo","possibile"].includes((c.mesi||[])[o.mese]))return false;
    if(o.dove==="italia"&&!ita(c))return false;
    if(o.dove==="vicino"){if(E.casa){if(!(dist[c.chiave]<=150))return false;}else if(!ita(c))return false;}
    return true;};
  const gi=ORG_GIORNI.findIndex(x=>x[0]===o.giorni);
  const okG=(c,lasco)=>gi<0||ORG_GIORNI.some((x,j)=>Math.abs(j-gi)<=(lasco?1:0)&&x[3](giorniDi(c)));
  const okQ=c=>!o.quota||o.quota==="tutto"||quotaNum(c)==null||ORG_QUOTA[o.quota][2](quotaNum(c));
  const okD=c=>o.dormire==="tenda"?!!(c.dorm&&c.dorm.n&&c.dorm.t>0):o.dormire==="poco"?!!(c.dorm&&c.dorm.n&&c.dorm.e>=c.dorm.n/2):true;
  const prove=[[true,true,false],[false,true,false],[false,false,false],[false,false,true]];
  const qAtt=o.quota&&o.quota!=="tutto", dAtt=o.dormire&&o.dormire!=="stanza";
  let L=[],nota="";
  for(const [q,d,lasco] of prove){L=IDX.cammini.filter(c=>base(c)&&okG(c,lasco)&&(!q||okQ(c))&&(!d||okD(c)));
    const via=[!q&&qAtt?"la quota":"",!d&&dAtt?"come dormire":""].filter(Boolean);
    nota=(via.length?`Ho lasciato perdere ${via.join(" e ")}.`:"")+(lasco&&o.giorni?" Ho allargato i giorni di un passo.":"");
    if(L.length>=3)break;}
  const punti_=c=>{let s=0;const m=o.mese!=null?(c.mesi||[])[o.mese]:null;if(m==="ottimo")s+=3;else if(m==="possibile")s+=1;
    if(okG(c,false))s+=2;if(okQ(c))s+=1;if(okD(c))s+=2;
    if(o.dormire==="tenda"&&c.dorm&&c.dorm.n&&c.dorm.t===c.dorm.n&&(o.mese==null||c.dorm.m[o.mese]!=="n"))s+=2;
    if(c.approfondito)s+=1;if(dist[c.chiave]!=null)s+=Math.max(0,(150-dist[c.chiave])/75);
    if(c.lv===mio&&o.conchi!=="papa")s+=0.5;return s;};
  L.sort((a,b)=>punti_(b)-punti_(a)||((giorniDi(a)||99)-(giorniDi(b)||99)));
  const perche=c=>{const r=[];const m=o.mese!=null?(c.mesi||[])[o.mese]:null;
    if(m)r.push(`${MESI_LUNGHI[o.mese]} ${m==="ottimo"?"ottimo":"possibile"}`);
    if(dist[c.chiave]!=null)r.push(`partenza a ${kmTesto(dist[c.chiave])}`);
    if(c.dorm&&c.dorm.n&&o.dormire==="tenda")r.push(`tenda ${plur(c.dorm.t,"notte","notti")} su ${c.dorm.n}`);
    if(c.dorm&&c.dorm.n&&o.dormire==="poco")r.push(`${plur(c.dorm.e,"notte","notti")} su ${c.dorm.n} senza stanza`);
    r.push(`livello ${c.lv}`);if(c.esp===1)r.push("un passaggio da evitare con la variante");return r.join(" · ");};
  const P=leggiPiani(), top=L.slice(0,6), resto=L.slice(6);
  const riga=c=>`<li class="org-ris">${rigaCammino(c,true).replace(/^<li>/,"").replace(/<\/li>$/,"")}<div class="org-perche"><small>${esc(perche(c))}</small><button class="btn ${P[c.chiave]?"secondario":""}" data-org="${c.chiave}">${P[c.chiave]?"Già nel piano ›":"Organizza ›"}</button></div></li>`;
  const scelte=[o.giorni&&ORG_GIORNI.find(x=>x[0]===o.giorni)?.[1],o.mese!=null&&MESI_LUNGHI[o.mese],o.dove==="vicino"?"vicino a casa":o.dove==="italia"?"in Italia":o.dove==="ovunque"?"anche all'estero":"",o.conchi==="solo"?"da solo":o.conchi==="papa"?"con papà":o.conchi==="esperti"?"con persone esperte":"",o.dormire==="tenda"?"in tenda":o.dormire==="poco"?"spendendo poco":"",o.quota&&o.quota!=="tutto"?ORG_QUOTA[o.quota][0].toLowerCase():""].filter(Boolean);
  pagina.innerHTML=`<section class="blocco org-sintesi"><h3>Le tue risposte</h3><p>${esc(cap1(scelte.join(", ")||"nessuna scelta"))}. Il tuo livello è ${mio}.</p>
    ${o.dove==="vicino"&&!E.casa?`<p class="fonti">Non so dov'è casa, quindi ho tenuto i cammini in Italia.</p>`:""}${nota?`<p class="fonti">Con tutte le scelte c'erano meno di tre cammini. ${nota}</p>`:""}
    <div class="bottoni" style="margin:8px 0 0"><a class="btn secondario" href="#/organizza/da-capo">Rifai le domande</a></div></section>
  ${top.length?`<h2 class="sez">${top.length===1?"Il più adatto":`I ${top.length} più adatti`}</h2><ul class="lista con-foto org-lista">${top.map(riga).join("")}</ul>
    ${resto.length?`<details class="cartella"><summary><span class="ic">▸</span><b>Gli altri</b><small>${plur(resto.length,"cammino","cammini")}</small></summary><ul class="lista con-foto org-lista">${resto.map(riga).join("")}</ul></details>`:""}`
   :`<p class="vuoto-p">Con queste scelte e al tuo livello non c'è nessun cammino. Prova a cambiare i giorni o il mese, oppure segna altre uscite in <a href="#/esperienza">La mia esperienza</a>.</p>`}`;
  pagina.querySelectorAll("[data-org]").forEach(b=>b.onclick=()=>{const k=b.dataset.org;if(!leggiPiani()[k])creaPiano(k,o.mese);location.hash="#/piano/"+k;});
}
function tappePiano(c){
  const TD=c.tappe_descritte||[], buono=v=>v!=null&&v!==""&&!/non trovato/.test(String(v));
  const dalD=n=>TD.find(x=>String(x.n)===String(n))||{};
  if((c.tappe_lista||[]).length)return c.tappe_lista.map(t=>({...t,km:buono(t.km)?t.km:(buono(dalD(t.n).km)?String(dalD(t.n).km):""),salita:buono(t.salita)?t.salita:(buono(dalD(t.n).salita)?String(dalD(t.n).salita):"")}));
  if(TD.length)return TD.map(t=>({n:t.n,da:t.da||"",a:t.a||"",km:buono(t.km)?String(t.km):"",salita:buono(t.salita)?String(t.salita):""}));
  return [{n:1,da:c.partenza,a:c.arrivo,km:String(kmDi(c)||""),salita:""}];
}
function creaPiano(k,mese){
  const c=IDX.cammini.find(x=>x.chiave===k); const P=leggiPiani();
  let partenza="";
  if(mese!=null){const d=new Date();let y=d.getFullYear();if(mese<d.getMonth())y++;const s=new Date(y,mese,1,12);const lun=new Date(Math.max(+s,+d));lun.setDate(lun.getDate()+((6-lun.getDay()+7)%7));if(lun.getMonth()===mese)partenza=lun.toISOString().slice(0,10);}
  P[k]={k,nome:c?c.nome:k,partenza,creato:oggiISO(),check:{},note:""}; scriviLS("piani",P); return P[k];
}
// le cose da fare prima di partire; alcune si spuntano da sole
function cosePiano(c,pi){
  const S=SICUR&&SICUR.cammini[c.chiave]; const E=leggiEsp(); const peso=numV(E.peso);
  const notti=(c.dormire&&c.dormire.notti)||Math.max(0,tappePiano(c).length-1);
  const L=[["notti",notti?`Prenotare le ${notti===1?"notte":notti+" notti"}`:"Prenotare dove dormire","Dove dormire è nella scheda, tappa per tappa."],
    ["mezzi","Andata e ritorno con i mezzi",(c.breve&&c.breve.arrivare)||""],
    ["offline","Salvare il cammino offline","",!!localStorage.getItem("off:"+c.chiave)],
    ["gpx","Mettere il GPX nell'app di navigazione",""],
    ...(S&&(S.pass||[]).some(p=>p.ds==="no")?[["passaggi","Leggere i passaggi delicati e le varianti","Sono nel riquadro Da solo della scheda."]]:[]),
    ["avviso","Dire a qualcuno itinerario, tappe e rientro","Il primo consiglio del Soccorso alpino per chi va da solo."],
    ["georesq","GeoResQ attivo sul telefono",""],
    ["meteo","Guardare il meteo il giorno prima",""],
    ["zaino",`Pesare lo zaino carico${peso?`, intorno a ${numIt(Math.round(peso)/10)} kg con la regola del 10 per cento`:""}`,""]];
  return L.map(([id,t,s,auto])=>({id,t,s,ok:!!(auto||pi.check[id])}));
}
async function vistaPiano(k){
  await sicurezza(); const c=await cammino(k); colora(parteDi(c.sez)); titolo.textContent="Il mio piano";
  const P=leggiPiani(); let pi=P[k]; if(!pi)pi=creaPiano(k,null);
  const T=tappePiano(c);
  const pace=passoPersonale(); const S=SICUR.cammini[k]; const mio=mioLivello();
  const kmTot=T.reduce((s,t)=>s+numV(t.km),0), salTot=T.reduce((s,t)=>s+salitaNum(t.salita),0);
  const mese=pi.partenza?new Date(pi.partenza+"T12:00").getMonth():null, statoM=mese!=null?(c.mesi||[])[mese]:null;
  const dorm=t=>{const d=c.dormire&&(c.dormire.tappe||[]).find(x=>String(x.n)===String(t.n));return d?(d.opzioni.length?d.opzioni.slice(0,3).map(x=>`<span class="tipo-d t-${(x.tipo||"").replace(/\W+/g,"-")}">${esc(TIPO_D[x.tipo]||x.tipo)}</span> ${esc(x.nome||"")}`).join("<br>"):"solo B&B, hotel o agriturismi"):"";};
  const giorni=T.map((t,i)=>{const sv=S&&S.tappe&&S.tappe[String(t.n)];return `<li><div class="g-testa"><b>Giorno ${i+1}</b><small>${pi.partenza?esc(dataBreve(piuGiorni(pi.partenza,i))):""}</small></div>
    <div class="g-corpo"><b>${esc(t.da)} › ${esc(t.a)}</b>${segniTappa(c,t.n).chip}<small>${[numV(t.km)?numIt(numV(t.km))+" km":"",salitaNum(t.salita)?"↑ "+mig(salitaNum(t.salita))+" m":"",pace&&numV(t.km)?"≈ "+oreTappa(numV(t.km),salitaNum(t.salita),pace):""].filter(Boolean).join(" · ")}</small>${i<T.length-1||c.anello?`<small class="g-dorm">${dorm(t)}</small>`:""}</div></li>`;}).join("");
  const cose=cosePiano(c,pi), pronte=cose.filter(x=>x.ok).length;
  const no=S&&(S.pass||[]).filter(p=>p.ds==="no");
  pagina.innerHTML=`<section class="blocco piano-testa"><small>IL MIO PIANO</small><h2>${esc(c.nome)}</h2>
    <div class="due-campi"><label>PARTO IL<input type="date" id="pData" value="${esc(pi.partenza)}"></label><div><small>FINO AL</small><b>${pi.partenza?esc(dataBreve(piuGiorni(pi.partenza,T.length-1))):"…"}</b></div></div>
    <p>${plur(T.length,"giorno","giorni")}, ${numIt(Math.round(kmTot))} km${salTot?`, ${mig(salTot)} m di salita`:""}.${statoM?` ${cap1(MESI_LUNGHI[mese])} è ${statoM==="ottimo"?"un mese ottimo":statoM==="possibile"?"un mese possibile":"un mese da evitare"} per questo cammino.`:""}</p>
    ${S?`<p class="tuo">${lvB(S.lv)} Serve il livello ${S.lv}, il tuo è ${mio}. ${mio>=S.lv?"Va bene.":mio>=S.base?"Alcune tappe sono sopra il tuo livello.":"Per ora è sopra il tuo livello."}</p>`:""}</section>
  ${no&&no.length?`<section class="blocco attenzione"><h3>Da non fare da solo</h3><ul class="punti-k">${no.map(p=>`<li>${p.t?`Tappa ${esc(p.t)}, `:""}${esc(p.luogo)}. ${p.evita?"C'è una variante.":p.chiarire?"Da chiarire prima di partire.":p.tipo==="chiuso"?"Chiuso, c'è un'alternativa.":"Senza variante."}</li>`).join("")}</ul><p class="fonti"><a href="#/cammino/${k}">I dettagli nella scheda ›</a></p></section>`:""}
  <section class="blocco"><h3>Prima di partire · ${pronte} su ${cose.length}</h3><div class="barra-l"><i style="width:${Math.round(100*pronte/cose.length)}%"></i></div>
    <ul class="req">${cose.map(x=>`<li class="${x.ok?"ok":""}"><label><input type="checkbox" data-pc="${x.id}" ${x.ok?"checked":""}><span>${esc(x.t)}${x.s?`<small class="sotto-c">${esc(x.s)}</small>`:""}</span></label></li>`).join("")}</ul>
    <div class="azioni"><button class="btn secondario" id="pOff">${localStorage.getItem("off:"+k)?"✓ Salvato offline":"⬇ Salva offline"}</button><button class="btn secondario" id="pGpx">⇩ GPX</button><a class="btn secondario" href="#/cammino/${k}">Scheda</a></div><div class="barra" id="barra" hidden><i></i></div></section>
  <section class="blocco"><h3>Giorno per giorno</h3><ol class="giorni">${giorni}</ol>${pace?`<p class="fonti">Ore con il tuo passo, soste escluse.</p>`:""}</section>
  <section class="blocco diario"><h3>Note</h3><textarea id="pNote" placeholder="Prenotazioni, orari dei treni, numeri utili">${esc(pi.note||"")}</textarea></section>
  <div class="bottoni"><button class="btn largo" id="pVia">▶ Parto, sono in cammino</button></div>
  <div class="bottoni"><button class="btn secondario" id="pDel">Togli dal piano</button></div>`;
  const salva=f=>{const P2=leggiPiani();if(!P2[k])return;f(P2[k]);scriviLS("piani",P2);};
  $("#pData").onchange=e=>{salva(p=>p.partenza=e.target.value);vistaPiano(k);};
  pagina.querySelectorAll("[data-pc]").forEach(i=>i.onchange=()=>{salva(p=>p.check[i.dataset.pc]=i.checked);const y=window.scrollY;vistaPiano(k).then(()=>window.scrollTo(0,y));});
  $("#pNote").oninput=e=>salva(p=>p.note=e.target.value);
  $("#pOff").onclick=()=>scaricaOffline(c); $("#pGpx").onclick=()=>esportaGpx(c.nome,c.linee,c.chiave+".gpx");
  $("#pVia").onclick=()=>{const st=inCammino();salvaInCammino({k,tappa:null,passo:(st&&st.passo)||4,nome:c.nome,dal:oggiISO()});location.hash="#/oggi";};
  $("#pDel").onclick=e=>{const b=e.currentTarget;if(!b.dataset.ok){b.dataset.ok=1;b.textContent="Tocca di nuovo per togliere";setTimeout(()=>{if(b.isConnected){delete b.dataset.ok;b.textContent="Togli dal piano";}},4000);return;}
    const P2=leggiPiani();delete P2[k];scriviLS("piani",P2);location.hash="#/miei";};
}
// fine del cammino: va nello storico e, se le tappe non sono già nelle uscite, nell'esperienza come uscita di più giorni
function finisciCammino(c,st){
  const T=tappePiano(c);
  const P=leggiPiani(), pi=P[c.chiave]; const dal=(st&&st.dal)||(pi&&pi.partenza&&pi.partenza<=oggiISO()?pi.partenza:"")||oggiISO();
  const km=Math.round(T.reduce((s,t)=>s+numV(t.km),0)*10)/10, sal=T.reduce((s,t)=>s+salitaNum(t.salita),0);
  const giorniF=Math.max(1,Math.round((new Date(oggiISO())-new Date(dal))/864e5)+1);
  const H=leggiStorico(); H.push({k:c.chiave,nome:c.nome,dal,al:oggiISO(),giorni:Math.max(giorniF,T.length),tappe:T.length,km,salita:sal}); scriviLS("storico",H);
  if(pi){delete P[c.chiave];scriviLS("piani",P);}
  const giaTappe=leggiUscite().some(u=>u.cammino===c.chiave&&String(u.data)>=dal);
  if(giaTappe){avviso("Cammino nello storico, le tappe sono già nelle tue uscite",3500);location.hash="#/miei";return;}
  try{sessionStorage.setItem("bozzaUscita",JSON.stringify({nome:c.nome,data:dal,km,salita:sal,giorni:Math.max(giorniF,T.length),cammino:c.chiave}));}catch{}
  location.hash="#/esperienza/nuova";
}
function vistaMiei(){
  colora(null); ponParte("#6A3D7A"); document.querySelector('meta[name=theme-color]').content="#6A3D7A"; titolo.textContent="Il mio storico";
  const P=Object.values(leggiPiani()).sort((a,b)=>(a.partenza||"9999").localeCompare(b.partenza||"9999")), H=[...leggiStorico()].sort((a,b)=>String(b.dal).localeCompare(String(a.dal)));
  const fotoK=k=>{const c=IDX.cammini.find(x=>x.chiave===k);return c&&(c.mini||c.foto);};
  pagina.innerHTML=`<div class="bottoni" style="margin-top:12px"><a class="btn largo" href="#/organizza">+ Organizza un cammino</a></div>
  <h2 class="sez">In programma</h2>
  ${P.length?`<ul class="lista con-foto">${P.map(p=>`<li><a href="#/piano/${p.k}"><span class="foto" style="${fotoK(p.k)?`background-image:url(${fotoK(p.k)})`:""}"></span><span class="t"><b>${esc(p.nome)}</b><small>${p.partenza?`parto il ${esc(dataLunga(p.partenza))}`:"data da decidere"}</small><small class="dati">${Object.values(p.check||{}).filter(Boolean).length} cose pronte</small></span><span class="freccia">›</span></a></li>`).join("")}</ul>`:`<p class="vuoto-p">Nessun cammino in programma.</p>`}
  <h2 class="sez">Fatti</h2>
  ${H.length?`<ul class="lista con-foto">${H.map(h=>`<li><a href="#/cammino/${h.k}"><span class="foto" style="${fotoK(h.k)?`background-image:url(${fotoK(h.k)})`:""}"></span><span class="t"><b>${esc(h.nome)}</b><small>${esc(dataLunga(h.dal))}${h.al&&h.al!==h.dal?` - ${esc(dataLunga(h.al))}`:""}</small><small class="dati">${[h.km?numIt(h.km)+" km":"",h.salita?"↑ "+mig(h.salita)+" m":"",plur(h.giorni,"giorno","giorni")].filter(Boolean).join(" · ")}</small></span><span class="freccia">›</span></a></li>`).join("")}</ul>`:`<p class="vuoto-p">Quando finisci un cammino con Sono in cammino, finisce qui con le date.</p>`}
  <p class="vuoto-p"><a href="#/esperienza">La mia esperienza ›</a></p>`;
}

/* ---------- cammini: home, dove, trova, cerca, vicino a me, come nel libro ---------- */
const MESI_LUNGHI=["gennaio","febbraio","marzo","aprile","maggio","giugno","luglio","agosto","settembre","ottobre","novembre","dicembre"];
const enc=s=>encodeURIComponent(s), plur=(n,a,b)=>`${n} ${n===1?a:b}`;
function paesiDi(){const M=new Map();for(const c of IDX.cammini)for(const [pa,re] of (c.reg||[])){if(!M.has(pa))M.set(pa,new Map());const R=M.get(pa);if(!R.has(re))R.set(re,new Set());R.get(re).add(c.chiave);}return M;}
function camminiDelPaese(pa){return IDX.cammini.filter(c=>(c.reg||[]).some(x=>x[0]===pa));}
function vistaHome(){
  colora(null); titolo.textContent="I miei cammini";
  const m=miei(), M=paesiDi(), mOra=new Date().getMonth();
  const nReg=[...M.values()].reduce((a,R)=>a+[...R.keys()].filter(Boolean).length,0);
  const fotoDi=f=>(IDX.cammini.find(f)||{}).foto;
  const buoni=IDX.cammini.filter(c=>(c.mesi||[])[mOra]==="ottimo").sort((a,b)=>(giorniDi(a)||99)-(giorniDi(b)||99)).slice(0,10);
  const mieiHtml=m.length?`<h2 class="sez">I tuoi cammini</h2><div class="striscia">${m.map(c=>`<a class="mini" href="#/cammino/${c.chiave}" style="${(c.mini||c.foto)?`background-image:url(${c.mini||c.foto})`:""}"><b>${esc(c.nome)}</b><small>${localStorage.getItem("rec:"+c.chiave)?"traccia registrata":localStorage.getItem("off:"+c.chiave)?"disponibile offline":"diario iniziato"}</small></a>`).join("")}</div>`:"";
  const ic=inCammino(); const icHtml=ic&&IDX.cammini.some(c=>c.chiave===ic.k)?`<div class="tiles"><a class="tile largo in-cam" href="#/oggi"><b>▶ Sono in cammino</b><small>${esc(ic.nome||"")}${ic.tappa!=null?`, tappa ${esc(ic.tappa)}${ic.a?` verso ${esc(ic.a)}`:""}`:""}</small></a></div>`:"";
  const PI=Object.values(leggiPiani()).sort((a,b)=>(a.partenza||"9999").localeCompare(b.partenza||"9999")); const pr=PI.find(p=>!p.partenza||p.partenza>=oggiISO())||PI[0];
  const gg=pr&&pr.partenza?Math.round((new Date(pr.partenza+"T12:00")-new Date(oggiISO()+"T12:00"))/864e5):null;
  const orgHtml=ic?"":pr?`<div class="tiles"><a class="tile largo piano-home" href="#/piano/${pr.k}"><small>IL TUO PROSSIMO CAMMINO</small><b>${esc(pr.nome)}</b><small>${pr.partenza?(gg>1?`parti tra ${gg} giorni, ${esc(dataBreve(pr.partenza))}`:gg===1?"parti domani":gg===0?"parti oggi":`partenza segnata il ${esc(dataBreve(pr.partenza))}`):"data da decidere"}</small></a></div>`
    :sessionStorage.getItem("orgNo")?"":`<div class="org-home"><b>Vuoi organizzare un cammino?</b><p>Ti faccio qualche domanda e ti propongo i più adatti a te, al tuo livello.</p><div class="bottoni"><a class="btn" href="#/organizza">Sì, cominciamo</a><button class="btn secondario" id="nonOra">Non ora</button></div></div>`;
  pagina.innerHTML=`${icHtml}${orgHtml}<a class="cerca-home" href="#/cerca">⌕ Cerca un cammino, un paese, una regione</a>
  <div class="tiles tiles-grandi">
   ${tileFoto("#/dove","Dove",M.size>1?`${plur(M.size,"paese","paesi")}, ${plur(nReg,"regione","regioni")}`:plur(nReg,"regione","regioni"),fotoDi(c=>c.chiave==="lazio_16")||fotoDi(c=>c.foto))}
   ${tileFoto("#/trova","Trova il cammino adatto","giorni, mese, tenda, fatica",fotoDi(c=>c.chiave==="lazio_09")||fotoDi(c=>c.foto&&c.livello===1))}
  </div>
  <div class="tiles">
   <a class="tile" href="#/vicino"><b>◎ Vicino a me</b><small>i cammini più vicini a dove sei</small></a>
   <a class="tile" href="#/libro"><b>▤ Come nel libro</b><small>${plur(IDX.capitoli.length,"capitolo","capitoli")}, ${plur(IDX.cammini.length,"cammino","cammini")}</small></a>
  </div>
  ${mieiHtml}
  ${buoni.length?`<h2 class="sez">Belli a ${MESI_LUNGHI[mOra]}</h2><div class="striscia">${buoni.map(c=>`<a class="mini" href="#/cammino/${c.chiave}" style="${(c.mini||c.foto)?`background-image:url(${c.mini||c.foto})`:""}"><b>${esc(c.nome)}</b><small>${[giorniDi(c)?plur(giorniDi(c),"giorno","giorni"):"",LIV[c.livello]].filter(Boolean).join(", ")}</small></a>`).join("")}</div>`:""}
  <p class="nota-home" id="nh">Ogni cammino ha tappe, mappa con punti utili e acqua, dove dormire, natura, storia e un diario. <a href="#/info">Come funziona, offline e crediti</a></p>`;
  const no=$("#nonOra"); if(no)no.onclick=()=>{try{sessionStorage.setItem("orgNo","1");}catch{}const d=pagina.querySelector(".org-home");if(d)d.remove();};
}
function vistaLibro(){
  colora(null); titolo.textContent="Come nel libro";
  const parti=IDX.parti.filter(p=>IDX.capitoli.some(c=>c.parte===p.id));
  pagina.innerHTML=`<p class="intro-lista">I capitoli come nel libro, con gli stessi numeri.</p>`+parti.map(p=>(parti.length>1?`<h2 class="sez" style="color:${p.testo||p.colore}">${esc(p.nome)}</h2>`:"")+`<div class="griglia-cap">${IDX.capitoli.filter(c=>c.parte===p.id).map(cardCapitolo).join("")}</div>`).join("");
}
function listaPerDurata(cs,chiave){
  cs=[...cs].sort((a,b)=>(giorniDi(a)||999)-(giorniDi(b)||999)||a.nome.localeCompare(b.nome,"it"));
  const gruppi=CARTELLE.map(([n,t])=>[n,cs.filter(c=>t(giorniDi(c)))]).filter(g=>g[1].length);
  if(gruppi.length<2||cs.length<7)return `<ul class="lista con-foto">${cs.map(c=>rigaCammino(c,true)).join("")}</ul>`;
  return gruppi.map(([n,L_])=>`<details class="cartella" open><summary><span class="ic">▸</span><b>${n}</b><small>${plur(L_.length,"cammino","cammini")}</small></summary><ul class="lista con-foto">${L_.map(c=>rigaCammino(c,true)).join("")}</ul></details>`).join("");
}
function vistaDove(pa,re){
  colora(null); const M=paesiDi();
  if(!pa&&M.size===1)pa=[...M.keys()][0];
  if(!pa){
    titolo.textContent="Dove";
    pagina.innerHTML=`<p class="intro-lista">Scegli il paese, poi la regione. Un cammino che attraversa più regioni compare in ognuna.</p><div class="tiles tiles-grandi">${[...M.entries()].sort((a,b)=>b[1].size-a[1].size||a[0].localeCompare(b[0],"it")).map(([p_,R])=>{const cs=camminiDelPaese(p_);return tileFoto(`#/dove/${enc(p_)}`,esc(p_),`${plur(cs.length,"cammino","cammini")}${R.size>1?`, ${plur([...R.keys()].filter(Boolean).length,"regione","regioni")}`:""}`,(cs.find(c=>c.foto)||{}).foto);}).join("")}</div>`;
    return;
  }
  const R=M.get(pa); if(!R){location.hash="#/dove";return;}
  if(!re){
    const cs=camminiDelPaese(pa); titolo.textContent=pa;
    const regs=[...R.entries()].filter(([r])=>r).sort((a,b)=>a[0].localeCompare(b[0],"it"));
    if(!regs.length){pagina.innerHTML=listaPerDurata(cs);return;}
    const multi=cs.filter(c=>new Set((c.reg||[]).map(x=>x[0])).size>1);
    pagina.innerHTML=`<p class="intro-lista">${plur(cs.length,"cammino","cammini")} in ${esc(pa)}. Scegli la regione.</p><div class="tiles">${regs.map(([r,S])=>`<a class="tile" href="#/dove/${enc(pa)}/${enc(r)}"><b>${esc(r)}</b><small>${plur(S.size,"cammino","cammini")}</small></a>`).join("")}</div>
    ${multi.length?`<h2 class="sez">Passano anche da altri paesi</h2><ul class="lista con-foto">${multi.map(c=>rigaCammino(c,true)).join("")}</ul>`:""}`;
    return;
  }
  titolo.textContent=re; const S=R.get(re)||new Set(); const cs=IDX.cammini.filter(c=>S.has(c.chiave));
  const solo=cs.filter(c=>(c.reg||[]).length===1), anche=cs.filter(c=>(c.reg||[]).length>1);
  pagina.innerHTML=`${solo.length?`<h2 class="sez">Tutti in ${esc(re)}</h2>${listaPerDurata(solo)}`:""}
  ${anche.length?`<h2 class="sez">Passano anche da qui</h2><p class="intro-lista">Cammini che attraversano ${esc(re)} e altre regioni.</p><ul class="lista con-foto">${anche.sort((a,b)=>(giorniDi(a)||999)-(giorniDi(b)||999)).map(c=>rigaCammino(c,true).replace("</small><small class=\"dati\">",` · ${esc((c.reg||[]).map(x=>x[1]||x[0]).join(", "))}</small><small class="dati">`)).join("")}</ul>`:""}`;
}
async function vistaTrova(){
  await sicurezza(); colora(null); titolo.textContent="Trova il cammino adatto";
  const f=Object.assign({},FILTRI_VUOTI,leggiFiltri()); const mOra=new Date().getMonth();
  const salva=()=>{try{sessionStorage.setItem("filtri",JSON.stringify(f));}catch{}};
  const opz=(g,v,t,att,sotto="")=>`<button class="opz${att?" attivo":""}" data-g="${g}" data-v="${esc(v)}"><b>${t}</b>${sotto?`<small>${sotto}</small>`:""}</button>`;
  const disegna=()=>{
    pagina.innerHTML=`<section class="domanda"><h3>Quanti giorni hai?</h3><div class="opzioni">${F_DURATA.map(([v,t])=>opz("durata",v,cap1(t),f.durata.includes(v))).join("")}</div></section>
    <section class="domanda"><h3>Quando parti?</h3><div class="opzioni">${opz("mese",mOra,"Adesso",f.mese===mOra,MESI_LUNGHI[mOra])}${opz("mese",(mOra+1)%12,"Il mese prossimo",f.mese===(mOra+1)%12,MESI_LUNGHI[(mOra+1)%12])}</div>
     <div class="fc mesi-f">${F_MESI.map((m,i)=>`<button class="fchip${f.mese===i?" attivo":""}" data-g="mese" data-v="${i}">${m}</button>`).join("")}</div></section>
    <section class="domanda"><h3>Dove vuoi dormire?</h3><div class="opzioni">${opz("tenda",1,"In tenda tutte le notti",f.tenda,"campeggi, aree tenda, rifugi")}${opz("econ",1,"Spendendo poco",f.econ,"al massimo una notte in stanza")}</div></section>
    <section class="domanda"><h3>Quanta fatica?</h3><div class="opzioni">${[1,2,3].map(l=>opz("livello",l,`<span class="dot l${l}">${l}</span> ${cap1(LIV[l])}`,f.livello.includes(l))).join("")}</div></section>
    <section class="domanda"><h3>Da solo</h3><div class="opzioni">${opz("esposti",1,"Senza passaggi esposti",f.esposti,"o evitabili con una variante")}${opz("mio",1,"Adatti al mio livello",f.mio,`livello ${mioLivello()} o meno`)}</div></section>
    <section class="domanda"><h3>Altro</h3><div class="opzioni">${opz("anello",1,"Ad anello",f.anello,"si torna al punto di partenza")}${opz("papa",1,'<span class="cuore">♥</span> Per papà',f.papa,"leggeri, senza tratti difficili")}</div></section>
    <div id="risT"></div>`;
    pagina.querySelectorAll("[data-g]").forEach(b=>b.onclick=()=>{const g=b.dataset.g,v=b.dataset.v;
      if(g==="durata"){const i=f.durata.indexOf(v);i<0?f.durata.push(v):f.durata.splice(i,1);}
      else if(g==="livello"){const n=+v,i=f.livello.indexOf(n);i<0?f.livello.push(n):f.livello.splice(i,1);}
      else if(g==="mese"){f.mese=f.mese===+v?null:+v;}
      else f[g]=!f[g];
      salva();const y=window.scrollY;disegna();window.scrollTo(0,y);});
    risultati();};
  const risultati=()=>{
    const L=IDX.cammini.filter(c=>passaFiltri(c,f)).sort((a,b)=>(f.mese!==null?((a.mesi[f.mese]==="ottimo"?0:1)-(b.mesi[f.mese]==="ottimo"?0:1)):0)||((giorniDi(a)||99)-(giorniDi(b)||99)));
    const attivi=f.durata.length+f.livello.length+(f.mese!==null)+f.papa+f.anello+f.tenda+f.econ+f.esposti+f.mio;
    $("#risT").innerHTML=`<div class="ris-testa"><h2 class="sez" style="margin:0">${attivi?(L.length?`${plur(L.length,"cammino fa","cammini fanno")} per te`:"Nessun cammino con tutte queste scelte"):`Tutti i ${L.length} cammini`}</h2>${attivi?`<button class="btn secondario" id="azzeraT">Ricomincia</button>`:""}</div>
      ${L.length?`<ul class="lista con-foto">${L.map(c=>rigaCammino(c,true)).join("")}</ul>`:`<p class="vuoto-p">Prova a togliere una scelta.</p>`}`;
    const az=$("#azzeraT"); if(az)az.onclick=()=>{Object.assign(f,FILTRI_VUOTI,{durata:[],livello:[]});salva();disegna();window.scrollTo(0,0);};
    let bv=$("#vediT"); if(!bv){bv=document.createElement("button");bv.id="vediT";bv.className="btn vedi-ris";document.body.appendChild(bv);bv.onclick=()=>$("#risT").scrollIntoView({behavior:"smooth"});}
    bv.textContent=`Vedi ${plur(L.length,"cammino","cammini")}`; bv.hidden=!attivi;};
  disegna();
}
function vistaCerca(){
  colora(null); titolo.textContent="Cerca";
  const f=leggiFiltri(); let q=f.q||"";
  pagina.innerHTML=`<div class="ricerca"><input id="q" type="search" placeholder="Nome del cammino, paese, regione, monte" value="${esc(q)}" autofocus></div><div id="risC"></div>
  <p class="vuoto-p">Non sai il nome? <a href="#/trova">Trova il cammino adatto</a> per giorni, mese, tenda e fatica.</p>`;
  const M=paesiDi();
  const agg=()=>{const t=q.trim().toLowerCase();
    const regs=t.length>=2?[...M.entries()].flatMap(([pa,R])=>[[pa,"",camminiDelPaese(pa).length],...[...R.entries()].filter(([r])=>r).map(([r,S])=>[pa,r,S.size])]).filter(([pa,r])=>(r||pa).toLowerCase().includes(t)):[];
    const L=t.length>=2?IDX.cammini.filter(c=>[c.nome,c.paese,c.partenza,c.arrivo,(IDX.capitoli.find(x=>x.id===c.sez)||{}).nome,...(c.reg||[]).flat()].join(" ").toLowerCase().includes(t)):[];
    $("#risC").innerHTML=(regs.length?`<div class="tiles">${regs.slice(0,6).map(([pa,r,n])=>`<a class="tile" href="#/dove/${enc(pa)}${r?"/"+enc(r):""}"><b>${esc(r||pa)}</b><small>${r?esc(pa)+", ":""}${plur(n,"cammino","cammini")}</small></a>`).join("")}</div>`:"")+
      (t.length<2?"":L.length?`<ul class="lista con-foto">${L.map(c=>rigaCammino(c,true)).join("")}</ul>`:`<p class="vuoto-p">Nessun cammino con questo nome.</p>`);
    try{sessionStorage.setItem("filtri",JSON.stringify(Object.assign({},leggiFiltri(),{q})));}catch{}};
  $("#q").oninput=e=>{q=e.target.value;agg();}; agg();
}
// posizione dal GPS del telefono, tenuta due minuti
let POS=null;
function posizione(){
  if(POS&&Date.now()-POS.t<120000)return Promise.resolve(POS);
  return new Promise((ok,ko)=>{if(!navigator.geolocation)return ko({code:0});
    navigator.geolocation.getCurrentPosition(p=>{POS={lat:p.coords.latitude,lon:p.coords.longitude,alt:p.coords.altitude,acc:p.coords.accuracy,t:Date.now()};ok(POS);},ko,{enableHighAccuracy:true,timeout:20000,maximumAge:120000});});
}
const msgPos=e=>e&&e.code===1?"Non ho il permesso di usare la posizione. Puoi darlo dalle impostazioni del telefono o del browser.":"Non riesco a trovare la posizione. All'aperto il GPS funziona meglio.";
let VICINI=null; async function vicini(){if(!VICINI)VICINI=await carica("dati/vicini.json");return VICINI;}
function distanze(pos,V){const kx=111.32*Math.cos(pos.lat*Math.PI/180);const out=[];
  for(const k in V){let best=1e9;for(const [la,lo] of V[k]){const d=Math.hypot((la-pos.lat)*110.57,(lo-pos.lon)*kx);if(d<best)best=d;}const p0=V[k][0];out.push({k,d:best,d0:p0?Math.hypot((p0[0]-pos.lat)*110.57,(p0[1]-pos.lon)*kx):null});}
  return out.sort((a,b)=>a.d-b.d);}
const kmTesto=d=>d<1?"meno di 1 km":d<10?`${d.toFixed(1).replace(".",",")} km`:`${Math.round(d)} km`;
async function vistaVicino(){
  colora(null); titolo.textContent="Vicino a me";
  pagina.innerHTML=`<p class="attesa" style="margin:16px">Cerco la tua posizione…</p>`;
  try{
    const [pos,V]=await Promise.all([posizione(),vicini()]); if(location.hash!=="#/vicino")return;
    const D=distanze(pos,V).filter(x=>IDX.cammini.some(c=>c.chiave===x.k)).slice(0,20);
    pagina.innerHTML=`<p class="intro-lista">I cammini più vicini a dove sei, misurati dal punto più vicino del percorso.</p><ul class="lista con-foto">${D.map(x=>{const c=IDX.cammini.find(y=>y.chiave===x.k);
      return rigaCammino(c,true).replace("</small><small class=\"dati\">",`</small><small class="dist">${x.d<0.3?"sei sul percorso":"il percorso passa a "+kmTesto(x.d)}${x.d0!=null&&x.d0>x.d+1?`, la partenza è a ${kmTesto(x.d0)}`:""}</small><small class="dati">`);}).join("")}</ul>`;
  }catch(e){pagina.innerHTML=`<p class="vuoto-p" style="margin-top:16px">${msgPos(e)}</p><p class="vuoto-p">Intanto puoi cercare per <a href="#/dove">paese e regione</a>.</p>`;}
}

/* ---------- sono in cammino ---------- */
// la tappa di oggi: quanto manca lungo la traccia, salita, acqua, dove dormire, tramonto
function inCammino(){try{return JSON.parse(localStorage.getItem("incammino")||"null");}catch{return null;}}
function salvaInCammino(s){try{s?localStorage.setItem("incammino",JSON.stringify(s)):localStorage.removeItem("incammino");}catch{}}
// ora del tramonto con l'equazione del sorgere e tramontare del sole (errore di circa un minuto)
function tramonto(lat,lon,g){
  const r=Math.PI/180, sin=x=>Math.sin(x*r), cos=x=>Math.cos(x*r);
  const jd=Date.UTC(g.getFullYear(),g.getMonth(),g.getDate(),12)/864e5+2440587.5;
  const J=Math.round(jd-2451545+0.0008)-lon/360;
  const M=((357.5291+0.98560028*J)%360+360)%360, C=1.9148*sin(M)+0.02*sin(2*M)+0.0003*sin(3*M);
  const l=(M+C+180+102.9372)%360, Jt=2451545+J+0.0053*sin(M)-0.0069*sin(2*l);
  const dec=Math.asin(sin(l)*sin(23.4397))/r;
  const w=(sin(-0.833)-sin(lat)*sin(dec))/(cos(lat)*cos(dec)); if(w<-1||w>1)return null;
  return new Date((Jt+Math.acos(w)/r/360-2440587.5)*864e5);
}
const oraT=d=>d.toLocaleTimeString("it-IT",{hour:"2-digit",minute:"2-digit"});
const durataT=h=>{const m=Math.round(h*12)*5;return m<60?`${m}<small> min</small>`:`${Math.floor(m/60)}<small> h</small>${m%60?" "+m%60+"<small> min</small>":""}`;};
const kmLL=(a,b)=>Math.hypot((a[0]-b[0])*110.57,(a[1]-b[1])*111.32*Math.cos(a[0]*Math.PI/180)); // [lat,lon]
const numIt=x=>x.toLocaleString("it-IT",{maximumFractionDigits:1});
function coordLoc(c,nome){
  const n=String(nome||"").toLowerCase().split(" (")[0].trim(); if(!n)return null;
  const L=c.localita||[]; const f=L.find(x=>x[0].toLowerCase()===n)||L.find(x=>{const y=x[0].toLowerCase();return y.startsWith(n)||n.startsWith(y);});
  return f?[f[2],f[1]]:null;
}
function tappeOggi(c){
  const O=c.oggi, T=(O&&O.tappe)||[];
  const L=(c.tappe_lista||[]).length?c.tappe_lista:[{n:1,da:c.partenza,a:c.arrivo,km:kmDi(c)?String(kmDi(c)):"",salita:""}];
  return L.map(t=>{const m=T.find(x=>String(x[0])===String(t.n));
    const finto=!(c.tappe_lista||[]).length, tutto=finto&&O; return {...t,finto,i0:m?m[3]:tutto?0:null,i1:m?m[4]:tutto?O.p.length-1:null};});
}
function salitaTra(Q,a,b){let s=0;const st=a<=b?1:-1;for(let i=a;i!==b;i+=st){const d=Q[i+st]-Q[i];if(d>0)s+=d;}return s;}
function vicinoIdx(P,ll,lo=0,hi=P.length-1){let b=1e9,bi=-1;for(let i=Math.max(0,lo);i<=Math.min(P.length-1,hi);i++){const d=kmLL(P[i],ll);if(d<b){b=d;bi=i;}}return [bi,b];}
// acqua e punti utili riportati sul tracciato della tappa, se passano entro r km
function lungoTappa(P,L,i0,i1,r){const lo=Math.min(i0,i1),hi=Math.max(i0,i1),out=[];
  for(const x of L){const [i,d]=vicinoIdx(P,x.ll,lo,hi);if(i>=0&&d<=r)out.push({...x,i});}return out;}
const kmNum=s=>{const m=String(s||"").replace(",",".").match(/\d+(\.\d+)?/);return m?+m[0]:null;};
async function vistaOggi(){
  const s=inCammino(); colora(null); titolo.textContent="Sono in cammino";
  if(!s){pagina.innerHTML=`<p class="vuoto-p" style="margin-top:16px">Apri la scheda di un cammino e tocca <b>Sono in cammino</b>. Qui vedrai quanto manca all'arrivo della tappa, la prossima acqua, dove dormire e l'ora del tramonto.</p>`;return;}
  const c=await cammino(s.k); if(location.hash!=="#/oggi")return; colora(parteDi(c.sez)); const auto=s.tappa==null;
  const O=c.oggi, T=tappeOggi(c); let j=T.findIndex(t=>String(t.n)===String(s.tappa)); if(j<0)j=0;
  const t=T[j], passo=s.passo||4, mappata=O&&t.i0!=null;
  const kmT=kmNum(t.km)??(mappata?Math.abs(O.d[t.i1]-O.d[t.i0]):null);
  const salT=kmNum(t.salita)??(mappata?Math.round(salitaTra(O.q,t.i0,t.i1)/10)*10:null);
  const arr=coordLoc(c,t.a)||(mappata?O.p[t.i1]:null);
  const cambia=n=>{salvaInCammino({...s,tappa:T[n].n,da:T[n].da,a:T[n].a,nome:c.nome});vistaOggi();};
  if(s.tappa==null||s.da!==t.da)salvaInCammino({...s,tappa:t.n,da:t.da,a:t.a,nome:c.nome});
  // dormire all'arrivo della tappa
  const dt=!t.finto&&c.dormire&&(c.dormire.tappe||[]).find(x=>String(x.n)===String(t.n));
  const dorm=dt?(dt.opzioni.length?`<ul class="punti op-d">${dt.opzioni.map(opDormire).join("")}</ul>`:`<p class="nota-d">Solo B&B, hotel o agriturismi.</p>`):`<p class="nota-d">Per questa tappa non ho dati su dove dormire.</p>`;
  pagina.innerHTML=`<div class="oggi-testa"><button id="tP" aria-label="Tappa precedente" ${j?"":"disabled"}>‹</button>
    <div><small>${t.finto?"Tutto il cammino":`Tappa ${esc(t.n)} di ${T.length}`}</small><b>${esc(t.da)} › ${esc(t.a)}</b><span>${[kmT!=null?numIt(kmT)+" km":"",salT?"↑ "+numIt(salT)+" m":""].filter(Boolean).join(" · ")}</span></div>
    <button id="tS" aria-label="Tappa successiva" ${j<T.length-1?"":"disabled"}>›</button></div>
  <div class="fatti" id="adesso"><div><small>Mancano</small><b>…</b></div><div><small>Salita</small><b>…</b></div><div><small>Arrivo</small><b>…</b></div><div><small>Tramonto</small><b>…</b></div></div>
  <div class="barra-t" id="bt" hidden><i></i></div>
  <div class="pos-riga"><button id="agg">↻ Aggiorna posizione</button><button id="passo">Passo ${numIt(passo)} km/h</button></div>
  <p class="pos-info" id="pi">Cerco la posizione…</p>
  <div id="buio"></div>
  <section class="blocco"><h3>Acqua</h3><div id="acqua"><p class="nota-d">…</p></div></section>
  ${t.finto?"":`<section class="blocco"><h3>Stasera a ${esc(t.a)}</h3>${dorm}</section>`}
  <section class="blocco" id="lungo" hidden><h3>Lungo ${t.finto?"il cammino":"la tappa"}</h3><ul class="avanti" id="lungoL"></ul></section>
  <p class="fonti" style="margin:0 14px">Tempi stimati con la regola di Naismith al tuo passo (più un'ora ogni 600 m di salita), soste escluse. Acqua e punti utili da OpenStreetMap.</p>
  <div class="bottoni"><a class="btn" href="#/cammino/${c.chiave}/mappa">◎ Mappa</a><a class="btn secondario" href="#/cammino/${c.chiave}">Scheda del cammino</a><button class="btn secondario" id="fattaT">✓ Tappa fatta</button><button class="btn secondario" id="fine">Ho finito il cammino</button></div>`;
  $("#fattaT").onclick=()=>{const d=(c.tappe_descritte||[]).find(x=>String(x.n)===String(t.n));try{sessionStorage.setItem("bozzaUscita",JSON.stringify({cammino:c.chiave,nome:t.finto?c.nome:`${c.nome}, tappa ${t.n}, ${t.da} - ${t.a}`,km:kmT!=null?Math.round(kmT*10)/10:"",salita:salT||"",grado:(d&&/^EE/.test(d.difficolta||""))||((SICUR&&SICUR.cammini[c.chiave]&&SICUR.cammini[c.chiave].ee)||[]).includes(String(t.n))?"EE":""}));}catch{}location.hash="#/esperienza/nuova";};
  $("#tP").onclick=()=>j&&cambia(j-1); $("#tS").onclick=()=>j<T.length-1&&cambia(j+1);
  $("#agg").onclick=()=>{POS=null;vistaOggi();};
  $("#passo").onclick=()=>{const L=[3,3.5,4,4.5,5];salvaInCammino({...inCammino(),passo:L[(L.indexOf(passo)+1)%L.length]});vistaOggi();};
  $("#fine").onclick=e=>{const b=e.currentTarget;if(!b.dataset.ok){b.dataset.ok=1;b.textContent="Tocca di nuovo per chiudere";setTimeout(()=>{if(b.isConnected){delete b.dataset.ok;b.textContent="Ho finito il cammino";}},4000);return;}const st0=inCammino();salvaInCammino(null);finisciCammino(c,st0);};
  const fatti=(a,b,cc,d)=>{$("#adesso").innerHTML=[["Mancano",a],["Salita",b],["Arrivo",cc],["Tramonto",d]].map(([x,y])=>`<div><small>${x}</small><b>${y}</b></div>`).join("");};
  const ACQ=(c.acqua||[]).map(x=>({ll:[x[1],x[0]],tipo:x[2]}));
  const estremi=[t.da,t.a].map(x=>String(x||"").toLowerCase().split(" (")[0]);
  const PUN=Object.entries(c.poi||{}).flatMap(([cat,L])=>L.map(x=>({ll:[x[1],x[0]],cat,nome:x[2],q:x[3]}))).filter(x=>!(x.cat==="paese"&&estremi.includes(String(x.nome||"").toLowerCase())));
  const listaAvanti=(V,i,dir)=>V.filter(x=>(x.i-i)*dir>=0).sort((a,b)=>(a.i-b.i)*dir).map(x=>({...x,km:Math.abs(O.d[x.i]-O.d[i])}));
  const acquaHtml=(L,daDove)=>(L=L.filter((x,i)=>!L.slice(0,i).some(y=>Math.abs(y.km-x.km)<0.15)),L.length)?`<ul class="avanti">${L.slice(0,3).map(x=>`<li><span class="km">${kmTesto(x.km).replace("meno di 1 km","< 1 km")}</span><span>${esc(x.tipo||"acqua")}${x.nome?" "+esc(x.nome):""}</span></li>`).join("")}</ul><p class="nota-d">${daDove}</p>`:"";
  // senza posizione: la tappa intera
  const intera=pos=>{
    const tr=arr?tramonto(arr[0],arr[1],new Date()):null; const h=kmT!=null?kmT/passo+(salT||0)/600:null;
    fatti(kmT!=null?`${numIt(kmT)}<small> km</small>`:"?",salT!=null?`${numIt(salT)}<small> m</small>`:"?",h!=null?durataT(h):"?",tr?oraT(tr):"?");
    $("#adesso").children[0].querySelector("small").textContent="Tappa"; $("#adesso").children[2].querySelector("small").textContent="Cammino";
    if(mappata){const dir=t.i1>=t.i0?1:-1; const A=listaAvanti(lungoTappa(O.p,ACQ,t.i0,t.i1,0.3),t.i0,dir);
      $("#acqua").innerHTML=acquaHtml(A,"Distanze dalla partenza della tappa, lungo la traccia.")||`<p class="nota-d">Su OpenStreetMap non ci sono fontane segnate lungo questa tappa. Parti con le borracce piene.</p>`;
      mostraLungo(listaAvanti(lungoTappa(O.p,PUN,t.i0,t.i1,0.4),t.i0,dir),"dalla partenza");}
    else $("#acqua").innerHTML=`<p class="nota-d">Per questa tappa non ho la traccia, quindi non so dove sono le fontane lungo la strada.</p>`;
  };
  const mostraLungo=(L,da)=>{const K=[];for(const x of L){const nm=x.nome&&x.nome.length>1;if(!nm&&K.some(y=>y.cat===x.cat&&Math.abs(y.km-x.km)<0.6))continue;K.push(x);} L=K; if(!L.length)return;$("#lungo").hidden=false;$("#lungoL").innerHTML=L.slice(0,6).map(x=>{const st=POI_STILE[x.cat]||["#555","•",x.cat];
    const nm=x.nome&&x.nome.length>1&&x.nome!=="."?x.nome:"";
    return `<li><span class="km">${kmTesto(x.km).replace("meno di 1 km","< 1 km")}</span><span>${esc(st[1])} ${nm?esc(nm):`<i>${esc(st[2])}</i>`}${x.q?` <small>${esc(x.q)} m</small>`:""}${nm?` <small>${esc(st[2])}</small>`:""}</span></li>`;}).join("")+`<li class="nota-d" style="display:block;border:0">Distanze ${da}, lungo la traccia.</li>`;};
  let pos; try{pos=await posizione();}catch(e){if(location.hash!=="#/oggi")return;$("#pi").textContent=msgPos(e).split(".")[0]+". Ti mostro la tappa intera.";intera();return;}
  if(location.hash!=="#/oggi")return;
  const ll=[pos.lat,pos.lon]; const tr=tramonto(pos.lat,pos.lon,new Date());
  $("#pi").textContent=`Posizione delle ${oraT(new Date(pos.t))}${pos.acc?`, precisione ${Math.round(pos.acc)} m`:""}.`;
  if(!mappata){ // senza traccia: in linea d'aria
    const d=arr?kmLL(ll,arr):null;
    $("#adesso").style.gridTemplateColumns="1fr 1fr";
    $("#adesso").innerHTML=`<div><small>Mancano</small><b>${d!=null?`${numIt(d)}<small> km</small>`:"?"}</b><span>in linea d'aria</span></div><div><small>Tramonto</small><b>${tr?oraT(tr):"?"}</b></div>`;
    const A=ACQ.map(x=>({...x,km:kmLL(ll,x.ll)})).filter(x=>x.km<3).sort((a,b)=>a.km-b.km);
    $("#acqua").innerHTML=acquaHtml(A,"Distanze in linea d'aria da dove sei.")||`<p class="nota-d">Su OpenStreetMap non ci sono fontane segnate entro 3 km da qui.</p>`;
    return;
  }
  // posizione sulla traccia: prima nella tappa, poi in tutto il cammino
  let [iU,dU]=vicinoIdx(O.p,ll,Math.min(t.i0,t.i1)-20,Math.max(t.i0,t.i1)+20);
  if(dU>1.5){const [iT,dT]=vicinoIdx(O.p,ll); const k=T.findIndex(x=>x.i0!=null&&iT>=Math.min(x.i0,x.i1)&&iT<=Math.max(x.i0,x.i1));
    if(dT<=1.5&&k>=0&&k!==j&&auto)return cambia(k);
    if(dT<=1.5&&k>=0&&k!==j){$("#pi").insertAdjacentHTML("beforeend",` <b>Sembri sulla tappa ${esc(T[k].n)}.</b> <button id="vaiT">Passa a quella</button>`);$("#vaiT").onclick=()=>cambia(k);}
    if(dU>3){intera();$("#pi").insertAdjacentHTML("beforeend",` Sei a ${kmTesto(dU)} dalla traccia di questa tappa, ti mostro la tappa intera.`);return;}}
  const dir=t.i1>=t.i0?1:-1; const f=Math.max(0,Math.min(1,(iU-t.i0)/((t.i1-t.i0)||1)));
  const iDa=(iU-t.i0)*dir<0?t.i0:(iU-t.i1)*dir>0?t.i1:iU;
  // quello che resta misurato sulla traccia, riportato ai km e alla salita dichiarati per la tappa
  const kmTr=Math.abs(O.d[t.i1]-O.d[t.i0])||1, gT=salitaTra(O.q,t.i0,t.i1), kmD=kmNum(t.km), sD=kmNum(t.salita);
  const kmR=Math.abs(O.d[t.i1]-O.d[iDa])*(kmD?kmD/kmTr:1);
  const gR=salitaTra(O.q,iDa,t.i1), salR=Math.round((sD?(gT?sD*gR/gT:sD*kmR/(kmD||kmTr)):gR)/10)*10, h=kmR/passo+salR/600, eta=new Date(Date.now()+h*36e5);
  const oltre=eta.toDateString()!==new Date().toDateString();
  fatti(`${numIt(kmR)}<small> km</small>`,`${numIt(salR)}<small> m</small>`,kmR<0.2?"ci sei":oltre?"<small>oltre oggi</small>":oraT(eta),tr?oraT(tr):"?");
  $("#bt").hidden=false; $("#bt i").style.width=Math.round(f*100)+"%";
  if(dU>0.3)$("#pi").insertAdjacentHTML("beforeend",` Sei a ${kmTesto(dU)} dalla traccia.`);
  if((iU-t.i1)*dir>3)$("#pi").insertAdjacentHTML("beforeend",` Hai passato l'arrivo di tappa.`);
  if(tr&&kmR>=0.2&&!oltre){const m=(tr-eta)/6e4; if(m<60)$("#buio").innerHTML=`<div class="avviso-buio">☾ ${m<0?"Con questo passo arrivi dopo il tramonto.":"Con questo passo arrivi meno di un'ora prima del tramonto."} <a href="#/aiuto/buio">Cosa fare se arriva il buio ›</a></div>`;}
  const A=listaAvanti(lungoTappa(O.p,ACQ,t.i0,t.i1,0.3),iDa,dir);
  $("#acqua").innerHTML=acquaHtml(A,"Distanze da dove sei, lungo la traccia.")||`<p class="nota-d">Da qui all'arrivo su OpenStreetMap non ci sono fontane segnate.</p>`;
  mostraLungo(listaAvanti(lungoTappa(O.p,PUN,t.i0,t.i1,0.4),iDa,dir),"da dove sei");
}
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&location.hash==="#/oggi"){POS=null;vistaOggi();}});

/* ---------- natura: cosa c'è qui, ambienti ---------- */
let AMBIENTI=null; async function ambienti(){if(!AMBIENTI)AMBIENTI=await carica("dati/ambienti.json");return AMBIENTI;}
async function vistaAmbienti(){
  verde(); titolo.textContent="In che ambiente sono?";
  const [A,AM]=await Promise.all([atlante(),ambienti()]); const scegli=sessionStorage.getItem("amb:scegli");
  pagina.innerHTML=`<p class="intro-lista">Guarda le foto e le piante che lo indicano. ${scegli?"Tocca <b>Sono qui</b> sull'ambiente giusto.":"Da ogni ambiente si aprono le sue specie."}</p>`+AM.map((a,i)=>{const n=A.specie.filter(s=>s.ambienti.includes(a.nome)).length;
    return `<section class="blocco ambiente"><img src="${a.foto}" alt="${esc(a.nome)}" loading="lazy"><h3>${esc(cap1(a.nome))}</h3><p>${esc(a.testo)}</p>
    <h4 class="sotto">Lo riconosci da</h4><div class="ind">${a.indicatori.map(n_=>A.specie.find(s=>s.n===n_)).filter(Boolean).map(s=>`<a href="#/atlante/${s.n}"><span class="th" style="background-image:url(${s.foto})"></span><small>${esc(cap1(s.it))}</small></a>`).join("")}</div>
    <p class="az-amb">${scegli?`<button class="btn" data-qui="${i}">Sono qui</button> `:""}<a class="btn secondario" href="#/atlante" data-amb-n="${esc(a.nome)}">Le ${n} specie</a></p>
    <p class="fonti">Foto: ${esc(a.credito.autore||"")}, ${esc(a.credito.licenza||"")}.</p></section>`;}).join("");
  pagina.querySelectorAll("[data-amb-n]").forEach(x=>x.onclick=()=>{try{sessionStorage.setItem("fatl",JSON.stringify({q:"",amb:x.dataset.ambN,regno:"",mese:false}));}catch{}});
  pagina.querySelectorAll("[data-qui]").forEach(b=>b.onclick=()=>{sessionStorage.setItem("qui:amb",AM[+b.dataset.qui].nome);sessionStorage.removeItem("amb:scegli");location.hash="#/qui";});
}
async function vistaQui(){
  verde(); titolo.textContent="Cosa c'è qui intorno";
  const [A,AM]=await Promise.all([atlante(),ambienti()]); const m=new Date().getMonth()+1;
  pagina.innerHTML=`<p class="attesa" style="margin:16px">Cerco la tua posizione…</p>`;
  let pos=null, vic=[], scelto=sessionStorage.getItem("qui:cammino");
  try{pos=await posizione();const V=await vicini();vic=distanze(pos,V).filter(x=>x.d<=25);}catch(e){pos={errore:e};}
  if(location.hash!=="#/qui")return;
  const chiaviVicine=scelto?[scelto]:vic.slice(0,3).map(x=>x.k);
  const vicino=scelto?IDX.cammini.find(c=>c.chiave===scelto):(vic[0]?IDX.cammini.find(c=>c.chiave===vic[0].k):null);
  let pool=A.specie.filter(s=>(s.cammini||[]).some(([k])=>chiaviVicine.includes(k)));
  const lontano=!pool.length; if(lontano)pool=A.specie;
  // ambiente probabile: quello più frequente fra le specie della zona, fra quelli possibili alla quota del GPS
  const alt=pos&&pos.alt!=null&&!pos.errore?Math.round(pos.alt):null;
  const conta={}; for(const s of pool){if(s.ambienti[0])conta[s.ambienti[0]]=(conta[s.ambienti[0]]||0)+1;}
  const possibili=AM.filter(a=>alt==null||(alt>=a.quote[0]-100&&alt<=a.quote[1]+100)).map(a=>a.nome);
  const stima=Object.entries(conta).filter(([a])=>possibili.includes(a)).sort((a,b)=>b[1]-a[1])[0];
  let amb=sessionStorage.getItem("qui:amb")||(stima?stima[0]:"");
  let gruppo=sessionStorage.getItem("qui:g")||"", soloMese=sessionStorage.getItem("qui:m")!=="0";
  const testa=pos&&!pos.errore?(vicino?`Sei ${vic[0]&&!scelto?(vic[0].d<0.3?"sul":"a "+kmTesto(vic[0].d)+" dal"):"sul"} <a href="#/cammino/${vicino.chiave}">${esc(vicino.nome)}</a>`:"Sei lontano dai cammini dell'app")+(alt!=null?`, a circa ${alt.toLocaleString("it-IT")} m di quota`:"")+".":
    (scelto&&vicino?`Specie del <a href="#/cammino/${vicino.chiave}">${esc(vicino.nome)}</a>.`:msgPos(pos&&pos.errore));
  const disegna=()=>{
    const aI=AM.find(a=>a.nome===amb);
    const L=pool.filter(s=>(!amb||s.ambienti.includes(amb))&&(!gruppo||s.regno===gruppo)&&(!soloMese||!(s.mesi||[]).length||s.mesi.includes(m)))
      .sort((a,b)=>(soloMese?(!(a.mesi||[]).length)-(!(b.mesi||[]).length):0)||((b.cammini||[]).filter(([k])=>chiaviVicine.includes(k)).length-(a.cammini||[]).filter(([k])=>chiaviVicine.includes(k)).length)||a.n-b.n);   // con il filtro del mese, prima quelle che di sicuro si vedono ora
    pagina.innerHTML=`<section class="blocco qui-testa"><p>${testa}</p>
      ${aI?`<div class="amb-scelto"><span class="th" style="background-image:url(${aI.foto})"></span><div><small>${sessionStorage.getItem("qui:amb")?"Ambiente scelto":"Probabilmente sei in"}</small><b>${esc(cap1(aI.nome))}</b></div></div>`:""}
      <div class="fc">${AM.map(a=>`<button class="fchip${amb===a.nome?" attivo":""}" data-amb="${esc(a.nome)}">${esc(a.nome)}</button>`).join("")}<button class="fchip${!amb?" attivo":""}" data-amb="">tutti</button></div>
      <p class="pic"><a href="#/ambienti" id="nonso">Non sai in che ambiente sei? Guarda le foto</a></p>
      ${!pos||pos.errore||lontano?`<p class="pic">Oppure scegli un cammino: <select id="selC"><option value="">scegli…</option>${IDX.cammini.slice().sort((a,b)=>a.nome.localeCompare(b.nome,"it")).map(c=>`<option value="${c.chiave}"${c.chiave===scelto?" selected":""}>${esc(c.nome)}</option>`).join("")}</select></p>`:""}</section>
      <div class="fc filtri-qui"><button class="fchip${soloMese?" attivo":""}" id="fm">Si vede a ${MESI_LUNGHI[m-1]}</button>${REGNI_A.filter(r=>pool.some(s=>s.regno===r)).map(r=>`<button class="fchip${gruppo===r?" attivo":""}" data-gr="${r}">${esc(NOME_REGNO_A[r]||r)}</button>`).join("")}</div>
      <div class="conta">${plur(L.length,"specie","specie")}${lontano?" in tutto l'atlante":" segnalate qui intorno"}</div>
      <div class="specie">${L.map(s=>`<a href="#/atlante/${s.n}" class="${s.illustrazione?"illu":""}"><div class="img" style="${s.foto?`background-image:url(${s.foto})`:""}">${s.foto?"":"❀"}</div><div class="nomi"><b><span class="na">${s.n}</span> ${esc(cap1(s.it))}</b><i>${esc(s.sci)}</i>${s.segno?`<small>${esc(s.segno)}</small>`:""}</div></a>`).join("")||`<div class="vuoto">Nessuna specie con queste scelte</div>`}</div>`;
    pagina.querySelectorAll("[data-amb]").forEach(b=>b.onclick=()=>{amb=b.dataset.amb;sessionStorage.setItem("qui:amb",amb);disegna();});
    pagina.querySelectorAll("[data-gr]").forEach(b=>b.onclick=()=>{gruppo=gruppo===b.dataset.gr?"":b.dataset.gr;sessionStorage.setItem("qui:g",gruppo);disegna();});
    $("#fm").onclick=()=>{soloMese=!soloMese;sessionStorage.setItem("qui:m",soloMese?"1":"0");disegna();};
    $("#nonso").onclick=()=>sessionStorage.setItem("amb:scegli","1");
    const sel=$("#selC"); if(sel)sel.onchange=()=>{if(sel.value)sessionStorage.setItem("qui:cammino",sel.value);else sessionStorage.removeItem("qui:cammino");vistaQui();};
  };
  disegna();
}

/* ---------- aiuto: 112 con la posizione, cosa fare se, prima di partire, numeri ---------- */
let AIUTO=null; async function aiuto(){if(!AIUTO)AIUTO=await carica("dati/aiuto.json");return AIUTO;}
function rosso(){colora(null);ponParte("#A1341B","#fbefe6");document.querySelector('meta[name=theme-color]').content="#A1341B";}
function leggiZaino(){try{return JSON.parse(localStorage.getItem("zaino")||"{}");}catch{return {};}}
async function vistaAiuto(id,sub){
  rosso(); const D=await aiuto();
  if(id==="numeri")return vistaNumeri(D);
  if(id==="prima")return vistaPrima(D);
  if(id==="posizione")return vistaPosizione();
  if(id==="g")return vistaGruppoAiuto(D,+sub);
  if(id){const s=D.schede.find(x=>x.id===id);if(!s){location.hash="#/aiuto";return;}return vistaSchedaAiuto(s);}
  titolo.textContent="Aiuto";
  pagina.innerHTML=`<div class="sos-riga"><a class="btn sos-112" href="tel:112">✆ Chiama il 112</a><a class="btn dove-btn" href="#/aiuto/posizione">◎ Dove sono?</a></div>
  <h2 class="sez">Cosa fare se…</h2>
  <div class="lista-aiuto">${D.gruppi.map((g,i)=>`<a href="#/aiuto/g/${i}"><b>${esc(g.nome)}</b><small>${esc(g.sotto||"")}</small><span class="freccia">›</span></a>`).join("")}</div>
  <h2 class="sez">Prima di partire</h2>
  <div class="lista-aiuto"><a href="#/aiuto/prima"><b>Prima di partire e zaino</b><small>cosa fare prima e lista da spuntare</small><span class="freccia">›</span></a><a href="#/aiuto/numeri"><b>Numeri utili</b><small>112 e centri antiveleni</small><span class="freccia">›</span></a></div>`;
}
function vistaGruppoAiuto(D,i){
  const g=D.gruppi[i]; if(!g){location.hash="#/aiuto";return;} titolo.textContent=g.nome;
  pagina.innerHTML=`<div class="lista-aiuto schede-g">${g.schede.map(id=>{const s=D.schede.find(x=>x.id===id);return `<a href="#/aiuto/${id}"><b>${esc(s.titolo)}</b><small>${esc(s.in_breve||"")}</small><span class="freccia">›</span></a>`;}).join("")}</div>`;
}
function vistaPosizione(){
  titolo.textContent="Dove sono";
  pagina.innerHTML=`<section class="sos"><div id="posBox"></div><a class="btn sos-112" href="tel:112">✆ Chiama il 112</a></section><p class="vuoto-p">Le coordinate le dai all'operatore se te le chiede. Con le app Where ARE U e GeoResQ la posizione parte da sola.</p>`;
  mostraPosizione();
}
async function mostraPosizione(){
  const box=$("#posBox"); box.innerHTML=`<p class="attesa">Cerco la posizione…</p>`;
  try{
    POS=null; const p=await posizione();
    const gms=(v,a,b)=>{const x=Math.abs(v),g=Math.floor(x),m=Math.floor((x-g)*60),s=((x-g)*60-m)*60;return `${g}° ${m}′ ${s.toFixed(1).replace(".",",")}″ ${v>=0?a:b}`;};
    let vic=""; try{const V=await vicini();const d=distanze(p,V)[0];const c=d&&IDX.cammini.find(x=>x.chiave===d.k);if(c&&d.d<10)vic=`${d.d<0.3?"sul":"a "+kmTesto(d.d)+" dal"} ${esc(c.nome)}`;}catch{}
    box.innerHTML=`<div class="coord"><small>Latitudine e longitudine</small><b>${p.lat.toFixed(5).replace(".",",")}<br>${p.lon.toFixed(5).replace(".",",")}</b><span>${gms(p.lat,"N","S")}, ${gms(p.lon,"E","O")}</span>${p.alt!=null?`<span>Quota circa ${Math.round(p.alt).toLocaleString("it-IT")} m</span>`:""}<span>Precisione ${Math.round(p.acc)} m${vic?`, ${vic}`:""}</span></div>
      <p><button class="btn secondario" id="copiaPos">Copia le coordinate</button></p>`;
    $("#copiaPos").onclick=async()=>{try{await navigator.clipboard.writeText(`${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}`);avviso("Coordinate copiate");}catch{avviso("Non riesco a copiare");}};
  }catch(e){box.innerHTML=`<p class="attesa">${msgPos(e)}</p>`;}
}
function vistaSchedaAiuto(s){
  titolo.textContent=s.titolo; const li=L=>L.map(x=>`<li>${esc(x)}</li>`).join("");
  const adesso=`${(s.segnali||[]).length?`<div class="box-k"><b>Come lo riconosci</b><ul>${li(s.segnali)}</ul></div>`:""}
   <h3>Subito</h3><ol class="passi">${li(s.subito)}</ol>
   ${(s.poi||[]).length?`<h3>Poi</h3><ol class="passi">${li(s.poi)}</ol>`:""}
   ${(s.non_fare||[]).length?`<div class="box-k att"><b>Non fare</b><ul class="no">${li(s.non_fare)}</ul></div>`:""}
   ${s.chiama_112?`<div class="chiama"><p>${esc(s.chiama_112)}</p><a class="btn sos-112 piccolo" href="tel:112">✆ 112</a></div>`:""}
   ${fonti(s.fonti||[])}`;
  const leggere=`${(s.approfondisci||[]).map(p=>`<h4 class="sotto">${esc(p.titolo)}</h4><p>${esc(p.testo)}</p>`).join("")}
   ${(s.miti||[]).length?`<div class="miti"><b>Da sfatare</b>${s.miti.map(m=>`<p><span class="falso">Si dice</span> ${esc(m.mito)}<br><span class="vero">In realtà</span> ${esc(m.realta)}</p>`).join("")}</div>`:""}
   ${(s.prevenire||[]).length?`<h4 class="sotto">Per evitarlo</h4><ul>${li(s.prevenire)}</ul>`:""}
   <div id="linkA"></div>
   ${fonti(s.fonti_leggere||[])}`;
  pagina.innerHTML=`<section class="blocco scheda-aiuto"><h2>${esc(s.titolo)}</h2>${s.in_breve?`<p class="in-breve">${esc(s.in_breve)}</p>`:""}
   ${(s.approfondisci||[]).length?`<div class="segmenti"><button data-v="adesso" class="attivo">Cosa fare adesso</button><button data-v="leggere">Da leggere con calma</button></div>`:""}
   <div id="vistaA">${adesso}</div></section>`;
  pagina.querySelectorAll(".segmenti button").forEach(b=>b.onclick=()=>{pagina.querySelectorAll(".segmenti button").forEach(x=>x.classList.toggle("attivo",x===b));
    $("#vistaA").innerHTML=b.dataset.v==="adesso"?adesso:leggere; if(b.dataset.v==="leggere")collegamenti(s);});
}
async function collegamenti(s){
  if(!(s.link||[]).length)return; const box=$("#linkA"); if(!box)return;
  const A=await atlante().catch(()=>null); if(!IMPARA)IMPARA=await carica("dati/imparare.json").catch(()=>null);
  const voci=s.link.map(([t,v])=>{if(t==="impara"){const p=(IMPARA||[]).find(x=>x.id===v);return p?`<a href="#/impara/${v}"><span class="th vuota">✎</span><small>Impara<br>${esc(p.titolo)}</small></a>`:"";}
    const sp=A&&A.specie.find(x=>x.sci===v);return sp?`<a href="#/atlante/${sp.n}"><span class="th" style="background-image:url(${sp.foto})"></span><small>${esc(cap1(sp.it))}</small></a>`:"";}).join("");
  if(voci)box.innerHTML=`<h4 class="sotto">Per saperne di più</h4><div class="ind">${voci}</div>`;
}
function vistaNumeri(D){
  titolo.textContent="Numeri utili";
  pagina.innerHTML=`<section class="blocco"><div class="numeri">${D.numeri.map(n=>`<a class="num-riga" href="tel:${n.numero.replace(/\s/g,"")}"><span><b>${esc(n.nome)}</b>${n.nota?`<small>${esc(n.nota)}</small>`:""}</span><span class="num">${esc(n.numero)}</span></a>`).join("")}</div>
  ${fonti(D.numeri.map(n=>n.fonte))}</section>`;
}
function vistaPrima(D){
  titolo.textContent="Prima di partire"; const Z=leggiZaino();
  pagina.innerHTML=`<section class="blocco"><h3>Prima di partire</h3><ul>${D.prima.consigli.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>${fonti(D.prima.fonti||[])}</section>
  <section class="blocco zaino"><h3>Lo zaino</h3><p class="pic">Spunta quello che hai messo. Resta salvato su questo telefono.</p>
   ${D.zaino.gruppi.map(g=>`<h4 class="sotto">${esc(g.nome)}</h4>${g.voci.map(v=>`<label class="voce"><input type="checkbox" data-v="${esc(v)}"${Z[v]?" checked":""}> <span>${esc(v)}</span></label>`).join("")}`).join("")}
   ${(D.zaino.note||[]).length?`<div class="box-k"><b>Ricorda</b><ul>${D.zaino.note.map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div>`:""}
   <p><button class="btn secondario" id="azzeraZ">Svuota la lista</button></p>${fonti(D.zaino.fonti||[])}</section>`;
  pagina.querySelectorAll(".voce input").forEach(c=>c.onchange=()=>{const Z2=leggiZaino();Z2[c.dataset.v]=c.checked;try{localStorage.setItem("zaino",JSON.stringify(Z2));}catch{}});
  $("#azzeraZ").onclick=()=>{try{localStorage.removeItem("zaino");}catch{}vistaPrima(D);};
}

avvio();
