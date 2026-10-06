import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { CG_VERSION, FEATURES } from './version.js';

const CFG_KEY='couple-guild-supabase-config';
const LOCAL_KEY='couple-guild-mp-session';
const QUEUE_KEY='couple-guild-offline-queue';

export class Multiplayer {
  constructor(state, callbacks={}){
    this.state=state; this.cb=callbacks; this.client=null; this.user=null; this.guildId=null; this.channel=null; this.connected=false; this.presence={}; this.session=loadJson(LOCAL_KEY,null); this.reconnectPromise=null; this.lastRealtimeStatus='CLOSED'; this.authListener=null;
  }
  config(){ const saved=loadJson(CFG_KEY,{}); return {url:saved.url||window.COUPLE_GUILD_CONFIG?.SUPABASE_URL||'',key:saved.key||window.COUPLE_GUILD_CONFIG?.SUPABASE_ANON_KEY||''}; }
  configured(){ const c=this.config(); return !!(c.url&&c.key); }
  saveConfig(url,key){ localStorage.setItem(CFG_KEY,JSON.stringify({url,key})); }
  async connect(){
    if(this.connected && this.user && this.guildId) return {user:this.user,guildId:this.guildId};
    if(!this.configured()) throw new Error('尚未設定 Supabase URL / Anon Key');
    const c=this.config(); this.client=createClient(c.url,c.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    let {data,error}=await this.client.auth.getSession(); if(error) throw error;
    if(!data.session){ const r=await this.client.auth.signInAnonymously(); if(r.error) throw r.error; data=r.data; }
    this.user=data.session?.user||null; if(!this.user) throw new Error('無法取得登入使用者');
    if(!this.authListener){ this.authListener=this.client.auth.onAuthStateChange((event,session)=>{ if(session?.user){ this.user=session.user; } if(event==='SIGNED_OUT'){ this.connected=false; this.cb.status?.('signed-out'); } }); }
    const saved=this.session||loadJson(LOCAL_KEY,null)||{};
    let membership=null;
    const members=await this.client.from('guild_members').select('guild_id,role,display_name,created_at').eq('user_id',this.user.id).order('created_at',{ascending:false}).limit(20);
    if(!members.error && Array.isArray(members.data) && members.data.length){
      membership=(saved.guildId ? members.data.find(x=>x.guild_id===saved.guildId) : null) || members.data[0];
    }
    if(membership){
      this.guildId=membership.guild_id;
      this.state.player.name=membership.display_name||saved.displayName||this.state.player?.name||'我';
    } else if(saved.inviteCode){
      // Anonymous Auth sessions can disappear on a device/browser reset. Rejoin the last guild automatically.
      const code=String(saved.inviteCode).trim().toUpperCase();
      const joined=await this.client.rpc('join_guild_by_invite',{p_code:code,p_display_name:saved.displayName||this.state.player?.name||'我'});
      if(!joined.error && joined.data){
        this.guildId=joined.data;
        this.state.player.name=saved.displayName||this.state.player?.name||'我';
      }
    }
    if(this.guildId){
      const guild=await this.client.from('guilds').select('name').eq('id',this.guildId).single();
      if(!guild.error && guild.data?.name) this.state.guild.name=guild.data.name;
      localStorage.setItem(LOCAL_KEY,JSON.stringify({...saved,userId:this.user.id,guildId:this.guildId,displayName:this.state.player.name,connectedAt:new Date().toISOString()}));
      this.session=loadJson(LOCAL_KEY,null);
      await this.startRealtime();
    } else {
      // Do not erase the saved guild/invite recovery information just because membership lookup was empty.
      localStorage.setItem(LOCAL_KEY,JSON.stringify({...saved,userId:this.user.id,connectedAt:new Date().toISOString()}));
      this.session=loadJson(LOCAL_KEY,null);
    }
    this.connected=true; this.cb.status?.('online'); return {user:this.user,guildId:this.guildId};
  }
  async createGuild(name='星光旅團',displayName='我'){
    await this.ensure();
    const {data:g,error}=await this.client.from('guilds').insert({name,owner_id:this.user.id}).select().single(); if(error) throw error;
    const {error:me}=await this.client.from('guild_members').insert({guild_id:g.id,user_id:this.user.id,role:'owner',display_name:displayName}); if(me) throw me;
    this.guildId=g.id; this.state.guild.name=g.name||name; this.state.player.name=displayName||'我'; localStorage.setItem(LOCAL_KEY,JSON.stringify({userId:this.user.id,guildId:this.guildId,guildName:this.state.guild.name,displayName:this.state.player.name,connectedAt:new Date().toISOString()})); this.session=loadJson(LOCAL_KEY,null); await this.ensureGuildHome(); await this.issueInvite(); await this.startRealtime(); return g;
  }
  async issueInvite(){
    await this.ensureGuild();
    const code=Array.from(crypto.getRandomValues(new Uint8Array(6))).map(x=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[x%32]).join('');
    const {data,error}=await this.client.from('guild_invites').insert({guild_id:this.guildId,code,created_by:this.user.id}).select().single(); if(error) throw error;
    const saved=loadJson(LOCAL_KEY,{})||{}; localStorage.setItem(LOCAL_KEY,JSON.stringify({...saved,userId:this.user.id,guildId:this.guildId,inviteCode:data.code,displayName:this.state.player.name,connectedAt:new Date().toISOString()})); this.session=loadJson(LOCAL_KEY,null);
    this.cb.invite?.(data.code); return data;
  }
  async joinGuild(code,displayName='另一半'){
    await this.ensure(); code=String(code).trim().toUpperCase();
    const {data:g,error}=await this.client.rpc('join_guild_by_invite',{p_code:code,p_display_name:displayName}); if(error) throw error; if(!g) throw new Error('邀請碼不存在或已失效');
    this.guildId=g; localStorage.setItem(LOCAL_KEY,JSON.stringify({userId:this.user.id,guildId:this.guildId,guildName:this.state.guild.name,displayName:displayName,connectedAt:new Date().toISOString()})); await this.ensureGuildHome(); const members=await this.client.from('guild_members').select('user_id,display_name').eq('guild_id',this.guildId); if(members.error) throw members.error; const me=members.data?.find(x=>x.user_id===this.user.id); const other=members.data?.find(x=>x.user_id!==this.user.id); if(me?.display_name) this.state.player.name=me.display_name; if(other?.display_name) this.state.partner.name=other.display_name; const guild=await this.client.from('guilds').select('name').eq('id',this.guildId).single(); if(guild.error) throw guild.error; this.state.guild.name=guild.data?.name||this.state.guild.name; await this.startRealtime(); return g;
  }
  async ensure(){ if(!this.client||!this.user) await this.connect(); }
  async ensureGuild(){ await this.ensure(); if(!this.guildId) throw new Error('尚未加入公會'); }
  async ensureGuildHome(){ await this.ensureGuild(); const existing=await this.client.from('guild_home').select('*').eq('guild_id',this.guildId).maybeSingle(); if(existing.error) throw existing.error; if(existing.data) return existing.data; const created=await this.client.from('guild_home').insert({guild_id:this.guildId,state:{version:1,level:1,furniture:[],updatedBy:this.user.id,updatedAt:new Date().toISOString()}}).select().single(); if(created.error) throw created.error; return created.data; }
  async getGuildHome(){ await this.ensureGuild(); const {data,error}=await this.client.from('guild_home').select('*').eq('guild_id',this.guildId).maybeSingle(); if(error) throw error; return data; }
  async updateGuildHome(home){ await this.ensureGuild(); const state={version:Number(home?.version)||1,level:Number(home?.level)||1,furniture:Array.isArray(home?.furniture)?home.furniture:[],updatedBy:this.user.id,updatedByName:home?.updatedByName||this.state.player.name||'公會成員',updatedAt:new Date().toISOString()}; const existing=await this.client.from('guild_home').select('id').eq('guild_id',this.guildId).maybeSingle(); if(existing.error) throw existing.error; if(existing.data?.id){ const r=await this.client.from('guild_home').update({state,updated_at:new Date().toISOString()}).eq('id',existing.data.id).select().single(); if(r.error) throw r.error; return r.data; } const r=await this.client.from('guild_home').insert({guild_id:this.guildId,state}).select().single(); if(r.error) throw r.error; return r.data; }
  async startRealtime(){
    if(!FEATURES.sharedWorld || !this.client||!this.guildId) return;
    if(this.channel) { try{ await this.client.removeChannel(this.channel); }catch{} this.channel=null; }
    this.channel=this.client.channel(`guild:${this.guildId}`,{config:{presence:{key:this.user.id}}});
    this.channel.on('presence',{event:'sync'},()=>{this.presence=this.channel.presenceState(); this.cb.presence?.(this.presence);});
    if(FEATURES.realtime){
      for(const table of ['guild_members','tasks','notifications','couple_rewards','guild_events','guild_home','player_states']){
        this.channel.on('postgres_changes',{event:'*',schema:'public',table,filter:`guild_id=eq.${this.guildId}`},p=>this.cb.data?.(table,p));
      }
      // guilds uses primary key `id`, not `guild_id`. Listen separately so name changes refresh immediately.
      this.channel.on('postgres_changes',{event:'UPDATE',schema:'public',table:'guilds',filter:`id=eq.${this.guildId}`},p=>this.cb.data?.('guilds',p));
    }
    const r=await this.channel.subscribe(async status=>{
      this.lastRealtimeStatus=status;
      if(status==='SUBSCRIBED'){
        this.connected=true; this.cb.status?.('online');
        try{ await this.flushQueue(); }catch(e){ this.cb.error?.(e); }
        this.cb.resync?.();
      } else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED'){
        this.connected=false; this.cb.status?.(status.toLowerCase());
        if(FEATURES.reliability) this.scheduleReconnect();
      }
    });
    return r;
  }
  scheduleReconnect(){
    if(this.reconnectPromise || !this.guildId || !this.client || !navigator.onLine) return;
    this.reconnectPromise=(async()=>{
      let delay=1000;
      for(let attempt=0; attempt<5 && !this.connected; attempt++){
        await new Promise(r=>setTimeout(r,delay));
        if(!navigator.onLine) break;
        try{ await this.startRealtime(); if(this.connected) break; }catch(e){ this.cb.error?.(e); }
        delay=Math.min(delay*2,10000);
      }
    })().finally(()=>{this.reconnectPromise=null;});
  }
  async refreshSession(){
    if(!this.client) return;
    const {data,error}=await this.client.auth.getSession();
    if(error) throw error;
    if(data.session?.user) this.user=data.session.user;
    if(this.guildId && (!this.channel || !this.connected) && navigator.onLine) this.scheduleReconnect();
  }
  async trackPlayer(player){
    if(!FEATURES.sharedWorld||!this.guildId||!this.client||!this.user)return;
    const x=Math.round(player.x), y=Math.round(player.y);
    const payload={guild_id:this.guildId,user_id:this.user.id,x,y,display_name:player.name||'玩家',updated_at:new Date().toISOString()};
    try{
      const {error}=await this.client.from('player_states').upsert(payload,{onConflict:'guild_id,user_id'});
      if(error){
        if(!navigator.onLine){ this.enqueue({table:'player_states',op:'upsert',payload}); return; }
        throw error;
      }
    }catch(e){
      if(navigator.onLine) throw e;
      this.enqueue({table:'player_states',op:'upsert',payload});
      return;
    }
    if(this.channel&&this.connected) {
      const presencePayload={user_id:this.user.id,x,y,name:payload.display_name,updated_at:payload.updated_at};
      const pr=await this.channel.track(presencePayload);
      if(pr?.error) throw pr.error;
    }
  }
  async createTask(task){
    await this.ensureGuild();
    const payload={guild_id:this.guildId,title:task.title,description:task.desc||'',creator_id:this.user.id,assignee_type:task.target==='我們'?'couple':'partner',assignee_id:task.assignee_id||null,gold:Number(task.gold)||0,xp:Number(task.xp)||0,status:'open',metadata:{difficulty:Number(task.difficulty)||1,localTarget:task.target||'另一半'}};
    return this.write('tasks','insert',payload);
  }
  async updateTask(id,patch){ await this.ensureGuild(); return this.write('tasks','update',patch,{id}); }
  async updateDisplayName(name){
    await this.ensureGuild();
    const value=String(name||'').trim()||'玩家';
    const r=await this.client.rpc('update_my_display_name',{p_guild_id:this.guildId,p_display_name:value});
    if(r.error) throw r.error;
    const row=Array.isArray(r.data)?r.data[0]:r.data;
    this.state.player.name=row?.display_name||value;
    const saved=loadJson(LOCAL_KEY,{})||{};
    localStorage.setItem(LOCAL_KEY,JSON.stringify({...saved,userId:this.user?.id,guildId:this.guildId,displayName:this.state.player.name,guildName:this.state.guild.name,connectedAt:new Date().toISOString()}));
    this.session=loadJson(LOCAL_KEY,null);
    return row;
  }
  async updateGuildName(name){
    await this.ensureGuild();
    const value=String(name||'').trim()||'星光旅團';
    const r=await this.client.rpc('update_guild_name',{p_guild_id:this.guildId,p_name:value});
    if(r.error) throw r.error;
    const row=Array.isArray(r.data)?r.data[0]:r.data;
    this.state.guild.name=row?.name||value;
    const saved=loadJson(LOCAL_KEY,{})||{};
    localStorage.setItem(LOCAL_KEY,JSON.stringify({...saved,userId:this.user?.id,guildId:this.guildId,displayName:this.state.player.name,guildName:this.state.guild.name,connectedAt:new Date().toISOString()}));
    this.session=loadJson(LOCAL_KEY,null);
    return row;
  }
  async saveAccountGuildSettings(displayName,guildName){
    await this.ensureGuild();
    const p_display_name=String(displayName||'').trim()||'玩家';
    const p_guild_name=String(guildName||'').trim()||'星光旅團';
    const r=await this.client.rpc('update_account_guild_settings',{p_guild_id:this.guildId,p_display_name,p_guild_name});
    if(r.error) throw r.error;
    const row=Array.isArray(r.data)?r.data[0]:r.data;
    this.state.player.name=row?.display_name||p_display_name;
    this.state.guild.name=row?.guild_name||p_guild_name;
    const saved=loadJson(LOCAL_KEY,{})||{};
    localStorage.setItem(LOCAL_KEY,JSON.stringify({...saved,userId:this.user?.id,guildId:this.guildId,displayName:this.state.player.name,guildName:this.state.guild.name,connectedAt:new Date().toISOString()}));
    this.session=loadJson(LOCAL_KEY,null);
    return row;
  }
  async listMembers(){
    await this.ensureGuild();
    const r=await this.client.from('guild_members').select('user_id,guild_id,role,display_name,created_at').eq('guild_id',this.guildId).order('created_at',{ascending:true});
    if(r.error) throw r.error;
    return r.data||[];
  }
  async leaveGuild(){
    await this.ensureGuild();
    const guildId=this.guildId;
    // Remove only the current member. RLS already restricts this operation to the current user.
    const r=await this.client.from('guild_members').delete().eq('guild_id',guildId).eq('user_id',this.user.id);
    if(r.error) throw r.error;
    try{ if(this.channel) await this.client.removeChannel(this.channel); }catch{}
    this.channel=null; this.connected=false; this.guildId=null;
    const saved=loadJson(LOCAL_KEY,{})||{};
    const next={...saved,userId:this.user?.id,displayName:this.state.player.name,connectedAt:new Date().toISOString()};
    delete next.guildId; delete next.guildName; delete next.inviteCode;
    localStorage.setItem(LOCAL_KEY,JSON.stringify(next)); this.session=next;
    return guildId;
  }
  async createReward(reward){ await this.ensureGuild(); return this.write('couple_rewards','insert',{guild_id:this.guildId,created_by:this.user.id,title:reward.title,description:reward.description||'',cost:reward.cost||0,kind:reward.kind||'voucher',status:'available'}); }
  async redeemReward(id){ await this.ensureGuild(); return this.rpc('redeem_couple_reward',{p_reward_id:id,p_user_id:this.user.id}); }
  async markNotificationRead(id){ await this.ensureGuild(); return this.write('notifications','update',{read_at:new Date().toISOString()},{id,user_id:this.user.id}); }
  async sendNotification(userId,title,body,type='info'){ await this.ensureGuild(); const payload={guild_id:this.guildId,user_id:userId,title,body,type}; const r=await this.client.from('notifications').insert(payload); if(r.error){ if(!navigator.onLine){ this.enqueue({table:'notifications',op:'insert',payload}); return null; } throw r.error; } return payload; }
  async addEvent(type,payload,idempotencyKey){ await this.ensureGuild(); return this.write('guild_events','insert',{guild_id:this.guildId,user_id:this.user.id,type,payload,idempotency_key:idempotencyKey}); }
  async loadInitial(){ await this.ensureGuild(); const [guild,tasks,rewards,notes,members,home,players]=await Promise.all([
    this.client.from('guilds').select('name').eq('id',this.guildId).single(),
    this.client.from('tasks').select('*').eq('guild_id',this.guildId).order('created_at',{ascending:false}),
    this.client.from('couple_rewards').select('*').eq('guild_id',this.guildId).order('created_at',{ascending:false}),
    this.client.from('notifications').select('*').eq('guild_id',this.guildId).eq('user_id',this.user.id).order('created_at',{ascending:false}).limit(50),
    this.client.from('guild_members').select('*').eq('guild_id',this.guildId),
    this.client.from('guild_home').select('*').eq('guild_id',this.guildId).maybeSingle(),
    this.client.from('player_states').select('*').eq('guild_id',this.guildId),
  ]); for(const r of [guild,tasks,rewards,notes,members,home,players]) if(r.error) throw r.error; if(guild.data?.name) this.state.guild.name=guild.data.name; const me=members.data?.find(x=>x.user_id===this.user.id); const other=members.data?.find(x=>x.user_id!==this.user.id); if(me?.display_name) this.state.player.name=me.display_name; if(other?.display_name) this.state.partner.name=other.display_name; return {guild:guild.data,tasks:tasks.data,rewards:rewards.data,notifications:notes.data,members:members.data,home:home.data,players:players.data}; }
  async write(table,op,payload,match){ if(!this.client||!this.guildId){return this.enqueue({table,op,payload,match});} let q=this.client.from(table); if(op==='insert') q=q.insert(payload); else if(op==='update'){q=q.update(payload); for(const [k,v] of Object.entries(match||{})) q=q.eq(k,v);} else if(op==='upsert') q=q.upsert(payload); const r=await q.select().maybeSingle(); if(r.error){ if(!navigator.onLine) return this.enqueue({table,op,payload,match}); throw r.error;} return r.data; }
  async rpc(fn,args){ if(!this.client) return this.enqueue({rpc:fn,args}); const r=await this.client.rpc(fn,args); if(r.error){if(!navigator.onLine)return this.enqueue({rpc:fn,args});throw r.error;} return r.data; }
  enqueue(op){ const q=loadJson(QUEUE_KEY,[]); q.push({...op,queued_at:new Date().toISOString(),event_id:crypto.randomUUID()}); localStorage.setItem(QUEUE_KEY,JSON.stringify(q)); this.cb.status?.('offline-queued'); return null; }
  async flushQueue(){ const q=loadJson(QUEUE_KEY,[]); if(!q.length||!this.client||!this.guildId)return; localStorage.setItem(QUEUE_KEY,'[]'); for(const item of q){try{if(item.rpc)await this.rpc(item.rpc,item.args);else await this.write(item.table,item.op,item.payload,item.match);}catch(e){const back=loadJson(QUEUE_KEY,[]);back.push(item);localStorage.setItem(QUEUE_KEY,JSON.stringify(back));}} this.cb.resync?.(); }
}
function loadJson(k,f){try{return JSON.parse(localStorage.getItem(k)||'null')??f}catch{return f}}
export { FEATURES, CG_VERSION };
