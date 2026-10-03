import React, { useRef } from 'react';
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

  const nightModeActive = isNightMode !== undefined ? isNightMode : isDark;
  const mediaBaseUri = mediaManager.getMediaDirectory();

  const fullHtml = buildHtmlDocument(
    htmlContent,
    css,
    templateOrd,
    nightModeActive,
    mediaBaseUri
  );

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'sound') {
        // Prevent duplicate playback: call onAudioPlay if provided, otherwise audioService.play
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
