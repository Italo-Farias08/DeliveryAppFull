import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
import { PickedImage } from '../services/tenantService';

// Abre a galeria do celular e devolve a imagem escolhida (ou null se
// cancelou/sem permissão). Usada pela logo, pelo banner e pela foto do
// item do cardápio no painel do restaurante.
export async function pickImageFromLibrary(aspect: [number, number]): Promise<PickedImage | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert('Permissão necessária', 'Precisamos acessar suas fotos para você escolher a imagem.');
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect,
    quality: 0.7,
  });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  return { uri: asset.uri, name: asset.fileName, mimeType: asset.mimeType };
}
