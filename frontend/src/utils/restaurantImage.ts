// Imagem usada só se o restaurante não tiver NENHUMA foto própria (nem
// image, nem banner). Isso deve ser raro -- é só um último recurso.
const FOOD_FALLBACKS = [
  'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&q=80', // pizza
  'https://images.unsplash.com/photo-1550547660-d9450f859349?w=600&q=80', // burger
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&q=80', // sushi
  'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=600&q=80', // massa
  'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=600&q=80', // salada
];

export function getFallbackRestaurantImage(id: string) {
  // hash simples pra sempre cair na mesma imagem pro mesmo restaurante
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return { uri: FOOD_FALLBACKS[hash % FOOD_FALLBACKS.length] };
}
