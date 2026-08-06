const sharp = require('sharp');

// Fotos de celular costumam vir enormes (3000x4000px, vários MB). Ninguém
// precisa disso pra mostrar um logo de 80x80 ou um card de item de menu.
// Aqui a gente redimensiona pro tamanho máximo que a imagem realmente
// aparece no app e comprime pra webp, que é bem mais leve que jpg/png com
// qualidade visual equivalente. Isso reduz o peso do arquivo (e o tempo
// pra carregar) em geral 80-95%.
const PRESETS = {
  logo: { maxWidth: 400, maxHeight: 400, quality: 80 },
  banner: { maxWidth: 1280, maxHeight: 720, quality: 78 },
  menuItem: { maxWidth: 800, maxHeight: 800, quality: 78 },
};

// Recebe o buffer original (vindo do multer) e devolve um buffer webp já
// redimensionado e comprimido, pronto pra salvar.
async function processImage(buffer, presetName) {
  const preset = PRESETS[presetName] || PRESETS.menuItem;
  return sharp(buffer)
    .rotate() // corrige orientação de fotos tiradas na vertical (EXIF)
    .resize({
      width: preset.maxWidth,
      height: preset.maxHeight,
      fit: 'inside', // nunca aumenta imagem pequena, só reduz a grande
      withoutEnlargement: true,
    })
    .webp({ quality: preset.quality })
    .toBuffer();
}

module.exports = { processImage };
