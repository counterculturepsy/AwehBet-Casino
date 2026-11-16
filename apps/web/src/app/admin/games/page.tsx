import Link from 'next/link';
import { requireAdmin } from '@/lib/admin';
import { AdminHeader, ReadOnlyNotice } from '@/components/admin/parts';
import { slotGames } from '@/lib/slots-lobby-games';
import { OFFICIAL_DEMO_LINKS_VERIFIED_ON, officialDemoLink } from '@/lib/official-demo-links';
import { providerVerifications, providerMayLaunch } from '@/lib/provider-compliance';
import { buildHref, parseEnum, sanitizeSearch } from '@/lib/admin/view';

type Search = Promise<Record<string, string | string[] | undefined>>;
const DEMO = ['linked', 'unlinked'] as const;
const sameProvider = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export default async function AdminGamesPage({ searchParams }: { searchParams: Search }) {
  await requireAdmin();
  const params = await searchParams;
  const q = sanitizeSearch(params.q).toLowerCase();
  const demo = parseEnum(params.demo, DEMO);
  const providers = [...new Set(slotGames.map(game => game.provider))].sort((a, b) => a.localeCompare(b));
  const provider = parseEnum(params.provider, providers);

  const catalogue = slotGames.map(game => {
    const register = providerVerifications.find(entry => sameProvider(entry.provider, game.provider));
    return { ...game, demoUrl: officialDemoLink(game.name, game.provider), launchAuthorised: register ? providerMayLaunch(register) : false, registered: Boolean(register) };
  });
  const rows = catalogue.filter(game => (!q || game.name.toLowerCase().includes(q) || game.provider.toLowerCase().includes(q))
    && (!provider || game.provider === provider) && (!demo || (demo === 'linked') === Boolean(game.demoUrl)));
  const linked = catalogue.filter(game => game.demoUrl).length;

  return <section className="admin-workspace">
    <AdminHeader eyebrow="CATALOGUE / GAMES" title="Games catalogue">Every title shown in the Slots Masters lobby and how it can be played today.</AdminHeader>
    <ReadOnlyNotice>The catalogue is defined in code and reviewed through pull requests. It cannot be edited from the admin panel.</ReadOnlyNotice>
    <section className="admin-stats" aria-label="Catalogue summary">
      <article><span>Lobby titles</span><strong>{catalogue.length}</strong></article>
      <article><span>Provider demo link</span><strong>{linked}</strong></article>
      <article><span>No demo available</span><strong>{catalogue.length - linked}</strong></article>
      <article><span>Authorised to play on AwehBet</span><strong>{catalogue.filter(game => game.launchAuthorised).length}</strong></article>
    </section>
    <form action="/admin/games" method="get" className="admin-filters admin-panel" role="search" aria-label="Filter games">
      <div className="admin-filters-grid">
        <label>Game or provider<input name="q" maxLength={80} defaultValue={q} placeholder="e.g. Bonanza"/></label>
        <label>Provider<select name="provider" defaultValue={provider ?? ''}><option value="">All providers</option>{providers.map(name => <option key={name} value={name}>{name}</option>)}</select></label>
        <label>Demo link<select name="demo" defaultValue={demo ?? ''}><option value="">Any</option><option value="linked">Linked</option><option value="unlinked">Not linked</option></select></label>
      </div>
      <div className="admin-filters-actions"><button type="submit" className="admin-btn">Apply filters</button><Link href={buildHref('/admin/games', {})} className="admin-btn admin-btn-quiet">Clear</Link></div>
    </form>
    <div className="admin-panel">
      <p className="admin-muted" role="status">{rows.length} of {catalogue.length} titles shown · demo links last checked {OFFICIAL_DEMO_LINKS_VERIFIED_ON}</p>
      {rows.length === 0 ? <p className="empty-copy">No titles match these filters.</p> :
      <div className="admin-table-wrap"><table className="admin-table"><caption className="admin-sr-only">Lobby titles</caption><thead><tr><th scope="col">Game</th><th scope="col">Provider</th><th scope="col" className="admin-hide-small">Category</th><th scope="col">Provider-site demo</th><th scope="col">Play on AwehBet</th></tr></thead><tbody>
        {rows.map(game => <tr key={game.name}>
          <td className="admin-title-cell"><strong>{game.name}</strong></td>
          <td className="admin-title-cell">{game.provider}{!game.registered && <span className="admin-meta admin-muted">Not in provider register</span>}</td>
          <td className="admin-hide-small">{game.category}</td>
          <td className="admin-title-cell">{game.demoUrl ? <a className="admin-link" href={game.demoUrl} target="_blank" rel="noopener noreferrer">Linked<span className="admin-sr-only"> — open {game.name} on the provider’s website in a new tab</span> ↗</a> : <span className="admin-status admin-status-neutral">Not linked</span>}</td>
          <td><span className={`admin-status admin-status-${game.launchAuthorised ? 'ok' : 'blocked'}`}>{game.launchAuthorised ? 'Authorised' : 'Blocked'}</span></td>
        </tr>)}
      </tbody></table></div>}
    </div>
    <section className="admin-panel" aria-labelledby="originals"><h2 id="originals">AwehBet originals</h2><p className="admin-muted">In-house games need no provider permission. Reel Rush is added by the lobby pull request and appears here once that is merged.</p></section>
    <p className="admin-muted">“Play on AwehBet” follows the provider compliance register. See <Link className="admin-link" href="/admin/providers">Providers</Link>.</p>
  </section>;
}
