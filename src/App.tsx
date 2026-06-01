import { useState } from 'react';
import PortalPage from './pages/PortalPage';
import AdminPage from './pages/AdminPage';
import OrgChartPage from './pages/OrgChartPage';
import MeiGuyWidget from './pages/AgentPage';

type View = 'portal' | 'admin' | 'org';

function getInitialMemberName(): string | undefined {
  try {
    const m = JSON.parse(sessionStorage.getItem('portal_member') ?? 'null');
    return m?.full_name ?? undefined;
  } catch { return undefined; }
}

export default function App() {
  const [view, setView] = useState<View>('portal');
  const [activeTabLabel, setActiveTabLabel] = useState<string | undefined>(undefined);
  const [portalAuthed, setPortalAuthed] = useState(() => sessionStorage.getItem('portal_ai_authed') === '1');
  const [loggedInName, setLoggedInName] = useState<string | undefined>(getInitialMemberName);

  return (
    <>
      {view === 'admin' && <AdminPage onGoToChat={() => setView('portal')} />}
      {view === 'org' && <OrgChartPage onBack={() => setView('portal')} />}
      {view === 'portal' && (
        <PortalPage
          onOpenAdmin={() => setView('admin')}
          onOpenOrgChart={() => setView('org')}
          onActiveTabChange={setActiveTabLabel}
          onAuthChange={(authed, member) => {
            setPortalAuthed(authed);
            setLoggedInName(member?.full_name);
          }}
        />
      )}
      {portalAuthed && loggedInName?.split(' ')[0]?.toLowerCase() === 'dallas' && (
        <MeiGuyWidget formContext={activeTabLabel} userName={loggedInName} />
      )}
    </>
  );
}
