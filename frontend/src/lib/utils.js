import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Resize & compress an image file and return a base64 data URL (JPEG)
// This helps keep API payloads much smaller, especially on mobile networks.
export function resizeImageFile(file, maxSize = 1280, quality = 0.7) {
  return new Promise((resolve, reject) => {
    try {
      const img = new Image();
      const reader = new FileReader();

      reader.onload = (e) => {
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let { width, height } = img;

          if (width > height && width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          } else if (height >= width && height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Canvas context not available"));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL("image/jpeg", quality);
          resolve(dataUrl);
        };

        img.onerror = (err) => reject(err);
        img.src = e.target.result;
      };

      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    } catch (err) {
      reject(err);
    }
  });
}
