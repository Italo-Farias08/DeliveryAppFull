function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const message = statusCode === 500 ? 'Erro interno do servidor' : err.message;
  if (statusCode === 500) {
    console.error(err);
  }
  res.status(statusCode).json({ error: message });
}

module.exports = errorHandler;
