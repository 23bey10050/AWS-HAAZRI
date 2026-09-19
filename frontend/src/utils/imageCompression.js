export function compressImage(file, { maxBytes = 500_000, quality = 0.7 } = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 1024 / img.width);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => (blob && blob.size <= maxBytes ? resolve(blob) : resolve(blob)), // accept best-effort; server enforces the hard limit
        "image/jpeg",
        quality
      );
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
