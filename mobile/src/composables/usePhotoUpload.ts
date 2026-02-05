import { ref } from 'vue';
import { Camera, CameraResultType, CameraSource, Photo } from '@capacitor/camera';
import type { PhotoSignalement } from '@/types';

// Configuration Cloudinary depuis les variables d'environnement
const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '';
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'travaux_routiers';

// URL d'upload Cloudinary
const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

// Qualité de compression (0-100)
const COMPRESSION_QUALITY = 100;

/**
 * Composable pour gérer l'upload de photos vers Cloudinary (GRATUIT)
 * Les URLs sont ensuite stockées dans Firebase Firestore
 */
export function usePhotoUpload() {
  const uploading = ref(false);
  const uploadProgress = ref(0);
  const error = ref<string | null>(null);

  /**
   * Vérifie si Cloudinary est configuré
   */
  function isCloudinaryConfigured(): boolean {
    return CLOUDINARY_CLOUD_NAME !== '' && CLOUDINARY_CLOUD_NAME !== 'votre_cloud_name';
  }

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
   * Compresse une image pour réduire sa taille
   */
  async function compressImage(blob: Blob, maxWidth: number = 800, quality: number = 0.7): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Impossible de créer le contexte canvas'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (compressedBlob) => {
            if (compressedBlob) {
              console.log(`Image compressée: ${blob.size} -> ${compressedBlob.size} bytes`);
              resolve(compressedBlob);
            } else {
              reject(new Error('Échec de la compression'));
            }
          },
          'image/jpeg',
          quality
        );
      };
      
      img.onerror = () => reject(new Error('Erreur de chargement de l\'image'));
      img.src = URL.createObjectURL(blob);
    });
  }

  /**
   * Upload une photo vers Cloudinary (GRATUIT, pas besoin de carte bancaire)
   * Retourne l'URL qui sera stockée dans Firebase Firestore
   */
  async function uploadPhoto(
    signalementId: string,
    photo: Photo,
    ordre: number = 0
  ): Promise<PhotoSignalement | null> {
    if (!isCloudinaryConfigured()) {
      error.value = 'Cloudinary non configuré. Ajoutez VITE_CLOUDINARY_CLOUD_NAME dans .env';
      console.error('Cloudinary non configuré. Cloud name:', CLOUDINARY_CLOUD_NAME);
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
      const originalBlob = await response.blob();
      
      uploadProgress.value = 20;

      // Compresser l'image (max 800px, qualité 70%)
      const blob = await compressImage(originalBlob, 800, 0.7);
      
      uploadProgress.value = 40;

      // Générer un nom de fichier unique
      const timestamp = Date.now();
      const fileName = `signalement_${signalementId}_${timestamp}_${ordre}`;

      // Préparer les données pour Cloudinary
      const formData = new FormData();
      formData.append('file', blob, `${fileName}.jpg`);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      formData.append('folder', `travaux_routiers/signalements/${signalementId}`);
      formData.append('public_id', fileName);

      uploadProgress.value = 50;

      // Upload vers Cloudinary
      console.log('Upload vers Cloudinary...');
      const uploadResponse = await fetch(CLOUDINARY_UPLOAD_URL, {
        method: 'POST',
        body: formData
      });

      uploadProgress.value = 80;

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(errorData.error?.message || 'Erreur upload Cloudinary');
      }

      const result = await uploadResponse.json();
      
      uploadProgress.value = 100;

      console.log('Photo uploadée sur Cloudinary:', result.secure_url);

      // Retourner les infos de la photo (URL Cloudinary stockée dans Firebase)
      return {
        url: result.secure_url,
        firebase_path: `cloudinary:${result.public_id}`, // Référence Cloudinary
        nom_fichier: `${fileName}.jpg`,
        taille_bytes: blob.size,
        mime_type: 'image/jpeg',
        ordre: ordre
      };
    } catch (err: any) {
      console.error('Erreur uploadPhoto:', err);
      error.value = 'Erreur lors de l\'upload: ' + err.message;
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
      uploadProgress.value = Math.round((i / photos.length) * 100);
      const result = await uploadPhoto(signalementId, photo, i);
      if (result) {
        uploadedPhotos.push(result);
      }
    }

    uploadProgress.value = 100;
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
    getPhotoPreview,
    isCloudinaryConfigured
  };
}
