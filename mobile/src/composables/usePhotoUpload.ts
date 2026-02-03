import { ref } from 'vue';
import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/config/firebase';
import type { PhotoSignalement } from '@/types';

// Qualité de compression (0-100)
const COMPRESSION_QUALITY = 100;
// Taille maximum en pixels (largeur ou hauteur)
const MAX_IMAGE_SIZE = 1200;

/**
 * Composable pour gérer l'upload de photos vers Firebase Storage
 */
export function usePhotoUpload() {
  const uploading = ref(false);
  const uploadProgress = ref(0);
  const error = ref<string | null>(null);

  /**
   * Prendre une photo avec la caméra (fonctionne sur web et mobile)
   */
  async function takePhotoWithCamera(): Promise<Photo | null> {
    error.value = null;
    try {
      console.log('Ouverture de la caméra...');
      const photo = await Camera.getPhoto({
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera,
        quality: COMPRESSION_QUALITY
      });
      console.log('Photo caméra prise:', photo ? 'OK' : 'null', photo?.webPath);
      return photo;
    } catch (err: any) {
      console.error('Erreur takePhotoWithCamera:', err);
      if (err.message !== 'User cancelled photos app' && !err.message?.includes('cancelled')) {
        error.value = 'Erreur lors de la prise de photo: ' + err.message;
      }
      return null;
    }
  }

  /**
   * Sélectionner une photo depuis la galerie
   */
  async function pickPhoto(): Promise<Photo | null> {
    error.value = null;
    try {
      console.log('Ouverture de la galerie...');
      const photo = await Camera.getPhoto({
        resultType: CameraResultType.Uri,
        source: CameraSource.Photos,
        quality: COMPRESSION_QUALITY
      });
      console.log('Photo galerie sélectionnée:', photo ? 'OK' : 'null', photo?.webPath);
      return photo;
    } catch (err: any) {
      console.error('Erreur pickPhoto:', err);
      if (err.message !== 'User cancelled photos app' && !err.message?.includes('cancelled')) {
        error.value = 'Erreur lors de la sélection de photo';
      }
      return null;
    }
  }

  /**
   * Choisir une photo (propose caméra ou galerie)
   */
  async function choosePhoto(): Promise<Photo | null> {
    error.value = null;
    try {
      console.log('Ouverture du sélecteur de photo...');
      const photo = await Camera.getPhoto({
        resultType: CameraResultType.Uri,
        source: CameraSource.Prompt,
        quality: COMPRESSION_QUALITY,
        promptLabelHeader: 'Photo',
        promptLabelPhoto: 'Galerie',
        promptLabelPicture: 'Appareil photo',
        promptLabelCancel: 'Annuler'
      });
      console.log('Photo sélectionnée:', photo ? 'OK' : 'null');
      return photo;
    } catch (err: any) {
      console.error('Erreur choosePhoto:', err);
      if (err.message !== 'User cancelled photos app' && !err.message?.includes('cancelled')) {
        error.value = 'Erreur lors de la sélection de photo: ' + err.message;
      }
      return null;
    }
  }

  /**
   * Convertit un blob en base64
   */
  function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Upload une photo vers Firebase Storage
   */
  async function uploadPhoto(
    signalementId: string,
    photo: Photo,
    ordre: number = 0
  ): Promise<PhotoSignalement | null> {
    if (!storage) {
      error.value = 'Firebase Storage non configuré';
      return null;
    }

    if (!photo.webPath) {
      error.value = 'Photo invalide (pas de webPath)';
      return null;
    }

    uploading.value = true;
    uploadProgress.value = 0;
    error.value = null;

    try {
      // Récupérer le blob depuis webPath
      const response = await fetch(photo.webPath);
      const blob = await response.blob();
      
      uploadProgress.value = 30;

      // Générer un nom de fichier unique
      const timestamp = Date.now();
      const extension = photo.format || 'jpeg';
      const fileName = `photo_${timestamp}_${ordre}.${extension}`;
      const firebasePath = `signalements/${signalementId}/${fileName}`;

      // Créer la référence Firebase Storage
      const photoRef = storageRef(storage, firebasePath);

      uploadProgress.value = 50;

      // Upload le blob
      await uploadBytes(photoRef, blob, {
        contentType: `image/${extension}`
      });

      uploadProgress.value = 80;

      // Récupérer l'URL de téléchargement
      const downloadUrl = await getDownloadURL(photoRef);

      uploadProgress.value = 100;

      console.log('Photo uploadée:', downloadUrl);

      return {
        url: downloadUrl,
        firebase_path: firebasePath,
        nom_fichier: fileName,
        taille_bytes: blob.size,
        mime_type: `image/${extension}`,
        ordre: ordre
      };
    } catch (err: any) {
      console.error('Erreur uploadPhoto:', err);
      error.value = 'Erreur lors de l\'upload de la photo: ' + err.message;
      return null;
    } finally {
      uploading.value = false;
    }
  }

  /**
   * Upload plusieurs photos
   */
  async function uploadPhotos(
    signalementId: string,
    photos: Photo[]
  ): Promise<PhotoSignalement[]> {
    const uploadedPhotos: PhotoSignalement[] = [];

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      const result = await uploadPhoto(signalementId, photo, i);
      if (result) {
        uploadedPhotos.push(result);
      }
    }

    return uploadedPhotos;
  }

  /**
   * Obtenir la prévisualisation d'une photo (webPath)
   */
  function getPhotoPreview(photo: Photo): string {
    return photo.webPath || '';
  }

  return {
    uploading,
    uploadProgress,
    error,
    takePhotoWithCamera,
    pickPhoto,
    choosePhoto,
    uploadPhoto,
    uploadPhotos,
    getPhotoPreview
  };
}
