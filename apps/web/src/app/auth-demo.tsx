'use client';
import {useState} from 'react';
import {Eye,EyeOff,ShieldCheck,UserRound,X,ArrowLeft} from 'lucide-react';
type Mode='login'|'register';
export default function AuthDemo({mode,onClose,onModeChange}:{mode:Mode;onClose:()=>void;onModeChange:(mode:Mode)=>void}){
 const [showPassword,setShowPassword]=useState(false);
 const [accepted,setAccepted]=useState(false);
 const [feedback,setFeedback]=useState('');
 const [ageConfirmed,setAgeConfirmed]=useState(false);
 const change=(next:Mode)=>{setFeedback('');setAccepted(false);setAgeConfirmed(false);onModeChange(next)};
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
   <form key={mode} className="auth-form" onSubmit={e=>{e.preventDefault();setFeedback(mode==='login'?'Sign-in preview complete. Authentication is not connected.':'Registration preview complete. No account has been created or submitted.')}}>
    {mode==='register'&&<label>Display name<input type="text" autoComplete="off" placeholder="Your display name" minLength={2} maxLength={40} required/></label>}
    <label>South African cellphone number<input type="tel" inputMode="tel" autoComplete="off" placeholder="e.g. 082 123 4567" pattern="(?:\\+27|0)[0-9 ]{9,12}" title="Enter a South African cellphone number beginning with 0 or +27" required/></label>
    {mode==='register'&&<label>Email address (demo)<input type="email" autoComplete="off" placeholder="you@example.com" required/></label>}
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
