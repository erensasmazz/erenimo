import React, { useState, useEffect, useCallback } from 'react';
import { Page, Layout, Card, Button, Text, Thumbnail, Modal, DataTable, Badge, Checkbox, Select, TextField } from '@shopify/polaris';

// Google Picker API için global type declarations
declare global {
    interface Window {
        gapi: any;
        google: any;
    }
}

interface GoogleDriveFile {
    id: string;
    name: string;
    size: string;
    mime_type: string;
    thumbnail: string;
    download_url: string;
    view_url: string;
}

interface ShopifyProduct {
    id: string;
    title: string;
    vendor: string;
    productType: string;
    status: string;
    handle: string;
    description: string;
    sku: string;
    skus: string[];
    image: string | null;
}

interface UploadResult {
    fileName: string;
    sku: string;
    productTitle: string;
    success: boolean;
    error?: string;
    position?: number;
}

interface PickerConfig {
    developerKey: string;
    clientId: string;
    scope: string;
    appId: string;
}

export default function GoogleDrivePage() {
    const [files, setFiles] = useState<GoogleDriveFile[]>([]);
    const [products, setProducts] = useState<ShopifyProduct[]>([]);
    const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showResultsModal, setShowResultsModal] = useState(false);
    const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
    const [folderName, setFolderName] = useState<string>('Tüm Dosyalar');
    const [pickerConfig, setPickerConfig] = useState<PickerConfig | null>(null);
    const [isPickerLoaded, setIsPickerLoaded] = useState(false);
    const [folders, setFolders] = useState<any[]>([]); // Klasör seçici için state
    const [showFolderModal, setShowFolderModal] = useState(false); // Klasör seçici modalı için state
    const [showUploadConfirmation, setShowUploadConfirmation] = useState(false); // Yükleme onayı modal'ı için state
    const [cleanupExisting, setCleanupExisting] = useState(false); // Mevcut görselleri temizleme seçeneği
    const [showUploadHistory, setShowUploadHistory] = useState(false); // Yükleme geçmişi modal'ı için state
    const [uploadHistory, setUploadHistory] = useState<any[]>([]); // Yükleme geçmişi
    const [isLoadingHistory, setIsLoadingHistory] = useState(false); // Yükleme geçmişi yükleniyor
    const [searchTerm, setSearchTerm] = useState(''); // Arama terimi
    const [dateFilter, setDateFilter] = useState(''); // Tarih filtresi (today, week, month, all)
    const [skuFilter, setSkuFilter] = useState(''); // SKU filtresi
    const [statusFilter, setStatusFilter] = useState('all'); // Durum filtresi (all, success, failed)
    const [filteredHistory, setFilteredHistory] = useState<any[]>([]); // Filtrelenmiş geçmiş
    
    // Anasayfa için arama ve filtreleme state'leri
    const [fileSearchTerm, setFileSearchTerm] = useState(''); // Dosya arama terimi
    const [productSearchTerm, setProductSearchTerm] = useState(''); // Ürün arama terimi
    const [fileTypeFilter, setFileTypeFilter] = useState('all'); // Dosya tipi filtresi (all, image, document)
    const [productStatusFilter, setProductStatusFilter] = useState('all'); // Ürün durumu filtresi (all, active, draft)
    const [filteredFiles, setFilteredFiles] = useState<any[]>([]); // Filtrelenmiş dosyalar
    const [filteredProducts, setFilteredProducts] = useState<any[]>([]); // Filtrelenmiş ürünler
    const [showOnlyMatched, setShowOnlyMatched] = useState(false); // Sadece eşleşen dosyaları göster

    // Google Picker API'yi yükle - Artık gerekli değil
    useEffect(() => {
        // Google Picker API deprecated olduğu için sadece config'i yükle
        loadPickerConfig();
    }, []);

    // Google Drive bağlantısını kontrol et
    useEffect(() => {
        checkGoogleDriveSession();
    }, []);

    // Google Drive dosyalarını yükle
    const loadFiles = async () => {
        try {
            setIsLoading(true);
            setError(null);
            
            console.log('Google Drive dosyaları yükleniyor...');
            const response = await fetch('/api/google/files');
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Google Drive files response:', data);
            
            if (data.success) {
                setFiles(data.files);
                setFilteredFiles(data.files); // İlk yüklemede tüm dosyaları göster
                console.log(`${data.files.length} dosya yüklendi`);
            } else {
                setError(data.error || 'Google Drive dosyaları yüklenemedi');
                console.error('API error:', data.error);
            }
        } catch (err) {
            console.error('Google Drive files error:', err);
            const errorMessage = err instanceof Error ? err.message : 'Bilinmeyen hata';
            setError(`Google Drive dosyaları yüklenirken hata oluştu: ${errorMessage}`);
        } finally {
            setIsLoading(false);
        }
    };

    // Shopify ürünlerini yükle
    const loadProducts = async () => {
        try {
            setIsLoading(true);
            setError(null);
            
            console.log('Shopify ürünleri yükleniyor...');
            const response = await fetch('/api/shopify/products');
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Shopify products response:', data);
            
            if (data.success) {
                setProducts(data.products);
                setFilteredProducts(data.products); // İlk yüklemede tüm ürünleri göster
                console.log(`${data.products.length} ürün yüklendi`);
            } else {
                setError(data.error || 'Shopify ürünleri yüklenemedi');
                console.error('API error:', data.error);
            }
        } catch (err) {
            console.error('Shopify products error:', err);
            const errorMessage = err instanceof Error ? err.message : 'Bilinmeyen hata';
            setError(`Shopify ürünleri yüklenirken hata oluştu: ${errorMessage}`);
        } finally {
            setIsLoading(false);
        }
    };

    // Klasör seçildiğinde dosyaları otomatik yükle
    useEffect(() => {
        if (selectedFolder) {
            loadFiles();
        }
    }, [selectedFolder, loadFiles]);

    const loadGooglePickerAPI = async () => {
        // Google Picker API deprecated olduğu için bu fonksiyon artık kullanılmıyor
        console.log('Google Picker API deprecated - alternatif çözüm kullanılıyor');
        loadPickerConfig();
    };

    const initializePicker = () => {
        // Google Picker API deprecated olduğu için bu fonksiyon artık kullanılmıyor
        console.log('Google Picker API deprecated - alternatif çözüm kullanılıyor');
        loadPickerConfig();
    };

    const loadPickerConfig = async () => {
        try {
            const response = await fetch('/api/google/picker-config');
            const data = await response.json();
            
            if (data.success) {
                setPickerConfig(data.config);
            } else {
                console.error('Picker config yüklenemedi:', data.error);
                setError('Picker config yüklenemedi');
            }
        } catch (err) {
            console.error('Picker config yüklenemedi:', err);
            setError('Picker config yüklenemedi');
        }
    };

    const checkGoogleDriveSession = async () => {
        try {
            const response = await fetch('/api/google/auth-url');
            const data = await response.json();
            
            if (!data.success) {
                setError('Google Drive bağlantısı gerekli');
            } else {
                setError(null);
                loadFiles();
                loadProducts();
            }
        } catch (err) {
            setError('Bağlantı hatası');
        }
    };

    const handleGoogleDriveConnect = async () => {
        try {
            const response = await fetch('/api/google/auth-url');
            const data = await response.json();
            
            if (data.success) {
                window.location.href = data.auth_url;
            } else {
                setError('Google Drive bağlantısı oluşturulamadı');
            }
        } catch (err) {
            setError('Google Drive bağlantısı sırasında hata oluştu');
        }
    };

    const handleFileSelection = (fileId: string) => {
        setSelectedFiles(prev => 
            prev.includes(fileId) 
                ? prev.filter(id => id !== fileId)
                : [...prev, fileId]
        );
    };

    const handleFolderPicker = async () => {
        try {
            // Access token'ı al
            const tokenResponse = await fetch('/api/google/access-token');
            const tokenData = await tokenResponse.json();
            
            if (!tokenData.success) {
                setError('Access token alınamadı: ' + (tokenData.error || 'Bilinmeyen hata'));
                return;
            }

            // Google Drive API kullanarak klasörleri listele
            const response = await fetch('/api/google/folders');
            const data = await response.json();
            
            if (data.success) {
                // Klasör seçici modal'ı göster
                setFolders(data.folders);
                setShowFolderModal(true);
            } else {
                setError('Klasörler listelenemedi: ' + (data.error || 'Bilinmeyen hata'));
            }
        } catch (err) {
            console.error('Klasör seçici hatası:', err);
            setError('Klasör seçici açılamadı: ' + (err instanceof Error ? err.message : 'Bilinmeyen hata'));
        }
    };

    const clearFolderSelection = () => {
        setSelectedFolder(null);
        setFolderName('Tüm Dosyalar');
        // loadFiles() artık useEffect ile otomatik çağrılacak
    };

    // SKU-görsel adı otomatik eşleştirme
    const matchFileToProduct = (fileName: string): ShopifyProduct | null => {
        // Dosya uzantısını kaldır
        const nameWithoutExtension = fileName.replace(/\.[^/.]+$/, '');
        
        // ERENIMO-TEST-002 formatını kontrol et
        // ERENIMO-TEST-002-2.jpg -> ERENIMO-TEST-002
        // ERENIMO-TEST-002.jpg -> ERENIMO-TEST-002
        
        // Önce tam eşleşme dene
        let matchedProduct = products.find(product => product.sku === nameWithoutExtension);
        if (matchedProduct) {
            return matchedProduct;
        }
        
        // Sonra tire ile ayrılmış parçaları kontrol et
        const parts = nameWithoutExtension.split('-');
        if (parts.length >= 3) {
            // Son parçayı kontrol et
            const lastPart = parts[parts.length - 1];
            
            // Eğer son parça sayısal ise ve öncesinde de sayısal parça varsa
            if (/^\d+$/.test(lastPart)) {
                // Son parçayı çıkar ve SKU'yu oluştur
                const skuParts = parts.slice(0, -1);
                const sku = skuParts.join('-');
                return products.find(product => product.sku === sku) || null;
            }
        }
        
        // Son olarak regex ile dene
        const skuMatch = nameWithoutExtension.match(/^([A-Z0-9-]+?)(?:-\d+)?$/);
        if (skuMatch) {
            const baseSku = skuMatch[1];
            return products.find(product => product.sku === baseSku) || null;
        }
        
        return null;
    };

    // Dosyaları SKU'ya göre grupla
    const groupFilesBySKU = () => {
        const groupedFiles: { [sku: string]: GoogleDriveFile[] } = {};
        
        files.forEach(file => {
            const matchedProduct = matchFileToProduct(file.name);
            if (matchedProduct && matchedProduct.sku) {
                const sku = matchedProduct.sku;
                if (!groupedFiles[sku]) {
                    groupedFiles[sku] = [];
                }
                groupedFiles[sku].push(file);
            }
        });
        
        return groupedFiles;
    };

    // Dosya boyutunu formatla
    const formatFileSize = (bytes: string) => {
        const size = parseInt(bytes);
        if (size < 1024) return `${size} B`;
        if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
        return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    };

    // Yükleme geçmişini yükle
    const loadUploadHistory = async () => {
        try {
            setIsLoadingHistory(true);
            setError(null); // Önceki hataları temizle
            
            console.log('Yükleme geçmişi yükleniyor...');
            const response = await fetch('/api/shopify/upload-history');
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Yükleme geçmişi response:', data);
            
            if (data.success) {
                setUploadHistory(data.history);
                setFilteredHistory(data.history); // İlk yüklemede tüm verileri göster
                console.log(`${data.history.length} kayıt yüklendi`);
            } else {
                setError(data.error || 'Yükleme geçmişi yüklenemedi');
                console.error('API error:', data.error);
            }
        } catch (err) {
            console.error('Yükleme geçmişi hatası:', err);
            const errorMessage = err instanceof Error ? err.message : 'Bilinmeyen hata';
            setError(`Yükleme geçmişi yüklenirken hata oluştu: ${errorMessage}`);
        } finally {
            setIsLoadingHistory(false);
        }
    };

    // Yükleme geçmişini temizle
    const clearUploadHistory = async () => {
        try {
            const response = await fetch('/api/shopify/upload-history', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                    'Accept': 'application/json'
                }
            });
            
            const data = await response.json();
            
            if (data.success) {
                setUploadHistory([]);
                setFilteredHistory([]);
                setSearchTerm('');
                setDateFilter('');
                setSkuFilter('');
                setStatusFilter('all');
                setFileSearchTerm('');
                setProductSearchTerm('');
                setFileTypeFilter('all');
                setProductStatusFilter('all');
                setShowOnlyMatched(false);
                alert(data.message);
            } else {
                setError(data.error || 'Yükleme geçmişi temizlenemedi');
            }
        } catch (err) {
            setError('Yükleme geçmişi temizlenirken hata oluştu');
        }
    };

    // Yükleme geçmişi modal'ını aç
    const handleShowUploadHistory = async () => {
        setShowUploadHistory(true);
        await loadUploadHistory();
    };

    // Geçmişi filtrele
    const filterHistory = useCallback(() => {
        let filtered = [...uploadHistory];

        // Arama terimi filtresi
        if (searchTerm) {
            filtered = filtered.filter(item => 
                item.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (item.product_title && item.product_title.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (item.sku && item.sku.toLowerCase().includes(searchTerm.toLowerCase()))
            );
        }

        // Tarih filtresi
        if (dateFilter && dateFilter !== 'all') {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
            const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

            filtered = filtered.filter(item => {
                const itemDate = new Date(item.created_at);
                switch (dateFilter) {
                    case 'today':
                        return itemDate >= today;
                    case 'week':
                        return itemDate >= weekAgo;
                    case 'month':
                        return itemDate >= monthAgo;
                    default:
                        return true;
                }
            });
        }

        // SKU filtresi
        if (skuFilter) {
            filtered = filtered.filter(item => 
                item.sku && item.sku.toLowerCase().includes(skuFilter.toLowerCase())
            );
        }

        // Durum filtresi
        if (statusFilter !== 'all') {
            filtered = filtered.filter(item => {
                if (statusFilter === 'success') return item.success;
                if (statusFilter === 'failed') return !item.success;
                return true;
            });
        }

        setFilteredHistory(filtered);
    }, [uploadHistory, searchTerm, dateFilter, skuFilter, statusFilter]);

    // Filtreleme değiştiğinde otomatik filtrele
    useEffect(() => {
        filterHistory();
    }, [filterHistory]);

    // Dosyaları filtrele
    const filterFiles = useCallback(() => {
        let filtered = [...files];

        // Dosya adı arama filtresi
        if (fileSearchTerm) {
            filtered = filtered.filter(file => 
                file.name.toLowerCase().includes(fileSearchTerm.toLowerCase())
            );
        }

        // Dosya tipi filtresi
        if (fileTypeFilter !== 'all') {
            filtered = filtered.filter(file => {
                if (fileTypeFilter === 'image') {
                    return file.mime_type && file.mime_type.startsWith('image/');
                }
                if (fileTypeFilter === 'document') {
                    return file.mime_type && !file.mime_type.startsWith('image/');
                }
                return true;
            });
        }

        // Sadece eşleşen dosyalar filtresi
        if (showOnlyMatched) {
            filtered = filtered.filter(file => {
                const matchedProduct = matchFileToProduct(file.name);
                return matchedProduct !== null;
            });
        }

        setFilteredFiles(filtered);
    }, [files, fileSearchTerm, fileTypeFilter, showOnlyMatched]);

    // Ürünleri filtrele
    const filterProducts = useCallback(() => {
        let filtered = [...products];

        // Ürün adı veya SKU arama filtresi
        if (productSearchTerm) {
            filtered = filtered.filter(product => 
                product.title.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
                (product.sku && product.sku.toLowerCase().includes(productSearchTerm.toLowerCase()))
            );
        }

        // Ürün durumu filtresi
        if (productStatusFilter !== 'all') {
            filtered = filtered.filter(product => {
                if (productStatusFilter === 'active') return product.status === 'ACTIVE';
                if (productStatusFilter === 'draft') return product.status === 'DRAFT';
                return true;
            });
        }

        setFilteredProducts(filtered);
    }, [products, productSearchTerm, productStatusFilter]);

    // Dosya ve ürün filtreleme değiştiğinde otomatik filtrele
    useEffect(() => {
        filterFiles();
    }, [filterFiles]);

    useEffect(() => {
        filterProducts();
    }, [filterProducts]);

    // Otomatik toplu yükleme
    const handleBulkUpload = async () => {
        if (selectedFiles.length === 0) {
            setError('Lütfen yüklenecek dosyaları seçin');
            return;
        }

        // Önce onay modal'ını göster
        setShowUploadConfirmation(true);
    };

    // Gerçek yükleme işlemi
    const confirmBulkUpload = async () => {
        setIsUploading(true);
        setShowUploadConfirmation(false);
        const results: UploadResult[] = [];
        const groupedFiles = groupFilesBySKU();

        // Her SKU grubu için işlem yap
        for (const [sku, skuFiles] of Object.entries(groupedFiles)) {
            const matchedProduct = products.find(product => product.sku === sku);
            if (!matchedProduct) continue;

            // Bu SKU'ya ait seçili dosyaları filtrele
            const selectedSkuFiles = skuFiles.filter(file => selectedFiles.includes(file.id));
            
            if (selectedSkuFiles.length === 0) continue;

            // Eğer cleanup seçiliyse, önce mevcut görselleri sil
            if (cleanupExisting) {
                try {
                    console.log(`Mevcut görseller temizleniyor: ${matchedProduct.title} (${matchedProduct.sku})`);
                    
                    const cleanupResponse = await fetch('/api/shopify/cleanup-images', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                            'Accept': 'application/json'
                        },
                        credentials: 'same-origin',
                        body: JSON.stringify({
                            product_id: matchedProduct.id
                        })
                    });

                    const cleanupData = await cleanupResponse.json();
                    
                    if (cleanupData.success) {
                        console.log(`✅ ${cleanupData.deleted_count} görsel silindi: ${matchedProduct.title}`);
                        results.push({
                            fileName: `Cleanup - ${matchedProduct.title}`,
                            sku: matchedProduct.sku || 'N/A',
                            productTitle: matchedProduct.title,
                            success: true,
                            error: undefined,
                            position: 0
                        });
                    } else {
                        console.error(`❌ Görseller silinemedi: ${matchedProduct.title}`, cleanupData.error);
                        results.push({
                            fileName: `Cleanup - ${matchedProduct.title}`,
                            sku: matchedProduct.sku || 'N/A',
                            productTitle: matchedProduct.title,
                            success: false,
                            error: cleanupData.error || 'Görseller silinemedi',
                            position: 0
                        });
                    }
                } catch (err) {
                    console.error(`❌ Cleanup hatası: ${matchedProduct.title}`, err);
                    results.push({
                        fileName: `Cleanup - ${matchedProduct.title}`,
                        sku: matchedProduct.sku || 'N/A',
                        productTitle: matchedProduct.title,
                        success: false,
                        error: 'Cleanup işlemi sırasında hata oluştu',
                        position: 0
                    });
                }
            }

            // Dosyaları sırayla yükle
            for (let i = 0; i < selectedSkuFiles.length; i++) {
                const file = selectedSkuFiles[i];
                
                try {
                    const response = await fetch('/api/shopify/upload-from-google-drive', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                            'Accept': 'application/json'
                        },
                        credentials: 'same-origin',
                        body: JSON.stringify({
                            product_id: matchedProduct.id,
                            google_drive_file_id: file.id,
                            file_name: file.name,
                            image_position: i + 1, // Görsel pozisyonu
                            sku: matchedProduct.sku || null, // SKU bilgisi
                            product_title: matchedProduct.title || null // Ürün adı
                        })
                    });

                    const data = await response.json();

                    results.push({
                        fileName: file.name,
                        sku: matchedProduct.sku || 'N/A',
                        productTitle: matchedProduct.title,
                        success: data.success,
                        error: data.success ? undefined : (data.error || 'Bilinmeyen hata'),
                        position: i + 1
                    });
                } catch (err) {
                    results.push({
                        fileName: file.name,
                        sku: matchedProduct.sku || 'N/A',
                        productTitle: matchedProduct.title,
                        success: false,
                        error: 'Ağ hatası',
                        position: i + 1
                    });
                }
            }
        }

        // Eşleşmeyen dosyalar için hata ekle
        for (const fileId of selectedFiles) {
            const file = files.find(f => f.id === fileId);
            if (!file) continue;

            const matchedProduct = matchFileToProduct(file.name);
            if (!matchedProduct) {
                results.push({
                    fileName: file.name,
                    sku: 'Eşleşme bulunamadı',
                    productTitle: 'N/A',
                    success: false,
                    error: `SKU eşleşmesi bulunamadı: ${file.name}`
                });
            }
        }

        setUploadResults(results);
        setShowResultsModal(true);
        setIsUploading(false);
        setSelectedFiles([]);
    };

    if (error && error.includes('Google Drive bağlantısı gerekli')) {
        return (
            <Page title="Google Drive Görsel Yükleme">
                <Layout>
                    <Layout.Section>
                        <Card>
                            <div style={{ padding: '2rem', textAlign: 'center' }}>
                                <Text as="h2" variant="headingLg">
                                    Google Drive Bağlantısı Gerekli
                                </Text>
                                <Text as="p" variant="bodyMd">
                                    Görselleri yüklemek için Google Drive hesabınıza bağlanmanız gerekiyor.
                                </Text>
                                <div style={{ marginTop: '1rem' }}>
                                    <Button onClick={handleGoogleDriveConnect}>
                                        Google Drive'a Bağlan
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    </Layout.Section>
                </Layout>
            </Page>
        );
    }

    return (
        <Page title="Google Drive Görsel Yükleme">
            <Layout>
                {/* Google Drive Bağlantısı */}
                <Layout.Section>
                    <Card>
                        <div style={{ padding: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <Text as="p" variant="bodyMd" fontWeight="bold">
                                    🔗 Google Drive Bağlantısı
                                </Text>
                            </div>
                            <Button onClick={handleGoogleDriveConnect} loading={isLoading} size="slim">
                                {pickerConfig ? '✅ Bağlı' : '🔗 Bağlan'}
                            </Button>
                        </div>
                    </Card>
                </Layout.Section>

                {/* Arama ve Filtreleme Bölümü */}
                <Layout.Section>
                    <Card>
                        <div style={{ padding: '0.75rem' }}>
                            <div style={{ marginBottom: '0.75rem' }}>
                                <Text as="h3" variant="headingMd" fontWeight="bold">
                                    🔍 Arama & Filtreleme
                                </Text>
                            </div>
                            
                            {/* Dosya Arama ve Filtreleme */}
                            <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#f6f6f7', borderRadius: '4px' }}>
                                <div style={{ marginBottom: '0.5rem' }}>
                                    <Text as="p" variant="bodyMd" fontWeight="bold">
                                        📁 Dosyalar
                                    </Text>
                                </div>
                                
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                    <TextField
                                        label=""
                                        value={fileSearchTerm}
                                        onChange={setFileSearchTerm}
                                        placeholder="Dosya adı ara..."
                                        clearButton
                                        onClearButtonClick={() => setFileSearchTerm('')}
                                        autoComplete="off"
                                        size="slim"
                                    />
                                    
                                    <Select
                                        label=""
                                        options={[
                                            { label: 'Tümü', value: 'all' },
                                            { label: '🖼️ Resimler', value: 'image' },
                                            { label: '📄 Belgeler', value: 'document' }
                                        ]}
                                        value={fileTypeFilter}
                                        onChange={setFileTypeFilter}
                                    />
                                </div>

                                {/* Sadece Eşleşen Dosyalar Checkbox */}
                                <div style={{ marginBottom: '0.5rem' }}>
                                    <Checkbox
                                        label="Sadece eşleşen dosyalar"
                                        checked={showOnlyMatched}
                                        onChange={setShowOnlyMatched}
                                        helpText="SKU eşleşmesi olan dosyaları göster"
                                    />
                                </div>
                                
                                <div style={{ padding: '0.25rem 0.5rem', backgroundColor: '#fff', borderRadius: '4px', border: '1px solid #e1e3e5' }}>
                                    <Text as="p" variant="bodySm">
                                        📊 <strong>{filteredFiles.length}</strong> dosya
                                        {files.length !== filteredFiles.length && (
                                            <span> (toplam {files.length})</span>
                                        )}
                                        {showOnlyMatched && (
                                            <span style={{ color: '#007cba', fontWeight: 'bold' }}> • Sadece eşleşenler</span>
                                        )}
                                    </Text>
                                </div>
                            </div>

                            {/* Ürün Arama ve Filtreleme */}
                            <div style={{ padding: '0.75rem', backgroundColor: '#f6f6f7', borderRadius: '4px' }}>
                                <div style={{ marginBottom: '0.5rem' }}>
                                    <Text as="p" variant="bodyMd" fontWeight="bold">
                                        🛍️ Ürünler
                                    </Text>
                                </div>
                                
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                    <TextField
                                        label=""
                                        value={productSearchTerm}
                                        onChange={setProductSearchTerm}
                                        placeholder="Ürün adı/SKU ara..."
                                        clearButton
                                        onClearButtonClick={() => setProductSearchTerm('')}
                                        autoComplete="off"
                                        size="slim"
                                    />
                                    
                                    <Select
                                        label=""
                                        options={[
                                            { label: 'Tümü', value: 'all' },
                                            { label: '✅ Aktif', value: 'active' },
                                            { label: '📝 Taslak', value: 'draft' }
                                        ]}
                                        value={productStatusFilter}
                                        onChange={setProductStatusFilter}
                                    />
                                </div>
                                
                                <div style={{ padding: '0.25rem 0.5rem', backgroundColor: '#fff', borderRadius: '4px', border: '1px solid #e1e3e5' }}>
                                    <Text as="p" variant="bodySm">
                                        📊 <strong>{filteredProducts.length}</strong> ürün
                                        {products.length !== filteredProducts.length && (
                                            <span> (toplam {products.length})</span>
                                        )}
                                    </Text>
                                </div>
                            </div>
                        </div>
                    </Card>
                </Layout.Section>

                {/* Dosyaları Listeleme Bölümü */}
                <Layout.Section>
                    <Card>
                        <div style={{ padding: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <Text as="h2" variant="headingLg" fontWeight="bold">
                                    📁 Google Drive Dosyaları
                                </Text>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <div style={{ marginRight: '1rem' }}>
                                        <Checkbox
                                            label="Mevcut görselleri temizle"
                                            checked={cleanupExisting}
                                            onChange={setCleanupExisting}
                                            helpText="Seçili ürünlerin mevcut görsellerini silip yeniden yükle"
                                        />
                                    </div>
                                    <Button onClick={handleFolderPicker}>
                                        📁 Klasör Seç
                                    </Button>
                                    {selectedFolder && (
                                        <Button onClick={clearFolderSelection}>
                                            🗂️ Tüm Dosyalar
                                        </Button>
                                    )}
                                    <Button onClick={loadFiles} loading={isLoading}>
                                        🔄 Yenile
                                    </Button>
                                    <Button onClick={handleShowUploadHistory}>
                                        📊 Geçmiş
                                    </Button>
                                    <Button 
                                        onClick={handleBulkUpload}
                                        disabled={isUploading || selectedFiles.length === 0}
                                        loading={isUploading}
                                    >
                                        Otomatik Yükle
                                    </Button>
                                </div>
                            </div>

                            {selectedFolder && (
                                <div style={{ padding: '0 0 1rem 0' }}>
                                    <Badge tone="info">
                                        {`📁 Seçili Klasör: ${folderName}`}
                                    </Badge>
                                </div>
                            )}

                            {isLoading ? (
                                <div style={{ textAlign: 'center', padding: '2rem' }}>
                                    <Text as="p">Dosyalar yükleniyor...</Text>
                                </div>
                            ) : filteredFiles.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '2rem' }}>
                                    <Text as="p">
                                        {files.length === 0 
                                            ? 'Henüz dosya bulunmuyor.'
                                            : 'Arama kriterlerinize uygun dosya bulunamadı.'
                                        }
                                    </Text>
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                                    {filteredFiles.map(file => {
                                        const matchedProduct = matchFileToProduct(file.name);
                                        const isSelected = selectedFiles.includes(file.id);
                                        
                                        // Aynı SKU'ya ait dosyaları bul
                                        const sameSkuFiles = filteredFiles.filter(f => {
                                            const fProduct = matchFileToProduct(f.name);
                                            return fProduct && fProduct.sku === matchedProduct?.sku;
                                        });
                                        
                                        const fileIndex = sameSkuFiles.findIndex(f => f.id === file.id) + 1;
                                        
                                        return (
                                            <Card key={file.id}>
                                                <div 
                                                    style={{ 
                                                        cursor: 'pointer',
                                                        border: isSelected ? '2px solid #007cba' : '1px solid #e1e3e5',
                                                        borderRadius: '8px',
                                                        padding: '0.5rem',
                                                        backgroundColor: isSelected ? '#f6f6f7' : 'white'
                                                    }}
                                                    onClick={() => handleFileSelection(file.id)}
                                                >
                                                    <Thumbnail
                                                        source={file.thumbnail || 'https://via.placeholder.com/300x300?text=Resim'}
                                                        alt={file.name}
                                                        size="large"
                                                    />
                                                    <div style={{ marginTop: '0.5rem' }}>
                                                        <Text as="p" variant="bodyMd" fontWeight="bold">
                                                            {file.name}
                                                        </Text>
                                                        <Text as="p" variant="bodySm">
                                                            {formatFileSize(file.size)}
                                                        </Text>
                                                        {matchedProduct ? (
                                                            <div>
                                                                <Text as="p" variant="bodySm">
                                                                    ✅ {matchedProduct.title}
                                                                </Text>
                                                                {sameSkuFiles.length > 1 && (
                                                                    <Text as="p" variant="bodySm">
                                                                        📸 {fileIndex}/{sameSkuFiles.length} görsel
                                                                    </Text>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <Text as="p" variant="bodySm">
                                                                ❌ Eşleşme bulunamadı
                                                            </Text>
                                                        )}
                                                    </div>
                                                </div>
                                            </Card>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </Card>
                </Layout.Section>

                {/* Ürünleri Listeleme Bölümü */}
                <Layout.Section>
                    <Card>
                        <div style={{ padding: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <Text as="h2" variant="headingLg" fontWeight="bold">
                                    🛍️ Shopify Ürünleri
                                </Text>
                                <Button onClick={loadProducts} loading={isLoading}>
                                    🔄 Yenile
                                </Button>
                            </div>

                            {isLoading ? (
                                <div style={{ textAlign: 'center', padding: '2rem' }}>
                                    <Text as="p">Ürünler yükleniyor...</Text>
                                </div>
                            ) : filteredProducts.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '2rem' }}>
                                    <Text as="p">
                                        {products.length === 0 
                                            ? 'Henüz ürün bulunmuyor.'
                                            : 'Arama kriterlerinize uygun ürün bulunamadı.'
                                        }
                                    </Text>
                                </div>
                            ) : (
                                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                    {filteredProducts.map((product) => (
                                        <div key={product.id} style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            padding: '0.75rem',
                                            border: '1px solid #e1e3e5',
                                            borderRadius: '4px',
                                            marginBottom: '0.5rem',
                                            backgroundColor: '#fff'
                                        }}>
                                            <div style={{ marginRight: '1rem' }}>
                                                <Thumbnail
                                                    source={product.image || 'https://via.placeholder.com/50x50?text=🛍️'}
                                                    alt={product.title}
                                                    size="small"
                                                />
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <Text as="p" variant="bodyMd" fontWeight="bold">
                                                    {product.title}
                                                </Text>
                                                <Text as="p" variant="bodySm">
                                                    SKU: {product.sku || 'N/A'} | Durum: {product.status}
                                                </Text>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </Card>
                </Layout.Section>
            </Layout>

            <Modal
                open={showResultsModal}
                onClose={() => setShowResultsModal(false)}
                title="Yükleme Sonuçları"
                primaryAction={{
                    content: 'Tamam',
                    onAction: () => setShowResultsModal(false)
                }}
            >
                <Modal.Section>
                    <DataTable
                        columnContentTypes={['text', 'text', 'text', 'text', 'text']}
                        headings={['Dosya Adı', 'SKU', 'Ürün', 'Pozisyon', 'Durum']}
                        rows={uploadResults.map(result => [
                            result.fileName,
                            result.sku,
                            result.productTitle,
                            result.position ? `${result.position}. görsel` : 'N/A',
                            result.success ? '✅ Başarılı' : `❌ ${result.error}`
                        ])}
                    />
                    <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                        <Text as="p" variant="bodyMd">
                            Başarılı: {uploadResults.filter(r => r.success).length}/{uploadResults.length}
                        </Text>
                    </div>
                </Modal.Section>
            </Modal>

            {/* Modern Klasör Seçici Modal - Google Picker API Benzeri */}
            <Modal
                open={showFolderModal}
                onClose={() => setShowFolderModal(false)}
                title="Klasör Seç"
                primaryAction={{
                    content: 'Kapat',
                    onAction: () => setShowFolderModal(false)
                }}
            >
                <Modal.Section>
                    {folders.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem' }}>
                            <Text as="p" variant="bodyMd">
                                📁 Klasör bulunamadı
                            </Text>
                            <Text as="p" variant="bodySm">
                                Google Drive'da klasör oluşturun ve tekrar deneyin.
                            </Text>
                        </div>
                    ) : (
                        <div>
                            <div style={{ marginBottom: '1rem', padding: '0.5rem', backgroundColor: '#f6f6f7', borderRadius: '4px' }}>
                                <Text as="p" variant="bodyMd" fontWeight="bold">
                                    📁 Google Drive Klasörleri
                                </Text>
                                <Text as="p" variant="bodySm">
                                    Klasörünüzü seçin ve içindeki görselleri görüntüleyin
                                </Text>
                            </div>
                            
                            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                                {folders.map((folder) => (
                                    <Card key={folder.id}>
                                        <div 
                                            style={{ 
                                                cursor: 'pointer', 
                                                padding: '1rem',
                                                border: '1px solid #e1e3e5',
                                                borderRadius: '8px',
                                                marginBottom: '0.5rem',
                                                transition: 'all 0.2s ease',
                                                backgroundColor: '#ffffff'
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.backgroundColor = '#f6f6f7';
                                                e.currentTarget.style.borderColor = '#8c9196';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.backgroundColor = '#ffffff';
                                                e.currentTarget.style.borderColor = '#e1e3e5';
                                            }}
                                            onClick={() => {
                                                console.log('Klasör seçildi:', folder.name, folder.id);
                                                setSelectedFolder(folder.id);
                                                setFolderName(folder.name);
                                                setShowFolderModal(false);
                                                // loadFiles() artık useEffect ile otomatik çağrılacak
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <div>
                                                    <Text as="p" variant="bodyMd" fontWeight="bold">
                                                        📁 {folder.name}
                                                    </Text>
                                                    <Text as="p" variant="bodySm">
                                                        Oluşturulma: {new Date(folder.createdTime).toLocaleDateString('tr-TR')}
                                                    </Text>
                                                </div>
                                                <div style={{ color: '#8c9196' }}>
                                                    →
                                                </div>
                                            </div>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                            
                            <div style={{ marginTop: '1rem', padding: '0.5rem', backgroundColor: '#f6f6f7', borderRadius: '4px' }}>
                                <Text as="p" variant="bodySm">
                                    💡 İpucu: Klasöre tıklayarak içindeki görselleri görüntüleyebilirsiniz.
                                </Text>
                            </div>
                        </div>
                    )}
                </Modal.Section>
            </Modal>

            {/* Yükleme Onayı Modal */}
            <Modal
                open={showUploadConfirmation}
                onClose={() => setShowUploadConfirmation(false)}
                title="Otomatik Yükleme Onayı"
                primaryAction={{
                    content: 'Yükle',
                    onAction: confirmBulkUpload,
                    loading: isUploading
                }}
                secondaryActions={[
                    {
                        content: 'İptal',
                        onAction: () => setShowUploadConfirmation(false)
                    }
                ]}
            >
                <Modal.Section>
                    <Text as="p" variant="bodyMd">
                        Seçili dosyalar otomatik olarak ürün SKU'larına göre gruplandırılacak ve ürünlere yüklenecek.
                    </Text>
                    
                    {cleanupExisting && (
                        <div style={{ marginTop: '1rem', padding: '0.5rem', backgroundColor: '#fff1f0', borderRadius: '4px', border: '1px solid #fecaca' }}>
                            <Text as="p" variant="bodySm" fontWeight="bold">
                                ⚠️ Mevcut Görseller Temizlenecek
                            </Text>
                            <Text as="p" variant="bodySm">
                                Seçili ürünlerin mevcut görselleri silinip yeniden yüklenecektir. Bu işlem geri alınamaz!
                            </Text>
                        </div>
                    )}
                    
                    <div style={{ marginTop: '1rem' }}>
                        <Text as="p" variant="bodyMd" fontWeight="bold">
                            Seçili Dosyalar ({selectedFiles.length}):
                        </Text>
                        <div style={{ maxHeight: '200px', overflowY: 'auto', marginTop: '0.5rem' }}>
                            {selectedFiles.map(fileId => {
                                const file = files.find(f => f.id === fileId);
                                const matchedProduct = file ? matchFileToProduct(file.name) : null;
                                
                                return file ? (
                                    <div key={fileId} style={{ 
                                        padding: '0.5rem', 
                                        border: '1px solid #e1e3e5', 
                                        borderRadius: '4px', 
                                        marginBottom: '0.25rem',
                                        backgroundColor: matchedProduct ? '#f6f6f7' : '#fff1f0'
                                    }}>
                                        <Text as="p" variant="bodySm" fontWeight="bold">
                                            {file.name}
                                        </Text>
                                        {matchedProduct ? (
                                            <Text as="p" variant="bodySm">
                                                ✅ {matchedProduct.title} (SKU: {matchedProduct.sku})
                                            </Text>
                                        ) : (
                                            <Text as="p" variant="bodySm">
                                                ❌ Eşleşme bulunamadı
                                            </Text>
                                        )}
                                    </div>
                                ) : null;
                            })}
                        </div>
                    </div>
                    
                    <div style={{ marginTop: '1rem' }}>
                        <Text as="p" variant="bodySm">
                            ⚠️ Bu işlem tüm seçili dosyaların ürünlere yüklenmesini sağlayacaktır.
                        </Text>
                    </div>
                </Modal.Section>
            </Modal>

            {/* Yükleme Geçmişi Modal */}
            <Modal
                open={showUploadHistory}
                onClose={() => setShowUploadHistory(false)}
                title="Yükleme Geçmişi"
                primaryAction={{
                    content: 'Kapat',
                    onAction: () => setShowUploadHistory(false)
                }}
                secondaryActions={[
                    {
                        content: 'Geçmişi Temizle',
                        onAction: clearUploadHistory,
                        destructive: true
                    }
                ]}
            >
                <Modal.Section>
                    {/* Arama ve Filtreleme Bölümü */}
                    <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#f6f6f7', borderRadius: '4px' }}>
                        <div style={{ marginBottom: '0.5rem' }}>
                            <Text as="h3" variant="headingMd" fontWeight="bold">
                                🔍 Arama & Filtreleme
                            </Text>
                        </div>
                        
                        {/* Arama Kutusu */}
                        <div style={{ marginBottom: '0.75rem' }}>
                            <TextField
                                label="Arama"
                                value={searchTerm}
                                onChange={setSearchTerm}
                                placeholder="Dosya adı, ürün adı veya SKU ara..."
                                clearButton
                                onClearButtonClick={() => setSearchTerm('')}
                                autoComplete="off"
                            />
                        </div>

                        {/* Filtreler */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                            {/* Tarih Filtresi */}
                            <Select
                                label="Tarih"
                                options={[
                                    { label: 'Tümü', value: 'all' },
                                    { label: 'Bugün', value: 'today' },
                                    { label: 'Son 7 Gün', value: 'week' },
                                    { label: 'Son 30 Gün', value: 'month' }
                                ]}
                                value={dateFilter}
                                onChange={setDateFilter}
                            />

                            {/* Durum Filtresi */}
                            <Select
                                label="Durum"
                                options={[
                                    { label: 'Tümü', value: 'all' },
                                    { label: '✅ Başarılı', value: 'success' },
                                    { label: '❌ Başarısız', value: 'failed' }
                                ]}
                                value={statusFilter}
                                onChange={setStatusFilter}
                            />
                        </div>

                        {/* SKU Filtresi */}
                        <div style={{ marginTop: '0.75rem' }}>
                            <TextField
                                label="SKU Filtresi"
                                value={skuFilter}
                                onChange={setSkuFilter}
                                placeholder="Belirli bir SKU ara..."
                                clearButton
                                onClearButtonClick={() => setSkuFilter('')}
                                autoComplete="off"
                            />
                        </div>

                        {/* Filtreleme Sonuçları */}
                        <div style={{ marginTop: '0.75rem', padding: '0.5rem', backgroundColor: '#fff', borderRadius: '4px', border: '1px solid #e1e3e5' }}>
                            <Text as="p" variant="bodySm">
                                📊 <strong>{filteredHistory.length}</strong> kayıt bulundu
                                {uploadHistory.length !== filteredHistory.length && (
                                    <span> (toplam {uploadHistory.length} kayıttan)</span>
                                )}
                            </Text>
                        </div>
                    </div>

                    {isLoadingHistory ? (
                        <div style={{ textAlign: 'center', padding: '2rem' }}>
                            <Text as="p">Yükleme geçmişi yükleniyor...</Text>
                        </div>
                    ) : filteredHistory.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem' }}>
                            <Text as="p">
                                {uploadHistory.length === 0 
                                    ? 'Henüz yükleme geçmişi bulunmuyor.'
                                    : 'Arama kriterlerinize uygun kayıt bulunamadı.'
                                }
                            </Text>
                        </div>
                    ) : (
                        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                            {filteredHistory.map((item) => (
                                <div key={item.id} style={{ 
                                    padding: '0.75rem', 
                                    border: '1px solid #e1e3e5', 
                                    borderRadius: '4px', 
                                    marginBottom: '0.5rem',
                                    backgroundColor: item.success ? '#f6f6f7' : '#fff1f0'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div style={{ flex: 1 }}>
                                            <Text as="p" variant="bodyMd" fontWeight="bold">
                                                {item.file_name}
                                            </Text>
                                            <Text as="p" variant="bodySm">
                                                {item.product_title || 'N/A'} {item.sku ? `(SKU: ${item.sku})` : ''}
                                            </Text>
                                            <Text as="p" variant="bodySm">
                                                {item.operation_type === 'upload' ? '📤 Yükleme' : '🧹 Temizleme'} - Pozisyon: {item.position}
                                            </Text>
                                            {item.error && (
                                                <Text as="p" variant="bodySm" tone="critical">
                                                    ❌ {item.error}
                                                </Text>
                                            )}
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <Badge tone={item.success ? 'success' : 'critical'}>
                                                {item.success ? '✅ Başarılı' : '❌ Başarısız'}
                                            </Badge>
                                            <div style={{ marginTop: '0.25rem' }}>
                                                <Text as="p" variant="bodySm">
                                                    {new Date(item.created_at).toLocaleString('tr-TR')}
                                                </Text>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Modal.Section>
            </Modal>

        </Page>
    );
} 