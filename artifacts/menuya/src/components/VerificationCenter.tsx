import { useCallback, useEffect, useMemo, useState } from 'react';
import { Award, BadgeCheck, Check, Clock3, Crown, FileCheck2, RefreshCw, Search, ShieldAlert, ShieldCheck, Sparkles, Store } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import './VerificationCenter.css';

type VerificationRow = {
  business_id: string;
  business_name: string;
  business_type: string | null;
  email: string | null;
  phone: string | null;
  business_status: string;
  created_at: string;
  verification_level: 'purple' | 'silver' | 'gold';
  verification_status: 'approved' | 'pending' | 'suspended';
  verification_note: string | null;
  approved_at: string | null;
  product_count: number;
  completed_orders: number;
  eligible_orders: number;
  completion_rate: number;
  days_active: number;
  profile_complete: boolean;
  has_purple: boolean;
};

const fmtDate = (value: string | null) => value
  ? new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(new Date(value))
  : 'Sin aprobación';
const tierLabel = (level: string) => level === 'gold' ? 'Oro' : level === 'silver' ? 'Plata' : 'Morada';
const tierIcon = (level: string) => level === 'gold' ? Crown : level === 'silver' ? Award : ShieldCheck;

export default function VerificationCenter() {
  const [rows, setRows] = useState<VerificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: loadError } = await supabase.rpc('platform_list_verifications');
    if (loadError) setError(loadError.message);
    else setRows((data || []) as VerificationRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const review = async (row: VerificationRow, level: 'silver' | 'gold', status: 'approved' | 'suspended') => {
    const verb = status === 'approved' ? 'aprobar' : 'suspender';
    if (!window.confirm(`¿Confirmas ${verb} la verificación CLICKOK ${tierLabel(level)} de ${row.business_name}?`)) return;
    setBusy(row.business_id);
    setError('');
    setNotice('');
    const { error: reviewError } = await supabase.rpc('platform_review_verification', {
      p_business_id: row.business_id,
      p_level: level,
      p_status: status,
      p_note: status === 'approved' ? 'Aprobada desde el Centro de verificaciones CLICKOK.' : 'Suspendida desde el Centro de verificaciones CLICKOK.',
    });
    if (reviewError) setError(reviewError.message);
    else {
      setNotice(`Verificación CLICKOK ${tierLabel(level)} ${status === 'approved' ? 'aprobada' : 'suspendida'} correctamente.`);
      await load();
    }
    setBusy('');
  };

  const metrics = useMemo(() => ({
    total: rows.length,
    purple: rows.filter(x => x.has_purple).length,
    silver: rows.filter(x => x.verification_level === 'silver' && x.verification_status === 'approved').length,
    gold: rows.filter(x => x.verification_level === 'gold' && x.verification_status === 'approved').length,
    review: rows.filter(x => x.business_status === 'active' && (x.verification_status === 'pending' || x.verification_status === 'suspended')).length,
  }), [rows]);

  const visible = rows.filter(row => {
    const matchesQuery = [row.business_name, row.business_type, row.email, row.phone].join(' ').toLowerCase().includes(query.toLowerCase());
    const matchesFilter = filter === 'all' || (filter === 'purple' ? row.verification_level === 'purple' && row.verification_status === 'approved' : filter === 'silver' ? row.verification_level === 'silver' : filter === 'gold' ? row.verification_level === 'gold' : filter === 'eligible' ? canSilver(row) || canGold(row) : row.verification_status === filter);
    return matchesQuery && matchesFilter;
  });

  return <div className="vc-root">
    <section className="vc-stats">
      <article className="vc-stat"><span className="vc-stat-icon purple"><ShieldCheck size={18}/></span><small>Moradas vigentes</small><strong>{metrics.purple}</strong><span>Verificación documental</span></article>
      <article className="vc-stat"><span className="vc-stat-icon silver"><Award size={18}/></span><small>Plata</small><strong>{metrics.silver}</strong><span>Logros aprobados</span></article>
      <article className="vc-stat"><span className="vc-stat-icon gold"><Crown size={18}/></span><small>Oro</small><strong>{metrics.gold}</strong><span>Máximo reconocimiento</span></article>
      <article className="vc-stat"><span className="vc-stat-icon review"><Clock3 size={18}/></span><small>Por revisar</small><strong>{metrics.review}</strong><span>Comercios activos</span></article>
    </section>

    <section className="sa-panel vc-panel">
      <div className="sa-panel-heading vc-heading">
        <div><span className="sa-kicker">REPUTACIÓN Y CONFIANZA</span><h2>Centro de verificaciones</h2><p>Revisa los documentos vigentes y los logros necesarios para Plata y Oro.</p></div>
        <button className="sa-refresh" onClick={() => void load()} disabled={loading}><RefreshCw size={15}/>{loading ? 'Actualizando…' : 'Actualizar'}</button>
      </div>
      {error && <div className="notice notice-error vc-notice">{error}</div>}
      {notice && <div className="notice notice-success vc-notice">{notice}</div>}
      <div className="vc-toolbar">
        <div className="sa-search"><Search size={16}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar comercio, sector o correo…"/></div>
        <div className="sa-filters" role="group" aria-label="Filtrar verificaciones">
          {[
            ['all','Todos'],['purple','Morada'],['silver','Plata'],['gold','Oro'],['eligible','Listos para avanzar'],['suspended','Suspendidos'],
          ].map(([key,label]) => <button key={key} className={filter === key ? 'selected' : ''} onClick={() => setFilter(key)}>{label}</button>)}
        </div>
      </div>

      {loading ? <div className="sa-empty"><span className="loader-line"/>Cargando verificaciones…</div> : visible.length === 0 ? <div className="sa-empty"><span className="vc-empty-icon"><ShieldCheck size={20}/></span><b>No hay comercios para mostrar</b><span>Prueba con otro filtro o búsqueda.</span></div> : <div className="vc-list">
        {visible.map(row => {
          const open = selected === row.business_id;
          const silverReady = canSilver(row);
          const goldReady = canGold(row);
          const currentLevel = row.verification_status === 'suspended' ? 'suspended' : row.verification_level;
          const CurrentIcon = currentLevel === 'gold' ? Crown : currentLevel === 'silver' ? Award : currentLevel === 'suspended' ? ShieldAlert : ShieldCheck;
          return <article className="vc-business" key={row.business_id}>
            <button className="vc-business-head" onClick={() => setSelected(open ? null : row.business_id)} aria-expanded={open}>
              <span className={`vc-tier-mark ${currentLevel}`}><CurrentIcon size={19}/></span>
              <span className="vc-business-main"><b>{row.business_name}</b><small>{row.business_type || 'Comercio'} · {row.email || 'Sin correo'}</small></span>
              <span className={`vc-status ${row.verification_status}`}>{row.verification_status === 'approved' ? `Verificada ${tierLabel(row.verification_level)}` : row.verification_status === 'suspended' ? 'Suspendida' : 'Pendiente'}</span>
              <span className="vc-business-metrics"><b>{row.completed_orders}</b><small>ventas entregadas</small></span>
              <span className="vc-business-metrics"><b>{row.product_count}</b><small>productos activos</small></span>
              <span className="vc-expand">{open ? 'Cerrar' : 'Ver logros'}</span>
            </button>
            {open && <div className="vc-detail">
              <div className="vc-detail-top">
                <div><span className="vc-overline">TRAYECTORIA</span><b>{row.days_active} días activo</b><small>Registrado el {fmtDate(row.created_at)}</small></div>
                <div><span className="vc-overline">PEDIDOS COMPLETADOS</span><b>{row.completion_rate}%</b><small>{row.completed_orders} de {row.eligible_orders} pedidos no cancelados</small></div>
                <div><span className="vc-overline">PERFIL COMERCIAL</span><b>{row.profile_complete ? 'Completo' : 'Incompleto'}</b><small>Datos de contacto, sector, logo y descripción</small></div>
              </div>
              <div className="vc-tiers">
                <TierCard level="purple" title="Morada" subtitle="Verificación documental actual" active={row.has_purple} ready={row.has_purple} items={[['Aprobación documental vigente',row.has_purple]]}/>
                <TierCard level="silver" title="Plata" subtitle="Actividad y gestión constante" active={row.verification_level === 'silver' && row.verification_status === 'approved'} ready={silverReady} items={[
                  [`30 días de actividad (actual: ${row.days_active})`,row.days_active >= 30],
                  [`30 ventas entregadas (actual: ${row.completed_orders})`,row.completed_orders >= 30],
                  [`10 productos activos (actual: ${row.product_count})`,row.product_count >= 10],
                  ['Perfil comercial completo',row.profile_complete],
                ]}/>
                <TierCard level="gold" title="Oro" subtitle="Máximo reconocimiento CLICKOK" active={row.verification_level === 'gold' && row.verification_status === 'approved'} ready={goldReady} items={[
                  [`90 días de actividad (actual: ${row.days_active})`,row.days_active >= 90],
                  [`200 ventas entregadas (actual: ${row.completed_orders})`,row.completed_orders >= 200],
                  [`20 productos activos (actual: ${row.product_count})`,row.product_count >= 20],
                  [`95% de pedidos completados (actual: ${row.completion_rate}%)`,row.completion_rate >= 95],
                  ['CLICKOK Plata aprobada',row.verification_level === 'silver' || row.verification_level === 'gold'],
                ]}/>
              </div>
              {row.verification_note && <p className="vc-note">Última nota: {row.verification_note}</p>}
              <div className="vc-actions">
                {row.business_status !== 'active' ? <span className="vc-warning"><ShieldAlert size={15}/> El comercio no tiene vigente la aprobación documental morada.</span> : <>
                  {silverReady && !(row.verification_level === 'silver' && row.verification_status === 'approved') && <button className="vc-action silver" disabled={busy === row.business_id} onClick={() => void review(row,'silver','approved')}><Check size={15}/> Aprobar Plata</button>}
                  {goldReady && !(row.verification_level === 'gold' && row.verification_status === 'approved') && <button className="vc-action gold" disabled={busy === row.business_id} onClick={() => void review(row,'gold','approved')}><Crown size={15}/> Aprobar Oro</button>}
                  {row.verification_level !== 'purple' && row.verification_status === 'approved' && <button className="vc-action suspend" disabled={busy === row.business_id} onClick={() => void review(row,row.verification_level as 'silver'|'gold','suspended')}><ShieldAlert size={15}/> Suspender nivel</button>}
                  {!silverReady && row.verification_level === 'purple' && <span className="vc-hint"><Clock3 size={14}/> Aún no cumple los requisitos para Plata.</span>}
                </>}
              </div>
            </div>}
          </article>;
        })}
      </div>}
      <div className="vc-footer"><ShieldCheck size={14}/> La insignia morada conserva la verificación documental vigente. Plata y Oro requieren cumplir los logros y aprobación administrativa.</div>
    </section>
  </div>;
}

function canSilver(row: VerificationRow) {
  return row.business_status === 'active' && row.has_purple && row.days_active >= 30 && row.completed_orders >= 30 && row.product_count >= 10 && row.profile_complete;
}
function canGold(row: VerificationRow) {
  return row.business_status === 'active' && row.has_purple && row.verification_level === 'silver' && row.verification_status === 'approved' && row.days_active >= 90 && row.completed_orders >= 200 && row.product_count >= 20 && row.eligible_orders > 0 && row.completion_rate >= 95;
}
function TierCard({level,title,subtitle,active,ready,items}:{level:'purple'|'silver'|'gold';title:string;subtitle:string;active:boolean;ready:boolean;items:[string,boolean][]}) {
  return <section className={`vc-tier-card ${level} ${active?'active':''}`}>
    <div className="vc-tier-card-head"><span className={`vc-tier-mark ${level}`}>{level==='gold'?<Crown size={17}/>:level==='silver'?<Award size={17}/>:<ShieldCheck size={17}/>}</span><span><b>CLICKOK {title}</b><small>{subtitle}</small></span>{active?<span className="vc-tier-label active">Obtenida</span>:ready?<span className="vc-tier-label ready">Requisitos listos</span>:<span className="vc-tier-label">En progreso</span>}</div>
    <ul>{items.map(([label,done])=><li key={label} className={done?'done':''}>{done?<Check size={13}/>:<Clock3 size={13}/>}<span>{label}</span></li>)}</ul>
  </section>;
}
