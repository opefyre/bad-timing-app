import Link from 'next/link';
import Logo from './Logo';
import Credits from './Credits';
export default function InfoLayout({title,intro,children}:{title:string;intro:string;children:React.ReactNode}){
 return <div className="info-page"><header className="site-header info-header"><Link className="brand" href="/"><Logo size={30}/><strong>BAD TIMING</strong></Link><Link href="/" className="plain-link">Back to planning</Link></header><main className="info-shell"><section className="info-intro"><h1>{title}</h1><p>{intro}</p></section><nav className="info-nav" aria-label="Information"><Link href="/sources">Sources</Link><Link href="/data">Privacy</Link><Link href="/terms">Terms</Link></nav>{children}<Credits/></main></div>;
}
