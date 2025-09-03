<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Google Drive Connection</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            text-align: center;
            padding: 40px 20px;
            background: #f8f9fa;
            margin: 0;
        }
        .container {
            max-width: 400px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .success {
            color: #28a745;
        }
        .error {
            color: #dc3545;
        }
        .icon {
            font-size: 48px;
            margin-bottom: 20px;
        }
        .message {
            margin: 20px 0;
            font-size: 16px;
            line-height: 1.5;
        }
        .close-btn {
            background: #007bff;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
        }
        .close-btn:hover {
            background: #0056b3;
        }
    </style>
</head>
<body>
    <div class="container">
        @if($status === 'success')
            <div class="icon">✅</div>
            <h2 class="success">Connection Successful!</h2>
            <div class="message">{{ $message }}</div>
            <p>You can now close this window and return to the Shopify app.</p>
        @else
            <div class="icon">❌</div>
            <h2 class="error">Connection Failed</h2>
            <div class="message">{{ $message }}</div>
            <p>Please try again or contact support.</p>
        @endif
        
        <button class="close-btn" onclick="closeWindow()">Close Window</button>
    </div>

    <script>
        // Popup'ı kapat ve parent window'a mesaj gönder
        function closeWindow() {
            // Parent window'a başarı mesajı gönder
            if (window.opener) {
                window.opener.postMessage({
                    type: 'google-auth-callback',
                    status: '{{ $status }}',
                    message: '{{ $message }}',
                    sessionId: '{{ session()->getId() }}'
                }, '*');
            }
            
            // Popup'ı kapat
            window.close();
        }

        // Otomatik olarak 3 saniye sonra kapat (başarılı ise)
        @if($status === 'success')
            setTimeout(function() {
                closeWindow();
            }, 3000);
        @endif
    </script>
</body>
</html>
