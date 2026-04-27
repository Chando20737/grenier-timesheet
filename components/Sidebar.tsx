'use client'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const Logo = () => (
  <svg viewBox="0 0 100 100" width="32" height="32">
    <rect width="100" height="100" rx="18" fill="#F2E000"/>
    <rect x="12" y="12" width="20" height="76" rx="10" fill="#111"/>
    <rect x="38" y="12" width="46" height="14" rx="6" fill="#111"/>
    <rect x="54" y="34" width="30" height="13" rx="4" fill="#111"/>
    <rect x="12" y="74" width="72" height="14" rx="6" fill="#111"/>
    <rect x="30" y="50" width="16" height="30" rx="6" fill="#111"/>
    <rect x="18" y="18" width="10" height="62" fill="#F2E000"/>
    <rect x="18" y="18" width="66" height="10" fill="#F2E000"/>
    <rect x="18" y="76" width="66" height="6" fill="#F2E000"/>
    <rect x="60" y="36" width="20" height="9" fill="#F2E000"/>
    <rect x="36" y="52" width="10" height="26" fill="#F2E000"/>
    <rect x="38" y="52" width="40" height="20" fill="#F2E000"/>
  </svg>
)

const navItems = [
  { href: '/dashboard', title: 'Minuterie', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="13" r="8" stroke="currentColor" strokeWidth="1.5"/><path d="M12 9v4l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M9 2h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
  { href: '/taches',    title: 'Mes tâches', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M8 9h8M8 13h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
  { href: '/gmail',     title: 'Import Gmail', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20 4H4C2.9 4 2 4.9 2 6v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z" stroke="currentColor" strokeWidth="1.5"/><path d="M2 6l10 7 10-7" stroke="currentColor" strokeWidth="1.5"/></svg> },
  { href: '/rapport',   title: 'Rapport', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 20V8l8-5 8 5v12H4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M9 20v-6h6v6" stroke="currentColor" strokeWidth="1.5"/></svg> },
  { href: '/employes',  title: 'Employés', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="7" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M3 17c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M16 11a4 4 0 0 1 0 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
]

export default function Sidebar({ userInitials }: { userInitials: string }) {
  const pathname = usePathname()
  const router = useRouter()

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="sidebar">
      <div style={{ marginBottom:'10px' }}><Logo /></div>
      {navItems.map(item => {
        const active = pathname.startsWith(item.href)
        return (
          <div key={item.href} title={item.title} onClick={() => router.push(item.href)}
            style={{ width:'36px', height:'36px', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', background: active ? '#F2E000' : 'transparent', color: active ? '#111' : 'rgba(255,255,255,0.6)', transition:'all 0.15s' }}>
            {item.icon}
          </div>
        )
      })}
      <div style={{ flex:1 }} />
      <div onClick={logout} title="Déconnexion"
        style={{ width:'30px', height:'30px', borderRadius:'50%', background:'#F2E000', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', fontWeight:'500', color:'#111', cursor:'pointer' }}>
        {userInitials}
      </div>
    </div>
  )
}
