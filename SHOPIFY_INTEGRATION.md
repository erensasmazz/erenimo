# Shopify Ürün Tablosu Entegrasyonu

Bu proje, Shopify mağazasının ürünlerini listeleyen bir tablo eklenmiştir.

## Yapılan Değişiklikler

### 1. Frontend Bileşenleri

#### `resources/js/components/ui/data-table.tsx`
- Shopify Polaris DataTable bileşeni oluşturuldu
- Ürün bilgilerini (başlık, handle, durum, satıcı, ürün tipi, tarihler) gösterir
- Loading durumu için spinner eklendi

#### `resources/js/pages/dashboard.tsx`
- Dashboard sayfasına ürün tablosu eklendi
- Shopify GraphQL API'sinden ürünleri çeken fonksiyon eklendi
- Hata yönetimi ve loading durumları eklendi
- Polaris Banner ve Spinner bileşenleri entegre edildi

#### `resources/js/app.tsx`
- Polaris AppProvider entegrasyonu yapıldı
- Polaris CSS stilleri eklendi

### 2. Backend API

#### `app/Http/Controllers/ShopifyController.php`
- Shopify GraphQL API'sini kullanarak ürünleri getiren controller oluşturuldu
- `read_products` izni ile ürünlere erişim sağlanıyor
- Hata yönetimi ve loglama eklendi

#### `routes/web.php`
- `/api/shopify/products` endpoint'i eklendi
- Shopify ürünlerini getiren API route'u tanımlandı

### 3. Gerekli İzinler

Proje zaten `read_products` iznine sahip:
- `config/shopify-app.php` dosyasında `read_products` izni tanımlı

## Kullanılan Teknolojiler

- **Frontend**: React, TypeScript, Shopify Polaris
- **Backend**: Laravel, PHP
- **API**: Shopify GraphQL Admin API
- **UI Components**: Polaris DataTable, Banner, Spinner

## Özellikler

1. **Ürün Listesi**: Mağazadaki tüm ürünleri tablo halinde gösterir
2. **Gerçek Zamanlı Veri**: Shopify API'sinden canlı veri çeker
3. **Hata Yönetimi**: API hatalarını kullanıcı dostu mesajlarla gösterir
4. **Loading Durumu**: Veri yüklenirken spinner gösterir
5. **Responsive Tasarım**: Mobil ve masaüstü uyumlu

## GraphQL Query

```graphql
query {
    products(first: 50) {
        edges {
            node {
                id
                title
                handle
                status
                vendor
                productType
                createdAt
                updatedAt
            }
        }
    }
}
```

## Kurulum ve Çalıştırma

1. Projeyi build edin: `npm run build`
2. Laravel sunucusunu başlatın: `php artisan serve`
3. Dashboard sayfasına gidin: `/dashboard`
4. Shopify mağazasına bağlanın ve ürünleri görüntüleyin

## Notlar

- Shopify session'ı gereklidir
- `read_products` izni mağazada aktif olmalıdır
- GraphQL API 2023-10 versiyonu kullanılmaktadır 