import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { motion } from 'motion/react';
import { Truck, MapPin, Loader2, Navigation, IceCream } from 'lucide-react';

// Fix for default marker icons in Leaflet with bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Store location (Center of Passos - MG)
const STORE_LOCATION = { lat: -20.7196, lng: -46.6111 }; 

const createCustomIcon = (color: string, iconHtml: string) => {
  return L.divIcon({
    className: 'custom-leaflet-icon',
    html: `
      <div style="background-color: ${color}; width: 40px; height: 40px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); display: flex; align-items: center; justify-content: center; color: white;">
        ${iconHtml}
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
};

const storeIcon = createCustomIcon('#6b21a8', '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7 11 5.3 11.3a1 1 0 0 0 1.4 0L19 11"/><path d="M17 7a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v4h10z"/><path d="M12 5V3"/></svg>');
const driverIcon = createCustomIcon('#e11d48', '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18h2a1 1 0 0 0 1-1v-5h4.5a2 2 0 0 0 1.8-.9l1.5-2.5H15"/><path d="M9 18h2"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>');

interface OrderLiveTrackerProps {
  orderId: string;
}

export const OrderLiveTracker: React.FC<OrderLiveTrackerProps> = ({ orderId }) => {
  const [order, setOrder] = useState<any>(null);
  const [driverLocation, setDriverLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOrderAndLocation = async () => {
    try {
      const res = await axios.get(`/api/orders/${orderId}/track`); 
      setOrder(res.data);
      if (res.data.deliveryLocation) {
        setDriverLocation({ lat: res.data.deliveryLocation.lat, lng: res.data.deliveryLocation.lng });
      } else {
        // Fallback to store location if no tracker yet
        setDriverLocation(STORE_LOCATION);
      }
    } catch (err) {
      console.error("Error fetching order tracking info:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrderAndLocation();
    const interval = setInterval(fetchOrderAndLocation, 8000); // 8s refresh
    return () => clearInterval(interval);
  }, [orderId]);

  if (loading && !driverLocation) {
    return (
      <div className="bg-stone-50 h-72 rounded-[40px] flex flex-col items-center justify-center text-stone-400 mt-6 animate-pulse border-4 border-white shadow-xl">
        <Loader2 className="animate-spin mb-3 text-amarena-red" size={32} />
        <p className="text-xs font-black uppercase tracking-[0.2em]">Conectando ao Satélite...</p>
      </div>
    );
  }

  if (!driverLocation || !order) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-6 overflow-hidden rounded-[40px] border-8 border-white shadow-premium relative bg-stone-100"
    >
      <div className="h-96 w-full z-0 relative">
        <MapContainer 
          center={[driverLocation.lat, driverLocation.lng]} 
          zoom={15} 
          style={{ height: '100%', width: '100%', zIndex: 0 }}
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />
          
          <Marker position={[STORE_LOCATION.lat, STORE_LOCATION.lng]} icon={storeIcon}>
            <Popup>Amarena Sorvetes</Popup>
          </Marker>

          <Marker position={[driverLocation.lat, driverLocation.lng]} icon={driverIcon}>
            <Popup>Entregador</Popup>
          </Marker>

          {/* Simple line between store and driver */}
          {driverLocation.lat !== STORE_LOCATION.lat && (
             <Polyline 
                positions={[
                   [STORE_LOCATION.lat, STORE_LOCATION.lng],
                   [driverLocation.lat, driverLocation.lng]
                ]} 
                color="#e11d48" 
                weight={4} 
                dashArray="10, 10" 
             />
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
           <Navigation size={28} className="animate-pulse" />
        </div>
        <div className="flex items-center gap-5">
           <div className="w-14 h-14 bg-amarena-red/5 rounded-3xl flex items-center justify-center border border-amarena-red/10">
              <Truck size={28} className="text-amarena-red" />
           </div>
           <div>
              <p className="text-[10px] font-black text-stone-400 uppercase tracking-[0.2em] mb-1">Status da Entrega</p>
              <p className="text-base font-bold text-stone-800 leading-tight">
                {order.status === 'shipped' ? 'Seu pedido está em trânsito!' : 'Aguardando início do trajeto.'}
              </p>
              <p className="text-xs text-stone-400 mt-1">{order.status === 'shipped' ? 'Acompanhe no mapa em tempo real.' : 'Preparando para sair.'}</p>
           </div>
        </div>
      </div>
    </motion.div>
  );
};

