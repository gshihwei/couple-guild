import { Multiplayer } from './multiplayer.js';
import { FEATURES, CG_VERSION } from './version.js';

export function initMultiplayer(state,game,ui){
  const mp=new Multiplayer(state,{status:s=>renderStatus(s),invite:c=>inviteOut.textContent=c,presence:p=>applyPresence(p),data:(t,p)=>handleData(t,p),resync:()=>syncAll(),error:e=>msg('同步連線異常：'+(e?.message||e),'error')});
  const style=document.createElement('style'); style.textContent=`#mp-panel{position:fixed!important;left:0!important;top:0!important;right:0!important;bottom:0!important;width:100vw!important;height:100dvh!important;max-width:none!important;max-height:none!important;margin:0!important;border-radius:0!important;z-index:200!important;padding:0!important;overflow:auto;display:none;background:#fff9ea}#mp-panel.open{display:block}.mp-shell{min-height:100%;padding:max(16px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) max(24px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left));max-width:1100px;margin:auto}.mp-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.mp-status{padding:10px 12px;border-radius:14px;background:#e7efea;margin-bottom:10px}.mp-code{font-size:28px;letter-spacing:5px;font-weight:900;text-align:center;padding:14px;background:#f6e2b9;border-radius:16px;margin:8px 0}.mp-list{max-height:none;overflow:auto}.mp-row{display:flex;justify-content:space-between;gap:10px;padding:12px;border-bottom:1px solid #eadcbf}.mp-unread{font-weight:900}.mp-muted{font-size:11px;opacity:.65}.mp-home-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.mp-home-item{padding:10px;border:1px solid #eadcbf;border-radius:12px;background:#fffaf0}.mp-home-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:8px}.mp-reward-form{display:grid;gap:8px;margin-top:8px}.mp-error{color:#8b4542;font-size:12px;margin-top:8px}.mp-ok{color:#3f654f;font-size:12px}.mp-panel-card{border-radius:22px}.mp-notification-focus{outline:3px solid #d59a58;outline-offset:2px}.mp-reconfigure{font-size:11px}.mp-settings-msg{font-size:12px;margin-top:6px}@media(max-width:760px){.mp-shell{padding:12px 12px 22px}.mp-grid{grid-template-columns:1fr}.mp-code{font-size:24px}.mp-home-grid{grid-template-columns:1fr 1fr}}`; document.head.appendChild(style);
  const nav=document.createElement('button'); nav.className='nav-btn'; nav.dataset.nav='multiplayer'; nav.innerHTML='<span class="nav-icon">👥</span>雙人'; document.querySelector('.bottom-nav').appendChild(nav);
  const panel=document.createElement('div'); panel.id='mp-panel'; panel.className='glass'; panel.innerHTML=`<div class="mp-shell"><div class="panel-head"><div><h2>👥 Couple Guild Multiplayer</h2><div class="section-note">真正跨手機共享：登入、邀請碼、Realtime、獎勵與通知。</div></div><button class="close" id="mp-close">×</button></div>
  <div class="mp-status" id="mp-status">⚪ 尚未連線</div>
  <div class="card mp-panel-card"><b>☁️ Supabase 設定</b><label>Project URL</label><input id="mp-url" placeholder="https://xxxx.supabase.co"><label>Anon Key</label><input id="mp-key" placeholder="eyJ..."><div class="modal-actions"><button class="primary" id="mp-connect">連線／匿名登入</button><button class="secondary mp-reconfigure" id="mp-reconfigure">重新設定</button></div><div class="mp-muted">兩支手機必須使用同一個 Supabase Project。Anon key 可公開放在前端；資料權限由 RLS 控制。</div><div id="mp-msg"></div></div>
  <div class="card mp-panel-card"><b>🏰 公會配對</b><div class="mp-grid"><div><label>你的名字</label><input id="mp-name" value="我"></div><div><label>公會名稱</label><input id="mp-guild" value="星光旅團"></div></div><div class="modal-actions"><button class="primary" id="mp-create">建立公會＋邀請碼</button></div><div class="mp-code" id="mp-invite">------</div><label>另一半邀請碼</label><input id="mp-join-code" maxlength="6" placeholder="輸入 6 碼"><div class="modal-actions"><button class="secondary" id="mp-join">加入這個公會</button></div></div>
  <div class="card mp-panel-card" id="mp-settings-card" style="display:none"><b>⚙️ 帳號／公會設定</b><div class="mp-grid"><div><label>角色名稱</label><input id="mp-settings-name" maxlength="20" placeholder="你的角色名稱"></div><div><label>公會名稱（會長）</label><input id="mp-settings-guild" maxlength="30" placeholder="公會名稱"></div></div><div class="modal-actions"><button class="primary" id="mp-save-profile">儲存設定</button><button class="secondary" id="mp-refresh-members">更新成員</button></div><div id="mp-settings-msg"></div><div style="margin-top:12px"><b>👥 公會成員</b><div id="mp-members" class="mp-list"><div class="mp-muted">載入中…</div></div></div><div class="modal-actions" style="margin-top:12px"><button class="secondary" id="mp-leave-guild">離開公會</button></div></div>
  <div class="card mp-panel-card" id="mp-reward-card"><b>🎁 雙人獎勵</b><div id="mp-rewards" class="mp-list"><div class="mp-muted">加入公會後載入共享獎勵。</div></div><div class="mp-reward-form"><input id="mp-reward-title" placeholder="例如：今天不用做家事"><input id="mp-reward-desc" placeholder="獎勵說明（選填）"></div><div class="modal-actions"><button class="secondary" id="mp-add-reward">新增情侶兌換券</button></div></div>
  <div class="card mp-panel-card" id="mp-notification-card"><button class="secondary" id="mp-open-notifications" style="width:100%;text-align:left;font-weight:900;font-size:16px">🔔 通知中心</button><div id="mp-notes" class="mp-list"><div class="mp-muted">加入公會後載入通知。</div></div></div>
  <div class="card mp-panel-card" id="mp-home-card"><b>🏠 公會之家</b><div id="mp-home" class="mp-muted">加入公會後，兩台手機會共享同一個家園。</div><div id="mp-home-state" class="mp-home-grid"></div><div class="mp-home-actions"><button class="secondary" id="mp-home-add-chair">🪑 放一張椅子</button><button class="secondary" id="mp-home-add-plant">🪴 放一盆植物</button><button class="secondary" id="mp-home-save">同步家園</button></div></div></div>`; document.getElementById('app').appendChild(panel);
  const $=id=>document.getElementById(id), status=$('mp-status'), inviteOut=$('mp-invite');
  const guildCard=panel.querySelector('.mp-panel-card:nth-of-type(2)');
  const settingsCard=$('mp-settings-card');
  const settingsMsg=t=>{ $('mp-settings-msg').className=t?'mp-ok':''; $('mp-settings-msg').textContent=t||''; };
  const syncUi=()=>{ const joined=!!mp.guildId && !!mp.user; if(guildCard) guildCard.style.display=joined?'none':''; if(settingsCard) settingsCard.style.display=joined?'block':'none'; const cfg=panel.querySelector('.mp-panel-card'); if(cfg){ const title=cfg.querySelector('b'); if(title) title.textContent=joined?'☁️ 已自動連線':'☁️ Supabase 設定'; } if(joined){ $('mp-connect').textContent='已自動連線'; $('mp-connect').disabled=true; $('mp-url').disabled=true; $('mp-key').disabled=true; $('mp-reconfigure').textContent='重新設定'; $('mp-reconfigure').style.display='inline-flex'; $('mp-settings-name').value=state.player.name||''; $('mp-settings-guild').value=state.guild.name||''; refreshMembers().catch(()=>{}); } };
  nav.onclick=()=>{const opening=!panel.classList.contains('open'); panel.classList.toggle('open',opening); document.getElementById('app')?.classList.toggle('feature-mode',opening); document.body.classList.toggle('workspace-mode',opening);};
  if(!FEATURES.coupleRewards) $('mp-reward-card').style.display='none';
  if(!FEATURES.notifications) $('mp-notification-card').style.display='none';
  if(!FEATURES.guildHome) $('mp-home-card').style.display='none'; $('mp-close').onclick=()=>{panel.classList.remove('open');document.getElementById('app')?.classList.remove('feature-mode');document.body.classList.remove('workspace-mode');};
  $('mp-url').value=mp.config().url; $('mp-key').value=mp.config().key;
  const savedConfig=mp.config();
  const hasSavedConfig=!!(savedConfig.url&&savedConfig.key);
  if(hasSavedConfig){ $('mp-url').disabled=true; $('mp-key').disabled=true; $('mp-connect').textContent='重新連線'; $('mp-reconfigure').style.display='inline-flex'; } else { $('mp-reconfigure').style.display='none'; }
  $('mp-reconfigure').onclick=()=>{ $('mp-url').disabled=false; $('mp-key').disabled=false; $('mp-connect').disabled=false; $('mp-connect').textContent='儲存設定並連線'; $('mp-reconfigure').style.display='none'; if(guildCard) guildCard.style.display=''; msg('已開放設定欄位，修改後按「儲存設定並連線」。','ok'); };
  const autoReconnect=async()=>{ if(!hasSavedConfig)return; try{ await mp.connect(); if(mp.guildId){ const data=await mp.loadInitial(); hydrate(data); syncUi(); msg('已自動恢復登入與公會，不需要重新輸入。','ok'); } else { syncUi(); msg('已自動登入，尚未加入公會。','ok'); } }catch(e){ msg('自動恢復失敗，請檢查網路或按重新連線：'+(e?.message||e),'error'); } };
  setTimeout(autoReconnect,80);
  $('mp-connect').onclick=async()=>{try{mp.saveConfig($('mp-url').value.trim(),$('mp-key').value.trim());await mp.connect();const data=mp.guildId?await mp.loadInitial():null;if(data)hydrate(data);syncUi();msg(mp.guildId?'已恢復上次公會。':'Supabase 連線成功。','ok');}catch(e){msg(e.message,'error');}};
  $('mp-create').onclick=async()=>{try{await mp.createGuild($('mp-guild').value.trim()||'星光旅團',$('mp-name').value.trim()||'我');syncUi();msg('公會建立完成。之後會自動記住，不需要再次輸入。','ok');}catch(e){msg(e.message,'error');}};
  $('mp-join').onclick=async()=>{try{await mp.joinGuild($('mp-join-code').value,$('mp-name').value.trim()||'另一半');const d=await mp.loadInitial();hydrate(d);syncUi();msg('已加入同一個 Couple Guild。之後會自動恢復。','ok');}catch(e){msg(e.message,'error');}};
  $('mp-open-notifications').onclick=()=>{ const card=$('mp-notification-card'); card.scrollIntoView({behavior:'smooth',block:'start'}); card.classList.add('mp-notification-focus'); setTimeout(()=>card.classList.remove('mp-notification-focus'),900); };
  $('mp-save-profile').onclick=async()=>{try{const name=$('mp-settings-name').value.trim();const guildName=$('mp-settings-guild').value.trim();if(!name)throw new Error('角色名稱不能空白');if(!guildName)throw new Error('公會名稱不能空白');await mp.saveAccountGuildSettings(name,guildName);ui.refresh?.();await refreshMembers();syncUi();settingsMsg('設定已儲存，另一台手機會同步更新。');}catch(e){const msg=e?.message||String(e);settingsMsg(msg.includes('Could not find the function')||msg.includes('schema cache')?'⚠️ 請先在 Supabase SQL Editor 執行 ZIP 內的 v038-migration.sql，再重新整理遊戲。':'⚠️ '+msg);}};
  $('mp-refresh-members').onclick=async()=>{try{await refreshMembers();settingsMsg('成員資料已更新。');}catch(e){settingsMsg('⚠️ '+(e?.message||e));}};
  $('mp-leave-guild').onclick=async()=>{if(!confirm('確定要離開目前公會嗎？離開後需要新的邀請碼才能加入。'))return;try{await mp.leaveGuild();state.partner.remote=false;syncUi();ui.refresh?.();msg('已離開公會。','ok');}catch(e){settingsMsg('⚠️ '+(e?.message||e));}};
  $('mp-add-reward').onclick=async()=>{try{const title=$('mp-reward-title').value.trim()||'今天不用做家事';const description=$('mp-reward-desc').value.trim()||'把這張券送給另一半，今天由你包辦。';await mp.createReward({title,description,cost:0,kind:'voucher'});$('mp-reward-title').value='';$('mp-reward-desc').value='';await refreshRewards();msg('雙人獎勵已建立。','ok');}catch(e){msg(e.message,'error');}};
  $('mp-home-save').onclick=async()=>{try{if(!mp.guildId)return;await saveHome();msg('家園狀態已同步。','ok');}catch(e){msg(e.message,'error');}};
  $('mp-home-add-chair').onclick=()=>addFurniture('chair','🪑 椅子');
  $('mp-home-add-plant').onclick=()=>addFurniture('plant','🪴 植物');
  window.addEventListener('online',async()=>{ try{ await mp.flushQueue(); await mp.refreshSession(); await syncAll(); }catch(e){ msg('恢復連線失敗：'+(e?.message||e),'error'); } });
  window.addEventListener('offline',()=>renderStatus('offline'));
  if(FEATURES.reliability) setInterval(()=>{ if(mp.guildId&&navigator.onLine){ mp.refreshSession().catch(()=>{}); if(!mp.connected) mp.scheduleReconnect(); } },15000);
  if(FEATURES.sharedWorld) setInterval(()=>pollPlayers(),1000);
  if(FEATURES.sharedTasks) setInterval(()=>pollTasks(),1000);
  if(FEATURES.guildHome) setInterval(()=>pollHome(),1200);
  if(FEATURES.coupleRewards) setInterval(()=>refreshRewards(),1000);
  if(FEATURES.notifications) setInterval(()=>pollNotifications(),1000);
  if(FEATURES.reliability) setInterval(()=>{ if(mp.guildId&&navigator.onLine) syncAll(); },5000);
  function currentHome(){
    const raw=state.guildHome||{};
    return {version:Number(raw.version)||1,level:Number(raw.level)||1,furniture:Array.isArray(raw.furniture)?raw.furniture:[]};
  }
  function renderHome(home){
    if(!FEATURES.guildHome)return;
    state.guildHome={version:Number(home?.version)||1,level:Number(home?.level)||1,furniture:Array.isArray(home?.furniture)?home.furniture:[]};
    const box=$('mp-home-state'); if(!box)return;
    const h=state.guildHome;
    box.innerHTML=`<div class=\"mp-home-item\"><b>🏠 家園 Lv.${h.level}</b><div class=\"mp-muted\">共享家園狀態</div></div><div class=\"mp-home-item\"><b>🪑 家具 ${h.furniture.length} 件</b><div class=\"mp-muted\">${h.furniture.length?h.furniture.map(esc).join('、'):'目前還是空的'}</div></div>`;
    $('mp-home').textContent=`🏠 最後由 ${h.updatedByName||'公會成員'} 更新 · ${h.updatedAt?new Date(h.updatedAt).toLocaleString('zh-TW'):'尚未同步'}`;
  }
  function addFurniture(type,label){
    const h=currentHome(); h.furniture=[...h.furniture,label]; h.updatedByName=state.player.name||'公會成員'; h.updatedAt=new Date().toISOString(); state.guildHome=h; renderHome(h);
    saveHome().then(()=>msg(`${label} 已放入公會之家。`,'ok')).catch(e=>msg(e.message,'error'));
  }
  async function saveHome(){
    const h=currentHome(); h.updatedByName=state.player.name||'公會成員'; h.updatedAt=new Date().toISOString(); state.guildHome=h;
    homeWriteAt=Date.now(); await mp.updateGuildHome(h); homeWriteAt=Date.parse(h.updatedAt)||homeWriteAt; renderHome(h);
  }
  let homeWriteAt=0;
  async function pollHome(){ try{ if(!mp.guildId)return; const row=await mp.getGuildHome(); if(row?.state){ const incoming=row.state; const current=state.guildHome||{}; const a=Date.parse(incoming.updatedAt||0)||0; const b=Date.parse(current.updatedAt||0)||0; if(homeWriteAt && a < homeWriteAt)return; if(a>=b || (!b && JSON.stringify(incoming.furniture||[])!==JSON.stringify(current.furniture||[]))){ renderHome(incoming); ui.refresh?.(); } } }catch(e){ /* realtime remains primary; polling is fallback */ } }
  function renderStatus(s){status.textContent=s==='online'?'🟢 已連線 · Supabase Realtime':s==='offline-queued'?'🟠 離線，事件已排隊':s==='offline'?'🟠 目前離線，恢復網路後自動同步':s==='channel_error'||s==='timed_out'||s==='closed'?'🟡 Realtime 斷線，正在自動重連…':s==='signed-out'?'🟠 登入已失效，正在恢復…':s==='SUBSCRIBED'?'🟢 Realtime 已訂閱':'⚪ '+s;}
  let syncBusy=false;
  async function syncAll(){ if(syncBusy||!mp.guildId||!mp.client||!navigator.onLine)return; syncBusy=true; try{ const d=await mp.loadInitial(); hydrate(d); }catch(e){ /* keep realtime/polling alive; next cycle retries */ } finally{syncBusy=false;} }
  function msg(t,c){$('mp-msg').className=c==='ok'?'mp-ok':'mp-error';$('mp-msg').textContent=t;}
  function applyPresence(p){
    state.remotePlayers=state.remotePlayers||{};
    const others=Object.values(p).flat().filter(x=>x?.user_id&&x.user_id!==mp.user?.id);
    for(const o of others){ state.remotePlayers[o.user_id]={...(state.remotePlayers[o.user_id]||{}),user_id:o.user_id,name:o.name||state.remotePlayers[o.user_id]?.name||'玩家',x:Number(o.x)||0,y:Number(o.y)||0,updated_at:o.updated_at||null,remote:true}; }
    syncPrimaryPartner();
    ui.refresh?.();
  }
  function handleData(table,p){
    if(table==='tasks'){
      const row=p?.new||p?.old;
      if(p?.eventType==='DELETE' || (p?.old && !p?.new)){
        if(row?.id) state.tasks=state.tasks.filter(t=>t.id!==row.id);
      } else if(row){
        const mapped={id:row.id,title:row.title,desc:row.description||'',target:(row.assignee_id&&row.assignee_id===mp.user?.id)?'我':(row.assignee_id?'另一半':(row.metadata?.localTarget || (row.assignee_type==='couple'?'我們':'另一半'))),difficulty:Number(row.metadata?.difficulty)||1,gold:Number(row.gold)||0,xp:Number(row.xp)||0,status:row.status,creatorId:row.creator_id,assigneeId:row.assignee_id,acceptedAt:row.metadata?.acceptedAt||null,acceptedBy:row.metadata?.acceptedBy||null,completedAt:row.completed_at||null,completedBy:row.metadata?.completedBy||null,remote:true};
        const idx=state.tasks.findIndex(t=>t.id===row.id);
        if(idx>=0) state.tasks[idx]={...state.tasks[idx],...mapped}; else state.tasks.unshift(mapped);
      }
      ui.refresh?.();
    }
    if(table==='player_states'){
      const row=p?.new||p?.old;
      if(row?.user_id && row.user_id!==mp.user?.id){
        state.remotePlayers=state.remotePlayers||{};
        if(p?.eventType==='DELETE' || (p?.old && !p?.new)) delete state.remotePlayers[row.user_id];
        else state.remotePlayers[row.user_id]={user_id:row.user_id,name:row.display_name||'玩家',x:Number(row.x)||0,y:Number(row.y)||0,updated_at:row.updated_at||null,remote:true};
        syncPrimaryPartner();
        ui.refresh?.();
      }
    }
    if(table==='guilds'){
      const row=p?.new||p?.old;
      if(row?.id===mp.guildId && row.name){
        state.guild.name=row.name;
        $('mp-settings-guild').value=row.name;
        ui.refresh?.();
      }
    }
    if(table==='guild_members'){
      const row=p?.new||p?.old;
      if(row?.user_id===mp.user?.id && row.display_name) { state.player.name=row.display_name; $('mp-settings-name').value=row.display_name; }
      if(row?.user_id && row.user_id!==mp.user?.id && row.display_name){ state.remotePlayers=state.remotePlayers||{}; const rp=state.remotePlayers[row.user_id]||{user_id:row.user_id,x:state.partner.x,y:state.partner.y}; rp.name=row.display_name; state.remotePlayers[row.user_id]=rp; syncPrimaryPartner(); }
      refreshMembers().catch(()=>{}); ui.refresh?.();
    }
    if(table==='guild_home'){ const row=p?.new||p?.old; if(row?.state){ renderHome(row.state); } }
    if(table==='notifications'&&p.new?.user_id===mp.user?.id){ hydrateNotifications([p.new]); pollNotifications(); }
    if(table==='couple_rewards'){
      const row=p?.new||p?.old;
      if(p?.eventType==='DELETE' && row?.id){ refreshRewards(); }
      else if(row?.id){ refreshRewards(); }
    }}
  async function refreshMembers(){
    if(!mp.guildId||!mp.client)return;
    const rows=await mp.listMembers();
    const box=$('mp-members'); box.innerHTML='';
    const me=rows.find(m=>m.user_id===mp.user?.id);
    const isOwner=me?.role==='owner';
    $('mp-settings-guild').disabled=!isOwner;
    $('mp-settings-guild').placeholder=isOwner?'公會名稱':'只有會長可以修改公會名稱';
    $('mp-leave-guild').disabled=isOwner;
    $('mp-leave-guild').title=isOwner?'會長不能直接離開公會':'離開目前公會';
    if(!rows.length){box.innerHTML='<div class="mp-muted">目前沒有成員資料。</div>';return;}
    for(const m of rows){
      const el=document.createElement('div'); el.className='mp-row';
      const mine=m.user_id===mp.user?.id;
      const role=m.role==='owner'?'會長':'成員';
      el.innerHTML=`<div><b>${esc(m.display_name||'玩家')}${mine?'（你）':''}</b><div class="mp-muted">${role}</div></div><span class="pill">${role==='會長'?'👑':'👥'}</span>`;
      box.appendChild(el);
    }
  }
  async function pollNotifications(){
    if(!mp.guildId||!mp.client)return;
    try{
      const r=await mp.client.from('notifications').select('*').eq('guild_id',mp.guildId).eq('user_id',mp.user.id).order('created_at',{ascending:false}).limit(50);
      if(r.error){msg('通知同步失敗：'+r.error.message,'error');return;}
      hydrateNotifications(r.data||[]);
    }catch(e){msg('通知同步失敗：'+(e?.message||e),'error');}
  }
  async function pollTasks(){
    if(!mp.guildId||!mp.client)return;
    try{
      const r=await mp.client.from('tasks').select('*').eq('guild_id',mp.guildId).order('created_at',{ascending:false});
      if(r.error){msg('共享任務同步失敗：'+r.error.message,'error');return;}
      applyTaskRows(r.data||[]);
    }catch(e){msg('共享任務同步失敗：'+(e?.message||e),'error');}
  }
  function applyTaskRows(rows){
    const mapped=rows.map(task=>({
      id:task.id,title:task.title,desc:task.description||'',
      target:(task.assignee_id && task.assignee_id===mp.user?.id)?'我':(task.assignee_id?'另一半':(task.metadata?.localTarget || (task.assignee_type==='couple'?'我們':'另一半'))),
      difficulty:Number(task.metadata?.difficulty)||1,gold:Number(task.gold)||0,xp:Number(task.xp)||0,
      status:task.status,creatorId:task.creator_id,assigneeId:task.assignee_id,
      acceptedAt:task.metadata?.acceptedAt||null,acceptedBy:task.metadata?.acceptedBy||null,completedAt:task.completed_at||null,completedBy:task.metadata?.completedBy||null,
      remote:true
    }));
    state.tasks=mapped;
    ui.refresh?.();
  }
  async function pollPlayers(){if(!mp.guildId||!mp.client)return; try{const r=await mp.client.from('player_states').select('*').eq('guild_id',mp.guildId); if(r.error){msg('玩家位置同步失敗：'+r.error.message,'error');return;} applyPlayerRows(r.data||[]);}catch(e){msg('玩家位置同步失敗：'+(e?.message||e),'error');}}
  function syncPrimaryPartner(){
    const list=Object.values(state.remotePlayers||{}).filter(x=>x&&x.user_id&&x.user_id!==mp.user?.id);
    list.sort((a,b)=>String(a.user_id).localeCompare(String(b.user_id)));
    const o=list[0];
    if(o){state.partner.name=o.name||'另一半';state.partner.x=Number(o.x)||0;state.partner.y=Number(o.y)||0;state.partner.remote=true;}
    else {state.partner.remote=false;}
  }
  function applyPlayerRows(rows){
    state.remotePlayers={};
    for(const x of rows||[]){
      if(!x?.user_id || x.user_id===mp.user?.id) continue;
      state.remotePlayers[x.user_id]={user_id:x.user_id,name:x.display_name||'玩家',x:Number(x.x)||0,y:Number(x.y)||0,updated_at:x.updated_at||null,remote:true};
    }
    syncPrimaryPartner();
    ui.refresh?.();
  }
  function hydrate(d){
    if(!d)return;
    if(d.guild?.name)state.guild.name=d.guild.name;
    if(d.members?.length){
      const me=d.members.find(x=>x.user_id===mp.user?.id);
      if(me?.display_name)state.player.name=me.display_name;
      state.remotePlayers=state.remotePlayers||{};
      for(const m of d.members){
        if(m.user_id===mp.user?.id)continue;
        const rp=state.remotePlayers[m.user_id]||{user_id:m.user_id,x:1900,y:1320,remote:true};
        rp.name=m.display_name||rp.name||'玩家';
        state.remotePlayers[m.user_id]=rp;
      }
      syncPrimaryPartner();
    }
    if(FEATURES.sharedTasks) applyTaskRows(d.tasks||[]);
    applyPlayerRows(d.players||[]);
    // applyPlayerRows contains the authoritative player-state set; restore member names for players without a state row.
    if(d.members?.length){ for(const m of d.members){ if(m.user_id!==mp.user?.id && state.remotePlayers?.[m.user_id]) state.remotePlayers[m.user_id].name=m.display_name||state.remotePlayers[m.user_id].name||'玩家'; } syncPrimaryPartner(); }
    renderRewards(d.rewards||[]);hydrateNotifications(d.notifications||[]); if(d.home){ renderHome(d.home.state||{}); } else if(FEATURES.guildHome){ renderHome(currentHome()); } ui.refresh?.();
  }
  function renderRewards(rows){const box=$('mp-rewards');box.innerHTML='';const list=rows.filter(Boolean);if(!list.length){box.innerHTML='<div class="mp-muted">目前還沒有情侶獎勵。</div>';return;}for(const r of list){const el=document.createElement('div');el.className='mp-row';const status=r.status==='available'?'可兌換':r.status==='redeemed'?'已兌換':r.status;el.innerHTML=`<div><b>🎁 ${esc(r.title)}</b><div class="mp-muted">${esc(r.description||'')} · ${status}</div></div><button class="secondary" ${r.status!=='available'?'disabled':''}>${r.status==='redeemed'?'已兌換':'兌換'}</button>`;const btn=el.querySelector('button');btn.disabled=r.status!=='available';btn.onclick=async()=>{try{await mp.redeemReward(r.id);await refreshRewards();msg('兌換成功，已寫入共享資料。','ok');}catch(e){msg(e.message,'error');}};box.appendChild(el);}}
  async function refreshRewards(){if(!FEATURES.coupleRewards||!mp.guildId||!mp.client)return;try{const r=await mp.client.from('couple_rewards').select('*').eq('guild_id',mp.guildId).order('created_at',{ascending:false});if(r.error)throw r.error;renderRewards(r.data||[]);}catch(e){msg('共享獎勵同步失敗：'+(e?.message||e),'error');}}
  function hydrateNotifications(rows){const box=$('mp-notes');box.innerHTML='';for(const n of rows){const el=document.createElement('div');el.className='mp-row '+(!n.read_at?'mp-unread':'');el.innerHTML=`<div><b>${esc(n.title)}</b><div>${esc(n.body)}</div><div class="mp-muted">${new Date(n.created_at).toLocaleString('zh-TW')}</div></div><button class="secondary">${n.read_at?'已讀':'標記已讀'}</button>`;el.querySelector('button').onclick=()=>mp.markNotificationRead(n.id);box.appendChild(el);}}
  function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
  return {mp,applyTaskRows,pollTasks};
}
