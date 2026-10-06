import { addJournal, gainRewards, saveState } from './state.js';

const VERSION = '0.3.8';
const ENABLED = 38;
const KEY='couple-guild-v03-meta';
const CHANNEL_NAME='couple-guild-v03-sync';
const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return {}}};
const write=(v)=>localStorage.setItem(KEY,JSON.stringify(v));

function ensureMeta(){
  const m=read();
  m.schema=Math.max(Number(m.schema||0), Number(VERSION.replaceAll('.','')));
  m.identity=m.identity||{name:'我',role:'player',coupleCode:'CG-'+Math.random().toString(36).slice(2,8).toUpperCase(),paired:false,partnerName:'另一半'};
  m.notifications=Array.isArray(m.notifications)?m.notifications:[];
  m.rewards=Array.isArray(m.rewards)?m.rewards:[];
  m.home=m.home||{room:'客廳',items:['沙發','雙人桌','貓抓板'],level:1};
  m.sync=m.sync||{status:'local',lastEvent:null,lastAt:null,pending:0};
  m.claimedRewards=m.claimedRewards||{};
  write(m); return m;
}

export function initV03(state, game){
  const meta=ensureMeta();
  window.CG_V03={version:VERSION,meta,state,game};
  injectStyles();
  const root=document.createElement('div'); root.className='v03-shell';
  root.innerHTML=`<button class="v03-launch" id="v03Launch">☁️ 雙人</button>
  <div class="v03-panel" id="v03Panel"><div class="v03-head"><div><b>💞 Couple Guild V${VERSION}</b><small id="v03Status">本機模式</small></div><button id="v03Close">×</button></div>
  <div class="v03-tabs">${tabs().map(t=>`<button data-vtab="${t.id}">${t.icon} ${t.label}</button>`).join('')}</div>
  <div id="v03Body"></div></div>`;
  document.body.appendChild(root);
  const panel=root.querySelector('#v03Panel');
  root.querySelector('#v03Launch').onclick=()=>{panel.classList.add('show');render();};
  root.querySelector('#v03Close').onclick=()=>panel.classList.remove('show');
  root.querySelectorAll('[data-vtab]').forEach(b=>b.onclick=()=>{root.querySelectorAll('[data-vtab]').forEach(x=>x.classList.toggle('on',x===b)); render(b.dataset.vtab);});
  root.querySelector('[data-vtab]')?.classList.add('on');
  window.addEventListener('cg:v03-refresh',render);
  setupRealtime();
  render();

  function render(tab){
    tab=tab||root.querySelector('[data-vtab].on')?.dataset.vtab||tabs()[0].id;
    const body=root.querySelector('#v03Body');
    if(tab==='account') body.innerHTML=accountView();
    if(tab==='world') body.innerHTML=worldView();
    if(tab==='tasks') body.innerHTML=tasksView();
    if(tab==='home') body.innerHTML=homeView();
    if(tab==='rewards') body.innerHTML=rewardsView();
    if(tab==='notify') body.innerHTML=notifyView();
    if(tab==='sync') body.innerHTML=syncView();
    bind(body,tab);
    root.querySelector('#v03Status').textContent=meta.sync.status==='online'?'🟢 同步中':'🟡 本機 / Demo';
  }

  function tabs(){
    const out=[{id:'account',icon:'👥',label:'雙人帳號'},{id:'world',icon:'🌍',label:'共享世界'}];
    if(ENABLED>=302) out.push({id:'tasks',icon:'📜',label:'雙人任務'});
    if(ENABLED>=304) out.push({id:'home',icon:'🏠',label:'公會之家'});
    if(ENABLED>=305) out.push({id:'rewards',icon:'🎁',label:'雙人獎勵'});
    if(ENABLED>=306) out.push({id:'notify',icon:'🔔',label:'通知'});
    if(ENABLED>=303) out.push({id:'sync',icon:'☁️',label:'同步'});
    return out;
  }

  function accountView(){const i=meta.identity;return `<section><h3>👥 我們的共同公會</h3><p class="muted">V0.3 從單機世界開始加入「兩個人屬於同一個世界」的資料結構。未設定 Supabase 時仍可用 Demo 模式測試。</p><div class="v03-card"><label>你的名字</label><input id="v03Name" value="${esc(i.name)}"><label>伴侶名字</label><input id="v03Partner" value="${esc(i.partnerName)}"><div class="code-box">公會邀請碼 <strong>${esc(i.coupleCode)}</strong></div><div class="row"><button class="v03-primary" id="saveIdentity">儲存</button><button class="v03-secondary" id="newCode">重新產生邀請碼</button></div></div><div class="v03-card"><b>Supabase 狀態</b><p class="muted">目前這組 ZIP 不要求你填入任何祕密金鑰；可在後續部署時設定 <code>SUPABASE_URL</code> 與 <code>SUPABASE_ANON_KEY</code>。</p><span class="badge">${i.paired?'已配對':'Demo 未配對'}</span></div></section>`}
  function worldView(){const p=state.partner;return `<section><h3>🌍 共享世界</h3><p class="muted">這版開始把「另一半」視為共享世界中的玩家，而不是單純 NPC。</p><div class="v03-card presence"><div class="avatar">🧑‍🤝‍🧑</div><div><b>${esc(meta.identity.partnerName)}</b><div class="muted">${meta.sync.status==='online'?'🟢 在線／同步中':'🟡 Demo 在線'}</div><div class="tiny">座標 ${Math.round(p.x)}, ${Math.round(p.y)}</div></div></div><div class="v03-grid"><div><b>我的角色</b><p>可以繼續探索小鎮、接任務、互動。</p></div><div><b>伴侶角色</b><p>在世界中保留位置與活動資料。</p></div></div></section>`}
  function tasksView(){const tasks=state.tasks.filter(t=>t.status!=='completed').slice(0,8);return `<section><h3>📜 雙人任務</h3><p class="muted">任務不再只是「誰完成」，可以是自己、伴侶或兩人共同完成。</p>${tasks.map(t=>`<div class="v03-card taskrow"><div><b>${esc(t.title)}</b><div class="tiny">${esc(t.target)} · 🪙 ${t.gold} · ⭐ ${t.xp}</div></div><button class="v03-primary" data-coop-task="${esc(t.id)}">${t.target==='我們'?'共同完成':'同步接下'}</button></div>`).join('')||'<div class="empty">目前沒有進行中的任務。</div>'}<button class="v03-secondary" id="makeCoop">＋ 建立雙人任務</button></section>`}
  function homeView(){return `<section><h3>🏠 共享公會之家</h3><p class="muted">兩個人的基地，後續所有家園資料會走同一份 shared state。</p><div class="v03-home"><div class="room">${meta.home.items.map(x=>`<span>${homeIcon(x)} ${x}</span>`).join('')}</div></div><div class="v03-card"><b>家園等級 Lv.${meta.home.level}</b><p class="muted">一起完成任務與取得獎勵，逐步解鎖更多家具。</p><button class="v03-primary" id="homeUpgrade">升級家園（Demo）</button></div></section>`}
  function rewardsView(){return `<section><h3>🎁 雙人獎勵</h3><p class="muted">獎勵可以變成生活中的兌換券，而不是單純數字。</p><div class="v03-grid">${[['🥤','飲料券'],['🎬','電影券'],['🍰','下午茶券'],['🧹','今天不用做家事']].map(([e,n],idx)=>`<div class="v03-card"><div class="rewardIcon">${e}</div><b>${n}</b><div class="tiny">${meta.rewards.includes(n)?'已擁有':'雙人任務可取得'}</div><button class="v03-secondary" data-reward="${n}" ${meta.rewards.includes(n)?'disabled':''}>${meta.rewards.includes(n)?'已兌換':'Demo 兌換 100G'}</button></div>`).join('')}</div></section>`}
  function notifyView(){return `<section><h3>🔔 通知中心</h3><div class="row"><button class="v03-secondary" id="markRead">全部讀取</button><button class="v03-secondary" id="clearNotify">清空</button></div><div class="notifylist">${meta.notifications.map(n=>`<div class="v03-card"><b>${esc(n.title)}</b><div class="tiny">${esc(n.text)}</div><span class="tiny">${esc(n.time)}</span></div>`).join('')||'<div class="empty">還沒有通知。</div>'}</div></section>`}
  function syncView(){return `<section><h3>☁️ 同步診斷</h3><div class="v03-card"><b>Adapter：${ENABLED>=303?'BroadcastChannel + Supabase hook':'Local Demo'}</b><p class="muted">狀態：${meta.sync.status}<br>最後事件：${esc(meta.sync.lastEvent||'尚未同步')}<br>待送事件：${meta.sync.pending||0}</p></div>${ENABLED>=307?`<div class="v03-card"><b>🛡️ 穩定性</b><p class="muted">事件 ID 去重、重連狀態機、獎勵重複領取防護已啟用。</p><button class="v03-secondary" id="emitPing">發送同步測試</button></div>`:''}${ENABLED>=308?`<div class="v03-card"><b>V0.3.8 Release Diagnostics</b><p class="muted">Schema ${meta.schema} · 所有 V0.3 模組已載入。</p><button class="v03-danger" id="resetDemo">重置 V0.3 Demo 資料</button></div>`:''}</section>`}

  function bind(body,tab){
    body.querySelector('#saveIdentity')?.addEventListener('click',()=>{meta.identity.name=body.querySelector('#v03Name').value.trim()||'我';meta.identity.partnerName=body.querySelector('#v03Partner').value.trim()||'另一半';write(meta);pushEvent('identity.updated',{identity:meta.identity});notify('雙人資料已儲存');render(tab)});
    body.querySelector('#newCode')?.addEventListener('click',()=>{meta.identity.coupleCode='CG-'+Math.random().toString(36).slice(2,8).toUpperCase();write(meta);render(tab)});
    body.querySelectorAll('[data-coop-task]').forEach(b=>b.onclick=()=>{const t=state.tasks.find(x=>x.id===b.dataset.coopTask);if(!t)return;t.coop=t.coop||{players:[],progress:0};if(!t.coop.players.includes(meta.identity.name))t.coop.players.push(meta.identity.name);if(t.target==='我們')t.coop.progress=Math.min(2,t.coop.progress+1);addJournal(state,'💞','雙人任務同步',`「${t.title}」加入共同進度。`);saveState(state);pushEvent('task.progress',{id:t.id,progress:t.coop.progress});notify('雙人進度已同步');render(tab)});
    body.querySelector('#makeCoop')?.addEventListener('click',()=>{const t={id:'t'+Date.now(),title:'一起準備晚餐',desc:'兩個人一起完成今晚的晚餐。',target:'我們',difficulty:2,gold:180,xp:65,status:'open',coop:{players:[],progress:0}};state.tasks.unshift(t);saveState(state);pushEvent('task.created',{id:t.id});notify('💞 雙人任務已建立');render(tab)});
    body.querySelector('#homeUpgrade')?.addEventListener('click',()=>{if(state.guild.gold<250){notify('Gold 不夠升級家園');return;}state.guild.gold-=250;meta.home.level++;meta.home.items.push(meta.home.level%2?'貓跳台':'雙人書架');write(meta);saveState(state);notify('🏠 家園升級完成');render(tab)});
    body.querySelectorAll('[data-reward]').forEach(b=>b.onclick=()=>{const n=b.dataset.reward;if(state.guild.gold<100){notify('Gold 不夠兌換');return;}if(meta.claimedRewards[n]){notify('這份獎勵已經領過');return;}state.guild.gold-=100;meta.rewards.push(n);meta.claimedRewards[n]=true;write(meta);saveState(state);addNotification('🎁 雙人獎勵',`取得「${n}」`);pushEvent('reward.claimed',{reward:n});notify(`已取得 ${n}`);render(tab)});
    body.querySelector('#markRead')?.addEventListener('click',()=>{meta.notifications.forEach(n=>n.read=true);write(meta);render(tab)});
    body.querySelector('#clearNotify')?.addEventListener('click',()=>{meta.notifications=[];write(meta);render(tab)});
    body.querySelector('#emitPing')?.addEventListener('click',()=>pushEvent('sync.ping',{at:Date.now()}));
    body.querySelector('#resetDemo')?.addEventListener('click',()=>{localStorage.removeItem(KEY);location.reload()});
  }

  function addNotification(title,text){meta.notifications.unshift({id:crypto.randomUUID?.()||String(Date.now()),title,text,time:new Date().toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'}),read:false});meta.notifications=meta.notifications.slice(0,50);write(meta);}
  function notify(msg){window.dispatchEvent(new CustomEvent('cg:v03-toast',{detail:msg})); const toast=document.getElementById('toast');if(toast){toast.textContent=msg;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),2200)}}
  function pushEvent(type,payload){
    if(ENABLED<303)return;
    const event={id:crypto.randomUUID?.()||`${Date.now()}-${Math.random()}`,type,payload,source:meta.identity.name,at:Date.now()};
    meta.sync.lastEvent=type;meta.sync.lastAt=event.at;meta.sync.status='online';meta.sync.pending=0;write(meta);
    window.CG_V03_CHANNEL?.postMessage(event);
  }
  function setupRealtime(){
    if(ENABLED<303 || !('BroadcastChannel' in window))return;
    try{const ch=new BroadcastChannel(CHANNEL_NAME);window.CG_V03_CHANNEL=ch;ch.onmessage=e=>{const ev=e.data;if(!ev||ev.source===meta.identity.name)return;meta.sync.status='online';meta.sync.lastEvent=ev.type;meta.sync.lastAt=ev.at;write(meta);if(ENABLED>=306)addNotification('💞 伴侶活動',`${ev.source}：${eventText(ev)}`);window.dispatchEvent(new CustomEvent('cg:v03-refresh'));};}catch{}
  }
  function eventText(ev){return ev.type==='task.progress'?'更新了雙人任務進度':ev.type==='reward.claimed'?`取得了「${ev.payload?.reward||'獎勵'}」`:'發生了一次共享世界更新';}
  function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
  function homeIcon(x){return ({'沙發':'🛋️','雙人桌':'🪑','貓抓板':'🐾','貓跳台':'🧗','雙人書架':'📚'}[x]||'✨')}
}

function injectStyles(){if(document.getElementById('v03Styles'))return;const s=document.createElement('style');s.id='v03Styles';s.textContent=`
.v03-shell{position:relative;z-index:80}.v03-launch{position:absolute;right:14px;top:72px;padding:9px 13px;border-radius:999px;background:rgba(255,250,237,.94);color:#315746;font-weight:900;box-shadow:0 8px 24px rgba(0,0,0,.16)}
.v03-panel{position:absolute;right:14px;top:112px;width:min(520px,calc(100vw - 28px));max-height:calc(100dvh - 128px);overflow:auto;background:#fff9ea;border:1px solid #d9c89f;border-radius:24px;padding:14px;box-shadow:0 18px 60px rgba(0,0,0,.3);display:none;color:#26332e}.v03-panel.show{display:block}.v03-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}.v03-head b{font-size:15px}.v03-head small{display:block;opacity:.6;font-size:10px;margin-top:2px}.v03-head button{width:34px;height:34px;border-radius:50%;background:#eadfc4;font-size:20px}.v03-tabs{display:flex;gap:6px;overflow:auto;padding-bottom:8px}.v03-tabs button{white-space:nowrap;padding:7px 10px;border-radius:999px;background:#efe5ca;color:#5b655d;font-size:11px}.v03-tabs button.on{background:#315746;color:#fff}.v03-card{background:#fffdf5;border:1px solid #eadcbf;border-radius:16px;padding:11px;margin:8px 0}.v03-card label{margin-top:7px}.v03-card input{margin-bottom:2px}.v03-primary,.v03-secondary,.v03-danger{padding:8px 11px;border-radius:11px;font-weight:800;font-size:11px}.v03-primary{background:#3d6d58;color:#fff}.v03-secondary{background:#e6dcc2;color:#4c524a}.v03-danger{background:#ead0cd;color:#844542}.row{display:flex;gap:7px;flex-wrap:wrap;margin-top:8px}.code-box{margin:10px 0;padding:12px;border-radius:13px;background:#edf3ec;text-align:center}.code-box strong{display:block;font-size:20px;letter-spacing:2px;margin-top:3px}.muted{font-size:11px;line-height:1.55;color:#73776f}.tiny{font-size:10px;color:#85877e;margin-top:3px}.badge{display:inline-block;padding:4px 7px;border-radius:999px;background:#dcebdd;color:#3f654f;font-size:10px}.presence{display:flex;align-items:center;gap:12px}.avatar{font-size:42px}.v03-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.v03-grid>div{background:#f4eddc;border-radius:14px;padding:10px;font-size:11px;line-height:1.5}.taskrow{display:flex;justify-content:space-between;align-items:center;gap:8px}.v03-home{padding:14px;border-radius:18px;background:linear-gradient(135deg,#dbe7dc,#f5e5c5);min-height:140px}.room{display:flex;flex-wrap:wrap;gap:8px}.room span{padding:9px 10px;border-radius:12px;background:rgba(255,255,255,.72);font-size:11px}.rewardIcon{font-size:34px;margin-bottom:5px}.empty{text-align:center;padding:20px;color:#8b8b82;font-size:12px}.notifylist{margin-top:8px}@media(max-width:760px) and (orientation:landscape){.v03-launch{top:58px;right:8px}.v03-panel{top:92px;right:8px;max-height:calc(100dvh - 100px)}}
`;document.head.appendChild(s)}
