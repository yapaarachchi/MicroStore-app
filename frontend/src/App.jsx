import React, { useState, useEffect } from 'react';
import { User, Shield, ShoppingCart, FileText, LogOut, Plus, Database, Server, X, DollarSign, Package, MoreHorizontal, ChevronLeft, ChevronRight } from 'lucide-react';

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

const Pagination = ({ currentPage, totalPages, onPageChange, total }) => {
  if (!total || total === 0) return null;
  
  const pages = [];
  const maxVisible = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let endPage = Math.min(totalPages, startPage + maxVisible - 1);
  
  if (endPage - startPage < maxVisible - 1) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }
  
  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }
  
  return (
    <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-white">
      <div className="text-sm text-slate-600 font-medium">
        Showing page {currentPage} of {totalPages} ({total} total items)
      </div>
      {totalPages > 1 && (
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="p-2 rounded-md border border-slate-300 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          {startPage > 1 && (
            <>
              <button
                onClick={() => onPageChange(1)}
                className="px-3 py-1 rounded-md border border-slate-300 hover:bg-slate-100 transition-colors"
              >
                1
              </button>
              {startPage > 2 && <span className="px-2 text-slate-400">...</span>}
            </>
          )}
          {pages.map(page => (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`px-3 py-1 rounded-md border transition-colors ${
                page === currentPage
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'border-slate-300 hover:bg-slate-100'
              }`}
            >
              {page}
            </button>
          ))}
          {endPage < totalPages && (
            <>
              {endPage < totalPages - 1 && <span className="px-2 text-slate-400">...</span>}
              <button
                onClick={() => onPageChange(totalPages)}
                className="px-3 py-1 rounded-md border border-slate-300 hover:bg-slate-100 transition-colors"
              >
                {totalPages}
              </button>
            </>
          )}
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="p-2 rounded-md border border-slate-300 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
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
  
  // Pagination state
  const [productsPage, setProductsPage] = useState(1);
  const [productsPagination, setProductsPagination] = useState({ total: 0, total_pages: 1, page: 1 });
  const [invoicesPage, setInvoicesPage] = useState(1);
  const [invoicesPagination, setInvoicesPagination] = useState({ total: 0, total_pages: 1, page: 1 });

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSellModalOpen, setIsSellModalOpen] = useState(false);
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // Forms State
  const [addProductForm, setAddProductForm] = useState({ name: '', price: '', stock: '', category: 'Vegetables' });
  const [sellForm, setSellForm] = useState({ customerName: '', items: [{ productId: '', quantity: 1 }] });
  const [restockForm, setRestockForm] = useState({ quantity: 1, notes: '' });
  const [invoiceDetail, setInvoiceDetail] = useState(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [invoiceModalLoading, setInvoiceModalLoading] = useState(false);
  const [restockProduct, setRestockProduct] = useState(null);
  const [restockLoading, setRestockLoading] = useState(false);
  const [historyProduct, setHistoryProduct] = useState(null);
  const [stockHistory, setStockHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [openActionMenu, setOpenActionMenu] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [seedStatus, setSeedStatus] = useState({ status: 'idle', last_error: null });
  const [seedLoading, setSeedLoading] = useState(false);

  const showToast = (message, type = 'info', duration = 3500) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, duration);
  };

  // --- API CALLS ---

  const fetchProducts = async (page = productsPage) => {
    try {
      const res = await fetch(`${INVENTORY_API}/products/?page=${page}&page_size=50`);
      const data = await res.json();
      if (data.items) {
        setProducts(data.items);
        setProductsPagination({
          total: data.total || 0,
          total_pages: data.total_pages || 1,
          page: data.page || 1
        });
        setProductsPage(data.page || 1);
      } else {
        // Fallback for old API format
        const items = Array.isArray(data) ? data : [];
        setProducts(items);
        setProductsPagination({
          total: items.length,
          total_pages: 1,
          page: 1
        });
        setProductsPage(1);
      }
    } catch (err) {
      console.error("Failed to fetch inventory", err);
    }
  };

  const fetchInvoices = async (page = invoicesPage) => {
    try {
      const res = await fetch(`${BILLING_API}/invoices/?page=${page}&page_size=50`);
      const data = await res.json();
      if (data.items) {
        setInvoices(data.items);
        setInvoicesPagination({
          total: data.total || 0,
          total_pages: data.total_pages || 1,
          page: data.page || 1
        });
        setInvoicesPage(data.page || 1);
      } else {
        // Fallback for old API format
        const items = Array.isArray(data) ? data : [];
        setInvoices(items);
        setInvoicesPagination({
          total: items.length,
          total_pages: 1,
          page: 1
        });
        setInvoicesPage(1);
      }
    } catch (err) {
      console.error("Failed to fetch invoices", err);
    }
  };

  const fetchSeedStatus = async () => {
    try {
      const res = await fetch(`${INVENTORY_API}/admin/seed/status`);
      if (!res.ok) {
        // If 404 or 500, set to idle status instead of showing error
        if (res.status === 404 || res.status >= 500) {
          setSeedStatus({ status: 'idle', last_error: null });
          return;
        }
        throw new Error("Unable to get seed status");
      }
      const data = await res.json();
      setSeedStatus(data);
    } catch (err) {
      console.error("Seed status fetch error:", err);
      // Only show error toast for network errors, not for expected cases
      if (err.message && !err.message.includes("Failed to fetch")) {
        setSeedStatus({ status: 'idle', last_error: null });
      } else {
        showToast("Unable to check seed status", "error");
      }
    }
  };

  useEffect(() => {
    if (user) {
      fetchProducts();
      // Redirect non-admins away from invoices tab
      if (activeTab === 'invoices' && user.role !== 'Admin') {
        setActiveTab('inventory');
      } else if (activeTab === 'invoices') {
        fetchInvoices();
      }
      if (user.role === 'Admin') {
        fetchSeedStatus();
      }
    }
  }, [user, activeTab]);

  useEffect(() => {
    if (products.length === 0) return;
    setSellForm(prev => {
      let changed = false;
      const updatedItems = prev.items.map(item => {
        if (item.productId) return item;
        changed = true;
        return { ...item, productId: products[0].id };
      });
      return changed ? { ...prev, items: updatedItems } : prev;
    });
  }, [products]);

  const getProductById = (id) => products.find(p => p.id === Number(id));

  const handleCartItemChange = (index, field, value) => {
    setSellForm(prev => {
      const updatedItems = prev.items.map((item, idx) => idx === index ? { ...item, [field]: value } : item);
      return { ...prev, items: updatedItems };
    });
  };

  const addCartItem = () => {
    setSellForm(prev => ({
      ...prev,
      items: [
        ...prev.items,
        { productId: products[0]?.id || '', quantity: 1 }
      ]
    }));
  };

  const removeCartItem = (index) => {
    setSellForm(prev => {
      if (prev.items.length === 1) return prev;
      return { ...prev, items: prev.items.filter((_, idx) => idx !== index) };
    });
  };

  const handleSeedDemo = async () => {
    setSeedLoading(true);
    try {
      const res = await fetch(`${INVENTORY_API}/admin/seed/run`, {
        method: 'POST'
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Unable to start seeding");
      }
      showToast("Seeding started. This may take a minute.", "info");
      await fetchSeedStatus();
    } catch (err) {
      showToast(err.message, "error");
    }
    setSeedLoading(false);
  };

  const openRestockModal = (product) => {
    setRestockProduct(product);
    setRestockForm({ quantity: 1, notes: '' });
    setIsRestockModalOpen(true);
  };

  const handleRestockSubmit = async (e) => {
    e.preventDefault();
    if (!restockProduct) return;
    const quantity = parseInt(restockForm.quantity);
    if (!quantity || quantity <= 0) {
      showToast("Quantity must be greater than zero", "warning");
      return;
    }

    setRestockLoading(true);
    try {
      const payload = {
        quantity,
        user_id: user.name,
        notes: restockForm.notes || null
      };
      const res = await fetch(`${INVENTORY_API}/products/${restockProduct.id}/restock/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "Failed to restock");
      }
      await fetchProducts();
      showToast(`Added ${quantity} units to ${restockProduct.name}`, "success");
      setIsRestockModalOpen(false);
    } catch (err) {
      showToast(`Restock failed: ${err.message}`, "error");
    }
    setRestockLoading(false);
  };

  const openHistoryModal = async (product) => {
    setHistoryProduct(product);
    setIsHistoryModalOpen(true);
    setHistoryLoading(true);
    setStockHistory([]);
    try {
      const res = await fetch(`${INVENTORY_API}/products/${product.id}/stock-history/`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "Unable to load history");
      }
      const data = await res.json();
      setStockHistory(data);
    } catch (err) {
      showToast(`Failed to load history: ${err.message}`, "error");
      setIsHistoryModalOpen(false);
    }
    setHistoryLoading(false);
  };

  const closeHistoryModal = () => {
    setIsHistoryModalOpen(false);
    setHistoryProduct(null);
    setStockHistory([]);
  };

  // --- HANDLERS ---

  const handleLogout = () => {
    setUser(null);
    setActiveTab('inventory');
  };

  const handleAddProductSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const trimmedName = addProductForm.name.trim();
      if (!trimmedName) {
        showToast("Item name is required", "warning");
        setLoading(false);
        return;
      }
      const duplicate = products.some(
        p => p.name.toLowerCase() === trimmedName.toLowerCase()
      );
      if (duplicate) {
        showToast("This item name already exists", "warning");
        setLoading(false);
        return;
      }

      // FIX: Ensure numbers are sent as numbers, not strings
      const payload = {
        name: trimmedName,
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
      showToast("Product added successfully", "success");
    } catch (err) {
      console.error(err);
      showToast(`Failed to add product: ${err.message}`, "error");
    }
    setLoading(false);
  };

  const handleSellSubmit = async (e) => {
    e.preventDefault();
    if (!sellForm.customerName) {
      showToast("Please enter a customer name", "warning");
      return;
    }

    const payloadItems = sellForm.items
      .filter(item => item.productId)
      .map(item => ({
        product_id: parseInt(item.productId),
        quantity: parseInt(item.quantity) || 1
      }));

    if (payloadItems.length === 0) {
      showToast("Add at least one product to the cart", "warning");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        customer_name: sellForm.customerName,
        user_id: user.name,
        items: payloadItems
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

      showToast(`Sale completed for ${sellForm.customerName}`, "success");
      setSellForm({ customerName: '', items: [{ productId: products[0]?.id || '', quantity: 1 }] });
      setIsSellModalOpen(false);
      fetchProducts(); // Refresh stock
      if (activeTab === 'invoices') fetchInvoices();
    } catch (err) {
      showToast(`Error processing sale: ${err.message}`, "error");
    }
    setLoading(false);
  };

  const openInvoiceDetails = async (invoiceId) => {
    setIsInvoiceModalOpen(true);
    setInvoiceModalLoading(true);
    setInvoiceDetail(null);
    try {
      const res = await fetch(`${BILLING_API}/invoices/${invoiceId}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "Failed to fetch invoice");
      }
      const data = await res.json();
      setInvoiceDetail(data);
    } catch (err) {
      showToast(`Unable to load invoice: ${err.message}`, "error");
      setIsInvoiceModalOpen(false);
    } finally {
      setInvoiceModalLoading(false);
    }
  };

  const closeInvoiceModal = () => {
    setIsInvoiceModalOpen(false);
    setInvoiceDetail(null);
  };

  useEffect(() => {
    const closeMenu = (event) => {
      if (event.defaultPrevented) return;
      setOpenActionMenu(null);
    };
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  useEffect(() => {
    if (user?.role !== 'Admin') return;
    if (seedStatus.status !== 'running') return;
    const interval = setInterval(() => {
      fetchSeedStatus();
    }, 5000);
    return () => clearInterval(interval);
  }, [seedStatus.status, user]);

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
              <span className="text-sm font-medium capitalize text-black">{user.name || 'User'}</span>
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
          {user.role === 'Admin' && (
            <button 
              onClick={() => setActiveTab('invoices')} 
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center space-x-2 ${activeTab === 'invoices' ? 'bg-blue-50 text-blue-600 shadow-sm ring-1 ring-blue-200' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <FileText size={16} /><span>Billing History</span>
            </button>
          )}
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

                  {/* SEED DEMO DATA BUTTON (ADMIN ONLY) */}
                  {user.role === 'Admin' && (
                    <button
                      onClick={handleSeedDemo}
                      disabled={seedLoading || seedStatus.status === 'running' || seedStatus.status === 'completed'}
                      className={`flex items-center space-x-2 px-4 py-2.5 rounded-lg shadow-md border transition-all ${
                        seedStatus.status === 'completed'
                          ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                          : seedStatus.status === 'running'
                          ? 'bg-amber-100 text-amber-700 cursor-wait'
                          : 'bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="font-medium text-sm">
                        {seedStatus.status === 'completed'
                          ? 'Demo Data Seeded'
                          : seedStatus.status === 'running'
                          ? 'Seeding...'
                          : 'Seed Demo Data'}
                      </span>
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
            {user.role === 'Admin' && seedStatus.last_error && (
              <p className="text-sm text-red-500">Seed failed: {seedStatus.last_error}</p>
            )}

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
                    <th className="px-6 py-4 font-semibold text-right">Updated</th>
                    <th className="px-6 py-4 font-semibold text-right">Actions</th>
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
                      <td className="px-6 py-4 text-right text-slate-500 text-xs">
                        {p.updated_at ? new Date(p.updated_at).toLocaleString() : '—'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="relative flex justify-end">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenActionMenu(openActionMenu === p.id ? null : p.id);
                            }}
                            className="p-2 rounded-full hover:bg-slate-100 text-slate-500"
                          >
                            <MoreHorizontal size={18} />
                          </button>
                          {openActionMenu === p.id && (
                            <div 
                              className="absolute right-0 mt-2 w-40 bg-white border border-slate-200 rounded-lg shadow-lg z-10"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openHistoryModal(p);
                                  setOpenActionMenu(null);
                                }}
                                className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
                              >
                                View History
                              </button>
                              {user.role === 'Admin' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openRestockModal(p);
                                    setOpenActionMenu(null);
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
                                >
                                  Restock
                                </button>
                              )}
                            </div>
                          )}
                        </div>
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
            <Pagination
              currentPage={productsPagination.page}
              totalPages={productsPagination.total_pages}
              total={productsPagination.total}
              onPageChange={(page) => {
                setProductsPage(page);
                fetchProducts(page);
              }}
            />
          </div>
        )}

        {/* INVOICES TAB */}
        {activeTab === 'invoices' && user.role === 'Admin' && (
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
                    <th className="px-6 py-3 text-center">Items</th>
                    <th className="px-6 py-3 text-right">Total Amount</th>
                    <th className="px-6 py-3 text-center">Seller</th>
                    <th className="px-6 py-3 text-right">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoices.map(inv => (
                    <tr 
                      key={inv.id} 
                      className="hover:bg-blue-50 transition-colors cursor-pointer"
                      onClick={() => openInvoiceDetails(inv.id)}
                    >
                      <td className="px-6 py-3 text-slate-400 font-mono text-xs">#{inv.id}</td>
                      <td className="px-6 py-3 font-medium text-slate-800">{inv.customer_name}</td>
                      <td className="px-6 py-3 text-center font-bold text-slate-700">{inv.item_count || 0}</td>
                      <td className="px-6 py-3 text-right text-green-600 font-bold font-mono">${(inv.total_amount || 0).toFixed(2)}</td>
                      <td className="px-6 py-3 text-center text-slate-500 text-xs">{inv.generated_by}</td>
                      <td className="px-6 py-3 text-right text-slate-400 text-xs">{new Date(inv.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                  {invoices.length === 0 && <tr><td colSpan="6" className="text-center py-12 text-slate-400">No invoices found.</td></tr>}
                </tbody>
              </table>
              <Pagination
                currentPage={invoicesPagination.page}
                totalPages={invoicesPagination.total_pages}
                total={invoicesPagination.total}
                onPageChange={(page) => {
                  setInvoicesPage(page);
                  fetchInvoices(page);
                }}
              />
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

          <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
            {sellForm.items.map((item, index) => {
              const product = getProductById(item.productId);
              return (
                <div key={index} className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                  <div className="flex justify-between items-center mb-3">
                    <p className="text-xs font-semibold text-slate-500 uppercase">Item {index + 1}</p>
                    {sellForm.items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeCartItem(index)}
                        className="text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Product</label>
                      <select 
                        className="w-full border border-slate-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-green-500 outline-none bg-white"
                        value={item.productId}
                        onChange={e => handleCartItemChange(index, 'productId', e.target.value)}
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
                        value={item.quantity} 
                        onChange={e => handleCartItemChange(index, 'quantity', parseInt(e.target.value) || 1)} 
                        required 
                        min="1"
                        max={product?.stock || 99}
                      />
                      <p className="text-xs text-slate-400 mt-1 text-right">
                        Available: {product?.stock || 0}
                      </p>
                    </div>
                    {product && (
                      <div className="text-xs text-slate-500 bg-white border border-slate-200 rounded-lg px-3 py-2 flex justify-between">
                        <span>{product.category}</span>
                        <span className="font-semibold text-slate-800">${(product.price * item.quantity || 0).toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <button 
            type="button" 
            onClick={addCartItem} 
            className="w-full border border-dashed border-slate-300 text-slate-600 py-2 rounded-lg text-sm hover:bg-slate-50"
            disabled={products.length === 0}
          >
            + Add another product
          </button>

          <div className="pt-2">
            <button disabled={loading || products.length === 0} className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold shadow-lg transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? 'Processing...' : 'Complete Sale'}
            </button>
          </div>
        </form>
      </Modal>

      {/* RESTOCK MODAL */}
      <Modal 
        title={restockProduct ? `Restock ${restockProduct.name}` : "Restock"} 
        isOpen={isRestockModalOpen} 
        onClose={() => setIsRestockModalOpen(false)}
      >
        <form onSubmit={handleRestockSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Quantity to Add</label>
            <input 
              type="number"
              min="1"
              className="w-full border border-slate-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
              value={restockForm.quantity}
              onChange={e => setRestockForm(prev => ({ ...prev, quantity: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Notes (optional)</label>
            <textarea
              className="w-full border border-slate-300 px-3 py-2 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
              rows="3"
              value={restockForm.notes}
              onChange={e => setRestockForm(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="e.g. Supplier delivery batch #42"
            />
          </div>
          <div className="pt-2">
            <button
              type="submit"
              disabled={restockLoading}
              className="w-full bg-amber-400 hover:bg-amber-500 text-black py-3 rounded-lg font-semibold text-sm tracking-wide shadow-lg transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {restockLoading ? 'Updating…' : 'Confirm Restock'}
            </button>
          </div>
        </form>
      </Modal>

      {/* STOCK HISTORY MODAL */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4 py-8" onClick={closeHistoryModal}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col" style={{ maxHeight: '85vh' }} onClick={(e) => e.stopPropagation()}>
            <div className="bg-slate-900 px-6 py-4 flex justify-between items-center flex-shrink-0">
              <h3 className="text-white font-bold text-lg">{historyProduct ? `Stock History • ${historyProduct.name}` : "Stock History"}</h3>
              <button onClick={closeHistoryModal} className="text-slate-400 hover:text-white transition-colors z-10">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 80px)' }}>
              {historyLoading && <p className="text-center text-slate-500">Loading history...</p>}
              {!historyLoading && stockHistory.length === 0 && (
                <p className="text-center text-slate-400">No history records yet.</p>
              )}
              {!historyLoading && stockHistory.length > 0 && (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-100 text-xs uppercase text-slate-500">
                        <tr>
                          <th className="px-4 py-2 text-left sticky top-0 bg-slate-100">When</th>
                          <th className="px-4 py-2 text-left sticky top-0 bg-slate-100">Type</th>
                          <th className="px-4 py-2 text-center sticky top-0 bg-slate-100">Δ Qty</th>
                          <th className="px-4 py-2 text-center sticky top-0 bg-slate-100">Stock</th>
                          <th className="px-4 py-2 text-left sticky top-0 bg-slate-100">By</th>
                          <th className="px-4 py-2 text-left sticky top-0 bg-slate-100">Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {stockHistory.map(entry => (
                          <tr key={entry.id}>
                            <td className="px-4 py-2 text-slate-600 text-xs">
                              {entry.created_at ? new Date(entry.created_at).toLocaleString() : '—'}
                            </td>
                            <td className="px-4 py-2 capitalize font-semibold text-slate-700">
                              {entry.change_type}
                            </td>
                            <td className={`px-4 py-2 text-center font-mono ${entry.quantity_delta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {entry.quantity_delta > 0 ? `+${entry.quantity_delta}` : entry.quantity_delta}
                            </td>
                            <td className="px-4 py-2 text-center text-slate-600 text-xs">
                              {entry.previous_stock} → {entry.new_stock}
                            </td>
                            <td className="px-4 py-2 text-slate-500 text-xs">{entry.created_by || '—'}</td>
                            <td className="px-4 py-2 text-slate-600 text-xs">{entry.notes || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* INVOICE DETAIL MODAL */}
      <Modal title="Invoice Details" isOpen={isInvoiceModalOpen} onClose={closeInvoiceModal}>
        {invoiceModalLoading && <p className="text-center text-slate-500">Loading invoice...</p>}
        {!invoiceModalLoading && invoiceDetail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500 uppercase text-xs font-semibold">Customer</p>
                <p className="font-medium text-slate-800">{invoiceDetail.customer_name}</p>
              </div>
              <div>
                <p className="text-slate-500 uppercase text-xs font-semibold">Cashier</p>
                <p className="font-medium text-slate-800">{invoiceDetail.generated_by}</p>
              </div>
              <div>
                <p className="text-slate-500 uppercase text-xs font-semibold">Invoice ID</p>
                <p className="font-mono text-slate-600">#{invoiceDetail.id}</p>
              </div>
              <div>
                <p className="text-slate-500 uppercase text-xs font-semibold">Date</p>
                <p className="text-slate-700">{new Date(invoiceDetail.created_at).toLocaleString()}</p>
              </div>
            </div>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-2 text-left">Product</th>
                    <th className="px-4 py-2 text-center">Qty</th>
                    <th className="px-4 py-2 text-right">Unit</th>
                    <th className="px-4 py-2 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoiceDetail.items.map(item => (
                    <tr key={item.id}>
                      <td className="px-4 py-2 text-slate-700">{item.product_name}</td>
                      <td className="px-4 py-2 text-center font-semibold text-slate-600">{item.quantity}</td>
                      <td className="px-4 py-2 text-right font-mono text-slate-500">${item.unit_price.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right font-mono text-slate-700">${item.line_total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between items-center text-lg font-bold text-slate-800">
              <span>Total</span>
              <span>${invoiceDetail.total_amount.toFixed(2)}</span>
            </div>
          </div>
        )}
        {!invoiceModalLoading && !invoiceDetail && (
          <p className="text-center text-slate-500">Invoice data unavailable.</p>
        )}
      </Modal>

      {/* TOASTS */}
      <div className="fixed bottom-4 right-4 space-y-3 z-50">
        {toasts.map(toast => {
          const palette = {
            success: 'bg-green-600 text-white border border-green-500',
            error: 'bg-red-600 text-white border border-red-500',
            warning: 'bg-amber-400 text-slate-900 border border-amber-500',
            info: 'bg-slate-700 text-white border border-slate-600'
          };
          return (
            <div
              key={toast.id}
              className={`px-4 py-3 rounded-lg shadow-lg text-sm font-semibold tracking-wide ${palette[toast.type] ?? palette.info}`}
            >
              {toast.message}
            </div>
          );
        })}
      </div>

    </div>
  );
}