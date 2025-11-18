import React, { useState, useEffect } from 'react';
import { User, Shield, ShoppingCart, FileText, LogOut, Plus, Database, Server, X, DollarSign, Package } from 'lucide-react';

// API CONFIGURATION
const INVENTORY_API = "http://localhost:8000";
const BILLING_API = "http://localhost:8001";

// --- REUSABLE COMPONENTS ---

const Modal = ({ title, isOpen, onClose, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 modal-backdrop flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up">
        <div className="bg-slate-900 px-6 py-4 flex justify-between items-center">
          <h3 className="text-white font-bold text-lg">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    const role = username.toLowerCase() === 'admin' ? 'Admin' : 'Cashier';
    onLogin({ name: username, role, id: username });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="bg-white p-8 rounded-xl shadow-lg w-96 border border-slate-200">
        <div className="flex justify-center mb-6">
          <div className="bg-blue-600 p-3 rounded-full">
            <Database className="text-white w-8 h-8" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-center text-slate-800 mb-2">MicroStore</h2>
        <p className="text-center text-slate-500 mb-6">Demo App </p>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">Username</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter 'admin' or 'user'"
            />
          </div>
          <button type="submit" className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors">
            Login
          </button>
        </form>
      </div>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState(null);
  const [products, setProducts] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [activeTab, setActiveTab] = useState('inventory');
  const [loading, setLoading] = useState(false);

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSellModalOpen, setIsSellModalOpen] = useState(false);

  // Forms State
  const [addProductForm, setAddProductForm] = useState({ name: '', price: '', stock: '', category: 'Vegetables' });
  const [sellForm, setSellForm] = useState({ customerName: '', productId: '', quantity: 1 });

  // --- API CALLS ---

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${INVENTORY_API}/products/`);
      const data = await res.json();
      setProducts(data);
      // Default select first product for sell form if available
      if (data.length > 0 && !sellForm.productId) {
        setSellForm(prev => ({ ...prev, productId: data[0].id }));
      }
    } catch (err) {
      console.error("Failed to fetch inventory", err);
    }
  };

  const fetchInvoices = async () => {
    try {
      const res = await fetch(`${BILLING_API}/invoices/`);
      const data = await res.json();
      setInvoices(data);
    } catch (err) {
      console.error("Failed to fetch invoices", err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchProducts();
      if (activeTab === 'invoices') fetchInvoices();
    }
  }, [user, activeTab]);

  // --- HANDLERS ---

  const handleLogout = () => {
    setUser(null);
    setActiveTab('inventory');
  };

  const handleAddProductSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // FIX: Ensure numbers are sent as numbers, not strings
      const payload = {
        name: addProductForm.name,
        category: addProductForm.category,
        price: parseFloat(addProductForm.price),
        stock: parseInt(addProductForm.stock)
      };

      const res = await fetch(`${INVENTORY_API}/products/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail ? JSON.stringify(errorData.detail) : "Server Error");
      }

      setAddProductForm({ name: '', price: '', stock: '', category: 'Vegetables' });
      setIsAddModalOpen(false);
      fetchProducts();
      alert("Product Added Successfully");
    } catch (err) {
      console.error(err);
      alert(`Failed to add product: ${err.message}`);
    }
    setLoading(false);
  };

  const handleSellSubmit = async (e) => {
    e.preventDefault();
    if (!sellForm.customerName || !sellForm.productId) return alert("Please fill all fields");
    
    setLoading(true);
    try {
      // FIX: Ensure numbers are sent as numbers
      const payload = {
        product_id: parseInt(sellForm.productId),
        customer_name: sellForm.customerName,
        user_id: user.name,
        quantity: parseInt(sellForm.quantity)
      };

      const res = await fetch(`${INVENTORY_API}/assign/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "Transaction failed");
      }

      alert(`Sold ${sellForm.quantity} items to ${sellForm.customerName}! Invoice generated.`);
      setSellForm({ customerName: '', productId: products[0]?.id || '', quantity: 1 });
      setIsSellModalOpen(false);
      fetchProducts(); // Refresh stock
    } catch (err) {
      alert(`Error processing sale: ${err.message}`);
    }
    setLoading(false);
  };

  if (!user) return <Login onLogin={setUser} />;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-slate-900 text-white shadow-md sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <Server className="w-6 h-6 text-blue-400" />
            <div>
              <h1 className="font-bold text-xl leading-none">Supermarket POS</h1>
              <span className="text-xs text-slate-400">v3.0 • {user.role} Dashboard</span>
            </div>
          </div>
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2 bg-slate-800 px-3 py-1 rounded-full">
              {user.role === 'Admin' ? <Shield size={16} className="text-yellow-400" /> : <User size={16} className="text-green-400" />}
              <span className="text-sm font-medium">{user.name}</span>
            </div>
            <button 
              onClick={handleLogout} 
              className="flex items-center space-x-1 text-red-400 hover:text-red-300 transition-colors border border-slate-700 px-3 py-1 rounded hover:bg-slate-800"
            >
              <span className="text-sm font-medium">Logout</span>
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {/* Navigation Tabs */}
        <div className="flex space-x-1 bg-white p-1 rounded-lg shadow-sm w-fit mb-8 border border-slate-200">
          <button 
            onClick={() => setActiveTab('inventory')} 
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center space-x-2 ${activeTab === 'inventory' ? 'bg-blue-50 text-blue-600 shadow-sm ring-1 ring-blue-200' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <ShoppingCart size={16} /><span>Inventory Management</span>
          </button>
          <button 
            onClick={() => setActiveTab('invoices')} 
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center space-x-2 ${activeTab === 'invoices' ? 'bg-blue-50 text-blue-600 shadow-sm ring-1 ring-blue-200' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <FileText size={16} /><span>Billing History</span>
          </button>
        </div>

        {/* INVENTORY TAB */}
        {activeTab === 'inventory' && (
          <div className="space-y-6">
            {/* Action Bar */}
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-slate-800">Shelf Stock</h2>
              
              <div className="flex space-x-3">
                {/* ADD PRODUCT BUTTON (ADMIN ONLY) */}
                {user.role === 'Admin' && (
                  <button 
                    onClick={() => setIsAddModalOpen(true)}
                    className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg shadow-md transition-all transform hover:scale-105"
                  >
                    <Plus size={18} />
                    <span className="font-medium">Add Item</span>
                  </button>
                )}

                {/* SELL PRODUCT BUTTON (ALL USERS) */}
                <button 
                  onClick={() => setIsSellModalOpen(true)}
                  className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg shadow-md transition-all transform hover:scale-105"
                >
                  <DollarSign size={18} />
                  <span className="font-medium">Checkout</span>
                </button>
              </div>
            </div>

            {/* Data Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 font-semibold">ID</th>
                    <th className="px-6 py-4 font-semibold">Item Name</th>
                    <th className="px-6 py-4 font-semibold">Category</th>
                    <th className="px-6 py-4 font-semibold text-right">Unit Price</th>
                    <th className="px-6 py-4 font-semibold text-center">Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-slate-400 font-mono">#{p.id}</td>
                      <td className="px-6 py-4 font-medium text-slate-700">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-blue-50 rounded text-blue-600">
                            <Package size={16} />
                          </div>
                          <span>{p.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-medium border border-slate-200">
                          {p.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-slate-600 font-mono">${p.price.toFixed(2)}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${p.stock > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {p.stock}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {products.length === 0 && (
                    <tr>
                      <td colSpan="5" className="px-6 py-12 text-center text-slate-400 bg-slate-50">
                        Shelf is empty. Add items to start selling.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* INVOICES TAB */}
        {activeTab === 'invoices' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
             <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-slate-700">Sales History</h3>
                <button onClick={fetchInvoices} className="text-blue-600 text-sm hover:text-blue-800 font-medium">Refresh Data</button>
             </div>
             <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3">Invoice ID</th>
                    <th className="px-6 py-3">Customer</th>
                    <th className="px-6 py-3">Item</th>
                    <th className="px-6 py-3 text-center">Qty</th>
                    <th className="px-6 py-3 text-right">Total Amount</th>
                    <th className="px-6 py-3 text-center">Seller</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <td className="px-6 py-3 text-slate-400 font-mono text-xs">#{inv.id}</td>
                      <td className="px-6 py-3 font-medium text-slate-800">{inv.customer_name}</td>
                      <td className="px-6 py-3 text-slate-600">{inv.product_name}</td>
                      <td className="px-6 py-3 text-center font-bold text-slate-700">{inv.quantity || 1}</td>
                      <td className="px-6 py-3 text-right text-green-600 font-bold font-mono">${(inv.amount || 0).toFixed(2)}</td>
                      <td className="px-6 py-3 text-center text-slate-500 text-xs">{inv.generated_by}</td>
                    </tr>
                  ))}
                  {invoices.length === 0 && <tr><td colSpan="6" className="text-center py-12 text-slate-400">No invoices found.</td></tr>}
                </tbody>
              </table>
          </div>
        )}
      </main>

      {/* --- MODALS --- */}

      {/* ADD PRODUCT MODAL */}
      <Modal title="Add New Item" isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)}>
        <form onSubmit={handleAddProductSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Item Name</label>
            <input 
              type="text" 
              className="w-full border border-slate-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
              value={addProductForm.name} 
              onChange={e => setAddProductForm({...addProductForm, name: e.target.value})} 
              required 
              placeholder="e.g. Organic Apples"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Price ($)</label>
              <input 
                type="number" 
                className="w-full border border-slate-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                value={addProductForm.price} 
                onChange={e => setAddProductForm({...addProductForm, price: e.target.value})} 
                required 
                min="0"
                step="0.01"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Stock Qty</label>
              <input 
                type="number" 
                className="w-full border border-slate-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                value={addProductForm.stock} 
                onChange={e => setAddProductForm({...addProductForm, stock: e.target.value})} 
                required 
                min="1"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Category</label>
            <select 
              className="w-full border border-slate-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              value={addProductForm.category} 
              onChange={e => setAddProductForm({...addProductForm, category: e.target.value})}
            >
              <option value="Vegetables">Vegetables</option>
              <option value="Fruits">Fruits</option>
              <option value="Dairy">Dairy & Eggs</option>
              <option value="Beverages">Beverages</option>
              <option value="Bakery">Bakery</option>
              <option value="Meat">Meat & Seafood</option>
              <option value="Household">Household</option>
              <option value="Snacks">Snacks</option>
            </select>
          </div>
          <div className="pt-2">
            <button disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold shadow-lg transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? 'Saving...' : 'Add to Shelf'}
            </button>
          </div>
        </form>
      </Modal>

      {/* SELL PRODUCT MODAL */}
      <Modal title="Checkout" isOpen={isSellModalOpen} onClose={() => setIsSellModalOpen(false)}>
        <form onSubmit={handleSellSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Customer Name</label>
            <input 
              type="text" 
              className="w-full border border-slate-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-green-500 outline-none" 
              value={sellForm.customerName} 
              onChange={e => setSellForm({...sellForm, customerName: e.target.value})} 
              required 
              placeholder="Customer Name"
              autoFocus
            />
          </div>
          
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Select Item to Scan</label>
            <select 
              className="w-full border border-slate-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-green-500 outline-none bg-white"
              value={sellForm.productId}
              onChange={e => setSellForm({...sellForm, productId: e.target.value})}
              required
            >
              <option value="" disabled>-- Select Item --</option>
              {products.map(p => (
                <option key={p.id} value={p.id} disabled={p.stock <= 0}>
                  {p.name} (${p.price}) {p.stock <= 0 ? '- OUT OF STOCK' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Quantity</label>
            <input 
              type="number" 
              className="w-full border border-slate-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-green-500 outline-none" 
              value={sellForm.quantity} 
              onChange={e => setSellForm({...sellForm, quantity: parseInt(e.target.value) || 1})} 
              required 
              min="1"
              max={products.find(p => p.id == sellForm.productId)?.stock || 99}
            />
            <p className="text-xs text-slate-400 mt-1 text-right">
              Available: {products.find(p => p.id == sellForm.productId)?.stock || 0}
            </p>
          </div>

          <div className="pt-2">
            <button disabled={loading || products.length === 0} className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold shadow-lg transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? 'Processing...' : 'Complete Sale'}
            </button>
          </div>
        </form>
      </Modal>

    </div>
  );
}