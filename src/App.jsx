import { useEffect, useRef, useState } from "react";
import imageCompression from "browser-image-compression";
import JSZip from "jszip";
import { LogoZip } from "./components/LogoZip";

const MAX_DIMENSION = 1920;
const MAX_SIZE_MB = 1;

const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const savingPercent = (original, converted) =>
  original > 0 ? Math.round((1 - converted / original) * 100) : 0;

// "foto.final.jpg" -> "foto.final.webp" (solo se reemplaza la última extensión)
const toWebpName = (name) => name.replace(/\.[^.]+$/, "") + ".webp";

const fileKey = (file) => `${file.name}-${file.size}-${file.lastModified}`;

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
};

function App() {
  const [images, setImages] = useState([]);
  const [convertedImages, setConvertedImages] = useState([]);
  const [errors, setErrors] = useState([]);
  const [notices, setNotices] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [downloaded, setDownloaded] = useState(false);
  const [keepOriginalSize, setKeepOriginalSize] = useState(false);
  const [quality, setQuality] = useState(0.8);
  const inputRef = useRef(null);
  const imagesRef = useRef(images);
  imagesRef.current = images;

  // Libera las URLs de previsualización al desmontar
  useEffect(() => {
    return () => {
      imagesRef.current.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    };
  }, []);

  // Evita que soltar un archivo fuera de la zona navegue a la imagen,
  // y resalta la zona en cuanto entra un arrastre a la ventana.
  useEffect(() => {
    const onDragOver = (e) => {
      e.preventDefault();
      setIsDragging(true);
    };
    const onDragLeave = (e) => {
      // relatedTarget es null cuando el cursor sale de la ventana
      if (e.relatedTarget === null) setIsDragging(false);
    };
    const onDrop = (e) => {
      e.preventDefault();
      setIsDragging(false);
    };

    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  const handleFiles = (files) => {
    const existingKeys = new Set(images.map((img) => fileKey(img.file)));
    const accepted = [];
    const notImages = [];
    let duplicates = 0;

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) {
        notImages.push(file.name);
        return;
      }
      const key = fileKey(file);
      if (existingKeys.has(key)) {
        duplicates += 1;
        return;
      }
      existingKeys.add(key);
      accepted.push({
        id: `${key}-${Math.random()}`,
        file,
        previewUrl: URL.createObjectURL(file),
      });
    });

    const newNotices = [];
    if (notImages.length > 0) {
      newNotices.push(
        `${notImages.length === 1 ? "1 archivo ignorado" : `${notImages.length} archivos ignorados`} por no ser ${notImages.length === 1 ? "una imagen" : "imágenes"}: ${notImages.join(", ")}`
      );
    }
    if (duplicates > 0) {
      newNotices.push(
        duplicates === 1
          ? "1 imagen duplicada omitida."
          : `${duplicates} imágenes duplicadas omitidas.`
      );
    }
    setNotices(newNotices);

    if (accepted.length === 0) return;

    setImages((prevImages) => [...prevImages, ...accepted]);
    // Cualquier conversión anterior queda obsoleta al añadir imágenes nuevas
    setConvertedImages([]);
    setErrors([]);
    setDownloaded(false);
  };

  const handleRemoveImage = (id) => {
    setImages((prevImages) => {
      const image = prevImages.find((img) => img.id === id);
      if (image) URL.revokeObjectURL(image.previewUrl);
      return prevImages.filter((img) => img.id !== id);
    });
    setConvertedImages((prev) => prev.filter((img) => img.id !== id));
    setErrors((prev) => prev.filter((err) => err.id !== id));
  };

  const handleReset = () => {
    images.forEach((img) => URL.revokeObjectURL(img.previewUrl));
    setImages([]);
    setConvertedImages([]);
    setErrors([]);
    setNotices([]);
    setProgress({ done: 0, total: 0 });
    setDownloaded(false);
  };

  const openFilePicker = () => {
    if (!isConverting) inputRef.current?.click();
  };

  const handleDropZoneKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openFilePicker();
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (!isConverting) handleFiles(e.dataTransfer.files);
  };

  const handleImageChange = (e) => {
    handleFiles(e.target.files);
    // Permite volver a seleccionar el mismo archivo tras quitarlo
    e.target.value = "";
  };

  const handleConvert = async () => {
    if (images.length === 0 || isConverting) return;

    const options = {
      useWebWorker: true,
      fileType: "image/webp",
      initialQuality: quality,
      ...(keepOriginalSize
        ? { maxSizeMB: Number.POSITIVE_INFINITY }
        : { maxSizeMB: MAX_SIZE_MB, maxWidthOrHeight: MAX_DIMENSION }),
    };

    setIsConverting(true);
    setProgress({ done: 0, total: images.length });
    setConvertedImages([]);
    setErrors([]);
    setNotices([]);
    setDownloaded(false);

    const results = await Promise.allSettled(
      images.map(async ({ id, file }) => {
        try {
          const compressedImage = await imageCompression(file, options);
          return {
            id,
            name: toWebpName(file.name),
            originalName: file.name,
            originalSize: file.size,
            file: compressedImage,
          };
        } finally {
          setProgress((prev) => ({ ...prev, done: prev.done + 1 }));
        }
      })
    );

    const converted = [];
    const failed = [];
    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        converted.push(result.value);
      } else {
        failed.push({
          id: images[index].id,
          name: images[index].file.name,
          message: result.reason?.message || "Error desconocido",
        });
      }
    });

    setConvertedImages(converted);
    setErrors(failed);
    setIsConverting(false);
  };

  const handleDownloadSingle = ({ name, file }) => {
    downloadBlob(file, name);
    setDownloaded(true);
  };

  const handleDownload = async () => {
    if (convertedImages.length === 0) return;

    // Con una sola imagen no tiene sentido obligar a descomprimir un ZIP
    if (convertedImages.length === 1) {
      handleDownloadSingle(convertedImages[0]);
      return;
    }

    const zip = new JSZip();
    convertedImages.forEach(({ name, file }) => {
      zip.file(name, file);
    });

    const zipBlob = await zip.generateAsync({ type: "blob" });
    downloadBlob(zipBlob, "converted_images.zip");
    setDownloaded(true);
  };

  const convertedById = new Map(convertedImages.map((img) => [img.id, img]));
  const errorById = new Map(errors.map((err) => [err.id, err]));
  const totalOriginal = convertedImages.reduce((sum, img) => sum + img.originalSize, 0);
  const totalConverted = convertedImages.reduce((sum, img) => sum + img.file.size, 0);
  const hasResults = convertedImages.length > 0 || errors.length > 0;
  const isSingleDownload = convertedImages.length === 1;

  return (
    <div className="h-full bg-blue-medium flex flex-col justify-center items-center">
      <div className="w-full max-w-3xl flex flex-col justify-center items-center gap-5 border-0 md:border-2 border-border px-4 py-7 md:px-11 md:py-16 rounded-2xl">
        <h1 className="text-2xl font-bold text-center text-white md:text-5xl">
          Convertir Imágenes a WebP
        </h1>
        <p className="text-grey-300 text-center text-sm md:text-base -mt-2">
          🔒 La conversión ocurre en tu navegador: tus imágenes nunca salen de tu dispositivo.
        </p>

        <div
          className={`w-full flex flex-col gap-4 drop-zone ${
            isDragging ? "dragging" : ""
          } ${isConverting ? "cursor-not-allowed opacity-60" : ""}`}
          role="button"
          tabIndex={0}
          aria-label="Arrastra imágenes aquí o pulsa para seleccionarlas"
          aria-disabled={isConverting}
          onClick={openFilePicker}
          onKeyDown={handleDropZoneKeyDown}
          onDrop={handleDrop}
        >
          <p className="text-golden font-bold">
            Arrastra y suelta las imágenes aquí, o
          </p>

          {images.length === 0 && (
            <p className="text-grey-300 text-xs -mt-2">
              JPG, PNG, GIF, BMP o WebP · sin límite de cantidad
            </p>
          )}

          {images.length > 0 && (
            <p
              className="bg-blue py-3 rounded-lg flex items-center justify-center gap-1 text-lg text-white text-center"
              aria-live="polite"
            >
              <span className="text-golden font-bold text-2xl">
                {images.length}{" "}
              </span>
              {images.length === 1 ? "Imagen añadida" : "Imágenes añadidas"}.
            </p>
          )}

          <input
            ref={inputRef}
            id="file-input"
            className="hidden"
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageChange}
            tabIndex={-1}
          />
          <label
            htmlFor="file-input"
            className="text-white underline font-bold cursor-pointer"
            onClick={(e) => {
              // El label ya abre el selector; evita que la zona lo abra otra vez
              e.stopPropagation();
              if (isConverting) e.preventDefault();
            }}
          >
            Seleccionar imágenes
          </label>
        </div>

        {notices.length > 0 && (
          <div
            className="w-full bg-golden/10 border border-golden rounded-lg p-3 text-left text-sm text-white"
            role="status"
          >
            {notices.map((notice) => (
              <p key={notice}>{notice}</p>
            ))}
          </div>
        )}

        {images.length > 0 && (
          <ul className="w-full grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {images.map(({ id, file, previewUrl }) => {
              const converted = convertedById.get(id);
              const error = errorById.get(id);
              return (
                <li
                  key={id}
                  className={`relative bg-blue rounded-lg overflow-hidden border ${
                    error ? "border-red-500" : "border-border"
                  }`}
                >
                  <button
                    type="button"
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 text-white text-sm leading-none hover:bg-red-500 disabled:opacity-40"
                    onClick={() => handleRemoveImage(id)}
                    disabled={isConverting}
                    aria-label={`Quitar ${file.name}`}
                    title="Quitar"
                  >
                    ✕
                  </button>
                  <img
                    src={previewUrl}
                    alt={file.name}
                    className="w-full h-24 object-cover"
                  />
                  <div className="p-2 text-left text-xs text-white">
                    <p className="truncate font-semibold" title={file.name}>
                      {file.name}
                    </p>
                    {converted ? (
                      <>
                        <p className="text-grey-300">
                          <span className="line-through">
                            {formatBytes(converted.originalSize)}
                          </span>{" "}
                          → <span className="text-white">{formatBytes(converted.file.size)}</span>{" "}
                          <span className="text-golden font-bold">
                            −{savingPercent(converted.originalSize, converted.file.size)}%
                          </span>
                        </p>
                        <button
                          type="button"
                          className="mt-1 text-golden underline hover:text-white"
                          onClick={() => handleDownloadSingle(converted)}
                        >
                          Descargar
                        </button>
                      </>
                    ) : error ? (
                      <p className="text-red-400" title={error.message}>
                        No se pudo convertir
                      </p>
                    ) : (
                      <p className="text-grey-300">{formatBytes(file.size)}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {!hasResults && (
          <fieldset
            className="w-full bg-blue rounded-lg p-4 flex flex-col gap-3 text-left text-sm text-white"
            disabled={isConverting}
          >
            <legend className="sr-only">Opciones de conversión</legend>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="accent-golden w-4 h-4"
                checked={keepOriginalSize}
                onChange={(e) => setKeepOriginalSize(e.target.checked)}
              />
              Mantener la resolución original
            </label>
            <p className="text-grey-300 text-xs -mt-1 ml-6">
              {keepOriginalSize
                ? "No se cambiará el tamaño ni se limitará el peso; solo se aplica la calidad elegida."
                : `Las imágenes de más de ${MAX_DIMENSION} px se reducirán a ese tamaño y se comprimirán hasta ~${MAX_SIZE_MB} MB.`}
            </p>

            <label className="flex flex-col gap-1">
              <span className="flex justify-between">
                <span>Calidad</span>
                <span className="text-golden font-bold">{Math.round(quality * 100)}%</span>
              </span>
              <input
                type="range"
                className="accent-golden w-full"
                min="0.1"
                max="1"
                step="0.05"
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
              />
            </label>
          </fieldset>
        )}

        {isConverting && (
          <div className="w-full flex flex-col gap-2" aria-live="polite">
            <p className="text-white text-center">
              Convirtiendo{" "}
              <span className="text-golden font-bold">
                {progress.done} / {progress.total}
              </span>
              …
            </p>
            <div className="w-full h-2 bg-blue rounded-full overflow-hidden">
              <div
                className="h-full bg-golden transition-all duration-300"
                style={{
                  width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        )}

        {errors.length > 0 && !isConverting && (
          <div
            className="w-full bg-red-900/40 border border-red-500 rounded-lg p-3 text-left text-sm text-white"
            role="alert"
          >
            <p className="font-bold mb-1">
              {errors.length === 1
                ? "1 imagen no se pudo convertir:"
                : `${errors.length} imágenes no se pudieron convertir:`}
            </p>
            <ul className="list-disc list-inside">
              {errors.map((err) => (
                <li key={err.id} className="truncate">
                  <span className="font-semibold">{err.name}</span>
                  <span className="text-grey-300"> — {err.message}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {convertedImages.length > 0 && !isConverting && (
          <p
            className="bg-blue py-3 px-4 rounded-lg text-white text-center"
            aria-live="polite"
          >
            {convertedImages.length === 1
              ? "1 imagen convertida"
              : `${convertedImages.length} imágenes convertidas`}
            : <span className="line-through text-grey-300">{formatBytes(totalOriginal)}</span>{" "}
            → {formatBytes(totalConverted)}{" "}
            <span className="text-golden font-bold text-xl">
              (−{savingPercent(totalOriginal, totalConverted)}%)
            </span>
          </p>
        )}

        {!hasResults && (
          <button
            className="bg-golden text-blue border border-transparent rounded px-3 py-2 font-semibold hover:bg-blue hover:text-golden hover:border-border disabled:cursor-not-allowed disabled:bg-blue-light disabled:text-grey-300 disabled:border-border"
            disabled={images.length === 0 || isConverting}
            onClick={handleConvert}
          >
            {isConverting ? "Convirtiendo…" : "Convertir a WebP"}
          </button>
        )}

        {hasResults && !isConverting && (
          <div className="flex flex-col items-center gap-3">
            {convertedImages.length > 0 && (
              <button
                className="flex justify-center items-center gap-3 text-white text-2xl underline font-semibold hover:text-golden"
                onClick={handleDownload}
              >
                {isSingleDownload ? "Descargar imagen" : "Descargar todas en ZIP"}
                {!isSingleDownload && <LogoZip className="w-8 h-8" />}
              </button>
            )}
            {downloaded && (
              <p className="text-golden font-semibold" aria-live="polite">
                ✓ Descarga iniciada
              </p>
            )}
            <button
              className="text-white underline hover:text-golden"
              onClick={handleReset}
            >
              Convertir más imágenes
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
