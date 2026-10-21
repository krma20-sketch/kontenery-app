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
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 max-w-2xl mx-auto pb-16">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
        <div>
          <h1 className="text-xl font-black text-emerald-400 tracking-wide">PULPIT DYSPOZYTORA</h1>
          <p className="text-xs text-slate-400">System zarządzania kontenerami</p>
        </div>
        <button
          onClick={fetchContainers}
          className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition"
          title="Odśwież dane"
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
          <span>Skanuj kontener / Zmień status</span>
        </a>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-center">
          <span className="text-xs text-slate-400 block mb-1">U klientów</span>
          <span className="text-2xl font-black text-amber-400">{atClientCount}</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-3 rounded
