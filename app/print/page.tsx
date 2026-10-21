'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { ArrowLeft, Printer } from 'lucide-react';

interface Container {
  id: string;
  code: string;
  container_type: string;
}

export default function PrintQrPage() {
  const [containers, setContainers] = useState<Container[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadContainers() {
      const { data } = await supabase
        .from('containers')
        .select('id, code, container_type')
        .order('code', { ascending: true });
      if (data) setContainers(data);
      setLoading(false);
    }
    loadContainers();
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 p-6 print:p-0 print:bg-white">
      {/* Pasek narzędziowy – ukryty w trakcie drukowania */}
      <div className="max-w-4xl mx-auto flex items-center justify-between pb-6 border-b border-slate-300 mb-6 print:hidden">
        <a
          href="/"
          className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-800 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Powrót do pulpitu</span>
        </a>

        <button
          onClick={() => window.print()}
          type="button"
          className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-emerald-950 hover:bg-emerald-500 transition"
        >
          <Printer className="w-4 h-4" />
          <span>Drukuj etykiety (A4)</span>
        </button>
      </div>

      <div className="max-w-4xl mx-auto">
        <div className="mb-4 print:hidden">
          <h1 className="text-xl font-bold">Etykiety QR dla kontenerów</h1>
          <p className="text-xs text-slate-600">Kliknij „Drukuj etykiety” lub wciśnij Ctrl + P. Arkusz sformatowany jest pod standardowy druk.</p>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-500">Wczytywanie kontenerów...</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 print:grid-cols-2 print:gap-4">
            {containers.map((c) => {
              const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
                c.code
              )}`;

              return (
                <div
                  key={c.id}
                  className="bg-white border-2 border-slate-900 rounded-2xl p-4 flex flex-col items-center justify-between text-center page-break-inside-avoid shadow-sm print:shadow-none"
                >
                  <span className="text-xs uppercase font-mono tracking-widest text-slate-600 mb-1">
                    {c.container_type}
                  </span>
                  <div className="w-36 h-36 my-2 bg-white flex items-center justify-center">
                    <img
                      src={qrUrl}
                      alt={`Kod QR ${c.code}`}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <span className="text-2xl font-black font-mono tracking-wider text-slate-950 border-t-2 border-slate-900 w-full pt-2 mt-1">
                    {c.code}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
