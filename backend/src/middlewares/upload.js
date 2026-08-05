const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const AppError = require('../utils/AppError');

// Pastas ficam em backend/uploads/<subpasta>, fora do banco de dados —
// arquivo em disco, sem blob pesado no Postgres.
const UPLOAD_ROOT = path.join(__dirname, '..', '..', 'uploads');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

const ALLOWED_MIME = /^image\/(jpe?g|png|webp|gif)$/i;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB por imagem

function imageFileFilter(req, file, cb) {
  if (ALLOWED_MIME.test(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError('Envie apenas arquivos de imagem (jpg, png, webp ou gif).', 400));
  }
}

// Cria um middleware multer que salva em uploads/<subfolder>/<uuid>.<ext>
function buildUploader(subfolder) {
  const dir = path.join(UPLOAD_ROOT, subfolder);
  ensureDir(dir);
  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, dir),
    filename: (req, file, cb) => {
      const ext = (path.extname(file.originalname || '').toLowerCase() || '.jpg').slice(0, 10);
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  });
  return multer({ storage, fileFilter: imageFileFilter, limits: { fileSize: MAX_FILE_SIZE } });
}

// Monta a URL pública final (absoluta) para o arquivo que acabou de ser salvo.
// Guardamos essa URL pronta no banco, então o app não precisa saber nada
// sobre onde/como o arquivo está guardado no servidor.
function publicUrlFor(req, subfolder, filename) {
  return `${req.protocol}://${req.get('host')}/uploads/${subfolder}/${filename}`;
}

module.exports = { buildUploader, publicUrlFor, UPLOAD_ROOT, MAX_FILE_SIZE };
