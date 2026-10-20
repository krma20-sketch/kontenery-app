'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, CheckCircle2, MapPin, Truck, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

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
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
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
                const dist = getDistanceMeters(currentCoords.lat, currentCoords.lng, cl