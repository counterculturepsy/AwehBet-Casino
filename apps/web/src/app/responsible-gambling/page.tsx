import Link from 'next/link';

export const metadata = {
  title: 'Responsible Gambling | AwehBet',
  description: 'AwehBet player-safety information and pre-launch responsible gambling commitments.',
};

const sections = [
  {
    title: 'Play within your means',
    body: 'Gambling should never be treated as a way to earn income or recover financial losses. Only use money you can afford to lose, and stop if play is affecting your wellbeing.',
  },
  {
    title: 'Take breaks',
    body: 'Set a time budget before playing, take regular breaks, and avoid chasing losses. If gambling stops being enjoyable, step away.',
  },
  {
    title: 'Age and identity checks',
    body: 'Real-money gambling is not available on this preview. Any future regulated operation would require age and identity checks before eligible players could access gambling services.',
  },
  {
    title: 'Limits and self-exclusion',
    body: 'Deposit limits, cooling-off periods and self-exclusion are planned account-safety features. They are not active or enforced by this demonstration website. Do not rely on this preview to restrict gambling activity.',
  },
  {
    title: 'Get support',
    body: 'If you are concerned about your gambling or someone else’s, seek confidential support from an appropriate local gambling-help organisation or healthcare professional.',
  },
];

export default function ResponsibleGamblingPage() {
  return (
    <main style={{minHeight:'100vh',background:'#101014',color:'#f6f2eb',fontFamily:'Arial,Helvetica,sans-serif'}}>
      <header style={{borderBottom:'1px solid #343037',padding:'20px clamp(20px,5vw,72px)',display:'flex',justifyContent:'space-between',alignItems:'center',gap:16,flexWrap:'wrap'}}>
        <Link href="/" style={{fontSize:23,fontWeight:800,color:'#e9bd68',textDecoration:'none'}}>AwehBet</Link>
        <Link href="/slots" style={{color:'#f6f2eb',textDecoration:'none'}}>Back to Slots Masters</Link>
      </header>
      <article style={{maxWidth:880,margin:'0 auto',padding:'56px 24px 90px'}}>
        <p style={{color:'#e9bd68',fontWeight:700,letterSpacing:2,textTransform:'uppercase',fontSize:12}}>Player safety</p>
        <h1 style={{fontSize:'clamp(34px,5vw,52px)',lineHeight:1.12,margin:'12px 0 22px'}}>Responsible Gambling</h1>
        <p style={{fontSize:18,lineHeight:1.7,color:'#d6d1d0'}}>AwehBet is currently a pre-launch demonstration platform. It does not offer real-money gambling. We are developing player-safety features as part of our platform readiness work.</p>
        <div role="status" style={{margin:'28px 0 42px',border:'1px solid #9b7844',borderRadius:12,padding:20,background:'#251d18',lineHeight:1.6}}>
          <strong>Important:</strong> This page describes guidance and planned safeguards, not an active responsible-gambling control system. Deposit limits, self-exclusion, identity verification and account restrictions are not yet enforced by this prototype.
        </div>
        {sections.map(section=>(
          <section key={section.title} style={{padding:'24px 0',borderBottom:'1px solid #343037'}}>
            <h2 style={{fontSize:22,margin:'0 0 12px'}}>{section.title}</h2>
            <p style={{fontSize:16,lineHeight:1.75,color:'#d6d1d0',margin:0}}>{section.body}</p>
          </section>
        ))}
        <p style={{marginTop:38,fontSize:14,lineHeight:1.7,color:'#b8b0b0'}}>This page is informational. Any future real-money product and its player-protection controls require separate technical verification and applicable legal and regulatory approvals.</p>
      </article>
    </main>
  );
}
