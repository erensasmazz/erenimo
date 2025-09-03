<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Google Drive Connection</title>
</head>
<body>
    <script>
        // Debug: Console'a gönderilecek veriyi yazdır
        console.log('Popup: Sending message to parent:', {
            type: 'google-auth-callback',
            status: '{{ $status }}',
            message: '{{ $message }}',
            session_id: '{{ $session_id }}',
            redirect_url: '{{ $redirect_url }}'
        });
        
        // Hemen popup'ı kapat ve parent'a mesaj gönder
        if (window.opener) {
            const message = {
                type: 'google-auth-callback',
                status: '{{ $status }}',
                message: '{{ $message }}',
                session_id: '{{ $session_id }}',
                redirect_url: '{{ $redirect_url }}'
            };
            
            console.log('Popup: Sending message:', message);
            window.opener.postMessage(message, '*');
        }
        
        // Popup'ı kapat
        window.close();
    </script>
    
    <p>Closing popup...</p>
</body>
</html>
