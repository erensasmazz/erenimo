import React from 'react';
import { DataTable } from '@shopify/polaris';

interface Product {
    id: string;
    title: string;
    handle: string;
    status: string;
    vendor: string;
    productType: string;
    createdAt: string;
    updatedAt: string;
}

interface DataTableProps {
    products: Product[];
    loading?: boolean;
}

export function ProductDataTable({ products, loading = false }: DataTableProps) {
    const rows = products.map((product) => [
        product.title,
        product.handle,
        product.status,
        product.vendor,
        product.productType,
        new Date(product.createdAt).toLocaleDateString('tr-TR'),
        new Date(product.updatedAt).toLocaleDateString('tr-TR'),
    ]);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
        );
    }

    return (
        <DataTable
            columnContentTypes={[
                'text',
                'text',
                'text',
                'text',
                'text',
                'text',
                'text',
            ]}
            headings={[
                'Ürün Adı',
                'Handle',
                'Durum',
                'Satıcı',
                'Ürün Tipi',
                'Oluşturulma Tarihi',
                'Güncellenme Tarihi',
            ]}
            rows={rows}
        />
    );
} 