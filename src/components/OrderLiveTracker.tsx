import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { motion } from 'motion/react';
import { Truck, MapPin, Loader2, Navigation, AlertTriangle, IceCream, Map as MapIcon } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { renderToStaticMarkup } from 'react-dom/server';

// Fix for default Leaflet icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Store location (Center of Passos - MG)
const STORE_LOCATION = { lat: -20.7196, lng: -46.6111 }; 

const StoreIcon = L.divIcon({
  html: renderToStaticMarkup(
    <div className="p-2 bg-white rounded-full shadow-md border-2 border-amarena-purple flex items-center justify-center w-8 h-8">
      <IceCream size={16} className="text-amarena-purple" />
    </div>
  ),
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const DriverIcon = L.divIcon({
  html: renderToStaticMarkup(
    <div className="relative w-10 h-10 flex items-center justify-center">
      <div className="absolute inset-0 bg-amarena-red/30 rounded-full animate-ping" />
      <div className="p-2 bg-amarena-red rounded-full shadow-lg border-2 border-white z-10 flex items-center justify-center">
        <Truck size={18} className="text-white" />
      </div>
    </div>
  ),
  className: '',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

const DestinationIcon = L.divIcon({
  html: renderToStaticMarkup(
    <div className="p-2 bg-stone-800 rounded-full shadow-md border-2 border-white flex items-center justify-center w-8 h-8">
      <MapPin size={16} className="text-white" />
    </div>
  ),
  className: '',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
});

interface OrderLiveTrackerProps {
  orderId: string;
}

const MapUpdater = ({ center }: { center: { lat: number, lng: number } }) => {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lng], map.getZoom(), { animate: true });
  }, [center, map]);
  return null;
};

export const OrderLiveTracker: React.FC<OrderLiveTrackerProps> = ({ orderId }) => {
  const [order, setOrder] = useState<any>(null);
  const [driverLocation, setDriverLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [destinationLocation, setDestinationLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = onSnapshot(doc(db, 'orders', orderId), async (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setOrder(data);
        if (data.deliveryLocation) {
          setDriverLocation({ lat: data.deliveryLocation.lat, lng: data.deliveryLocation.lng });
        } else {
          setDriverLocation(STORE_LOCATION);
        }

        // Try to geocode destination if we don't have it yet and there is an address
        if (!destinationLocation && data.clientInfo?.address) {
           try {
              const res = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(data.clientInfo.address + ', Passos, MG')}`);
              if (res.data && res.data.length > 0) {
                 setDestinationLocation({ lat: parseFloat(res.data[0].lat), lon: parseFloat(res.data[0].lon) } as any);
              }
           } catch(e) {
              console.warn("Could not geocode address", e);
           }
        }
      }
      setLoading(false);
    }, (err) => {
      console.error("Error fetching order tracking info:", err);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [orderId]);

  if (loading && !driverLocation) {
    return (
      <div className="bg-stone-50 h-72 rounded-[40px] flex flex-col items-center justify-center text-stone-400 mt-6 animate-pulse border-4 border-white shadow-xl">
        <Loader2 className="animate-spin mb-3 text-amarena-red" size={32} />
        <p className="text-xs font-black uppercase tracking-[0.2em]">Conectando à Satélite...</p>
      </div>
    );
  }

  if (!driverLocation || !order) return null;

  // We draw a simple line tracking the route from Store -> Driver -> Destination
  const routePoints = [];
  routePoints.push([STORE_LOCATION.lat, STORE_LOCATION.lng]);
  routePoints.push([driverLocation.lat, driverLocation.lng]);
  if (destinationLocation) {
     routePoints.push([destinationLocation.lat, destinationLocation.lng]);
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-6 overflow-hidden rounded-[40px] border-8 border-white shadow-premium relative bg-stone-100"
    >
      <div className="h-96 w-full relative z-0">
        <MapContainer 
          center={[driverLocation.lat, driverLocation.lng]} 
          zoom={15} 
          style={{ width: '100%', height: '100%' }}
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />
          <MapUpdater center={driverLocation} />
          
          <Marker position={[STORE_LOCATION.lat, STORE_LOCATION.lng]} icon={StoreIcon} />
          
          <Marker position={[driverLocation.lat, driverLocation.lng]} icon={DriverIcon} />

          {destinationLocation && (
             <Marker position={[destinationLocation.lat, destinationLocation.lng]} icon={DestinationIcon} />
          )}

          {routePoints.length > 1 && (
             <Polyline positions={routePoints as any} color="#ef4444" weight={4} dashArray="5, 10" />
          )}
        </MapContainer>
      </div>
      
      <div className="absolute top-4 left-4 right-4 flex flex-col gap-2 pointer-events-none z-10">
        <div className="bg-white/95 backdrop-blur-md px-5 py-2.5 rounded-2xl shadow-xl border border-white flex items-center gap-3 self-start scale-90 origin-top-left">
          <div className="w-2 h-2 bg-amarena-green rounded-full animate-pulse" />
          <span className="text-[10px] font-black uppercase text-stone-800 tracking-widest">Localização Atualizada</span>
        </div>
      </div>

      <div className="bg-white p-6 border-t border-stone-100 relative z-10">
        <div className="absolute -top-12 right-8 p-4 bg-amarena-purple text-white rounded-3xl shadow-2xl flex items-center justify-center">
           <MapIcon size={28} className="animate-pulse" />
        </div>
        <div className="flex items-center gap-5">
           <div className="w-14 h-14 bg-amarena-red/5 rounded-3xl flex items-center justify-center">
              <Truck size={28} className="text-amarena-red" />
           </div>
           <div>
              <p className="text-[10px] font-black text-stone-300 uppercase tracking-[0.2em] mb-1">Status da Entrega</p>
              <p className="text-base font-bold text-stone-800 leading-tight">
                {order.status === 'shipped' ? 'Seu pedido está em trânsito!' : 'Aguardando início do trajeto.'}
              </p>
              <p className="text-xs text-stone-400 mt-1">Estimativa baseada no trânsito atual.</p>
           </div>
        </div>
      </div>
    </motion.div>
  );
};
