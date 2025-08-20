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
    console.log('Products sayfası yükleniyor...');
    
    // SendBeacon hatalarını yakalamak için
    const originalSendBeacon = navigator.sendBeacon;
    navigator.sendBeacon = function(url, data) {
      try {
        return originalSendBeacon.call(this, url, data);
      } catch (error) {
        console.warn('SendBeacon hatası yakalandı:', error);
        return false;
      }
    };

    axios.get('/api/shopify/products')
      .then(res => {
        console.log('API yanıtı:', res.data);
        if (res.data.success && res.data.products) {
          console.log('Gerçek Shopify ürünleri yüklendi:', res.data.products.length);
          console.log('Ürünler:', res.data.products);
          setProducts(res.data.products);
          setError(null);
        } else {
          console.log('API başarısız, test verisi kullanılıyor');
          setProducts(testProducts);
          setError('Shopify API bağlantısı kurulamadı, test verisi gösteriliyor');
        }
      })
      .catch(err => {
        console.error("Ürünler alınırken hata:", err);
        console.log('Shopify API bağlantısı yok, test verisi kullanılıyor');
        setProducts(testProducts);
        setError('Shopify API bağlantısı kurulamadı, test verisi gösteriliyor');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // State değişikliklerini izle
  useEffect(() => {
    console.log('Products state güncellendi, ürün sayısı:', products.length);
    console.log('Ürünler:', products);
  }, [products]);

  const rows = products.map(product => [
    product.title,
    product.vendor,
    product.productType,
    product.status,
  ]);

  return (
    <Page title="Ürün Listesi">
      {error && (
        <Banner tone="warning" onDismiss={() => setError(null)}>
          <p>{error}</p>
        </Banner>
      )}
      
      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <Spinner accessibilityLabel="Yükleniyor" size="large" />
          <p>Ürünler yükleniyor...</p>
        </div>
      ) : (
        <Card>
          <DataTable
            columnContentTypes={['text', 'text', 'text', 'text']}
            headings={['Başlık', 'Tedarikçi', 'Ürün Türü', 'Durum']}
            rows={rows}
          />
          {products.length === 0 && (
            <div style={{ padding: '1rem', textAlign: 'center', color: '#666' }}>
              Henüz ürün bulunamadı.
            </div>
          )}
        </Card>
      )}
    </Page>
  );
}
