import React, { useState, useEffect, useCallback } from 'react';
import { 
    Page, 
    Layout, 
    Card, 
    Button, 
    Text, 
    Thumbnail, 
    DataTable, 
    Spinner, 
    Banner, 
    Checkbox,
    TextField,
    Select,
    Badge,
    Icon,
    Modal,
    ProgressBar,
    Stack,
    InlineStack,
    BlockStack
} from '@shopify/polaris';
// Shopify Polaris icons - will be used when needed
// import { SearchIcon, FilterIcon, RefreshIcon } from '@shopify/polaris-icons';

interface GoogleDriveFile {
    id: string;
    name: string;
    size: string;
    mimeType: string;
    thumbnail?: string;
    parents?: string[];
}

interface ShopifyProduct {
    id: string;
    title: string;
    skus: string[];
    images?: any[];
}

interface MatchedImage {
    file: GoogleDriveFile;
    product: ShopifyProduct;
    sku: string;
    position: number;
}

interface UploadJobDetails {
    folderName: string;
    matchingType: string;
    replaceExisting: boolean;
    totalImagesInFolder: number;
    selectedImages: number;
    matchedImages: number;
    nonMatchedImages: number;
}

export default function GoogleDriveApp() {
    // State variables
    const [files, setFiles] = useState<GoogleDriveFile[]>([]);
    const [products, setProducts] = useState<ShopifyProduct[]>([]);
    const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
    const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
    const [folderName, setFolderName] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [clearExistingImages, setClearExistingImages] = useState(false);
    
    // Matching Results and Upload Job states
    const [showMatchingResultsPage, setShowMatchingResultsPage] = useState(false);
    const [showUploadJobPage, setShowUploadJobPage] = useState(false);
    const [matchedImagesList, setMatchedImagesList] = useState<MatchedImage[]>([]);
    const [uploadJobDetails, setUploadJobDetails] = useState<UploadJobDetails>({
        folderName: '',
        matchingType: 'Match by exact SKU',
        replaceExisting: false,
        totalImagesInFolder: 0,
        selectedImages: 0,
        matchedImages: 0,
        nonMatchedImages: 0
    });
    
    // Upload progress states
    const [uploadProgress, setUploadProgress] = useState(0);
    const [totalImages, setTotalImages] = useState(0);
    const [uploadedImages, setUploadedImages] = useState(0);
    const [uploadLogs, setUploadLogs] = useState<string[]>([]);
    const [isUploadJobRunning, setIsUploadJobRunning] = useState(false);

    // Google Drive bağlantısını kontrol et
    useEffect(() => {
        checkGoogleDriveSession();
    }, []);

    // Google Drive session kontrolü
    const checkGoogleDriveSession = async () => {
        try {
            const response = await fetch('/api/google/access-token');
            const data = await response.json();
            
            if (data.success && data.access_token) {
                // Google Drive bağlı, dosyaları yükle
                loadFiles();
                loadProducts();
            } else {
                setError('Google Drive bağlantısı gerekli. Lütfen önce Google Drive\'a bağlanın.');
            }
        } catch (err) {
            setError('Google Drive bağlantısı kontrol edilemedi');
        }
    };

    // Dosyaları yükle
    const loadFiles = useCallback(async () => {
        try {
            setIsLoading(true);
            
            let url = '/api/google/files';
            if (selectedFolder) {
                url += `?folder_id=${encodeURIComponent(selectedFolder)}`;
            }
            
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
                console.log(`Dosyalar yüklendi: ${data.files.length} dosya`);
            } else {
                setError(data.error || 'Dosyalar yüklenemedi');
            }
        } catch (err) {
            console.error('Dosyalar yüklenirken hata:', err);
            setError('Dosyalar yüklenirken hata oluştu');
        } finally {
            setIsLoading(false);
        }
    }, [selectedFolder]);

    // Shopify ürünlerini yükle
    const loadProducts = async () => {
        try {
            const response = await fetch('/api/shopify/products');
            const data = await response.json();
            
            if (data.success && data.products) {
                setProducts(data.products);
            } else {
                console.error('Shopify ürünleri yüklenemedi:', data.error);
            }
        } catch (err) {
            console.error('Shopify ürünleri yüklenirken hata:', err);
        }
    };

    // Dosya seçimi
    const toggleFileSelection = (fileId: string) => {
        setSelectedFiles(prev => 
            prev.includes(fileId) 
                ? prev.filter(id => id !== fileId)
                : [...prev, fileId]
        );
    };

    // Dosya boyutunu formatla
    const formatFileSize = (size: string) => {
        const bytes = parseInt(size);
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    // Filtrelenmiş dosyaları al
    const getFilteredFiles = () => {
        let filtered = files;
        
        // Arama filtresi
        if (searchTerm) {
            filtered = filtered.filter(file => 
                file.name.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        
        // Tip filtresi
        if (filterType !== 'all') {
            filtered = filtered.filter(file => {
                if (filterType === 'images') {
                    return file.mimeType.startsWith('image/');
                }
                return true;
            });
        }
        
        return filtered;
    };

    // Eşleşme kontrolü
    const checkFileMatch = (file: GoogleDriveFile) => {
        return products.some(product => 
            product.skus.some(sku => 
                file.name.toLowerCase().includes(sku.toLowerCase())
            )
        );
    };

    // Eşleşme analizi
    const analyzeMatching = () => {
        if (selectedFiles.length === 0) {
            setError('Lütfen yüklenecek dosyaları seçin');
            return;
        }

        const matched: MatchedImage[] = [];
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

    // Toplu yükleme
    const handleBulkUpload = async () => {
        if (selectedFiles.length === 0) {
            setError('Lütfen yüklenecek dosyaları seçin');
            return;
        }

        showUploadJobProgress();
        setTimeout(() => startUploadProcess(), 1000);
    };

    // Upload Job Progress sayfasını göster
    const showUploadJobProgress = () => {
        const matchedFiles = selectedFiles.filter(fileId => {
            const file = files.find(f => f.id === fileId);
            return file && checkFileMatch(file);
        });

        setUploadJobDetails(prev => ({
            ...prev,
                                        folderName: selectedFolder ? folderName : 'All Files',
            matchingType: 'Match by exact SKU',
            replaceExisting: clearExistingImages,
            totalImagesInFolder: files.length,
            selectedImages: selectedFiles.length,
            matchedImages: matchedFiles.length,
            nonMatchedImages: selectedFiles.length - matchedFiles.length
        }));
        
        setTotalImages(matchedFiles.length);
        setUploadedImages(0);
        setUploadProgress(0);
        setUploadLogs([]);
        setIsUploadJobRunning(true);
        setShowUploadJobPage(true);
    };

    // Upload işlemini başlat
    const startUploadProcess = async () => {
        addUploadLog('Upload is starting...');
        
        const matchedFiles = selectedFiles.filter(fileId => {
            const file = files.find(f => f.id === fileId);
            return file && checkFileMatch(file);
        });

        let currentUploaded = 0;
        const totalFilesToUpload = matchedFiles.length;
        
        setTotalImages(totalFilesToUpload);
        setUploadedImages(0);
        setUploadProgress(0);

        for (const fileId of matchedFiles) {
            const file = files.find(f => f.id === fileId);
            if (!file) continue;

            const matchedProduct = products.find(product => 
                product.skus.some(sku => 
                    file.name.toLowerCase().includes(sku.toLowerCase())
                )
            );

            if (matchedProduct) {
                try {
                                            addUploadLog(`${file.name} file is being uploaded...`);
                    
                    // Clean existing images
                    if (clearExistingImages) {
                        addUploadLog(`${matchedProduct.title} product existing images are being cleaned...`);
                        await fetch('/api/shopify/delete-product-images', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                            },
                            body: JSON.stringify({
                                product_id: matchedProduct.id
                            })
                        });
                    }

                    // Yeni görseli yükle
                    const uploadResponse = await fetch('/api/shopify/upload-from-google-drive', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                        },
                        body: JSON.stringify({
                            file_id: file.id,
                            product_id: matchedProduct.id,
                            image_position: 1
                        })
                    });

                    if (uploadResponse.ok) {
                        currentUploaded++;
                        setUploadedImages(currentUploaded);
                        setUploadProgress((currentUploaded / totalFilesToUpload) * 100);
                        addUploadLog(`✅ ${file.name} uploaded successfully`, 'success');
                    } else {
                        addUploadLog(`❌ ${file.name} could not be uploaded`, 'error');
                    }
                } catch (err) {
                    addUploadLog(`❌ ${file.name} yüklenirken hata: ${err}`, 'error');
                }
            }
        }

                            addUploadLog('Upload process completed!');
        setIsUploadJobRunning(false);
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

    // Ana sayfaya dön
    const goToMainPage = () => {
        setShowMatchingResultsPage(false);
        setShowUploadJobPage(false);
        setSelectedFiles([]);
        setMatchedImagesList([]);
        setUploadLogs([]);
        setUploadProgress(0);
        setUploadedImages(0);
        setTotalImages(0);
        setIsUploadJobRunning(false);
    };

    // Google Drive bağlantısı gerekli
    if (error && error.includes('Google Drive bağlantısı gerekli')) {
        return (
            <Page title="Google Drive Entegrasyonu">
                <Layout>
                    <Layout.Section>
                        <Card>
                            <div style={{ padding: '2rem', textAlign: 'center' }}>
                                <Text as="h2" variant="headingLg">
                                    Google Drive Bağlantısı Gerekli
                                </Text>
                                <Text as="p" variant="bodyMd" tone="subdued">
                                    Bu özelliği kullanmak için önce Google Drive hesabınıza bağlanmanız gerekiyor.
                                </Text>
                                <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                                    <Button 
                                        onClick={() => window.location.href = '/google-drive'}
                                        size="large"
                                        tone="success"
                                    >
                                        Google Drive'a Bağlan
                                    </Button>
                                    <Button 
                                        onClick={() => {
                                            setError(null);
                                            // Demo verisi ile test et
                                            setFiles([
                                                {
                                                    id: 'demo-1',
                                                    name: 'demo-urun-1.jpg',
                                                    size: '1024000',
                                                    mimeType: 'image/jpeg',
                                                    thumbnail: 'https://via.placeholder.com/150x150?text=Demo+1'
                                                },
                                                {
                                                    id: 'demo-2',
                                                    name: 'demo-urun-2.jpg',
                                                    size: '2048000',
                                                    mimeType: 'image/jpeg',
                                                    thumbnail: 'https://via.placeholder.com/150x150?text=Demo+2'
                                                },
                                                {
                                                    id: 'demo-3',
                                                    name: 'demo-urun-3.jpg',
                                                    size: '1536000',
                                                    mimeType: 'image/jpeg',
                                                    thumbnail: 'https://via.placeholder.com/150x150?text=Demo+3'
                                                }
                                            ]);
                                            setProducts([
                                                {
                                                    id: '1',
                                                    title: 'Demo Product 1',
                                                    skus: ['demo-urun-1'],
                                                    vendor: 'Demo Vendor',
                                                    productType: 'Demo Type'
                                                },
                                                {
                                                    id: '2',
                                                    title: 'Demo Product 2',
                                                    skus: ['demo-urun-2'],
                                                    vendor: 'Demo Vendor',
                                                    productType: 'Demo Type'
                                                },
                                                {
                                                    id: '3',
                                                    title: 'Demo Product 3',
                                                    skus: ['demo-urun-3'],
                                                    vendor: 'Demo Vendor',
                                                    productType: 'Demo Type'
                                                }
                                            ]);
                                        }}
                                        size="large"
                                        tone="secondary"
                                        variant="secondary"
                                    >
                                        Test with Demo Mode
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    </Layout.Section>
                </Layout>
            </Page>
        );
    }

    // Upload Job Progress sayfası
    if (showUploadJobPage) {
        return (
            <Page 
                title="Upload Job Progress" 
                backAction={{
                    content: 'Back',
                    onAction: goToMainPage,

                }}
            >
                <Layout>
                    <Layout.Section>
                        <Card>
                            <div style={{ padding: '1rem' }}>
                                <Text as="h3" variant="headingMd" fontWeight="bold">
                                    Upload Job Details
                                </Text>
                                <div style={{ marginTop: '1rem', display: 'grid', gap: '1rem' }}>
                                    <div>
                                        <Text as="p" variant="bodySm" fontWeight="bold">Folder Name:</Text>
                                        <Text as="p" variant="bodyMd" tone="subdued">{uploadJobDetails.folderName}</Text>
                                    </div>
                                    <div>
                                        <Text as="p" variant="bodySm" fontWeight="bold">Matching Type:</Text>
                                        <Text as="p" variant="bodyMd" tone="subdued">{uploadJobDetails.matchingType}</Text>
                                    </div>
                                    <div>
                                        <Text as="p" variant="bodySm" fontWeight="bold">Replace Existing Images:</Text>
                                        <Text as="p" variant="bodyMd" tone="subdued">{uploadJobDetails.replaceExisting ? 'YES' : 'NO'}</Text>
                                    </div>
                                    <div>
                                        <Text as="p" variant="bodySm" fontWeight="bold">Total Images in Folder:</Text>
                                        <Text as="p" variant="bodyMd" tone="subdued">{uploadJobDetails.totalImagesInFolder}</Text>
                                    </div>
                                    <div>
                                        <Text as="p" variant="bodySm" fontWeight="bold">Selected Images Count:</Text>
                                        <Text as="p" variant="bodyMd" tone="subdued">{uploadJobDetails.selectedImages}</Text>
                                    </div>
                                    <div>
                                        <Text as="p" variant="bodySm" fontWeight="bold">Matched Images:</Text>
                                        <Text as="p" variant="bodyMd" tone="subdued">{uploadJobDetails.matchedImages}</Text>
                                    </div>
                                    <div>
                                        <Text as="p" variant="bodySm" fontWeight="bold">Non-Matched Images:</Text>
                                        <Text as="p" variant="bodyMd" tone="subdued">{uploadJobDetails.nonMatchedImages}</Text>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </Layout.Section>

                    {/* Progress Bar */}
                    <Layout.Section>
                        <Card>
                            <div style={{ padding: '1rem' }}>
                                <Text as="h3" variant="headingMd" fontWeight="bold">
                                    Upload Progress
                                </Text>
                                <div style={{ marginTop: '1rem' }}>
                                    <ProgressBar 
                                        progress={uploadProgress} 
                                        size="large"
                                        tone="success"
                                    />
                                    <div style={{ marginTop: '0.5rem', textAlign: 'center' }}>
                                        <Text as="p" variant="bodyMd">
                                            {uploadedImages} / {totalImages} images uploaded
                                        </Text>
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
                                    onClick={goToMainPage}
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

    // Matching Results sayfası
    if (showMatchingResultsPage) {
        return (
            <Page 
                                                title="Matching Results" 
                backAction={{
                    content: 'Back',
                    onAction: goToMainPage,

                }}
            >
                <Layout>
                    <Layout.Section>
                        <div style={{ display: 'grid', gap: '1rem' }}>
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
                                            <Text as="p" variant="bodySm" fontWeight="bold">Matching Type:</Text>
                                            <Text as="p" variant="bodyMd" tone="subdued">{uploadJobDetails.matchingType}</Text>
                                        </div>
                                        <div>
                                            <Text as="p" variant="bodySm" fontWeight="bold">Replace Existing Images:</Text>
                                            <Text as="p" variant="bodyMd" tone="subdued">{uploadJobDetails.replaceExisting ? 'YES' : 'NO'}</Text>
                                        </div>
                                        <div>
                                            <Text as="p" variant="bodySm" fontWeight="bold">Total Images in Folder:</Text>
                                            <Text as="p" variant="bodyMd" tone="subdued">{uploadJobDetails.totalImagesInFolder}</Text>
                                        </div>
                                        <div>
                                            <Text as="p" variant="bodySm" fontWeight="bold">Selected Images Count:</Text>
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
                                                                                onClick={goToMainPage}
                                            >
                                                Match Again
                                            </Button>
                                            <Button 
                                                onClick={handleBulkUpload}
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
                                    disabled={selectedFiles.length === 0}
                                    tone="success"
                                    variant="primary"
                                >
                                    Auto Upload
                                </Button>
                            </div>
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
                            
                            <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                <div style={{ flex: 1 }}>
                                    <TextField
                                        label="Search Files"
                                        value={searchTerm}
                                        onChange={setSearchTerm}
                                        placeholder="Search by file name..."
                                        autoComplete="off"
                                    />
                                </div>
                                <div style={{ minWidth: '200px' }}>
                                    <Select
                                        label="File Type"
                                        options={[
                                                                                         { label: 'All Files', value: 'all' },
                                             { label: 'Images Only', value: 'images' }
                                        ]}
                                        value={filterType}
                                        onChange={setFilterType}
                                    />
                                </div>
                                <Button 
                                    onClick={loadFiles}
                                    variant="secondary"
                                >
                                    Refresh
                                </Button>
                            </div>
                        </div>
                    </Card>
                </Layout.Section>

                {/* Google Drive Dosyaları */}
                <Layout.Section>
                    <Card>
                        <div style={{ padding: '1rem' }}>
                                                            <Text as="h3" variant="headingMd" fontWeight="bold">
                                    Google Drive Files
                                </Text>
                            
                            {isLoading ? (
                                <div style={{ textAlign: 'center', padding: '2rem' }}>
                                    <Spinner size="large" />
                                    <Text as="p" variant="bodyMd" tone="subdued">
                                        Loading files...
                                    </Text>
                                </div>
                            ) : error ? (
                                <Banner tone="critical">
                                    <p>{error}</p>
                                </Banner>
                            ) : (
                                <div style={{ marginTop: '1rem' }}>
                                    <div style={{ 
                                        display: 'grid', 
                                        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
                                        gap: '1rem' 
                                    }}>
                                        {getFilteredFiles().map((file) => {
                                            const isSelected = selectedFiles.includes(file.id);
                                            const isMatched = checkFileMatch(file);
                                            
                                            return (
                                                <div 
                                                    key={file.id} 
                                                    style={{ 
                                                        border: isSelected ? '2px solid #5c6ac4' : '1px solid #e1e3e5',
                                                        borderRadius: '8px',
                                                        padding: '1rem',
                                                        cursor: 'pointer',
                                                        backgroundColor: isSelected ? '#f6f6f7' : 'white',
                                                        position: 'relative'
                                                    }}
                                                    onClick={() => toggleFileSelection(file.id)}
                                                >
                                                    {/* Eşleşme göstergesi */}
                                                    <div style={{ 
                                                        position: 'absolute', 
                                                        top: '8px', 
                                                        right: '8px',
                                                        fontSize: '16px'
                                                    }}>
                                                        {isMatched ? (
                                                            <span style={{ color: '#50b83c' }}>✅ Matched</span>
                                                        ) : (
                                                                                                                          <span style={{ color: '#d82c0d' }}>❌ Not Matched</span>
                                                        )}
                                                    </div>
                                                    
                                                    <div style={{ textAlign: 'center' }}>
                                                        <Thumbnail
                                                            source={file.thumbnail || '/placeholder-image.png'}
                                                            alt={file.name}
                                                            size="medium"
                                                        />
                                                        <div style={{ marginTop: '0.5rem' }}>
                                                            <Text as="p" variant="bodySm" fontWeight="bold">
                                                                {file.name}
                                                            </Text>
                                                            <Text as="p" variant="bodySm" tone="subdued">
                                                                {formatFileSize(file.size)}
                                                            </Text>
                                                        </div>
                                                    </div>
                                                    
                                                    <div style={{ marginTop: '0.5rem', textAlign: 'center' }}>
                                                        <Checkbox
                                                            label="Select"
                                                            checked={isSelected}
                                                            onChange={() => toggleFileSelection(file.id)}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    
                                    {getFilteredFiles().length === 0 && (
                                        <div style={{ textAlign: 'center', padding: '2rem' }}>
                                            <Text as="p" variant="bodyMd" tone="subdued">
                                                {searchTerm || filterType !== 'all' 
                                                    ? 'Arama kriterlerine uygun dosya bulunamadı' 
                                                    : 'Henüz dosya yüklenmedi'
                                                }
                                            </Text>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </Card>
                </Layout.Section>

                {/* Shopify Ürünleri Listesi */}
                <Layout.Section>
                    <Card>
                        <div style={{ padding: '1rem' }}>
                                                            <Text as="h3" variant="headingMd" fontWeight="bold">
                                    Shopify Products List
                                </Text>
                            
                            <div style={{ marginTop: '1rem' }}>
                                <DataTable
                                    columnContentTypes={['text', 'text', 'text', 'text']}
                                    headings={['Ürün Adı', 'Vendor', 'Ürün Tipi', 'SKU\'lar']}
                                    rows={products.map((product) => [
                                        product.title,
                                        product.vendor || 'N/A',
                                        product.productType || 'N/A',
                                        <div key={product.id}>
                                            {product.skus.map((sku, index) => (
                                                <Badge key={index} tone="info" size="small">
                                                    {sku}
                                                </Badge>
                                            ))}
                                        </div>
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
