import React, {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { ImageSourcePropType, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Image, ImageLoadEventData } from 'expo-image';
import CacheManager from './CacheManager';
import { isAndroid, isImageWithRequire, isRemoteImage } from './helpers';
import { IProps, ImageProps } from './types';

const AnimatedView = Animated.View;

const defaultProps = {
  onError: () => {},
};

function useIsComponentMounted() {
  const isMounted = useRef(false);
  // @ts-ignore
  useEffect(() => {
    isMounted.current = true;
    return () => (isMounted.current = false);
  }, []);
  return isMounted;
}

function useStateIfMounted<S>(
  initialState: S | (() => S)
): [S, Dispatch<SetStateAction<S>>] {
  const isComponentMounted = useIsComponentMounted();
  const [state, setState] = React.useState(initialState);

  const newSetState = useCallback(
    (value: any) => {
      if (isComponentMounted.current) {
        setState(value);
      }
    },
    [isComponentMounted]
  );

  return [state, newSetState];
}

const CachedImage = (props: IProps & typeof defaultProps) => {
  const [error, setError] = useStateIfMounted<boolean>(false);
  const [uri, setUri] = useStateIfMounted<string | undefined>(undefined);
  const { source: propsSource, options: propsOptions } = props;
  const currentSource = useRef<string>(propsSource);

  const animatedImage = useSharedValue(0);
  const animatedThumbnailImage = useSharedValue(0);
  const animatedLoadingImage = useSharedValue(1);

  const imageSourceAnimatedStyle = useAnimatedStyle(() => {
    return { opacity: animatedImage.value };
  });

  const thumbnailSourceAnimatedStyle = useAnimatedStyle(() => {
    return { opacity: animatedThumbnailImage.value };
  });

  const loadingImageAnimatedStyle = useAnimatedStyle(() => {
    return { opacity: animatedLoadingImage.value };
  });

  useEffect(() => {
    if (isRemoteImage(propsSource)) {
      load(props as ImageProps).catch();
    } else {
      setUri(propsSource);
    }

    if (propsSource !== currentSource.current) {
      currentSource.current = propsSource;
      resetAnimations();
    }
    /* eslint-disable react-hooks/exhaustive-deps */
  }, [propsSource, propsOptions]);

  const load = async ({
    maxAge,
    noCache = false,
    onError,
    options = {},
    source,
  }: ImageProps): Promise<void> => {
    if (source) {
      try {
        const path = await CacheManager.get(
          source,
          options,
          noCache,
          maxAge
        ).getPath();

        if (path) {
          setUri(path);
          setError(false);
        } else {
          setUri(undefined);
          setError(true);
          onError({
            nativeEvent: { error: new Error('Could not load image') },
          });
        }
      } catch (e: any) {
        setUri(undefined);
        setError(true);
        onError({ nativeEvent: { error: e } });
      }
    }
  };
  const resetAnimations = () => {
    animatedLoadingImage.value = 1;
    animatedThumbnailImage.value = 0;
    animatedImage.value = 0;
  };

  const onThumbnailLoad = () => {
    animatedLoadingImage.value = withTiming(0, {}, () => {
      animatedThumbnailImage.value = withTiming(1, {
        duration:
          props.thumbnailAnimationDuration === 0
            ? 0
            : props.thumbnailAnimationDuration ||
              CacheManager?.config?.thumbnailAnimationDuration ||
              100,
      });
    });
  };

  const onImageError = (): void => {
    if (props.onError) {
      props.onError();
    }
    setError(true);
  };

  const onImageLoad = (e: ImageLoadEventData): void => {
    if (props.onLoad) {
      props.onLoad(e);
    }
    animatedImage.value = withTiming(1, {
      duration:
        props.sourceAnimationDuration === 0
          ? 0
          : props.sourceAnimationDuration ||
            CacheManager?.config?.sourceAnimationDuration ||
            100,
    });
  };

  const {
    accessibilityHint,
    accessibilityHintLoadingImage,
    accessibilityHintThumbnail,
    accessibilityLabel,
    accessibilityLabelLoadingImage,
    accessibilityLabelThumbnail,
    accessibilityRole,
    accessibilityRoleLoadingSource,
    accessibilityRoleThumbnail,
    blurRadius,
    imageStyle,
    loadingImageComponent: LoadingImageComponent,
    loadingImageStyle = props.style,
    loadingSource,
    resizeMode,
    style,
    testID,
    thumbnailSource,
    ...rest
  } = props;

  const isImageReady = useMemo(() => !!uri, [uri, propsSource]);

  const imageSource = useMemo(() => {
    if (error || !uri) {
      return loadingSource;
    }

    if (isRemoteImage(propsSource) || !isImageWithRequire(propsSource)) {
      return {
        uri: isAndroid() ? `file://${uri}` : uri,
      };
    }

    /* If reached here it means it's not http image or local path eg:"/data/user/0/com.reactnativeimagecacheexample/.."
     * so its local image with Require method
     */
    return uri as ImageSourcePropType;
  }, [uri, error, propsSource]);

  return (
    <View style={[styles.container, style]} testID={testID}>
      {!isImageReady &&
        (LoadingImageComponent ? (
          <AnimatedView
            style={[styles.loadingImageStyle, loadingImageAnimatedStyle]}
          >
            <LoadingImageComponent />
          </AnimatedView>
        ) : (
          <View style={[styles.loadingImageStyle]}>
            {loadingSource && (
              <AnimatedView
                style={[
                  styles.loadingImageStyle,
                  loadingImageStyle,
                  loadingImageAnimatedStyle,
                ]}
              >
                <Image
                  accessibilityHint={accessibilityHintLoadingImage}
                  accessibilityLabel={accessibilityLabelLoadingImage}
                  accessibilityRole={accessibilityRoleLoadingSource || 'image'}
                  accessible
                  contentFit={resizeMode || 'contain'}
                  source={loadingSource}
                  cachePolicy={'memory'}
                />
              </AnimatedView>
            )}
          </View>
        ))}
      {thumbnailSource && (
        <AnimatedView style={[style, thumbnailSourceAnimatedStyle]}>
          <Image
            accessibilityHint={accessibilityHintThumbnail}
            accessibilityLabel={accessibilityLabelThumbnail}
            accessibilityRole={accessibilityRoleThumbnail || 'image'}
            accessible
            blurRadius={blurRadius || CacheManager.config.blurRadius}
            onLoad={onThumbnailLoad}
            contentFit={resizeMode || 'contain'}
            source={{ uri: thumbnailSource }}
            cachePolicy={'memory'}
          />
        </AnimatedView>
      )}
      {imageSource && (
        <AnimatedView
          style={[styles.imageStyle, imageSourceAnimatedStyle, imageStyle]}
        >
          <Image
            {...rest}
            accessibilityHint={accessibilityHint}
            accessibilityLabel={accessibilityLabel}
            accessibilityRole={accessibilityRole || 'image'}
            accessible
            onError={onImageError}
            onLoad={onImageLoad}
            onLoadEnd={props.onLoadEnd}
            contentFit={resizeMode || 'contain'}
            tintColor={props.tintColor}
            source={imageSource}
            cachePolicy={'memory'}
          />
        </AnimatedView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
  },
  imageStyle: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  loadingImageStyle: {
    alignItems: 'center',
    alignSelf: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
});

CachedImage.defaultProps = defaultProps;

export default CachedImage;
