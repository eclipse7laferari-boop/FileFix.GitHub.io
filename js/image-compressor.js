// =========================
// IMAGE COMPRESSOR
// IMAGE UPLOAD SYSTEM
// =========================

const imageInput = document.getElementById("imageInput");
const uploadButton = document.getElementById("uploadButton");
const uploadBox = document.getElementById("uploadBox");

const imageInformation = document.getElementById("imageInformation");
const imagePreview = document.getElementById("imagePreview");

const fileName = document.getElementById("fileName");
const originalSize = document.getElementById("originalSize");

const removeImage = document.getElementById("removeImage");

// TOAST NOTIFICATIONS

const toastMessage = document.getElementById("toastMessage");
const toastIcon = document.getElementById("toastIcon");
const toastText = document.getElementById("toastText");

let toastTimeout;

function showToast(message, type = "success") {
    clearTimeout(toastTimeout);

    toastText.textContent = message;

    if (type === "success") {
        toastIcon.textContent = "✓";
        toastIcon.style.background = "#dcfce7";
        toastIcon.style.color = "#16a34a";
    } else {
        toastIcon.textContent = "!";
        toastIcon.style.background = "#fee2e2";
        toastIcon.style.color = "#dc2626";
    }

    toastMessage.classList.add("show");

    toastTimeout = setTimeout(() => {
        toastMessage.classList.remove("show");
    }, 3500);
}

// COMPRESSION HISTORY

const historyList = document.getElementById("historyList");
const clearHistoryButton = document.getElementById("clearHistory");

// HISTORY STATISTICS

const statTotal = document.getElementById("statTotal");
const statSaved = document.getElementById("statSaved");
const statAverage = document.getElementById("statAverage");

function updateHistoryStats(history) {
    statTotal.textContent = history.length;

    const validEntries = history.filter(
        item => typeof item.originalBytes === "number"
        && typeof item.compressedBytes === "number"
        && typeof item.savedPercentage === "number"
    );

    const totalSaved = validEntries.reduce(
        (sum, item) => sum + item.originalBytes - item.compressedBytes,
        0
    );

    const average = validEntries.length
        ? validEntries.reduce((sum, item) => sum + item.savedPercentage, 0) / validEntries.length
        : 0;

    statSaved.textContent = formatFileSize(Math.max(0, totalSaved));

    statAverage.textContent = average.toFixed(1) + "%";
}

const HISTORY_KEY = "filefix-compression-history";

// COMPRESSED FILE STORAGE

function openFileFixDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("FileFixDB", 1);

        request.onupgradeneeded = () => {
            const db = request.result;

            if (!db.objectStoreNames.contains("compressedFiles")) {
                db.createObjectStore("compressedFiles");
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function saveCompressedFile(id, blob) {
    const db = await openFileFixDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction("compressedFiles", "readwrite");

        transaction.objectStore("compressedFiles").put(blob, id);

        transaction.oncomplete = () => {
            db.close();
            resolve();
        };

        transaction.onerror = () => {
            db.close();
            reject(transaction.error);
        };
    });
}

async function getCompressedFile(id) {
    const db = await openFileFixDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction("compressedFiles", "readonly");
        const request = transaction.objectStore("compressedFiles").get(id);

        request.onsuccess = () => {
            db.close();
            resolve(request.result);
        };

        request.onerror = () => {
            db.close();
            reject(request.error);
        };
    });
}

function getCompressionHistory() {
    try {
        return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
    } catch {
        return [];
    }
}

function renderCompressionHistory() {
    const history = getCompressionHistory();

    updateHistoryStats(history);

    historyList.innerHTML = "";

    if (history.length === 0) {
        historyList.innerHTML = `
            <p class="history-empty">
                No compression history yet.
            </p>
        `;
        return;
    }

    history.forEach((item, index) => {
        const historyItem = document.createElement("div");
        historyItem.className = "history-item";

        const fileInfo = document.createElement("div");
        fileInfo.className = "history-file";

        const name = document.createElement("strong");
        name.textContent = item.name;

        const sizes = document.createElement("span");
        sizes.textContent =
            `${item.originalSize} → ${item.compressedSize}`;

        const saved = document.createElement("div");
        saved.className = "history-saved";
        saved.textContent = item.saved;

        const downloadHistoryButton = document.createElement("button");

        downloadHistoryButton.className = "history-download";
        downloadHistoryButton.type = "button";
        downloadHistoryButton.textContent = "↓";
        downloadHistoryButton.setAttribute(
            "aria-label",
            "Download compressed image"
        );

        downloadHistoryButton.addEventListener("click", async () => {
            try {
                const blob = await getCompressedFile(item.id);

                if (!blob) {
                    showToast("File not found. Please compress the image again.", "error");
                    return;
                }

                const url = URL.createObjectURL(blob);

                const link = document.createElement("a");
                link.href = url;
                link.download = item.name.replace(/\.[^.]+$/, "") + "-compressed." +
                    (blob.type === "image/webp" ? "webp" : "jpg");

                document.body.appendChild(link);
                link.click();
                link.remove();

                setTimeout(() => URL.revokeObjectURL(url), 1000);

                showToast("Image downloaded successfully!");
            } catch (error) {
                console.error(error);
                showToast("Could not download this image.", "error");
            }
        });

        const deleteButton = document.createElement("button");
        deleteButton.className = "history-delete";
        deleteButton.type = "button";
        deleteButton.textContent = "×";
        deleteButton.setAttribute("aria-label", "Delete this history item");

        deleteButton.addEventListener("click", () => {
            deleteHistoryItem(index);
        });

        if (item.thumbnail) {
            const thumbnail = document.createElement("img");

            thumbnail.className = "history-thumbnail";
            thumbnail.src = item.thumbnail;
            thumbnail.alt = "Compressed image";

            historyItem.appendChild(thumbnail);
        }

        fileInfo.append(name, sizes);

        historyItem.append(
            fileInfo,
            saved,
            downloadHistoryButton,
            deleteButton
        );
        historyList.appendChild(historyItem);
    });
}

function deleteHistoryItem(index) {
    const history = getCompressionHistory();

    history.splice(index, 1);

    localStorage.setItem(
        HISTORY_KEY,
        JSON.stringify(history)
    );

    renderCompressionHistory();

    showToast("History item deleted!");
}

// CREATE HISTORY THUMBNAIL

async function createHistoryThumbnail(blob) {
    const image = await createImageBitmap(blob);

    const canvas = document.createElement("canvas");

    const maxSize = 120;
    const scale = Math.min(
        maxSize / image.width,
        maxSize / image.height,
        1
    );

    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);

    const context = canvas.getContext("2d");

    context.drawImage(
        image,
        0,
        0,
        canvas.width,
        canvas.height
    );

    image.close();

    return canvas.toDataURL("image/jpeg", 0.65);
}

function addCompressionToHistory(item) {
    const history = getCompressionHistory();

    history.unshift(item);

    localStorage.setItem(
        HISTORY_KEY,
        JSON.stringify(history.slice(0, 10))
    );

    renderCompressionHistory();
}

clearHistoryButton.addEventListener("click", () => {
    localStorage.removeItem(HISTORY_KEY);
    renderCompressionHistory();
    showToast("Compression history cleared!");
});

renderCompressionHistory();

let selectedImage = null;
let previewUrl = null;


// =========================
// FORMAT FILE SIZE
// =========================

function formatFileSize(bytes) {

    if (bytes < 1024) {
        return bytes + " B";
    }

    if (bytes < 1024 * 1024) {
        return (bytes / 1024).toFixed(2) + " KB";
    }

    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}


// =========================
// OPEN FILE SELECTOR
// =========================

uploadButton.addEventListener("click", () => {
    imageInput.click();
});


// =========================
// HANDLE IMAGE UPLOAD
// =========================

function handleImageUpload(file) {

    if (!file) return;

    // Reset previous compression result
    compressedBlob = null;
    compressionResult.hidden = true;

    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];

    if (!allowedTypes.includes(file.type)) {
        alert("Please select a JPG, PNG or WEBP image.");
        return;
    }

    if (file.size > 20 * 1024 * 1024) {
        alert("The image is too large. Maximum size is 20 MB.");
        return;
    }

    if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
    }

    selectedImage = file;
    previewUrl = URL.createObjectURL(file);

    imagePreview.onload = () => {
        imageInformation.hidden = false;
        uploadBox.hidden = true;
    };

    imagePreview.onerror = () => {
        alert("Could not load this image. Please try another file.");
        resetImage();
    };

    imagePreview.src = previewUrl;

    fileName.textContent = file.name;
    originalSize.textContent = formatFileSize(file.size);
}


// =========================
// FILE INPUT CHANGE
// =========================

imageInput.addEventListener("change", (event) => {

    const file = event.target.files[0];

    handleImageUpload(file);

});


// =========================
// DRAG AND DROP
// =========================

uploadBox.addEventListener("dragover", (event) => {

    event.preventDefault();

    uploadBox.classList.add("drag-active");

});

uploadBox.addEventListener("dragleave", () => {

    uploadBox.classList.remove("drag-active");

});

uploadBox.addEventListener("drop", (event) => {

    event.preventDefault();

    uploadBox.classList.remove("drag-active");

    const file = event.dataTransfer.files[0];

    handleImageUpload(file);

});


// =========================
// REMOVE IMAGE
// =========================

function resetImage() {

    selectedImage = null;

    compressedBlob = null;
    compressedFileName = "";
    compressionResult.hidden = true;

    // Clear comparison previews

    if (compressedPreviewUrl) {
        URL.revokeObjectURL(compressedPreviewUrl);
        compressedPreviewUrl = null;
    }

    originalPreview.removeAttribute("src");
    compressedPreview.removeAttribute("src");

    if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        previewUrl = null;
    }

    imagePreview.removeAttribute("src");

    imageInput.value = "";

    imageInformation.hidden = true;
    uploadBox.hidden = false;

}

removeImage.addEventListener("click", resetImage);

console.log("FileFix Image Upload initialized!");
// =========================
// COMPRESSION QUALITY
// =========================

const qualityRange = document.getElementById("qualityRange");
const qualityValue = document.getElementById("qualityValue");

qualityRange.addEventListener("input", () => {

    const quality = qualityRange.value;

    qualityValue.textContent = quality + "%";

});
// =========================
// IMAGE COMPRESSION ENGINE
// =========================

const compressButton = document.getElementById("compressButton");
const compressionResult = document.getElementById("compressionResult");
const compressionProgress = document.getElementById("compressionProgress");

const originalPreview = document.getElementById("originalPreview");
const compressedPreview = document.getElementById("compressedPreview");

// BEFORE / AFTER COMPARISON SLIDER
const comparisonSlider = document.getElementById("comparisonSlider");
const comparisonRange = document.getElementById("comparisonRange");
const comparisonAfter = document.getElementById("comparisonAfter");
const comparisonDivider = document.getElementById("comparisonDivider");

comparisonRange.addEventListener("input", () => {

    const value = comparisonRange.value;

    comparisonAfter.style.width = value + "%";
    comparisonDivider.style.left = value + "%";

});

let compressedPreviewUrl = null;

const resultOriginalSize = document.getElementById("resultOriginalSize");
const resultCompressedSize = document.getElementById("resultCompressedSize");
const resultSaved = document.getElementById("resultSaved");

const downloadButton = document.getElementById("downloadButton");

let compressedBlob = null;
let compressedFileName = "";


// =========================
// COMPRESS IMAGE
// =========================

compressButton.addEventListener("click", async () => {

    if (!selectedImage) {
        alert("Please upload an image first.");
        return;
    }

    compressButton.disabled = true;
    compressButton.textContent = "Compressing...";
    compressionProgress.hidden = false;

    try {

        const quality = Number(qualityRange.value) / 100;

        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        const image = new Image();

        image.src = previewUrl;

        await new Promise((resolve, reject) => {
            image.onload = resolve;
            image.onerror = reject;
        });

        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;

        context.drawImage(
            image,
            0,
            0,
            canvas.width,
            canvas.height
        );

        // PNG will be converted to WebP
        const outputType = selectedImage.type === "image/png"
            ? "image/webp"
            : selectedImage.type;

        compressedBlob = await new Promise(resolve => {

            canvas.toBlob(
                resolve,
                outputType,
                quality
            );

        });

        if (!compressedBlob) {
            throw new Error("Image compression failed.");
        }

        // Update image comparison preview

        if (compressedPreviewUrl) {
            URL.revokeObjectURL(compressedPreviewUrl);
        }

        compressedPreviewUrl = URL.createObjectURL(compressedBlob);

        // Show result BEFORE calculating its dimensions
        compressionResult.hidden = false;

        // Compressed image on the right
        originalPreview.src = compressedPreviewUrl;

        // Original image on the left
        compressedPreview.src = previewUrl;

        // Match the comparison area to the original image proportions
        comparisonSlider.style.aspectRatio =
            image.naturalWidth + " / " + image.naturalHeight;

        // Update comparison dimensions
        function updateComparisonSize() {
            const width = comparisonSlider.clientWidth;
            const height = comparisonSlider.clientHeight;

            originalPreview.style.width = width + "px";
            originalPreview.style.height = height + "px";

            compressedPreview.style.width = width + "px";
            compressedPreview.style.height = height + "px";
        }

        updateComparisonSize();

        // Reset slider position
        comparisonRange.value = 50;
        comparisonAfter.style.width = "50%";
        comparisonDivider.style.left = "50%";

        // Keep both images at the same dimensions
        function updateComparisonSize() {
            const width = comparisonSlider.clientWidth;
            const height = comparisonSlider.clientHeight;

            compressedPreview.style.width = width + "px";
            compressedPreview.style.height = height + "px";
        }

        updateComparisonSize();

        // Calculate compression results

        const originalBytes = selectedImage.size;
        const compressedBytes = compressedBlob.size;

        const savedPercentage = (
            (1 - compressedBytes / originalBytes) * 100
        ).toFixed(1);

        resultOriginalSize.textContent =
            formatFileSize(originalBytes);

        resultCompressedSize.textContent =
            formatFileSize(compressedBytes);

        if (savedPercentage > 0) {
            resultSaved.textContent = savedPercentage + "% saved";
        } else if (savedPercentage < 0) {
            resultSaved.textContent = Math.abs(savedPercentage) + "% larger";
        } else {
            resultSaved.textContent = "No size change";
        }

        // Prepare download filename

        const originalName = selectedImage.name.replace(/\.[^.]+$/, "");

        const extension = outputType === "image/webp"
            ? "webp"
            : "jpg";

        compressedFileName = originalName + "-compressed." + extension;

        // SAVE COMPRESSION TO HISTORY

        const historyId = crypto.randomUUID();

        await saveCompressedFile(historyId, compressedBlob);

        addCompressionToHistory({
            id: historyId,
            name: selectedImage.name,
            originalSize: formatFileSize(originalBytes),
            compressedSize: formatFileSize(compressedBytes),
            saved: resultSaved.textContent,

            originalBytes: originalBytes,
            compressedBytes: compressedBytes,
            savedPercentage: Number(savedPercentage),

            thumbnail: await createHistoryThumbnail(compressedBlob)
        });

        compressionResult.hidden = false;

        showToast("Image compressed successfully!");

    } catch (error) {

        console.error(error);

        showToast("Something went wrong. Please try again.", "error");

    } 
    finally {

    compressButton.disabled = false;
    compressButton.textContent = "Compress Image";

    compressionProgress.hidden = true;

    }

});
// =========================
// DOWNLOAD COMPRESSED IMAGE
// =========================

downloadButton.addEventListener("click", () => {

    if (!compressedBlob) return;

    const downloadUrl = URL.createObjectURL(compressedBlob);

    const link = document.createElement("a");

    link.href = downloadUrl;
    link.download = compressedFileName;

    document.body.appendChild(link);

    link.click();

    link.remove();

    URL.revokeObjectURL(downloadUrl);

});
// BATCH COMPRESSION

const batchImageInput = document.getElementById("batchImageInput");
const batchUploadButton = document.getElementById("batchUploadButton");
const batchFileList = document.getElementById("batchFileList");
const batchCompressButton = document.getElementById("batchCompressButton");
const batchDropZone = document.getElementById("batchDropZone");

let batchSelectedFiles = [];

batchUploadButton.addEventListener("click", () => {
    batchImageInput.click();
});

batchImageInput.addEventListener("change", () => {
    const files = Array.from(batchImageInput.files);

    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];

    const validFiles = files.filter(file => {
        if (!allowedTypes.includes(file.type)) {
            showToast("Unsupported file: " + file.name, "error");
            return false;
        }

        if (file.size > 20 * 1024 * 1024) {
            showToast("File is too large: " + file.name, "error");
            return false;
        }

        return true;
    });

    const remainingSlots = 20 - batchSelectedFiles.length;

    batchSelectedFiles = [
        ...batchSelectedFiles,
        ...validFiles.slice(0, remainingSlots)
    ];

    if (validFiles.length > remainingSlots) {
        showToast("Maximum 20 images allowed.", "error");
    }

    renderBatchFiles();

    if (files.length > 20) {
        showToast("Maximum 20 images allowed.", "error");
    }

    batchImageInput.value = "";
});

// BATCH DRAG & DROP

batchDropZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    batchDropZone.classList.add("drag-over");
});

batchDropZone.addEventListener("dragleave", () => {
    batchDropZone.classList.remove("drag-over");
});

batchDropZone.addEventListener("drop", (event) => {
    event.preventDefault();
    batchDropZone.classList.remove("drag-over");

    const files = Array.from(event.dataTransfer.files);

    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];

    const validFiles = files.filter(file => {
        if (!allowedTypes.includes(file.type)) {
            showToast("Unsupported file: " + file.name, "error");
            return false;
        }

        if (file.size > 20 * 1024 * 1024) {
            showToast("File is too large: " + file.name, "error");
            return false;
        }

        return true;
    });

    const remainingSlots = 20 - batchSelectedFiles.length;

    batchSelectedFiles = [
        ...batchSelectedFiles,
        ...validFiles.slice(0, remainingSlots)
    ];

    renderBatchFiles();

    if (validFiles.length > remainingSlots) {
        showToast("Maximum 20 images allowed.", "error");
    }
});

function renderBatchFiles() {
    batchFileList.querySelectorAll("img").forEach(image => {
        URL.revokeObjectURL(image.src);
    });

    batchFileList.innerHTML = "";

    batchSelectedFiles.forEach((file, index) => {
        const item = document.createElement("div");
        item.className = "batch-file-item";

        // IMAGE PREVIEW
        const thumbnail = document.createElement("img");
        thumbnail.className = "batch-thumbnail";
        thumbnail.src = URL.createObjectURL(file);
        thumbnail.alt = file.name;

        const name = document.createElement("span");
        name.className = "batch-file-name";
        name.textContent = file.name;

        const size = document.createElement("span");
        size.className = "batch-file-size";
        size.textContent = formatFileSize(file.size);

        const removeButton = document.createElement("button");
        removeButton.className = "batch-remove-button";
        removeButton.type = "button";
        removeButton.textContent = "×";
        removeButton.setAttribute("aria-label", "Remove " + file.name);

        removeButton.addEventListener("click", () => {
            batchSelectedFiles.splice(index, 1);
            renderBatchFiles();
        });

        item.append(thumbnail, name, size, removeButton);
        batchFileList.appendChild(item);
    });

    batchCompressButton.disabled = batchSelectedFiles.length === 0;
}

const batchProgress = document.getElementById("batchProgress");
const batchProgressText = document.getElementById("batchProgressText");
const batchProgressFill = document.getElementById("batchProgressFill");
const batchDownloadButton = document.getElementById("batchDownloadButton");
const batchClearButton = document.getElementById("batchClearButton");

let batchCompressedFiles = [];
let batchZipBlob = null;
function compressBatchImage(file, quality) {
    return new Promise(async (resolve, reject) => {
        try {
            const image = await createImageBitmap(file);

            const canvas = document.createElement("canvas");
            canvas.width = image.width;
            canvas.height = image.height;

            const context = canvas.getContext("2d");
            context.drawImage(image, 0, 0);

            image.close();

            const outputType = file.type === "image/png"
                ? "image/webp"
                : file.type;

            canvas.toBlob(blob => {
                if (!blob) {
                    reject(new Error("Image compression failed."));
                    return;
                }

                const extension = outputType === "image/webp"
                    ? "webp"
                    : "jpg";

                const name = file.name.replace(/\.[^.]+$/, "") +
                    "-compressed." + extension;

                resolve({ name, blob });
            }, outputType, quality);

        } catch (error) {
            reject(error);
        }
    });
}
batchCompressButton.addEventListener("click", async () => {
    if (batchSelectedFiles.length === 0) return;

    if (typeof JSZip === "undefined") {
        showToast("ZIP library could not be loaded.", "error");
        return;
    }

    batchCompressButton.disabled = true;
    batchDownloadButton.hidden = true;
    batchProgress.hidden = false;

    batchCompressedFiles = [];
    batchZipBlob = null;

    const quality = Number(qualityRange.value) / 100;
    const total = batchSelectedFiles.length;

    try {
        for (let i = 0; i < total; i++) {
            const file = batchSelectedFiles[i];

            batchProgressText.textContent =
                `Compressing ${i + 1} of ${total}: ${file.name}`;

            const compressed = await compressBatchImage(file, quality);
            batchCompressedFiles.push(compressed);

            const progress = ((i + 1) / total) * 100;
            batchProgressFill.style.width = progress + "%";
        }

        const zip = new JSZip();

        batchCompressedFiles.forEach(file => {
            zip.file(file.name, file.blob);
        });

        batchProgressText.textContent = "Creating ZIP archive...";

        batchZipBlob = await zip.generateAsync({ type: "blob" });

        batchProgressText.textContent =
            `Done! ${total} images compressed successfully.`;

        batchDownloadButton.hidden = false;

        showToast("All images compressed successfully!");

    } catch (error) {
        console.error(error);
        batchProgressText.textContent = "Compression failed.";
        showToast("Could not compress the images.", "error");

    } finally {
        batchCompressButton.disabled = false;
    }
});
batchDownloadButton.addEventListener("click", () => {
    if (!batchZipBlob) {
        showToast("ZIP archive is not ready.", "error");
        return;
    }

    const url = URL.createObjectURL(batchZipBlob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "filefix-images.zip";

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);

    showToast("ZIP archive downloaded successfully!");
});
batchClearButton.addEventListener("click", () => {
    batchSelectedFiles = [];
    batchCompressedFiles = [];
    batchZipBlob = null;

    batchFileList.innerHTML = "";
    batchCompressButton.disabled = true;

    batchDownloadButton.hidden = true;

    batchProgress.hidden = true;
    batchProgressFill.style.width = "0%";

    batchImageInput.value = "";

    showToast("All selected images removed!");
});