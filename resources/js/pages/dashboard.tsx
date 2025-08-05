import { ProductDataTable } from '@/components/ui/data-table';
import { Head } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import { Page, Card, Layout, Banner, Spinner, Button, Grid, Text, Badge, Thumbnail } from '@shopify/polaris';

interface Product {
    id: number;
    title: string;
    handle: string;
    status: string;
    vendor: string;
    productType: string;
    createdAt: string;
    updatedAt: string;
    description?: string;
    tags?: string;
    images?: Array<{
        id: number;
        src: string;
        alt?: string;
    }>;
    variants?: Array<{
        id: number;
        price: string;
        sku?: string;
        inventory_quantity?: number;
    }>;
}

interface SyncStatus {
    last_sync: string | null;
    total_products: number;
    total_variants: number;
    total_images: number;
}

interface DataTableProps {
    products: Product[];
    loading?: boolean;
}

export default function Dashboard() {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [syncLoading, setSyncLoading] = useState(false);
    const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);

    const testProducts: Product[] = [
        {
            id: 1,
            title: 'Premium Cotton T-Shirt',
            handle: 'premium-cotton-tshirt',
            status: 'ACTIVE',
            vendor: 'Fashion Store',
            productType: 'T-Shirt',
            createdAt: '2025-08-05T12:00:00Z',
            updatedAt: '2025-08-05T12:00:00Z',
            description: 'Yüksek kaliteli pamuktan üretilen rahat ve dayanıklı t-shirt',
            tags: 'pamuk, rahat, premium',
            images: [{ id: 1, src: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=400&fit=crop', alt: 'Premium Cotton T-Shirt' }],
            variants: [{ id: 1, price: '89.99', sku: 'SKU-001', inventory_quantity: 25 }]
        },
        {
            id: 2,
            title: 'Vintage Denim Jacket',
            handle: 'vintage-denim-jacket',
            status: 'ACTIVE',
            vendor: 'Retro Fashion',
            productType: 'Ceket',
            createdAt: '2025-08-05T12:00:00Z',
            updatedAt: '2025-08-05T12:00:00Z',
            description: 'Klasik vintage tarzında denim ceket, her kombinle uyumlu',
            tags: 'vintage, denim, klasik',
            images: [{ id: 2, src: 'https://images.unsplash.com/photo-1544022613-e87ca75a784a?w=400&h=400&fit=crop', alt: 'Vintage Denim Jacket' }],
            variants: [{ id: 2, price: '299.99', sku: 'SKU-002', inventory_quantity: 15 }]
        },
        {
            id: 3,
            title: 'Leather Crossbody Bag',
            handle: 'leather-crossbody-bag',
            status: 'ACTIVE',
            vendor: 'Luxury Bags',
            productType: 'Çanta',
            createdAt: '2025-08-05T12:00:00Z',
            updatedAt: '2025-08-05T12:00:00Z',
            description: 'Gerçek deri malzemeden üretilen şık crossbody çanta',
            tags: 'deri, şık, crossbody',
            images: [{ id: 3, src: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400&h=400&fit=crop', alt: 'Leather Crossbody Bag' }],
            variants: [{ id: 3, price: '199.99', sku: 'SKU-003', inventory_quantity: 8 }]
        },
        {
            id: 4,
            title: 'Wireless Bluetooth Headphones',
            handle: 'wireless-bluetooth-headphones',
            status: 'ACTIVE',
            vendor: 'Tech Gadgets',
            productType: 'Elektronik',
            createdAt: '2025-08-05T12:00:00Z',
            updatedAt: '2025-08-05T12:00:00Z',
            description: 'Yüksek ses kalitesi ve uzun pil ömrü ile kablosuz kulaklık',
            tags: 'bluetooth, kablosuz, ses',
            images: [{ id: 4, src: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop', alt: 'Wireless Bluetooth Headphones' }],
            variants: [{ id: 4, price: '399.99', sku: 'SKU-004', inventory_quantity: 12 }]
        },
        {
            id: 5,
            title: 'Organic Coffee Beans',
            handle: 'organic-coffee-beans',
            status: 'ACTIVE',
            vendor: 'Coffee Masters',
            productType: 'Kahve',
            createdAt: '2025-08-05T12:00:00Z',
            updatedAt: '2025-08-05T12:00:00Z',
            description: 'Organik çiftliklerden toplanan premium kahve çekirdekleri',
            tags: 'organik, kahve, premium',
            images: [{ id: 5, src: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=400&h=400&fit=crop', alt: 'Organic Coffee Beans' }],
            variants: [{ id: 5, price: '79.99', sku: 'SKU-005', inventory_quantity: 30 }]
        },
        {
            id: 6,
            title: 'Smart Fitness Watch',
            handle: 'smart-fitness-watch',
            status: 'ACTIVE',
            vendor: 'Health Tech',
            productType: 'Saat',
            createdAt: '2025-08-05T12:00:00Z',
            updatedAt: '2025-08-05T12:00:00Z',
            description: 'Sağlık takibi ve fitness özellikleri ile akıllı saat',
            tags: 'fitness, akıllı, sağlık',
            images: [{ id: 6, src: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop', alt: 'Smart Fitness Watch' }],
            variants: [{ id: 6, price: '599.99', sku: 'SKU-006', inventory_quantity: 5 }]
        },
        {
            id: 7,
            title: 'Handmade Ceramic Mug',
            handle: 'handmade-ceramic-mug',
            status: 'ACTIVE',
            vendor: 'Artisan Crafts',
            productType: 'Ev Eşyası',
            createdAt: '2025-08-05T12:00:00Z',
            updatedAt: '2025-08-05T12:00:00Z',
            description: 'El yapımı seramik bardak, benzersiz tasarım',
            tags: 'el yapımı, seramik, benzersiz',
            images: [{ id: 7, src: 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=400&h=400&fit=crop', alt: 'Handmade Ceramic Mug' }],
            variants: [{ id: 7, price: '45.99', sku: 'SKU-007', inventory_quantity: 20 }]
        },
        {
            id: 8,
            title: 'Natural Face Cream',
            handle: 'natural-face-cream',
            status: 'ACTIVE',
            vendor: 'Natural Beauty',
            productType: 'Kozmetik',
            createdAt: '2025-08-05T12:00:00Z',
            updatedAt: '2025-08-05T12:00:00Z',
            description: 'Doğal içeriklerle üretilen nemlendirici yüz kremi',
            tags: 'doğal, nemlendirici, kozmetik',
            images: [{ id: 8, src: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=400&h=400&fit=crop', alt: 'Natural Face Cream' }],
            variants: [{ id: 8, price: '129.99', sku: 'SKU-008', inventory_quantity: 18 }]
        }
    ];

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                setLoading(true);
                setError(null);

                const dbResponse = await fetch('/api/sync/status', {
                    headers: {
                        'Accept': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                });
                
                if (dbResponse.ok) {
                    const dbData = await dbResponse.json();
                    if (dbData.success && dbData.data.total_products > 0) {
                        const response = await fetch('/api/sync/products', {
                            headers: {
                                'Accept': 'application/json',
                                'X-Requested-With': 'XMLHttpRequest',
                            },
                        });
                        if (response.ok) {
                            const data = await response.json();
                            setProducts(data.products || []);
                        } else {
                            console.log('Database API başarısız, test verisi kullanılıyor');
                            setProducts(testProducts);
                        }
                    } else {
                        console.log('Database\'de veri yok, test verisi kullanılıyor');
                        setProducts(testProducts);
                    }
                } else {
                    console.log('Status API başarısız, test verisi kullanılıyor');
                    setProducts(testProducts);
                }
            } catch (err) {
                console.log('Hata oluştu, test verisi kullanılıyor:', err);
                setProducts(testProducts);
            } finally {
                setLoading(false);
            }
        };

        const fetchSyncStatus = async () => {
            try {
                const response = await fetch('/api/sync/status', {
                    headers: {
                        'Accept': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                });
                if (response.ok) {
                    const data = await response.json();
                    if (data.success) {
                        setSyncStatus(data.data);
                    }
                }
            } catch (err) {
                console.error('Sync status fetch error:', err);
            }
        };

        fetchProducts();
        fetchSyncStatus();
    }, []);

    const handleSync = async () => {
        console.log('Buton tıklandı!');
        try {
            setSyncLoading(true);
            const response = await fetch('/api/sync/products', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
            });
            const data = await response.json();
            console.log('API response:', data);
            if (data.success) {
                console.log('Senkronizasyon başlatıldı');
                setTimeout(() => {
                    fetch('/api/sync/status')
                        .then(res => res.json())
                        .then(data => {
                            if (data.success) {
                                setSyncStatus(data.data);
                            }
                        });
                }, 5000);
            } else {
                setError(data.message || 'Senkronizasyon başlatılamadı');
            }
        } catch (err) {
            console.error('Sync error:', err);
            setError('Senkronizasyon sırasında hata oluştu');
        } finally {
            setSyncLoading(false);
        }
    };

    const formatPrice = (price: string) => {
        return new Intl.NumberFormat('tr-TR', {
            style: 'currency',
            currency: 'TRY'
        }).format(parseFloat(price));
    };

    return (
        <Page title="Dashboard">
            <Head title="Dashboard" />
            <Layout>
                <Layout.Section>
                    <Card>
                        <div className="p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-semibold mb-2">Senkronizasyon Durumu</h3>
                                    {syncStatus && (
                                        <div className="text-sm text-gray-600">
                                            <p>Son Senkronizasyon: {syncStatus.last_sync ? new Date(syncStatus.last_sync).toLocaleString('tr-TR') : 'Hiç yapılmadı'}</p>
                                            <p>Toplam Ürün: {syncStatus.total_products}</p>
                                            <p>Toplam Varyant: {syncStatus.total_variants}</p>
                                            <p>Toplam Resim: {syncStatus.total_images}</p>
                                        </div>
                                    )}
                                </div>
                                <Button
                                    variant="primary"
                                    loading={syncLoading}
                                    onClick={handleSync}
                                >
                                    {syncLoading ? 'Senkronize Ediliyor...' : 'Manuel Senkronizasyon'}
                                </Button>
                            </div>
                        </div>
                    </Card>
                </Layout.Section>

                {/* Products Section */}
                <Layout.Section>
                    <Card>
                        <div className="p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-semibold">Mağaza Ürünleri</h2>
                                {loading && (
                                    <div className="flex items-center gap-2">
                                        <Spinner size="small" />
                                        <span className="text-sm text-gray-600">Yükleniyor...</span>
                                    </div>
                                )}
                            </div>

                            {error && (
                                <Banner tone="critical" onDismiss={() => setError(null)}>
                                    <p>{error}</p>
                                </Banner>
                            )}

                            {!loading && !error && products.length === 0 && (
                                <Banner tone="info">
                                    <p>Henüz hiç ürün bulunmuyor.</p>
                                </Banner>
                            )}

                            {!loading && !error && products.length > 0 && (
                                <div>
                                    <div className="mb-4">
                                        <Text variant="bodyMd" as="p">
                                            Toplam <strong>{products.length}</strong> ürün bulundu
                                        </Text>
                                    </div>
                                    
                                    <Grid>
                                        {products.map((product) => (
                                            <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 3, xl: 3 }} key={product.id}>
                                                <Card>
                                                    <div className="p-4">
                                                        <div className="mb-3">
                                                            <Thumbnail
                                                                source={product.images?.[0]?.src || 'https://via.placeholder.com/300x300?text=No+Image'}
                                                                alt={product.images?.[0]?.alt || product.title}
                                                                size="large"
                                                            />
                                                        </div>
                                                        
                                                        <div>
                                                            <Text variant="headingMd" as="h3" fontWeight="semibold">
                                                                {product.title}
                                                            </Text>
                                                                                                                         <Text variant="bodySm" as="p">
                                                                 {product.vendor}
                                                             </Text>
                                                        </div>
                                                        
                                                        <div className="flex items-center justify-between">
                                                            <div>
                                                                {product.variants?.[0]?.price && (
                                                                    <Text variant="headingSm" as="p" fontWeight="bold">
                                                                        {formatPrice(product.variants[0].price)}
                                                                    </Text>
                                                                )}
                                                                                                                                     <Text variant="bodySm" as="p">
                                                                         Stok: {product.variants?.[0]?.inventory_quantity || 0}
                                                                     </Text>
                                                            </div>
                                                            <Badge tone={product.status === 'ACTIVE' ? 'success' : 'attention'}>
                                                                {product.status}
                                                            </Badge>
                                                        </div>
                                                        
                                                        {product.tags && (
                                                            <div className="mt-2">
                                                                                                                             <Text variant="bodySm" as="p">
                                                                 {product.tags}
                                                             </Text>
                                                            </div>
                                                        )}
                                                    </div>
                                                </Card>
                                            </Grid.Cell>
                                        ))}
                                    </Grid>
                                </div>
                            )}
                        </div>
                    </Card>
                </Layout.Section>
            </Layout>
        </Page>
    );
}
