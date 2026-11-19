import React, { useEffect, useState } from 'react'
import {
  ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronDown, ChevronRight, CircleAlert,
  ClipboardCheck, Compass, Copy, Download, FileJson, FileText, Fingerprint,
  Gauge, Layers3, LayoutDashboard, LoaderCircle, Mail, Menu, MessageSquareText,
  RefreshCcw, RotateCcw, Settings2, Shield, ShieldCheck, Target, X, Lightbulb, UserRound, Package
} from 'lucide-react'
import seed from './seed.json'

const API = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')
const KEY = 'angleforge-studio-v3'

// NAV: Workspace (dashboard), Brand Hub, Personas, Campaigns, Content Studio, Brand Compliance, Export Center
// Only Brand Hub is always clickable from nav; others require sequential unlock
const NAV = [
  {id:'dashboard',label:'Workspace',icon:LayoutDashboard},
  {id:'brand',label:'Brand Hub',icon:Fingerprint},
  {id:'personas',label:'Personas',icon:Target},
  {id:'campaigns',label:'Campaigns',icon:Layers3},
  {id:'content',label:'Content Studio',icon:MessageSquareText},
  {id:'compliance',label:'Brand Compliance',icon:ShieldCheck},
  {id:'export',label:'Export Center',icon:Download}
]
const FLOW = ['dashboard','brand','personas','campaigns','content','compliance','export']

const initials = ['AC','NS','ME']
const colors = ['rose','indigo','mint']
const clone = obj => JSON.parse(JSON.stringify(obj))
const lines = value => (value || []).join('\n')
const toLines = value => value.split(/\r?\n/)
const csv = value => (value || []).join(', ')
const fromCSV = value => value.split(',').map(x=>x.trim()).filter(Boolean)
const human = text => String(text || '').split('—')[0].trim()

const asBrandPayload = b => ({...b,
  product_description: [b.product_name,b.product_tagline,...(b.product_facts||[])].filter(Boolean).join('. ').slice(0,1800),
  key_benefits: (b.product_facts||[]).slice(0,3).length ? b.product_facts.slice(0,3) : ['Product details to be confirmed'],
  tone: (b.tone_words||[]).join(', ') || 'Warm, specific, and clear',
  email_body_limit: b.email_body_limit || 9000
})

// Empty brand — no default data
const emptyBrand = () => asBrandPayload({
  brand_name:'', product_name:'', product_tagline:'', product_price:'',
  product_facts:[], claims_policy:'', tone_words:[], brand_dos:[], brand_donts:[],
  example_lines:[], banned_words:[], social_char_limit:280, hashtag_limit:5,
  social_emoji_limit:5, email_subject_limit:60, email_body_min_words:80,
  email_body_max_words:150, email_hashtags_allowed:false, email_cta_count:1,
  email_sign_off:'', email_body_limit:9000, product_description:'', key_benefits:[], tone:''
})

// Empty personas — no default data
const emptyPersonas = () => [
  {id:'persona1', name:'', profile:'', goal:'', pain_points:[], angle_preference:''},
  {id:'persona2', name:'', profile:'', goal:'', pain_points:[], angle_preference:''},
  {id:'persona3', name:'', profile:'', goal:'', pain_points:[], angle_preference:''}
]

const brandAsJson = b => ({
  brand: b.brand_name,
  product: {name:b.product_name, tagline:b.product_tagline, price:b.product_price, facts:b.product_facts||[], claims_policy:b.claims_policy},
  voice: {tone_words:b.tone_words||[], do:b.brand_dos||[], dont:b.brand_donts||[], example_lines:b.example_lines||[]},
  banned_words: b.banned_words||[],
  channels: {
    social: {max_chars:b.social_char_limit, char_counting:'Count characters as the reader sees them (an emoji counts as 1)', max_hashtags:b.hashtag_limit, max_emoji:b.social_emoji_limit},
    email: {subject_max_chars:b.email_subject_limit, body_min_words:b.email_body_min_words, body_max_words:b.email_body_max_words, hashtags_allowed:b.email_hashtags_allowed, calls_to_action:b.email_cta_count, sign_off:b.email_sign_off}
  }
})

const importBrandJson = raw => {
  const v = JSON.parse(raw)
  if (!v.brand || !v.product?.name || !Array.isArray(v.product?.facts) || !v.voice || !v.channels?.social || !v.channels?.email)
    throw Error('Brand kit JSON must include brand, product facts, voice, and both channels.')
  return asBrandPayload({
    ...emptyBrand(),
    brand_name: v.brand, product_name: v.product.name, product_tagline: v.product.tagline||'', product_price: v.product.price||'',
    product_facts: v.product.facts, claims_policy: v.product.claims_policy||'', tone_words: v.voice.tone_words||[],
    brand_dos: v.voice.do||[], brand_donts: v.voice.dont||[], example_lines: v.voice.example_lines||[],
    banned_words: v.banned_words||[], social_char_limit: v.channels.social.max_chars,
    hashtag_limit: v.channels.social.max_hashtags, social_emoji_limit: v.channels.social.max_emoji,
    email_subject_limit: v.channels.email.subject_max_chars,
    email_body_min_words: v.channels.email.body_min_words, email_body_max_words: v.channels.email.body_max_words,
    email_hashtags_allowed: v.channels.email.hashtags_allowed,
    email_cta_count: v.channels.email.calls_to_action, email_sign_off: v.channels.email.sign_off
  })
}

// Personas JSON import/export
const personasAsJson = personas => ({personas: personas.map(p => ({
  id: p.id, name: p.name, profile: p.profile, goal: p.goal,
  pain_points: p.pain_points||[], angle_preference: p.angle_preference
}))})

const importPersonasJson = raw => {
  const v = JSON.parse(raw)
  if (!Array.isArray(v.personas) || v.personas.length !== 3)
    throw Error('Personas JSON must contain exactly 3 personas.')
  const base = emptyPersonas()
  const imported = base.map((empty, i) => {
    const src = v.personas[i]
    if (!src) return empty
    return {
      id: String(src.id || empty.id).trim(),
      name: String(src.name || '').trim(),
      profile: String(src.profile || '').trim(),
      goal: String(src.goal || '').trim(),
      pain_points: Array.isArray(src.pain_points) ? src.pain_points.map(x=>String(x).trim()).filter(Boolean) : [],
      angle_preference: String(src.angle_preference || '').trim()
    }
  })
  validatePersonas(imported)
  return imported
}

function validatePersonas(personas) {
  if (!Array.isArray(personas) || personas.length !== 3)
    throw Error('Exactly 3 personas are required to generate campaigns.')
  const ids = new Set()
  for (const [i, p] of personas.entries()) {
    const n = i + 1
    if (!p || !String(p.id || '').trim() || String(p.id).length > 50) throw Error(`Persona ${n}: valid ID required (max 50 characters).`)
    if (ids.has(p.id)) throw Error(`Persona ${n}: ID must be unique.`)
    ids.add(p.id)
    for (const [field, min, max, label] of [
      ['name',1,100,'name'],['profile',2,200,'short profile'],['goal',2,350,'main goal'],
      ['angle_preference',2,300,'messaging angle']
    ]) {
      const value = String(p[field] || '').trim()
      if (value.length < min || value.length > max) throw Error(`Persona ${n}: ${label} must be ${min}–${max} characters.`)
    }
    if (!Array.isArray(p.pain_points) || p.pain_points.filter(x=>String(x).trim()).length < 1 || p.pain_points.length > 8)
      throw Error(`Persona ${n}: add 1–8 pain points.`)
  }
}

function getStored() { try { return JSON.parse(localStorage.getItem(KEY) || 'null') } catch { return null } }

async function call(path, body) {
  let response
  try { response = await fetch(`${API}/api/${path}`, {method:body?'POST':'GET',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined}) }
  catch { throw Error('Cannot reach FastAPI. Start the backend on port 8000 and try again.') }
  let data
  try { data = await response.json() } catch { data = {} }
  if (!response.ok) {
    const detail = data.detail
    const message = typeof detail === 'string' ? detail : Array.isArray(detail)
      ? detail.map(x=>`${(x.loc||[]).filter(v=>v!=='body').join('. ')}: ${x.msg}`).join(' · ')
      : `API request failed (${response.status}). Check the backend terminal logs.`
    throw Error(message)
  }
  return data
}

function saveDownload(filename, text, type) {
  const href = URL.createObjectURL(new Blob([text],{type}))
  const anchor = document.createElement('a'); anchor.href=href; anchor.download=filename; document.body.appendChild(anchor); anchor.click(); anchor.remove()
  setTimeout(()=>URL.revokeObjectURL(href),1000)
}

function markdown(data) {
  const {brand,personas,concept,assets} = data
  const md = [
    `# ${brand.brand_name} — ${concept?.name || 'Campaign'}`, '',
    `> ${concept?.hook || ''}`, '', `**Product:** ${brand.product_name}`, '',
    `**Campaign message:** ${concept?.key_message || ''}`, '',
    `**Voice:** ${brand.tone}`, '',
    `**Generation engine:** ${data.mode==='ai'?'Gemini':'Local preview'}`, '',
    '## Campaign assets', ''
  ]
  for (const persona of personas) {
    md.push(`### ${persona.name}`, '', `**Audience goal:** ${persona.goal}`, '')
    for (const kind of ['social','email']) {
      const item = assets.find(a=>a.asset.persona_id===persona.id&&a.asset.type===kind)
      if (!item) continue
      md.push(`#### ${kind==='social'?'Social post':'Email'}`, '')
      if (kind==='email') md.push(`**Subject:** ${item.asset.subject}`, '')
      md.push(item.asset.text, '', `**Brand fit:** ${item.check.score}/5 — ${item.check.reason}`, '', `**Hard rules:** ${item.check.passed?'Passed':item.check.violations.join(' | ')}`, '')
    }
  }
  md.push('---', '', '*Generated from synthetic, fictional data. Review all output before external publication.*')
  return md.join('\n')
}

function Button({children,icon:Icon,variant='primary',small=false,onClick,disabled=false,loading=false,className=''}) {
  return <button type="button" className={`btn ${variant} ${small?'small':''} ${className}`} onClick={onClick} disabled={disabled||loading}>
    {loading?<LoaderCircle size={16} className="spin"/>:Icon?<Icon size={small?15:17}/>:null}{children}
  </button>
}
function Status({children,tone='neutral',dot=false}) {return <span className={`status ${tone}`}>{dot&&<span className="status-dot"/>}{children}</span>}
function Card({children,className=''}) {return <section className={`card ${className}`}>{children}</section>}
function H({eyebrow,title,desc,right}) {return <div className="section-heading"><div><span className="overline">{eyebrow}</span><h1>{title}</h1><p>{desc}</p></div>{right&&<div className="heading-right">{right}</div>}</div>}
function Field({label,hint,children}) {return <label className="field"><span className="field-label">{label} {hint&&<small>{hint}</small>}</span>{children}</label>}
function SelectableCard({selected,children,onClick}) {return <button type="button" className={`selectable ${selected?'selected':''}`} onClick={onClick}>{children}</button>}
function CountBar({value,max=100}) {return <div className="progress-track"><div className="progress-value" style={{width:`${Math.max(0,Math.min(100,value/max*100))}%`}}/></div>}
function Avatar({index,size='md'}) {return <div className={`avatar ${colors[index%3]} ${size}`}>{initials[index%3]}</div>}
function Score({value}) {return <span className={`score-badge ${value>=4?'great':value===3?'okay':'weak'}`}><ShieldCheck size={13}/>{value}/5</span>}
function tinyIcon(type) {return type==='social'?MessageSquareText:Mail}

function AssetCard({entry,persona,index,busy,onRegenerate,onCopy}) {
  const type = entry?.asset.type; const Icon = tinyIcon(type)
  if (!entry) return null
  const {asset,check} = entry
  const hasViolations = !check.passed
  return <article className="asset-card">
    <div className="asset-header"><div className="asset-type"><span className={`asset-icon ${type}`}><Icon size={17}/></span><div><h4>{type==='social'?'Social media post':'Marketing email'}</h4><span>{type==='social'?'Social channel':'Email channel'}</span></div></div><Score value={check.score}/></div>
    <div className="asset-body">
      {type==='email'&&<div className="email-subject"><small>SUBJECT LINE</small><strong>{asset.subject}</strong></div>}
      <div className="copy-preview">{asset.text}</div>
    </div>
    <div className="asset-rule-row"><Status tone={check.passed?'good':'error'}>{check.passed?<CheckCircle2 size={13}/>:<CircleAlert size={13}/>} {check.passed?'All hard rules passed':'Rule violations'}</Status><span className="muted micro">{Object.values(check.fields).reduce((n,f)=>n+f.chars,0)} chars</span></div>
    <p className="asset-reason">{check.reason}</p>
    {hasViolations&&<div className="violations">{check.violations.map((v,i)=><p key={i}><CircleAlert size={13}/>{v}</p>)}</div>}
    {check.auto_fix_attempted&&<div className="autofix"><RefreshCcw size={13}/> Auto-repair {check.auto_fix_succeeded?'completed':'attempted — review remaining issues'}</div>}
    <div className="asset-actions"><Button small variant="outline" icon={Copy} onClick={()=>onCopy(type==='email'?`Subject: ${asset.subject}\n\n${asset.text}`:asset.text)}>Copy</Button><Button small variant="soft" icon={RefreshCcw} loading={busy} disabled={busy} onClick={()=>onRegenerate(persona.id,type)}>Regenerate</Button></div>
  </article>
}

export default function App(){
  const [initial] = useState(()=>getStored())
  // Brand and Personas always start empty — user must enter their own data every session
  const [brand,setBrand] = useState(emptyBrand())
  const [account,setAccount] = useState(initial?.account||{displayName:'',email:'',role:'Campaign Manager',organization:''})
  const [accountOpen,setAccountOpen] = useState(false)
  const [maxReached,setMaxReached] = useState(0)
  const [personas,setPersonas] = useState(emptyPersonas())
  const [concepts,setConcepts] = useState(initial?.concepts||[])
  const [selectedId,setSelectedId] = useState(initial?.selectedId||'')
  const [assets,setAssets] = useState(initial?.assets||[])
  const [versions,setVersions] = useState(initial?.versions||[])
  const [revision,setRevision] = useState(initial?.revision||{})
  const [history,setHistory] = useState(initial?.history||[])
  const [agentTrace,setAgentTrace] = useState(initial?.agentTrace||[])
  const [view,setView] = useState('dashboard')
  const [activePersona,setActivePersona] = useState(0)
  const [activeContentPersona,setActiveContentPersona] = useState('all')
  const [mode,setMode] = useState('checking')
  const [dirty,setDirty] = useState(false)
  const [busy,setBusy] = useState('')
  const [error,setError] = useState('')
  const [toast,setToast] = useState('')
  const [mobileOpen,setMobileOpen] = useState(false)

  const selected = concepts.find(c=>c.id===selectedId)
  const passed = assets.filter(a=>a.check.passed).length
  const average = assets.length?(assets.reduce((acc,a)=>acc+a.check.score,0)/assets.length).toFixed(1):'0.0'
  const fixes = assets.filter(a=>a.check.auto_fix_attempted).length

  useEffect(()=>{let active=true;call('health').then(v=>{if(active)setMode(v.mode)}).catch(()=>{if(active)setMode('offline')});return()=>{active=false}},[])
  useEffect(()=>{try {localStorage.setItem(KEY,JSON.stringify({account,concepts,selectedId,assets,versions:versions.slice(0,12),revision,history:history.slice(0,20),agentTrace:agentTrace.slice(-100)}))} catch {}},[account,concepts,selectedId,assets,versions,revision,history,agentTrace])
  useEffect(()=>{if(!toast)return;const id=setTimeout(()=>setToast(''),3700);return()=>clearTimeout(id)},[toast])

  // Strict sequential navigation:
  // - dashboard (Workspace) is always accessible
  // - brand (Brand Hub) is always accessible from nav
  // - all other steps: only accessible if already reached (maxReached >= index), cannot skip forward
  // - can go back freely
  // - navbar: only dashboard and brand are clickable; others are locked unless reached
  const go = (key, force=false) => {
    const index = FLOW.indexOf(key)
    if (!force) {
      // Dashboard always accessible
      if (key === 'dashboard') { setView('dashboard'); setMobileOpen(false); setError(''); window.scrollTo?.({top:0,behavior:'auto'}); return }
      // Brand Hub always accessible from nav
      if (key === 'brand') { setView('brand'); setMobileOpen(false); setError(''); window.scrollTo?.({top:0,behavior:'auto'}); return }
      // For everything else: only allow if already reached (can go back), block jumping ahead
      if (index > maxReached) {
        setToast('Follow the campaign steps in order. Complete the current step first.')
        return
      }
    }
    setView(key)
    setMobileOpen(false)
    setError('')
    window.scrollTo?.({top:0,behavior:'auto'})
  }

  // Nav click handler: dashboard and brand always work; others: only if reached
  const navClick = (id) => {
    if (id === 'dashboard' || id === 'brand') { go(id); return }
    const index = FLOW.indexOf(id)
    if (index <= maxReached) { go(id); return }
    setToast('Complete the previous steps first to unlock this section.')
  }

  const advance = key => { setMaxReached(n=>Math.max(n,FLOW.indexOf(key))); go(key,true) }
  const markChanged = () => { if(assets.length)setDirty(true) }
  const editBrand = (k,v) => { setBrand(b=>asBrandPayload({...b,[k]:v})); markChanged() }
  const editPersona = (i,k,v) => { setPersonas(p=>p.map((x,j)=>j===i?{...x,[k]:v}:x)); markChanged() }
  const addLog = (name,detail) => setHistory(h=>[{id:Date.now()+Math.random(),name,detail,date:new Date().toLocaleString()},...h].slice(0,20))
  const absorbTrace = response => { if(response?.trace)setAgentTrace(t=>[...t,...response.trace.map(e=>({...e,at:new Date().toLocaleTimeString()}))].slice(-100)) }
  const run = async (key,fn) => { setError(''); setBusy(key); try{await fn()}catch(e){setError(e.message||String(e))}finally{setBusy('')} }

  const loadSample = () => {
    const d = clone(seed)
    setBrand(asBrandPayload(d.brand))
    setPersonas(d.personas)
    setConcepts([]); setSelectedId(''); setAssets([]); setVersions([]); setRevision({}); setDirty(false)
    setMaxReached(1); go('brand',true)
    setToast('Synthetic sample workspace loaded.')
    addLog('Sample loaded','Brand kit and three fictional personas')
  }

  const generateConcepts = () => run('concepts', async () => {
    validatePersonas(personas)
    const result = await call('concepts',{brand:asBrandPayload(brand),personas})
    setConcepts(result.concepts); setSelectedId(''); setAssets([]); setDirty(false)
    absorbTrace(result); advance('campaigns'); setToast('Three campaign directions are ready.')
    addLog('Concepts generated','3 distinct campaign strategies')
  })

  const snapshot = (label, existing=assets) => {
    if (existing.length) setVersions(v=>[{id:`${Date.now()}-${Math.random()}`,label,created:new Date().toLocaleString(),selectedId,assets:clone(existing)},...v].slice(0,12))
  }

  const generateAll = () => run('generate', async () => {
    if (!selected) throw Error('Select a campaign concept first.')
    const result = await call('generate',{brand:asBrandPayload(brand),personas,concept:selected})
    if (assets.length) snapshot('Before full campaign regeneration')
    setAssets(result.assets); setDirty(false); absorbTrace(result); advance('content')
    setToast('All six assets are ready to review.')
    addLog('Campaign generated',`${selected.name} · 3 posts and 3 emails`)
  })

  const regenerate = (persona_id, asset_type) => run(`regen-${persona_id}-${asset_type}`, async () => {
    if (!selected) throw Error('Select a concept first.')
    const old = assets.find(x=>x.asset.persona_id===persona_id&&x.asset.type===asset_type)
    const k = `${persona_id}_${asset_type}`; const next = (revision[k]||0)+1
    const result = await call('regenerate',{brand:asBrandPayload(brand),personas,concept:selected,persona_id,asset_type,previous:old?.asset||null,revision:next})
    snapshot(`Before ${asset_type} regeneration: ${personas.find(p=>p.id===persona_id)?.name}`)
    setAssets(a=>a.map(x=>x.asset.persona_id===persona_id&&x.asset.type===asset_type?{asset:result.asset,check:result.check}:x))
    setRevision(r=>({...r,[k]:next})); absorbTrace(result); setToast('Updated only the selected content piece.')
    addLog('Content regenerated',`${asset_type} for ${persona_id}`)
  })

  const recheck = () => run('recheck', async () => {
    if (!selected||!assets.length) throw Error('Generate a campaign first.')
    const result = await call('recheck',{brand:asBrandPayload(brand),personas,concept:selected,assets:assets.map(a=>a.asset)})
    snapshot('Before brand-rule recheck')
    setAssets(result.assets); setDirty(false); absorbTrace(result); setToast('All six assets revalidated.')
    addLog('Brand rules rechecked',`${result.assets.filter(a=>a.check.passed).length}/6 assets passed`)
  })

  const copyText = async value => { try{await navigator.clipboard.writeText(value);setToast('Copied to clipboard.')}catch{setError('Clipboard access is unavailable in this browser.')} }

  const exportCampaign = type => {
    if (!selected||assets.length!==6) { setError('Generate all six assets before exporting.'); return }
    const obj = {app:'AngleForge',synthetic_data_only:true,generated_at:new Date().toISOString(),mode,brand,personas,concept:selected,assets,agent_trace:agentTrace.slice(-40)}
    const name = brand.brand_name.toLowerCase().replace(/[^a-z0-9]+/g,'-')||'angleforge'
    saveDownload(`${name}-angleforge-campaign.${type==='json'?'json':'md'}`,type==='json'?JSON.stringify(obj,null,2):markdown(obj),type==='json'?'application/json':'text/markdown')
    setToast(`${type.toUpperCase()} export downloaded.`); addLog('Campaign exported',`${type.toUpperCase()} downloaded`)
  }

  const restoreVersion = v => { snapshot('Before version restore'); setAssets(clone(v.assets)); setSelectedId(v.selectedId); setDirty(false); go('content'); setToast('Restored saved content snapshot.') }
  const resetHistory = () => { setVersions([]); setToast('Saved versions cleared.') }

  const brandFields = (fields) => fields.map(([label,key,type='text',hint]) => <Field key={key} label={label} hint={hint}>{type==='textarea'?<textarea rows={3} value={brand[key]||''} onChange={e=>editBrand(key,e.target.value)}/>:type==='list'?<textarea rows={3} value={lines(brand[key])} onChange={e=>editBrand(key,toLines(e.target.value))}/>:<input value={brand[key]||''} onChange={e=>editBrand(key,e.target.value)}/>}</Field>)
  const fieldNumber = (label,key,min=0) => <Field key={key} label={label}><input type="number" min={min} max={{hashtag_limit:20,social_emoji_limit:20,email_cta_count:3,email_body_min_words:1000,email_body_max_words:2000,social_char_limit:3000,email_subject_limit:300}[key]||10000} value={brand[key]} onChange={e=>editBrand(key,Number(e.target.value))}/></Field>
  const tile = (icon,title,value,caption) => { const Icon=icon; return <Card className="stat-tile"><div className="stat-tile-top"><div className="stat-icon"><Icon size={19}/></div></div><strong>{value}</strong><span>{title}</span><p>{caption}</p></Card> }

  const importKitFile = async event => {
    const file = event.target.files?.[0]
    if (!file) return
    try { const incoming = importBrandJson(await file.text()); setBrand(incoming); markChanged(); setToast('Brand kit imported. Review the approved facts and rules.') }
    catch(e) { setError(e.message||'Could not import brand kit JSON.') }
    event.target.value = ''
  }

  // Personas JSON import handlers
  const importPersonasFile = async event => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const imported = importPersonasJson(await file.text())
      setPersonas(imported); markChanged()
      setToast('Personas imported. Review and edit as needed.')
    } catch(e) { setError(e.message||'Could not import personas JSON.') }
    event.target.value = ''
  }

  // ─── RENDERS ───

  const renderBrand = () => <>
    <H eyebrow="STEP 1 · BRAND GUIDELINES" title="Define your brand kit." desc="Only the information needed to generate factual, consistent campaigns. All fields sync across concept creation, content and validation." right={<div className="btn-group"><label className="btn outline upload-button"><FileJson size={16}/> Import JSON<input type="file" accept="application/json,.json" hidden onChange={importKitFile}/></label><Button variant="outline" icon={Download} onClick={()=>saveDownload(`${brand.brand_name.toLowerCase()||'brand'}-brand-kit.json`,JSON.stringify(brandAsJson(brand),null,2),'application/json')}>Export kit</Button></div>}/>
    <div className="brand-intro"><span className="round-icon"><Compass size={21}/></span><div><h3>{brand.brand_name || 'Your brand'} · Brand Kit</h3><p>Approved product facts, voice, banned words, and precise channel policies.</p></div><Status tone="good"><CheckCircle2 size={14}/> Auto-saved</Status></div>
    <div className="kit-grid">
      <Card className="kit-section"><div className="kit-title"><span className="heading-square"><Package size={20}/></span><div><h3>Brand &amp; product</h3><p>Facts here are the only approved factual claims.</p></div></div>
        <div className="form-grid cols2">{brandFields([['Brand','brand_name'],['Product name','product_name'],['Tagline','product_tagline'],['Price','product_price']])}</div>
        {brandFields([['Approved product facts','product_facts','list','One approved fact per line. Avoid adding invented claims.'],['Claims policy','claims_policy','textarea','No medical claims, competitor naming or unsupported absolutes.']])}
      </Card>
      <Card className="kit-section"><div className="kit-title"><span className="heading-square purple"><MessageSquareText size={20}/></span><div><h3>Brand voice</h3><p>How every persona-specific asset should sound.</p></div></div>
        {brandFields([['Tone words','tone_words','list','One adjective or phrase per line'],['Do','brand_dos','list','One writing instruction per line'],["Don't",'brand_donts','list','One discouraged behavior per line'],['Example lines','example_lines','list','One example per line']])}
      </Card>
      <Card className="kit-section"><div className="kit-title"><span className="heading-square peach"><ShieldCheck size={20}/></span><div><h3>Banned terms</h3><p>Whole-word and phrase matches are checked in code.</p></div></div>
        {brandFields([['Banned words &amp; phrases','banned_words','list','One banned term per line']])}
        <div className="hint-card"><ShieldCheck size={17}/> Unsupported facts and claims still require the model's judgment and a human review.</div>
      </Card>
      <Card className="kit-section"><div className="kit-title"><span className="heading-square green"><Gauge size={20}/></span><div><h3>Channel limits</h3><p>Exact social and email constraints.</p></div></div>
        <div className="minor-heading">Social post</div>
        <div className="form-grid cols2">{fieldNumber('Visible characters','social_char_limit',40)}{fieldNumber('Max hashtags','hashtag_limit',0)}{fieldNumber('Max emoji','social_emoji_limit',0)}</div>
        <p className="fineprint">An emoji counts as one user-visible character, including joined emoji.</p>
        <div className="minor-heading">Marketing email</div>
        <div className="form-grid cols2">{fieldNumber('Subject characters','email_subject_limit',12)}{fieldNumber('Body minimum words','email_body_min_words',0)}{fieldNumber('Body maximum words','email_body_max_words',1)}{fieldNumber('CTA lines required','email_cta_count',0)}</div>
        <label className="kit-toggle"><input type="checkbox" checked={!!brand.email_hashtags_allowed} onChange={e=>editBrand('email_hashtags_allowed',e.target.checked)}/> Allow email hashtags</label>
        {brandFields([['Exact email sign-off','email_sign_off']])}
        <p className="fineprint">CTA lines are marked with "→" so the required number can be validated in code.</p>
      </Card>
    </div>
    <div className="action-panel kit-next"><div><h3>Brand rules ready?</h3><p>Next, review the three personas before creating campaign concepts.</p></div><Button icon={ArrowRight} onClick={()=>{if(!brand.brand_name.trim()||!brand.product_name.trim()||!brand.product_facts?.some(x=>x.trim())||!brand.tone_words?.some(x=>x.trim())){setError('Complete the brand name, product name, approved facts and tone words first.');return}if(brand.email_body_min_words>brand.email_body_max_words){setError('Email minimum words cannot exceed the maximum.');return}advance('personas')}}>Continue to personas</Button></div>
  </>

  const renderDashboard = () => <>
    <div className="welcome welcome-simple"><div className="welcome-main"><span className="welcome-kicker"><Compass size={16}/> ANGLEFORGE CAMPAIGN STUDIO</span><h1>Every audience.<br/><i>The right angle.</i></h1><p>Build purposeful campaigns with your brand voice, approved product facts, and audience insights.</p><div className="welcome-actions"><Button icon={ArrowRight} onClick={()=>go('brand')}>{maxReached>0?'Open brand kit':'Start with brand kit'}</Button></div></div><div className="welcome-orbit" aria-hidden="true"><span className="orbit orbit-outer"/><span className="orbit orbit-inner"/><span className="orbit-core"><Compass size={45}/></span></div></div>
    <div className="page-subhead"><div><h2>Campaign overview</h2><p>Your campaign progress at a glance.</p></div></div>
    <div className="stats-grid stats-three">{tile(Target,'Personas',String(personas.length).padStart(2,'0'),'Distinct audience profiles')}{tile(Layers3,'Concepts',String(concepts.length).padStart(2,'0'),'Creative directions ready')}{tile(ShieldCheck,'Compliant assets',`${passed}/${assets.length||6}`,'Passed exact brand rules')}</div>
    <Card className="journey-card"><div className="card-heading compact"><span className="heading-square"><ClipboardCheck size={19}/></span><div><h3>Guided campaign workflow</h3><p>Each stage unlocks once the preceding stage has been reached.</p></div></div><div className="journey-steps">{FLOW.slice(1).map((id,i)=><div key={id} className={`journey-item ${maxReached>=i+1?'done':''}`}><span className="journey-num">{i+1}</span><div><strong>{NAV.find(n=>n.id===id)?.label}</strong><small>{['Define approved facts, tone and rules','Review three distinct audiences','Generate and choose a campaign','Create and refine six content assets','Review brand checks','Download campaign as JSON or Markdown'][i]}</small></div>{maxReached>=i+1?<CheckCircle2 size={17}/>:<ChevronRight size={17}/>}</div>)}</div></Card>
  </>

  const renderPersonas = () => <>
    <H eyebrow="AUDIENCE INTELLIGENCE" title="Meet the people behind the clicks." desc="Three distinct personas help your campaigns speak to real needs — not generic demographics."
      right={<div className="btn-group">
        <label className="btn outline upload-button"><FileJson size={16}/> Import JSON<input type="file" accept="application/json,.json" hidden onChange={importPersonasFile}/></label>
        <Button variant="outline" icon={Download} onClick={()=>saveDownload('personas.json',JSON.stringify(personasAsJson(personas),null,2),'application/json')}>Export JSON</Button>
      </div>}
    />
    <div className="persona-cards">{personas.map((p,i)=><SelectableCard key={p.id} selected={activePersona===i} onClick={()=>setActivePersona(i)}><div className="persona-card-top"><Avatar index={i} size="lg"/><Status tone={activePersona===i?'violet':'neutral'}>{activePersona===i?'Editing':'Persona 0'+(i+1)}</Status></div><h3>{p.name||<span className="muted">Persona {i+1}</span>}</h3><span className="muted">{p.profile||'No profile set'}</span><div className="persona-card-rule"/><span className="label-hint">PRIMARY GOAL</span><p>{p.goal||<span className="muted">No goal set</span>}</p><span className="persona-edit">Edit profile <ArrowRight size={15}/></span></SelectableCard>)}</div>
    <Card className="persona-detail"><div className="card-heading"><Avatar index={activePersona} size="md"/><div><h3>Persona editor</h3><p>Personalization is driven by goals, pains and a unique messaging angle.</p></div></div><div className="form-grid cols2"><Field label="Persona name"><input placeholder="e.g. Ava — The Commuter" value={personas[activePersona].name} onChange={e=>editPersona(activePersona,'name',e.target.value)}/></Field><Field label="Short profile"><input placeholder="e.g. 29, busy office professional" value={personas[activePersona].profile} onChange={e=>editPersona(activePersona,'profile',e.target.value)}/></Field></div><Field label="Main goal"><textarea rows={2} placeholder="What does this persona want to achieve?" value={personas[activePersona].goal} onChange={e=>editPersona(activePersona,'goal',e.target.value)}/></Field><div className="form-grid cols2"><Field label="Pain points" hint="One per line"><textarea rows={5} placeholder="e.g. Coffee gets cold before the first meeting" value={lines(personas[activePersona].pain_points)} onChange={e=>editPersona(activePersona,'pain_points',toLines(e.target.value))}/></Field><Field label="Preferred messaging angle"><textarea rows={5} placeholder="e.g. Focus on calm, reliability and making mornings feel easier" value={personas[activePersona].angle_preference} onChange={e=>editPersona(activePersona,'angle_preference',e.target.value)}/></Field></div><div className="card-footer"><span><CheckCircle2 size={15}/> These details are used in the content prompts.</span><div className="btn-group"><Button variant="outline" small icon={ArrowLeft} disabled={!activePersona} onClick={()=>setActivePersona(i=>i-1)}>Previous</Button><Button variant="outline" small disabled={activePersona===2} onClick={()=>setActivePersona(i=>i+1)}>Next <ArrowRight size={14}/></Button></div></div></Card>
    <div className="action-panel"><div><h3>Ready to turn your personas into concepts?</h3><p>Generate three creative directions using your current brand kit and personas.</p></div><Button icon={ArrowRight} onClick={generateConcepts} loading={busy==='concepts'} disabled={!!busy}>Generate concepts &amp; continue</Button></div>
  </>

  const renderCampaigns = () => <>
    <H eyebrow="CAMPAIGN GENERATOR" title="Find the story worth telling." desc="AI turns your product and personas into three differentiated creative directions." right={<Button icon={ArrowRight} onClick={generateConcepts} loading={busy==='concepts'} disabled={!!busy}>Generate 3 concepts</Button>}/>
    <div className="feature-banner"><div><span className="overline">CONCEPT STUDIO</span><h2>One product. Multiple perspectives.</h2><p>Explore original names, messages, hooks and persona angles before producing any content.</p></div><div className="banner-icon"><Lightbulb size={44}/></div></div>
    {concepts.length===0?<Card className="empty-state"><span className="empty-symbol"><Lightbulb size={30}/></span><h3>Your next big idea starts here.</h3><p>Generate three campaign concepts to pick a direction for your social posts and emails.</p><Button icon={Lightbulb} onClick={generateConcepts} loading={busy==='concepts'} disabled={!!busy}>Generate concepts</Button></Card>:<>
      <div className="concept-grid">{concepts.map((c,i)=><SelectableCard key={c.id} selected={selectedId===c.id} onClick={()=>{if(selectedId!==c.id){setSelectedId(c.id);setAssets([]);setDirty(false)}}}><div className="concept-top"><span className={`concept-icon concept-${i}`}><Lightbulb size={22}/></span><Status tone={selectedId===c.id?'good':'neutral'}>{selectedId===c.id?<><Check size={13}/> Selected</>:`Concept 0${i+1}`}</Status></div><h3>{c.name}</h3><p className="concept-tagline">"{c.hook}"</p><div className="concept-rule"/><span className="label-hint">KEY MESSAGE</span><p className="concept-message">{c.key_message}</p><div className="concept-angles"><span className="label-hint">PERSONA ANGLES</span>{personas.map((p,k)=><div key={p.id}><Avatar index={k} size="xs"/><span><strong>{human(p.name)}:</strong> {c.persona_angles?.[p.id]||p.angle_preference}</span></div>)}</div><span className="concept-select">{selectedId===c.id?'Concept chosen':'Choose this concept'} <ArrowRight size={15}/></span></SelectableCard>)}</div>
      <div className="action-panel"><div><h3>{selected?`${selected.name} is ready for production`:'Choose your creative direction'}</h3><p>Generate one social post and one email for each of your three personas.</p></div><Button icon={Lightbulb} onClick={generateAll} disabled={!selected||!!busy} loading={busy==='generate'}>{assets.length?'Regenerate all 6 assets':'Generate all 6 assets'} <ArrowRight size={16}/></Button></div>
    </>}
  </>

  const renderContent = () => <>
    <H eyebrow="CONTENT STUDIO" title="Every audience gets its own story." desc="Review social posts and emails side by side. Regenerate only the pieces you want to change." right={<div className="btn-group"><Button variant="outline" small onClick={recheck} loading={busy==='recheck'} disabled={!assets.length||!!busy}>Recheck rules</Button><Button icon={ArrowRight} small onClick={()=>advance('compliance')} disabled={!assets.length}>Continue to checks</Button></div>}/>
    {!assets.length?<Card className="empty-state"><span className="empty-symbol"><MessageSquareText size={30}/></span><h3>No campaign content yet</h3><p>Choose a campaign concept, then create six personalized assets.</p><Button icon={Layers3} onClick={()=>go('campaigns')}>Go to campaigns</Button></Card>:<>
      {dirty&&<div className="warning-banner"><CircleAlert size={19}/><span>Your brand kit or personas changed. Existing checks may be stale. Recheck or regenerate content to apply the latest inputs.</span><Button small variant="outline" onClick={recheck} loading={busy==='recheck'}>Recheck now</Button></div>}
      <div className="campaign-summary"><div><small>CAMPAIGN</small><strong>{selected?.name}</strong></div><div><small>BRAND FIT</small><strong><ShieldCheck size={16}/>{average}/5</strong></div><div><small>HARD RULES</small><strong>{passed}/{assets.length} passed</strong></div><div><small>AUTO-REPAIRS</small><strong>{fixes} attempts</strong></div></div>
      <div className="content-filters"><strong>Content for</strong><div className="pill-tabs"><button className={activeContentPersona==='all'?'active':''} onClick={()=>setActiveContentPersona('all')}>All personas</button>{personas.map((p,i)=><button key={p.id} className={activeContentPersona===p.id?'active':''} onClick={()=>setActiveContentPersona(p.id)}>{human(p.name)}</button>)}</div></div>
      {personas.filter(p=>activeContentPersona==='all'||p.id===activeContentPersona).map(p=>{const i=personas.findIndex(x=>x.id===p.id);return <div key={p.id} className="content-persona"><div className="content-persona-heading"><Avatar index={i}/><div><h3>{p.name}</h3><p>{p.goal}</p></div><Status tone="violet">Distinct angle</Status></div><div className="assets-grid">{['social','email'].map(kind=><AssetCard key={kind} entry={assets.find(a=>a.asset.persona_id===p.id&&a.asset.type===kind)} persona={p} index={i} busy={busy===`regen-${p.id}-${kind}`} onRegenerate={regenerate} onCopy={copyText}/>)}</div></div>})}
      <div className="action-panel"><div><h3>Want a new take on the same idea?</h3><p>Full campaign regeneration keeps your selected concept and creates six fresh assets.</p></div><Button icon={RefreshCcw} variant="outline" onClick={generateAll} loading={busy==='generate'} disabled={!!busy}>Regenerate entire campaign</Button></div>
    </>}
  </>

  const renderCompliance = () => <>
    <H eyebrow="QUALITY ASSURANCE" title="Your brand voice. Backed by checks." desc="A clear view of hard-rule compliance, subjective brand fit, and any automatic repairs." right={<Button onClick={recheck} loading={busy==='recheck'} disabled={!assets.length||!!busy}>Recheck all content</Button>}/>
    {!assets.length?<Card className="empty-state"><span className="empty-symbol"><ShieldCheck size={30}/></span><h3>Nothing to validate yet</h3><p>Generate a campaign to see brand scores, exact rule checks and repair status.</p><Button onClick={()=>go('campaigns')}>Generate a campaign</Button></Card>:<>
      {dirty&&<div className="warning-banner"><CircleAlert size={18}/> Brand settings or personas were edited. Scores are from the previous inputs. <Button small variant="outline" onClick={recheck} loading={busy==='recheck'}>Recheck</Button></div>}
      <div className="compliance-hero"><div className="compliance-ring" style={{'--pct':`${passed/assets.length*100}%`}}><div><strong>{Math.round(passed/assets.length*100)}%</strong><span>RULES PASSED</span></div></div><div><span className="overline">BRAND COMPLIANCE REPORT</span><h2>{passed===assets.length?'All six assets passed the hard-rule checks.':'Some content needs attention.'}</h2><p>Character limits, banned words and hashtags are checked exactly by Python. Brand voice is evaluated separately by {mode==='ai'?'the LLM':'a labeled offline heuristic'}.</p><div className="compliance-stats"><span><CheckCircle2 size={17}/>{passed} compliant</span><span><ShieldCheck size={17}/>{average}/5 average fit</span><span><RefreshCcw size={17}/>{fixes} fixes attempted</span></div></div></div>
      <Card><div className="card-heading compact"><span className="heading-square green"><ClipboardCheck size={20}/></span><div><h3>Content verification</h3><p>Exact status for every social post and email.</p></div></div><div className="validation-table-wrap"><table className="validation-table"><thead><tr><th>Persona</th><th>Asset</th><th>Hard rules</th><th>Brand score</th><th>Auto-fix</th><th>Violations</th></tr></thead><tbody>{assets.map((x,i)=><tr key={`${x.asset.persona_id}-${x.asset.type}`}><td><strong>{human(personas.find(p=>p.id===x.asset.persona_id)?.name)}</strong></td><td>{x.asset.type==='email'?'Email':'Social post'}</td><td><Status tone={x.check.passed?'good':'error'}>{x.check.passed?'Passed':'Failed'}</Status></td><td><Score value={x.check.score}/></td><td>{x.check.auto_fix_attempted?(x.check.auto_fix_succeeded?'Repaired':'Attempted'):'Not needed'}</td><td>{x.check.violations.length?x.check.violations.join(' / '):'None'}</td></tr>)}</tbody></table></div></Card>
      <div className="compliance-guidance"><div><Shield size={19}/><strong>Code-level guardrails</strong><p>Exact user-visible character counts, hashtag counts and whole-word banned phrase detection.</p></div><div><ShieldCheck size={19}/><strong>LLM brand-fit reviewer</strong><p>Separate 1–5 subjective tone and persona relevance assessment with a written reason.</p></div><div><RefreshCcw size={19}/><strong>One auto-fix attempt</strong><p>Every failed hard rule triggers one targeted repair and immediate second validation.</p></div></div>
    </>}
    {assets.length>0&&<div className="action-panel"><div><h3>Ready to export your campaign?</h3><p>Head to the Export Center to download your JSON or Markdown report.</p></div><Button icon={ArrowRight} onClick={()=>advance('export')}>Go to Export Center</Button></div>}
  </>

  const renderExport = () => <>
    <H eyebrow="STEP 6 · EXPORT CENTER" title="Download your campaign." desc="Export your complete campaign — including brand checks, persona details and assets — in your preferred format."/>
    <section className="card dashboard-export" aria-label="Campaign export">
      <div className="dashboard-export-heading"><span className="heading-square green"><Download size={21}/></span><div><h2>Export your campaign</h2><p>Download campaign content, brand checks and persona details in your preferred format.</p></div><Status tone={assets.length===6?'good':'neutral'}>{assets.length===6?'6 assets ready':`${assets.length}/6 assets ready`}</Status></div>
      <div className="dashboard-export-actions"><button className="download-option" disabled={assets.length!==6||!selected} onClick={()=>exportCampaign('json')}><span className="download-icon purple"><FileJson size={21}/></span><span><strong>Download JSON</strong><small>Structured campaign data and validation</small></span><Download size={18}/></button><button className="download-option" disabled={assets.length!==6||!selected} onClick={()=>exportCampaign('md')}><span className="download-icon green"><FileText size={21}/></span><span><strong>Download Markdown</strong><small>Readable document for editing and sharing</small></span><Download size={18}/></button></div>
      <p className="dashboard-export-note">{assets.length!==6?'Exports unlock after you generate the six campaign assets. Continue through Brand Compliance before exporting.':`Selected campaign: ${selected?.name||'Campaign'} · ${passed}/${assets.length} assets pass hard-rule checks. Review failed rules before publishing.`}</p>
      <details className="dashboard-history"><summary>Previous versions <span>{versions.length}</span><ChevronDown size={16}/></summary><div className="dashboard-history-content">{versions.length===0?<p className="muted">Saved versions appear here after content is regenerated.</p>:<><div className="history-tools"><Button variant="ghost" small onClick={resetHistory}>Clear saved versions</Button></div>{versions.map((v,i)=><div className="version-row" key={v.id}><span className="version-num">V{versions.length-i}</span><div><strong>{v.label}</strong><small>{v.created} · {v.assets.length} assets</small></div><Button small variant="outline" icon={RotateCcw} onClick={()=>restoreVersion(v)}>Restore</Button></div>)}</>}</div></details>
    </section>
    <div className="action-panel" style={{marginTop:16}}><div><h3>Load sample data</h3><p>Populate the workspace with fictional brand and persona data to explore the full workflow.</p></div><Button variant="outline" icon={RefreshCcw} onClick={loadSample}>Load sample workspace</Button></div>
  </>

  const renderAccount = () => <div className="modal-shade" role="presentation" onClick={()=>setAccountOpen(false)}><div className="profile-modal" role="dialog" aria-modal="true" aria-label="Account details" onClick={e=>e.stopPropagation()}><div className="profile-modal-heading"><div><span className="overline">YOUR WORKSPACE</span><h2>Account profile</h2><p>Editable profile stored locally in this browser. This is not a login account.</p></div><button type="button" aria-label="Close account" onClick={()=>setAccountOpen(false)}><X size={19}/></button></div><div className="form-grid cols2"><Field label="Display name"><input placeholder="Enter your name" value={account.displayName} onChange={e=>setAccount(a=>({...a,displayName:e.target.value}))}/></Field><Field label="Email"><input type="email" placeholder="name@example.com" value={account.email} onChange={e=>setAccount(a=>({...a,email:e.target.value}))}/></Field><Field label="Role"><input value={account.role} onChange={e=>setAccount(a=>({...a,role:e.target.value}))}/></Field><Field label="Organization / team"><input placeholder="Your team" value={account.organization} onChange={e=>setAccount(a=>({...a,organization:e.target.value}))}/></Field></div><div className="account-actions"><Button variant="outline" onClick={()=>setAccountOpen(false)}>Close</Button><Button icon={CheckCircle2} onClick={()=>{setAccountOpen(false);setToast('Profile saved in this browser.')}}>Save profile</Button></div></div></div>

  const contents = {dashboard:renderDashboard,brand:renderBrand,personas:renderPersonas,campaigns:renderCampaigns,content:renderContent,compliance:renderCompliance,export:renderExport}

  return <div className="app-layout">
    {mobileOpen&&<div className="mobile-shade" onClick={()=>setMobileOpen(false)}/>}
    <aside className={`side ${mobileOpen?'open':''}`}>
      <div className="side-brand"><div className="brand-symbol"><Compass size={23}/></div><div><div className="brand-word">angle<span>forge</span><b>.</b></div><small>MARKETING STUDIO</small></div><button aria-label="Close menu" className="close-mobile" onClick={()=>setMobileOpen(false)}><X size={17}/></button></div>
      <div className="workspace-name"><div className="workspace-mark">{brand.brand_name?.[0]||'B'}</div><div><strong>{brand.brand_name||'Your brand'}</strong><span>Brand workspace</span></div></div>
      <div className="nav-label">GUIDED WORKFLOW</div>
      <nav className="nav-main">
        {NAV.map(({id,label,icon:Icon}) => {
          const index = FLOW.indexOf(id)
          // Dashboard (Workspace) and Brand Hub are always clickable
          // Others: locked if not yet reached
          const alwaysOpen = id === 'dashboard' || id === 'brand'
          const locked = !alwaysOpen && index > maxReached
          return <button
            key={id}
            title={locked ? 'Complete earlier steps first' : label}
            className={`${view===id?'current':''} ${locked?'locked':''}`}
            onClick={() => navClick(id)}
          >
            <Icon size={18}/><span>{label}</span>{locked?<Shield size={13}/>:view===id?<span className="nav-indicator"/>:null}
          </button>
        })}
      </nav>
      <div className="side-bottom"><button className="side-profile profile-button" onClick={()=>setAccountOpen(true)}><div className="profile-circle"><UserRound size={18}/></div><div><strong>{account.displayName||'Set up your profile'}</strong><span>{account.role||'Campaign Manager'}</span></div><Settings2 size={18}/></button></div>
    </aside>
    <div className="page"><header className="top"><div className="top-breadcrumb"><button className="menu-mobile" aria-label="Open navigation" onClick={()=>setMobileOpen(true)}><Menu size={20}/></button><span>AngleForge</span><ChevronRight size={14}/><strong>{NAV.find(x=>x.id===view)?.label||'Workspace'}</strong></div><span className="top-project-label">CAMPAIGN STUDIO</span></header>
      <main className="main-content">{error&&<div className="alert error"><CircleAlert size={18}/><span>{error}</span><button onClick={()=>setError('')}><X size={17}/></button></div>}{toast&&<div className="alert success"><CheckCircle2 size={18}/><span>{toast}</span><button onClick={()=>setToast('')}><X size={17}/></button></div>}{busy&&<div className="run-bar"><div/></div>}{contents[view]?.()}
        <footer className="footer"><span>© AngleForge · Marketing Campaign Generator</span><span>Campaigns and profiles are stored locally in this browser</span></footer>
      </main>
    </div>
    {accountOpen&&renderAccount()}
  </div>
}
