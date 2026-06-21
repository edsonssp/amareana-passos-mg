export interface Order {
  id: string;
  items: any[];
  total: number;
  deliveryFee: number;
  paymentMethod: string;
  clientInfo: {
    name: string;
    phone: string;
    deliveryType: 'delivery' | 'pickup';
    address: string;
  };
  status: 'pending' | 'preparing' | 'confirmed' | 'shipped' | 'delivered' | 'completed' | 'cancelled';
  deliveryLocation?: {
    lat: number;
    lng: number;
    updatedAt: Date;
  };
  createdAt: string;
  archived?: boolean;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  subcategory?: string;
  price: number;
  description: string;
  image: string;
  active: boolean;
  createdAt: string;
}

export interface AppSettings {
  isStoreOpen: boolean;
  deliveryFee: number;
  minOrder: number;
}

export interface DailyClosing {
  id?: string;
  date: string;
  operator: string;
  totalSales: number;
  completedOrdersCount: number;
  paymentMethods: {
     deliveryPayment: number;
     pix: number;
     card: number;
     others: number;
  };
  createdAt: string;
}
