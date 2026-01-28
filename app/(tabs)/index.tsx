import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Image as RNImage,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sparkles, Wand2, ImageIcon, RotateCcw, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '@/constants/colors';
import { useImages } from '@/contexts/ImageContext';
import { AspectRatio } from '@/types/image';

const ASPECT_RATIOS: { value: AspectRatio; label: string; icon: string }[] = [
  { value: '1:1', label: 'Square', icon: '⬜' },
  { value: '16:9', label: 'Wide', icon: '▬' },
  { value: '9:16', label: 'Tall', icon: '▮' },
];

const PROMPT_SUGGESTIONS = [
  'A cyberpunk city at night with neon lights',
  'An enchanted forest with glowing mushrooms',
  'A futuristic spaceship interior',
  'A serene Japanese garden in autumn',
  'An underwater coral reef with bioluminescence',
  'A steampunk clockwork mechanism',
];

export default function GenerateScreen() {
  const insets = useSafeAreaInsets();
  const [prompt, setPrompt] = useState('');
  const {
    isGenerating,
    generateError,
    selectedAspectRatio,
    setSelectedAspectRatio,
    generateImage,
    lastGeneratedImage,
  } = useImages();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (lastGeneratedImage) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [lastGeneratedImage, fadeAnim, scaleAnim]);

  useEffect(() => {
    if (isGenerating) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isGenerating, pulseAnim]);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() || isGenerating) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    fadeAnim.setValue(0);
    scaleAnim.setValue(0.95);
    
    try {
      await generateImage(prompt.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('[GenerateScreen] Generation failed:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  }, [prompt, isGenerating, fadeAnim, scaleAnim, generateImage]);

  const handleSuggestionPress = useCallback((suggestion: string) => {
    Haptics.selectionAsync();
    setPrompt(suggestion);
  }, []);

  const handleAspectRatioChange = useCallback((ratio: AspectRatio) => {
    Haptics.selectionAsync();
    setSelectedAspectRatio(ratio);
  }, [setSelectedAspectRatio]);

  const [imageLoadError, setImageLoadError] = useState<string | null>(null);

  const imageSource = lastGeneratedImage
    ? (lastGeneratedImage.uri
        ? { uri: lastGeneratedImage.uri }
        : (lastGeneratedImage.base64Data 
            ? { uri: `data:${lastGeneratedImage.mimeType || 'image/png'};base64,${lastGeneratedImage.base64Data}` }
            : undefined))
    : undefined;

  const handleImageError = useCallback((e: any) => {
    const errorMsg = e.nativeEvent?.error || e.error || "Unknown error";
    console.error('[GenerateScreen] Image load error:', errorMsg);
    setImageLoadError(String(errorMsg));
  }, []);

  const handleImageLoad = useCallback(() => {
    console.log('[GenerateScreen] Image loaded successfully');
    setImageLoadError(null);
  }, []);

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <LinearGradient
              colors={[Colors.primary, Colors.primaryLight]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconGradient}
            >
              <Sparkles size={24} color="#FFF" />
            </LinearGradient>
            <Text style={styles.title}>AI Image Forge</Text>
            <Text style={styles.subtitle}>Transform your imagination into art</Text>
          </View>

          <View style={styles.inputSection}>
            <Text style={styles.sectionLabel}>Describe your vision</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.textInput}
                placeholder="A mystical dragon flying over ancient ruins..."
                placeholderTextColor={Colors.textMuted}
                value={prompt}
                onChangeText={setPrompt}
                multiline
                numberOfLines={4}
                maxLength={500}
                editable={!isGenerating}
              />
              <View style={styles.inputFooter}>
                <Text style={styles.charCount}>{prompt.length}/500</Text>
                {prompt.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setPrompt('')}
                    style={styles.clearButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <RotateCcw size={16} color={Colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>

          <View style={styles.suggestionsSection}>
            <Text style={styles.sectionLabel}>Try these prompts</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.suggestionsScroll}
            >
              {PROMPT_SUGGESTIONS.map((suggestion, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.suggestionChip}
                  onPress={() => handleSuggestionPress(suggestion)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.suggestionText} numberOfLines={2}>
                    {suggestion}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.aspectSection}>
            <Text style={styles.sectionLabel}>Aspect Ratio</Text>
            <View style={styles.aspectOptions}>
              {ASPECT_RATIOS.map((ratio) => (
                <TouchableOpacity
                  key={ratio.value}
                  style={[
                    styles.aspectOption,
                    selectedAspectRatio === ratio.value && styles.aspectOptionSelected,
                  ]}
                  onPress={() => handleAspectRatioChange(ratio.value)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.aspectIcon}>{ratio.icon}</Text>
                  <Text
                    style={[
                      styles.aspectLabel,
                      selectedAspectRatio === ratio.value && styles.aspectLabelSelected,
                    ]}
                  >
                    {ratio.label}
                  </Text>
                  {selectedAspectRatio === ratio.value && (
                    <View style={styles.checkMark}>
                      <Check size={12} color="#FFF" />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.generateButton,
              (!prompt.trim() || isGenerating) && styles.generateButtonDisabled,
            ]}
            onPress={handleGenerate}
            disabled={!prompt.trim() || isGenerating}
            activeOpacity={0.8}
          >
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <LinearGradient
                colors={
                  !prompt.trim() || isGenerating
                    ? [Colors.surfaceHighlight, Colors.surfaceHighlight]
                    : [Colors.primary, Colors.primaryLight]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.generateGradient}
              >
                {isGenerating ? (
                  <>
                    <ActivityIndicator color="#FFF" size="small" />
                    <Text style={styles.generateText}>Creating magic...</Text>
                  </>
                ) : (
                  <>
                    <Wand2 size={20} color="#FFF" />
                    <Text style={styles.generateText}>Generate Image</Text>
                  </>
                )}
              </LinearGradient>
            </Animated.View>
          </TouchableOpacity>

          {generateError && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>
                {generateError.message || 'Failed to generate image. Please try again.'}
              </Text>
            </View>
          )}

          {lastGeneratedImage && (
            <Animated.View
              style={[
                styles.resultSection,
                {
                  opacity: fadeAnim,
                  transform: [{ scale: scaleAnim }],
                },
              ]}
            >
              <View style={styles.resultHeader}>
                <ImageIcon size={18} color={Colors.primary} />
                <Text style={styles.resultTitle}>Generated Image</Text>
              </View>
              <View style={styles.imageContainer}>
                {imageLoadError ? (
                    <View style={styles.errorContainer}>
                        <Text style={styles.errorText}>Failed to load image: {imageLoadError}</Text>
                        <Text style={[styles.errorText, {fontSize: 10, marginTop: 5}]}>
                            URI: {imageSource?.uri?.substring(0, 50)}...
                        </Text>
                    </View>
                ) : (
                    <RNImage
                      source={imageSource}
                      style={styles.generatedImage}
                      resizeMode="contain"
                      onError={handleImageError}
                      onLoad={handleImageLoad}
                    />
                )}
              </View>
              <Text style={styles.promptUsed} numberOfLines={2}>
                &quot;{lastGeneratedImage.prompt}&quot;
              </Text>
            </Animated.View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  iconGradient: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  inputSection: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  inputContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  textInput: {
    padding: 16,
    fontSize: 16,
    color: Colors.text,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  inputFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  charCount: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  clearButton: {
    padding: 4,
  },
  suggestionsSection: {
    marginBottom: 20,
  },
  suggestionsScroll: {
    gap: 10,
  },
  suggestionChip: {
    backgroundColor: Colors.surfaceLight,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    maxWidth: 180,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  suggestionText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  aspectSection: {
    marginBottom: 24,
  },
  aspectOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  aspectOption: {
    flex: 1,
    backgroundColor: Colors.surface,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  aspectOptionSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surfaceLight,
  },
  aspectIcon: {
    fontSize: 18,
    marginBottom: 6,
  },
  aspectLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  aspectLabelSelected: {
    color: Colors.primary,
  },
  checkMark: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  generateButton: {
    marginBottom: 20,
  },
  generateButtonDisabled: {
    opacity: 0.6,
  },
  generateGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 14,
  },
  generateText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFF',
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  errorText: {
    color: Colors.error,
    fontSize: 14,
    textAlign: 'center',
  },
  resultSection: {
    marginTop: 8,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  imageContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  generatedImage: {
    width: '100%',
    aspectRatio: 1,
  },
  promptUsed: {
    fontSize: 13,
    color: Colors.textMuted,
    fontStyle: 'italic',
    marginTop: 12,
    textAlign: 'center',
  },
});
