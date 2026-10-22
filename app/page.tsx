'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { QrCode, Clock, MapPin, AlertTriangle, RefreshCw, Layers, Printer, Filter } from 'lucide-react';

interface Container {
  id: string;
  code: string;
  container_type: string;
  status: string;
  current_client_id: string | null;
  placed_at: string | null;
  current_lat: number | null;
  current_lng: number | null;
  clients?: {
    name: string;
    address: string;
  } | null;
}

export default function DashboardPage() {
  const [containers, setContainers] = useState<Container[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMap, setShowMap] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const mapRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

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

  useEffect(() => {
    if (!showMap) return;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => {
      initMap();
    };
    document.body.appendChild(script);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [showMap]);

  const initMap = () => {
    const L = (window as any).L;
    if (!L || !mapRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapRef.current).setView([53.4285, 14.5528], 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;
    }

    renderMarkers();
  };

  const filteredContainers = statusFilter
    ? containers.filter((c) => c.status === statusFilter)
    : containers;

  const renderMarkers = () => {
    const L = (window as any).L;
    if (!L || !mapInstanceRef.current) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const groupedByCoords: { [key: string]: Container[] } = {};

    filteredContainers.forEach((c) => {
      if (c.current_lat && c.current_lng) {
        const key = `${c.current_lat.toFixed(4)},${c.current_lng.toFixed(4)}`;
        if (!groupedByCoords[key]) {
          groupedByCoords[key] = [];
        }
        groupedByCoords[key].push(c);
      }
    });

    const bounds: any[] = [];

    Object.entries(groupedByCoords).forEach(([key, items]) => {
      const lat = items[0].current_lat!;
      const lng = items[0].current_lng!;

      let badgeColor = '#10b981';
      if (items.some((c) => c.status === 'at_client')) {
        const maxDays = Math.max(...items.filter(c => c.status === 'at_client').map(c => getDaysAtClient(c.placed_at)));
        badgeColor = maxDays >= 14 ? '#ef4444' : maxDays >= 7 ? '#f59e0b' : '#3b82f6';
      } else if (items.some((c) => c.status === 'in_transit')) {
        badgeColor = '#6366f1';
      }

      const countBadge = items.length > 1
        ? `<span style="position: absolute; top: -6px; right: -6px; background: #0f172a; color: white; font-size: 10px; font-weight: bold; border-radius: 999px; width: 16px; height: 16px; display: flex; items-center; justify-content: center; border: 1.5px solid white;">${items.length}</span>`
        : '';

      const customIcon = L.divIcon({
        className: 'custom-pin',
        html: `
          <div style="position: relative; width: 22px; height: 22px;">
            <div style="background-color: ${badgeColor}; width: 22px; height: 22px; border-radius: 50%; border: 3px solid white; box-shadow: 0 3px 8px rgba(0,0,0,0.5);"></div>
            ${countBadge}
          </div>
        `,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });

      const itemsListHtml = items.map((c) => {
        const days = getDaysAtClient(c.placed_at);
        const statusLabel =
          c.status === 'at_client'
            ? `U klienta (${days} dni)`
            : c.status === 'in_transit'
            ? 'W transporcie'
            : 'Na bazie';

        return `
          <div style="margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid #e2e8f0;">
            <div style="display: flex; justify-content: space-between; align-items: baseline;">
              <span style="font-weight: bold; font-size: 13px; font-family: monospace;">${c.code}</span>
              <span style="font-size: 10px; color: #64748b; text-transform: uppercase;">${c.container_type}</span>
            </div>
            <div style="font-size: 11px; margin-top: 2px;"><b>Status:</b> ${statusLabel}</div>
            ${c.clients?.name ? `<div style="font-size: 11px; color: #047857;"><b>Klient:</b> ${c.clients.name}</div>` : ''}
          </div>
        `;
      }).join('');

      const popupHtml = `
        <div style="color: #0f172a; font-family: sans-serif; min-width: 170px; max-height: 220px; overflow-y: auto;">
          <div style="font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase; margin-bottom: 6px;">
            Kontenery w tej lokalizacji (${items.length}):
          </div>
          ${itemsListHtml}
        </div>
      `;

      const marker = L.marker([lat, lng], { icon: customIcon })
        .addTo(mapInstanceRef.current)
        .bindPopup(popupHtml);

      markersRef.current.push(marker);
      bounds.push([lat, lng]);
    });

    if (bounds.length > 0) {
      mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  };

  useEffect(() => {
    if (mapInstanceRef.current && (window as any).L) {
      renderMarkers();
    }
  }, [filteredContainers]);

  const atClientCount = containers.filter((c) => c.status === 'at_client').length;
  const inTransitCount = containers.filter((c) => c.status === 'in_transit').length;
  const inYardCount = containers.filter((c) => c.status === 'in_yard').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 max-w-4xl mx-auto pb-16">
      {/* NAGŁÓWEK Z ORYGINALNYM LOGO GRUPY TOM */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-white px-3 py-1.5 rounded-xl flex items-center shadow-md" style={{ height: '44px' }}>
            <svg viewBox="0 0 450 145" className="h-full w-auto object-contain" fill="none">
              {/* TOM */}
              <path d="M12.4 12h81.2v14.4H53.1V112H38.7V26.4H12.4V12z" fill="#1C1C1B"/>
              <path d="M141 11H99.2v102.1H141c29 0 48.6-19.1 48.6-51.1S170 11 141 11zm-.6 88h-26V25.1h26c19.3 0 34.3 11.2 34.3 36.9s-15 37-34.3 37z" fill="#1C1C1B" style={{ display: 'none' }} /> {/* (usunięto nadmiarową literę, by było TOM) */}
              <path d="M144.5 11c-32.3 0-54.8 23-54.8 51.5s22.5 51.4 54.8 51.4 54.7-22.9 54.7-51.4-22.4-51.5-54.7-51.5zm0 88.5c-23.4 0-40-16.1-40-37s16.6-37 40-37 40 16.1 40 37-16.6 37-40 37z" fill="#1C1C1B"/>
              <path d="M211.3 12h17l23.5 61.6L275.1 12h17v100h-13.8V42.8L257.6 98H245L225.1 42v70h-13.8V12z" fill="#1C1C1B"/>
              
              {/* ELEKTRORECYKLING SP. Z O.O. */}
              <text x="12" y="132" fill="#4B5563" fontSize="19.5" fontWeight="bold" fontFamily="system-ui, sans-serif" letterSpacing="0.4">ELEKTRORECYKLING SP. Z O.O.</text>
              
              {/* SYMBOL RECYKLINGU W KWADRACIE */}
              <rect x="314" y="10" width="124" height="124" rx="3" stroke="#1C1C1B" strokeWidth="3" fill="none" />
              {/* Czerwona strzałka kołowa */}
              <path d="M376 34c-19.9 0-36 16.1-36 36s16.1 36 36 36 36-16.1 36-36c0-6.1-1.5-11.8-4.2-16.8" stroke="#D11222" strokeWidth="12" strokeLinecap="round" />
              <path d="M400 37l12 17-19.5 7.5 7.5-24.5z" fill="#D11222" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-black text-emerald-400 tracking-wide leading-tight">PULPIT DYSPOZYTORA</h1>
            <p className="text-[11px] text-slate-400">System zarządzania kontenerami</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="/print"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition"
            title="Drukuj kody QR"
          >
            <Printer className="w-4 h-4 text-emerald-400" />
            <span className="hidden sm:inline">Drukuj QR</span>
          </a>
          <button
            onClick={() => setShowMap(!showMap)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition"
            type="button"
          >
            <Layers className="w-4 h-4 text-emerald-400" />
            <span>{showMap ? 'Ukryj mapę' : 'Pokaż mapę'}</span>
          </button>
          <button
            onClick={fetchContainers}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition"
            title="Odśwież dane"
            type="button"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>

      <div className="mb-6">
        <a
          href="/scan"
          className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-base text-white shadow-lg shadow-emerald-950 transition active:scale-98"
        >
          <QrCode className="w-5 h-5" />
          <span>Przejdź do skanera (Kierowca)</span>
        </a>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'at_client' ? null : 'at_client')}
          className={`p-3 rounded-xl text-center border transition ${
            statusFilter === 'at_client'
              ? 'bg-amber-950/40 border-amber-500 ring-2 ring-amber-500/50'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <span className="text-xs text-slate-400 block mb-1">U klientów</span>
          <span className="text-2xl font-black text-amber-400">{atClientCount}</span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'in_transit' ? null : 'in_transit')}
          className={`p-3 rounded-xl text-center border transition ${
            statusFilter === 'in_transit'
              ? 'bg-indigo-950/40 border-indigo-500 ring-2 ring-indigo-500/50'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <span className="text-xs text-slate-400 block mb-1">W drodze</span>
          <span className="text-2xl font-black text-indigo-400">{inTransitCount}</span>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === 'in_yard' ? null : 'in_yard')}
          className={`p-3 rounded-xl text-center border transition ${
            statusFilter === 'in_yard'
              ? 'bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/50'
              : 'bg-slate-900 border-slate-800 hover:border-slate-700'
          }`}
        >
          <span className="text-xs text-slate-400 block mb-1">Na bazie</span>
          <span className="text-2xl font-black text-emerald-400">{inYardCount}</span>
        </button>
      </div>

      {statusFilter && (
        <div className="mb-4 flex items-center justify-between bg-slate-900/80 border border-slate-800 px-4 py-2 rounded-xl text-xs">
          <span className="text-slate-300 flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-emerald-400" />
            Filtrowanie: <b className="text-white uppercase">{statusFilter}</b>
          </span>
          <button
            onClick={() => setStatusFilter(null)}
            className="text-emerald-400 hover:underline font-semibold"
          >
            Pokaż wszystkie
          </button>
        </div>
      )}

      {showMap && (
        <div className="mb-6 rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 p-2">
          <div className="flex items-center justify-between px-2 py-1 mb-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-400" /> Mapa pozycji kontenerów
            </span>
            <span className="text-[10px] text-slate-500">Kliknij punkt, by zobaczyć szczegóły</span>
          </div>
          <div
            ref={mapRef}
            className="w-full h-80 rounded-xl bg-slate-950 z-0"
            style={{ minHeight: '320px' }}
          />
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Lista kontenerów ({filteredContainers.length})
        </h2>

        {loading && filteredContainers.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">Wczytywanie listy...</div>
        ) : filteredContainers.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm border border-dashed border-slate-800 rounded-2xl">
            Brak kontenerów dla wybranego filtra.
          </div>
        ) : (
          filteredContainers.map((c) => {
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
                    : c.status === 'in_transit'
                    ? 'bg-indigo-950/15 border-indigo-900/40'
                    : 'bg-slate-900/60 border-slate-800/60 opacity-90'
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
                        ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
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

                <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="font-medium truncate max-w-[200px]">
                      {c.status === 'at_client'
                        ? c.clients?.name || 'Klient nieprzypisany'
                        : c.status === 'in_yard'
                        ? 'Baza / Plac'
                        : 'Na samochodzie (w trasie)'}
                    </span>
                  </div>

                  {c.status === 'at_client' && (
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
                      <span>{days} {days === 1 ? 'dzień' : 'dni'}</span>
                    </div>
                  )}

                  {c.status !== 'at_client' && c.current_lat && (
                    <span className="text-[10px] text-slate-500 font-mono">
                      GPS: {c.current_lat.toFixed(4)}, {c.current_lng?.toFixed(4)}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
