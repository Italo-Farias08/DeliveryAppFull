const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const AppError = require('../utils/AppError');

// Pastas ficam em backend/uploads/<subpasta>, fora do banco de dados —
// arquivo em disco, sem blob pesado no Postgres. Em produção, essa pasta
// precisa estar num Volume persistente do Railway (montado em /app/uploads),
// senão os arquivos somem a cada deploy.
const UPLOAD_ROOT = path.join(__dirname, '..', '..', 'uploads');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

const ALLOWED_MIME = /^image\/(jpe?g|png|webp|gif)$/i;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB por imagem (antes de comprimir)

function imageFileFilter(req, file, cb) {
  if (ALLOWED_MIME.test(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError('Envie apenas arquivos de imagem (jpg, png, webp ou gif).', 400));
  }
}

// O arquivo fica em memória (req.file.buffer) em vez de ir direto pro disco,
// porque antes de salvar a gente redimensiona/comprime com sharp
// (ver utils/imageProcessing.js). Isso evita guardar fotos de celular
// gigantes (vários MB, 3000x4000px) sem necessidade.
function buildUploader() {
  return multer({
    storage: multer.memoryStorage(),
    fileFilter: imageFileFilter,
    limits: { fileSize: MAX_FILE_SIZE },
  });
}

// Salva o buffer já processado (webp) em uploads/<subfolder>/<uuid>.webp
// e devolve a URL pública final.
function saveProcessedImage(req, subfolder, buffer) {
  const dir = path.join(UPLOAD_ROOT, subfolder);
  ensureDir(dir);
  const filename = `${crypto.randomUUID()}.webp`;
  fs.writeFileSync(path.join(dir, filename), buffer);
  return `${req.protocol}://${req.get('host')}/uploads/${subfolder}/${filename}`;
}

module.exports = { buildUploader, saveProcessedImage, UPLOAD_ROOT, MAX_FILE_SIZE };
