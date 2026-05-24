// ===== STATE MANAGEMENT =====
let scanning = false;
let cameraStream = null;
let isProcessing = false;

// ===== DOM ELEMENTS =====
const scannerPage = document.getElementById('scannerPage');
const confirmationPage = document.getElementById('confirmationPage');
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const startBtn = document.getElementById('startBtn');
const backBtn = document.getElementById('backBtn');
const downloadBtn = document.getElementById('downloadBtn');

const confirmIcon = document.getElementById('confirmIcon');
const confirmTitle = document.getElementById('confirmTitle');
const confirmSubtitle = document.getElementById('confirmSubtitle');
const voucherCard = document.getElementById('voucherCard');
const voucherBusiness = document.getElementById('voucherBusiness');
const voucherOffer = document.getElementById('voucherOffer');
const voucherCode = document.getElementById('voucherCode');
const errorContainer = document.getElementById('errorContainer');

// ===== INITIALIZATION =====
startBtn.addEventListener('click', startCamera);
backBtn.addEventListener('click', goBackToScanner);
downloadBtn.addEventListener('click', downloadPass);

// Check if URL has code parameter (deep link)
const urlParams = new URLSearchParams(window.location.search);
const codeFromUrl = urlParams.get('code');
if (codeFromUrl) {
    processVoucherCode(codeFromUrl);
}

// Request camera permission on page load for faster UX
if (navigator.permissions && navigator.permissions.query) {
    navigator.permissions.query({ name: 'camera' }).then(result => {
        if (result.state === 'prompt') {
            // Camera permission not yet granted, user will grant on button click
        }
    });
}

// ===== CAMERA FUNCTIONS =====
async function startCamera() {
    try {
        startBtn.disabled = true;
        startBtn.textContent = '● Starte Kamera...';

        const constraints = {
            video: {
                facingMode: 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        };

        cameraStream = await navigator.mediaDevices.getUserMedia(constraints);

        video.srcObject = cameraStream;
        video.onloadedmetadata = () => {
            video.classList.add('active');
            video.play().then(() => {
                startScanning();
                startBtn.style.display = 'none';
            });
        };
    } catch (err) {
        console.error('Camera error:', err);
        let errorMsg = 'Kamerazugriff nicht möglich';
        if (err.name === 'NotAllowedError') {
            errorMsg = 'Kamerazugriff verweigert. Bitte Einstellungen überprüfen.';
        } else if (err.name === 'NotFoundError') {
            errorMsg = 'Keine Kamera gefunden.';
        }

        showError(errorMsg);
        startBtn.disabled = false;
        startBtn.textContent = 'Kamera starten';
    }
}

function startScanning() {
    if (scanning) return;
    scanning = true;

    const canvasContext = canvas.getContext('2d', { willReadFrequently: true });

    function scan() {
        if (!scanning) return;

        if (video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            canvasContext.drawImage(video, 0, 0);
            const imageData = canvasContext.getImageData(
                0, 0, canvas.width, canvas.height
            );

            try {
                const code = jsQR(imageData.data, imageData.width, imageData.height);

                if (code && !isProcessing) {
                    const qrData = code.data;
                    let voucherCode = extractCode(qrData);

                    if (voucherCode) {
                        isProcessing = true;
                        stopCamera();
                        processVoucherCode(voucherCode);
                        return;
                    }
                }
            } catch (err) {
                console.error('QR scan error:', err);
            }
        }

        requestAnimationFrame(scan);
    }

    scan();
}

function extractCode(qrData) {
    // Try different formats
    if (qrData.includes('code=')) {
        try {
            const url = new URL(qrData, window.location.origin);
            return url.searchParams.get('code');
        } catch {}
    }

    if (qrData.includes('?') || qrData.includes('&')) {
        try {
            const url = new URL(qrData, window.location.origin);
            return url.searchParams.get('code');
        } catch {}
    }

    // Direct code (alphanumeric)
    if (/^[A-Z0-9]{6,}$/.test(qrData)) {
        return qrData;
    }

    return null;
}

function stopCamera() {
    scanning = false;
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
}

// ===== VOUCHER PROCESSING =====
async function processVoucherCode(code) {
    transitionToConfirmation();
    setLoadingState();

    try {
        // Call API to get pass data
        const response = await fetch(`/api/pass?code=${encodeURIComponent(code)}`, {
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Gutschein konnte nicht verarbeitet werden');
        }

        // Success
        setSuccessState(data.voucher);
        window.currentPassData = {
            passUrl: data.passUrl,
            code: code
        };

        // Auto-trigger download after brief delay for UX
        downloadBtn.style.display = 'block';

        // Haptic feedback (if available)
        if (navigator.vibrate) {
            navigator.vibrate(200);
        }

    } catch (err) {
        console.error('Processing error:', err);
        setErrorState(err.message);
    }
}

async function downloadPass() {
    if (!window.currentPassData) {
        setErrorState('Pass-Datei nicht verfügbar');
        return;
    }

    try {
        downloadBtn.disabled = true;
        downloadBtn.textContent = '⏳ Wird heruntergeladen...';

        const { passUrl, code } = window.currentPassData;

        if (passUrl.startsWith('data:') || passUrl.startsWith('blob:')) {
            downloadFromUrl(passUrl, `lila-${code}.pkpass`);
        } else {
            const response = await fetch(passUrl);
            if (!response.ok) throw new Error('Download failed');

            const blob = await response.blob();
            downloadBlob(blob, `lila-${code}.pkpass`);
        }

        downloadBtn.disabled = false;
        downloadBtn.textContent = 'Zu Wallet hinzufügen';

    } catch (err) {
        console.error('Download error:', err);
        setErrorState('Fehler beim Download');
        downloadBtn.disabled = false;
        downloadBtn.textContent = 'Zu Wallet hinzufügen';
    }
}

function downloadFromUrl(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    downloadFromUrl(url, filename);
    setTimeout(() => URL.revokeObjectURL(url), 100);
}

// ===== UI STATE TRANSITIONS =====
function transitionToConfirmation() {
    scannerPage.classList.remove('active');
    confirmationPage.classList.add('active');
}

function goBackToScanner() {
    confirmationPage.classList.remove('active');
    scannerPage.classList.add('active');

    // Reset confirmation page
    voucherCard.classList.add('hidden');
    errorContainer.classList.add('hidden');
    downloadBtn.style.display = 'none';
    downloadBtn.disabled = false;
    downloadBtn.textContent = 'Zu Wallet hinzufügen';

    // Reset scanner
    startBtn.style.display = 'block';
    startBtn.disabled = false;
    startBtn.textContent = 'Kamera starten';
    isProcessing = false;
    window.currentPassData = null;

    startCamera();
}

function setLoadingState() {
    confirmIcon.textContent = '⏳';
    confirmTitle.textContent = 'Wird verarbeitet...';
    confirmSubtitle.textContent = 'Bitte warten';
    voucherCard.classList.add('hidden');
    errorContainer.classList.add('hidden');
}

function setSuccessState(voucher) {
    confirmIcon.innerHTML = '✓';
    confirmIcon.style.color = 'var(--color-success)';
    confirmTitle.textContent = 'Fertig!';
    confirmSubtitle.textContent = 'Dein Pass ist bereit';

    voucherBusiness.textContent = voucher.businessName || 'Business';
    voucherOffer.textContent = voucher.offer || 'Gutschein';
    voucherCode.textContent = voucher.code || '';

    voucherCard.classList.remove('hidden');
    errorContainer.classList.add('hidden');
}

function setErrorState(message) {
    confirmIcon.textContent = '✕';
    confirmIcon.style.color = 'var(--color-error)';
    confirmTitle.textContent = 'Fehler';
    confirmSubtitle.textContent = 'Gutschein konnte nicht geladen werden';

    voucherCard.classList.add('hidden');
    errorContainer.textContent = message;
    errorContainer.classList.remove('hidden');
}

function showError(message) {
    alert(message);
    scannerPage.classList.add('active');
    confirmationPage.classList.remove('active');
    isProcessing = false;
}
