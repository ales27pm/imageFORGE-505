export interface GeneratedImage {
  id: string;
  prompt: string;
  uri: string; // Local file URI
  base64Data?: string;
  mimeType: string;
  size: string;
  createdAt: number;
}

export interface GenerationSettings {
  size: '1024x1024' | '1024x1792' | '1792x1024';
}

export type AspectRatio = '1:1' | '16:9' | '9:16';

export const ASPECT_RATIO_MAP: Record<AspectRatio, string> = {
  '1:1': '1024x1024',
  '16:9': '1792x1024',
  '9:16': '1024x1792',
};
