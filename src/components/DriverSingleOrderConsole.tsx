import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { motion } from 'motion/react';
import { Truck, MapPin, CheckCircle, Navigation, Phone, Clock, X, Loader2 } from 'lucide-react';
import { OrderLiveTracker } from './OrderLiveTracker';

interface DriverSingleOrderConsoleProps {
  orderId: string;
  onClose: () => void;
}

export const DriverSingleOrderConsole: React.FC<DriverSingleOrderConsoleProps> = ({ orderId, onClose }) => {
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isDelivering, setIsDelivering] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  const fetchOrder = async () => {
    try {
      const res = await axios.get(`/api/orders/${orderId}/track`);
      setOrder(res.data);
      if (res.data.status === 'shipped') {
        setIsDelivering(true);
      }
    } catch (err) {
      console.error("Error fetching order:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
    const interval = setInterval(fetchOrder, 15000); // 15s refresh
    return () => clearInterval(interval);
  }, [orderId]);

  const updateLocation = async (lat: number, lng: number) => {
    try {
      await axios.patch(`/api/driver/orders/${orderId}/location`, { lat, lng });
    } catch (err) {
      console.error("Error updating location:", err);
    }
  };

  const startDelivery = () => {
    setIsDelivering(true);
    
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        updateLocation(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => console.error("Geolocation error:", err),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );

    axios.patch(`/api/driver/orders/${orderId}/status`, { status: 'shipped' }).then(fetchOrder);
  };

  const completeDelivery = async () => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsDelivering(false);

    try {
      if (!confirm("Finalizar a entrega para este pedido?")) return;
      await axios.patch(`/api/driver/orders/${orderId}/status`, { status: 'completed' });
      fetchOrder();
      alert("Entrega Finalizada!");
      onClose(); // go back
    } catch (err) {
      console.error("Error completing delivery:", err);
    }
  };
  
  useEffect(() => {
    return () => {
      // Clear watch on unmount
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  if (loading || !order) {
    return (
      <div className="fixed inset-0 z-[100] bg-stone-50 flex flex-col items-center justify-center text-stone-400">
        <Loader2 className="animate-spin mb-4" size={48} />
        <p>Carregando pedido...</p>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-stone-50 flex flex-col"
    >
      <div className="p-6 bg-white border-b border-stone-100 flex items-center justify-between shadow-sm relative z-20">
        <div className="flex items-center gap-3">
            <div className="bg-stone-800 p-2.5 rounded-2xl text-white shadow-lg"><Truck size={24} /></div>
            <div>
              <h2 className="font-brand text-2xl text-stone-800 italic">Amarena Driver</h2>
              <p className="text-[10px] text-stone-400 font-bold tracking-widest uppercase">Console do Entregador</p>
            </div>
        </div>
        <button onClick={onClose} className="p-3 bg-stone-50 text-stone-600 rounded-2xl hover:bg-stone-100 transition-all border border-stone-200">
            <X size={24} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 w-full">
        <div className="max-w-xl mx-auto space-y-6">
          <div className="bg-white rounded-[32px] overflow-hidden border-2 border-primary ring-4 ring-primary/10 shadow-xl">
             <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                   <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[12px] bg-stone-100 text-stone-500 px-3 py-1 rounded-full font-black uppercase tracking-widest">#{order.id.slice(-4).toUpperCase()}</span>
                        {isDelivering && (
                          <span className="flex items-center gap-1 text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-black uppercase tracking-widest animate-pulse">
                            <Truck size={10} /> Em Trânsito
                          </span>
                        )}
                      </div>
                      <h3 className="text-2xl font-bold text-stone-800 mt-2">{order.clientInfo?.name}</h3>
                   </div>
                   <div className="text-right">
                      <p className="text-xs text-stone-400 font-bold mb-1 uppercase">Total a Receber</p>
                      <p className="text-2xl font-display font-bold text-amarena-green">R$ {order.total?.toFixed(2)}</p>
                   </div>
                </div>

                <div className="space-y-3 mb-6 bg-stone-50/50 p-5 rounded-2xl border border-stone-100">
                  <div className="flex gap-4 text-stone-600 items-start">
                    <MapPin className="text-primary flex-shrink-0 mt-0.5" size={20} />
                    <p className="text-sm font-bold leading-relaxed">{order.clientInfo?.address}</p>
                  </div>
                  <div className="flex gap-4 text-stone-600 items-center">
                    <Phone className="text-amarena-green flex-shrink-0" size={20} />
                    <p className="text-lg font-bold tracking-tight">{order.clientInfo?.phone}</p>
                  </div>
                  <div className="flex gap-4 text-stone-600 items-center">
                    <Clock className="text-stone-400 flex-shrink-0" size={20} />
                    <p className="text-xs font-medium">Pedido: {new Date(order.createdAt).toLocaleTimeString()}</p>
                  </div>
                </div>

                {isDelivering && (
                  <div className="mb-6 animate-in fade-in zoom-in duration-500 rounded-3xl overflow-hidden border border-stone-200">
                    <OrderLiveTracker orderId={order.id} />
                  </div>
                )}

                <div className="flex flex-col gap-3">
                  {!isDelivering && order.status !== 'completed' && order.status !== 'cancelled' ? (
                    <button 
                      onClick={startDelivery}
                      className="w-full bg-primary text-white p-5 rounded-[24px] font-bold text-lg flex items-center justify-center gap-3 hover:bg-primary/90 transition-all shadow-lg active:scale-95"
                    >
                      <Navigation size={24} />
                      Iniciar Rota de Entrega
                    </button>
                  ) : isDelivering ? (
                    <>
                      <button 
                        onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(order.clientInfo.address)}`, '_blank')}
                        className="w-full bg-stone-800 text-white p-5 rounded-[24px] font-bold text-lg flex items-center justify-center gap-3 hover:bg-stone-900 transition-all shadow-md"
                      >
                        <Navigation size={24} />
                        Abrir no GPS Externo
                      </button>
                      <button 
                        onClick={completeDelivery}
                        className="w-full bg-amarena-green text-white p-5 rounded-[24px] font-bold text-lg flex items-center justify-center gap-3 hover:bg-amarena-green/90 transition-all shadow-lg active:scale-95 mt-2"
                      >
                        <CheckCircle size={24} />
                        Confirmar Entrega Realizada
                      </button>
                    </>
                  ) : order.status === 'completed' ? (
                     <div className="p-4 bg-amarena-green/10 text-amarena-green rounded-[24px] flex justify-center items-center gap-2 font-bold">
                        <CheckCircle /> Entrega concluída com sucesso.
                     </div>
                  ) : (
                     <div className="p-4 bg-red-100 text-red-600 rounded-[24px] flex justify-center items-center font-bold">
                        Pedido Cancelado.
                     </div>
                  )}
                </div>
             </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
