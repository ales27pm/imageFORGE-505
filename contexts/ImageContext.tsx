import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useState, useCallback, useMemo, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Platform } from 'react-native';
import { GeneratedImage, AspectRatio, ASPECT_RATIO_MAP } from '@/types/image';
import { File, Directory, Paths } from 'expo-file-system';

const STORAGE_KEY = 'ai_forge_images';
const MAX_STORED_IMAGES = 10;

const imagesDir = Platform.OS !== 'web' ? new Directory(Paths.document, 'images') : null;

function base64ToUint8Array(base64: string): Uint8Array {
  // Trim whitespace/newlines (we already remove data URL prefixes upstream)
  let clean = base64.replace(/[\r\n\s]+/g, '');
  // Hermès atob requires the length to be a multiple of 4
  const remainder = clean.length % 4;
  if (remainder === 2) {
    clean += '==';
  } else if (remainder === 3) {
    clean += '=';
  } else if (remainder === 1) {
    // Rare case: add three '='
    clean += '===';
  }
  const binaryString = globalThis.atob(clean);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function ensureDirExists() {
  if (Platform.OS === 'web' || !imagesDir) return;
  try {
    await imagesDir.create({ intermediates: true });
  } catch (err) {
    console.warn('[ImageContext] Failed to create images directory:', err);
  }
}

async function generateImageAPI(prompt: string, size: string): Promise<{
  image: { base64Data: string; mimeType: string };
  size: string;
}> {
  console.log('[ImageContext] Generating image with prompt:', prompt);
  
  const response = await fetch('https://toolkit.rork.com/images/generate/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt, size }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[ImageContext] Generation failed:', errorText);
    throw new Error('Failed to generate image');
  }

  const data = await response.json();
  console.log('[ImageContext] Image generated successfully');
  console.log('[ImageContext] Data mimeType:', data.image.mimeType);
  console.log('[ImageContext] Base64 length:', data.image.base64Data?.length);

  if (data.image?.base64Data) {
    let b64 = data.image.base64Data.replace(/[\r\n\s]+/g, '');
    
    if (b64.startsWith('data:')) {
      const commaIndex = b64.indexOf(',');
      if (commaIndex !== -1) {
        b64 = b64.substring(commaIndex + 1);
      }
    }

    console.log('[ImageContext] Base64 processed length:', b64.length);
    console.log('[ImageContext] Base64 prefix:', b64.substring(0, 50));
    
    data.image.base64Data = b64;
  }

  if (!data.image.mimeType) {
    data.image.mimeType = 'image/png';
  }

  return data;
}

export const [ImageProvider, useImages] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<AspectRatio>('1:1');

  const imagesQuery = useQuery({
    queryKey: ['generated-images'],
    queryFn: async () => {
      console.log('[ImageContext] Loading images from storage');
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      const images = stored ? JSON.parse(stored) : [];
      
      if (Platform.OS === 'web') {
        return images as GeneratedImage[];
      }

      await ensureDirExists();
      
      let existingFiles: string[] = [];
      try {
        if (imagesDir) {
          const contents = await imagesDir.list();
          existingFiles = contents
            .filter((item): item is File => !(item instanceof Directory))
            .map((fileItem) => {
              const parts = fileItem.uri.split('/');
              return parts[parts.length - 1];
            });
        }
      } catch (e) {
        console.warn('[ImageContext] Failed to read images directory:', e);
      }
      
      const existingFilesSet = new Set(existingFiles);
      console.log('[ImageContext] Found', existingFiles.length, 'files on disk');

      const validImages = await Promise.all(images.map(async (img: GeneratedImage) => {
        const filename = `${img.id}.png`;
        const file = imagesDir ? new File(imagesDir, filename) : null;
        const expectedUri = file?.uri || '';
        
        if (existingFilesSet.has(filename)) {
          img.uri = expectedUri;
        } else {
          console.warn('[ImageContext] File missing for image:', img.id);
          
          if (img.base64Data && img.base64Data.length > 100 && file) {
            try {
              console.log('[ImageContext] Restoring file from base64 for:', img.id);
              await file.create({ overwrite: true, intermediates: true });
              const bytes = base64ToUint8Array(img.base64Data);
              await file.write(bytes);
              img.uri = file.uri;
            } catch (err) {
              console.error('[ImageContext] Failed to restore file:', err);
              img.uri = '';
            }
          } else {
            img.uri = '';
          }
        }
        return img;
      }));

      console.log('[ImageContext] Loaded', validImages.length, 'images');
      return validImages as GeneratedImage[];
    },
  });

  const saveImagesMutation = useMutation({
    mutationFn: async (images: GeneratedImage[]) => {
      const trimmed = images.slice(0, MAX_STORED_IMAGES);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
      return trimmed;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['generated-images'], data);
    },
  });

  const generateMutation = useMutation({
    mutationFn: async (prompt: string) => {
      const size = ASPECT_RATIO_MAP[selectedAspectRatio];
      const result = await generateImageAPI(prompt, size);
      
      await ensureDirExists();

      const newImage: GeneratedImage = {
        id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        prompt,
        base64Data: result.image.base64Data,
        uri: '', 
        mimeType: result.image.mimeType,
        size: result.size,
        createdAt: Date.now(),
      };

      if (Platform.OS !== 'web' && imagesDir) {
        const filename = `${newImage.id}.png`;
        const file = new File(imagesDir, filename);
        
        try {
          await file.create({ overwrite: true, intermediates: true });
          const bytes = base64ToUint8Array(result.image.base64Data);
          await file.write(bytes);
          
          const fileExists = file.exists;
          const fileSize = file.size;
          
          if (fileExists) {
            console.log('[ImageContext] Saved image to:', file.uri, 'size:', fileSize);
            
            if (fileSize != null && fileSize < 100) {
              console.error('[ImageContext] File write appeared to succeed but file is missing or empty');
            }
          } else {
            console.error('[ImageContext] File write failed, file does not exist');
          }

          newImage.uri = file.uri;
        } catch (error) {
          console.error('[ImageContext] Failed to save image to file system:', error);
          throw error;
        }
      }

      const currentImages = imagesQuery.data || [];
      const updatedImages = [newImage, ...currentImages];
      await saveImagesMutation.mutateAsync(updatedImages);
      
      return { ...newImage, base64Data: result.image.base64Data };
    },
  });

  const { mutateAsync: saveImagesAsync } = saveImagesMutation;

  const deleteImage = useCallback(async (image: GeneratedImage) => {
    console.log('[ImageContext] Deleting image:', image.id);
    
    if (image.uri && Platform.OS !== 'web') {
      try {
        const file = new File(image.uri);
        file.delete();
      } catch (e) {
        console.warn('[ImageContext] Failed to delete file:', e);
      }
    }

    const currentImages = imagesQuery.data || [];
    const updatedImages = currentImages.filter(img => img.id !== image.id);
    await saveImagesAsync(updatedImages);
  }, [imagesQuery.data, saveImagesAsync]);

  const clearAllImages = useCallback(async () => {
    console.log('[ImageContext] Clearing all images');
    
    if (Platform.OS !== 'web') {
      const currentImages = imagesQuery.data || [];
      for (const img of currentImages) {
        if (img.uri) {
          try {
            const file = new File(img.uri);
            file.delete();
          } catch (e) {
            console.warn('[ImageContext] Failed to delete file:', e);
          }
        }
      }
    }

    await saveImagesAsync([]);
  }, [imagesQuery.data, saveImagesAsync]);

  const images = useMemo(() => imagesQuery.data || [], [imagesQuery.data]);

  return {
    images,
    isLoading: imagesQuery.isLoading,
    isGenerating: generateMutation.isPending,
    generateError: generateMutation.error,
    selectedAspectRatio,
    setSelectedAspectRatio,
    generateImage: generateMutation.mutateAsync,
    deleteImage,
    clearAllImages,
    lastGeneratedImage: generateMutation.data,
  };
});
