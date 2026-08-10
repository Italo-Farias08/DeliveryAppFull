// Nota real de restaurante: quando ninguém ainda avaliou nenhum pedido,
// `rating` fica em 0 (valor padrão da coluna) e `ratingCount` fica em 0/undefined.
// Sem esse helper, a tela mostrava "0.0 ⭐" pra restaurante novo, que parece
// "pior nota possível" em vez de "ainda sem avaliação real".
export function formatRating(rating?: number | null, ratingCount?: number | null): string | null {
  if (!ratingCount || rating == null || rating <= 0) return null;
  return rating.toFixed(1);
}