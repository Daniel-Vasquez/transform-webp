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
      maxSizeMB: 1, // Tamaño máximo de la imagen en MB
      maxWidthOrHeight: 1920, // Dimensiones máximas
      useWebWorker: true, // Usar Web Workers para mejorar el rendimiento
      fileType: "image/webp", // Tipo de archivo de salida
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

      // Recargar la página después de la descarga
      setTimeout(() => window.location.reload(), 500);
    }
  };

  return (
    <div className="App">
      <h1>Convertir Imagen a WebP</h1>
      <input type="file" accept="image/*" onChange={handleImageChange} />
      <button onClick={handleConvert}>Convertir a WebP</button>
      {convertedImageUrl && (
        <button onClick={handleDownload}>Descargar imagen convertida</button>
      )}
    </div>
  );
}

export default App;
