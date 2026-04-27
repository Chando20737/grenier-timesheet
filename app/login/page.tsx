export default function LoginPage() {
  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f5f4f0' }}>
      <div style={{ background:'white', borderRadius:'16px', padding:'2.5rem 2rem', width:'100%', maxWidth:'380px', textAlign:'center' }}>
        <div style={{ fontSize:'22px', fontWeight:'500', marginBottom:'1.5rem' }}>Grenier</div>
        <p style={{ fontSize:'13px', color:'#777', marginBottom:'1.5rem' }}>Connectez-vous pour accéder à vos feuilles de temps.</p>
        <input type="email" placeholder="vous@grenier.qc.ca"
          style={{ width:'100%', padding:'9px 11px', fontSize:'13px', border:'0.5px solid rgba(0,0,0,0.15)', borderRadius:'8px', marginBottom:'12px', display:'block' }} />
        <input type="password" placeholder="••••••••"
          style={{ width:'100%', padding:'9px 11px', fontSize:'13px', border:'0.5px solid rgba(0,0,0,0.15)', borderRadius:'8px', marginBottom:'16px', display:'block' }} />
        <button style={{ width:'100%', padding:'10px', background:'#F2E000', border:'none', borderRadius:'8px', fontSize:'13px', fontWeight:'500', cursor:'pointer' }}>
          Se connecter
        </button>
      </div>
    </div>
  )
}
