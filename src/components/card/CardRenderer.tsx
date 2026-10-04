import React, { useRef, useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native';
import { WebView } from 'react-native-webview';
import { useTheme } from '../../theme';
import { buildHtmlDocument } from '../../core/render/templateEngine';
import { mediaManager } from '../../core/media/mediaManager';
import { audioService } from '../../core/audio/audioService';

interface CardRendererProps {
  htmlContent: string;
  css?: string;
  templateOrd?: number;
  isNightMode?: boolean;
  onAudioPlay?: (filename: string) => void;
  onFlip?: () => void;
  style?: ViewStyle;
}

export const CardRenderer: React.FC<CardRendererProps> = ({
  htmlContent,
  css = '',
  templateOrd = 0,
  isNightMode,
  onAudioPlay,
  onFlip,
  style,
}) => {
  const { isDark, colors } = useTheme();
  const webViewRef = useRef<WebView>(null);
  const [resolvedHtml, setResolvedHtml] = useState<string>(htmlContent);

  const nightModeActive = isNightMode !== undefined ? isNightMode : isDark;
  const mediaBaseUri = mediaManager.getMediaDirectory();

  useEffect(() => {
    let isCancelled = false;

    const processHtml = async () => {
      console.log('[MEDIA] Raw field HTML:', htmlContent);

      const imgRegex = /<img\b([^>]*?)src=(?:["']([^"']+)["']|([^\s>]+))([^>]*)>/gi;
      let match;
      const imgTags: { fullTag: string; before: string; src: string; after: string }[] = [];

      while ((match = imgRegex.exec(htmlContent)) !== null) {
        const before = match[1] || '';
        const src = (match[2] || match[3] || '').trim();
        const after = match[4] || '';
        if (src) {
          imgTags.push({ fullTag: match[0], before, src, after });
        }
      }

      if (imgTags.length === 0) {
        if (!isCancelled) setResolvedHtml(htmlContent);
        return;
      }

      let updated = htmlContent;

      for (const { fullTag, before, src, after } of imgTags) {
        console.log(`[MEDIA] Extracted image filename: "${src}"`);
        if (
          src.startsWith('http://') ||
          src.startsWith('https://') ||
          src.startsWith('data:')
        ) {
          console.log(`[MEDIA] Remote image URI: "${src}", exists: true`);
          continue;
        }

        const resolved = await mediaManager.resolveMediaUri(src);
        console.log(`[MEDIA] Resolved image URI: "${resolved}", exists: ${resolved !== null}`);

        const cleanName = src.replace(/^\[sound:/i, '').replace(/\]$/, '').replace(/^['"]|['"]$/g, '').trim();

        if (resolved) {
          const wrapper = `<span class="anki-img-container" style="display:inline-block; max-width:100%;"><img${before}src="${resolved}"${after} onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='inline-flex';" /><span class="missing-media-placeholder" style="display:none; align-items:center; justify-content:center; gap:6px; padding:6px 12px; margin:6px auto; background:rgba(239,68,68,0.08); border:1px dashed rgba(239,68,68,0.4); border-radius:6px; color:#ef4444; font-size:12px; font-family:sans-serif;">🖼️ [Image error: ${cleanName}]</span></span>`;
          updated = updated.replace(fullTag, wrapper);
        } else {
          // File missing from storage - show placeholder
          const placeholder = `<span class="missing-media-placeholder" style="display:inline-flex; align-items:center; justify-content:center; gap:6px; padding:6px 12px; margin:6px auto; background:rgba(239,68,68,0.08); border:1px dashed rgba(239,68,68,0.4); border-radius:6px; color:#ef4444; font-size:12px; font-family:sans-serif;">🖼️ [Image missing: ${cleanName}]</span>`;
          updated = updated.replace(fullTag, placeholder);
        }
      }

      if (!isCancelled) {
        setResolvedHtml(updated);
      }
    };

    processHtml();

    return () => {
      isCancelled = true;
    };
  }, [htmlContent]);

  const fullHtml = buildHtmlDocument(
    resolvedHtml,
    css,
    templateOrd,
    nightModeActive,
    mediaBaseUri
  );

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'sound') {
        console.log(`[MEDIA] Sound button tapped in WebView: "${data.file}"`);
        if (onAudioPlay) {
          onAudioPlay(data.file);
        } else if (data.file) {
          audioService.play(data.file);
        }
      } else if (data.type === 'flip') {
        if (onFlip) {
          onFlip();
        }
      }
    } catch (e) {
      // Ignore non-json messages
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: 'transparent' }, style]}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{
          html: fullHtml,
          baseUrl: mediaBaseUri,
        }}
        style={[
          styles.webview,
          { backgroundColor: 'transparent' },
        ]}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowFileAccess={true}
        allowFileAccessFromFileURLs={true}
        allowUniversalAccessFromFileURLs={true}
        allowingReadAccessToURL={mediaBaseUri}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback={true}
        onMessage={handleMessage}
        renderLoading={() => (
          <View style={[styles.loadingOverlay, { backgroundColor: colors.surfaceRaised }]}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        )}
        startInLoadingState={false}
        scalesPageToFit={false}
        scrollEnabled={true}
        nestedScrollEnabled={true}
        showsVerticalScrollIndicator={true}
        overScrollMode="always"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
