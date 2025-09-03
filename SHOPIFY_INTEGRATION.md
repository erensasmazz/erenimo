# Shopify Product Table Integration

This project has added a table that lists the products of the Shopify store.

## Changes Made

### 1. Frontend Components

#### `resources/js/components/ui/data-table.tsx`
- Shopify Polaris DataTable component created
- Shows product information (title, handle, status, vendor, product type, dates)
- Added spinner for loading state

#### `resources/js/pages/dashboard.tsx`
- Added product table to dashboard page
- Added function to fetch products from Shopify GraphQL API
- Added error handling and loading states
- Integrated Polaris Banner and Spinner components

#### `resources/js/app.tsx`
- Integrated Polaris AppProvider
- Added Polaris CSS styles

### 2. Backend API

#### `app/Http/Controllers/ShopifyController.php`
- Created controller to get products using Shopify GraphQL API
- Product access provided with `read_products` permission
- Added error handling and logging

#### `routes/web.php`
- Added `/api/shopify/products` endpoint
- Defined API route to get Shopify products

### 3. Required Permissions

The project already has `read_products` permission:
- `read_products` permission is defined in `config/shopify-app.php` file

## Technologies Used

- **Frontend**: React, TypeScript, Shopify Polaris
- **Backend**: Laravel, PHP
- **API**: Shopify GraphQL Admin API
- **UI Components**: Polaris DataTable, Banner, Spinner

## Features

1. **Product List**: Shows all products in the store in table format
2. **Real-time Data**: Fetches live data from Shopify API
3. **Error Handling**: Shows API errors with user-friendly messages
4. **Loading State**: Shows spinner while data is loading
5. **Responsive Design**: Mobile and desktop compatible

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

## Installation and Running

1. Build the project: `npm run build`
2. Start Laravel server: `php artisan serve`
3. Go to dashboard page: `/dashboard`
4. Connect to Shopify store and view products

## Notes

- Shopify session is required
- `read_products` permission must be active in the store
- GraphQL API version 2023-10 is being used 