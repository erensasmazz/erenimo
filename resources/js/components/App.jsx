import React from 'react';
import { AppProvider, Button } from '@shopify/polaris';
import '@shopify/polaris/build/esm/styles.css';

export default function App() {
  return (
    <AppProvider i18n={{}}>
      <div style={{ padding: 20 }}>
        <Button onClick={() => alert('Hello Polaris!')}>
          Polaris Button
        </Button>
      </div>
    </AppProvider>
  );
}
