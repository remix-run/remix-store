import {Link} from '@remix-run/react';
import background from '~/assets/img/skateboard-bg.png?url';
import heroImage from '~/assets/img/skateboard-hero.png?url';
import {cn} from '~/lib';

export function HeroImage() {
  return (
    <Link
      to="products/mini-skateboard"
      className="bg-[url('/app/assets/img/skateboard-bg.png')] inline-flex bg-cover "
    >
      <img src={heroImage} alt="Skateboard" />
    </Link>
  );
}
