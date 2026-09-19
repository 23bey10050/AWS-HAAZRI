export function captureLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("Geolocation unsupported"));
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          gps_lat: pos.coords.latitude,
          gps_lng: pos.coords.longitude,
          gps_accuracy: pos.coords.accuracy,
        }),
      (error) => reject(error),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  });
}
