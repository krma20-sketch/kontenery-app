'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, CheckCircle2, MapPin, Truck, ArrowLeft } from 'lucide-react';

interface Client {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  radius_meters: number;
}

interface ContainerData {
  id: string;
  code: string;
  container_type: string;
  status: string;
  current_client_id: string | null;
}

function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dp / 2) * Math.sin(dp / 2) +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export default function DriverScannerPage() {
  const [container, setContainer] = useState<ContainerData | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [matchedClient, setMatchedClient] = useState<Client | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [scannerActive, setScannerActive] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const qrRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    async function initData() {
      const { data } = await supabase.from('clients').select('*');
      if (data) setClients(data);

      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const currentCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            setCoords(currentCoords);

            if (data && data.length > 0) {
              const found = data.find((cl) => {
                if (!cl.lat || !cl.lng) return false;
                const dist = getDistanceMeters(currentCoords.lat, currentCoords.lng, cl.lat, cl.lng);
                return dist <= (cl.radius_meters || 200);
              });
              if (found) {
                setMatchedClient(found);
                setSelectedClientId(found.id);
              }
            }
          },
          (err) => console.log('Błąd GPS:', err.message),
          { enableHighAccuracy: true }
        );
      }
    }
    initData();

    return () => {
      try {
        if (qrRef.current && qrRef.current.isScanning) {
          qrRef.current.stop().catch(() => {});
        }
      } catch (e) {
        // ciche ignorowanie
      }
    };
  }, []);

  const stopScanner = async () => {
    try {
      if (qrRef.current) {
        if (qrRef.current.isScanning) {
          await qrRef.current.stop();
        }
        qrRef.current.clear();
      }
    } catch (e) {
      console.warn('Błąd podczas zatrzymywania kamery:', e);
    } finally {
      setScannerActive(false);
    }
  };

  const goToDashboard = () => {
    // 1. Zatrzymanie strumienia w tle bez czekania na promise
    if (qrRef.current) {
      try {
        if (qrRef.current.isScanning) {
          qrRef.current.stop().catch(() => {});
        }
        qrRef.current.clear();
      } catch (e) {
        // ignoruj
      }
    }
    // 2. Natychmiastowe, twarde przekierowanie pod adres główny
    window.location.assign('/');
  };

  const startScanner = async () => {
    setMessage(null);
    setScannerActive(true);
    try {
      const html5QrCode = new Html5Qrcode('reader');
      qrRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText) => {
          await handleContainerIdentified(decodedText.trim());
          await stopScanner();
        },
        () => {}
      );
    } catch (e) {
      console.error(e);
      setMessage('Nie udało się uruchomić aparatu. Sprawdź uprawnienia w przeglądarce.');
      setScannerActive(false);
    }
  };

  const handleContainerIdentified = async (code: string) => {
    if (!code) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('containers')
      .select('*')
      .eq('code', code)
      .single();

    if (error || !data) {
      setMessage(`Nie znaleziono w bazie kontenera: ${code}`);
      setContainer(null);
    } else {
      setContainer(data);
      setMessage(null);
    }
    setLoading(false);
  };

  const handleCheckIn = async () => {
    if (!container) return;
    setLoading(true);

    const clientId = selectedClientId || matchedClient?.id || null;

    await supabase
      .from('containers')
      .update({
        status: 'at_client',
        current_client_id: clientId,
        current_lat: coords?.lat || null,
        current_lng: coords?.lng || null,
        placed_at: new Date().toISOString(),
      })
      .eq('id', container.id);

    await supabase.from('scan_logs').insert({
      container_id: container.id,
      action: 'check_in',
      client_id: clientId,
      lat: coords?.lat || null,
      lng: coords?.lng || null,
    });

    setMessage(`Zapisano! Kontener ${container.code} postawiony. Timer wystartował.`);
    setContainer(null);
    setManualCode('');
    setLoading(false);
  };

  const handleCheckOut = async () => {
    if (!container) return;
    setLoading(true);

    await supabase
      .from('containers')
      .update({
        status: 'in_transit',
        current_client_id: null,
        current_lat: coords?.lat || null,
        current_lng: coords?.lng || null,
        placed_at: null,
      })
      .eq('id', container.id);

    await supabase.from('scan_logs').insert({
      container_id: container.id,
      action: 'check_out',
      client_id: container.current_client_id,
      lat: coords?.lat || null,
      lng: coords?.lng || null,
    });

    setMessage(`Pobrano kontener ${container.code}! Timer zresetowany. Status: W transporcie.`);
    setContainer(null);
    setManualCode('');
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-4 max-w-lg mx-auto pb-12">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            goToDashboard();
          }}
          className="flex items-center gap-2 text-slate-300 hover:text-white transition px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 active:scale-95 cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5 text-emerald-400" />
          <span className="font-semibold text-sm">Pulpit</span>
        </a>
        <span className="text-sm font-semibold text-emerald-400">Terminal Kierowcy</span>
      </div>

      <div className="mb-4 p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-emerald-400" />
          <span>
            {coords ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : 'Szukanie GPS...'}
          </span>
        </div>
        {matchedClient && (
          <span className="text-emerald-400 font-medium">Blisko: {matchedClient.name}</span>
        )}
      </div>

      {message && (
        <div className="mb-4 p-3 rounded-xl bg-blue-950/60 border border-blue-800 text-blue-200 text-sm">
          {message}
        </div>
      )}

      {!container ? (
        <div className="space-y-4">
          <div
            id="reader"
            className={`w-full overflow-hidden rounded-xl border border-slate-800 bg-black ${
              scannerActive ? 'block min-h-[280px]' : 'hidden'
            }`}
          />

          {!scannerActive ? (
            <button
              onClick={startScanner}
              type="button"
              className="w-full py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-lg text-white flex items-center justify-center gap-3 shadow-lg shadow-emerald-950"
            >
              <Camera className="w-6 h-6" /> Włącz Skaner QR
            </button>
          ) : (
            <button
              onClick={stopScanner}
              type="button"
              className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 font-medium text-slate-200"
            >
              Wyłącz aparat
            </button>
          )}

          <div className="pt-4 border-t border-slate-800">
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Wpisz kod kontenera ręcznie:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="np. KT-001"
                className="flex-1 px-4 py-2.5 rounded-lg bg-slate-900 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleContainerIdentified(manualCode.toUpperCase().trim());
                  }
                }}
              />
              <button
                type="button"
                onClick={() => handleContainerIdentified(manualCode.toUpperCase().trim())}
                className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition"
              >
                Szukaj
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-5 bg-slate-900 border border-slate-800 p-5 rounded-2xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <span className="text-xs text-slate-400 uppercase font-mono">{container.container_type}</span>
              <h2 className="text-2xl font-black font-mono text-emerald-400">{container.code}</h2>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-slate-800 text-slate-300">
              Stan: {container.status}
            </span>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Przypisz lokalizację / klienta:
            </label>
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="">-- Wybierz klienta z listy --</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3 pt-2">
            <button
              onClick={handleCheckIn}
              disabled={loading}
              type="button"
              className="w-full py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-white flex items-center justify-center gap-2 shadow-lg shadow-emerald-950"
            >
              <CheckCircle2 className="w-5 h-5" /> Zostawiam u klienta (Start)
            </button>

            <button
              onClick={handleCheckOut}
              disabled={loading}
              type="button"
              className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-white flex items-center justify-center gap-2 shadow-lg shadow-blue-950"
            >
              <Truck className="w-5 h-5" /> Zabieram kontener (Reset)
            </button>

            <button
              onClick={() => {
                setContainer(null);
                setManualCode('');
              }}
              type="button"
              className="w-full py-2.5 rounded-lg bg-transparent hover:bg-slate-800 text-slate-400 text-sm font-medium"
            >
              Anuluj
            </button>
          </div>
        </div>
      )}
    </main>
  );
}