// Read capture time and GPS from a photo BEFORE it is resized (resizing strips EXIF).
export async function readExif(file) {
  try {
    const mod = await import("exifr");
    const exifr = mod.default || mod;
    const [gps, tags] = await Promise.all([
      exifr.gps(file).catch(() => null),
      exifr.parse(file, ["DateTimeOriginal", "CreateDate"]).catch(() => null),
    ]);
    const t = tags && (tags.DateTimeOriginal || tags.CreateDate);
    return {
      takenAt: t instanceof Date && !isNaN(t) ? t.getTime() : undefined,
      lat: gps && typeof gps.latitude === "number" ? gps.latitude : undefined,
      lng: gps && typeof gps.longitude === "number" ? gps.longitude : undefined,
    };
  } catch {
    return {};
  }
}