import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  Dimensions,
  Modal,
  Alert,
  Platform,
  Image as RNImage,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Trash2, X, ImageIcon, Clock, Share2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import Colors from '@/constants/colors';
import { useImages } from '@/contexts/ImageContext';
import { GeneratedImage } from '@/types/image';

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = globalThis.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_SIZE = (SCREEN_WIDTH - 52) / 2;

export default function GalleryScreen() {
  const insets = useSafeAreaInsets();
  const { images, deleteImage, clearAllImages } = useImages();
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);

  const handleImagePress = useCallback((image: GeneratedImage) => {
    Haptics.selectionAsync();
    setSelectedImage(image);
  }, []);

  const handleDelete = useCallback(async (imageId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    Alert.alert(
      'Delete Image',
      'Are you sure you want to delete this image?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const imageToDelete = images.find(img => img.id === imageId);
            if (imageToDelete) {
                await deleteImage(imageToDelete);
                setSelectedImage(null);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
          },
        },
      ]
    );
  }, [deleteImage, images]);

  const handleClearAll = useCallback(() => {
    if (images.length === 0) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    
    Alert.alert(
      'Clear Gallery',
      'This will delete all generated images. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await clearAllImages();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  }, [images.length, clearAllImages]);

  const handleShare = useCallback(async (image: GeneratedImage) => {
    try {
      if (Platform.OS === 'web') {
        Alert.alert('Share', 'Sharing is not supported on web');
        return;
      }

      let fileUri = image.uri;
      
      if (!fileUri) {
        if (!image.base64Data) {
          Alert.alert('Error', 'Image data is missing');
          return;
        }
        
        try {
          const tempFile = new File(Paths.cache, `share_${image.id}.png`);
          await tempFile.create({ overwrite: true, intermediates: true });
          const bytes = base64ToUint8Array(image.base64Data);
          await tempFile.write(bytes);
          fileUri = tempFile.uri;
        } catch (e) {
          console.error('[GalleryScreen] Failed to write share file:', e);
          Alert.alert('Error', 'Failed to prepare image for sharing');
          return;
        }
      }

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri);
      } else {
        Alert.alert('Error', 'Sharing is not available on this device');
      }
    } catch (error) {
      console.error('[GalleryScreen] Share failed:', error);
      Alert.alert('Error', 'Failed to share image');
    }
  }, []);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderItem = useCallback(({ item }: { item: GeneratedImage }) => {
    let source;
    if (item.uri) {
        source = { uri: item.uri };
    } else if (item.base64Data && item.base64Data.length > 100) {
        source = { uri: item.base64Data.startsWith('data:') 
            ? item.base64Data 
            : `data:${item.mimeType || 'image/png'};base64,${item.base64Data}` };
    }
    
    return (
      <TouchableOpacity
        style={styles.imageCard}
        onPress={() => handleImagePress(item)}
        activeOpacity={0.85}
      >
        <Image 
          source={source} 
          style={styles.thumbnail} 
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
        />
        <View style={styles.imageOverlay}>
          <Text style={styles.imagePrompt} numberOfLines={2}>
            {item.prompt}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }, [handleImagePress]);

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <ImageIcon size={48} color={Colors.textMuted} />
      </View>
      <Text style={styles.emptyTitle}>No images yet</Text>
      <Text style={styles.emptySubtitle}>
        Generated images will appear here
      </Text>
    </View>
  );

  const selectedImageSource = selectedImage
    ? (selectedImage.uri
        ? { uri: selectedImage.uri }
        : (selectedImage.base64Data && selectedImage.base64Data.length > 100
            ? { uri: selectedImage.base64Data.startsWith('data:')
                ? selectedImage.base64Data
                : `data:${selectedImage.mimeType || 'image/png'};base64,${selectedImage.base64Data}` }
            : undefined))
    : undefined;

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Gallery</Text>
          <Text style={styles.subtitle}>
            {images.length} {images.length === 1 ? 'image' : 'images'} created
          </Text>
        </View>
        {images.length > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={handleClearAll}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Trash2 size={18} color={Colors.error} />
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={images}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={[
          styles.listContent,
          images.length === 0 && styles.emptyListContent,
        ]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmptyState}
      />

      <Modal
        visible={!!selectedImage}
        animationType="fade"
        transparent
        onRequestClose={() => setSelectedImage(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                style={styles.modalClose}
                onPress={() => setSelectedImage(null)}
              >
                <X size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            {selectedImage && (
              <>
                <View style={styles.modalImageContainer}>
                  <RNImage
                    source={selectedImageSource}
                    style={styles.modalImage}
                    resizeMode="contain"
                    onError={(e) => console.error('[Gallery] Image load error:', e.nativeEvent.error)}
                  />
                </View>

                <View style={styles.modalInfo}>
                  <Text style={styles.modalPrompt}>&quot;{selectedImage.prompt}&quot;</Text>
                  <View style={styles.modalMeta}>
                    <Clock size={14} color={Colors.textMuted} />
                    <Text style={styles.modalDate}>
                      {formatDate(selectedImage.createdAt)}
                    </Text>
                    <Text style={styles.modalSize}>{selectedImage.size}</Text>
                  </View>
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.modalActionButton}
                    onPress={() => handleShare(selectedImage)}
                  >
                    <Share2 size={20} color={Colors.text} />
                    <Text style={styles.modalActionText}>Share</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalActionButton, styles.deleteButton]}
                    onPress={() => handleDelete(selectedImage.id)}
                  >
                    <Trash2 size={20} color={Colors.error} />
                    <Text style={[styles.modalActionText, styles.deleteText]}>
                      Delete
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
  },
  clearText: {
    fontSize: 14,
    color: Colors.error,
    fontWeight: '500',
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
  },
  emptyListContent: {
    flex: 1,
  },
  row: {
    gap: 12,
    marginBottom: 12,
  },
  imageCard: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  imagePrompt: {
    fontSize: 11,
    color: '#FFF',
    lineHeight: 14,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 24,
    backgroundColor: Colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    maxHeight: '90%',
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  modalClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImageContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  modalImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 16,
    backgroundColor: Colors.background,
  },
  modalInfo: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  modalPrompt: {
    fontSize: 16,
    color: Colors.text,
    fontStyle: 'italic',
    lineHeight: 22,
    marginBottom: 12,
  },
  modalMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalDate: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  modalSize: {
    fontSize: 13,
    color: Colors.textMuted,
    marginLeft: 'auto',
  },
  modalActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
  },
  modalActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.surfaceLight,
  },
  deleteButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  modalActionText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  deleteText: {
    color: Colors.error,
  },
});
