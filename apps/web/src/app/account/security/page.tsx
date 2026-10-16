import Link from 'next/link';
import { SecurityActions } from '@/components/account/security-actions';

export default function SecurityPage() { return <><header className="dashboard-head"><p className="account-eyebrow">ACCOUNT SECURITY</p><h1>Password and sessions</h1><p>Review account access and invalidate sessions if a device is lost or untrusted.</p></header><div className="split-panels"><section className="dashboard-panel"><h2>Change password</h2><p>Use the verified recovery flow to select a strong replacement password.</p><Link className="account-primary inline" href="/forgot-password">Start password reset</Link></section><SecurityActions/></div></>; }
