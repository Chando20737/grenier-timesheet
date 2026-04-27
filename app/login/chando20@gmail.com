export default function Home() {
  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f5f4f0' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:'22px', fontWeight:'500', marginBottom:'1rem' }}>Grenier</div>
        <a href="/login" style={{ background:'#F2E000', padding:'10px 24px', borderRadius:'8px', fontSize:'13px', fontWeight:'500', textDecoration:'none', color:'#111' }}>
          Se connecter
        </a>
      </div>
    </div>
  )
}
