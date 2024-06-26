import {Image, type ImageProps} from '~/components/Image';

export function CartImage(props: ImageProps) {
  const {gradient = 'random'} = props;
  return (
    <div className="cart-image">
      <Image gradient="random" {...props} />
    </div>
  );
}
