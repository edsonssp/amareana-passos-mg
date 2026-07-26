import React from 'react';
import axios from 'axios';
import { motion } from 'motion/react';
import { Truck, MapPin, CheckCircle, Navigation, Phone, Clock, ChevronRight, Share2, Loader2 } from 'lucide-react';
import { Order } from '../types';
import { OrderLiveTracker } from './OrderLiveTracker';

interface DeliveryConsoleProps {
  orders: Order[];
  onBack: () => void;
  onOrderUpdate: () => void; // callback to trigger a refresh in parent
}

export const DeliveryConsole: React.FC<DeliveryConsoleProps> = ({ orders, onBack, onOrderUpdate }) => {
  const deliveries = orders.filter(o => 
    o.clientInfo?.deliveryType === 'delivery' && 
    ['preparing', 'confirmed', 'shipped'].includes(o.status)
  );

  const sendToDriver = (order: Order) => {
    const driverUrl = `${window.location.origin}/#driver/${order.id}`;
    const text = `*Nova Entrega: ${order.clientInfo?.name}*\n\nEndereço: ${order.clientInfo?.address}\nTelefone: ${order.clientInfo?.phone}\n\nAbra o link abaixo para iniciar a rota:\n${driverUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const completeDelivery = async (orderId: string) => {
    try {
      await axios.patch(`/api/admin/orders/${orderId}`, { status: 'completed' }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('amarena_admin_token')}` }
      });
      onOrderUpdate();
    } catch (err) {
      console.error("Error completing delivery:", err);
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 bg-amarena-purple rounded-2xl text-white shadow-lg">
          <Truck size={28} />
        </div>
        <div>
          <h2 className="text-3xl font-display font-bold text-stone-800 uppercase tracking-tight">Painel de Entregas</h2>
          <p className="text-stone-400 text-sm font-medium">Acompanhe as entregas e envie para os motoboys</p>
        </div>
      </div>

      <div className="space-y-4">
        {deliveries.length === 0 ? (
          <div className="bg-stone-50 rounded-[32px] p-12 text-center border border-dashed border-stone-200">
            <MapPin className="mx-auto text-stone-300 mb-4" size={40} />
            <p className="text-stone-500 font-medium italic">Nenhuma entrega pendente no momento.</p>
          </div>
        ) : (
          deliveries.map(order => (
            <motion.div 
              key={order.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`bg-white rounded-[32px] overflow-hidden border-2 transition-all ${order.status === 'shipped' ? 'border-primary ring-4 ring-primary/10 shadow-xl' : 'border-stone-100 shadow-sm'}`}
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                   <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full font-black uppercase tracking-widest">#{order.id.slice(-4).toUpperCase()}</span>
                        {order.status === 'shipped' && (
                          <span className="flex items-center gap-1 text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-black uppercase tracking-widest animate-pulse">
                            <Truck size={10} /> Em Trânsito
                          </span>
                        )}
                      </div>
                      <h3 className="text-xl font-bold text-stone-800">{order.clientInfo?.name}</h3>
                   </div>
                   <div className="text-right">
                      <p className="text-xs text-stone-400 font-bold mb-1 uppercase">Total</p>
                      <p className="text-xl font-display font-bold text-amarena-red">R$ {order.total.toFixed(2)}</p>
                   </div>
                </div>

                <div className="space-y-3 mb-6 bg-stone-50/50 p-4 rounded-2xl border border-stone-100">
                  <div className="flex gap-3 text-stone-600">
                    <MapPin className="text-primary flex-shrink-0" size={18} />
                    <p className="text-sm font-medium leading-tight">{order.clientInfo?.address}</p>
                  </div>
                  <div className="flex gap-3 text-stone-600">
                    <Phone className="text-amarena-green flex-shrink-0" size={18} />
                    <p className="text-sm font-bold tracking-tight">{order.clientInfo?.phone}</p>
                  </div>
                  <div className="flex gap-3 text-stone-600">
                    <Clock className="text-stone-400 flex-shrink-0" size={18} />
                    <p className="text-xs font-medium">Pedido feito em: {new Date(order.createdAt).toLocaleTimeString()}</p>
                  </div>
                </div>

                <div className="mb-6 animate-in fade-in zoom-in duration-500">
                  <OrderLiveTracker orderId={order.id} />
                </div>

                <div className="flex gap-2 mt-4">
                  {['preparing', 'confirmed'].includes(order.status) ? (
                    <button 
                      onClick={() => sendToDriver(order)}
                      className="flex-1 bg-green-500 text-white p-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-green-600 transition-all shadow-lg active:scale-95"
                    >
                      <Share2 size={20} />
                      Enviar para Entregador
                    </button>
                  ) : order.status === 'shipped' ? (
                    <div className="flex flex-col w-full gap-2">
                      <button 
                        onClick={() => completeDelivery(order.id)}
                        className="w-full bg-amarena-green text-white p-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-amarena-green/90 transition-all shadow-lg active:scale-95"
                      >
                        <CheckCircle size={20} />
                        Finalizar Entrega
                      </button>
                    </div>
                  ) : (
                    <button disabled className="flex-1 bg-stone-100 text-stone-400 p-4 rounded-2xl font-bold flex items-center justify-center gap-2">
                      <Loader2 size={20} className="animate-spin" />
                      Preparando...
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};
