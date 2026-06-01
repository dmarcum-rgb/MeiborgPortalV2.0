import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Department } from '../types';
import { ArrowLeft, ZoomIn, ZoomOut, Maximize2, RefreshCw } from 'lucide-react';

interface TeamMember {
  id: string;
  full_name: string;
  email: string | null;
  position: string;
  department_id: string | null;
  supervisor_id: string | null;
  avatar_url: string | null;
}

interface OrgNode {
  member: TeamMember;
  children: OrgNode[];
  depth: number;
}

function buildTree(members: TeamMember[]): OrgNode[] {
  const byId = new Map(members.map(m => [m.id, m]));
  const childrenOf = new Map<string, TeamMember[]>();
  const hasParent = new Set<string>();

  members.forEach(m => {
    if (m.supervisor_id && byId.has(m.supervisor_id)) {
      const arr = childrenOf.get(m.supervisor_id) ?? [];
      arr.push(m);
      childrenOf.set(m.supervisor_id, arr);
      hasParent.add(m.id);
    }
  });

  function makeNode(m: TeamMember, depth: number): OrgNode {
    const kids = (childrenOf.get(m.id) ?? [])
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
    return { member: m, children: kids.map(k => makeNode(k, depth + 1)), depth };
  }

  const roots = members
    .filter(m => !hasParent.has(m.id))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  return roots.map(r => makeNode(r, 0));
}

// ── Layout constants ──────────────────────────────────────────
const NODE_W = 180;
const NODE_H = 88;
const H_GAP = 32;
const V_GAP = 72;

interface LayoutNode {
  node: OrgNode;
  x: number;
  y: number;
}

function layoutTree(roots: OrgNode[]): { nodes: LayoutNode[]; width: number; height: number } {
  const nodes: LayoutNode[] = [];
  let maxX = 0;
  let maxY = 0;

  // Compute subtree width for each node
  function subtreeWidth(n: OrgNode): number {
    if (n.children.length === 0) return NODE_W;
    const childrenW = n.children.reduce((s, c) => s + subtreeWidth(c), 0)
      + H_GAP * (n.children.length - 1);
    return Math.max(NODE_W, childrenW);
  }

  function place(n: OrgNode, x: number, y: number) {
    const sw = subtreeWidth(n);
    const cx = x + sw / 2 - NODE_W / 2;
    nodes.push({ node: n, x: cx, y });
    if (cx + NODE_W > maxX) maxX = cx + NODE_W;
    if (y + NODE_H > maxY) maxY = y + NODE_H;

    if (n.children.length > 0) {
      let childX = x;
      n.children.forEach(child => {
        const csw = subtreeWidth(child);
        place(child, childX, y + NODE_H + V_GAP);
        childX += csw + H_GAP;
      });
    }
  }

  let x = 0;
  roots.forEach(root => {
    const sw = subtreeWidth(root);
    place(root, x, 0);
    x += sw + H_GAP * 2;
  });

  return { nodes, width: maxX + 32, height: maxY + 32 };
}

// ── SVG connector lines ───────────────────────────────────────
function Connectors({ nodes }: { nodes: LayoutNode[] }) {
  const byId = new Map(nodes.map(n => [n.node.member.id, n]));

  const paths: string[] = [];
  nodes.forEach(({ node, x, y }) => {
    node.children.forEach(child => {
      const cn = byId.get(child.member.id);
      if (!cn) return;
      const px = x + NODE_W / 2;
      const py = y + NODE_H;
      const cx = cn.x + NODE_W / 2;
      const cy = cn.y;
      const midY = py + V_GAP / 2;
      paths.push(`M ${px} ${py} L ${px} ${midY} L ${cx} ${midY} L ${cx} ${cy}`);
    });
  });

  return (
    <>
      {paths.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="#DDDBD5" strokeWidth={1.5} />
      ))}
    </>
  );
}

// ── Individual node card ──────────────────────────────────────
function NodeCard({
  node, departments, selected, onClick,
}: {
  node: LayoutNode;
  departments: Department[];
  selected: boolean;
  onClick: () => void;
}) {
  const { member } = node.node;
  const dept = departments.find(d => d.id === member.department_id);
  const deptColor = dept?.color ?? '#9A9690';
  const initials = member.full_name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();

  return (
    <g
      transform={`translate(${node.x}, ${node.y})`}
      onClick={onClick}
      style={{ cursor: 'pointer' }}
    >
      {/* Shadow rect */}
      <rect x={1} y={2} width={NODE_W} height={NODE_H} rx={12}
        fill="rgba(44,42,39,0.07)" />
      {/* Card bg */}
      <rect width={NODE_W} height={NODE_H} rx={12}
        fill={selected ? '#2C2A27' : '#F5F3EE'}
        stroke={selected ? '#2C2A27' : '#DDDBD5'}
        strokeWidth={1.5} />
      {/* Dept color bar */}
      <rect x={0} y={NODE_H - 4} width={NODE_W} height={4} rx={4}
        fill={deptColor} opacity={0.7} />
      <rect x={0} y={NODE_H - 8} width={NODE_W} height={8} rx={0}
        fill={deptColor} opacity={0.7} clipPath={`inset(0 0 50% 0)`} />
      {/* clip bottom corners */}
      <rect x={0} y={NODE_H - 4} width={NODE_W} height={4}
        fill={deptColor} opacity={0.7} />

      {/* Avatar */}
      <foreignObject x={12} y={12} width={40} height={40}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%', overflow: 'hidden',
          background: '#DDD9D0', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: 13, fontWeight: 700,
          color: selected ? '#F5F3EE' : '#6B6865',
          border: `2px solid ${selected ? '#ffffff33' : '#ECEAE4'}`,
          flexShrink: 0,
        }}>
          {member.avatar_url
            ? <img src={member.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ color: selected ? '#F5F3EE' : '#6B6865' }}>{initials}</span>
          }
        </div>
      </foreignObject>

      {/* Text */}
      <foreignObject x={60} y={10} width={NODE_W - 68} height={NODE_H - 20}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', gap: 2 }}>
          <div style={{
            fontSize: 11.5, fontWeight: 700, color: selected ? '#F5F3EE' : '#2C2A27',
            lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {member.full_name}
          </div>
          {member.position && (
            <div style={{
              fontSize: 10, color: selected ? '#F5F3EEcc' : '#9A9690',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3,
            }}>
              {member.position}
            </div>
          )}
          {dept && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: deptColor, flexShrink: 0 }} />
              <div style={{ fontSize: 9.5, color: deptColor, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {dept.name}
              </div>
            </div>
          )}
        </div>
      </foreignObject>
    </g>
  );
}

// ── Detail panel ─────────────────────────────────────────────
function DetailPanel({
  member, departments, members, onClose,
}: {
  member: TeamMember;
  departments: Department[];
  members: TeamMember[];
  onClose: () => void;
}) {
  const dept = departments.find(d => d.id === member.department_id);
  const supervisor = member.supervisor_id ? members.find(m => m.id === member.supervisor_id) : null;
  const reports = members.filter(m => m.supervisor_id === member.id);
  const initials = member.full_name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
  const deptColor = dept?.color ?? '#9A9690';

  return (
    <div
      className="absolute right-0 top-0 bottom-0 w-72 flex flex-col shadow-2xl z-20"
      style={{ background: '#F5F3EE', borderLeft: '1px solid #DDDBD5' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
        style={{ borderBottom: '1px solid #ECEAE4' }}>
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#B0ADA7' }}>Profile</span>
        <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
          style={{ color: '#9A9690' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#E4E2DC')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Avatar + name */}
        <div className="flex flex-col items-center text-center pt-2 pb-3"
          style={{ borderBottom: '1px solid #ECEAE4' }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%', overflow: 'hidden',
            background: '#DDD9D0', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 700, color: '#6B6865',
            border: `3px solid ${deptColor}33`, marginBottom: 12,
          }}>
            {member.avatar_url
              ? <img src={member.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : initials
            }
          </div>
          <div className="font-semibold text-base" style={{ color: '#2C2A27' }}>{member.full_name}</div>
          {member.position && <div className="text-sm mt-0.5" style={{ color: '#9A9690' }}>{member.position}</div>}
          {dept && (
            <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full text-xs font-medium"
              style={{ background: deptColor + '18', color: deptColor }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: deptColor, display: 'inline-block' }} />
              {dept.name}
            </div>
          )}
        </div>

        {/* Email */}
        {member.email && (
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#B0ADA7' }}>Email</div>
            <div className="text-sm" style={{ color: '#2C2A27' }}>{member.email}</div>
          </div>
        )}

        {/* Supervisor */}
        {supervisor && (
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#B0ADA7' }}>Reports to</div>
            <div className="flex items-center gap-2.5 p-2.5 rounded-xl" style={{ background: '#ECEAE4' }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', overflow: 'hidden',
                background: '#DDD9D0', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, color: '#6B6865', flexShrink: 0,
              }}>
                {supervisor.avatar_url
                  ? <img src={supervisor.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : supervisor.full_name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
                }
              </div>
              <div>
                <div className="text-sm font-medium" style={{ color: '#2C2A27' }}>{supervisor.full_name}</div>
                {supervisor.position && <div className="text-xs" style={{ color: '#9A9690' }}>{supervisor.position}</div>}
              </div>
            </div>
          </div>
        )}

        {/* Direct reports */}
        {reports.length > 0 && (
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#B0ADA7' }}>
              Direct Reports · {reports.length}
            </div>
            <div className="space-y-1.5">
              {reports.map(r => (
                <div key={r.id} className="flex items-center gap-2.5 p-2.5 rounded-xl" style={{ background: '#ECEAE4' }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', overflow: 'hidden',
                    background: '#DDD9D0', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 700, color: '#6B6865', flexShrink: 0,
                  }}>
                    {r.avatar_url
                      ? <img src={r.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : r.full_name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
                    }
                  </div>
                  <div>
                    <div className="text-xs font-medium" style={{ color: '#2C2A27' }}>{r.full_name}</div>
                    {r.position && <div className="text-xs" style={{ color: '#9A9690' }}>{r.position}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function OrgChartPage({ onBack }: { onBack: () => void }) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 32, y: 32 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ mx: 0, my: 0, px: 0, py: 0 });
  const [filterDept, setFilterDept] = useState<string>('');
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    async function load() {
      const [{ data: m }, { data: d }] = await Promise.all([
        supabase.from('team_members').select('*').order('full_name'),
        supabase.from('departments').select('*').order('name'),
      ]);
      if (m) setMembers(m as TeamMember[]);
      if (d) setDepartments(d as Department[]);
      setLoading(false);
    }
    load();
  }, []);

  const visibleMembers = filterDept
    ? members.filter(m => m.department_id === filterDept)
    : members;

  const roots = buildTree(visibleMembers);
  const { nodes, width, height } = layoutTree(roots);

  const selectedMember = selectedId ? members.find(m => m.id === selectedId) ?? null : null;

  // Pan handlers
  function onMouseDown(e: React.MouseEvent) {
    if ((e.target as Element).closest('g[data-node]')) return;
    setDragging(true);
    setDragStart({ mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y });
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!dragging) return;
    setPan({
      x: dragStart.px + e.clientX - dragStart.mx,
      y: dragStart.py + e.clientY - dragStart.my,
    });
  }

  function onMouseUp() { setDragging(false); }

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(s => Math.min(2, Math.max(0.2, s * delta)));
  }

  const zoom = useCallback((delta: number) => {
    setScale(s => Math.min(2, Math.max(0.2, s + delta)));
  }, []);

  function resetView() {
    setScale(1);
    setPan({ x: 32, y: 32 });
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: '#ECEAE4' }}>
        <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: '#DDDBD5', borderTopColor: '#2C2A27' }} />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col" style={{ background: '#ECEAE4', fontFamily: "'Inter', sans-serif" }}>

      {/* Header */}
      <header className="flex items-center justify-between px-8 py-4 flex-shrink-0"
        style={{ background: '#F5F3EE', borderBottom: '1px solid #DDDBD5' }}>
        <button onClick={onBack}
          className="flex items-center gap-2 text-sm transition-opacity hover:opacity-60"
          style={{ color: '#6B6865' }}>
          <ArrowLeft className="w-4 h-4" strokeWidth={1.5} /> Back to Portal
        </button>
        <span className="font-display italic text-2xl tracking-wide" style={{ color: '#2C2A27' }}>
          Org Chart
        </span>
        <div className="flex items-center gap-2">
          {/* Department filter */}
          <div className="relative">
            <select
              value={filterDept}
              onChange={e => setFilterDept(e.target.value)}
              className="rounded-xl px-3 py-2 text-xs font-medium focus:outline-none appearance-none pr-7"
              style={{ background: '#ECEAE4', border: '1px solid #DDDBD5', color: '#2C2A27', minWidth: 130 }}>
              <option value="">All Departments</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <svg className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none w-3 h-3" viewBox="0 0 12 12" fill="none">
              <path d="M2 4l4 4 4-4" stroke="#B0ADA7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          {/* Zoom controls */}
          <div className="flex items-center rounded-xl overflow-hidden" style={{ border: '1px solid #DDDBD5', background: '#F5F3EE' }}>
            <button onClick={() => zoom(-0.15)} className="px-3 py-2 transition-colors hover:bg-[#E4E2DC]" style={{ color: '#6B6865' }}>
              <ZoomOut className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
            <span className="px-2 text-xs font-medium" style={{ color: '#9A9690', minWidth: 42, textAlign: 'center' }}>
              {Math.round(scale * 100)}%
            </span>
            <button onClick={() => zoom(0.15)} className="px-3 py-2 transition-colors hover:bg-[#E4E2DC]" style={{ color: '#6B6865' }}>
              <ZoomIn className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
          </div>
          <button onClick={resetView} className="p-2 rounded-xl transition-colors hover:bg-[#E4E2DC]"
            style={{ color: '#6B6865', border: '1px solid #DDDBD5', background: '#F5F3EE' }}
            title="Reset view">
            <Maximize2 className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
          <button onClick={() => { setLoading(true); supabase.from('team_members').select('*').order('full_name').then(({ data }) => { if (data) setMembers(data as TeamMember[]); setLoading(false); }); }}
            className="p-2 rounded-xl transition-colors hover:bg-[#E4E2DC]"
            style={{ color: '#6B6865', border: '1px solid #DDDBD5', background: '#F5F3EE' }}
            title="Refresh">
            <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </header>

      {/* Canvas + detail panel */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* SVG canvas */}
        <div className="flex-1 overflow-hidden relative"
          style={{ cursor: dragging ? 'grabbing' : 'grab' }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}>
          <svg
            ref={svgRef}
            style={{ width: '100%', height: '100%' }}
            onWheel={onWheel}
          >
            <g transform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}>
              <svg width={width} height={height} overflow="visible">
                <Connectors nodes={nodes} />
                {nodes.map(n => (
                  <NodeCard
                    key={n.node.member.id}
                    node={n}
                    departments={departments}
                    selected={selectedId === n.node.member.id}
                    onClick={() => setSelectedId(id => id === n.node.member.id ? null : n.node.member.id)}
                  />
                ))}
              </svg>
            </g>
          </svg>

          {nodes.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: '#F5F3EE', border: '1px solid #DDDBD5' }}>
                <RefreshCw className="w-6 h-6" style={{ color: '#C0BDB7' }} strokeWidth={1.5} />
              </div>
              <p className="text-sm font-medium" style={{ color: '#9A9690' }}>No members to display</p>
              <p className="text-xs mt-1" style={{ color: '#B0ADA7' }}>Add team members in the Admin panel.</p>
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selectedMember && (
          <DetailPanel
            member={selectedMember}
            departments={departments}
            members={members}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>
    </div>
  );
}
