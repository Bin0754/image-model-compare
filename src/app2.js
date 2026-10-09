/* ========== 对比组 表单 ========== */
function openSetForm(s){
 const isNew=!s;s=s||{title:'',prompt:'',negative:'',date:today(),tags:[],notes:''};
 const m=showModal({title:isNew?'新建对比组':'编辑对比组',body:`<form class="form" id="setForm">
  <label>标题 <small>留空则自动用提示词开头</small><input name="title" value="${esc(s.title)}" placeholder="例如：雨夜霓虹橘猫 · 写实"></label>
  <label>提示词 *<textarea name="prompt" rows="5" placeholder="粘贴你给所有模型使用的同一段提示词">${esc(s.prompt)}</textarea></label>
  <label>反向提示词 <small>可选</small><textarea name="negative" rows="2">${esc(s.negative)}</textarea></label>
  <div class="g2"><label>日期<input type="date" name="date" value="${esc(s.date)}"></label><label>标签 <small>用逗号或空格分隔</small><input name="tags" value="${esc((s.tags||[]).join(', '))}" placeholder="人像, 写实, 中文文字"></label></div>
  <label>备注<textarea name="notes" rows="3">${esc(s.notes)}</textarea></label></form>`,
  footer:`<button class="btn" data-close>取消</button><button class="btn primary" id="setSave">${isNew?'创建，然后添加图片':'保存'}</button>`});
 const f=$('#setForm',m.el);setTimeout(()=>f.prompt.focus(),30);
 const save=async()=>{const d=Object.fromEntries(new FormData(f));if(!d.prompt.trim()&&!d.title.trim()){toast('请至少填写提示词或标题');return}
  const p=d.prompt.trim();
  const obj={...s,id:s.id||uid(),title:d.title.trim()||p.slice(0,24)+(p.length>24?'…':''),prompt:p,negative:d.negative.trim(),date:d.date||today(),tags:d.tags.split(/[,，、\s]+/).map(x=>x.trim()).filter(Boolean),notes:d.notes.trim(),createdAt:s.createdAt||Date.now()};
  await idb.put('sets',obj);const i=S.sets.findIndex(x=>x.id===obj.id);if(i>=0)S.sets[i]=obj;else S.sets.push(obj);
  m.close();selectSet(obj.id);toast(isNew?'已创建，拖入或选择图片吧':'已保存');if(isNew)$('#addFiles').click()};
 $('#setSave',m.el).onclick=save;
 f.addEventListener('submit',e=>{e.preventDefault();save()});
}
async function deleteSet(id){const s=S.sets.find(x=>x.id===id);if(!s)return;const es=entriesOf(id);
 if(!confirm(`确定删除对比组「${s.title}」及其中 ${es.length} 张图片吗？此操作不可撤销（建议先导出备份）。`))return;
 for(const e of es){await idb.del('entries',e.id);dropUrl(e.id)}await idb.del('sets',id);
 S.entries=S.entries.filter(e=>e.setId!==id);S.sets=S.sets.filter(x=>x.id!==id);S.cur=sortedSets()[0]?.id||null;pref.set('cur',S.cur);S.picked.clear();renderAll();toast('已删除')}

/* ========== 添加图片 ========== */
function readDims(blob){return new Promise(res=>{const u=URL.createObjectURL(blob);const im=new Image();im.onload=()=>{res([im.naturalWidth,im.naturalHeight]);URL.revokeObjectURL(u)};im.onerror=()=>{res([null,null]);URL.revokeObjectURL(u)};im.src=u})}
function guessModel(fname){
 const base=fname.replace(/\.[a-z0-9]+$/i,'');
 const nb=normName(base);
 /* 模型库优先（可带出默认值），其次预设；按名称长度从长到短匹配，忽略大小写、空格、-、_、. */
 const cands=[...S.models.map(m=>m.name),...PRESET_MODELS].filter(n=>normName(n));
 const hit=cands.map((n,i)=>[n,i]).sort((a,b)=>normName(b[0]).length-normName(a[0]).length||a[1]-b[1]).find(([n])=>nb.includes(normName(n)));
 if(hit){const lib=modelByName(hit[0]);const pre=PRESET_MODELS.find(p=>normName(p)===normName(hit[0]));return lib?lib.name:pre||hit[0]}
 return base.replace(/[_\-\s]+(\d{1,4}|copy|副本|final|out|output)$/i,'').replace(/_/g,' ').trim()||base}
async function addFiles(files){
 files=[...files].filter(f=>(f.type||'').startsWith('image/')||/\.(png|jpe?g|webp|gif|avif|bmp)$/i.test(f.name));
 if(!files.length){toast('没有识别到图片文件');return}
 let s=cur();
 if(!s){s={id:uid(),title:'未命名对比组 '+today(),prompt:'',negative:'',date:today(),tags:[],notes:'',createdAt:Date.now()};await idb.put('sets',s);S.sets.push(s);S.cur=s.id;pref.set('cur',s.id)}
 let order=Math.max(0,...entriesOf(s.id).map(e=>e.order||0));const ids=[];
 for(const f of files){const [w,h]=await readDims(f);const model=guessModel(f.name);const lib=modelByName(model);
  const e={id:uid(),setId:s.id,order:++order,model,provider:lib?.provider||'',blob:f,mime:f.type,fileName:f.name,width:w,height:h,aspect:'',cost:lib?.cost??null,currency:lib?.currency||'$',time:null,params:lib?.params||'',score:0,pros:'',cons:'',notes:'',best:false,createdAt:Date.now()};
  await idb.put('entries',e);S.entries.push(e);ids.push(e.id)}
 renderAll();toast(`已添加 ${ids.length} 张图片，接下来逐张填写信息`);
 openEntryForm(ids);
}
$('#addFiles').addEventListener('change',e=>{const fs=[...e.target.files];e.target.value='';if(fs.length)addFiles(fs)});
let dragDepth=0;const hasFiles=e=>[...(e.dataTransfer?.types||[])].includes('Files');
window.addEventListener('dragenter',e=>{if(!hasFiles(e))return;e.preventDefault();dragDepth++;const inForm=modalStack.some(x=>x.kind==='entry');$('#dropOverlay').textContent=inForm?'松开以替换当前编辑的图片':cur()?`松开鼠标，把图片添加到「${cur().title}」`:'松开鼠标，新建一组并添加图片';$('#dropOverlay').classList.add('on')});
window.addEventListener('dragleave',e=>{if(!hasFiles(e))return;dragDepth=Math.max(0,dragDepth-1);if(!dragDepth)$('#dropOverlay').classList.remove('on')});
window.addEventListener('dragover',e=>{if(hasFiles(e))e.preventDefault()});
window.addEventListener('drop',e=>{if(!hasFiles(e))return;e.preventDefault();dragDepth=0;$('#dropOverlay').classList.remove('on');
 const fs=[...e.dataTransfer.files];
 const ef=[...modalStack].reverse().find(x=>x.kind==='entry');
 if(ef){ef.onDropFile(fs[0]);return}
 if(modalStack.length){toast('请先关闭当前窗口再拖入图片');return}
 addFiles(fs)});
window.addEventListener('paste',e=>{if(modalStack.length)return;const fs=[...(e.clipboardData?.files||[])];if(fs.length){e.preventDefault();addFiles(fs)}});

/* ========== 模型名称下拉框（可选预设 / 模型库，也可自由输入） ========== */
function modelOptions(withLib=true){const seen=new Set();const out=[];
 const add=(name,kind,sub)=>{const k=normName(name);if(!k||seen.has(k))return;seen.add(k);out.push({name,kind,sub})};
 PRESET_MODELS.forEach(n=>{const lib=modelByName(n);add(n,'preset',lib?.provider?'预设 · 模型库 · '+lib.provider:lib?'预设 · 模型库':'预设')});
 if(withLib)[...S.models].sort((a,b)=>a.name.localeCompare(b.name,'zh-Hans')).forEach(m=>add(m.name,'lib','模型库'+(m.provider?' · '+m.provider:'')));
 return out}
function attachModelCombo(input,host,{withLib=true}={}){
 input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-expanded','false');
 const lid='combo-'+uid();input.setAttribute('aria-controls',lid);
 const dd=document.createElement('div');dd.className='combo-dd';dd.id=lid;dd.setAttribute('role','listbox');dd.hidden=true;host.appendChild(dd);
 let items=[],active=-1,filtering=false;
 const place=()=>{const r=input.getBoundingClientRect();const below=innerHeight-r.bottom;const h=Math.min(300,dd.scrollHeight||300);
  dd.style.left=r.left+'px';dd.style.width=Math.max(r.width,290)+'px';
  if(below<h+12&&r.top>below){dd.style.top='';dd.style.bottom=(innerHeight-r.top+6)+'px'}else{dd.style.bottom='';dd.style.top=(r.bottom+6)+'px'}};
 const hl=(name,q)=>{if(!q)return esc(name);const lo=name.toLowerCase();let out='',i=0;const toks=q.toLowerCase().split(/\s+/).filter(Boolean);
  const marks=new Array(name.length).fill(false);toks.forEach(t=>{const j=lo.indexOf(t);if(j>=0)for(let k=j;k<j+t.length;k++)marks[k]=true});
  for(i=0;i<name.length;i++)out+=marks[i]&&!marks[i-1]?'<mark>'+esc(name[i]):esc(name[i]),out+=marks[i]&&!marks[i+1]?'</mark>':'';return out};
 const render=()=>{const q=filtering?input.value.trim():'';const toks=q.split(/\s+/).map(normName).filter(Boolean);
  items=modelOptions(withLib).filter(o=>toks.every(t=>normName(o.name).includes(t)));
  const exact=items.some(o=>normName(o.name)===normName(input.value));
  if(active>=items.length)active=items.length-1;
  const cur=normName(input.value);
  dd.innerHTML=(items.length?items.map((o,i)=>`<div class="combo-opt ${i===active?'active':''} ${normName(o.name)===cur?'sel':''}" role="option" id="${lid}-${i}" aria-selected="${i===active}" data-i="${i}"><span class="co-name">${hl(o.name,q)}</span><span class="co-tag ${o.kind}">${esc(o.sub)}</span></div>`).join('')
   :'')+(q&&!exact&&active<0?`<div class="combo-custom">↵ 使用自定义名称「<b>${esc(q)}</b>」</div>`:'')+(!items.length&&!q?'<div class="combo-custom">暂无选项，可直接输入</div>':'')+`<div class="combo-foot">↑↓ 选择 · Enter 确认 · Esc 关闭 · 可直接输入任意名称</div>`;
  input.setAttribute('aria-activedescendant',active>=0?lid+'-'+active:'');place();
  const a=dd.querySelector('.combo-opt.active');if(a)a.scrollIntoView({block:'nearest'})};
 const open=(filter)=>{filtering=!!filter;if(dd.hidden){dd.hidden=false;input.setAttribute('aria-expanded','true');active=filter?-1:modelOptions(withLib).findIndex(o=>normName(o.name)===normName(input.value))}render()};
 const close=()=>{if(dd.hidden)return;dd.hidden=true;input.setAttribute('aria-expanded','false');active=-1};
 const pick=i=>{const o=items[i];if(!o)return;input.value=o.name;close();input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}))};
 input.addEventListener('focus',()=>{if(input.dataset.skipOpen){delete input.dataset.skipOpen;return}open(false)});
 input.addEventListener('click',()=>{if(dd.hidden)open(false)});
 input.addEventListener('input',e=>{if(!e.isTrusted&&dd.hidden)return;active=-1;open(true)});
 input.addEventListener('keydown',e=>{
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(dd.hidden){open(false);return}const n=items.length;if(!n)return;active=e.key==='ArrowDown'?(active+1)%n:(active-1+n)%n;render()}
  else if(e.key==='Enter'){if(!dd.hidden){e.preventDefault();e.stopPropagation();if(active>=0&&items[active])pick(active);else close()}}
  else if(e.key==='Escape'){if(!dd.hidden){e.preventDefault();e.stopPropagation();close()}}
  else if(e.key==='Tab')close()});
 input.addEventListener('blur',()=>setTimeout(()=>{if(document.activeElement!==input)close()},120));
 dd.addEventListener('mousedown',e=>{e.preventDefault();const o=e.target.closest('.combo-opt');if(o)pick(Number(o.dataset.i));else if(e.target.closest('.combo-custom'))close()});
 dd.addEventListener('mousemove',e=>{const o=e.target.closest('.combo-opt');if(o&&Number(o.dataset.i)!==active){active=Number(o.dataset.i);$$('.combo-opt',dd).forEach((x,i)=>x.classList.toggle('active',i===active))}});
 const rp=()=>{if(!dd.hidden)place()};window.addEventListener('resize',rp);host.addEventListener('scroll',rp,true);
 return {open,close}}

/* ========== 单张图片信息 表单 ========== */
function openEntryForm(queue,idx=0){
 const e=S.entries.find(x=>x.id===queue[idx]);if(!e)return;
 const inLib=!!modelByName(e.model);
 let newBlob=null,score=e.score||0;
 const m=showModal({wide:true,title:`填写出图信息 <span class="hint">${esc(e.fileName||'')}</span>`,body:`<div class="ef"><div class="ef-preview" title="可拖入新图片替换"><img id="efImg" src="${urlOf(e)}" alt=""></div>
 <form class="form" id="entryForm" autocomplete="off">
  <div class="g2"><label>模型名称 *<input name="model" value="${esc(e.model)}" placeholder="选择预设或直接输入" autocomplete="off"></label><label>平台 / 服务商<input name="provider" value="${esc(e.provider)}" placeholder="如 OpenAI / 即梦 / 本地 ComfyUI"></label></div>
  <div class="g3"><label>成本（每张）<div class="cost-in"><input name="cost" type="number" step="any" min="0" value="${e.cost??''}" placeholder="0.04"><select name="currency" title="单位，默认美元">${CURRENCIES.map(c=>`<option value="${c}" ${(e.currency||'$')===c?'selected':''}>${c==='$'?'$ 美元':c==='¥'?'¥ 人民币':c}</option>`).join('')}</select></div><span class="cny-live" id="cnyLive"></span></label>
   <label>生成耗时（秒）<input name="time" type="number" step="any" min="0" value="${e.time??''}"></label>
   <label>汇率（$1 = ¥）<input name="rate" type="number" step="0.01" min="0" value="${S.rate}"></label></div>
  <div class="g3"><label>宽（像素）<input name="width" type="number" value="${e.width??''}"></label><label>高（像素）<input name="height" type="number" value="${e.height??''}"></label><label>画面比例<input name="aspect" value="${esc(e.aspect)}" placeholder="${aspectOf(e.width,e.height)}"></label></div>
  <label>默认设置 / 使用参数 <small>每行一条「键: 值」会以表格显示，也可以自由书写</small><textarea name="params" rows="4" placeholder="质量: high&#10;风格: 默认&#10;CFG: 7">${esc(e.params)}</textarea></label>
  <div class="score-row"><span class="lbl2">评分（1–10）</span><span class="score-input" id="scoreIn">${[1,2,3,4,5,6,7,8,9,10].map(i=>`<button type="button" data-v="${i}" title="${i} 分">${i}</button>`).join('')}</span><button type="button" class="link" id="starClear">清除</button></div>
  <label class="check"><input type="checkbox" name="best" ${e.best?'checked':''}> 🏆 标记为本组最佳</label>
  <label>优点<textarea name="pros" rows="2">${esc(e.pros)}</textarea></label>
  <label>缺点<textarea name="cons" rows="2">${esc(e.cons)}</textarea></label>
  <label>备注<textarea name="notes" rows="2">${esc(e.notes)}</textarea></label>
  <div class="g2"><label class="check"><input type="checkbox" name="saveLib" ${inLib?'':'checked'}> 保存 / 更新到模型库</label><label>更换图片<input type="file" name="replace" accept="image/*"></label></div>
  <div class="hint">模型库：输入已保存过的模型名时，会自动填入平台、默认成本与默认参数。</div>
 </form></div>`,
 footer:`<span class="queue-info">${queue.length>1?`第 ${idx+1} / ${queue.length} 张`:''}</span><button class="btn danger" id="efDel">删除这张</button><button class="btn" data-close>取消</button>${idx<queue.length-1?'<button class="btn" id="efSaveNext">保存并编辑下一张 →</button>':''}<button class="btn primary" id="efSave">保存</button>`});
 m.kind='entry';
 const f=$('#entryForm',m.el);
 const sBtns=$$('#scoreIn button',m.el);
 const paintStars=(pre=0)=>sBtns.forEach(b=>{const v=Number(b.dataset.v);b.classList.toggle('on',v<=score&&!pre);b.classList.toggle('pre',!!pre&&v<=pre)});paintStars();
 $('#scoreIn',m.el).onclick=ev=>{const v=ev.target.dataset.v;if(v){score=Number(v);paintStars()}};
 $('#scoreIn',m.el).onmouseover=ev=>{const v=ev.target.dataset.v;if(v)paintStars(Number(v))};
 $('#scoreIn',m.el).onmouseleave=()=>paintStars();
 $('#starClear',m.el).onclick=()=>{score=0;paintStars()};
 const fillFromLib=()=>{const lib=modelByName(f.model.value);if(!lib)return;
  if(!f.provider.value)f.provider.value=lib.provider||'';
  if(f.cost.value===''&&lib.cost!=null){f.cost.value=lib.cost;f.currency.value=lib.currency||'$'}
  if(!f.params.value)f.params.value=lib.params||'';
  f.saveLib.checked=false;updCny();toast('已从模型库填入默认值')};
 const updCny=()=>{const c=numOrNull(f.cost.value);const cur=f.currency.value;const r=Number(f.rate.value)||7.2;
  $('#cnyLive',m.el).textContent=c==null?(cur==='$'?'输入美元价格，自动折算人民币':''):cur==='$'?`≈ ${fmtCNY(c*r)} / 张（按 $1 = ¥${r}）`:cur==='¥'?`≈ $${trimNum((c/r).toFixed(4))} / 张`:''};
 f.cost.addEventListener('input',updCny);f.currency.addEventListener('change',updCny);
 f.rate.addEventListener('input',()=>{const r=Number(f.rate.value);if(r>0){S.rate=r;pref.set('rate',r)}updCny()});updCny();
 f.model.addEventListener('change',fillFromLib);
 attachModelCombo(f.model,m.el);
 const setImg=async file=>{if(!file||!(file.type||'').startsWith('image/'))return;newBlob=file;const [w,h]=await readDims(file);f.width.value=w||'';f.height.value=h||'';f.aspect.placeholder=aspectOf(w,h);$('#efImg',m.el).src=URL.createObjectURL(file);toast('已替换图片（保存后生效）')};
 m.onDropFile=setImg;
 f.replace.addEventListener('change',()=>setImg(f.replace.files[0]));
 const updAsp=()=>f.aspect.placeholder=aspectOf(+f.width.value,+f.height.value);
 f.width.addEventListener('input',updAsp);f.height.addEventListener('input',updAsp);
 const save=async()=>{
  if(!f.model.value.trim()){f.model.focus();toast('请填写模型名称');return false}
  const d=Object.fromEntries(new FormData(f));
  Object.assign(e,{model:d.model.trim(),provider:d.provider.trim(),cost:numOrNull(d.cost),currency:d.currency,time:numOrNull(d.time),width:numOrNull(d.width),height:numOrNull(d.height),aspect:d.aspect.trim(),params:d.params.trim(),score,best:!!d.best,pros:d.pros.trim(),cons:d.cons.trim(),notes:d.notes.trim()});
  if(newBlob){e.blob=newBlob;e.mime=newBlob.type;e.fileName=newBlob.name;dropUrl(e.id)}
  if(e.best){for(const o of entriesOf(e.setId))if(o.id!==e.id&&o.best){o.best=false;await idb.put('entries',o)}}
  await idb.put('entries',e);
  delete e.seed;delete e.steps;
  if(d.saveLib)await saveModel({name:e.model,provider:e.provider,cost:e.cost,currency:e.currency,params:e.params},true);
  renderAll();refreshLightbox();return true};
 $('#efSave',m.el).onclick=async()=>{if(await save()){m.close();toast('已保存')}};
 const nx=$('#efSaveNext',m.el);if(nx)nx.onclick=async()=>{if(await save()){m.close();openEntryForm(queue,idx+1)}};
 $('#efDel',m.el).onclick=async()=>{if(await deleteEntry(e.id)){m.close();const rest=queue.filter(x=>x!==e.id);if(idx<rest.length)openEntryForm(rest,idx)}};
 f.addEventListener('submit',ev=>{ev.preventDefault();$('#efSave',m.el).click()});
 setTimeout(()=>{f.model.dataset.skipOpen='1';f.model.focus();f.model.select()},30);
}
async function deleteEntry(id){const e=S.entries.find(x=>x.id===id);if(!e)return false;
 if(!confirm(`确定删除「${e.model}」这张图片及其信息吗？`))return false;
 await idb.del('entries',id);dropUrl(id);S.entries=S.entries.filter(x=>x.id!==id);S.picked.delete(id);renderAll();toast('已删除');return true}
async function toggleBest(id){const e=S.entries.find(x=>x.id===id);if(!e)return;const v=!e.best;
 for(const o of entriesOf(e.setId)){const nv=o.id===id?v:false;if(o.best!==nv){o.best=nv;await idb.put('entries',o)}}renderAll();refreshLightbox()}

/* ========== 缩放/平移组件 ========== */
class Zoomer{
 constructor(stage,img,onChange){this.stage=stage;this.img=img;this.s=1;this.x=0;this.y=0;this.onChange=onChange;
  stage.addEventListener('wheel',e=>{e.preventDefault();this.zoomAt(this.s*Math.exp(-e.deltaY*0.0015),e)},{passive:false});
  stage.addEventListener('pointerdown',e=>{if(e.button!==0)return;this.drag={px:e.clientX,py:e.clientY,x:this.x,y:this.y};stage.setPointerCapture(e.pointerId);stage.classList.add('dragging')});
  stage.addEventListener('pointermove',e=>{if(!this.drag)return;this.x=this.drag.x+e.clientX-this.drag.px;this.y=this.drag.y+e.clientY-this.drag.py;this.apply(true)});
  const up=()=>{this.drag=null;stage.classList.remove('dragging')};stage.addEventListener('pointerup',up);stage.addEventListener('pointercancel',up);
  stage.addEventListener('dblclick',e=>{if(this.s>1.01)this.reset();else this.zoomAt(2.5,e)})}
 zoomAt(ns,e){ns=Math.min(40,Math.max(0.2,ns));const r=this.stage.getBoundingClientRect();
  const px=e?e.clientX-r.left-r.width/2:0,py=e?e.clientY-r.top-r.height/2:0;
  this.x=px-(px-this.x)*(ns/this.s);this.y=py-(py-this.y)*(ns/this.s);this.s=ns;this.apply(true)}
 actual(){const w=this.img.offsetWidth;if(w&&this.img.naturalWidth){this.s=1;this.x=0;this.y=0;this.zoomAt(this.img.naturalWidth/w)}}
 reset(){this.s=1;this.x=0;this.y=0;this.apply(true)}
 set(st){this.s=st.s;this.x=st.x;this.y=st.y;this.apply(false)}
 apply(emit){this.img.style.transform=`translate(${this.x}px,${this.y}px) scale(${this.s})`;if(emit&&this.onChange)this.onChange(this)}
 pct(){const w=this.img.offsetWidth;return w&&this.img.naturalWidth?Math.round(this.s*w/this.img.naturalWidth*100):Math.round(this.s*100)}
}
