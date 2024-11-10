import { useState } from "react";
import imageCompression from "browser-image-compression";
import JSZip from "jszip";
import { LogoZip } from "./components/LogoZip";

function App() {
  const [images, setImages] = useState([]);
  const [convertedImages, setConvertedImages] = useState([]);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = (files) => {
    setImages((prevImages) => [...prevImages, ...Array.from(files)]);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleImageChange = (e) => {
    handleFiles(e.target.files);
  };

  const handleConvert = async () => {
    if (images.length === 0) return;

    const options = {
      maxSizeMB: 1,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
      fileType: "image/webp",
    };

    try {
      const converted = await Promise.all(
        images.map(async (image) => {
          const compressedImage = await imageCompression(image, options);
          return {
            name: image.name.split(".")[0] + ".webp",
            file: compressedImage,
          };
        })
      );

      setConvertedImages(converted);
    } catch (error) {
      console.error("Error al convertir las imágenes:", error);
    }
  };

  const handleDownload = async () => {
    if (convertedImages.length === 0) return;

    const zip = new JSZip();
    convertedImages.forEach(({ name, file }) => {
      zip.file(name, file);
    });

    const zipBlob = await zip.generateAsync({ type: "blob" });
    const zipUrl = URL.createObjectURL(zipBlob);

    const link = document.createElement("a");
    link.href = zipUrl;
    link.download = "converted_images.zip";
    link.click();

    setTimeout(() => {
      URL.revokeObjectURL(zipUrl);
      window.location.reload();
    }, 500);
  };

  return (
    <div className="h-full bg-blue-medium flex flex-col justify-center items-center">
      <div className="flex flex-col justify-center items-center gap-5 border-0 md:border-2 border-border px-4 py-7 md:px-11 md:py-28 rounded-2xl">
        <h1 className="text-2xl font-bold text-center text-white md:text-5xl">
          Convertir Imágenes a WebP
        </h1>

        <div
          className={`flex flex-col gap-4 drop-zone ${isDragging ? "dragging" : ""}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <p className="text-golden font-bold">
            Arrastra y suelta las imágenes aquí, o
          </p>
          <input
            className="hidden"
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageChange}
          />
          <button
            className="text-white underline font-bold"
            onClick={() => document.querySelector('input[type="file"]').click()}
          >
            Seleccionar imágenes
          </button>
        </div>

        <div className="h-24 mb-4">
          {images.length > 0 && (
            <div className="bg-blue-light p-3 rounded-lg">
              <p className="flex flex-col items-center gap-1 text-xl text-white text-center">
                <span className="text-golden font-bold text-3xl">
                  {images.length}{" "}
                </span>
                {images.length === 1 ? "Imagen añadida" : "Imágenes añadidas"}{" "}
                correctamente.
              </p>
            </div>
          )}
        </div>

        <button
          className="bg-golden text-blue border border-transparent rounded px-3 py-2 font-semibold hover:bg-blue hover:text-golden hover:border-border disabled:cursor-no-drop disabled:bg-grey-400 disabled:opacity-80 disabled:text-white"
          disabled={images.length === 0}
          onClick={handleConvert}
        >
          Convertir a WebP
        </button>

        <div className="h-7">
          {convertedImages.length > 0 && (
            <button
              className="flex justify-center items-center gap-3 text-white text-2xl underline font-semibold hover:text-golden"
              onClick={handleDownload}
            >
              Descargar
              <LogoZip className="w-8 h-8"/>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
