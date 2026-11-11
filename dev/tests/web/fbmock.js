(function(){
  const store=new Map();window.__store=store;window.__writes=[];window.__errors=[];
  window.__deepFreeze=o=>o;
  window.addEventListener('error',e=>__errors.push('onerror: '+e.message));
  const ce=console.error;console.error=(...a)=>{__errors.push('console.error: '+a.map(x=>x&&x.stack||String(x)).join(' '));ce(...a)};
  const listeners=[];
  const cp=o=>JSON.parse(JSON.stringify(o));
  function snap(col,meta){const docs=[];for(const[p,d]of store){if(!p.startsWith(col+'/'))continue;const rest=p.slice(col.length+1);if(rest.includes('/'))continue;docs.push({id:rest,exists:true,data:()=>cp(d)})}return{docs,size:docs.length,empty:!docs.length,metadata:meta}}
  function emit(meta){for(const l of listeners.slice())l.next(snap(l.col,meta))}
  window.__emit=emit;
  function colRef(path){return{doc(id){return docRef(path+'/'+id)},onSnapshot(opts,next,err){if(typeof opts==='function'){err=next;next=opts}const l={col:path,next,err};listeners.push(l);
    setTimeout(()=>{if(listeners.includes(l))next(snap(path,{fromCache:true,hasPendingWrites:false}))},5);
    setTimeout(()=>{if(listeners.includes(l))next(snap(path,{fromCache:false,hasPendingWrites:false}))},60);
    return()=>{const i=listeners.indexOf(l);if(i>=0)listeners.splice(i,1)}}}}
  function docRef(path){return{collection(sub){return colRef(path+'/'+sub)},async set(data){
    if(window.__denyWrites)throw{code:'permission-denied'};
    // wie Firestore: keine Arrays direkt in Arrays, kein undefined
    const bad=(v,inArr,pth)=>{if(v===undefined)return pth+' undefined';if(Array.isArray(v)){if(inArr)return pth+' nested array';for(let i=0;i<v.length;i++){const r=bad(v[i],true,pth+'['+i+']');if(r)return r}return ''}
      if(v&&typeof v==='object'){for(const k of Object.keys(v)){const r=bad(v[k],false,pth+'.'+k);if(r)return r}}return ''};
    const why=bad(data,false,path);if(why){__errors.push('firestore invalid: '+why);throw{code:'invalid-argument'}}
    __writes.push(path);store.set(path,cp(data));emit({fromCache:false,hasPendingWrites:true});
    await new Promise(r=>setTimeout(r,25));setTimeout(()=>emit({fromCache:false,hasPendingWrites:false}),15)}}}
  const FS={enablePersistence:async()=>{},collection:p=>colRef(p)};
  const users={'z@x.de':{uid:'u1',pw:'geheim1'}};let cur=window.__AUTH_START||null;const cbs=[];
  const pub=()=>cur?{uid:cur.uid,email:cur.email}:null;
  const fire=()=>cbs.forEach(cb=>cb(pub()));
  const w=ms=>new Promise(r=>setTimeout(r,ms));
  const AUTH={onAuthStateChanged(cb){cbs.push(cb);setTimeout(()=>cb(pub()),20);return()=>{}},
    async signInWithEmailAndPassword(e,p){await w(20);const u=users[e];if(!u||u.pw!==p)throw{code:'auth/invalid-credential'};cur={uid:u.uid,email:e};setTimeout(fire,5)},
    async createUserWithEmailAndPassword(e,p){await w(20);if(users[e])throw{code:'auth/email-already-in-use'};if(p.length<6)throw{code:'auth/weak-password'};users[e]={uid:'u'+(Object.keys(users).length+1),pw:p};cur={uid:users[e].uid,email:e};setTimeout(fire,5)},
    async sendPasswordResetEmail(e){await w(10);window.__reset=e},
    async signOut(){cur=null;setTimeout(fire,5)}};
  window.firebase={initializeApp(){return{}},auth(){return AUTH},firestore(){return FS}};
  window.FIREBASE_CONFIG={projectId:'test'};
  const t=new Date(),iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  const td=iso(t),y=new Date(t);y.setDate(y.getDate()-1);const yd=iso(y);
  store.set('users/u1/data/state',{v:2,habits:[
    {id:'h-beten',name:'Beten',emoji:'🤲',freq:'daily',target:5,labels:['Fajr','Dhuhr','Asr','Maghrib','Isha'],created:'2026-10-01',archived:false},
    {id:'h-lesen',name:'1 Seite lesen',emoji:'📚',freq:'daily',target:1,labels:[],created:'2026-10-01',archived:false}],
    todos:[{id:'t-old',title:'Alte Aufgabe',prio:'n',due:null,done:false}],plan:{text:'',days:{}},settings:{dayStart:4}});
  store.set('users/u1/data/m-'+td.slice(0,7),{days:{[td]:{mood:3,h:{'h-beten':[0]}},[yd]:{task:{text:'Gestern-Aufgabe',done:true},okay:'War okay'}}});
  if(yd.slice(0,7)!==td.slice(0,7))store.set('users/u1/data/m-'+yd.slice(0,7),{days:{[yd]:{task:{text:'Gestern-Aufgabe',done:true},okay:'War okay'}}});
})();
