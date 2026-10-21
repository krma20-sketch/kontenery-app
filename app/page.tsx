'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { QrCode, Clock, MapPin, AlertTriangle, RefreshCw, Layers } from 'lucide-react';

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

  // Inicjalizacja Leaflet z CDN
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

  // Rysowanie i aktualizacja markerów
  const initMap = () => {
    const L = (window as any).L;
    if (!L || !mapRef.current) return;

    if (!mapInstanceRef.current) {
      // Domyślne wycentrowanie (np. Szczecin / zachodniopomorskie)
      const map = L.map(mapRef.current).setView([53.4285, 14.5528], 11);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;
    }

    renderMarkers();
  };

  const renderMarkers = () => {
    const L = (window as any).L;
    if (!L || !mapInstanceRef.current) return;

    // Usunięcie starych markerów
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const bounds: any[] = [];

    containers.forEach((c) => {
      if (c.current_lat && c.current_lng) {
        const days = getDaysAtClient(c.placed_at);
        let badgeColor = '#10b981'; // na bazie (zielony)
        let statusLabel = 'Na bazie';

        if (c.status === 'at_client') {
          badgeColor = days >= 14 ? '#ef4444' : days >= 7 ? '#f59e0b' : '#3b82f6';
          statusLabel = `U klienta (${days} dni)`;
        } else if (c.status === 'in_transit') {
          badgeColor = '#6366f1';
          statusLabel = 'W transporcie';
        }

        const customIcon = L.divIcon({
          className: 'custom-pin',
          html: `<div style="background-color: ${badgeColor}; width: 22px; height: 22px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.5);"></div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });

        const popupHtml = `
          <div style="color: #0f172a; font-family: sans-serif; min-width: 150px;">
            <div style="font-weight: bold; font-size: 14px; font-family: monospace;">${c.code}</div>
            <div style="font-size: 11px; color: #64748b; text-transform: uppercase;">${c.container_type}</div>
            <hr style="margin: 6px 0; border: none; border-top: 1px solid #e2e8f0;" />
            <div style="font-size: 12px; margin-bottom: 2px;"><b>Status:</b> ${statusLabel}</div>
            ${c.clients?.name ? `<div style="font-size: 12px; margin-bottom: 2px;"><b>Klient:</b> ${c.clients.name}</div>` : ''}
            ${c.status === 'at_client' ? `<div style="font-size: 12px; color: #b45309;"><b>Postój:</b> ${days} dni</div>` : ''}
          </div>
        `;

        const marker = L.marker([c.current_lat, c.current_lng], { icon: customIcon })
          .addTo(mapInstanceRef.current)
          .bindPopup(popupHtml);

        markersRef.current.push(marker);
        bounds.push([c.current_lat, c.current_lng]);
      }
    });

    if (bounds.length > 0) {
      mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  };

  useEffect(() => {
    if (mapInstanceRef.current && (window as any).L) {
      renderMarkers();
    }
  }, [containers]);

  const atClientCount = containers.filter((c) => c.status === 'at_client').length;
  const inTransitCount = containers.filter((c) => c.status === 'in_transit').length;
  const inYardCount = containers.filter((c) => c.status === 'in_yard').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 max-w-4xl mx-auto pb-16">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
        <div>
          <h1 className="text-xl font-black text-emerald-400 tracking-wide">PULPIT DYSPOZYTORA</h1>
          <p className="text-xs text-slate-400">Podgląd floty kontenerów i lokalizacji GPS</p>
        </div>
        <div className="flex items-center gap-2">
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
        <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-center">
          <span className="text-xs text-slate-400 block mb-1">U klientów</span>
          <span className="text-2xl font-black text-amber-400">{atClientCount}</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-center">
          <span className="text-xs text-slate-400 block mb-1">W drodze</span>
          <span className="text-2xl font-black text-indigo-400">{inTransitCount}</span>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-center">
          <span className="text-xs text-slate-400 block mb-1">Na bazie</span>
          <span className="text-2xl font-black text-emerald-400">{inYardCount}</span>
        </div>
      </div>

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
          Wszystkie kontenery ({containers.length})
        </h2>

        {loading && containers.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">Wczytywanie listy...</div>
        ) : containers.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm border border-dashed border-slate-800 rounded-2xl">
            Brak kontenerów w bazie danych.
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
