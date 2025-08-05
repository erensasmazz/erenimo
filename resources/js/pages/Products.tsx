import React, { useEffect, useState } from 'react';
import { Card, DataTable, Page, Spinner, Banner } from '@shopify/polaris';
import axios from 'axios';

interface Product {
  id: string;
  title: string;
  vendor: string;
  productType: string;
  status: string;
}

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Test verisi
  const testProducts: Product[] = [
    {
      id: '1',
      title: 'Test Ürün 1',
      vendor: 'Test Vendor',
      productType: 'T-Shirt',
      status: 'ACTIVE',
    },
    {
      id: '2',
      title: 'Test Ürün 2',
      vendor: 'Test Vendor',
      productType: 'Hoodie',
      status: 'ACTIVE',
    },
    {
      id: '3',
      title: 'Test Ürün 3',
      vendor: 'Test Vendor',
      productType: 'Cap',
      status: 'DRAFT',
    },
  ];

  useEffect(() => {
    axios.get('/api/shopify/products')
      .then(res => {
        setProducts(res.data.products || []);
      })
      .catch(err => {
        console.error("Ürünler alınırken hata:", err);
        // API başarısız olursa test verisini kullan
        console.log('Shopify API bağlantısı yok, test verisi kullanılıyor');
        setProducts(testProducts);
      })
      .finally(() => setLoading(false));
  }, []);

  const rows = products.map(product => [
    product.title,
    product.vendor,
    product.productType,
    product.status,
  ]);

  return (
    <Page title="Ürün Listesi">
      {error && (
        <Banner tone="critical" onDismiss={() => setError(null)}>
          <p>{error}</p>
        </Banner>
      )}
      
      {loading ? (
        <Spinner accessibilityLabel="Yükleniyor" size="large" />
      ) : (
        <Card>
          <DataTable
            columnContentTypes={['text', 'text', 'text', 'text']}
            headings={['Başlık', 'Tedarikçi', 'Ürün Türü', 'Durum']}
            rows={rows}
          />
        </Card>
      )}
    </Page>
  );
}
