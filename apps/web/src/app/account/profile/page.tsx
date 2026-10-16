import { ProfileForm } from '@/components/account/profile-form';
import { requirePlayer } from '@/lib/account';

export default async function ProfilePage() { const { profile } = await requirePlayer(); return <><header className="dashboard-head"><p className="account-eyebrow">MY ACCOUNT</p><h1>Profile information</h1><p>Keep contact details current. Identity and email changes use separate verified workflows.</p></header><section className="dashboard-panel">{profile ? <ProfileForm profile={profile}/> : <p>Your player profile is not available. Contact support without sending identity documents by email.</p>}</section></>; }
