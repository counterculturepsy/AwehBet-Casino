'use client';
import {useState} from 'react';
import {Eye,EyeOff,ShieldCheck,UserRound,X,ArrowLeft} from 'lucide-react';
type Mode='login'|'register';
export default function AuthDemo({mode,onClose,onModeChange}:{mode:Mode;onClose:()=>void;onModeChange:(mode:Mode)=>void}){
 const [showPassword,setShowPassword]=useState(false);
 const [accepted,setAccepted]=useState(false);
 const [feedback,setFeedback]=useState('');
 const [ageConfirmed,setAgeConfirmed]=useState(false);
 const [documentType,setDocumentType]=useState<'sa-id'|'passport'>('sa-id');
 const [documentNumber,setDocumentNumber]=useState('');
 const [issuingCountry,setIssuingCountry]=useState('');
 const [birthDate,setBirthDate]=useState('');
 const validSaId=(value:string)=>{if(!/^\d{13}$/.test(value))return false;const yy=Number(value.slice(0,2)),mm=Number(value.slice(2,4)),dd=Number(value.slice(4,6));const year=(new Date().getFullYear()%100>=yy?2000:1900)+yy;const d=new Date(year,mm-1,dd);if(d.getFullYear()!==year||d.getMonth()!==mm-1||d.getDate()!==dd)return false;const digits=value.split('').map(Number);let sum=0;for(let i=0;i<13;i++){let n=digits[12-i];if(i%2===1){n*=2;if(n>9)n-=9;}sum+=n;}return sum%10===0;};
 const change=(next:Mode)=>{setFeedback('');setAccepted(false);setAgeConfirmed(false);setDocumentType('sa-id');setDocumentNumber('');setIssuingCountry('');setBirthDate('');onModeChange(next)};
 return <div className="auth-backdrop" onMouseDown={onClose}>
  <section className="auth-panel" role="dialog" aria-modal="true" aria-labelledby="auth-heading" onMouseDown={e=>e.stopPropagation()}>
   <button className="auth-close" aria-label="Close account preview" onClick={onClose}><X size={21}/></button>
   <img src="/assets/logo.webp" className="auth-logo" alt="AwehBet"/>
   <div className="auth-kicker">AWEHBET ACCOUNT · INTERACTIVE DEMO</div>
   <h2 id="auth-heading">{mode==='login'?'Welcome back':'Create your account'}</h2>
   <p className="auth-subtitle">{mode==='login'?'Explore the planned account sign-in experience.':'Preview the registration flow designed for South African adults.'}</p>
   <div className="auth-switch" role="group" aria-label="Account form">
    <button className={mode==='login'?'active':''} onClick={()=>change('login')}>Log in</button>
    <button className={mode==='register'?'active':''} onClick={()=>change('register')}>Register</button>
   </div>
   <form key={mode} className="auth-form" onSubmit={e=>{e.preventDefault();if(mode==='register'&&documentType==='sa-id'&&!validSaId(documentNumber)){setFeedback('Please enter a valid 13-digit South African ID number for this demo. Use fictional test data only.');return;}setFeedback(mode==='login'?'Sign-in preview complete. Authentication is not connected.':'Registration preview complete. No account has been created or submitted.')}}>
    {mode==='register'&&<label>Display name<input type="text" autoComplete="off" placeholder="Your display name" minLength={2} maxLength={40} required/></label>}
    <label>South African cellphone number<input type="tel" inputMode="tel" autoComplete="off" placeholder="e.g. 082 123 4567" pattern="(?:\\+27|0)[0-9 ]{9,12}" title="Enter a South African cellphone number beginning with 0 or +27" required/></label>
    {mode==='register'&&<label>Email address (demo)<input type="email" autoComplete="off" placeholder="you@example.com" required/></label>}
    {mode==='register'&&<div className="auth-identity">
     <label>Identity document type<select value={documentType} onChange={e=>{setDocumentType(e.target.value as 'sa-id'|'passport');setDocumentNumber('');setFeedback('');}}><option value="sa-id">South African ID</option><option value="passport">Passport</option></select></label>
     <label>{documentType==='sa-id'?'South African ID number':'Passport number'}<input type="text" autoComplete="off" value={documentNumber} onChange={e=>setDocumentNumber(documentType==='sa-id'?e.target.value.replace(/\D/g,'').slice(0,13):e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,20))} placeholder={documentType==='sa-id'?'13-digit ID number':'Passport number'} inputMode={documentType==='sa-id'?'numeric':'text'} pattern={documentType==='sa-id'?'[0-9]{13}':'[A-Z0-9]{5,20}'} required/></label>
     {documentType==='passport'&&<label>Passport issuing country<input type="text" value={issuingCountry} onChange={e=>setIssuingCountry(e.target.value)} maxLength={60} placeholder="Country of issue" required/></label>}
     <label>Date of birth<input type="date" value={birthDate} onChange={e=>setBirthDate(e.target.value)} max={new Date(Date.now()-18*365.2425*24*60*60*1000).toISOString().slice(0,10)} required/></label>
     <p className="auth-subtitle">Demo only — use fictional document details. No identity data is submitted or stored.</p>
    </div>}
    <label>Password<div className="auth-password"><input type={showPassword?'text':'password'} autoComplete="off" placeholder={mode==='register'?'At least 8 characters':'Enter your password'} minLength={mode==='register'?8:1} required/><button type="button" aria-label={showPassword?'Hide password':'Show password'} onClick={()=>setShowPassword(!showPassword)}>{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label>
    {mode==='register'&&<><label className="auth-check"><input type="checkbox" checked={ageConfirmed} onChange={e=>setAgeConfirmed(e.target.checked)} required/><span>I confirm that I am at least 18 years old.</span></label><label className="auth-check"><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)} required/><span>I acknowledge this is a prototype with no real accounts, deposits, or wagering.</span></label></>}
    <button className="auth-primary" type="submit"><UserRound size={17}/>{mode==='login'?'Preview sign in':'Preview registration'}</button>
   </form>
   {feedback&&<div className="auth-feedback" role="status"><ShieldCheck size={19}/><div><strong>Demo only</strong><p>{feedback}</p></div></div>}
   <div className="auth-disclaimer"><ShieldCheck size={15}/> No credentials are transmitted or stored by this demo. Do not enter a real password.</div>
   <button className="auth-back" onClick={onClose}><ArrowLeft size={15}/> Back to website</button>
  </section>
 </div>
}
