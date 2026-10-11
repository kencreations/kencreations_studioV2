import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Routes, Route } from 'react-router-dom';
import CustomerStorefront from '../../src/pages/bazaar/storefront/CustomerStorefront';
import ProductCustomizer from '../../src/pages/bazaar/storefront/ProductCustomizer';
import CustomerCheckout from '../../src/pages/bazaar/storefront/CustomerCheckout';
import CustomerCart from '../../src/pages/bazaar/storefront/CustomerCart';
import '../../src/index.css';
createRoot(document.getElementById('root')).render(<HashRouter><div className="bg-amber-100 p-2 text-center text-xs">Local deterministic test fixture — no real shop or orders</div><Routes><Route path="/bazaar/e/:eventId" element={<CustomerStorefront/>}/><Route path="/shop/:shopSlug/product/:productId" element={<ProductCustomizer/>}/><Route path="/shop/:shopSlug/cart" element={<CustomerCart/>}/><Route path="/shop/:shopSlug/checkout" element={<CustomerCheckout/>}/></Routes></HashRouter>);
