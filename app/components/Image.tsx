import {Image as HydrogenImage} from '@shopify/hydrogen';

type HydrogenImageProps = Parameters<typeof HydrogenImage>[0];

export type ImageProps = HydrogenImageProps & {
  gradient?: 'blue' | 'random';
};

/**
 * Image component with multiple gradient backgrounds
 */
export function Image(props: ImageProps) {
  const {gradient = null} = props;

  if (!gradient) return <HydrogenImage {...props} />;

  const commonGradient = {
    bgColor: '#ffffff',
    url: './app/assets/imageBg.jpg',
    size: 'cover',
    repeat: 'no-repeat',
    clip: 'padding-box',
    attachment: 'fixed',
  };

  const gradients = {
    blue: {
      left: '-82.89%',
      right: '0%',
      top: '40%',
      bottom: '0%',
      scale: 3,
    },
    aquaWhite: {
      left: '-82.89%',
      right: '0%',
      top: '40%',
      bottom: '0%',
      scale: 3,
    },
  };

  const isRandom = gradient === 'random';

  let activeGradient;

  if (isRandom) {
    const randomGradientName = Object.keys(gradients)[
      Math.floor(Math.random() * Object.keys(gradients).length)
    ] as keyof typeof gradients;

    activeGradient = gradients[randomGradientName];
  } else {
    activeGradient = gradients[gradient];
  }

  return (
    <div className="relative overflow-hidden">
      <div
        style={{
          position: 'absolute',
          left: activeGradient.left,
          right: activeGradient.right,
          top: activeGradient.top,
          bottom: activeGradient.bottom,
          zIndex: -1,
          backgroundImage: `url(${commonGradient.url})`,
          backgroundColor: commonGradient.bgColor,
          backgroundSize: commonGradient.size,
          backgroundRepeat: commonGradient.repeat,
          backgroundClip: commonGradient.clip,
          backgroundAttachment: commonGradient.attachment,
          transform: `scale(${gradients.blue.scale})`,
          content: '',
        }}
      ></div>
      <HydrogenImage {...props} />
    </div>
  );
}
