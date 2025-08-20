import React, { useState, useEffect, useCallback } from 'react';
import { Page, Layout, Card, Button, Text, Thumbnail, Modal, DataTable, Badge, TextField, Checkbox } from '@shopify/polaris';

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
    const [folderName, setFolderName] = useState<string>('All Files');
    const [pickerConfig, setPickerConfig] = useState<PickerConfig | null>(null);
    const [isPickerLoaded, setIsPickerLoaded] = useState(false);
    const [folders, setFolders] = useState<any[]>([]); // Klasör seçici için state
    const [showFolderModal, setShowFolderModal] = useState(false); // Klasör seçici modalı için state
    
    // Yeni state'ler - Arama ve filtreleme için
    const [fileSearchTerm, setFileSearchTerm] = useState('');
    const [productSearchTerm, setProductSearchTerm] = useState('');
    const [showOnlyMatchingFiles, setShowOnlyMatchingFiles] = useState(false);
    const [clearExistingImages, setClearExistingImages] = useState(false);
    
    // Upload Job Progress için yeni state'ler
    const [showUploadJobPage, setShowUploadJobPage] = useState(false);
    const [showMatchingResultsPage, setShowMatchingResultsPage] = useState(false);
    const [uploadJobId, setUploadJobId] = useState<string>('');
    const [uploadProgress, setUploadProgress] = useState(0);
    const [totalImages, setTotalImages] = useState(0);
    const [uploadedImages, setUploadedImages] = useState(0);
    const [uploadLogs, setUploadLogs] = useState<string[]>([]);
    const [isUploadJobRunning, setIsUploadJobRunning] = useState(false);
    const [uploadJobDetails, setUploadJobDetails] = useState({
        folderName: '',
        matchingType: 'Match by exact SKU',
        replaceExisting: false,
        totalImagesInFolder: 0,
        selectedImages: 0,
        matchedImages: 0,
        nonMatchedImages: 0
    });
    const [matchedImagesList, setMatchedImagesList] = useState<any[]>([]);

    // Google Picker API'yi yükle - Artık gerekli değil
    useEffect(() => {
        // Google Picker API deprecated olduğu için sadece config'i yükle
        loadPickerConfig();
    }, []);

    // Google Drive bağlantısını kontrol et
    useEffect(() => {
        checkGoogleDriveSession();
    }, []);

    const loadFiles = useCallback(async () => {
        try {
            setIsLoading(true);
            
            // URL ve parametreleri hazırla
            let url = '/api/google/files';
            
            // Eğer klasör seçiliyse, klasör ID'sini query parameter olarak ekle
            if (selectedFolder) {
                url += `?folder_id=${encodeURIComponent(selectedFolder)}`;
            }
            
            console.log('Dosyalar yükleniyor:', { url, selectedFolder, folderName });
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                    'Accept': 'application/json'
                }
            });

            const data = await response.json();
            
            if (data.success) {
                setFiles(data.files);
                console.log(`Files loaded: ${data.files.length} files, folder: ${selectedFolder || 'All Files'}`);
                console.log('Dosya isimleri:', data.files.map((f: any) => f.name));
            } else {
                setError(data.error || 'Dosyalar yüklenemedi');
            }
        } catch (err) {
            console.error('Dosyalar yüklenirken hata:', err);
            setError('Dosyalar yüklenirken hata oluştu');
        } finally {
            setIsLoading(false);
        }
    }, [selectedFolder, folderName]);

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

    const loadProducts = async () => {
        try {
            const response = await fetch('/api/shopify/products');
            const data = await response.json();
            
            if (data.success) {
                setProducts(data.products);
            } else {
                setError(data.error || 'Ürünler yüklenemedi');
            }
        } catch (err) {
            setError('Ürünler yüklenirken hata oluştu');
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
                        setFolderName('All Files');
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

    // Filtrelenmiş dosyaları getir
    const getFilteredFiles = () => {
        let filteredFiles = files;

        // Dosya adı araması
        if (fileSearchTerm) {
            filteredFiles = filteredFiles.filter(file => 
                file.name.toLowerCase().includes(fileSearchTerm.toLowerCase())
            );
        }

        // Sadece eşleşen dosyaları göster
        if (showOnlyMatchingFiles) {
            filteredFiles = filteredFiles.filter(file => matchFileToProduct(file.name));
        }

        return filteredFiles;
    };

    // Dosyanın eşleşme durumunu kontrol eden fonksiyon
    const checkFileMatch = (file: GoogleDriveFile) => {
        return matchFileToProduct(file.name) !== null;
    };

    // Filtrelenmiş ürünleri getir
    const getFilteredProducts = () => {
        let filteredProducts = products;

        // Ürün adı/SKU araması
        if (productSearchTerm) {
            filteredProducts = filteredProducts.filter(product => 
                product.title.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
                (product.sku && product.sku.toLowerCase().includes(productSearchTerm.toLowerCase()))
            );
        }

        return filteredProducts;
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

    // Upload Job sayfasını göster
    const showUploadJobProgress = () => {
        const matchedFiles = getFilteredFiles().filter(file => matchFileToProduct(file.name));
        const nonMatchedFiles = getFilteredFiles().filter(file => !matchFileToProduct(file.name));
        
        setUploadJobDetails({
            folderName: selectedFolder ? folderName : 'All Files',
            matchingType: 'Match by exact SKU',
            replaceExisting: clearExistingImages,
            totalImagesInFolder: files.length,
            selectedImages: selectedFiles.length,
            matchedImages: matchedFiles.length,
            nonMatchedImages: nonMatchedFiles.length
        });
        
        setTotalImages(matchedFiles.length);
        setUploadedImages(0);
        setUploadProgress(0);
        setUploadLogs([]);
        setUploadJobId(`#${Math.floor(Math.random() * 100000)}`);
        setIsUploadJobRunning(true);
        setShowUploadJobPage(true);
    };

    // Upload log ekle
    const addUploadLog = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
        const timestamp = new Date().toLocaleString('tr-TR');
        const logEntry = `[${timestamp}] [${type}] ${message}`;
        setUploadLogs(prev => [...prev, logEntry]);
    };

    // Upload job'ı durdur
    const stopUploadJob = () => {
        setIsUploadJobRunning(false);
        addUploadLog('Upload job durduruldu', 'warning');
    };

    // Eşleşme analizi yap ve Matching Results sayfasını göster
    const analyzeMatching = () => {
        if (selectedFiles.length === 0) {
            setError('Lütfen yüklenecek dosyaları seçin');
            return;
        }

        const matched: any[] = [];
        const nonMatched: any[] = [];

        selectedFiles.forEach(fileId => {
            const file = files.find(f => f.id === fileId);
            if (!file) return;

            const matchedProduct = products.find(product => {
                return product.skus.some(sku => 
                    file.name.toLowerCase().includes(sku.toLowerCase())
                );
            });

            if (matchedProduct) {
                const sku = matchedProduct.skus.find(sku => 
                    file.name.toLowerCase().includes(sku.toLowerCase())
                );
                matched.push({
                    file,
                    product: matchedProduct,
                    sku,
                    position: 1
                });
            } else {
                nonMatched.push({ file });
            }
        });

        setMatchedImagesList(matched);
                        setUploadJobDetails(prev => ({
                    ...prev,
                    folderName: folderName || 'Demo-2024',
                    totalImagesInFolder: files.length,
                    selectedImages: selectedFiles.length,
                    matchedImages: matched.length,
                    nonMatchedImages: nonMatched.length,
                    replaceExisting: clearExistingImages
                }));

        setShowMatchingResultsPage(true);
    };

    // Otomatik toplu yükleme - şimdi Matching Results'tan çağrılacak
    const handleBulkUpload = async () => {
        if (selectedFiles.length === 0) {
            setError('Lütfen yüklenecek dosyaları seçin');
            return;
        }

        // Upload Job sayfasını göster
        showUploadJobProgress();
        
        // Upload işlemini başlat
        setTimeout(() => startUploadProcess(), 1000);
    };

    // Upload işlemini başlat
    const startUploadProcess = async () => {
        addUploadLog('Upload is starting...');
        
        const groupedFiles = groupFilesBySKU();
        let currentUploaded = 0;
        
        // Toplam yüklenecek dosya sayısını hesapla
        const totalFilesToUpload = selectedFiles.length;
        setTotalImages(totalFilesToUpload);
        setUploadedImages(0);
        setUploadProgress(0);
        
        addUploadLog(`Total ${totalFilesToUpload} files will be uploaded`, 'info');

        // Her SKU grubu için işlem yap
        for (const [sku, skuFiles] of Object.entries(groupedFiles)) {
            const matchedProduct = products.find(product => product.sku === sku);
            if (!matchedProduct) continue;

            // Bu SKU'ya ait seçili dosyaları filtrele
            const selectedSkuFiles = skuFiles.filter(file => selectedFiles.includes(file.id));
            
            if (selectedSkuFiles.length === 0) continue;

            // Eğer "Mevcut görselleri temizle" seçiliyse, önce mevcut görselleri sil
            if (clearExistingImages) {
                try {
                    addUploadLog(`Existing images of ${matchedProduct.title} product are being deleted...`);
                    
                    // Shopify'dan mevcut görselleri sil
                    const deleteResponse = await fetch('/api/shopify/delete-product-images', {
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

                    const deleteData = await deleteResponse.json();
                    
                    if (deleteData.success) {
                        addUploadLog(`✅ Existing images of ${matchedProduct.title} product deleted`, 'success');
                    } else {
                        addUploadLog(`⚠️ Images of ${matchedProduct.title} product could not be deleted: ${deleteData.error}`, 'warning');
                    }
                } catch (err) {
                    addUploadLog(`❌ ${matchedProduct.title} ürününün görselleri silinirken hata: ${err}`, 'error');
                }
            }

            // Dosyaları sırayla yükle
            for (let i = 0; i < selectedSkuFiles.length; i++) {
                const file = selectedSkuFiles[i];
                
                try {
                    addUploadLog(`${file.name} file is being uploaded to ${matchedProduct.title} product... (${matchedProduct.sku})`);
                    
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
                            image_position: i + 1
                        })
                    });

                    const data = await response.json();

                    if (data.success) {
                        currentUploaded++;
                        setUploadedImages(currentUploaded);
                        setUploadProgress((currentUploaded / totalFilesToUpload) * 100);
                        
                        addUploadLog(`✅ ${file.name} successfully uploaded to ${matchedProduct.title} product`, 'success');
                    } else {
                        addUploadLog(`❌ ${file.name} could not be uploaded: ${data.error}`, 'error');
                    }
                } catch (err) {
                    addUploadLog(`❌ ${file.name} yükleme hatası: Ağ hatası`, 'error');
                }
            }
        }

        // Upload tamamlandı
        addUploadLog('Yükleme başarıyla tamamlandı!', 'success');
        setIsUploadJobRunning(false);
        
        // Upload tamamlandı mesajı ekle
        addUploadLog('✅ All images uploaded successfully!', 'success');
        addUploadLog('📱 Click "Back to Main Page" button to return to the main page.', 'info');
        
        // Otomatik sayfa yenileme kaldırıldı - kullanıcı manuel olarak dönecek
        // setTimeout(() => {
        //     setShowUploadJobPage(false);
        //     setSelectedFiles([]);
        //     loadFiles();
        //     loadProducts();
        // }, 3000);
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

    // Matching Results sayfası
    if (showMatchingResultsPage) {
        return (
            <Page 
                                                title="Matching Results"
                backAction={{
                    content: 'Back',
                    onAction: () => {
                        setShowMatchingResultsPage(false);
                        setSelectedFiles([]);
                    }
                }}
                secondaryActions={[
                    {
                        content: 'Support',
                        onAction: () => window.open('https://help.shopify.com', '_blank')
                    }
                ]}
            >
                <Layout>
                    <Layout.Section>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            {/* Matching Details */}
                            <Card>
                                <div style={{ padding: '1rem' }}>
                                    <Text as="h3" variant="headingMd" fontWeight="bold">
                                        Matching Details
                                    </Text>
                                    <div style={{ marginTop: '1rem', display: 'grid', gap: '0.5rem' }}>
                                        <div>
                                            <Text as="p" variant="bodySm" fontWeight="bold">Folder:</Text>
                                            <Text as="p" variant="bodyMd" tone="subdued">{uploadJobDetails.folderName}</Text>
                                        </div>
                                        <div>
                                            <Text as="p" variant="bodySm" fontWeight="bold">Matching type:</Text>
                                            <Text as="p" variant="bodyMd" tone="subdued">{uploadJobDetails.matchingType}</Text>
                                        </div>
                                        <div>
                                            <Text as="p" variant="bodySm" fontWeight="bold">Replace existing images:</Text>
                                            <Text as="p" variant="bodyMd" tone="subdued">{uploadJobDetails.replaceExisting ? 'YES' : 'NO'}</Text>
                                        </div>
                                        <div>
                                            <Text as="p" variant="bodySm" fontWeight="bold">Total images in folder:</Text>
                                            <Text as="p" variant="bodyMd" tone="subdued">{uploadJobDetails.totalImagesInFolder}</Text>
                                        </div>
                                        <div>
                                            <Text as="p" variant="bodySm" fontWeight="bold">Selected images count:</Text>
                                            <Text as="p" variant="bodyMd" tone="subdued">{uploadJobDetails.selectedImages}</Text>
                                        </div>
                                    </div>
                                </div>
                            </Card>

                            {/* Matching Results */}
                            <Card>
                                <div style={{ padding: '1rem' }}>
                                    <Text as="h3" variant="headingMd" fontWeight="bold">
                                        Matching Results
                                    </Text>
                                    <div style={{ marginTop: '1rem', display: 'grid', gap: '0.5rem' }}>
                                        <div>
                                            <Text as="p" variant="bodySm" fontWeight="bold" tone="success">Matched Images:</Text>
                                            <Text as="p" variant="bodyMd" tone="subdued">{uploadJobDetails.matchedImages}</Text>
                                        </div>
                                        <div>
                                            <Text as="p" variant="bodySm" fontWeight="bold" tone="critical">Non-Matched Images:</Text>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <Text as="p" variant="bodyMd" tone="subdued">{uploadJobDetails.nonMatchedImages}</Text>
                                                <Button variant="plain" size="micro">View Details</Button>
                                            </div>
                                        </div>
                                        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                                            <Button 
                                                onClick={() => {
                                                    setShowMatchingResultsPage(false);
                                                }}
                                                icon="RefreshIcon"
                                            >
                                                Match Again
                                            </Button>
                                            <Button 
                                                onClick={() => {
                                                    setShowMatchingResultsPage(false);
                                                    handleBulkUpload();
                                                }}
                                                tone="success"
                                                variant="primary"
                                            >
                                                Start Upload
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        </div>
                    </Layout.Section>

                    {/* Matched Images Table */}
                    <Layout.Section>
                        <Card>
                            <div style={{ padding: '1rem' }}>
                                                                    <Text as="h3" variant="headingMd" fontWeight="bold">
                                        Matched Images
                                    </Text>
                                
                                <div style={{ marginTop: '1rem' }}>
                                    <DataTable
                                        columnContentTypes={['text', 'text', 'text', 'numeric', 'text', 'text']}
                                        headings={['Image Preview', 'Image Name', 'Image Size', 'Position', 'Product / Variant', 'SKU']}
                                        rows={matchedImagesList.map((match, index) => [
                                            // Image Preview
                                            <div key={`preview-${index}`} style={{ width: '60px', height: '60px' }}>
                                                <Thumbnail
                                                    source={match.file.thumbnail || '/placeholder-image.png'}
                                                    alt={match.file.name}
                                                    size="small"
                                                />
                                            </div>,
                                            // Image Name
                                            match.file.name,
                                            // Image Size
                                            formatFileSize(match.file.size),
                                            // Position
                                            match.position,
                                            // Product / Variant
                                            <Button variant="plain" size="micro" key={`product-${index}`}>
                                                {match.product.title}
                                            </Button>,
                                            // SKU
                                            match.sku
                                        ])}
                                    />
                                </div>
                            </div>
                        </Card>
                    </Layout.Section>
                </Layout>
            </Page>
        );
    }

    // Ana sayfa veya Upload Job Progress sayfasından birini göster
    if (showUploadJobPage) {
        return (
                            <Page 
                    title={`Upload Job ${uploadJobId}`}
                    backAction={{
                        content: 'Back',
                        onAction: () => {
                            setShowUploadJobPage(false);
                            setSelectedFiles([]);
                        }
                    }}
                >
                    <Layout>
                        {/* Job Status ve Progress */}
                        <Layout.Section>
                            <Card>
                                <div style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <Text as="h2" variant="headingLg">
                                            Upload Job {uploadJobId}
                                        </Text>
                                        <Text as="p" variant="bodyMd">
                                            Total {uploadedImages}/{totalImages} images uploaded
                                        </Text>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <Button onClick={() => window.open('https://help.shopify.com', '_blank')}>
                                            Support
                                        </Button>
                                        <Button 
                                            onClick={stopUploadJob}
                                            disabled={!isUploadJobRunning}
                                            tone="critical"
                                        >
                                            Stop Job
                                        </Button>
                                    </div>
                                </div>
                            
                            {/* Progress Bar */}
                            <div style={{ padding: '0 1rem 1rem' }}>
                                <div style={{ 
                                    width: '100%', 
                                    height: '20px', 
                                    backgroundColor: '#e1e3e5', 
                                    borderRadius: '10px',
                                    overflow: 'hidden'
                                }}>
                                    <div style={{
                                        width: `${uploadProgress}%`,
                                        height: '100%',
                                        backgroundColor: '#95bf47',
                                        transition: 'width 0.3s ease',
                                        borderRadius: '10px'
                                    }} />
                                </div>
                            </div>
                        </Card>
                    </Layout.Section>

                                            {/* Job Details */}
                        <Layout.Section>
                            <Card>
                                <div style={{ padding: '1rem' }}>
                                    <Text as="h3" variant="headingMd" fontWeight="bold">
                                        Job Details
                                    </Text>
                                    <div style={{ 
                                        display: 'grid', 
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                                        gap: '1rem', 
                                        marginTop: '1rem' 
                                    }}>
                                        <div>
                                            <Text as="p" variant="bodySm" fontWeight="bold">Folder Name:</Text>
                                            <Text as="p" variant="bodyMd">{uploadJobDetails.folderName}</Text>
                                        </div>
                                        <div>
                                            <Text as="p" variant="bodySm" fontWeight="bold">Matching Type:</Text>
                                            <Text as="p" variant="bodyMd">{uploadJobDetails.matchingType}</Text>
                                        </div>
                                        <div>
                                            <Text as="p" variant="bodySm" fontWeight="bold">Replace Existing Images:</Text>
                                            <Text as="p" variant="bodyMd">{uploadJobDetails.replaceExisting ? 'YES' : 'NO'}</Text>
                                        </div>
                                        <div>
                                            <Text as="p" variant="bodySm" fontWeight="bold">Total Images in Folder:</Text>
                                            <Text as="p" variant="bodyMd">{uploadJobDetails.totalImagesInFolder}</Text>
                                        </div>
                                        <div>
                                            <Text as="p" variant="bodySm" fontWeight="bold">Selected Images Count:</Text>
                                            <Text as="p" variant="bodyMd">{uploadJobDetails.selectedImages}</Text>
                                        </div>
                                        <div>
                                            <Text as="p" variant="bodySm" fontWeight="bold">Matched Images:</Text>
                                            <Text as="p" variant="bodyMd">{uploadJobDetails.matchedImages}</Text>
                                        </div>
                                        <div>
                                            <Text as="p" variant="bodySm" fontWeight="bold">Non-Matched Images:</Text>
                                            <Text as="p" variant="bodyMd">{uploadJobDetails.nonMatchedImages}</Text>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        </Layout.Section>

                                            {/* Upload Logs */}
                        <Layout.Section>
                            <Card>
                                <div style={{ padding: '1rem' }}>
                                    <Text as="h3" variant="headingMd" fontWeight="bold">
                                        Upload Logs
                                    </Text>
                                    <div style={{ 
                                        maxHeight: '400px', 
                                        overflowY: 'auto', 
                                        marginTop: '1rem',
                                        backgroundColor: '#f6f6f7',
                                        padding: '1rem',
                                        borderRadius: '4px',
                                        fontFamily: 'monospace',
                                        fontSize: '14px',
                                        lineHeight: '1.5'
                                    }}>
                                        {uploadLogs.length === 0 ? (
                                            <div style={{ marginBottom: '1rem' }}>
                                                                                            <Text as="p" variant="bodyMd">
                                                Upload logs will appear here...
                                            </Text>
                                            </div>
                                        ) : (
                                            uploadLogs.map((log, index) => (
                                                <div key={index} style={{ marginBottom: '0.5rem' }}>
                                                    {log}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </Card>
                        </Layout.Section>

                    {/* Ana Sayfaya Dön Butonu */}
                    <Layout.Section>
                        <Card>
                            <div style={{ padding: '1rem', textAlign: 'center' }}>
                                <div style={{ marginBottom: '1rem' }}>
                                    <Text as="p" variant="bodyMd">
                                        Upload process completed! Click the button below to return to the main page.
                                    </Text>
                                </div>
                                <Button 
                                    onClick={() => {
                                        setShowUploadJobPage(false);
                                        setSelectedFiles([]);
                                        loadFiles();
                                        loadProducts();
                                    }}
                                    size="large"
                                    tone="success"
                                >
                                    🏠 Back to Main Page
                                </Button>
                            </div>
                        </Card>
                    </Layout.Section>
                </Layout>
            </Page>
        );
    }

    // Ana Google Drive sayfası
    return (
        <Page title="Google Drive Görsel Yükleme">
            <Layout>
                {/* Toplu Görsel Yükleme - EN YUKARDA */}
                <Layout.Section>
                    <Card>
                        <div style={{ padding: '1rem' }}>
                                                            <Text as="h3" variant="headingMd" fontWeight="bold">
                                    Bulk Image Upload
                                </Text>
                            
                            <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <Checkbox
                                    label="Clear existing images"
                                    checked={clearExistingImages}
                                    onChange={setClearExistingImages}
                                />
                                
                                <Button 
                                    onClick={analyzeMatching}
                                    disabled={selectedFiles.length === 0 || isUploading}
                                    size="large"
                                    tone="success"
                                >
                                    {isUploading ? 'Uploading...' : 'Auto Upload'}
                                </Button>
                            </div>
                            
                            {selectedFiles.length > 0 && (
                                <div style={{ marginTop: '1rem' }}>
                                    <Text as="p" variant="bodyMd">
                                        {selectedFiles.length} files selected
                                    </Text>
                                </div>
                            )}
                        </div>
                    </Card>
                </Layout.Section>

                {/* Arama & Filtreleme Bölümü */}
                <Layout.Section>
                    <Card>
                        <div style={{ padding: '1rem' }}>
                            <Text as="h3" variant="headingMd" fontWeight="bold">
                                Search & Filter Section
                            </Text>
                            <div style={{ 
                                display: 'grid', 
                                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
                                gap: '1rem', 
                                marginTop: '1rem' 
                            }}>
                                <TextField
                                    label="Search Files"
                                    value={fileSearchTerm}
                                    onChange={setFileSearchTerm}
                                    placeholder="Search by file name..."
                                    autoComplete="off"
                                />
                                <TextField
                                    label="Search Product"
                                    value={productSearchTerm}
                                    onChange={setProductSearchTerm}
                                    placeholder="Search by product name or SKU..."
                                    autoComplete="off"
                                />
                                <div style={{ display: 'flex', alignItems: 'end' }}>
                                    <Checkbox
                                        label="Show only matched files"
                                        checked={showOnlyMatchingFiles}
                                        onChange={setShowOnlyMatchingFiles}
                                    />
                                </div>
                            </div>
                        </div>
                    </Card>
                </Layout.Section>

                {/* Google Drive Dosyaları */}
                <Layout.Section>
                    <Card>
                        <div style={{ padding: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <Text as="h3" variant="headingMd" fontWeight="bold">
                                    Google Drive Files ({getFilteredFiles().length})
                                </Text>
                                <Button onClick={loadFiles} disabled={isLoading}>
                                    Refresh
                                </Button>
                            </div>
                            
                            {isLoading ? (
                                <div style={{ textAlign: 'center', padding: '2rem' }}>
                                    <Text as="p" variant="bodyMd">Loading files...</Text>
                                </div>
                            ) : files.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '2rem' }}>
                                    <Text as="p" variant="bodyMd">No files uploaded yet</Text>
                                </div>
                            ) : (
                                <div style={{ 
                                    display: 'grid', 
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', 
                                    gap: '1rem' 
                                }}>
                                    {getFilteredFiles().map((file) => (
                                        <div
                                            key={file.id}
                                            style={{
                                                border: selectedFiles.some(f => f === file.id) ? '2px solid #007c5b' : '1px solid #e1e3e5',
                                                borderRadius: '8px',
                                                padding: '0.5rem',
                                                cursor: 'pointer',
                                                backgroundColor: selectedFiles.some(f => f === file.id) ? '#f0f9f4' : 'white',
                                                transition: 'all 0.2s ease'
                                            }}
                                            onClick={() => handleFileSelection(file.id)}
                                        >
                                            <div style={{ textAlign: 'center' }}>
                                                <div style={{ marginBottom: '0.5rem' }}>
                                                    <img
                                                        src={file.thumbnail || '/placeholder-image.png'}
                                                        alt={file.name}
                                                        style={{
                                                            width: '100%',
                                                            height: '100px',
                                                            objectFit: 'cover',
                                                            borderRadius: '4px'
                                                        }}
                                                        onError={(e) => {
                                                            e.currentTarget.src = '/placeholder-image.png';
                                                        }}
                                                    />
                                                </div>
                                                <div style={{ 
                                                    wordBreak: 'break-word',
                                                    fontSize: '12px',
                                                    lineHeight: '1.3'
                                                }}>
                                                    <Text as="p" variant="bodySm" fontWeight="bold">
                                                        {file.name}
                                                    </Text>
                                                </div>
                                                
                                                {/* Eşleşme Durumu İkonu */}
                                                <div style={{ 
                                                    marginTop: '0.5rem',
                                                    display: 'flex',
                                                    justifyContent: 'center',
                                                    alignItems: 'center',
                                                    fontSize: '18px'
                                                }}>
                                                    {checkFileMatch(file) ? (
                                                        <div style={{ 
                                                            color: '#00a047', 
                                                            display: 'flex', 
                                                            alignItems: 'center', 
                                                            gap: '0.25rem' 
                                                        }}>
                                                            <span>✅</span>
                                                            <Text as="span" variant="bodySm" tone="success">
                                                                Matched
                                                            </Text>
                                                        </div>
                                                    ) : (
                                                        <div style={{ 
                                                            color: '#d72c0d', 
                                                            display: 'flex', 
                                                            alignItems: 'center', 
                                                            gap: '0.25rem' 
                                                        }}>
                                                            <span>❌</span>
                                                            <Text as="span" variant="bodySm" tone="critical">
                                                                Not Matched
                                                            </Text>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </Card>
                </Layout.Section>

                {/* Shopify Ürünleri Listesi */}
                <Layout.Section>
                    <Card>
                        <div style={{ padding: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <Text as="h3" variant="headingMd" fontWeight="bold">
                                    Shopify Products List ({getFilteredProducts().length})
                                </Text>
                                <Button onClick={loadProducts} disabled={isLoading}>
                                    Refresh
                                </Button>
                            </div>
                            
                            {isLoading ? (
                                <div style={{ textAlign: 'center', padding: '2rem' }}>
                                    <Text as="p" variant="bodyMd">Loading products...</Text>
                                </div>
                            ) : products.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '2rem' }}>
                                    <Text as="p" variant="bodyMd">No products uploaded yet</Text>
                                </div>
                            ) : (
                                <div style={{ 
                                    display: 'grid', 
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
                                    gap: '1rem' 
                                }}>
                                    {getFilteredProducts().map((product) => (
                                        <Card key={product.id}>
                                            <div style={{ padding: '1rem', textAlign: 'center' }}>
                                                <div style={{ marginBottom: '0.5rem' }}>
                                                    {product.image ? (
                                                        <Thumbnail
                                                            source={product.image}
                                                            alt={product.title}
                                                            size="large"
                                                        />
                                                    ) : (
                                                        <div style={{
                                                            width: '100px',
                                                            height: '100px',
                                                            backgroundColor: '#f6f6f7',
                                                            borderRadius: '4px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            margin: '0 auto'
                                                        }}>
                                                            <Text as="p" variant="bodySm">No Image</Text>
                                                        </div>
                                                    )}
                                                </div>
                                                <div style={{ 
                                                    wordBreak: 'break-word',
                                                    marginBottom: '0.5rem'
                                                }}>
                                                    <Text as="p" variant="bodyMd" fontWeight="bold">
                                                        {product.title}
                                                    </Text>
                                                </div>
                                                <div style={{ color: '#6d7175' }}>
                                                    <Text as="p" variant="bodySm">
                                                        SKU: {product.sku || 'N/A'}
                                                    </Text>
                                                </div>
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </div>
                    </Card>
                </Layout.Section>


            </Layout>
        </Page>
    );
} 