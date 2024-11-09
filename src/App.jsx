import { useState } from "react";
import imageCompression from "browser-image-compression";

function App() {
  const [image, setImage] = useState(null);
  const [convertedImageUrl, setConvertedImageUrl] = useState(null);

  const handleImageChange = (e) => {
    setImage(e.target.files[0]);
  };

  const handleConvert = async () => {
    if (!image) return;

    const options = {
      maxSizeMB: 1,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
      fileType: "image/webp",
    };

    try {
      const compressedImage = await imageCompression(image, options);
      const convertedImageUrl = URL.createObjectURL(compressedImage);
      setConvertedImageUrl(convertedImageUrl);
    } catch (error) {
      console.error("Error al convertir la imagen:", error);
    }
  };

  const handleDownload = () => {
    if (convertedImageUrl) {
      const link = document.createElement("a");
      link.href = convertedImageUrl;
      link.download = "converted.webp";
      link.click();

      setTimeout(() => window.location.reload(), 1500);
    }
  };

  return (
    <div className="bg-blue flex flex-col justify-center items-center min-h-screen">
      <div className="flex flex-col justify-center items-center gap-5 border-2 border-border px-11 py-28 rounded-xl">
        <h1 className="text-5xl font-bold text-center text-white">
          Convertir Imagen a WebP
        </h1>
        <input
          className="w-72 border border-border rounded px-3 py-2 text-white font-semibold"
          type="file"
          accept="image/*"
          onChange={handleImageChange}
        />
        <button
          className="bg-golden text-blue border border-transparent rounded px-3 py-2 font-semibold hover:bg-blue hover:text-golden hover:border-border disabled:cursor-no-drop disabled:bg-grey-400 disabled:opacity-80 disabled:text-white"
          onClick={handleConvert}
          disabled={!image}
        >
          Convertir a WebP
        </button>
        <div className="h-7">
          {convertedImageUrl && (
            <button
              className="text-white text-2xl underline font-semibold hover:text-golden"
              onClick={handleDownload}
            >
              Descargar imagen convertida
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
