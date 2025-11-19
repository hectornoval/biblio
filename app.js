let currentBookData = null;
let html5QrCode = null;

document.getElementById('searchBtn').addEventListener('click', searchBook);
document.getElementById('isbnInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') searchBook();
});
document.getElementById('copyBtn').addEventListener('click', copyToClipboard);
document.getElementById('cameraBtn').addEventListener('click', startCamera);
document.getElementById('closeCameraBtn').addEventListener('click', stopCamera);
document.getElementById('manualEntryBtn').addEventListener('click', stopCamera);

async function startCamera() {
    try {
        hideError();
        hideResult();
        
        document.getElementById('cameraBtn').classList.add('hidden');
        document.getElementById('videoContainer').classList.remove('hidden');
        
        html5QrCode = new Html5Qrcode("reader");
        
        const config = {
            fps: 10,
            qrbox: { width: 250, height: 150 },
            aspectRatio: 1.777778,
            formatsToSupport: [
                Html5QrcodeSupportedFormats.EAN_13,
                Html5QrcodeSupportedFormats.EAN_8,
                Html5QrcodeSupportedFormats.CODE_128,
                Html5QrcodeSupportedFormats.CODE_39,
                Html5QrcodeSupportedFormats.UPC_A,
                Html5QrcodeSupportedFormats.UPC_E
            ],
            experimentalFeatures: {
                useBarCodeDetectorIfSupported: true
            },
            rememberLastUsedCamera: true,
            showTorchButtonIfSupported: true
        };
        
        await html5QrCode.start(
            { facingMode: "environment" },
            config,
            onScanSuccess,
            onScanError
        );
        
    } catch (error) {
        console.error('Camera error:', error);
        showError('No se pudo acceder a la cámara. Verifica los permisos en la configuración de tu navegador.');
        document.getElementById('cameraBtn').classList.remove('hidden');
        document.getElementById('videoContainer').classList.add('hidden');
    }
}

async function stopCamera() {
    if (html5QrCode) {
        try {
            await html5QrCode.stop();
            html5QrCode.clear();
        } catch (error) {
            console.error('Error stopping camera:', error);
        }
        html5QrCode = null;
    }
    document.getElementById('cameraBtn').classList.remove('hidden');
    document.getElementById('videoContainer').classList.add('hidden');
}

function onScanSuccess(decodedText, decodedResult) {
    console.log('Barcode detected:', decodedText, decodedResult);
    
    // Clean the barcode
    let cleanCode = decodedText.replace(/[-\s]/g, '');
    
    // Remove any non-numeric characters
    cleanCode = cleanCode.replace(/\D/g, '');
    
    console.log('Cleaned code:', cleanCode);
    
    // Check if it looks like a valid ISBN (10 or 13 digits)
    if (cleanCode.length >= 10 && cleanCode.length <= 13) {
        // Show success feedback
        const statusDiv = document.createElement('div');
        statusDiv.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-bounce';
        statusDiv.textContent = '¡ISBN detectado! ' + cleanCode;
        document.body.appendChild(statusDiv);
        
        setTimeout(() => {
            statusDiv.remove();
        }, 2000);
        
        stopCamera();
        document.getElementById('isbnInput').value = cleanCode;
        
        // Small delay before searching to show the success message
        setTimeout(() => {
            searchBook();
        }, 500);
    } else {
        console.log('Invalid ISBN length:', cleanCode.length);
    }
}

function onScanError(errorMessage) {
    // Scanning errors are normal when no barcode is in view
    // Only log to console, don't show to user
    // console.log('Scan error:', errorMessage);
}

async function searchBook() {
    const isbn = document.getElementById('isbnInput').value.trim();
    if (!isbn) return;

    const cleanISBN = isbn.replace(/[-\s]/g, '');
    
    showLoading(true);
    hideError();
    hideResult();

    try {
        const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanISBN}`);
        
        if (!response.ok) {
            throw new Error('Error al consultar la API');
        }

        const data = await response.json();

        if (data.items && data.items.length > 0) {
            const book = data.items[0].volumeInfo;
            currentBookData = {
                authors: book.authors || ['Autor desconocido'],
                year: book.publishedDate ? book.publishedDate.substring(0, 4) : 's.f.',
                title: book.title || 'Sin título',
                subtitle: book.subtitle || '',
                publisher: book.publisher || 'Editorial desconocida',
                city: extractCity(book)
            };
            displayResult();
        } else {
            showError(`No se encontró información para el ISBN: ${cleanISBN}`);
        }
    } catch (error) {
        console.error('Error:', error);
        showError('Error al buscar el libro. Verifica tu conexión a internet.');
    } finally {
        showLoading(false);
    }
}

function extractCity(book) {
    // Try to extract city from various fields
    if (book.publisher && book.publisher.includes(':')) {
        const parts = book.publisher.split(':');
        return parts[0].trim();
    }
    return 's.l.'; // sin lugar
}

function formatCitation() {
    if (!currentBookData) return '';
    
    const authors = currentBookData.authors.map(author => {
        const parts = author.split(' ');
        if (parts.length > 1) {
            const lastName = parts[parts.length - 1];
            const firstNames = parts.slice(0, -1).join(' ');
            return `${lastName.toUpperCase()}, ${firstNames}`;
        }
        return author.toUpperCase();
    }).join('; ');

    const fullTitle = currentBookData.subtitle 
        ? `${currentBookData.title}: ${currentBookData.subtitle}`
        : currentBookData.title;

    return `${authors}. (${currentBookData.year}). <em>${fullTitle}</em>. ${currentBookData.city}: ${currentBookData.publisher}.`;
}

function displayResult() {
    const citation = formatCitation();
    document.getElementById('citation').innerHTML = citation;
    
    const details = `
        <p><span class="font-medium">Autor(es):</span> ${currentBookData.authors.join(', ')}</p>
        <p><span class="font-medium">Título:</span> ${currentBookData.title}</p>
        ${currentBookData.subtitle ? `<p><span class="font-medium">Subtítulo:</span> ${currentBookData.subtitle}</p>` : ''}
        <p><span class="font-medium">Editorial:</span> ${currentBookData.publisher}</p>
        <p><span class="font-medium">Año:</span> ${currentBookData.year}</p>
        <p><span class="font-medium">Ciudad:</span> ${currentBookData.city}</p>
    `;
    document.getElementById('bookDetails').innerHTML = details;
    
    showResult();
}

function copyToClipboard() {
    const citation = formatCitation().replace(/<em>/g, '').replace(/<\/em>/g, '');
    navigator.clipboard.writeText(citation);
    
    const btn = document.getElementById('copyBtn');
    const span = btn.querySelector('span');
    btn.classList.add('copied');
    span.textContent = '¡Copiado!';
    setTimeout(() => {
        btn.classList.remove('copied');
        span.textContent = 'Copiar Cita';
    }, 2000);
}

function showLoading(show) {
    document.getElementById('loading').classList.toggle('hidden', !show);
    document.getElementById('searchBtn').disabled = show;
}

function showError(message) {
    const errorDiv = document.getElementById('error');
    errorDiv.querySelector('p').textContent = message;
    errorDiv.classList.remove('hidden');
}

function hideError() {
    document.getElementById('error').classList.add('hidden');
}

function showResult() {
    document.getElementById('result').classList.remove('hidden');
}

function hideResult() {
    document.getElementById('result').classList.add('hidden');
}
