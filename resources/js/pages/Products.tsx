import React, { useEffect, useMemo, useState } from 'react';
import { Card, DataTable, Page, Spinner, Banner, TextField, Button, Thumbnail } from '@shopify/polaris';
import axios from 'axios';

interface Product {
  id: string;
  title: string;
  vendor: string;
  productType: string;
  status: string;
  sku?: string | null;
  image?: string | null;
}

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 50;

  // Test data
  const testProducts: Product[] = [
    {
      id: '1',
      title: 'Test Product 1',
      vendor: 'Test Vendor',
      productType: 'T-Shirt',
      status: 'ACTIVE',
    },
    {
      id: '2',
      title: 'Test Product 2',
      vendor: 'Test Vendor',
      productType: 'Hoodie',
      status: 'ACTIVE',
    },
    {
      id: '3',
      title: 'Test Product 3',
      vendor: 'Test Vendor',
      productType: 'Cap',
      status: 'DRAFT',
    },
  ];

  useEffect(() => {
    console.log('Products page loading...');
    
    // Catch SendBeacon errors
    const originalSendBeacon = navigator.sendBeacon;
    navigator.sendBeacon = function(url, data) {
      try {
        return originalSendBeacon.call(this, url, data);
      } catch (error) {
        console.warn('SendBeacon error caught:', error);
        return false;
      }
    };

    axios.get('/api/shopify/products')
      .then(res => {
        console.log('API yanıtı:', res.data);
        if (res.data.success && res.data.products) {
                  console.log('Real Shopify products loaded:', res.data.products.length);
        console.log('Products:', res.data.products);
        setProducts(res.data.products);
        setError(null);
      } else {
        console.log('API failed, using test data');
        setProducts(testProducts);
        setError('Shopify API connection could not be established, showing test data');
      }
    })
    .catch(err => {
      console.error("Error getting products:", err);
      console.log('No Shopify API connection, using test data');
      setProducts(testProducts);
      setError('Shopify API connection could not be established, showing test data');
    })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // Monitor state changes
  useEffect(() => {
    console.log('Products state updated, product count:', products.length);
    console.log('Products:', products);
  }, [products]);

  const filtered = useMemo(() => {
    if (!search) return products;
    const s = search.toLowerCase();
    return products.filter(p =>
      p.title.toLowerCase().includes(s) ||
      p.vendor.toLowerCase().includes(s) ||
      p.productType.toLowerCase().includes(s) ||
      (p.sku ? p.sku.toLowerCase().includes(s) : false)
    );
  }, [products, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage]);

  const rows = paged.map(product => [
    // Thumbnail
    product.image ? (
      <div style={{ width: 40, height: 40 }}>
        <Thumbnail source={product.image} alt={product.title} size="small" />
      </div>
    ) : (
      <div style={{
        width: 40,
        height: 40,
        background: '#f6f6f7',
        borderRadius: 4,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#6d7175',
        fontSize: 10,
      }}>No Image</div>
    ),
    product.title,
    product.sku || 'N/A',
    product.vendor,
    product.productType,
    product.status,
  ]);

  return (
    <Page 
      title="Products"
      backAction={{
        content: 'Back',
        onAction: () => window.location.assign('/google-drive'),
      }}
    >
      {error && (
        <Banner tone="warning" onDismiss={() => setError(null)}>
          <p>{error}</p>
        </Banner>
      )}
      
      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <Spinner accessibilityLabel="Loading" size="large" />
          <p>Loading products...</p>
        </div>
      ) : (
        <Card>
          <div style={{ padding: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <TextField label="Search" labelHidden value={search} onChange={setSearch} placeholder="Search products..." autoComplete="off"/>
              <Button onClick={() => setSearch('')} size="micro">Clear</Button>
            </div>
            <div style={{ fontSize: 12, color: '#6d7175' }}>{filtered.length} results</div>
          </div>
          <DataTable
            columnContentTypes={['text', 'text', 'text', 'text', 'text', 'text']}
            headings={['Image', 'Title', 'SKU', 'Vendor', 'Product Type', 'Status']}
            rows={rows}
          />
          {filtered.length === 0 && (
            <div style={{ padding: '1rem', textAlign: 'center', color: '#666' }}>
              No products found.
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem' }}>
            <Button disabled={currentPage === 1} onClick={() => setPage(p => Math.max(1, p - 1))} size="micro">Previous</Button>
            <div style={{ fontSize: 12, color: '#6d7175' }}>Page {currentPage} / {totalPages}</div>
            <Button disabled={currentPage === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} size="micro">Next</Button>
          </div>
        </Card>
      )}
    </Page>
  );
}
