'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { QrCode, Clock, MapPin, AlertTriangle, RefreshCw } from 'lucide-react';

interface Container {
  id: string;
  code: string;
  container_type: string;
  status: string;
  current_client_id: string | null;
  placed_at: string | null;
  clients?: {
    name: string;
    address: string;
  } | null;
}

export default function DashboardPage() {
  const [containers, setContainers] = useState<Container[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchContainers() {
    setLoading(true);
    const { data, error } = await supabase
      .from('containers')
      .select('*, clients(name, address)')
      .order('code', { ascending: true });

    if (!error && data) {
      setContainers(data as Container[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchContainers();
  }, []);

  function getDaysAtClient(placedAt: string | null) {
    if (!placedAt) return 0;
    const diff = new Date().getTime() - new Date(placedAt).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  const atClientCount = containers.filter((c) => c.status === 'at_client').length;
  const inTransitCount = containers.filter((c) => c.status === 'in_transit').length;
  const inYardCount = containers.filter((c) => c.status === 'in_yard').length;

  return (
<div className="min-h-screen bg-slate-950 text-slate-100 p-4 max-w-2xl mx-auto pb-16">
<div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
<div>
<h1 className="text-xl font-black text-emerald-400 tracking-wide">PULPIT DYSPOZYTORA</h1>
<p className="text-xs text-slate-400">System zarzadzania kontenerami</p>
</div>
<button
onClick={fetchContainers}
className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition"
title="Odswiez dane"
type="button"
>
<RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
</button>
</div>

<div className="mb-6">
<a
href="/scan"
className="flex items-center justify-center gap-2 w-full py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-lg text-white shadow-lg shadow-emerald-950 transition active:scale-98"
>
<QrCode className="w-6 h-6" />
<span>Skanuj kontener / Zmien status</span>
</a>
</div>

<div className="grid grid-cols-3 gap-3 mb-6">
<div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-center">
<span className="text-xs text-slate-400 block mb-1">U klientow</span>
<span className="text-2xl font-black text-amber-400">{atClientCount}</span>
</div>
<div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-center">
<span className="text-xs text-slate-400 block mb-1">W drodze</span>
<span className="text-2xl font-black text-blue-400">{inTransitCount}</span>
</div>
<div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-center">
<span className="text-xs text-slate-400 block mb-1">Na bazie</span>
<span className="text-2xl font-black text-emerald-400">{inYardCount}</span>
</div>
</div>

<div className="space-y-3">
<h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
Aktywne kontenery ({containers.length})
</h2>

{loading && containers.length === 0 ? (
<div className="p-8 text-center text-slate-500 text-sm">Wczytywanie listy...</div>
) : containers.length === 0 ? (
<div className="p-8 text-center text-slate-500 text-sm border border-dashed border-slate-800 rounded-2xl">
Brak kontenerow w bazie danych.
</div>
) : (
containers.map((c) => {
const days = getDaysAtClient(c.placed_at);
const isCritical = days >= 14;
const isWarning = days >= 7;

return (
<div
key={c.id}
className={`p-4 rounded-xl border transition ${
c.status === 'at_client'
? isCritical
? 'bg-red-950/20 border-red-800/60'
: isWarning
? 'bg-amber-950/20 border-amber-800/60'
: 'bg-slate-900 border-slate-800'
: 'bg-slate-900/60 border-slate-800/60 opacity-80'
}`}
>
<div className="flex items-start justify-between mb-2">
<div>
<span className="text-xs font-mono text-slate-400 uppercase">{c.container_type}</span>
<h3 className="text-lg font-black font-mono text-white tracking-wide">{c.code}</h3>
</div>

<span
className={`text-xs px-2.5 py-1 rounded-full font-medium ${
c.status === 'at_client'
? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
: c.status === 'in_transit'
? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
}`}
>
{c.status === 'at_client'
? 'U klienta'
: c.status === 'in_transit'
? 'W transporcie'
: 'Na bazie'}
</span>
</div>

{c.status === 'at_client' && (
<div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
<div className="flex items-center gap-1.5 text-slate-300">
<MapPin className="w-3.5 h-3.5 text-emerald-400" />
<span className="font-medium truncate max-w-[180px]">
{c.clients?.name || 'Klient nieprzypisany'}
</span>
</div>

<div
className={`flex items-center gap-1.5 font-bold font-mono ${
isCritical ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-slate-300'
}`}
>
{isCritical ? (
<AlertTriangle className="w-3.5 h-3.5 text-red-400" />
) : (
<Clock className="w-3.5 h-3.5" />
)}
<span>{days} {days === 1 ? 'dzien' : 'dni'}</span>
</div>
</div>
)}
</div>
);
})
)}
</div>
</div>
  );
}
