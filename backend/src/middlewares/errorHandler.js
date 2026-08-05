function errorHandler(err, req, res, next) {
  // Erros do multer (ex: arquivo maior que o limite) chegam com err.code,
  // não com statusCode — traduzimos para uma resposta 400 amigável.
  if (err.name === 'MulterError') {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'A imagem é muito grande. Envie um arquivo de até 5MB.'
        : 'Não foi possível enviar a imagem.';
    return res.status(400).json({ error: message });
  }

  const statusCode = err.statusCode || 500;
  const message = statusCode === 500 ? 'Erro interno do servidor' : err.message;
  if (statusCode === 500) {
    console.error(err);
  }
  res.status(statusCode).json({ error: message });
}

module.exports = errorHandler;
