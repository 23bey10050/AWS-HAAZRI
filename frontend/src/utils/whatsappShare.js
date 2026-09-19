import { getUploadUrl } from "../api/client";

export async function shareSummaryBlob(blob, shareText) {
  const { upload_url } = await getUploadUrl({
    media_type: "selfie", // reuse the same signed-URL flow/limits path
    file_type: "image/png",
    file_size_bytes: blob.size,
  });
  await fetch(upload_url, { method: "PUT", body: blob, headers: { "Content-Type": "image/png" } });

  const file = new File([blob], "haazri-summary.png", { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], text: shareText, title: "Haazri Monthly Summary" });
  } else {
    // Fallback: WhatsApp deep link with text only (image already uploaded for reference)
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank");
  }
}
