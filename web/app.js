'use strict';

const ICONS = {
  hexu: '<path d="M10 4H7a5 5 0 0 0 0 10h3V4Zm4 16h3a5 5 0 0 0 0-10h-3v10Z"/><path d="M10 8h4m-4 8h4"/>',
  layers: '<rect x="3" y="7" width="12" height="14" rx="2"/><path d="M9 7V3h12v14h-6M8 13l3 3 7-8"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  file: '<path d="M14 2H5v20h14V7zM14 2v6h5M8 12h8M8 16h6"/>',
  folder: '<path d="M3 7V4h6l3 3h9v13H3z"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  checklist: '<rect x="5" y="4" width="15" height="18" rx="2"/><path d="M9 4V2h7v4H9M9 11l1 1 2-2M15 11h2M9 17l1 1 2-2M15 17h2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6zM8 12l3 3 5-6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6"/>',
  download: '<path d="M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  search: '<circle cx="10" cy="10" r="6.5"/><path d="m15 15 5 5"/>',
  spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5zM20 2v4m-2-2h4"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5M12 17h.01"/>',
  settings: '<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2" fill="currentColor"/><circle cx="16" cy="12" r="2" fill="currentColor"/><circle cx="10" cy="18" r="2" fill="currentColor"/>',
  book: '<path d="M12 5C8 2 3 3 3 3v17s5-1 9 2c4-3 9-2 9-2V3s-5-1-9 2zM12 5v17"/>',
  alert: '<path d="m12 3 10 18H2zM12 9v5M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
  x: '<path d="m6 6 12 12M6 18 18 6"/>',
  chat: '<path d="M21 4H3v14h5l4 4v-4h9zM7 9h10M7 13h7"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4M12 14v3"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  refresh: '<path d="M20 9a8 8 0 1 0-1 9M20 3v6h-6"/>',
  clip: '<path d="m8 14 7-7a3 3 0 0 1 4 4l-9 9a5 5 0 0 1-7-7L13 3a4 4 0 0 1 6 6L9 19"/>',
  user: '<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.file}</svg>`;
const esc = v => String(v ?? '').replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const aiName = model => model?.startsWith('deepseek')?'DeepSeek Flash':model==='hy3'?'混元 Hy3':model||'AI';
const aiDestination = model => model?.startsWith('deepseek/')?'经腾讯云 TokenHub 由 DeepSeek 原厂处理':'发送至腾讯云 TokenHub';
const suggestionTitle = suggestion => suggestion.mode==='ai'?`AI 分类建议 · ${aiName(suggestion.model)}${suggestion.prompt_version?' · '+suggestion.prompt_version:''}`:suggestion.failure_code?'AI 建议不可用 · 已转人工':suggestion.mode==='manual'?'待人工处理':'模拟分类建议';
const labelNames = {internal:'内部协作',external:'对外沟通',uncertain:'待判断'};
const decisionStatus = c => !c.confirmed ? '待人工确认' : c.labels.includes('uncertain') || c.output==='pending' ? '已记录待判断' : '人工已确认';
const outputNames = {internal:'仅内部保留',external:'对外保留',rewrite:'人工填写对外表述',pending:'待决定'};
const taskNames = {waiting:'待回复',review:'待法务复核',done:'已处理'};
const S = {rows:[], contract:null, details:[], page:'dashboard', tab:'comments', mobilePane:'decision', selected:null, aiModel:null, filter:'all', query:'', loading:false, loadToken:0, modalFile:null, busy:false};
const app = document.getElementById('app');
const modal = document.getElementById('modal');
const entryCover = document.getElementById('entry-cover');
let toastTimer;
let entryReady = false;
let entryRequested = false;

function closeEntryCover() {
  if(!entryReady || entryCover.hidden || entryCover.classList.contains('is-leaving'))return;
  try{sessionStorage.setItem('hexu-entry-seen-v1','1');}catch{}
  entryCover.classList.add('is-leaving');
  const duration=matchMedia('(prefers-reduced-motion: reduce)').matches?0:380;
  setTimeout(()=>{
    entryCover.hidden=true;
    entryCover.classList.remove('is-leaving');
    document.body.classList.remove('entry-open');
    app.inert=false;
    document.querySelector('.skip').inert=false;
    document.getElementById('main')?.focus({preventScroll:true});
  },duration);
}
function initEntryCover() {
  let seen=false;
  try{seen=sessionStorage.getItem('hexu-entry-seen-v1')==='1';}catch{}
  if(seen && new URLSearchParams(location.search).get('cover')!=='1')return;
  entryCover.hidden=false;
  app.inert=true;
  document.querySelector('.skip').inert=true;
  document.body.classList.add('entry-open');
  entryCover.querySelector('.entry-enter').focus({preventScroll:true});
  entryCover.addEventListener('click',e=>{
    if(!e.target.closest('[data-entry-action]'))return;
    entryRequested=true;
    if(entryReady)closeEntryCover();
    else entryCover.querySelector('.entry-enter').textContent='正在打开工作台…';
  });
  document.addEventListener('keydown',e=>{
    if(entryCover.hidden)return;
    if(e.key==='Escape'){e.preventDefault();entryRequested=true;closeEntryCover();}
    if(e.key==='Tab'){
      const items=[entryCover.querySelector('.entry-skip'),entryCover.querySelector('.entry-enter')];
      const index=items.indexOf(document.activeElement);
      if((e.shiftKey&&index===0)||(!e.shiftKey&&index===1)){
        e.preventDefault();items[e.shiftKey?1:0].focus();
      }
    }
  });
}
document.addEventListener('hexu:ready',()=>{
  entryReady=true;
  if(entryRequested)closeEntryCover();
});

function toast(message, error=false) {
  const el = document.getElementById('toast');
  el.setAttribute('role',error?'alert':'status');
  el.setAttribute('aria-live',error?'assertive':'polite');
  el.textContent=message; el.className='show'+(error?' error':'');
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.className='', error?7000:4000);
}
async function api(path, body, method) {
  const response=await fetch(path,{method:method || (body?'POST':'GET'),headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
  let result;
  try { result=await response.json(); } catch { throw new Error('服务未返回有效响应，请稍后重试。'); }
  if(response.status===401){location.replace('/login.html');throw new Error('请先登录。');}
  if(!response.ok) throw new Error(result.error || '操作未完成，请重试。');
  return result;
}
const date = (value, short=false) => new Date(value).toLocaleString('zh-CN', {month:'2-digit',day:'2-digit',...(short?{}:{hour:'2-digit',minute:'2-digit'}),hour12:false,timeZone:'Asia/Shanghai'});
const badge = (text,color='') => `<span class="badge ${color}">${esc(text)}</span>`;
const audience = labels => labels.map(x=>badge(labelNames[x],x==='internal'?'violet':x==='external'?'blue':'amber')).join(' ');
const phaseBadge = phase => badge(phase,phase==='已生成候选'?'green':phase==='解析失败'?'red':phase==='待法务分类'?'blue':'amber');
const btn = (label,action,kind='',ico='',extra='') => `<button type="button" class="btn ${kind}" data-action="${action}" ${extra}>${ico?icon(ico):''}${label}</button>`;
const dl = (label,kind,id='',klass='btn sm',ico='download') => `<a class="${klass}" href="/api/contracts/${S.contract.id}/download/${kind}${id?'/'+id:''}" download>${icon(ico)}${label}</a>`;
function notice(content,type='info'){return `<div class="notice ${type==='info'?'':type}">${icon(type==='error'?'alert':type==='green'?'check':'info')}<div>${content}</div></div>`;}
function empty(title,description,action=''){return `<div class="empty">${icon('folder')}<h3>${title}</h3><p>${description}</p>${action}</div>`;}
function heading(title,description,actions=''){return `<div class="heading"><div><h1>${title}</h1><p>${description}</p></div><div class="heading-buttons">${actions}</div></div>`;}
function field(label,name,value='',placeholder='',textarea=false){return `<div class="form-group"><label class="field-label" for="${name}">${label}</label>${textarea?`<textarea class="field" id="${name}" name="${name}" placeholder="${placeholder}" maxlength="20000">${esc(value)}</textarea>`:`<input class="field" id="${name}" name="${name}" value="${esc(value)}" placeholder="${placeholder}" maxlength="1000">`}</div>`;}
const navNames = {dashboard:'工作台',contracts:'合同文件',tasks:'内部确认',history:'处理记录',settings:'演示设置',help:'使用指南'};

function shell(content) {
  const active=S.contract?'contracts':S.page;
  const pending=S.rows.reduce((n,c)=>n+c.summary.pending_tasks,0);
  const nav=(name,ico,count='')=>`<a href="#/${name}" class="nav-item ${active===name?'active':''}">${icon(ico)}${navNames[name]}${count!==''?`<span class="nav-count">${count}</span>`:''}</a>`;
  app.innerHTML=`<div class="app-shell ${S.page==='dashboard'?'dashboard-shell':''}"><aside class="sidebar" aria-label="主导航"><a href="#/dashboard" class="brand"><span class="brand-symbol">${icon('hexu')}</span><div><div class="brand-name">合序</div><small>法务协作助手</small></div></a><div class="nav-label">协作空间</div>${nav('dashboard','grid')}${nav('contracts','folder',S.rows.length)}${nav('tasks','checklist',pending || '')}${nav('history','clock')}<div class="sidebar-divider"></div><div class="nav-label">支持与设置</div>${nav('help','book')}${S.user?'<a class="nav-item" href="/team.html">团队、模型与充值</a>':nav('settings','settings')}<div class="sidebar-bottom"><div class="demo-panel"><strong>${icon('shield')}${S.user?'团队协作空间':'安心体验工作流程'}</strong>${S.user?esc(S.user.team_name)+'<br>仅合同参与者可访问':'当前为本地演示空间<br>仅使用虚构或脱敏合同'}</div><div class="profile"><span class="avatar">法</span><div style="font-size:12px">${S.user?esc(S.user.name):'演示法务'}<small>${S.user?({admin:'管理员',legal:'法务成员',business:'业务成员'}[S.user.role]):'单人演示 · 业务回复代录'}</small></div></div></div></aside><div class="main-shell"><header class="topbar"><div class="breadcrumbs"><button class="icon-btn mobile-menu" data-action="menu" aria-label="打开导航">${icon('menu')}</button><span>协作空间</span>${icon('chevron')}<strong>${S.contract?esc(S.contract.title):navNames[S.page] || '工作台'}</strong></div><div class="top-actions"><span><i class="local-dot"></i>${S.user?'团队试用':'本地演示'}</span><span class="date">${new Date().toLocaleDateString('zh-CN',{year:'numeric',month:'long',day:'numeric',weekday:'long',timeZone:'Asia/Shanghai'})}</span><a class="icon-btn" href="#/help" aria-label="使用指南">${icon('help')}</a></div></header><main id="main" class="main" tabindex="-1">${content}<footer class="footer"><span>${icon('shield')}${S.user?'文件仅向获授权参与者开放 · AI 须单独触发':'文件保存在本机 · 模拟建议不发送合同至外部模型'}</span><span>${S.user?'合序团队试用':'合序本机演示'} · 让每一次交接，都有章可循</span></footer></main></div></div>`;
  if(S.user){
    if(S.user.role!=='admin')app.querySelectorAll('[data-action="delete"]').forEach(x=>x.hidden=true);
    if(S.user.role==='business'){
      app.querySelectorAll('[data-action="upload"],[data-action="version"],[data-action="demo"],[data-action="review"],[data-action="export"],[data-action="model-manual"],[data-action="model-retry"],[data-action="task-confirm"],[data-action="task-return"],[data-action="task-na"]').forEach(x=>x.hidden=true);
      app.querySelectorAll('#comment-form input,#comment-form select,#comment-form textarea,#comment-form button,#settings-form input,#settings-form textarea,#settings-form button,#handoff-form input,#handoff-form textarea,#handoff-form button').forEach(x=>x.disabled=true);
    }
  }
}

function render() {
  document.title=(S.contract?S.contract.title:navNames[S.page] || '工作台')+' · 合序';
  if(S.contract) return shell(detailPage());
  if(S.page==='dashboard'||S.page==='contracts') return shell(dashboard());
  if(S.page==='tasks') return shell(globalTasks());
  if(S.page==='history') return shell(globalHistory());
  if(S.page==='settings') return shell(settings());
  return shell(help());
}
async function loadRoute() {
  const token=++S.loadToken;
  const parts=location.hash.replace(/^#\/?/,'').split('/');
  try {
    const result=await api('/api/contracts');
    if(token!==S.loadToken)return;
    S.rows=result.contracts;S.user=result.user || null;S.aiEnabled=result.ai_enabled;S.aiQuota=S.user?await api('/api/ai/quota'):null;
    S.policy=S.user?await api('/api/auth/config'):null;
    if(S.user){navNames.settings='团队设置';S.members=(await api('/api/team/members')).members;if(token!==S.loadToken)return;}
    if(parts[0]==='contract'&&parts[1]) {
      const c=await api('/api/contracts/'+encodeURIComponent(parts[1]));
      if(token!==S.loadToken)return;
      S.contract=c;S.page='contracts';S.tab=['comments','tasks','export','records'].includes(parts[2])?parts[2]:'comments';
      if(!c.current.comments.some(x=>x.id===S.selected)) S.selected=c.current.comments[0]?.id || null;
    }else{
      S.contract=null;S.page=navNames[parts[0]]?parts[0]:'dashboard';
      if(['tasks','history'].includes(S.page)) {
        const details=await Promise.all(S.rows.map(c=>api('/api/contracts/'+c.id)));
        if(token!==S.loadToken)return;
        S.details=details;
      }
    }
    render();window.scrollTo(0,0);document.dispatchEvent(new Event('hexu:ready'));
  }catch(e){shell(`<div class="inline-error">${esc(e.message)}<p style="margin-top:15px">${btn('重新加载','reload','','refresh')} <a href="#/dashboard">返回工作台</a></p></div>`);document.dispatchEvent(new Event('hexu:ready'));}
}

function dashboard() {
  const rows=S.rows, count=p=>rows.filter(c=>c.phase===p).length;
  const all=S.page==='dashboard';
  const next=rows.find(c=>c.phase!=='已生成候选');
  const nextStep=next?.phase==='待法务分类'?['逐条确认批注','comments']:next?.phase==='待事项处理'?['处理内部事项','tasks']:['复核候选版','export'];
  return heading(all?'合同交接工作台':'合同文件',all?'从审阅版到对外候选版，逐项确认、保留出处。':'管理审阅版、跟进处理进度，保持文件版本与确认记录一致。',btn('体验示例','demo','quiet','spark')+btn('上传审阅版','upload','primary','plus'))+
  (all?`<section class="next-case" aria-label="下一步工作"><div class="next-case-main"><span class="next-case-kicker">${next?'下一份待处理合同':'当前工作'}</span><h2>${next?esc(next.title):'没有待处理的合同'}</h2><p>${next?`当前阶段：${esc(next.phase)}。${next.summary.comments?`已确认 ${next.summary.confirmed} / ${next.summary.comments} 条批注。`:'请核对交接清单与文件用途。'}`:'上传审阅版，或从虚构示例体验合同交接流程。'}</p><div class="next-case-actions">${next?`<a class="btn primary" href="#/contract/${next.id}/${nextStep[1]}">${nextStep[0]} ${icon('arrow')}</a>`:btn('体验示例','demo','primary','plus')}<span>每一步决定都关联源文件版本</span></div></div><div class="next-case-side"><div><span>源版本</span><strong>${next?'V'+next.version:'—'}</strong></div><div><span>未确认批注</span><strong>${next?next.summary.comments-next.summary.confirmed:0}<small> 条</small></strong></div><div><span>文件去向</span><strong>人工复核后导出</strong></div></div></section>`:'')+
  `<section class="stats" aria-label="合同概览">${[['全部合同',rows.length,'folder','份'],['待法务分类',count('待法务分类'),'chat','份'],['待内部确认',rows.reduce((n,c)=>n+c.summary.pending_tasks,0),'checklist','项'],['已生成候选',count('已生成候选'),'shield','份']].map(([t,n,i,u])=>`<div class="stat"><div><div class="stat-title">${t}</div><div class="stat-number">${n}<small>${u}</small></div></div><span class="stat-icon">${icon(i)}</span></div>`).join('')}</section>`+
  `<div class="dashboard-grid"><section class="panel"><div class="panel-header"><h2>${all?'最近合同':'全部合同'}<span class="count">共 ${rows.length} 份</span></h2>${all?'<a href="#/contracts">查看全部</a>':''}</div><div class="toolbar"><div class="tabs" role="group" aria-label="筛选合同">${[['all','全部'],['pending','处理中'],['done','已生成候选']].map(([v,t])=>`<button class="tab ${S.filter===v?'active':''}" data-action="filter" data-value="${v}" aria-pressed="${S.filter===v}">${t}</button>`).join('')}</div><label class="search">${icon('search')}<input id="search" aria-label="搜索合同名称或合作方" placeholder="搜索合同名称或合作方" value="${esc(S.query)}"></label></div><div id="contract-results">${contractTable()}</div></section><aside class="panel guide"><h3>${icon('book')}一次清晰的合同交接</h3><div>${[['上传审阅版','支持传统 Word 批注，保留原始文件及出处。'],['确认批注与去向','区分内部协作与对外沟通，逐条由法务决定。'],['完成内部确认','代录业务回复与证据，经法务复核后关闭事项。'],['复核并生成候选','确认当前快照，分别下载对外文件与内部记录。']].map(([t,d],i)=>`<div class="guide-step"><span class="step-number">${i+1}</span><div><strong>${t}</strong><p>${d}</p></div></div>`).join('')}</div><div class="guide-note">${icon('info')}候选文件仍需人工核对，不代表法务批准或可以签署。</div></aside></div>`+
  (all?`<section class="panel activity"><div class="activity-head"><h3>最近更新</h3><a class="text-btn" href="#/history">查看处理记录 ${icon('chevron')}</a></div><div class="activity-list">${rows.slice(0,3).map(c=>`<div class="activity-item"><i class="activity-dot"></i><div><strong>${esc(c.title)}</strong><p>${esc(c.phase)} · ${date(c.updated_at)}</p></div></div>`).join('') || '<p class="muted">还没有合同更新，上传一份审阅版开始。</p>'}</div></section>`:'');
}
function contractTable() {
  const rows=S.rows.filter(c=>(S.filter==='all'||(S.filter==='done'?c.phase==='已生成候选':c.phase!=='已生成候选'))&&(!S.query||(c.title+c.party).toLowerCase().includes(S.query.toLowerCase())));
  if(!rows.length) return empty(S.rows.length?'没有匹配的合同':'还没有审阅版',S.rows.length?'尝试调整筛选条件或搜索关键词。':(S.user?'上传你有权向团队共享的 Word 合同。':'上传虚构或已脱敏的 Word 合同，也可以从示例开始。'),btn(S.rows.length?'清除筛选':'体验示例',S.rows.length?'clear-filter':'demo','','spark'));
  return `<table class="contract-table"><thead><tr><th>合同名称</th><th class="status-col">当前阶段</th><th class="progress-col">分类进度</th><th class="optional">待处理</th><th>操作</th></tr></thead><tbody>${rows.map((c,i)=>`<tr><td><div class="file-title"><span class="file-row-num" aria-hidden="true">${String(i+1).padStart(2,'0')}</span><span class="file-icon">${icon('file')}</span><div><strong><a href="#/contract/${c.id}/comments" style="color:inherit">${esc(c.title)}</a><span class="version">V${c.version}</span></strong><small>${esc(c.party)}${c.demo?' · 虚构示例':''}</small></div></div></td><td class="status-col">${phaseBadge(c.phase)}</td><td class="progress-col"><small class="muted">${c.summary.confirmed} / ${c.summary.comments} 条</small><div class="progress"><span style="width:${c.summary.comments?100*c.summary.confirmed/c.summary.comments:0}%"></span></div></td><td class="optional"><span style="color:${c.summary.blockers?'#b28c53':'#63947f'}">${c.summary.blockers}</span><small class="muted"> 项</small></td><td><a class="text-btn" href="#/contract/${c.id}/${c.phase==='已生成候选'?'export':'comments'}">${c.phase==='已生成候选'?'查看':'处理'} ${icon('chevron')}</a></td></tr>`).join('')}</tbody></table><div class="table-footer"><span>显示 ${rows.length} 份合同</span><span>仅在完成复核后生成对外候选</span></div>`;
}

function detailPage(){
  const c=S.contract,v=c.current;
  const phase=['待法务分类','待事项处理','待候选复核','已生成候选'].indexOf(c.phase);
  return `<div class="heading detail-heading"><div><h1>${esc(c.title)}</h1><div class="detail-meta">${badge('源版本 V'+v.number,'blue')}<span>${esc(c.party)}</span><span>${v.comments.length} 条批注</span>${c.demo?badge('虚构演示',''):''}${phaseBadge(c.phase)}</div></div><div class="heading-buttons">${dl('下载源件','source','','btn secondary')}${btn('上传新版本','version','','upload')}</div></div><div class="workflow">${[['导入审阅版',phase>=0],['确认批注',phase>=1],['处理内部事项',phase>=2],['复核候选版',phase>=3]].map(([t,done],i)=>`<div class="workflow-step ${done?'done':i===phase+1?'active':''}"><span class="step-circle">${done?icon('check'):i+1}</span>${t}</div>`).join('')}</div><nav class="detail-tabs" aria-label="合同处理步骤">${[['comments','批注处理',v.comments.length],['tasks','内部确认清单',c.summary.tasks],['export','复核与导出',null],['records','处理记录',c.logs.length]].map(([key,title,n])=>`<a class="tab ${S.tab===key?'active':''}" href="#/contract/${c.id}/${key}">${title}${n!==null?badge(n):''}</a>`).join('')}</nav>${v.errors.length?notice('<strong>当前文件暂不支持候选导出</strong><br>'+v.errors.map(esc).join('<br>')+'<br>请在 Word 中处理这些结构后，上传为新版本。','error'):''}${v.review_invalid_reason?notice(esc(v.review_invalid_reason),'amber'):''}${S.tab==='comments'?commentsPage():S.tab==='tasks'?tasksPage():S.tab==='export'?exportPage():recordsPage()}`;
}
function documentPaper(v,selected=null) {
  return `<div class="paper">${v.paragraphs.map((p,i)=>i===0?`<h2>${esc(p.text)}</h2>`:`<p class="${p.heading?'paper-heading ':''}${p.table?'table-paragraph ':''}${selected&&p.index===selected.paragraph?'highlight':''}">${esc(p.text)}</p>`).join('')}</div>`;
}
function commentsPage(){
  const v=S.contract.current;
  if(!v.comments.length)return notice('这份文档没有批注，并不代表已经审核。请在“复核与导出”填写人工交接清单。')+empty('没有检测到传统批注','可以下载源件核对；无批注文件仍需人工填写交接信息并复核。',`<a class="btn primary" href="#/contract/${S.contract.id}/export">填写交接清单 ${icon('arrow')}</a>`);
  const c=v.comments.find(x=>x.id===S.selected)||v.comments[0];
  const s=c.suggestion,t=c.task;
  const models=S.aiQuota?.models||[];
  const selectedModel=models.some(model=>model.id===S.aiModel)?S.aiModel:S.aiQuota?.model;
  const canAnalyze=S.aiEnabled&&S.user?.role!=='business'&&S.contract.demo&&v.number===1&&S.aiQuota?.usable>0;
  const modelPicker=canAnalyze?`<label class="ai-model-control">分析模型<select id="ai-model" class="field">${models.map(model=>`<option value="${esc(model.id)}" ${model.id===selectedModel?'selected':''}>${esc(model.name)} · ${esc(model.provider)}</option>`).join('')}</select></label>${btn('分析当前批注','model-ai','quiet sm','spark')}`:'';
  const aiActions=S.user?`<span class="ai-action-row">${modelPicker}<a href="/team.html#recharge-panel">额度与充值</a></span>`:'';
  return (S.user?notice(`<strong>${S.aiEnabled?'AI 分类建议':'人工处理模式'}</strong> · ${S.aiEnabled?(S.contract.demo&&v.number===1?`仅限虚构示例批注；团队当前可用 ${S.aiQuota?.usable??0} 次。每次确认后只发送这一条批注和引用原文，经腾讯云 TokenHub 交由所选模型服务商处理。`:'AI 试用仅限虚构示例的原始批注，真实合同保持人工处理。'):'真实 AI 尚未配置；人工流程可以继续使用。'} ${aiActions}`):notice(`<strong>${v.model_mode==='manual'?'人工处理模式':'模拟分类建议'}</strong> · ${v.model_mode==='manual'?'无需模型，逐条确认即可继续流程。':'当前未连接真实 AI，建议来自本地示例规则，不能替代法务决定。'} <span class="flex wrap" style="margin-top:7px">${btn('切换人工模式','model-manual','quiet sm','',v.model_mode==='manual'?'disabled':'')}${btn('重试模拟建议','model-retry','quiet sm','refresh',v.model_attempts>=2?'disabled':'')}</span>`))+`<div class="mobile-review-tabs" role="group" aria-label="批注页面视图"><button type="button" class="mobile-review-tab ${S.mobilePane==='decision'?'active':''}" data-action="mobile-pane" data-value="decision" aria-pressed="${S.mobilePane==='decision'}">批注处理</button><button type="button" class="mobile-review-tab ${S.mobilePane==='document'?'active':''}" data-action="mobile-pane" data-value="document" aria-pressed="${S.mobilePane==='document'}">合同原文</button></div><div class="review-layout ${S.mobilePane==='document'?'show-document':''}"><section class="comment-list"><div class="list-heading"><span>全部批注 <span class="muted">${v.comments.length}</span></span><span class="muted">已确认 ${S.contract.summary.confirmed}</span></div>${v.comments.map((x,i)=>`<button class="comment-item ${x.id===c.id?'active':''}" data-action="select-comment" data-id="${esc(x.id)}"><div class="comment-item-top"><span>批注 ${String(i+1).padStart(2,'0')}</span>${x.confirmed&&!x.labels.includes('uncertain')&&x.output!=='pending'?icon('check'):`<span>${esc(x.location)}</span>`}</div><p>${esc(x.text)}</p><div class="badges">${x.confirmed?audience(x.labels):audience(x.suggestion.labels)}${decisionStatus(x)!=='人工已确认'?badge(decisionStatus(x)):''}</div></button>`).join('')}</section><section class="document-pane" aria-label="原文定位"><div class="document-toolbar"><span>${icon('file')} 源文件 · V${v.number}</span><span>原文定位预览</span></div>${documentPaper(v,c)}<p class="paper-caption">此处展示原文结构；完整排版请下载源件在 Word 中核对。</p></section><section class="inspector"><div class="inspector-title"><h3>批注 ${String(v.comments.indexOf(c)+1).padStart(2,'0')}</h3>${badge(decisionStatus(c),decisionStatus(c)==='人工已确认'?'green':'amber')}</div><div class="field-label">${icon('chat')}原始批注</div><div class="original-comment">${esc(c.text)}</div><div class="field-label">${icon('file')}${esc(c.location)}</div><div class="original-comment">${esc(c.quote)||'无法定位原文'}</div><div class="suggestion"><div class="suggestion-title">${icon('spark')}${esc(suggestionTitle(s))}</div>${audience(s.labels)}<p>${esc(s.reason)}</p></div><form id="comment-form" data-id="${esc(c.id)}"><div class="form-group"><span class="field-label">人工受众分类 · 可多选</span><div class="label-options">${Object.entries(labelNames).map(([k,n])=>`<label class="choice"><input type="checkbox" name="labels" value="${k}" ${c.labels.includes(k)?'checked':''}><span>${n}</span></label>`).join('')}</div><label class="checkline"><input type="checkbox" name="needs_fact" ${c.needs_fact?'checked':''}>需要补充事实或证据</label></div><div id="split-fields" class="${c.labels.length>1?'':'hidden'}">${notice('同时涉及两类受众，请拆成两条关联同一原批注的处理内容。','amber')}${field('内部处理内容','split_internal',c.split?.[0]?.text || '', '仅用于内部确认',true)}${field('对外沟通内容','split_external',c.split?.[1]?.text || c.external_text || '', '此内容将作为人工对外表述进入候选',true)}</div><div class="form-group"><label class="field-label" for="output">候选文件中的处理方式</label><select id="output" name="output" class="field">${Object.entries(outputNames).map(([k,n])=>`<option value="${k}" ${c.output===k?'selected':''}>${n}</option>`).join('')}</select><p class="helper">仅内部保留：从候选副本排除，源件和内部记录继续保留。</p></div><div id="rewrite-field" class="${c.output==='rewrite'&&c.labels.length<2?'':'hidden'}">${field('人工确认的对外表述','external_text',c.external_text,'仅此表述进入候选批注，不修改合同正文',true)}</div><div id="task-fields" class="${t||c.needs_fact||c.labels.includes('internal')?'':'hidden'}"><div class="rule"></div>${field('内部待办','task_title',t?.title || '', '明确需要业务确认的具体事实',true)}${S.user?`<label class="form-group">责任成员<select name="owner" class="field"><option value="">请选择团队成员</option>${(S.members||[]).map(m=>`<option value="${esc(m.id)}" ${t?.assignee_id===m.id?'selected':''}>${esc(m.name)} · ${esc(m.login)}</option>`).join('')}</select></label>`:field('责任角色','owner',t?.owner || '', '例如：业务负责人')}</div><button class="btn primary" type="submit">${icon('check')}${c.confirmed?'保存人工决定':'确认分类与处理'}</button><p class="helper">逐条人工确认。保存修改后，已有的候选复核将失效。</p></form><div class="rule"></div><div class="flex between">${btn('上一条','prev-comment','quiet sm','',v.comments.indexOf(c)===0?'disabled':'')}${btn('下一条','next-comment','quiet sm','',v.comments.indexOf(c)===v.comments.length-1?'disabled':'')}</div></section></div>`;
}
function tasksPage(){
  const tasks=S.contract.current.comments.filter(x=>x.task);
  return `<div class="section-head"><div><h2>把需要确认的事，逐项落实</h2><p>${tasks.length} 项内部事项，${tasks.filter(x=>x.task.status!=='done').length} 项尚未处理完成</p></div>${dl('下载内部清单','checklist')}</div>${notice(S.user?'团队成员提交回复和证据后，由法务单独复核。':'当前为单人演示。业务回复由操作者代录，记录回复后仍需由法务单独复核。')}`+(tasks.length?`<div class="task-stack">${tasks.map(taskCard).join('')}</div>`:empty('还没有内部确认事项','在批注处理中选择“内部协作”或“需补事实”，填写待办和责任角色后保存。',`<a class="btn" href="#/contract/${S.contract.id}/comments">去处理批注 ${icon('arrow')}</a>`));
}
function taskCard(c){
  const t=c.task;
  const readOnly=S.user?.role==='business'&&t.assignee_id!==S.user.id;
  return `<article class="panel task-card"><div class="task-head"><div><span class="field-label">来源：批注 ${Number(c.id)+1} · ${esc(c.location)}</span><h3>${esc(t.title)}</h3><div class="task-meta"><span>${icon('user')} ${esc(t.owner)}</span><span>${S.user?'团队协作回复':'业务回复代录'}</span>${t.review?`<span>法务复核 ${date(t.review.at)}</span>`:''}</div></div>${badge(taskNames[t.status],t.status==='done'?'green':t.status==='review'?'blue':'amber')}</div><div class="task-source">原批注：${esc(c.text)}</div>${t.return_reason&&t.status==='waiting'?`<div class="task-return">退回补充：${esc(t.return_reason)}</div>`:''}${t.na_reason?notice('不适用理由：'+esc(t.na_reason),'green'):''}<form class="reply-form" data-id="${esc(c.id)}"><fieldset class="task-form-lock" ${readOnly?'disabled':''}><div class="task-form">${field(S.user?'业务回复':'业务回复 · 由操作者代录','reply-'+c.id,t.reply,'请记录业务反馈的事实与结论',true)}${field('证据 / 可核实的事实说明','evidence-'+c.id,t.evidence,'例如：交付物清单、授权凭证编号或可核实的事实',true)}</div>${t.attachments.length?`<div class="task-attachments">${t.attachments.map(a=>dl(esc(a.filename),'evidence',a.id,'','clip')).join('')}</div>`:''}<div class="task-actions"><div class="flex">${btn('添加证据','attach','quiet sm','clip',`data-id="${esc(c.id)}"`)}<button class="btn sm" type="submit">保存回复</button></div><div class="flex wrap">${btn('不适用','task-na','quiet sm','',`data-id="${esc(c.id)}"`)}${t.status==='review'?btn('退回补充','task-return','sm','',`data-id="${esc(c.id)}"`):''}${btn('法务确认已处理','task-confirm','primary sm','check',`data-id="${esc(c.id)}" ${t.status!=='review'?'disabled':''}`)}</div></div><p class="helper">修改已处理事项的回复或证据，会自动返回待法务复核；请先保存回复，再确认已处理。</p></fieldset></form></article>`;
}
function handoffForm(){
  const h=S.contract.current.handoff;
  const handoffField=(label,name,...args)=>field(label,'handoff-'+name,...args);
  return `<section class="panel" style="padding:23px"><h3 style="margin-bottom:16px">无批注文件 · 人工交接检查</h3><form id="handoff-form">${handoffField('文件用途','purpose',h.purpose,'说明此次候选文件用于何种沟通')}${handoffField('拟接收方角色','recipient',h.recipient,'例如：客户商务负责人')}${handoffField('源版本','source_version',h.source_version,`请输入 V${S.contract.current.number}`)}${handoffField('已知未决项','unresolved',h.unresolved,'有未决项请列出；全部处理后明确填写“无”',true)}${handoffField('法务检查记录','review_note',h.review_note,'说明已检查的内容及需要人工核对的部分',true)}<button class="btn" type="submit">保存交接检查</button></form></section>`;
}
function exportPage(){
  const c=S.contract,v=c.current;
  const retained=v.comments.filter(x=>['external','rewrite'].includes(x.output));
  const excluded=v.comments.filter(x=>x.output==='internal');
  const groups=[['分类与输出决定','仍有待确认或待判断项',!c.blockers.some(x=>['classification','decision'].includes(x.kind))],['内部事项复核','仍有未处理的内部事项',!c.blockers.some(x=>x.kind==='task')],['文件格式与修订检查','存在不支持的文件结构',!c.blockers.some(x=>x.kind==='format')],['当前候选快照复核','尚未复核当前候选快照',!!v.review]];
  return notice('对外候选仍需人工核对，不代表法务批准或可以签署。候选文件只包含已确认的对外批注；内部清单、回复和证据分别保留。','amber')+`<div class="export-layout"><div class="export-content">${!v.comments.length?handoffForm():''}<section class="panel"><div class="export-summary"><span class="large-icon">${icon('file')}</span><div><h3>${esc(c.title)} · 对外候选</h3><p>基于源版本 V${v.number} · ${retained.length} 条对外批注 · ${excluded.length} 条仅内部保留<br>正文不改写；源文件保留。</p></div></div><div class="panel-header" style="border-top:1px solid var(--line)"><h3>候选批注处理预览</h3><span class="muted" style="font-size:11px">${v.comments.length} 条</span></div>${v.comments.map(x=>`<div class="decision-row">${icon(x.output==='internal'?'lock':x.output==='pending'?'help':'chat')}<div><p>${x.output==='rewrite'?esc(x.external_text):x.output==='internal'?'原批注仅保留在内部记录':esc(x.text)}</p><small>批注 ${Number(x.id)+1} · ${esc(x.location)} · ${decisionStatus(x)}</small></div>${badge(outputNames[x.output],x.output==='internal'?'violet':x.output==='pending'?'amber':'blue')}</div>`).join('')||'<div class="decision-row"><p>此文件没有批注，候选将保留原正文与支持的格式。</p></div>'}<div style="padding:0 22px 18px"><details class="preview-toggle"><summary class="text-btn" style="cursor:pointer;margin:18px 0">${icon('eye')}查看候选正文与对外批注预览</summary><div class="candidate-paper">${documentPaper(v)}${retained.length?`<div class="paper" style="margin-top:12px;min-height:0"><h3 style="margin-bottom:16px">候选中的对外批注</h3>${retained.map(x=>`<p>批注 ${Number(x.id)+1}：${esc(x.output==='rewrite'?x.external_text:x.text)}</p>`).join('')}</div>`:''}</div><p class="helper">此为内容预览，不能验证 Word 的分页和版式。候选导出前服务端会再次检查文件结构。</p></details></div></section><section class="panel"><div class="panel-header"><h3>交付文件</h3><span class="badge">内部与对外分别下载</span></div>${v.exports.map(e=>`<div class="download-row"><div><strong>${esc(e.number)} · 对外候选 ${badge(e.historical?'历史候选':'当前候选',e.historical?'':'green')}</strong><small>${date(e.at)} · ${esc(e.hash.slice(0,16))}…${e.historical?'<br>内容已变化，旧文件无法远程撤回。':''}</small></div>${dl('下载候选','candidate',e.id)}</div>`).join('')}<div class="download-row"><div><strong>内部确认清单 .md</strong><small>含原批注、待办、回复和未决事项，可随时下载。</small></div>${dl('下载清单','checklist')}</div><div class="download-row"><div><strong>内部处理记录 .json</strong><small>含版本指纹、人工确认、复核及导出记录。</small></div>${dl('下载记录','record')}</div></section></div><aside class="panel export-sidebar"><h3>候选导出检查</h3>${groups.map(([t,pending,ok])=>`<div class="check-item ${ok?'ok':'fail'}">${icon(ok?'check':'clock')}<span>${ok?t+' · 已完成':pending}</span></div>`).join('')}<div class="rule"></div><form id="settings-form">${field('候选文件用途','purpose',v.settings.purpose)}${field('拟接收方角色','recipient',v.settings.recipient)}<button class="text-btn" type="submit">保存用途设置</button></form>${c.blockers.length?`<div class="blockers" aria-label="导出阻断原因"><strong style="font-size:11px">还有 ${c.blockers.length} 项需要完成</strong>${c.blockers.map(x=>`<div class="blocker">• ${esc(x.text)}</div>`).join('')}</div>`:notice('当前快照已通过导出检查。','green')}<label class="checkline"><input id="review-ack" type="checkbox" ${v.review?'checked disabled':''}>我已核对本次候选预览、保留和排除的批注，以及文件用途。</label>${btn(v.review?'已复核当前候选':'复核当前候选','review','','check',!c.can_review||v.review?'disabled':'')}${btn('生成对外候选版','export','primary','download',!c.can_export?'disabled':'')}<p class="helper">确认绑定当前源文件与内容快照。任何决定、回复、证据或用途的变化都会要求重新复核。</p>${v.review?`<p class="helper">复核人：${esc(v.review.actor)}<br>${date(v.review.at)}<br>快照：${c.snapshot.slice(0,16)}…</p>`:''}</aside></div>`;
}
function timeline(logs,includeContract=false){
  return `<div class="timeline">${logs.map(l=>`<div class="timeline-item"><span class="timeline-icon">${icon(l.action.includes('导出')||l.action.includes('候选')?'shield':l.action.includes('导入')?'upload':'check')}</span><div><h3>${esc(l.action)}${includeContract?` · <a href="#/contract/${l.contract_id}/records">${esc(l.contract_title)}</a>`:''}</h3><p>${esc(l.actor)} · 源版本 V${l.version}${l.target?` · 对象 ${esc(l.target.length>12?l.target.slice(0,12)+'…':l.target)}`:''}<br>快照 ${esc(l.snapshot.slice(0,16))}…${l.before?.task_status&&l.after?.task_status?` · ${taskNames[l.before.task_status]} → ${taskNames[l.after.task_status]}`:''}</p></div><time>${date(l.at)}</time></div>`).join('')}</div>`;
}
function recordsPage(){
  const c=S.contract;
  return `<div class="section-head"><div><h2>每次处理，都有记录</h2><p>记录源版本、操作者、状态变化与候选文件指纹。</p></div>${dl('下载内部记录','record')}</div><section class="panel">${c.versions.map(v=>`<div class="history-banner">${badge('V'+v.number,v.number===c.current.number?'blue':'')}<strong>${esc(v.filename)}</strong><small>${date(v.imported_at)} · ${v.number===c.current.number?'当前源版本':'历史版本'}</small>${v.exports.length?badge(v.exports.length+' 份候选'):''}</div>${v.number!==c.current.number?v.exports.map(e=>`<div class="download-row"><div><strong>${esc(e.number)} · 历史候选</strong><small>已下载文件不能远程撤回，请勿误用历史版本。</small></div>${dl('下载历史候选','candidate',e.id)}</div>`).join(''):''}`).join('')}${timeline([...c.logs].reverse())}</section><div class="danger-zone">${btn('删除本合同','delete','danger sm','trash')}</div>`;
}
function globalTasks(){
  const tasks=S.details.flatMap(c=>c.current.comments.filter(x=>x.task).map(x=>({contract:c,comment:x})));
  const pending=tasks.filter(x=>x.comment.task.status!=='done');
  return heading('内部确认','集中跟进待回复和待法务复核的事项。')+notice(S.user?'被指定的责任成员可提交回复与证据；法务确认后，事项才会标记为已处理。':'回复与证据由操作者代录。只有法务单独确认后，事项才会标记为已处理。')+(tasks.length?`<div class="section-head"><h2>${pending.length} 项待处理 · ${tasks.length} 项全部事项</h2></div>${[...pending,...tasks.filter(x=>x.comment.task.status==='done')].map(({contract:c,comment:x})=>`<article class="panel global-task"><div>${badge(taskNames[x.task.status],x.task.status==='done'?'green':'amber')}<h3>${esc(x.task.title)}</h3><p>${esc(c.title)} · ${esc(x.task.owner)} · 业务回复代录</p></div><a class="btn sm" href="#/contract/${c.id}/tasks">查看事项 ${icon('arrow')}</a></article>`).join('')}`:empty('暂时没有内部事项','先在合同的批注处理中确认受众分类，并创建需要业务回复的待办。','<a class="btn primary" href="#/contracts">前往合同文件</a>'));
}
function globalHistory(){
  const logs=S.details.flatMap(c=>c.logs.map(l=>({...l,contract_id:c.id,contract_title:c.title}))).sort((a,b)=>b.at.localeCompare(a.at));
  return heading('处理记录','查看合同导入、人工决定、复核与候选导出的完整过程。')+(logs.length?`<section class="panel"><div class="panel-header"><h2>全部操作<span class="count">${logs.length} 条</span></h2>${badge('仅内部使用')}</div>${timeline(logs,true)}</section>`:empty('还没有处理记录','上传一份审阅版后，每一步处理会自动记录。'));
}
function settings(){
  if(S.user)return heading('团队设置','按合同授权成员，操作记录关联个人账号。')+'<a class="btn primary" href="/team.html">管理团队与退出登录</a>';
  return heading('演示设置','了解当前工作空间的运行方式与数据边界。')+`<section class="panel settings-panel"><h2>本地单人演示</h2><p>所有合同与处理记录保存于本机。当前没有真实账号、企业审批或外部模型连接。页面中的“演示法务”是演示角色，业务回复由操作者代录。</p><dl class="info-grid"><dt>模型模式</dt><dd>${badge('本地模拟建议','blue')} 可在合同中切换为全程人工处理。模拟规则不代表真实模型能力。</dd><dt>文件范围</dt><dd>基础 .docx，最大 10MB、300 条传统批注。100 页上限需要在 Word 中人工核对。</dd><dt>不支持的结构</dt><dd>加密、宏、嵌入对象、现代线程批注、未处理修订，以及无法可靠定位或清理的内容。</dd><dt>数据位置</dt><dd>项目目录下的 <code>.data/</code>，服务仅监听本机地址。</dd><dt>删除范围</dt><dd>删除本合同会移除源件、候选、事项、证据及本地记录。已下载文件不受影响，供应商侧留存不在本地删除范围内；当前未连接供应商。</dd><dt>候选文件用途</dt><dd>用于对外沟通，仍需人工核对，不代表法务批准或可签署。</dd></dl><div class="rule"></div><div class="flex">${btn('创建虚构示例','demo','','spark')}<a class="btn" href="/api/sample" download>${icon('download')}下载示例源文件</a></div></section>`;
}
function help(){
  if(S.user)return heading('团队使用指南','合同按参与者授权，处理决定由法务确认。')+'<section class="panel settings-panel"><h2>完成一次合同交接</h2><p>法务上传有权共享的审阅版，确认批注并选择责任成员。业务成员提交回复和证据后，法务复核并生成对外候选。AI 仅提供建议，不自动确认或导出。</p><p>管理员在团队页面邀请或移除成员。管理员按合同授权参与者；其他团队无法访问。并发修改发生冲突时，请刷新并核对最新内容。</p><a href="/team.html">查看团队成员</a></section>';
  return heading('使用指南','从审阅意见到可追溯的交接材料。')+`<section class="panel settings-panel"><h2>完成一次合同交接</h2><p>建议先从工作台的虚构示例开始。进入合同后，按下面四步完成流程。</p>${[['上传与定位','上传虚构或已脱敏的 .docx 审阅版。系统提取批注和对应原文；若包含未处理修订等结构，会明确阻断候选导出。'],['逐条确认批注','查看原文、原始批注及标注为模拟的分类建议。人工选择受众与处理方式；涉及内部与对外两类受众时，填写拆分内容。内部事项要指定责任角色。'],['处理内部事项','在内部确认清单代录业务回复，添加文字证据、文件附件或可核实的事实说明。保存回复后，再由法务点击“确认已处理”。也可退回补充，或填写不适用理由。'],['复核并导出','查看候选中保留与排除的批注，填写文件用途，勾选已核对预览并复核当前候选。通过服务端检查后生成真实 .docx。内部清单和处理记录单独下载。']].map(([t,d],i)=>`<div class="guide-step"><span class="step-number">${i+1}</span><div><strong>${t}</strong><p>${d}</p></div></div>`).join('')}<div class="rule"></div><h3 style="margin-bottom:14px">文件变化后怎么办？</h3><p>上传客户返回稿为新版本，需要重新处理批注与事项，不继承旧版本确认。本版不提供语义差异分析。修改已处理事项的回复、证据或输出决定，也会要求重新复核。</p>${notice('网页中的原文预览用于定位与内容核对，不能替代桌面 Word 的版式检查。对外候选不是签署批准。','amber')}<a class="btn primary" href="#/dashboard">回到工作台 ${icon('arrow')}</a></section>`;
}

async function mutate(action,p={}) {
  const c=S.contract;
  const result=await api(`/api/contracts/${c.id}/${action}`,{revision:c.revision,actor:'legal',...p});
  S.contract=result;
  S.rows=(await api('/api/contracts')).contracts;
  const scroll=window.scrollY;render();window.scrollTo(0,scroll);
  return result;
}
function openModal(title,body,footer='') {
  modal.dataset.tone=title==='删除本合同'?'danger':'default';
  modal.innerHTML=`<div class="modal-header"><h2 id="modal-title">${title}</h2><button class="icon-btn" data-action="close-modal" aria-label="关闭">${icon('x')}</button></div><div class="modal-body">${body}<div id="modal-error" class="modal-error" role="alert"></div></div>${footer?`<div class="modal-footer">${footer}</div>`:''}`;
  if(!modal.open)modal.showModal();
}
function uploadModal(version=false) {
  S.modalFile=null;
  openModal(version?'上传新的源版本':'上传审阅版',`${version?notice(`即将导入 V${S.contract.current.number+1}。旧复核将失效，新版本需要重新处理；旧候选保留为历史文件。`):''}<label class="dropzone" id="dropzone">${icon('upload')}<strong>点击选择，或将 Word 文件拖到这里</strong><p>仅支持 .docx · 最大 10MB · 最多 300 条批注<br>传统批注、普通正文、表格及图片</p><input id="upload-file" type="file" accept=".docx" aria-label="选择 Word 审阅版"></label><div id="selected-file" class="selected-file"></div>${S.user?`<label class="form-group">资料类型<select id="upload-data-kind" class="field"><option value="synthetic">虚构测试资料</option>${S.policy?.real_data_enabled?'<option value="real">已获授权的真实资料</option>':''}</select></label>`:''}<p class="helper">含未处理修订、现代批注或复杂嵌入对象的文件会被阻断导出。100 页范围须在 Word 中人工核对。</p><label class="checkline"><input id="upload-ack" type="checkbox">${S.user?'我确认资料类型真实准确，并有权向本合同的获授权参与者提供。':'我确认文件为虚构或已脱敏材料，不含真实客户信息。'}</label>`,btn('取消','close-modal')+btn(version?'导入新版本':'开始导入',version?'confirm-version':'confirm-upload','primary','upload'));
  const drop=document.getElementById('dropzone');
  drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('drag');});
  drop.addEventListener('dragleave',()=>drop.classList.remove('drag'));
  drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('drag');selectUpload(e.dataTransfer.files[0]);});
}
function selectUpload(file){
  if(!file)return;
  const error=document.getElementById('modal-error');
  if(!file.name.toLowerCase().endsWith('.docx')||file.size>10*1024*1024){S.modalFile=null;document.getElementById('selected-file').textContent='';error.textContent='请选择 10MB 以内的 .docx 文件。';return;}
  S.modalFile=file;error.textContent='';document.getElementById('selected-file').innerHTML=icon('file')+esc(file.name)+` <small>(${(file.size/1024).toFixed(1)} KB)</small>`;
}
function base64File(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=()=>reject(new Error('文件读取失败，请重新选择。'));reader.readAsDataURL(file);});}
async function upload(version=false){
  if(!S.modalFile)throw new Error('请先选择 .docx 文件。');
  if(!document.getElementById('upload-ack').checked)throw new Error(S.user?'请确认资料上传与团队共享授权。':'请确认文件为虚构或已脱敏材料。');
  const payload={filename:S.modalFile.name,data:await base64File(S.modalFile),acknowledged:true,...(S.user?{data_kind:document.getElementById('upload-data-kind').value}:{})};
  const c=version?await mutate('version',payload):await api('/api/contracts',payload);
  modal.close();toast(`已导入源版本 V${c.current.number}${c.current.errors.length?'，存在格式阻断，请查看详情。':c.current.comments.length?'，请逐条确认批注。':'，请填写人工交接清单。'}`);
  S.selected=null;location.hash=`/contract/${c.id}/comments`;await loadRoute();
}
async function createDemo(){const c=await api('/api/demo',{sample:0});S.selected=null;location.hash=`/contract/${c.id}/comments`;toast('已创建虚构示例，所有批注均待人工确认。');}

document.addEventListener('click',async e=>{
  const el=e.target.closest('[data-action]');if(!el||el.disabled)return;
  const action=el.dataset.action;
  if(action==='close-modal'){modal.close();return;}
  if(action==='menu'){document.querySelector('.sidebar').classList.toggle('open');return;}
  if(action==='filter'){S.filter=el.dataset.value;render();return;}
  if(action==='clear-filter'){S.filter='all';S.query='';render();return;}
  if(action==='mobile-pane'){S.mobilePane=el.dataset.value;render();return;}
  if(action==='select-comment'){S.selected=el.dataset.id;render();return;}
  if(action==='prev-comment'||action==='next-comment'){
    const items=S.contract.current.comments,i=items.findIndex(x=>x.id===S.selected);S.selected=items[i+(action==='next-comment'?1:-1)]?.id || S.selected;render();return;
  }
  if(S.busy)return;
  S.busy=true;el.disabled=true;
  try {
    if(action==='reload')await loadRoute();
    if(action==='demo')await createDemo();
    if(action==='upload')uploadModal();
    if(action==='version')uploadModal(true);
    if(action==='confirm-upload')await upload();
    if(action==='confirm-version')await upload(true);
    if(action==='task-confirm'){
      const form=el.closest('form'),c=S.contract.current.comments.find(x=>x.id===el.dataset.id);
      if(form.querySelector('[name="reply-'+c.id+'"]').value.trim()!==c.task.reply||form.querySelector('[name="evidence-'+c.id+'"]').value.trim()!==c.task.evidence)throw new Error('回复或证据有未保存修改，请先保存回复，再进行法务确认。');
      await mutate('task',{comment_id:el.dataset.id,decision:'confirm'});toast('法务已确认该事项处理完成。');
    }
    if(action==='task-na'||action==='task-return'){
      const na=action==='task-na';openModal(na?'将事项标记为不适用':'退回补充',field(na?'法务不适用理由':'需要补充的内容','task-reason','','请填写明确、可追溯的原因',true),btn('取消','close-modal')+btn(na?'确认不适用':'退回补充','confirm-task','primary','',`data-id="${el.dataset.id}" data-decision="${na?'na':'return'}"`));
    }
    if(action==='confirm-task'){await mutate('task',{comment_id:el.dataset.id,decision:el.dataset.decision,reason:document.getElementById('task-reason').value});modal.close();toast(el.dataset.decision==='na'?'已记录不适用理由。':'已退回，事项重新等待回复。');}
    if(action==='attach'){
      openModal('添加事项证据',`<label class="field-label" for="evidence-file">选择附件 · 最大 5MB</label><input class="field" id="evidence-file" type="file" accept=".pdf,.png,.jpg,.jpeg,.txt,.docx"><p class="helper">证据仅保留在内部。支持 PDF、图片、TXT 和 DOCX；附件变化会使原复核失效。团队试用仅接收虚构资料。</p>${S.user?`<label class="form-group">资料类型<select id="evidence-data-kind" class="field"><option value="synthetic">虚构测试资料</option>${S.policy?.real_data_enabled?'<option value="real">已获授权的真实资料</option>':''}</select></label>`:''}`,btn('取消','close-modal')+btn('保存证据','confirm-attach','primary','clip',`data-id="${el.dataset.id}"`));
    }
    if(action==='confirm-attach'){
      const file=document.getElementById('evidence-file').files[0];if(!file)throw new Error('请先选择证据附件。');if(file.size>5*1024*1024)throw new Error('附件最大 5MB。');
      await mutate('evidence',{comment_id:el.dataset.id,filename:file.name,data:await base64File(file),...(S.user?{data_kind:document.getElementById('evidence-data-kind').value}:{})});modal.close();toast('证据已保存，请重新复核事项。');
    }
    if(action==='review'||action==='export'){
      const settingsForm=document.getElementById('settings-form');
      if(settingsForm&&(settingsForm.elements.purpose.value.trim()!==S.contract.current.settings.purpose||settingsForm.elements.recipient.value.trim()!==S.contract.current.settings.recipient))throw new Error('文件用途或接收方有未保存修改，请先保存用途设置，再复核或导出。');
    }
    if(action==='review'){
      if(!document.getElementById('review-ack').checked)throw new Error('请先核对预览并勾选确认说明。');
      await mutate('review',{snapshot:S.contract.snapshot,acknowledged:true});toast('已复核当前快照，可以生成对外候选。');
    }
    if(action==='export'){
      const result=await api(`/api/contracts/${S.contract.id}/export`,{revision:S.contract.revision,snapshot:S.contract.snapshot,actor:'legal'});
      S.contract=result.contract;S.rows=(await api('/api/contracts')).contracts;render();toast('对外候选已生成。仍需人工核对，不代表可签署。');
      const a=document.createElement('a');a.href=`/api/contracts/${S.contract.id}/download/candidate/${result.artifact.id}`;a.download=result.artifact.filename;a.click();
    }
    if(action==='delete'){
      openModal('删除本合同',`<p style="font-size:13px;line-height:2">将删除「${esc(S.contract.title)}」的全部源版本、候选文件、事项、证据及本地处理记录，刷新后不可恢复。</p><p class="helper">已下载文件无法撤回。供应商侧留存不属于本地删除可控范围；${S.user?'如曾调用 AI，供应商侧数据处理遵循其服务条款。':'当前未连接外部模型。'}</p>`,btn('取消','close-modal')+btn('确认删除本合同','confirm-delete','danger','trash'));
    }
    if(action==='confirm-delete'){await api('/api/contracts/'+S.contract.id,{revision:S.contract.revision,actor:'legal'},'DELETE');modal.close();location.hash='/contracts';toast('合同及应用可控的关联数据已删除。');}
    if(action==='model-ai'){
      const model=document.getElementById('ai-model')?.value||S.aiQuota?.model;
      if(!confirm(`将把当前批注及引用原文${aiDestination(model)}生成建议。请确认你有权向该服务提供这些内容。`))return;
      S.contract=await api(`/api/contracts/${S.contract.id}/ai`,{revision:S.contract.revision,comment_id:S.selected,model,acknowledged:true});S.aiQuota=await api('/api/ai/quota');render();toast('建议已更新；请核对结果，人工决定保持不变。');
    }
    if(action==='model-manual'||action==='model-retry'){await mutate('model',{mode:action==='model-manual'?'manual':'simulation'});toast(action==='model-manual'?'已切换人工模式，已保存的人工决定保留。':'模拟建议已刷新，仍需逐条人工确认。');}
  } catch(err){if(modal.open){document.getElementById('modal-error').textContent=err.message;}else toast(err.message,true);}
  finally{S.busy=false;if(el.isConnected)el.disabled=false;}
});

document.addEventListener('input',e=>{
  if(e.target.id==='search'){S.query=e.target.value;document.getElementById('contract-results').innerHTML=contractTable();}
});
document.addEventListener('change',e=>{
  if(e.target.id==='upload-file')selectUpload(e.target.files[0]);
  if(e.target.id==='ai-model')S.aiModel=e.target.value;
  const form=e.target.closest('#comment-form');
  if(!form)return;
  if(e.target.name==='labels'){
    if(e.target.value==='uncertain'&&e.target.checked)form.querySelectorAll('[name="labels"]:not([value="uncertain"])').forEach(x=>x.checked=false);
    else if(e.target.checked)form.querySelector('[name="labels"][value="uncertain"]').checked=false;
  }
  const labels=[...form.querySelectorAll('[name="labels"]:checked')].map(x=>x.value);
  const c=S.contract.current.comments.find(x=>x.id===form.dataset.id);
  document.getElementById('split-fields').classList.toggle('hidden',labels.length<2);
  document.getElementById('task-fields').classList.toggle('hidden',!c.task&&!labels.includes('internal')&&!form.elements.needs_fact.checked);
  document.getElementById('rewrite-field').classList.toggle('hidden',form.elements.output.value!=='rewrite'||labels.length>1);
});

document.addEventListener('submit',async e=>{
  const form=e.target;if(!(form instanceof HTMLFormElement))return;e.preventDefault();if(S.busy)return;
  const data=Object.fromEntries(new FormData(form));S.busy=true;const submit=form.querySelector('[type="submit"]');if(submit)submit.disabled=true;
  try{
    if(form.id==='comment-form'){
      const labels=new FormData(form).getAll('labels'); if(labels.length>1&&data.output==='rewrite')data.external_text=data.split_external;
      await mutate('comment',{...data,comment_id:form.dataset.id,labels,needs_fact:form.elements.needs_fact.checked});toast('人工分类与处理方式已保存。');
    }else if(form.classList.contains('reply-form')){
      const id=form.dataset.id;await mutate('reply',{comment_id:id,reply:data['reply-'+id],evidence:data['evidence-'+id]});toast(S.user?'回复已提交，事项进入待法务复核。':'回复已代录，事项进入待法务复核。');
    }else if(form.id==='settings-form'){await mutate('settings',data);toast('用途设置已保存，需要复核当前候选。');}
    else if(form.id==='handoff-form'){await mutate('handoff',Object.fromEntries(Object.entries(data).map(([k,v])=>[k.replace(/^handoff-/,''),v])));toast('人工交接检查已保存。');}
  }catch(err){toast(err.message,true);}finally{S.busy=false;if(submit?.isConnected)submit.disabled=false;}
});
modal.addEventListener('click',e=>{if(e.target===modal){const rect=modal.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)modal.close();}});
window.addEventListener('hashchange',loadRoute);
initEntryCover();
loadRoute();
